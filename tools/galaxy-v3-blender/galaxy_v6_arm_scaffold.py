#!/usr/bin/env python3
"""Generate the V6 two-arm low-frequency structural scaffold debug gate."""

from __future__ import annotations

import argparse
import math
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


OUTPUT_SIZE = (1600, 900)


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - low) / max(high - low, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def blur(values: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(values, 0.0, 1.0) * 255), "L")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def cover_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def find_core(target_path: Path) -> tuple[float, float]:
    rgb = np.asarray(cover_crop(Image.open(target_path).convert("RGB"), OUTPUT_SIZE), dtype=np.float32) / 255.0
    luma = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    height, width = luma.shape
    yy, xx = np.indices((height, width), dtype=np.float32)
    search = np.zeros_like(luma)
    search[220:650, 560:1180] = 1.0
    weight = np.power(np.clip(luma * search, 0.0, 1.0), 7.0)
    total = max(float(weight.sum()), 1e-6)
    return float((xx * weight).sum() / total), float((yy * weight).sum() / total)


def wrapped_angle(values: np.ndarray) -> np.ndarray:
    return np.arctan2(np.sin(values), np.cos(values))


def modulation(radius: np.ndarray, gaps: tuple[tuple[float, float, float], ...], peaks: tuple[tuple[float, float, float], ...]) -> np.ndarray:
    result = np.ones_like(radius)
    for center, width, depth in gaps:
        result *= 1.0 - depth * np.exp(-0.5 * ((radius - center) / width) ** 2)
    for center, width, lift in peaks:
        result += lift * np.exp(-0.5 * ((radius - center) / width) ** 2)
    return np.clip(result, 0.08, 1.35)


def arm_field(
    radius: np.ndarray,
    theta: np.ndarray,
    *,
    pitch: float,
    phase: float,
    width: float,
    gaps: tuple[tuple[float, float, float], ...],
    peaks: tuple[tuple[float, float, float], ...],
    branch_offset: float,
    branch_window: tuple[float, float],
) -> np.ndarray:
    center_phase = theta - pitch * np.log(radius + 0.105) - phase
    distance = np.abs(wrapped_angle(center_phase))
    center_path = np.exp(-0.5 * (distance / (width * 0.42)) ** 2)
    main_body = np.exp(-0.5 * (distance / width) ** 2)
    outer_falloff = np.exp(-0.5 * (distance / (width * 1.65)) ** 2)
    ribbon = center_path * 0.24 + main_body * 0.58 + outer_falloff * 0.18
    ribbon *= modulation(radius, gaps, peaks)

    branch_distance = np.abs(wrapped_angle(center_phase - branch_offset))
    branch = np.exp(-0.5 * (branch_distance / (width * 0.72)) ** 2)
    branch *= smoothstep(branch_window[0] - 0.055, branch_window[0], radius)
    branch *= 1.0 - smoothstep(branch_window[1], branch_window[1] + 0.075, radius)
    ribbon += branch * 0.22

    radial_fade = smoothstep(0.105, 0.20, radius) * (1.0 - smoothstep(0.82, 1.03, radius))
    return np.clip(ribbon * radial_fade, 0.0, 1.0)


def build_scaffold(target_path: Path) -> tuple[Image.Image, dict[str, float]]:
    core_x, core_y = find_core(target_path)
    height, width = OUTPUT_SIZE[1], OUTPUT_SIZE[0]
    yy, xx = np.indices((height, width), dtype=np.float32)
    angle = math.radians(-13.0)
    dx = xx - core_x
    dy = yy - core_y
    xr = dx * math.cos(angle) + dy * math.sin(angle)
    yr = -dx * math.sin(angle) + dy * math.cos(angle)
    radius = np.sqrt((xr / 710.0) ** 2 + (yr / 390.0) ** 2)
    theta = np.arctan2(yr / 390.0, xr / 710.0)

    arm_a = arm_field(
        radius,
        theta,
        pitch=1.34,
        phase=2.18,
        width=0.205,
        gaps=((0.34, 0.030, 0.64), (0.58, 0.042, 0.48), (0.79, 0.035, 0.68)),
        peaks=((0.25, 0.060, 0.20), (0.46, 0.070, 0.28), (0.70, 0.065, 0.24), (0.88, 0.050, 0.18)),
        branch_offset=0.24,
        branch_window=(0.50, 0.76),
    )
    arm_b = arm_field(
        radius,
        theta,
        pitch=1.27,
        phase=2.18 + math.radians(174.0),
        width=0.225,
        gaps=((0.29, 0.026, 0.52), (0.51, 0.040, 0.70), (0.73, 0.034, 0.44), (0.90, 0.025, 0.62)),
        peaks=((0.22, 0.055, 0.18), (0.41, 0.060, 0.24), (0.64, 0.075, 0.30), (0.84, 0.055, 0.16)),
        branch_offset=-0.27,
        branch_window=(0.38, 0.61),
    )

    # A very low-amplitude deterministic field breaks uniformity without
    # changing either arm's low-frequency silhouette.
    rng = np.random.default_rng(6001)
    noise = blur(rng.random((height, width), dtype=np.float32), 34.0)
    noise = 0.80 + 0.34 * smoothstep(0.46, 0.54, noise)
    arm_a *= noise
    arm_b *= np.roll(noise, 83, axis=1) * 0.94

    rgb = np.zeros((height, width, 3), dtype=np.float32)
    rgb += arm_a[..., None] * np.array([0.73, 0.83, 0.92], dtype=np.float32) * 0.92
    rgb += arm_b[..., None] * np.array([0.58, 0.72, 0.86], dtype=np.float32) * 0.84
    nucleus = np.exp(-(((xx - core_x) / 12.0) ** 2 + ((yy - core_y) / 8.0) ** 2))
    bulge = np.exp(-(((xx - core_x) / 58.0) ** 2 + ((yy - core_y) / 34.0) ** 2))
    rgb += bulge[..., None] * np.array([0.23, 0.25, 0.26], dtype=np.float32)
    rgb += nucleus[..., None] * np.array([0.95, 0.86, 0.68], dtype=np.float32)
    rgb = np.clip(rgb, 0.0, 1.0)
    image = Image.fromarray(np.uint8(rgb * 255), "RGB")
    return image, {
        "core_x": core_x,
        "core_y": core_y,
        "arm_a_pitch": 1.34,
        "arm_b_pitch": 1.27,
        "phase_separation_degrees": 174.0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()
    image, diagnostics = build_scaffold(args.target)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, "PNG", optimize=True)
    print(f"generation_seconds={time.perf_counter() - started:.3f}")
    for key, value in diagnostics.items():
        print(f"{key}={value:.4f}")
    print(f"output={args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
