#!/usr/bin/env python3
"""Reproduce the approved M3 preview and transfer it to five Hero layers.

Source: ActiveTheory-Home-Target-V1/art/visual-gate/home-target-v1/
m3_reference_guided_fusion.py (local HOME experiment, copied 2026-09-07).
Master and preview inputs remain local-only; V5.1 assets remain unchanged.
"""

from __future__ import annotations

import math
import sys
import time
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools" / "galaxy-v3-blender"
sys.path.insert(0, str(TOOLS))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from galaxy_v6_arm_scaffold import arm_field, smoothstep  # noqa: E402
from galaxy_v51_spiral_correction import blur, blur_rgb, luminance  # noqa: E402


WORK_SIZE = (1600, 900)
OUTPUT_SIZE = (1280, 720)
MASTER_SIZE = (1672, 941)
MASTER_CORE = (881.0, 438.0)
BASE_RETENTION = 0.67
ARM_BOOST = 0.37
INTER_ARM_SUPPRESSION = 0.19
M3 = {
    "pitch_a": 1.45, "pitch_b": 1.16,
    "phase_a": 2.54, "phase_b": 5.4869,
    "scale_x": 790.0, "scale_y": 445.0,
    "tilt": -8.5, "width_a": 0.232, "width_b": 0.252,
}
LAYER_NAMES = (
    ("background", "galaxy-final-m3-bg.webp"),
    ("farArm", "galaxy-final-m3-far-arm.webp"),
    ("core", "galaxy-final-m3-core.webp"),
    ("nearArm", "galaxy-final-m3-near-arm.webp"),
    ("foreground", "galaxy-final-m3-foreground.webp"),
)


def composite_v51(layer_directory: Path):
    rgb = np.zeros((WORK_SIZE[1], WORK_SIZE[0], 3), dtype=np.float32)
    alpha = np.zeros((WORK_SIZE[1], WORK_SIZE[0]), dtype=np.float32)
    for suffix in ('bg', 'far-arm', 'core', 'near-arm', 'foreground'):
        layer = np.asarray(Image.open(layer_directory / f'galaxy-v5_1-{suffix}.webp').convert('RGBA'), dtype=np.float32) / 255.0
        rgb = layer[..., :3] * layer[..., 3, None] + rgb * (1.0 - layer[..., 3, None])
        alpha = layer[..., 3] + alpha * (1.0 - layer[..., 3])
    return rgb, alpha


def find_v51_core(rgb: np.ndarray, alpha: np.ndarray) -> tuple[float, float]:
    luma = luminance(rgb) * alpha
    yy, xx = np.indices(luma.shape, dtype=np.float32)
    search = np.zeros_like(luma)
    search[180:690, 420:1250] = 1.0
    weights = np.power(np.clip(luma * search, 0.0, 1.0), 7.0)
    total = max(float(weights.sum()), 1e-6)
    return float((xx * weights).sum() / total), float((yy * weights).sum() / total)


def aligned_master_mass(path: Path, core: tuple[float, float]) -> np.ndarray:
    """Map the clean Master's continuous mass field into V5.1 core space."""
    source = Image.open(path).convert("L")
    scale_x = WORK_SIZE[0] / MASTER_SIZE[0]
    scale_y = WORK_SIZE[1] / MASTER_SIZE[1]
    affine = (
        1.0 / scale_x, 0.0, MASTER_CORE[0] - core[0] / scale_x,
        0.0, 1.0 / scale_y, MASTER_CORE[1] - core[1] / scale_y,
    )
    image = source.transform(WORK_SIZE, Image.Transform.AFFINE, affine, resample=Image.Resampling.BICUBIC)
    return np.asarray(image, dtype=np.float32) / 255.0


