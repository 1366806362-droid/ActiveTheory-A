#!/usr/bin/env python3
"""Apply a directed spiral-cohesion correction to the existing Galaxy V5 plate."""

from __future__ import annotations

import argparse
import math
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


LAYER_NAMES = (
    "galaxy-v5_1-bg.webp",
    "galaxy-v5_1-far-arm.webp",
    "galaxy-v5_1-core.webp",
    "galaxy-v5_1-near-arm.webp",
    "galaxy-v5_1-foreground.webp",
)


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - low) / max(high - low, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def blur(values: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(values, 0.0, 1.0) * 255), "L")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def blur_rgb(values: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(values, 0.0, 1.0) * 255), "RGB")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def find_core(luma: np.ndarray, alpha: np.ndarray) -> tuple[float, float]:
    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    search = np.zeros_like(luma)
    search[210:650, 520:1210] = 1.0
    weight = np.power(np.clip(luma * alpha * search, 0.0, 1.0), 7.0)
    total = max(float(weight.sum()), 1e-6)
    return float((xx * weight).sum() / total), float((yy * weight).sum() / total)


def polar_field(shape: tuple[int, int], core: tuple[float, float]):
    height, width = shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    angle = math.radians(-13.0)
    dx = xx - core[0]
    dy = yy - core[1]
    xr = dx * math.cos(angle) + dy * math.sin(angle)
    yr = -dx * math.sin(angle) + dy * math.cos(angle)
    u = xr / 700.0
    v = yr / 365.0
    radius = np.sqrt(u * u + v * v)
    theta = np.arctan2(v, u)
    return xx, yy, radius, theta, xr, yr


def suppress_target_overlays(mask: np.ndarray, xx: np.ndarray, yy: np.ndarray) -> np.ndarray:
    """Keep the target frame's live UI, Earth and business nodes out of the plate."""
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
        exclusion = np.maximum(exclusion, smoothstep(-feather, feather, signed_distance))
    return mask * (1.0 - exclusion)


def fit_primary_spiral(luma: np.ndarray, alpha: np.ndarray, radius: np.ndarray, theta: np.ndarray):
    annulus = smoothstep(0.12, 0.24, radius) * (1.0 - smoothstep(0.82, 1.03, radius))
    signal = smoothstep(0.025, 0.30, luma) * alpha * annulus
    best_score = -1.0
    best = (1.65, 0.0)
    for pitch in np.linspace(1.15, 2.35, 17):
        logarithm = np.log(radius + 0.105)
        for offset in np.linspace(0.0, math.pi, 28, endpoint=False):
            phase = theta - pitch * logarithm - offset
            arm = np.exp(-0.5 * (np.sin(phase) / 0.24) ** 2)
            weighted = arm * annulus
            score = float((signal * weighted).sum() / max(weighted.sum(), 1e-6))
            if score > best_score:
                best_score = score
                best = (float(pitch), float(offset))
    pitch, offset = best
    phase = theta - pitch * np.log(radius + 0.105) - offset
    raw = np.exp(-0.5 * (np.sin(phase) / 0.235) ** 2)
    primary = blur(raw * annulus, 7.0)
    primary = np.clip(primary / max(float(primary.max()), 1e-6), 0.0, 1.0)
    return primary, phase, annulus, pitch, offset


def tangent_stellar_field(
    rgb: np.ndarray,
    alpha: np.ndarray,
    probability: np.ndarray,
    theta: np.ndarray,
    pitch: float,
    seed: int = 5110,
) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    height, width = alpha.shape
    flat = np.clip(probability.ravel(), 0.0, None)
    total = float(flat.sum())
    if total <= 0:
        return rgb, alpha
    picks = rng.choice(flat.size, size=1180, replace=True, p=flat / total)
    ys, xs = np.divmod(picks, width)
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for x, y in zip(xs, ys):
        tangent = float(theta[y, x] + math.atan2(1.0, pitch))
        length = float(rng.uniform(1.2, 3.6))
        dx = math.cos(tangent) * length
        dy = math.sin(tangent) * length * 0.58
        opacity = int(rng.integers(36, 112))
        warm = rng.random() < 0.15
        color = (255, 226, 188, opacity) if warm else (188, 218, 255, opacity)
        draw.line((x - dx, y - dy, x + dx, y + dy), fill=color, width=1)
        if rng.random() < 0.10:
            draw.ellipse((x - 0.7, y - 0.7, x + 0.7, y + 0.7), fill=(*color[:3], min(160, opacity + 30)))
    layer = np.asarray(overlay, dtype=np.float32) / 255.0
    layer_alpha = layer[..., 3]
    rgb = rgb * (1.0 - layer_alpha[..., None]) + layer[..., :3] * layer_alpha[..., None]
    alpha = np.maximum(alpha, layer_alpha * 0.78)
    return rgb, alpha


