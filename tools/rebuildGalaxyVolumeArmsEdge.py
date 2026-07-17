from __future__ import annotations

import json
import math
import subprocess
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
WIP_COMMIT = "1a84b711d54ec5f9ff5162fed943b62d2543d252"
SOURCE_E2 = ROOT / "public/textures/hero/galaxy/main-galaxy-v2.webp"
OUTPUT = ROOT / "art/galaxy-v3/arms-edge-rework"
EXTERNAL_SOURCE = Path.home() / "Documents/ActiveTheory-GalaxyV3-Rework/source"
SIZE = (2048, 2048)
SEED = 31017

WIP_LAYERS = {
    name: f"public/textures/hero/galaxy-volume-preview/galaxy-{name}.webp"
    for name in ("haze", "arms", "dust", "core", "stars", "edge")
}

LAYER_CONFIG = [
    {"key": "haze", "scale": 1.070, "opacity": 0.42, "blend": "additive"},
    {"key": "arms", "scale": 1.000, "opacity": 0.90, "blend": "normal"},
    {"key": "dust", "scale": 1.005, "opacity": 0.78, "blend": "normal"},
    {"key": "core", "scale": 0.995, "opacity": 0.82, "blend": "normal"},
    {"key": "stars", "scale": 1.010, "opacity": 0.58, "blend": "additive"},
    {"key": "edge", "scale": 1.025, "opacity": 0.56, "blend": "additive"},
]


def smoothstep(low: float, high: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - low) / max(high - low, 1e-8), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def angular_distance(angle: np.ndarray, center: float) -> np.ndarray:
    return np.abs((angle - center + np.pi) % (2 * np.pi) - np.pi)


def angular_window(angle: np.ndarray, center_deg: float, half_width_deg: float, feather_deg: float) -> np.ndarray:
    distance = angular_distance(angle, math.radians(center_deg))
    inner = math.radians(max(half_width_deg - feather_deg, 0.1))
    outer = math.radians(half_width_deg)
    return 1.0 - smoothstep(inner, outer, distance)


def low_frequency_noise(width: int, height: int, seed: int) -> np.ndarray:
    random = np.random.default_rng(seed)
    source = Image.fromarray(np.uint8(random.random((56, 56)) * 255), "L")
    source = source.resize((width, height), Image.Resampling.BICUBIC)
    source = source.filter(ImageFilter.GaussianBlur(24))
    return np.asarray(source, dtype=np.float32) / 255.0


def blur(values: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(values, 0.0, 1.0) * 255 + 0.5), "L")
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0


def shifted_minimum(alpha: np.ndarray, offset: int) -> np.ndarray:
    samples: list[np.ndarray] = []
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


def export_wip_sources() -> dict[str, Path]:
    EXTERNAL_SOURCE.mkdir(parents=True, exist_ok=True)
    exported: dict[str, Path] = {}
    for name, git_path in WIP_LAYERS.items():
        destination = EXTERNAL_SOURCE / f"galaxy-{name}.webp"
        result = subprocess.run(
            ["git", "show", f"{WIP_COMMIT}:{git_path}"],
            cwd=ROOT,
            check=True,
            stdout=subprocess.PIPE,
        )
        destination.write_bytes(result.stdout)
        exported[name] = destination
    return exported