def m3_fields(core: tuple[float, float]):
    yy, xx = np.indices((WORK_SIZE[1], WORK_SIZE[0]), dtype=np.float32)
    scale_x = WORK_SIZE[0] / MASTER_SIZE[0]
    scale_y = WORK_SIZE[1] / MASTER_SIZE[1]
    angle = math.radians(M3["tilt"])
    dx, dy = xx - core[0], yy - core[1]
    xr = dx * math.cos(angle) + dy * math.sin(angle)
    yr = -dx * math.sin(angle) + dy * math.cos(angle)
    radius = np.sqrt((xr / (M3["scale_x"] * scale_x)) ** 2 + (yr / (M3["scale_y"] * scale_y)) ** 2)
    theta = np.arctan2(yr / (M3["scale_y"] * scale_y), xr / (M3["scale_x"] * scale_x))
    arm_a = arm_field(radius, theta, pitch=M3["pitch_a"], phase=M3["phase_a"], width=M3["width_a"],
                      gaps=((0.34, 0.030, 0.64), (0.58, 0.042, 0.48), (0.79, 0.035, 0.68)),
                      peaks=((0.25, 0.060, 0.20), (0.46, 0.070, 0.28), (0.70, 0.065, 0.24), (0.88, 0.050, 0.18)),
                      branch_offset=0.24, branch_window=(0.50, 0.76))
    arm_b = arm_field(radius, theta, pitch=M3["pitch_b"], phase=M3["phase_b"], width=M3["width_b"],
                      gaps=((0.29, 0.026, 0.52), (0.51, 0.040, 0.70), (0.73, 0.034, 0.44), (0.90, 0.025, 0.62)),
                      peaks=((0.22, 0.055, 0.18), (0.41, 0.060, 0.24), (0.64, 0.075, 0.30), (0.84, 0.055, 0.16)),
                      branch_offset=-0.27, branch_window=(0.38, 0.61))
    return xx, yy, radius, theta, arm_a, arm_b


def radial_artifact_attenuation(rgb: np.ndarray, radius: np.ndarray, theta: np.ndarray, arm: np.ndarray) -> np.ndarray:
    luma = luminance(rgb)
    gy, gx = np.gradient(blur(luma, 0.8))
    radial = np.abs(gx * np.cos(theta) + gy * np.sin(theta))
    tangent = np.abs(-gx * np.sin(theta) + gy * np.cos(theta))
    radial_detail = smoothstep(1.25, 2.70, tangent / (radial + 1e-4))
    high = smoothstep(0.006, 0.060, np.maximum(luma - blur(luma, 3.2), 0.0))
    annulus = smoothstep(0.16, 0.28, radius) * (1.0 - smoothstep(0.92, 1.03, radius))
    artifact = radial_detail * high * annulus * (1.0 - smoothstep(0.18, 0.62, arm))
    soft = blur_rgb(rgb, 1.8)
    return rgb * (1.0 - artifact[..., None] * 0.48) + soft * artifact[..., None] * 0.48


