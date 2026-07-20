#!/usr/bin/env python3
"""Validate an 8K RGBA galaxy master without modifying the input image."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps, ImageStat
except ImportError as exc:  # pragma: no cover - environment-specific failure
    raise SystemExit("Pillow is required: python -m pip install Pillow") from exc


EXPECTED_SIZE = (8192, 8192)
WIDTH_RANGE = (0.84, 0.90)
HEIGHT_RANGE = (0.72, 0.84)
OUTER_SAFE_RATIO = 0.01


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def nonzero_count(channel: Image.Image) -> int:
    histogram = channel.histogram()
    return int(sum(histogram[1:]))


def line_coverage(alpha: Image.Image, box: tuple[int, int, int, int]) -> float:
    line = alpha.crop(box)
    return nonzero_count(line) / max(1, line.width * line.height)


def analyze(path: Path) -> dict:
    with Image.open(path) as source:
        source.load()
        source_mode = source.mode
        width, height = source.size
        rgba = source.convert("RGBA")

    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    corners = {
        "top_left": alpha.getpixel((0, 0)),
        "top_right": alpha.getpixel((width - 1, 0)),
        "bottom_left": alpha.getpixel((0, height - 1)),
        "bottom_right": alpha.getpixel((width - 1, height - 1)),
    }
    corners_are_zero = all(value == 0 for value in corners.values())

    safe_x = max(1, round(width * OUTER_SAFE_RATIO))
    safe_y = max(1, round(height * OUTER_SAFE_RATIO))
    outer_bands = {
        "top": alpha.crop((0, 0, width, safe_y)),
        "bottom": alpha.crop((0, height - safe_y, width, height)),
        "left": alpha.crop((0, safe_y, safe_x, height - safe_y)),
        "right": alpha.crop((width - safe_x, safe_y, width, height - safe_y)),
    }
    outer_nonzero = sum(nonzero_count(band) for band in outer_bands.values())
    outer_is_transparent = outer_nonzero == 0

    effective_pixels = nonzero_count(alpha)
    effective_area_ratio = effective_pixels / max(1, width * height)
    if bbox:
        left, top, right, bottom = bbox
        bbox_width = right - left
        bbox_height = bottom - top
        width_ratio = bbox_width / width
        height_ratio = bbox_height / height
        border_coverage = {
            "top": line_coverage(alpha, (left, top, right, min(bottom, top + 1))),
            "bottom": line_coverage(alpha, (left, max(top, bottom - 1), right, bottom)),
            "left": line_coverage(alpha, (left, top, min(right, left + 1), bottom)),
            "right": line_coverage(alpha, (max(left, right - 1), top, right, bottom)),
        }
    else:
        bbox_width = bbox_height = 0
        width_ratio = height_ratio = 0.0
        border_coverage = {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0}

    opposing_horizontal = min(border_coverage["top"], border_coverage["bottom"])
    opposing_vertical = min(border_coverage["left"], border_coverage["right"])
    rectangular_alpha_edge = (
        opposing_horizontal >= 0.65 and opposing_vertical >= 0.65
    ) or (
        sum(border_coverage.values()) / 4 >= 0.82
    )

    active_mask = alpha.point(lambda value: 255 if value > 0 else 0)
    luminance = ImageOps.grayscale(rgba.convert("RGB"))
    if effective_pixels:
        brightness_stat = ImageStat.Stat(luminance, mask=active_mask)
        brightness_mean = float(brightness_stat.mean[0])
        brightness_max = int(brightness_stat.extrema[0][1])
    else:
        brightness_mean = 0.0
        brightness_max = 0

    checks = {
        "dimensions_8192x8192": (width, height) == EXPECTED_SIZE,
        "mode_rgba": source_mode == "RGBA",
        "corner_alpha_zero": corners_are_zero,
        "outer_one_percent_transparent": outer_is_transparent,
        "subject_width_ratio_recommended": WIDTH_RANGE[0] <= width_ratio <= WIDTH_RANGE[1],
        "subject_height_ratio_recommended": HEIGHT_RANGE[0] <= height_ratio <= HEIGHT_RANGE[1],
        "no_rectangular_alpha_edge": not rectangular_alpha_edge,
        "has_visible_alpha": effective_pixels > 0,
    }
    hard_checks = (
        "dimensions_8192x8192",
        "mode_rgba",
        "corner_alpha_zero",
        "outer_one_percent_transparent",
        "no_rectangular_alpha_edge",
        "has_visible_alpha",
    )
    hard_pass = all(checks[name] for name in hard_checks)
    recommended_pass = (
        checks["subject_width_ratio_recommended"]
        and checks["subject_height_ratio_recommended"]
    )
    status = "PASS" if hard_pass and recommended_pass else "WARNING" if hard_pass else "FAIL"

    return {
        "status": status,
        "input": str(path.resolve()),
        "sha256": sha256_file(path),
        "format": "PNG",
        "mode": source_mode,
        "dimensions": [width, height],
        "alpha": {
            "corners": corners,
            "effective_pixels": effective_pixels,
            "effective_area_ratio": round(effective_area_ratio, 8),
            "bounding_box": list(bbox) if bbox else None,
            "bounding_box_size": [bbox_width, bbox_height],
            "subject_width_ratio": round(width_ratio, 8),
            "subject_height_ratio": round(height_ratio, 8),
            "outer_one_percent_pixels": [safe_x, safe_y],
            "outer_one_percent_nonzero_alpha_pixels": outer_nonzero,
            "bbox_border_alpha_coverage": {
                key: round(value, 8) for key, value in border_coverage.items()
            },
            "rectangular_alpha_edge_detected": rectangular_alpha_edge,
        },
        "brightness_0_255": {
            "maximum": brightness_max,
            "mean_over_visible_pixels": round(brightness_mean, 6),
        },
        "recommended_subject_ratios": {
            "width": list(WIDTH_RANGE),
            "height": list(HEIGHT_RANGE),
        },
        "checks": checks,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate an 8192x8192 RGBA galaxy master and write a JSON report."
    )
    parser.add_argument("input_png", type=Path, help="Path to the 8K RGBA PNG master")
    parser.add_argument(
        "--output",
        type=Path,
        help="JSON report path (default: <input-stem>-validation.json beside the input)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = args.input_png.resolve()
    if not input_path.is_file():
        print(f"Input does not exist: {input_path}", file=sys.stderr)
        return 2
    if input_path.suffix.lower() != ".png":
        print("Input must be a PNG file.", file=sys.stderr)
        return 2

    try:
        report = analyze(input_path)
    except Exception as exc:  # pragma: no cover - defensive CLI boundary
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 2

    output_path = (
        args.output.resolve()
        if args.output
        else input_path.with_name(f"{input_path.stem}-validation.json")
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Report: {output_path}", file=sys.stderr)
    return 0 if report["status"] != "FAIL" else 1


if __name__ == "__main__":
    raise SystemExit(main())
