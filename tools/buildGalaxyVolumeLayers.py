from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/textures/hero/galaxy/main-galaxy-v2.webp"
OUTPUT = ROOT / "public/textures/hero/galaxy-volume-preview"
BOARD = ROOT / "art/galaxy-v3/layer-decomposition-board.png"
SIZE = (2048, 2048)
SEED = 30017


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - low) / max(high - low, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def blur_channel(values: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(values, 0.0, 1.0) * 255), "L")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def low_frequency_noise(width: int, height: int, seed: int) -> np.ndarray:
    random = np.random.default_rng(seed)
    source = Image.fromarray(np.uint8(random.random((48, 48)) * 255), "L")
    source = source.resize((width, height), Image.Resampling.BICUBIC)
    source = source.filter(ImageFilter.GaussianBlur(26))
    return np.asarray(source, dtype=np.float32) / 255.0


def shifted_minimum(alpha: np.ndarray, offset: int) -> np.ndarray:
    samples = []
    for shift_y, shift_x in (
        (0, offset), (0, -offset), (offset, 0), (-offset, 0),
        (offset, offset), (offset, -offset), (-offset, offset), (-offset, -offset),
    ):
        shifted = np.roll(alpha, (shift_y, shift_x), axis=(0, 1))
        if shift_y > 0:
            shifted[:shift_y, :] = 0
        elif shift_y < 0:
            shifted[shift_y:, :] = 0
        if shift_x > 0:
            shifted[:, :shift_x] = 0
        elif shift_x < 0:
            shifted[:, shift_x:] = 0
        samples.append(shifted)
    return np.minimum.reduce(samples)


