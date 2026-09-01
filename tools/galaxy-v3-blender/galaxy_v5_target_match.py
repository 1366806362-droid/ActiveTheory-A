#!/usr/bin/env python3
"""Build a five-layer Galaxy V5 candidate from the approved home target.

The approved target supplies the cinematic silhouette and color hierarchy. The
existing main-galaxy source supplies only aligned high-frequency stellar detail;
it does not replace the approved large-scale structure.
"""

from __future__ import annotations

import argparse
import math
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


LAYER_NAMES = (
    "galaxy-v5-bg.webp",
    "galaxy-v5-far-arm.webp",
    "galaxy-v5-core.webp",
    "galaxy-v5-near-arm.webp",
    "galaxy-v5-foreground.webp",
)
OUTPUT_SIZE = (1600, 900)


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - low) / max(high - low, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def blur(values: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(values, 0.0, 1.0) * 255), "L")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def cover_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def soft_ellipse(
    xx: np.ndarray,
    yy: np.ndarray,
    center: tuple[float, float],
    axes: tuple[float, float],
    angle_degrees: float,
    inner: float = 0.78,
) -> np.ndarray:
    angle = math.radians(angle_degrees)
    dx = xx - center[0]
    dy = yy - center[1]
    rx = (dx * math.cos(angle) + dy * math.sin(angle)) / axes[0]
    ry = (-dx * math.sin(angle) + dy * math.cos(angle)) / axes[1]
    radius = np.sqrt(rx * rx + ry * ry)
    return 1.0 - smoothstep(inner, 1.0, radius)


def aligned_source_detail(source_path: Path, size: tuple[int, int]) -> np.ndarray:
    source = Image.open(source_path).convert("RGBA")
    source.thumbnail((1120, 720), Image.Resampling.LANCZOS)
    source = source.rotate(-8.0, resample=Image.Resampling.BICUBIC, expand=True)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(source, (430, 112))
    rgba = np.asarray(canvas, dtype=np.float32) / 255.0
    detail_luma = luminance(rgba[..., :3]) * rgba[..., 3]
    return detail_luma - blur(detail_luma, 2.1)


def suppress_target_overlays(mask: np.ndarray, xx: np.ndarray, yy: np.ndarray) -> np.ndarray:
    # The approved image is a composition reference. Exclude its UI, Earth and
    # business-entry nodes so the runtime keeps ownership of those live layers.
    exclusion = np.zeros_like(mask)
    exclusion = np.maximum(exclusion, 1.0 - smoothstep(360.0, 455.0, xx))
    earth = ((xx - 150.0) / 390.0) ** 2 + ((yy - 790.0) / 330.0) ** 2
    exclusion = np.maximum(exclusion, 1.0 - smoothstep(0.80, 1.14, earth))
    for left, top, right, bottom, feather in (
        (430.0, 150.0, 735.0, 380.0, 34.0),
        (1110.0, 0.0, 1530.0, 235.0, 42.0),
        (990.0, 560.0, 1390.0, 820.0, 42.0),
    ):
        inside_x = np.minimum(xx - left, right - xx)
        inside_y = np.minimum(yy - top, bottom - yy)
        signed_distance = np.minimum(inside_x, inside_y)
        rectangle = smoothstep(-feather, feather, signed_distance)
        exclusion = np.maximum(exclusion, rectangle)
    return mask * (1.0 - exclusion)


