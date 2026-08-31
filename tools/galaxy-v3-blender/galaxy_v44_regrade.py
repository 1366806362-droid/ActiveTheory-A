#!/usr/bin/env python3
"""Regrade the approved Galaxy V4 plate and rebuild its existing five LDI assets."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


LAYER_NAMES = (
    "galaxy-v4-bg.webp",
    "galaxy-v4-far-arm.webp",
    "galaxy-v4-core.webp",
    "galaxy-v4-near-arm.webp",
    "galaxy-v4-foreground.webp",
)


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - low) / (high - low), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def blur(values: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(values, 0.0, 1.0) * 255), "L")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def aligned_source_detail(source_path: Path, size: tuple[int, int]) -> np.ndarray:
    source = Image.open(source_path).convert("RGBA")
    source = source.resize((920, 650), Image.Resampling.LANCZOS).rotate(
        -5.5,
        resample=Image.Resampling.BICUBIC,
        expand=True,
    )
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.paste(source, (386, 27), source)
    rgba = np.asarray(canvas, dtype=np.float32) / 255.0
    return luminance(rgba[..., :3]) * rgba[..., 3]


def make_breakup_field(size: tuple[int, int]) -> np.ndarray:
    rng = np.random.default_rng(4404)
    width, height = size
    broad = Image.fromarray(np.uint8(rng.random((15, 27)) * 255), "L").resize(
        (width, height), Image.Resampling.BICUBIC
    ).filter(ImageFilter.GaussianBlur(11.0))
    local = Image.fromarray(np.uint8(rng.random((35, 63)) * 255), "L").resize(
        (width, height), Image.Resampling.BICUBIC
    ).filter(ImageFilter.GaussianBlur(4.0))
    return (
        np.asarray(broad, dtype=np.float32) * 0.58
        + np.asarray(local, dtype=np.float32) * 0.42
    ) / 255.0


def regrade_plate(baseline_path: Path, source_path: Path) -> Image.Image:
    baseline = Image.open(baseline_path).convert("RGB")
    rgb = np.asarray(baseline, dtype=np.float32) / 255.0
    original_luma = luminance(rgb)
    source_luma = aligned_source_detail(source_path, baseline.size)
    source_detail = source_luma - blur(source_luma, 1.35)

    highlight_weight = np.clip(original_luma - 0.2, 0.0, 1.0) ** 4
    total = float(highlight_weight.sum())
    yy, xx = np.indices(original_luma.shape, dtype=np.float32)
    core_x = float((xx * highlight_weight).sum() / total)
    core_y = float((yy * highlight_weight).sum() / total)
    dx = (xx - core_x) / 152.0
    dy = (yy - core_y) / 76.0
    core = np.exp(-(dx * dx + dy * dy))
    bulge = np.exp(-((dx * 0.58) ** 2 + (dy * 0.72) ** 2))
    arms = smoothstep(0.018, 0.24, original_luma) * (1.0 - core * 0.78)

    # Break long continuous strokes into clustered stellar material without adding noise.
    breakup = smoothstep(0.34, 0.68, make_breakup_field(baseline.size))
    rgb *= (1.0 - arms[..., None] * (1.0 - breakup[..., None]) * 0.58)

    # Reinforce existing high-frequency stars while keeping broad arm light restrained.
    granular = smoothstep(0.018, 0.13, np.maximum(source_detail, 0.0)) * arms
    negative_detail = smoothstep(0.014, 0.11, np.maximum(-source_detail, 0.0)) * arms
    rgb += granular[..., None] * np.array([0.16, 0.18, 0.20], dtype=np.float32)
    rgb *= 1.0 - negative_detail[..., None] * 0.20

    # Restore natural dark lanes, including an asymmetric interruption through the bulge.
    local_average = blur(original_luma, 9.0)
    natural_dust = smoothstep(0.022, 0.15, np.maximum(local_average - original_luma, 0.0)) * arms
    curved_lane_y = 0.18 + 0.16 * dx + 0.035 * dx * dx
    core_lane = np.exp(-((dy - curved_lane_y) / 0.23) ** 2) * bulge
    dust = np.clip(natural_dust * 0.64 + core_lane * (0.46 + 0.3 * breakup), 0.0, 1.0)
    rgb *= 1.0 - dust[..., None] * 0.48

    # Compress only the broad white core; retain a compact ivory nucleus and silver bulge.
    current_luma = luminance(rgb)
    broad_highlight = smoothstep(0.34, 0.86, current_luma) * bulge
    rgb *= 1.0 - broad_highlight[..., None] * 0.31
    nucleus = np.exp(-((dx / 0.28) ** 2 + (dy / 0.34) ** 2))
    ivory = np.array([1.0, 0.93, 0.79], dtype=np.float32)
    silver = np.array([0.73, 0.78, 0.82], dtype=np.float32)
    rgb = rgb * (1.0 - (nucleus * 0.42)[..., None]) + ivory * (nucleus * 0.42)[..., None]
    rgb = rgb * (1.0 - (bulge * 0.065)[..., None]) + silver * (bulge * 0.065)[..., None]

    # Fade faint plate edges sooner so the galaxy dissolves into real black space.
    structure = blur(original_luma, 4.0)
    edge_fade = smoothstep(0.004, 0.072, structure)
    edge_fade *= 0.72 + 0.28 * breakup
    rgb *= edge_fade[..., None]
    rgb = np.clip(rgb, 0.0, 1.0)
    return Image.fromarray(np.uint8(rgb * 255), "RGB")


def build_ldi(plate: Image.Image, depth_path: Path, output_directory: Path) -> float:
    rgb = np.asarray(plate, dtype=np.float32) / 255.0
    depth_image = Image.open(depth_path).convert("L")
    if depth_image.size != plate.size:
        depth_image = depth_image.resize(plate.size, Image.Resampling.BICUBIC)
    depth = blur(np.asarray(depth_image, dtype=np.float32) / 255.0, 1.25)
    plate_luma = luminance(rgb)

    centers = np.array([0.08, 0.27, 0.50, 0.71, 0.89], dtype=np.float32)
    widths = np.array([0.18, 0.17, 0.18, 0.17, 0.12], dtype=np.float32)
    weights = np.stack([
        np.exp(-0.5 * ((depth - center) / width) ** 2)
        for center, width in zip(centers, widths)
    ])
    local = blur(plate_luma, 6.0)
    texture = smoothstep(0.015, 0.10, np.abs(plate_luma - local))
    selected_foreground = smoothstep(0.72, 0.92, depth) * texture
    weights[4] *= selected_foreground
    weights[3] *= 1.0 - selected_foreground * 0.24
    weights = np.stack([blur(weight, 1.8) for weight in weights])
    weights /= np.maximum(weights.sum(axis=0, keepdims=True), 1e-6)

    # Higher shared alpha keeps dark arm colors dark when adjacent LDI layers separate.
    base_alpha = np.clip(np.max(rgb, axis=2) ** 0.42, 0.0, 0.988)
    straight_rgb = np.divide(
        rgb,
        np.maximum(base_alpha[..., None], 1e-4),
        out=np.zeros_like(rgb),
        where=base_alpha[..., None] > 1e-4,
    )
    straight_rgb = np.clip(straight_rgb, 0.0, 1.0)

    output_directory.mkdir(parents=True, exist_ok=True)
    composite = np.zeros_like(rgb)
    for index, name in enumerate(LAYER_NAMES):
        layer_alpha = 1.0 - np.power(1.0 - base_alpha, weights[index])
        rgba = np.dstack((straight_rgb, layer_alpha))
        Image.fromarray(np.uint8(np.clip(rgba, 0.0, 1.0) * 255), "RGBA").save(
            output_directory / name,
            "WEBP",
            lossless=True,
            method=6,
        )
        composite = straight_rgb * layer_alpha[..., None] + composite * (1.0 - layer_alpha[..., None])

    return float(np.mean(np.abs(composite - rgb)) * 255.0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--depth", type=Path, required=True)
    parser.add_argument("--plate-output", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()

    plate = regrade_plate(args.baseline, args.source)
    args.plate_output.parent.mkdir(parents=True, exist_ok=True)
    plate.save(args.plate_output, "PNG", optimize=True)
    mae = build_ldi(plate, args.depth, args.output_directory)

    print(f"generation_seconds={time.perf_counter() - started:.3f}")
    print(f"reconstruction_mae_8bit={mae:.4f}")
    print(f"plate={args.plate_output.resolve()}")
    for name in LAYER_NAMES:
        print((args.output_directory / name).resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