def render() -> tuple[tuple[np.ndarray, np.ndarray], tuple[np.ndarray, np.ndarray], tuple[np.ndarray, ...], dict[str, float]]:
    output = ROOT / "art" / "visual-gate" / "home-target-v1"
    base_rgb, base_alpha = composite_v51(ROOT / "public" / "assets" / "galaxy-v3" / "hero" / "v5_1")
    core = find_v51_core(base_rgb, base_alpha)
    master = aligned_master_mass(output / "GALAXY_MASTER_MASS_FIELD.png", core)
    xx, yy, radius, theta, arm_a, arm_b = m3_fields(core)
    arm = blur(np.maximum(arm_a, arm_b), 5.0)
    arm_body = smoothstep(0.06, 0.68, arm)
    annulus = smoothstep(0.14, 0.24, radius) * (1.0 - smoothstep(0.90, 1.04, radius))
    valley = (1.0 - arm_body) * annulus * (0.55 + 0.45 * master)

    corrected = radial_artifact_attenuation(base_rgb, radius, theta, arm)
    high_frequency = corrected - blur_rgb(corrected, 2.0)
    corrected += high_frequency * (0.10 * arm_body[..., None])
    adaptive = 1.0 - (1.0 - BASE_RETENTION) * INTER_ARM_SUPPRESSION * valley
    broad = blur_rgb(corrected, 8.0)
    arm_energy = broad * (ARM_BOOST * arm_body * (0.72 + 0.28 * master))[..., None]
    final_rgb = corrected * adaptive[..., None] + arm_energy

    # Soft inner-edge dust follows the local M3 tangent field; it never forms a visible spiral line.
    phase_a = theta - M3["pitch_a"] * np.log(radius + 0.105) - (M3["phase_a"] + 0.115)
    phase_b = theta - M3["pitch_b"] * np.log(radius + 0.105) - (M3["phase_b"] - 0.12)
    lane_a = np.exp(-0.5 * (np.arctan2(np.sin(phase_a), np.cos(phase_a)) / 0.17) ** 2) * arm_a
    lane_b = np.exp(-0.5 * (np.arctan2(np.sin(phase_b), np.cos(phase_b)) / 0.18) ** 2) * arm_b
    dust = blur((lane_a + lane_b) * smoothstep(0.18, 0.28, radius), 3.5)
    final_rgb *= 1.0 - (dust * 0.14)[..., None]

    # V5.1 remains authoritative in the compact warm nucleus.
    core_protect = np.exp(-(((xx - core[0]) / 112.0) ** 2 + ((yy - core[1]) / 64.0) ** 2))
    final_rgb = final_rgb * (1.0 - core_protect[..., None]) + base_rgb * core_protect[..., None]
    final_alpha = np.clip(base_alpha * adaptive, 0.0, 0.995)
    final_rgb = np.clip(final_rgb, 0.0, 1.0)

    base_lf = blur(luminance(base_rgb) * base_alpha, 14.0)
    final_lf = blur(luminance(final_rgb) * final_alpha, 14.0)
    region = smoothstep(0.10, 0.22, radius) * (1.0 - smoothstep(0.95, 1.08, radius))
    threshold = max(float(np.quantile(base_lf[region > 0.5], 0.56)), 0.010)
    occupied = float(((final_lf > threshold) * (region > 0.5)).sum() / max(float(((base_lf > threshold) * (region > 0.5)).sum()), 1.0))
    luma = luminance(final_rgb) * final_alpha
    arm_luma = float(luma[(arm_body > 0.48) & (region > 0.35)].mean())
    inter_luma = float(luma[(arm_body < 0.16) & (region > 0.35) & (final_alpha > 0.035)].mean())
    core_luma = float(luma[core_protect > 0.56].mean())
    master_mask = master > 0.18
    final_mask = final_lf > threshold
    coverage = float((master_mask & final_mask).sum() / max(int(master_mask.sum()), 1))
    diagnostics = {
        "base_retention": BASE_RETENTION,
        "arm_structural_boost": ARM_BOOST,
        "inter_arm_suppression": INTER_ARM_SUPPRESSION,
        "occupied_area_ratio": occupied,
        "arm_interarm_luminance_ratio": arm_luma / max(inter_luma, 1e-6),
        "core_arm_luminance_ratio": core_luma / max(arm_luma, 1e-6),
        "master_silhouette_coverage": coverage,
        "v51_core_x": core[0], "v51_core_y": core[1],
    }
    return (base_rgb, base_alpha), (final_rgb, final_alpha), (
        master, arm_a, arm_b, final_lf, radius, core_protect, arm_body
    ), diagnostics


def over_black(rgb: np.ndarray, alpha: np.ndarray, size: tuple[int, int]) -> Image.Image:
    image = Image.fromarray(np.uint8(np.clip(rgb * alpha[..., None], 0.0, 1.0) * 255), "RGB")
    return image.resize(size, Image.Resampling.LANCZOS)


def debug_image(fields: tuple[np.ndarray, ...]) -> Image.Image:
    master, arm_a, arm_b, final_lf, *_ = fields
    arm = np.maximum(arm_a, arm_b)
    values = (master, arm, final_lf / max(float(final_lf.max()), 1e-6))
    labels = ("MASTER MASS SUPPORT", "M3 TWO-ARM FIELD", "FINAL LOW-FREQUENCY MASS")
    canvas = Image.new("RGB", OUTPUT_SIZE, "black")
    font = ImageFont.load_default()
    for index, (value, label) in enumerate(zip(values, labels)):
        panel = Image.fromarray(np.uint8(np.clip(value, 0.0, 1.0) * 255), "L").convert("RGB")
        x = index * 427
        canvas.paste(panel.resize((426, 720), Image.Resampling.LANCZOS), (x, 0))
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((x + 12, 12, x + 262, 39), fill=(0, 0, 0))
        draw.text((x + 20, 20), label, fill=(235, 240, 247), font=font)
    return canvas


