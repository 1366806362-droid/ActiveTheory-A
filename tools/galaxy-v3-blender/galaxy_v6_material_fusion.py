#!/usr/bin/env python3
"""Fuse V5.1 cinematic material into the approved V6 two-arm scaffold."""

from __future__ import annotations

import argparse
import math
import time
from pathlib import Path

import numpy as np
from PIL import Image

from galaxy_v51_spiral_correction import blur, blur_rgb, luminance
from galaxy_v6_arm_scaffold import OUTPUT_SIZE, arm_field, find_core, smoothstep


LAYER_NAMES = (
    "galaxy-v6-bg.webp",
    "galaxy-v6-far-arm.webp",
    "galaxy-v6-core.webp",
    "galaxy-v6-near-arm.webp",
    "galaxy-v6-foreground.webp",
)


def structural_fields(target_path: Path):
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
    return core_x, core_y, xx, yy, radius, theta, np.clip(arm_a, 0.0, 1.0), np.clip(arm_b, 0.0, 1.0)


def business_overlay_mask(xx: np.ndarray, yy: np.ndarray) -> np.ndarray:
    mask = np.zeros_like(xx)
    for left, top, right, bottom, feather in (
        (430.0, 150.0, 735.0, 380.0, 34.0),
        (1110.0, 0.0, 1530.0, 235.0, 42.0),
        (990.0, 560.0, 1390.0, 820.0, 42.0),
    ):
        inside_x = np.minimum(xx - left, right - xx)
        inside_y = np.minimum(yy - top, bottom - yy)
        mask = np.maximum(mask, smoothstep(-feather, feather, np.minimum(inside_x, inside_y)))
    return mask


def build_plate(v51_path: Path, target_path: Path):
    rgba = np.asarray(Image.open(v51_path).convert("RGBA"), dtype=np.float32) / 255.0
    if (rgba.shape[1], rgba.shape[0]) != OUTPUT_SIZE:
        raise ValueError(f"V5.1 plate must be {OUTPUT_SIZE[0]}x{OUTPUT_SIZE[1]}")
    rgb = rgba[..., :3]
    source_alpha = rgba[..., 3]
    luma = luminance(rgb)
    core_x, core_y, xx, yy, radius, theta, arm_a, arm_b = structural_fields(target_path)
    primary = np.maximum(arm_a, arm_b)
    arm_body = smoothstep(0.055, 0.62, primary)
    arm_center = smoothstep(0.34, 0.88, primary)
    inter_arm = (1.0 - arm_body) * smoothstep(0.18, 0.34, radius) * (1.0 - smoothstep(0.86, 1.02, radius))

    # Remove baked reference labels/nodes from the material itself. A broad
    # local blur retains cinematic color behind the live business nebulae.
    overlay_mask = business_overlay_mask(xx, yy)
    sanitized_rgb = rgb * (1.0 - overlay_mask[..., None]) + blur_rgb(rgb, 28.0) * overlay_mask[..., None]

    # Keep existing texture quantity, but allow its high-frequency energy only
    # where the structural field says a primary arm exists.
    softened = blur_rgb(sanitized_rgb, 2.0)
    high_frequency = sanitized_rgb - softened
    detail_keep = 0.16 + arm_body * 0.84
    rgb = softened + high_frequency * detail_keep[..., None]
    rgb *= 1.0 - (inter_arm * 0.46)[..., None]

    # Restore broad arm material so the silhouette is carried by ribbons, not
    # isolated highlights. Target exclusions keep live UI and entry nodes clean.
    safe_silhouette = 1.0 - smoothstep(0.84, 1.04, radius)
    safe_silhouette *= smoothstep(360.0, 455.0, xx)
    earth = ((xx - 150.0) / 390.0) ** 2 + ((yy - 790.0) / 330.0) ** 2
    safe_silhouette *= smoothstep(0.80, 1.14, earth)
    broad_material = blur(luma, 10.0)
    structural_alpha = primary * safe_silhouette * (
        0.18 + 0.62 * smoothstep(0.010, 0.14, broad_material)
    )
    alpha = source_alpha * (0.24 + arm_body * 0.76)
    alpha = np.maximum(alpha, structural_alpha * 0.92)
    rgb += arm_center[..., None] * np.array([0.022, 0.030, 0.044], dtype=np.float32)

    # Place broad, soft dust on the inner edge of each arm. The offset follows
    # local spiral phase and never becomes a radial or crack-like line.
    phase_a = theta - 1.34 * np.log(radius + 0.105) - (2.18 + 0.115)
    phase_b = theta - 1.27 * np.log(radius + 0.105) - (2.18 + math.radians(174.0) - 0.12)
    lane_a = np.exp(-0.5 * (np.arctan2(np.sin(phase_a), np.cos(phase_a)) / 0.16) ** 2)
    lane_b = np.exp(-0.5 * (np.arctan2(np.sin(phase_b), np.cos(phase_b)) / 0.17) ** 2)
    lane = blur((lane_a * arm_a + lane_b * arm_b) * smoothstep(0.16, 0.27, radius), 4.0)
    lane *= 1.0 - smoothstep(0.82, 1.0, radius)
    rgb *= 1.0 - (lane * 0.24)[..., None]

    # V5.1 core remains authoritative; only protect it from inter-arm
    # suppression and apply a sub-10% neutral lift.
    core_protect = np.exp(-(((xx - core_x) / 108.0) ** 2 + ((yy - core_y) / 61.0) ** 2))
    rgb = rgb * (1.0 - core_protect[..., None]) + rgba[..., :3] * core_protect[..., None]
    rgb += core_protect[..., None] * np.array([0.012, 0.010, 0.006], dtype=np.float32)
    alpha = np.maximum(alpha, source_alpha * core_protect)

    # Preserve a restrained fading halo without reintroducing inter-arm noise.
    halo = blur(source_alpha, 12.0) * smoothstep(0.65, 0.88, radius) * (1.0 - smoothstep(0.88, 1.06, radius))
    alpha = np.maximum(alpha, halo * 0.22)
    alpha *= safe_silhouette
    rgb = np.clip(rgb, 0.0, 1.0)
    alpha = np.clip(alpha, 0.0, 0.995)
    plate = Image.fromarray(np.uint8(np.dstack((rgb, alpha)) * 255), "RGBA")
    diagnostics = {
        "core_x": core_x,
        "core_y": core_y,
        "inter_arm_suppression": 0.46,
        "core_adjustment": 0.012,
        "arm_a_mean": float(arm_a.mean()),
        "arm_b_mean": float(arm_b.mean()),
    }
    return plate, diagnostics, (arm_a, arm_b, core_protect, radius)