def add_stellar_granularity(
    rgb: np.ndarray,
    alpha: np.ndarray,
    arm_probability: np.ndarray,
    seed: int = 5101,
) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    height, width = alpha.shape
    flat = np.clip(arm_probability.ravel(), 0.0, None)
    total = float(flat.sum())
    if total <= 0:
        return rgb, alpha
    probabilities = flat / total
    count = 2450
    picks = rng.choice(flat.size, size=count, replace=True, p=probabilities)
    ys, xs = np.divmod(picks, width)

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for index, (x, y) in enumerate(zip(xs, ys)):
        tier = rng.random()
        if tier < 0.80:
            radius, opacity = 0.45, int(rng.integers(48, 105))
        elif tier < 0.97:
            radius, opacity = 0.85, int(rng.integers(105, 172))
        else:
            radius, opacity = 1.35, int(rng.integers(175, 235))
        warmth = rng.random()
        color = (255, 230, 190, opacity) if warmth < 0.16 else (194, 222, 255, opacity)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)
        if tier >= 0.985:
            draw.line((x - 3, y, x + 3, y), fill=(*color[:3], opacity // 3), width=1)
            draw.line((x, y - 3, x, y + 3), fill=(*color[:3], opacity // 3), width=1)

    stellar = np.asarray(overlay, dtype=np.float32) / 255.0
    overlay_alpha = stellar[..., 3]
    rgb = rgb * (1.0 - overlay_alpha[..., None]) + stellar[..., :3] * overlay_alpha[..., None]
    alpha = np.maximum(alpha, overlay_alpha * 0.92)
    return rgb, alpha


def build_plate(target_path: Path, source_path: Path) -> tuple[Image.Image, tuple[float, float]]:
    target = cover_crop(Image.open(target_path).convert("RGB"), OUTPUT_SIZE)
    rgb = np.asarray(target, dtype=np.float32) / 255.0
    luma = luminance(rgb)
    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)

    search = np.zeros_like(luma)
    search[220:650, 560:1180] = 1.0
    weight = np.power(np.clip(luma * search, 0.0, 1.0), 7.0)
    weight_sum = max(float(weight.sum()), 1e-6)
    core_x = float((xx * weight).sum() / weight_sum)
    core_y = float((yy * weight).sum() / weight_sum)

    silhouette = soft_ellipse(xx, yy, (core_x + 40.0, core_y + 5.0), (720.0, 390.0), -13.0)
    structure = blur(luma, 7.5)
    fine = np.maximum(luma - blur(luma, 1.4), 0.0)
    alpha = (
        smoothstep(0.010, 0.085, structure) * 0.58
        + smoothstep(0.018, 0.20, luma) * 0.48
        + smoothstep(0.012, 0.10, fine) * 0.38
    ) * silhouette
    alpha = suppress_target_overlays(np.clip(alpha, 0.0, 0.99), xx, yy)

    # Use the legacy galaxy only as a granular frequency source, never as a new silhouette.
    source_detail = aligned_source_detail(source_path, OUTPUT_SIZE)
    arms = smoothstep(0.025, 0.22, structure) * silhouette
    positive_detail = smoothstep(0.010, 0.085, np.maximum(source_detail, 0.0)) * arms
    negative_detail = smoothstep(0.010, 0.075, np.maximum(-source_detail, 0.0)) * arms
    rgb += positive_detail[..., None] * np.array([0.11, 0.14, 0.18], dtype=np.float32)
    rgb *= 1.0 - negative_detail[..., None] * 0.22

    # Deepen natural target lanes and add two broad, interrupted negative structures.
    local_mean = blur(luma, 12.0)
    natural_dust = smoothstep(0.020, 0.16, np.maximum(local_mean - luma, 0.0)) * arms
    dx = (xx - core_x) / 220.0
    dy = (yy - core_y) / 105.0
    lane_a = np.exp(-((dy - 0.20 - 0.14 * dx - 0.025 * dx * dx) / 0.22) ** 2)
    lane_b = np.exp(-((dy + 0.65 + 0.10 * dx) / 0.28) ** 2)
    breakup = blur(np.random.default_rng(5102).random(luma.shape).astype(np.float32), 18.0)
    breakup = smoothstep(0.47, 0.54, breakup)
    dust = np.clip(natural_dust * 0.68 + (lane_a * 0.40 + lane_b * 0.24) * arms * breakup, 0.0, 1.0)
    rgb *= 1.0 - dust[..., None] * 0.58
    rgb += arms[..., None] * np.array([0.018, 0.027, 0.044], dtype=np.float32)

    # Keep the nucleus compact while retaining a silver/ivory bulge interrupted by dust.
    core_dx = (xx - core_x) / 128.0
    core_dy = (yy - core_y) / 72.0
    bulge = np.exp(-(core_dx * core_dx + core_dy * core_dy))
    broad_highlight = smoothstep(0.34, 0.88, luminance(rgb)) * bulge
    rgb *= 1.0 - broad_highlight[..., None] * 0.34
    nucleus = np.exp(-(((xx - core_x) / 21.0) ** 2 + ((yy - core_y) / 13.0) ** 2))
    ivory = np.array([1.0, 0.91, 0.75], dtype=np.float32)
    silver = np.array([0.70, 0.77, 0.84], dtype=np.float32)
    rgb = rgb * (1.0 - (bulge * 0.08)[..., None]) + silver * (bulge * 0.08)[..., None]
    rgb = rgb * (1.0 - (nucleus * 0.92)[..., None]) + ivory * (nucleus * 0.92)[..., None]
    rgb *= 1.0 - (dust * bulge * 0.24)[..., None]

    arm_probability = np.clip(arms * (0.24 + smoothstep(0.010, 0.12, fine)) * alpha, 0.0, 1.0)
    rgb, alpha = add_stellar_granularity(rgb, alpha, arm_probability)

    # Neutralize broad magenta while preserving a few muted star-forming pockets.
    red_excess = np.maximum(rgb[..., 0] - (rgb[..., 1] + rgb[..., 2]) * 0.52, 0.0)
    rgb[..., 0] -= red_excess * 0.28
    rgb[..., 2] += red_excess * 0.06
    rgb = np.clip(rgb, 0.0, 1.0)
    rgba = np.dstack((rgb, np.clip(alpha, 0.0, 0.995)))
    return Image.fromarray(np.uint8(rgba * 255), "RGBA"), (core_x, core_y)


def build_ldi(plate: Image.Image, core: tuple[float, float], output_directory: Path) -> float:
    rgba = np.asarray(plate, dtype=np.float32) / 255.0
    rgb = rgba[..., :3]
    base_alpha = rgba[..., 3]
    layer_rgb = np.clip(rgb * 1.16, 0.0, 1.0)
    luma = luminance(rgb)
    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    core_x, core_y = core
    radial = np.sqrt(((xx - core_x) / 710.0) ** 2 + ((yy - core_y) / 390.0) ** 2)
    angle = np.arctan2((yy - core_y) / 0.62, xx - core_x)
    fine = smoothstep(0.012, 0.11, np.maximum(luma - blur(luma, 1.8), 0.0))
    bulge = np.exp(-(((xx - core_x) / 145.0) ** 2 + ((yy - core_y) / 82.0) ** 2))

    background = smoothstep(0.30, 0.90, radial) * (0.42 + (1.0 - luma) * 0.28)
    far_arm = np.clip((0.42 + 0.34 * np.sin(angle * 2.0 + radial * 9.0)) * (1.0 - bulge), 0.0, 1.0)
    core_weight = bulge * (0.72 + luma * 0.38)
    near_arm = np.clip((0.48 - 0.32 * np.sin(angle * 2.0 + radial * 9.0)) * (1.0 - bulge * 0.55), 0.0, 1.0)
    foreground = fine * smoothstep(0.13, 0.58, luma) * (0.30 + 0.70 * (1.0 - radial))
    weights = np.stack((background, far_arm, core_weight, near_arm, foreground))
    weights = np.stack([blur(np.clip(weight, 0.0, 1.0), 1.4) for weight in weights])
    weights *= base_alpha[None, ...]
    weights /= np.maximum(weights.sum(axis=0, keepdims=True), 1e-6)

    output_directory.mkdir(parents=True, exist_ok=True)
    composite = np.zeros_like(rgb)
    for index, name in enumerate(LAYER_NAMES):
        layer_alpha = 1.0 - np.power(1.0 - base_alpha, weights[index])
        layer = np.dstack((layer_rgb, layer_alpha))
        Image.fromarray(np.uint8(np.clip(layer, 0.0, 1.0) * 255), "RGBA").save(
            output_directory / name,
            "WEBP",
            lossless=True,
            method=6,
        )
        composite = layer_rgb * layer_alpha[..., None] + composite * (1.0 - layer_alpha[..., None])
    expected = layer_rgb * base_alpha[..., None]
    return float(np.mean(np.abs(composite - expected)) * 255.0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--plate-output", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()

    plate, core = build_plate(args.target, args.source)
    args.plate_output.parent.mkdir(parents=True, exist_ok=True)
    plate.save(args.plate_output, "PNG", optimize=True)
    mae = build_ldi(plate, core, args.output_directory)

    print(f"generation_seconds={time.perf_counter() - started:.3f}")
    print(f"core={core[0]:.2f},{core[1]:.2f}")
    print(f"reconstruction_mae_8bit={mae:.4f}")
    print(f"plate={args.plate_output.resolve()}")
    for name in LAYER_NAMES:
        print((args.output_directory / name).resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