def build_ldi(final: tuple[np.ndarray, np.ndarray], fields: tuple[np.ndarray, ...], output: Path, layer_names=LAYER_NAMES, source_display=None) -> float:
    """Reuse the existing five semantic depth roles without rerunning depth inference."""
    from m3_display_transfer import encode_split, decode, encode, aces, LINEAR_TEXTURE_GAIN
    rgb, alpha = final
    _, arm_a, arm_b, _, radius, core, arm_body = fields
    layer_dir = ROOT / "public" / "assets" / "galaxy-v3" / "hero" / "v5_1"
    original_alpha = [
        np.asarray(Image.open(layer_dir / name).convert("RGBA"), dtype=np.float32)[..., 3] / 255.0
        for name in (
            "galaxy-v5_1-bg.webp", "galaxy-v5_1-far-arm.webp", "galaxy-v5_1-core.webp",
            "galaxy-v5_1-near-arm.webp", "galaxy-v5_1-foreground.webp"
        )
    ]
    fine = smoothstep(0.014, 0.11, np.maximum(luminance(rgb) - blur(luminance(rgb), 1.8), 0.0))
    weights = np.stack((
        original_alpha[0] + (1.0 - arm_body) * smoothstep(0.48, 0.98, radius) * 0.42,
        original_alpha[1] * 0.34 + arm_a * 0.82,
        original_alpha[2] + core * 1.45,
        original_alpha[3] * 0.34 + arm_b * 0.82,
        original_alpha[4] * 0.54 + fine * arm_body * 0.34,
    ))
    weights = np.stack([blur(np.clip(weight, 0.0, 1.0), 1.5) for weight in weights])
    weights += 0.010
    weights *= alpha[None, ...]
    weights /= np.maximum(weights.sum(axis=0, keepdims=True), 1e-6)
    output.mkdir(parents=True, exist_ok=True)
    # Soft depth overlap stays intact. No hard bins, erosion or content inpainting.
    # Arm weights distribute depth only; coverage is conserved at every pixel.
    layer_alphas = 1.0 - np.power(1.0 - alpha[None, ...], weights)
    source = (np.floor(np.clip(rgb * alpha[..., None], 0, 1) * 255) / 255
              if source_display is None else source_display)
    stored_rgb, stored_alphas = encode_split(source, layer_alphas)
    composite = np.zeros_like(rgb)
    for index, (_, name) in enumerate(layer_names):
        Image.fromarray(np.dstack((stored_rgb, stored_alphas[index])), "RGBA").save(
            output / name, "WEBP", lossless=True, method=6
        )
        # Validate the files actually written, after RGBA8/WebP encoding.
        decoded = np.asarray(Image.open(output / name).convert('RGBA'), np.float32) / 255
        a = decoded[..., 3, None]
        composite = decode(decoded[..., :3]) * LINEAR_TEXTURE_GAIN * a + composite * (1-a)
    return float(np.mean(np.abs(encode(aces(composite)) - source)) * 255.0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generate-ldi", action="store_true")
    parser.add_argument("--transfer-only", action="store_true", help="Preserve all approved reference exports")
    args = parser.parse_args()
    started = time.perf_counter()
    output = ROOT / "art" / "visual-gate" / "home-target-v1"
    _, final, fields, diagnostics = render()
    if not args.transfer_only:
        over_black(*final, OUTPUT_SIZE).save(output / "M3_FUSION_PREVIEW.png", "PNG", optimize=True)
        debug_image(fields).save(output / "M3_FUSION_STRUCTURE_DEBUG.png", "PNG", optimize=True)
        over_black(*final, (640, 360)).save(output / "M3_FUSION_SMALL_READ.png", "PNG", optimize=True)
    if args.generate_ldi or args.transfer_only:
        mae = build_ldi(final, fields, ROOT / "public" / "assets" / "galaxy-v3" / "hero" / "final-m3")
        print(f"ldi_reconstruction_mae_8bit={mae:.5f}")
    print(f"generation_seconds={time.perf_counter() - started:.3f}")
    for key, value in diagnostics.items():
        print(f"{key}={value:.5f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