def correct_plate(v5_path: Path) -> tuple[Image.Image, tuple[float, float], dict[str, float]]:
    rgba = np.asarray(Image.open(v5_path).convert("RGBA"), dtype=np.float32) / 255.0
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    source_alpha = alpha.copy()
    luma = luminance(rgb)
    core = find_core(luma, alpha)
    xx, yy, radius, theta, _, _ = polar_field(luma.shape, core)
    primary, phase, annulus, pitch, offset = fit_primary_spiral(luma, alpha, radius, theta)

    structure = smoothstep(0.018, 0.24, blur(luma, 4.0)) * annulus
    off_arm = np.clip((1.0 - primary) * structure, 0.0, 1.0)

    # Reduce the existing high-frequency field and suppress fragments outside the two primary arms.
    softened = blur_rgb(rgb, 1.15)
    high_frequency = rgb - softened
    rgb = softened + high_frequency * (0.54 + 0.30 * primary[..., None])
    rgb *= 1.0 - off_arm[..., None] * 0.27
    alpha *= 1.0 - off_arm * 0.32

    # Reinforce both primary arms as broad coherent structures, not as extra noise.
    arm_lift = primary * annulus * (0.32 + 0.68 * smoothstep(0.018, 0.19, luma))
    rgb += arm_lift[..., None] * np.array([0.022, 0.034, 0.054], dtype=np.float32)
    safe_silhouette = suppress_target_overlays(
        1.0 - smoothstep(0.82, 1.04, radius),
        xx,
        yy,
    )
    cohesive_arm_alpha = primary * annulus * safe_silhouette * (
        0.18 + 0.54 * smoothstep(0.012, 0.16, blur(luma, 9.0))
    )
    alpha = np.maximum(alpha, cohesive_arm_alpha * 0.62)

    # Replace crack-like dark detail with two broad soft lanes following the same spiral curvature.
    local_mean = blur(luma, 7.0)
    natural_dust = smoothstep(0.025, 0.17, np.maximum(local_mean - luma, 0.0))
    spiral_lane = np.exp(-0.5 * (np.sin(phase - 0.22) / 0.17) ** 2) * annulus
    dust = blur(natural_dust * 0.32 + spiral_lane * 0.38, 4.5)
    dust = np.clip(dust * (0.48 + 0.52 * primary), 0.0, 0.72)
    local_soft = blur_rgb(rgb, 2.2)
    rgb = rgb * (1.0 - (natural_dust * annulus * 0.20)[..., None]) + local_soft * (natural_dust * annulus * 0.20)[..., None]
    rgb *= 1.0 - dust[..., None] * 0.34

    # Tighten the existing bulge by 22% while preserving a small warm nucleus and dust interruption.
    bulge_outer = np.exp(-(((xx - core[0]) / 103.0) ** 2 + ((yy - core[1]) / 56.0) ** 2))
    legacy_bulge = np.exp(-(((xx - core[0]) / 136.0) ** 2 + ((yy - core[1]) / 76.0) ** 2))
    outer_excess = np.clip(legacy_bulge - bulge_outer, 0.0, 1.0)
    rgb *= 1.0 - outer_excess[..., None] * 0.24
    nucleus = np.exp(-(((xx - core[0]) / 16.0) ** 2 + ((yy - core[1]) / 10.0) ** 2))
    ivory = np.array([1.0, 0.93, 0.78], dtype=np.float32)
    rgb = rgb * (1.0 - (nucleus * 0.94)[..., None]) + ivory * (nucleus * 0.94)[..., None]
    core_dust = blur(spiral_lane * legacy_bulge, 3.0)
    rgb *= 1.0 - core_dust[..., None] * 0.24

    fine = smoothstep(0.014, 0.11, np.maximum(luminance(rgb) - blur(luminance(rgb), 1.8), 0.0))
    probability = primary * annulus * alpha * (0.28 + fine * 0.72)
    rgb, alpha = tangent_stellar_field(rgb, alpha, probability, theta, pitch)

    rgb = np.clip(rgb, 0.0, 1.0)
    # Allow the two primary arms to regain continuous low-frequency material,
    # while keeping all live target-frame overlays outside the corrected plate.
    source_alpha_envelope = np.clip(blur(source_alpha, 1.2) * 1.05, 0.0, 0.995)
    allowed_alpha = np.maximum(source_alpha_envelope, cohesive_arm_alpha * 0.72)
    alpha = np.minimum(np.clip(alpha, 0.0, 0.995), np.clip(allowed_alpha, 0.0, 0.995))
    output = Image.fromarray(np.uint8(np.dstack((rgb, alpha)) * 255), "RGBA")
    diagnostics = {
        "pitch": pitch,
        "phase_offset": offset,
        "off_arm_mean": float(off_arm.mean()),
        "primary_mean": float(primary.mean()),
    }
    return output, core, diagnostics