def rgba(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    straight_rgb = np.uint8(np.clip(rgb, 0.0, 1.0) * 255)
    straight_alpha = np.uint8(np.clip(alpha, 0.0, 1.0) * 255)
    return Image.fromarray(np.dstack((straight_rgb, straight_alpha)), "RGBA")


def save_webp(name: str, image: Image.Image) -> Path:
    path = OUTPUT / name
    image.save(path, "WEBP", quality=95, method=6, lossless=False, exact=True)
    return path


def composite_on_dark(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    background = Image.new("RGBA", size, (1, 7, 20, 255))
    preview = image.copy()
    preview.thumbnail((size[0] - 32, size[1] - 64), Image.Resampling.LANCZOS)
    background.alpha_composite(preview, ((size[0] - preview.width) // 2, 42))
    return background.convert("RGB")


def build_board(source: Image.Image, layers: list[tuple[str, Image.Image]]) -> None:
    tile_size = (720, 720)
    board = Image.new("RGB", (tile_size[0] * 4, tile_size[1] * 2), (1, 7, 20))
    draw = ImageDraw.Draw(board)
    entries = [("SOURCE E2", source)] + [(name.upper(), image) for name, image in layers]
    for index, (name, image) in enumerate(entries):
        x = index % 4 * tile_size[0]
        y = index // 4 * tile_size[1]
        board.paste(composite_on_dark(image, tile_size), (x, y))
        draw.rectangle((x + 18, y + 16, x + 226, y + 48), fill=(3, 14, 34))
        draw.text((x + 30, y + 25), name, fill=(197, 231, 255))
    BOARD.parent.mkdir(parents=True, exist_ok=True)
    board.save(BOARD, "PNG", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != SIZE:
        raise ValueError(f"Expected {SIZE}, got {source.size}")

    data = np.asarray(source, dtype=np.float32) / 255.0
    source_rgb = data[..., :3]
    source_alpha = data[..., 3]
    height, width = source_alpha.shape
    yy, xx = np.mgrid[0:height, 0:width]
    nx = (xx - width * 0.5) / (width * 0.5)
    ny = (yy - height * 0.5) / (height * 0.5)
    radius = np.sqrt((nx / 1.0) ** 2 + (ny / 0.78) ** 2)
    core_radius = np.sqrt((nx / 0.23) ** 2 + (ny / 0.19) ** 2)

    luminance = (
        source_rgb[..., 0] * 0.2126
        + source_rgb[..., 1] * 0.7152
        + source_rgb[..., 2] * 0.0722
    )
    local_luminance = blur_channel(luminance * source_alpha, 22)
    broad_luminance = blur_channel(luminance * source_alpha, 68)
    blurred_alpha = blur_channel(source_alpha, 74)
    detail = np.clip(luminance - local_luminance, -1.0, 1.0)
    dark_lane = np.clip(local_luminance - luminance, 0.0, 1.0)
    noise = low_frequency_noise(width, height, SEED)
    edge_neighbor = shifted_minimum(source_alpha, 54)

    outer_weight = smoothstep(0.36, 0.9, radius)
    core_protection = smoothstep(0.95, 1.5, core_radius)
    asymmetric_gate = smoothstep(0.41, 0.7, noise + nx * 0.06 - ny * 0.025)

    haze_alpha = blurred_alpha * outer_weight * core_protection
    haze_alpha *= asymmetric_gate * (0.16 + smoothstep(0.04, 0.3, broad_luminance) * 0.22)
    haze_alpha *= 1.0 - smoothstep(0.83, 1.04, radius)
    haze_rgb = np.zeros_like(source_rgb)
    haze_rgb[..., 0] = 0.055 + noise * 0.055
    haze_rgb[..., 1] = 0.16 + noise * 0.12
    haze_rgb[..., 2] = 0.34 + noise * 0.22
    haze_rgb += source_rgb * 0.16

    chroma = np.max(source_rgb, axis=2) - np.min(source_rgb, axis=2)
    arm_signal = smoothstep(0.035, 0.42, luminance)
    arm_signal = np.maximum(arm_signal, smoothstep(0.035, 0.2, chroma) * 0.76)
    arms_alpha = source_alpha * arm_signal * core_protection
    arms_alpha *= 0.72 + smoothstep(-0.01, 0.17, detail) * 0.28
    arms_alpha *= 1.0 - smoothstep(0.92, 1.08, radius)
    arms_rgb = source_rgb.copy()

    dust_signal = smoothstep(0.018, 0.19, dark_lane)
    dust_signal *= smoothstep(0.025, 0.38, local_luminance)
    dust_alpha = source_alpha * dust_signal * smoothstep(0.35, 1.2, core_radius)
    dust_alpha *= 0.36
    dust_rgb = np.zeros_like(source_rgb)
    dust_rgb[..., 0] = 0.012 + source_rgb[..., 0] * 0.045
    dust_rgb[..., 1] = 0.022 + source_rgb[..., 1] * 0.055
    dust_rgb[..., 2] = 0.05 + source_rgb[..., 2] * 0.075

    warm_score = smoothstep(-0.035, 0.24, source_rgb[..., 0] - source_rgb[..., 2])
    core_falloff = 1.0 - smoothstep(0.56, 1.25, core_radius)
    core_alpha = source_alpha * core_falloff * (0.68 + warm_score * 0.32)
    core_alpha *= 0.82
    core_rgb = source_rgb.copy()

    micro_detail = np.clip(luminance - blur_channel(luminance, 3.2), 0.0, 1.0)
    star_signal = smoothstep(0.075, 0.34, micro_detail) * smoothstep(0.22, 0.78, luminance)
    cluster_signal = smoothstep(0.54, 0.92, luminance) * smoothstep(0.02, 0.13, detail)
    stars_alpha = source_alpha * np.maximum(star_signal, cluster_signal * 0.72)
    stars_alpha *= 0.78
    stars_rgb = np.clip(source_rgb * 1.08, 0.0, 1.0)

    silhouette_edge = np.clip(source_alpha - edge_neighbor, 0.0, 1.0)
    translucent_edge = source_alpha * (1.0 - smoothstep(0.18, 0.86, source_alpha))
    edge_signal = np.maximum(silhouette_edge, translucent_edge)
    edge_gate = smoothstep(0.43, 0.69, noise + nx * 0.035)
    edge_alpha = edge_signal * outer_weight * edge_gate
    edge_alpha *= 0.68
    edge_rgb = source_rgb.copy()

    layers = [
        ("haze", rgba(haze_rgb, haze_alpha)),
        ("arms", rgba(arms_rgb, arms_alpha)),
        ("dust", rgba(dust_rgb, dust_alpha)),
        ("core", rgba(core_rgb, core_alpha)),
        ("stars", rgba(stars_rgb, stars_alpha)),
        ("edge", rgba(edge_rgb, edge_alpha)),
    ]
    for name, image in layers:
        save_webp(f"galaxy-{name}.webp", image)

    for name, image in layers:
        alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
        if any(alpha[y, x] != 0 for x, y in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))):
            raise ValueError(f"{name} corners are not transparent")

    build_board(source, layers)
    print(f"Generated {len(layers)} layers in {OUTPUT}")
    print(f"Board: {BOARD}")


if __name__ == "__main__":
    main()