def build_ldi(plate: Image.Image, fields, output_directory: Path) -> float:
    rgba = np.asarray(plate, dtype=np.float32) / 255.0
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    arm_a, arm_b, core_protect, radius = fields
    luma = luminance(rgb)
    fine = smoothstep(0.015, 0.11, np.maximum(luma - blur(luma, 1.8), 0.0))

    background = smoothstep(0.52, 0.98, radius) * (0.34 + 0.44 * (1.0 - luma))
    far_arm = arm_a * (0.58 + 0.30 * (1.0 - luma))
    core_weight = core_protect * (0.72 + luma * 0.30)
    near_arm = arm_b * (0.62 + luma * 0.26)
    foreground = fine * np.maximum(arm_a, arm_b) * smoothstep(0.12, 0.56, luma)
    weights = np.stack((background, far_arm, core_weight, near_arm, foreground))
    weights = np.stack([blur(np.clip(weight, 0.0, 1.0), 1.5) for weight in weights])
    weights += 0.010
    weights *= alpha[None, ...]
    weights /= np.maximum(weights.sum(axis=0, keepdims=True), 1e-6)

    output_directory.mkdir(parents=True, exist_ok=True)
    composite = np.zeros_like(rgb)
    for index, name in enumerate(LAYER_NAMES):
        layer_alpha = 1.0 - np.power(1.0 - alpha, weights[index])
        layer = np.dstack((rgb, layer_alpha))
        Image.fromarray(np.uint8(np.clip(layer, 0.0, 1.0) * 255), "RGBA").save(
            output_directory / name,
            "WEBP",
            lossless=True,
            method=6,
        )
        composite = rgb * layer_alpha[..., None] + composite * (1.0 - layer_alpha[..., None])
    expected = rgb * alpha[..., None]
    return float(np.mean(np.abs(composite - expected)) * 255.0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--v51-plate", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--plate-output", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()
    plate, diagnostics, fields = build_plate(args.v51_plate, args.target)
    args.plate_output.parent.mkdir(parents=True, exist_ok=True)
    plate.save(args.plate_output, "PNG", optimize=True)
    mae = build_ldi(plate, fields, args.output_directory)
    print(f"generation_seconds={time.perf_counter() - started:.3f}")
    for key, value in diagnostics.items():
        print(f"{key}={value:.5f}")
    print(f"reconstruction_mae_8bit={mae:.5f}")
    print(f"plate={args.plate_output.resolve()}")
    for name in LAYER_NAMES:
        print((args.output_directory / name).resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