def rgba_float(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGBA"), dtype=np.float32) / 255.0


def rgba_image(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    data = np.dstack((
        np.uint8(np.clip(rgb, 0.0, 1.0) * 255 + 0.5),
        np.uint8(np.clip(alpha, 0.0, 1.0) * 255 + 0.5),
    ))
    return Image.fromarray(data, "RGBA")


def coordinate_fields(width: int, height: int) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    yy, xx = np.mgrid[0:height, 0:width]
    nx = (xx - width * 0.5) / (width * 0.5)
    ny = (yy - height * 0.5) / (height * 0.5)
    radius = np.sqrt(nx**2 + (ny / 0.78) ** 2)
    angle = np.arctan2(ny / 0.78, nx)
    return nx, ny, radius, angle


def outer_angular_stats(alpha: np.ndarray, threshold: float = 0.04, sectors: int = 720) -> tuple[float, float, list[bool]]:
    height, width = alpha.shape
    _, _, radius, angle = coordinate_fields(width, height)
    normalized_angle = (angle + 2 * np.pi) % (2 * np.pi)
    ring = (radius >= 0.50) & (radius <= 0.92)
    sector_index = np.minimum(
        np.floor(normalized_angle * sectors / (2 * np.pi)).astype(np.int32),
        sectors - 1,
    )
    active_indices = sector_index[ring & (alpha > threshold)]
    counts = np.bincount(active_indices, minlength=sectors)
    hits = [bool(value) for value in counts > 0]
    coverage = sum(hits) / sectors
    doubled = hits + hits
    longest = 0
    current = 0
    for hit in doubled:
        current = current + 1 if hit else 0
        longest = max(longest, current)
    longest = min(longest, sectors)
    return coverage, longest * 360.0 / sectors, hits


def build_arms_alpha(old_alpha: np.ndarray, noise: np.ndarray) -> tuple[np.ndarray, dict]:
    height, width = old_alpha.shape
    _, _, radius, angle = coordinate_fields(width, height)
    warped_radius = radius + (noise - 0.5) * 0.065
    warped_angle = angle + (radius - 0.58) * 0.42 + (noise - 0.5) * 0.24
    outer_gate = smoothstep(0.39, 0.50, warped_radius)
    final_alpha = old_alpha.copy()
    target_low, target_high = 0.55, 0.68
    widths = np.array([19.0, 15.0, 21.0, 13.5], dtype=np.float32)
    centers = [-43.0, 39.0, 166.0, 96.0]
    depths = [0.98, 0.94, 0.97, 0.91]

    for _ in range(14):
        cut = np.zeros_like(old_alpha)
        for center, half_width, depth in zip(centers, widths, depths):
            cut = np.maximum(cut, angular_window(warped_angle, center, float(half_width), 11.0) * depth)
        irregular_cut = smoothstep(0.56, 0.90, cut + (noise - 0.5) * 0.22)
        candidate = old_alpha * (1.0 - outer_gate * irregular_cut)
        candidate *= 1.0 - smoothstep(0.90, 1.08, radius) * (0.20 + 0.24 * noise)
        candidate = np.clip(candidate, 0.0, 1.0)
        coverage, _, _ = outer_angular_stats(candidate)
        final_alpha = candidate
        if target_low <= coverage <= target_high:
            break
        widths *= 1.07 if coverage > target_high else 0.94

    coverage, longest, _ = outer_angular_stats(final_alpha)
    return final_alpha, {
        "coverage": coverage,
        "max_continuous_arc_degrees": longest,
        "missing_regions": 4,
        "missing_centers_degrees": centers,
        "missing_half_widths_degrees": [float(value) for value in widths],
    }


def build_edge_alpha(source_alpha: np.ndarray, noise: np.ndarray) -> tuple[np.ndarray, dict]:
    height, width = source_alpha.shape
    _, _, radius, angle = coordinate_fields(width, height)
    edge_neighbor = shifted_minimum(source_alpha, 46)
    silhouette = np.clip(source_alpha - edge_neighbor, 0.0, 1.0)
    translucent = source_alpha * (1.0 - smoothstep(0.16, 0.82, source_alpha))
    local_structure = np.maximum(silhouette, translucent)
    local_structure = np.maximum(local_structure, blur(local_structure, 7.0) * 0.38)
    outer_gate = smoothstep(0.48, 0.68, radius) * (1.0 - smoothstep(0.96, 1.08, radius))
    warped_angle = angle + (radius - 0.72) * 0.28 + (noise - 0.5) * 0.19
    regions = [
        {"name": "right-upper", "center": -43.0, "half_width": 34.0, "strength": 1.00},
        {"name": "left-short", "center": 168.0, "half_width": 27.0, "strength": 0.82},
        {"name": "right-lower", "center": 38.0, "half_width": 23.0, "strength": 0.72},
        {"name": "upper-left-fragment", "center": -126.0, "half_width": 17.0, "strength": 0.54},
    ]
    target_low, target_high = 0.30, 0.50
    final_alpha = np.zeros_like(source_alpha)

    for _ in range(30):
        region_gate = np.zeros_like(source_alpha)
        for region in regions:
            gate = angular_window(warped_angle, region["center"], region["half_width"], 10.0)
            region_gate = np.maximum(region_gate, gate * region["strength"])
        breakup = np.clip(0.72 + (noise - 0.5) * 0.70, 0.34, 1.0)
        candidate = local_structure * outer_gate * region_gate * breakup * 0.88
        candidate = np.clip(candidate, 0.0, 1.0)
        coverage, longest, _ = outer_angular_stats(candidate)
        final_alpha = candidate
        if target_low <= coverage <= target_high and longest <= 75.0:
            break
        factor = 0.94 if coverage > target_high or longest > 75.0 else 1.05
        for region in regions:
            region["half_width"] *= factor

    coverage, longest, _ = outer_angular_stats(final_alpha)
    return final_alpha, {
        "designed_regions": len(regions),
        "regions": regions,
        "coverage": coverage,
        "max_continuous_arc_degrees": longest,
    }


def connected_components(alpha: np.ndarray, threshold: float = 0.05) -> dict:
    small = Image.fromarray(np.uint8(np.clip(alpha, 0, 1) * 255 + 0.5), "L").resize((512, 512), Image.Resampling.LANCZOS)
    mask = np.asarray(small, dtype=np.uint8) > round(threshold * 255)
    visited = np.zeros_like(mask, dtype=bool)
    components: list[int] = []
    height, width = mask.shape
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue
            queue = deque([(x, y)])
            visited[y, x] = True
            size = 0
            while queue:
                px, py = queue.popleft()
                size += 1
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((nx, ny))
            if size >= 24:
                components.append(size)
    return {"count": len(components), "areas_at_512": sorted(components, reverse=True)}


def alpha_metrics(alpha: np.ndarray) -> dict:
    height, width = alpha.shape
    yy, xx = np.mgrid[0:height, 0:width]
    total = float(alpha.sum())
    centroid = [
        float((xx * alpha).sum() / max(total, 1e-8)),
        float((yy * alpha).sum() / max(total, 1e-8)),
    ]
    border = np.zeros_like(alpha, dtype=bool)
    margin = round(width * 0.01)
    border[:margin] = True
    border[-margin:] = True
    border[:, :margin] = True
    border[:, -margin:] = True
    coverage, longest, _ = outer_angular_stats(alpha)
    return {
        "alpha_nonzero_percent": float((alpha > 1 / 255).mean() * 100),
        "alpha_gt_005_percent": float((alpha > 0.05).mean() * 100),
        "outer_angular_coverage_percent": coverage * 100,
        "max_continuous_arc_degrees": longest,
        "centroid_px": centroid,
        "corners_alpha_8bit": [
            int(round(alpha[0, 0] * 255)), int(round(alpha[0, -1] * 255)),
            int(round(alpha[-1, 0] * 255)), int(round(alpha[-1, -1] * 255)),
        ],
        "outer_one_percent_alpha_max": float(alpha[border].max()),
    }


def srgb_to_linear(rgb: np.ndarray) -> np.ndarray:
    return np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(rgb: np.ndarray) -> np.ndarray:
    rgb = np.clip(rgb, 0.0, 1.0)
    return np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055)


def resize_center(image: Image.Image, scale: float, size: tuple[int, int]) -> Image.Image:
    if abs(scale - 1.0) < 1e-8:
        return image.copy()
    resized = image.resize((round(size[0] * scale), round(size[1] * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return canvas


def composite_layers(layers: dict[str, Image.Image]) -> tuple[np.ndarray, np.ndarray]:
    width, height = SIZE
    dst_rgb = np.zeros((height, width, 3), dtype=np.float32)
    dst_alpha = np.zeros((height, width), dtype=np.float32)
    for config in LAYER_CONFIG:
        data = rgba_float(resize_center(layers[config["key"]], config["scale"], SIZE))
        src_rgb = srgb_to_linear(data[..., :3])
        src_alpha = np.clip(data[..., 3] * config["opacity"], 0.0, 1.0)
        if config["blend"] == "normal":
            out_alpha = src_alpha + dst_alpha * (1.0 - src_alpha)
            numerator = src_rgb * src_alpha[..., None] + dst_rgb * dst_alpha[..., None] * (1.0 - src_alpha[..., None])
            dst_rgb = np.where(out_alpha[..., None] > 1e-8, numerator / np.maximum(out_alpha[..., None], 1e-8), 0.0)
            dst_alpha = out_alpha
        else:
            dst_rgb = np.clip(dst_rgb + src_rgb * src_alpha[..., None], 0.0, 1.0)
            dst_alpha = np.clip(dst_alpha + src_alpha, 0.0, 1.0)
    return linear_to_srgb(dst_rgb), dst_alpha


def aces_preview(rgb: np.ndarray, exposure: float = 0.76) -> np.ndarray:
    values = np.clip(srgb_to_linear(rgb) * exposure, 0.0, None)
    mapped = (values * (2.51 * values + 0.03)) / (values * (2.43 * values + 0.59) + 0.14)
    return linear_to_srgb(np.clip(mapped, 0.0, 1.0))


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def reconstruction_metrics(source: Image.Image, rgb: np.ndarray, alpha: np.ndarray) -> dict:
    source_data = rgba_float(source)
    source_rgb = source_data[..., :3]
    source_alpha = source_data[..., 3]
    rgb_mae = float(np.abs(source_rgb * source_alpha[..., None] - rgb * alpha[..., None]).mean())
    alpha_mae = float(np.abs(source_alpha - alpha).mean())
    height, width = source_alpha.shape
    _, _, radius, _ = coordinate_fields(width, height)
    core = radius < 0.23
    display_rgb = aces_preview(rgb)
    display_lum = luminance(display_rgb)
    valid_core = core & (alpha > 0.01)
    core_clip = float(((display_lum >= 0.99) & valid_core).sum() / max(valid_core.sum(), 1) * 100)
    source_valid = source_alpha > 0.01
    rebuilt_valid = alpha > 0.01
    return {
        "rgb_premultiplied_mae_0_to_1": rgb_mae,
        "rgb_premultiplied_mae_percent": rgb_mae * 100,
        "alpha_mae_0_to_1": alpha_mae,
        "alpha_effective_area_percent": float(rebuilt_valid.mean() * 100),
        "source_alpha_effective_area_percent": float(source_valid.mean() * 100),
        "core_near_white_clip_percent_after_aces": core_clip,
    }


def tile_on_dark(image: Image.Image, size: tuple[int, int], title: str) -> Image.Image:
    tile = Image.new("RGB", size, (1, 7, 20))
    work = image.convert("RGBA")
    work.thumbnail((size[0] - 30, size[1] - 70), Image.Resampling.LANCZOS)
    tile.paste(work.convert("RGB"), ((size[0] - work.width) // 2, (size[1] - work.height) // 2 + 18), work.getchannel("A"))
    draw = ImageDraw.Draw(tile)
    draw.rectangle((10, 8, size[0] - 10, 42), fill=(3, 16, 38))
    draw.text((20, 19), title, fill=(205, 235, 255), font=ImageFont.load_default())
    return tile


def alpha_visual(alpha: np.ndarray) -> Image.Image:
    gray = np.uint8(np.clip(alpha, 0.0, 1.0) * 255 + 0.5)
    return Image.merge("RGBA", (Image.fromarray(gray), Image.fromarray(gray), Image.fromarray(gray), Image.new("L", SIZE, 255)))


def build_contact_sheet(old_arms: Image.Image, new_arms: Image.Image, old_edge: Image.Image, new_edge: Image.Image) -> Path:
    images = [old_arms, new_arms, old_edge, new_edge]
    names = ["OLD ARMS", "NEW ARMS", "OLD EDGE", "NEW EDGE"]
    alpha_images = [alpha_visual(rgba_float(image)[..., 3]) for image in images]
    tile_size = (620, 610)
    board = Image.new("RGB", (tile_size[0] * 4, tile_size[1] * 2), (1, 7, 20))
    for index, (image, name) in enumerate(zip(images, names)):
        board.paste(tile_on_dark(image, tile_size, name), (index * tile_size[0], 0))
        board.paste(tile_on_dark(alpha_images[index], tile_size, name + " ALPHA"), (index * tile_size[0], tile_size[1]))
    path = OUTPUT / "arms-edge-contact-sheet.png"
    board.save(path, "PNG", optimize=True)
    return path


def build_mask_comparison(old_arms_alpha: np.ndarray, old_edge_alpha: np.ndarray, new_arms_alpha: np.ndarray, new_edge_alpha: np.ndarray) -> Path:
    def mask_image(arms: np.ndarray, edge: np.ndarray) -> Image.Image:
        rgb = np.zeros((*arms.shape, 3), dtype=np.float32)
        rgb[..., 0] = edge * 0.82
        rgb[..., 1] = arms * 0.72 + edge * 0.24
        rgb[..., 2] = arms * 1.0 + edge * 0.62
        alpha = np.clip(np.maximum(arms, edge), 0.0, 1.0)
        return rgba_image(rgb, alpha)
    tile_size = (1200, 1100)
    board = Image.new("RGB", (2400, 1100), (1, 7, 20))
    board.paste(tile_on_dark(mask_image(old_arms_alpha, old_edge_alpha), tile_size, "OLD ARMS + EDGE MASKS"), (0, 0))
    board.paste(tile_on_dark(mask_image(new_arms_alpha, new_edge_alpha), tile_size, "REWORKED ARMS + EDGE MASKS"), (1200, 0))
    path = OUTPUT / "original-vs-reworked-masks.png"
    board.save(path, "PNG", optimize=True)
    return path


def build_reconstruction_preview(source: Image.Image, rgb: np.ndarray, alpha: np.ndarray) -> Path:
    preview_rgb = aces_preview(rgb)
    rebuilt = rgba_image(preview_rgb, alpha)
    tile_size = (1200, 1100)
    board = Image.new("RGB", (2400, 1100), (1, 7, 20))
    board.paste(tile_on_dark(source, tile_size, "OFFICIAL E2"), (0, 0))
    board.paste(tile_on_dark(rebuilt, tile_size, "REWORKED STATIC SIX-LAYER PREVIEW"), (1200, 0))
    path = OUTPUT / "static-reconstruction-preview.png"
    board.save(path, "PNG", optimize=True)
    return path


def write_qa_report(payload: dict) -> Path:
    arms = payload["arms"]
    edge = payload["edge"]
    reconstruction = payload["reconstruction"]
    checks = [
        ("Arms outer angular coverage below 68%", arms["outer_angular_coverage_percent"] < 68.0),
        ("Arms outer angular coverage at least 55%", arms["outer_angular_coverage_percent"] >= 55.0),
        ("Edge outer angular coverage below 50%", edge["outer_angular_coverage_percent"] < 50.0),
        ("Edge outer angular coverage at least 30%", edge["outer_angular_coverage_percent"] >= 30.0),
        ("Edge maximum continuous arc no more than 75 degrees", edge["max_continuous_arc_degrees"] <= 75.0),
        ("Edge uses 3 to 5 designed local regions", 3 <= edge["designed_regions"] <= 5),
        ("Both textures keep transparent corners", all(value == 0 for value in arms["corners_alpha_8bit"] + edge["corners_alpha_8bit"])),
        ("Both textures keep the outer 1% transparent", arms["outer_one_percent_alpha_max"] == 0.0 and edge["outer_one_percent_alpha_max"] == 0.0),
        ("RGB MAE does not exceed 5%", reconstruction["rgb_premultiplied_mae_percent"] <= 5.0),
        ("ACES preview core near-white clipping does not exceed 0.10%", reconstruction["core_near_white_clip_percent_after_aces"] <= 0.10),
    ]
    lines = [
        "# Galaxy V3.0 Arms Alpha and Edge Rework QA",
        "",
        f"- Source WIP Commit: `{WIP_COMMIT}`",
        "- Only Arms Alpha and Edge were rebuilt.",
        "- Haze, Dust, Core and Stars were read from the WIP Commit without modification.",
        "",
        "## Metrics",
        "",
        f"- Arms outer coverage: {arms['outer_angular_coverage_percent']:.2f}%",
        f"- Arms maximum continuous arc: {arms['max_continuous_arc_degrees']:.2f} degrees",
        f"- Arms missing regions: {arms['missing_regions']}",
        f"- Arms Alpha effective area: {arms['alpha_nonzero_percent']:.3f}%",
        f"- Arms Alpha > 0.05 area: {arms['alpha_gt_005_percent']:.3f}%",
        f"- Arms centroid: ({arms['centroid_px'][0]:.2f}, {arms['centroid_px'][1]:.2f})",
        f"- Edge designed regions: {edge['designed_regions']}",
        f"- Edge large connected components at 512px: {edge['connected_components']['count']}",
        f"- Edge outer coverage: {edge['outer_angular_coverage_percent']:.2f}%",
        f"- Edge maximum continuous arc: {edge['max_continuous_arc_degrees']:.2f} degrees",
        f"- Edge Alpha effective area: {edge['alpha_nonzero_percent']:.3f}%",
        f"- Edge Alpha > 0.05 area: {edge['alpha_gt_005_percent']:.3f}%",
        f"- Edge centroid: ({edge['centroid_px'][0]:.2f}, {edge['centroid_px'][1]:.2f})",
        f"- Reconstruction premultiplied RGB MAE: {reconstruction['rgb_premultiplied_mae_percent']:.3f}%",
        f"- Reconstruction Alpha MAE: {reconstruction['alpha_mae_0_to_1']:.6f}",
        f"- Reconstruction Alpha effective area: {reconstruction['alpha_effective_area_percent']:.3f}%",
        f"- ACES preview core near-white clipping: {reconstruction['core_near_white_clip_percent_after_aces']:.4f}%",
        "",
        "## Checks",
        "",
    ]
    lines.extend(f"- {'PASS' if passed else 'FAIL'} — {label}" for label, passed in checks)
    lines.extend([
        "",
        "## Conclusion",
        "",
        "PASS" if all(passed for _, passed in checks) else "FAIL",
        "",
        "The reworked Arms preserves the original RGB and middle-arm identity while removing four asymmetric outer sectors. The reworked Edge is generated from the official E2 outer structure and is limited to four separated directional gates. No files under src/ or public/ were modified by this script.",
        "",
    ])
    path = OUTPUT / "qa-report.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    exported = export_wip_sources()
    source = Image.open(SOURCE_E2).convert("RGBA")
    if source.size != SIZE:
        raise ValueError(f"Expected E2 {SIZE}, got {source.size}")
    source_data = rgba_float(source)
    source_rgb = source_data[..., :3]
    source_alpha = source_data[..., 3]
    noise = low_frequency_noise(*SIZE, SEED)

    old_layers = {name: Image.open(path).convert("RGBA") for name, path in exported.items()}
    old_arms_data = rgba_float(old_layers["arms"])
    old_edge_data = rgba_float(old_layers["edge"])
    new_arms_alpha, arms_design = build_arms_alpha(old_arms_data[..., 3], noise)
    new_edge_alpha, edge_design = build_edge_alpha(source_alpha, np.roll(noise, (173, -121), axis=(0, 1)))

    new_arms = rgba_image(old_arms_data[..., :3], new_arms_alpha)
    new_edge = rgba_image(source_rgb, new_edge_alpha)
    arms_path = OUTPUT / "galaxy-arms-reworked.png"
    edge_path = OUTPUT / "galaxy-edge-reworked.png"
    new_arms.save(arms_path, "PNG", optimize=True)
    new_edge.save(edge_path, "PNG", optimize=True)
    alpha_visual(new_arms_alpha).save(OUTPUT / "arms-alpha-preview.png", "PNG", optimize=True)
    alpha_visual(new_edge_alpha).save(OUTPUT / "edge-alpha-preview.png", "PNG", optimize=True)

    layers = old_layers.copy()
    layers["arms"] = new_arms
    layers["edge"] = new_edge
    reconstructed_rgb, reconstructed_alpha = composite_layers(layers)
    reconstruction = reconstruction_metrics(source, reconstructed_rgb, reconstructed_alpha)

    arms_metrics = alpha_metrics(new_arms_alpha)
    arms_metrics.update(arms_design)
    edge_metrics = alpha_metrics(new_edge_alpha)
    edge_metrics.update(edge_design)
    edge_metrics["connected_components"] = connected_components(new_edge_alpha)
    payload = {
        "arms": arms_metrics,
        "edge": edge_metrics,
        "reconstruction": reconstruction,
        "outputs": {
            "arms": str(arms_path),
            "edge": str(edge_path),
            "contact_sheet": str(build_contact_sheet(old_layers["arms"], new_arms, old_layers["edge"], new_edge)),
            "mask_comparison": str(build_mask_comparison(old_arms_data[..., 3], old_edge_data[..., 3], new_arms_alpha, new_edge_alpha)),
            "static_reconstruction": str(build_reconstruction_preview(source, reconstructed_rgb, reconstructed_alpha)),
        },
    }
    payload["outputs"]["qa_report"] = str(write_qa_report(payload))
    (OUTPUT / "qa-metrics.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    failures: list[str] = []
    if not 0.55 <= arms_design["coverage"] < 0.68:
        failures.append("Arms coverage outside 55%-68%")
    if not 0.30 <= edge_design["coverage"] < 0.50:
        failures.append("Edge coverage outside 30%-50%")
    if edge_design["max_continuous_arc_degrees"] > 75.0:
        failures.append("Edge continuous arc exceeds 75 degrees")
    if reconstruction["rgb_premultiplied_mae_percent"] > 5.0:
        failures.append("RGB MAE exceeds 5%")
    if reconstruction["core_near_white_clip_percent_after_aces"] > 0.10:
        failures.append("Core clipping exceeds 0.10%")
    if failures:
        raise RuntimeError("; ".join(failures))
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
