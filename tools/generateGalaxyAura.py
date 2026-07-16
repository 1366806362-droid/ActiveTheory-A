#!/usr/bin/env python3
"""Generate the deterministic low-frequency aura used by Hero galaxy V2.3.

The source galaxy is never edited.  Its alpha is expanded at three scales, then
shaped with deterministic low-frequency noise and directional masks so the
result follows arm structure without becoming a complete elliptical halo.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


RADII = (24, 56, 112)
WEIGHTS = (0.48, 0.34, 0.18)
SEED = 2301
WORK_SIZE = 512


def scaled(image: Image.Image, factor: float) -> Image.Image:
    return image.point(lambda value: max(0, min(255, round(value * factor))))


def weighted_sum(images: list[Image.Image], weights: tuple[float, ...]) -> Image.Image:
    result = Image.new("L", images[0].size, 0)
    for image, weight in zip(images, weights, strict=True):
        result = ImageChops.add(result, scaled(image, weight), scale=1.0, offset=0)
    return result


def make_noise(size: tuple[int, int]) -> Image.Image:
    rng = random.Random(SEED)
    coarse_size = (96, 96)
    values = bytes(rng.randrange(0, 256) for _ in range(coarse_size[0] * coarse_size[1]))
    coarse = Image.frombytes("L", coarse_size, values)
    low = coarse.resize(size, Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(13))
    detail = coarse.resize(size, Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(4))
    mixed = Image.blend(low, detail, 0.24)
    return mixed.point(lambda value: 86 + round(value * 0.64))


def make_direction_mask(size: tuple[int, int]) -> Image.Image:
    width, height = size
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)

    # Three irregular influence regions: upper-right main arm, a short left arm,
    # and a subdued upper-middle bridge.  The lower/right-lower quadrant is
    # intentionally mostly absent.
    draw.ellipse((0.40 * width, 0.05 * height, 1.02 * width, 0.58 * height), fill=238)
    draw.ellipse((-0.06 * width, 0.27 * height, 0.49 * width, 0.69 * height), fill=178)
    draw.ellipse((0.28 * width, 0.12 * height, 0.70 * width, 0.48 * height), fill=142)
    draw.ellipse((0.15 * width, 0.55 * height, 0.48 * width, 0.83 * height), fill=54)
    mask = mask.filter(ImageFilter.GaussianBlur(0.075 * width))

    omission = Image.new("L", size, 255)
    omission_draw = ImageDraw.Draw(omission)
    omission_draw.ellipse(
        (0.55 * width, 0.49 * height, 1.10 * width, 1.10 * height),
        fill=20,
    )
    omission = omission.filter(ImageFilter.GaussianBlur(0.065 * width))
    return ImageChops.multiply(mask, omission)


def make_core_suppression(size: tuple[int, int]) -> Image.Image:
    width, height = size
    mask = Image.new("L", size, 255)
    draw = ImageDraw.Draw(mask)
    draw.ellipse(
        (0.405 * width, 0.405 * height, 0.595 * width, 0.595 * height),
        fill=8,
    )
    return mask.filter(ImageFilter.GaussianBlur(0.052 * width))


def make_edge_safety(size: tuple[int, int]) -> Image.Image:
    width, height = size

    def edge_value(index: int, length: int) -> int:
        distance = min(index, length - 1 - index) / max(length - 1, 1)
        return round(255 * max(0.0, min(1.0, (distance - 0.035) / 0.075)))

    horizontal = Image.new("L", (width, 1))
    horizontal.putdata([edge_value(x, width) for x in range(width)])
    vertical = Image.new("L", (1, height))
    vertical.putdata([edge_value(y, height) for y in range(height)])
    return ImageChops.darker(
        horizontal.resize(size, Image.Resampling.NEAREST),
        vertical.resize(size, Image.Resampling.NEAREST),
    )


def generate(source_path: Path, output_path: Path) -> dict[str, object]:
    source_bytes = source_path.read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    source = Image.open(source_path).convert("RGBA")
    if source.size != (2048, 2048):
        raise ValueError(f"Expected a 2048x2048 source, received {source.size}")

    alpha = source.getchannel("A")
    working_alpha = alpha.resize((WORK_SIZE, WORK_SIZE), Image.Resampling.LANCZOS)
    source_soft = working_alpha.filter(ImageFilter.GaussianBlur(3.5))
    outside_bias = ImageOps.invert(scaled(source_soft, 0.78))

    blur_layers: list[Image.Image] = []
    dilation_sizes = (7, 15, 23)
    for radius, dilation_size in zip(RADII, dilation_sizes, strict=True):
        expanded = working_alpha.filter(ImageFilter.MaxFilter(dilation_size))
        blurred = expanded.filter(ImageFilter.GaussianBlur(radius / 4))
        blur_layers.append(ImageChops.multiply(blurred, outside_bias))

    combined = weighted_sum(blur_layers, WEIGHTS)
    combined = ImageChops.multiply(combined, make_direction_mask(combined.size))
    combined = ImageChops.multiply(combined, make_noise(combined.size))
    combined = ImageChops.multiply(combined, make_core_suppression(combined.size))
    combined = ImageChops.multiply(combined, make_edge_safety(combined.size))
    combined = ImageEnhance.Contrast(combined).enhance(1.18)
    combined = ImageEnhance.Brightness(combined).enhance(1.42)
    aura_alpha = combined.resize(source.size, Image.Resampling.LANCZOS)

    # Maintain exact transparent corners and a clean straight-alpha boundary.
    corner_guard = make_edge_safety(source.size)
    aura_alpha = ImageChops.multiply(aura_alpha, corner_guard)

    purple_mask = Image.new("L", source.size, 0)
    purple_draw = ImageDraw.Draw(purple_mask)
    purple_draw.ellipse((1080, 115, 2020, 980), fill=128)
    purple_draw.ellipse((70, 620, 900, 1450), fill=76)
    purple_mask = purple_mask.filter(ImageFilter.GaussianBlur(190))

    warm_mask = Image.new("L", source.size, 0)
    warm_draw = ImageDraw.Draw(warm_mask)
    warm_draw.ellipse((835, 835, 1213, 1213), fill=32)
    warm_mask = warm_mask.filter(ImageFilter.GaussianBlur(115))

    deep_blue = Image.new("RGB", source.size, (15, 48, 112))
    ice_blue = Image.new("RGB", source.size, (72, 145, 218))
    blue_field = Image.blend(deep_blue, ice_blue, 0.58)
    purple_field = Image.new("RGB", source.size, (74, 74, 166))
    colored = Image.composite(purple_field, blue_field, purple_mask)
    warm_field = Image.new("RGB", source.size, (152, 120, 103))
    colored = Image.composite(warm_field, colored, warm_mask)
    colored.putalpha(aura_alpha)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    colored.save(output_path, "WEBP", quality=95, method=6, exact=True)

    result = Image.open(output_path).convert("RGBA")
    result_alpha = result.getchannel("A")
    corners = [result_alpha.getpixel(point) for point in ((0, 0), (2047, 0), (0, 2047), (2047, 2047))]
    alpha_bbox = result_alpha.getbbox()
    histogram = result_alpha.histogram()
    nonzero = sum(histogram[1:])
    total = source.width * source.height

    qa = {
        "source": str(source_path),
        "output": str(output_path),
        "source_sha256": source_hash,
        "size": list(result.size),
        "mode": result.mode,
        "radii_px": list(RADII),
        "weights": list(WEIGHTS),
        "dilation_filter_sizes_at_512": list(dilation_sizes),
        "seed": SEED,
        "alpha_corners": corners,
        "alpha_bbox": list(alpha_bbox) if alpha_bbox else None,
        "alpha_peak": max(index for index, count in enumerate(histogram) if count),
        "alpha_nonzero_ratio": round(nonzero / total, 6),
        "file_size_bytes": output_path.stat().st_size,
    }
    print(json.dumps(qa, ensure_ascii=False, indent=2))
    return qa


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=project_root / "public/textures/hero/galaxy/main-galaxy-v2.webp",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=project_root / "public/textures/hero/galaxy/main-galaxy-v2-aura.webp",
    )
    args = parser.parse_args()
    generate(args.source.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
