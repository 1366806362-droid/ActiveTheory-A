#!/usr/bin/env python3
"""Build five soft, overlapping LDI layers from the approved V4 plate and depth."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


NAMES = (
    "galaxy-v4-bg.webp",
    "galaxy-v4-far-arm.webp",
    "galaxy-v4-core.webp",
    "galaxy-v4-near-arm.webp",
    "galaxy-v4-foreground.webp",
)


def blur(array: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(array, 0.0, 1.0) * 255), "L")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def smoothstep(a: float, b: float, value: np.ndarray) -> np.ndarray:
    t = np.clip((value - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--beauty", type=Path, required=True)
    parser.add_argument("--depth", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    started = time.perf_counter()

    beauty = Image.open(args.beauty).convert("RGB")
    rgb = np.asarray(beauty, dtype=np.float32) / 255.0
    depth_image = Image.open(args.depth).convert("L")
    if depth_image.size != beauty.size:
        depth_image = depth_image.resize(beauty.size, Image.Resampling.BICUBIC)
    depth = blur(np.asarray(depth_image, dtype=np.float32) / 255.0, 1.4)
    luminance = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

    centers = np.array([0.08, 0.27, 0.50, 0.71, 0.89], dtype=np.float32)
    widths = np.array([0.24, 0.22, 0.24, 0.23, 0.16], dtype=np.float32)
    weights = np.stack([
        np.exp(-0.5 * ((depth - center) / width) ** 2)
        for center, width in zip(centers, widths)
    ])

    local = blur(luminance, 7.0)
    texture = smoothstep(0.018, 0.11, np.abs(luminance - local))
    selected_near_detail = smoothstep(0.70, 0.91, depth) * texture
    weights[4] *= selected_near_detail
    weights[3] *= 1.0 - selected_near_detail * 0.30
    weights[0] *= 0.82 + 0.18 * (1.0 - depth)
    weights = np.stack([blur(weight, 2.6) for weight in weights])
    weights /= np.maximum(weights.sum(axis=0, keepdims=True), 1e-6)

    # Recover an alpha/color pair whose full five-layer composite matches the plate.
    base_alpha = np.clip(np.max(rgb, axis=2) ** 0.62, 0.0, 0.985)
    unpremultiplied = np.divide(
        rgb,
        np.maximum(base_alpha[..., None], 1e-4),
        out=np.zeros_like(rgb),
        where=base_alpha[..., None] > 1e-4,
    )
    unpremultiplied = np.clip(unpremultiplied, 0.0, 1.0)

    args.output_directory.mkdir(parents=True, exist_ok=True)
    composite = np.zeros_like(rgb)
    composite_alpha = np.zeros_like(base_alpha)
    for index, name in enumerate(NAMES):
        layer_alpha = 1.0 - np.power(1.0 - base_alpha, weights[index])
        rgba = np.dstack((unpremultiplied, layer_alpha))
        Image.fromarray(np.uint8(np.clip(rgba, 0.0, 1.0) * 255), "RGBA").save(
            args.output_directory / name,
            "WEBP",
            lossless=True,
            method=6,
        )
        composite = unpremultiplied * layer_alpha[..., None] + composite * (1.0 - layer_alpha[..., None])
        composite_alpha = layer_alpha + composite_alpha * (1.0 - layer_alpha)

    mae = float(np.mean(np.abs(composite - rgb)) * 255.0)
    print(f"generation_seconds={time.perf_counter() - started:.4f}")
    print(f"reconstruction_mae_8bit={mae:.4f}")
    for name in NAMES:
        print(args.output_directory / name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