def build_ldi(plate: Image.Image, core: tuple[float, float], output_directory: Path) -> float:
    rgba = np.asarray(plate, dtype=np.float32) / 255.0
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    luma = luminance(rgb)
    _, _, radius, theta, _, _ = polar_field(luma.shape, core)
    primary, phase, annulus, _, _ = fit_primary_spiral(luma, alpha, radius, theta)
    fine = smoothstep(0.014, 0.11, np.maximum(luma - blur(luma, 1.8), 0.0))
    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    bulge = np.exp(-(((xx - core[0]) / 106.0) ** 2 + ((yy - core[1]) / 59.0) ** 2))
    side = np.sin(phase)
    background = smoothstep(0.48, 0.98, radius) * (0.48 + 0.52 * (1.0 - luma))
    far_arm = primary * annulus * np.clip(0.52 + side * 0.30, 0.12, 1.0)
    core_weight = bulge * (0.68 + luma * 0.38)
    near_arm = primary * annulus * np.clip(0.52 - side * 0.30, 0.12, 1.0)
    foreground = fine * primary * annulus * smoothstep(0.12, 0.56, luma)
    weights = np.stack((background, far_arm, core_weight, near_arm, foreground))
    weights = np.stack([blur(np.clip(weight, 0.0, 1.0), 1.6) for weight in weights])
    # Preserve complete plate coverage even where semantic masks deliberately
    # suppress an off-arm fragment. Without this support, all five weights can
    # reach zero and produce a black LDI crescent at runtime.
    weights += 0.012
    weights *= alpha[None, ...]
    weights /= np.maximum(weights.sum(axis=0, keepdims=True), 1e-6)
    layer_rgb = np.clip(rgb * 1.13, 0.0, 1.0)

    output_directory.mkdir(parents=True, exist_ok=True)
    composite = np.zeros_like(rgb)
    for index, name in enumerate(LAYER_NAMES):
        layer_alpha = 1.0 - np.power(1.0 - alpha, weights[index])
        layer = np.dstack((layer_rgb, layer_alpha))
        Image.fromarray(np.uint8(np.clip(layer, 0.0, 1.0) * 255), "RGBA").save(
            output_directory / name,
            "WEBP",
            lossless=True,
            method=6,
        )
        composite = layer_rgb * layer_alpha[..., None] + composite * (1.0 - layer_alpha[..., None])
    expected = layer_rgb * alpha[..., None]
    return float(np.mean(np.abs(composite - expected)) * 255.0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--v5-plate", type=Path, required=True)
    parser.add_argument("--plate-output", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()
    plate, core, diagnostics = correct_plate(args.v5_plate)
    args.plate_output.parent.mkdir(parents=True, exist_ok=True)
    plate.save(args.plate_output, "PNG", optimize=True)
    mae = build_ldi(plate, core, args.output_directory)
    print(f"generation_seconds={time.perf_counter() - started:.3f}")
    print(f"core={core[0]:.2f},{core[1]:.2f}")
    print(f"spiral_pitch={diagnostics['pitch']:.4f}")
    print(f"spiral_phase_offset={diagnostics['phase_offset']:.4f}")
    print(f"off_arm_mean={diagnostics['off_arm_mean']:.5f}")
    print(f"reconstruction_mae_8bit={mae:.4f}")
    print(f"plate={args.plate_output.resolve()}")
    for name in LAYER_NAMES:
        print((args.output_directory / name).resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
