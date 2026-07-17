from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_BASE = SCRIPT_DIR / "assets/hero-base-v1-no-galaxy.jpg"


def paste_full_canvas(background: Image.Image, galaxy: Image.Image, scale: float, center: tuple[int, int]) -> Image.Image:
    size = (round(galaxy.width * scale), round(galaxy.height * scale))
    resized = galaxy.resize(size, Image.Resampling.LANCZOS)
    x = round(center[0] - resized.width * 0.5)
    y = round(center[1] - resized.height * 0.5)
    result = background.convert("RGBA")
    result.alpha_composite(resized, (x, y))
    return result.convert("RGB")


def checkerboard(size: tuple[int, int], cell: int = 24) -> Image.Image:
    image = Image.new("RGBA", size, (0, 0, 0, 255))
    draw = ImageDraw.Draw(image)
    colors = ((48, 52, 60, 255), (78, 84, 94, 255))
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=colors[((x // cell) + (y // cell)) % 2])
    return image


def normalized_difference(a: Image.Image, b: Image.Image) -> float:
    diff = ImageChops.difference(a.convert("RGBA"), b.convert("RGBA"))
    return sum(ImageStat.Stat(diff).mean) / 4.0 / 255.0 * 100.0


def load_clean_base(path: Path) -> Image.Image:
    base = Image.open(path).convert("RGB").resize((1920, 1080), Image.Resampling.LANCZOS)
    # The retained image already excludes the main galaxy. A tiny blur removes
    # compression chatter without changing the locked Hero composition.
    return base.filter(ImageFilter.GaussianBlur(0.25))


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose reproducible H1 review media")
    parser.add_argument("--galaxy-frames", type=Path, required=True)
    parser.add_argument("--hero-frames", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--hero-base", type=Path, default=DEFAULT_BASE)
    parser.add_argument("--e2-hero", type=Path)
    parser.add_argument("--r22-hero", type=Path)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    args.hero_frames.mkdir(parents=True, exist_ok=True)
    clean_1920 = load_clean_base(args.hero_base)
    clean_1280 = clean_1920.resize((1280, 720), Image.Resampling.LANCZOS)
    first = Image.open(args.galaxy_frames / "h1_0001.png").convert("RGBA")
    bbox = first.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("First H1 frame has no visible alpha")
    visual_width = bbox[2] - bbox[0]

    for frame in range(1, 193):
        galaxy = Image.open(args.galaxy_frames / f"h1_{frame:04d}.png").convert("RGBA")
        hero = paste_full_canvas(clean_1280, galaxy, 480.0 / visual_width, (967, 280))
        hero.save(args.hero_frames / f"hero_{frame:04d}.png", "PNG", optimize=False)

    keyframes = {"start": 1, "middle": 96, "end": 192}
    hero_keys: dict[str, Image.Image] = {}
    checker = checkerboard((1280, 720))
    for name, frame in keyframes.items():
        galaxy = Image.open(args.galaxy_frames / f"h1_{frame:04d}.png").convert("RGBA")
        hero = paste_full_canvas(clean_1920, galaxy, 720.0 / visual_width, (1450, 420))
        hero.save(args.output / f"h1-frame-{name}.png", "PNG", optimize=True)
        hero_keys[name] = hero
        alpha_review = checker.copy()
        alpha_review.alpha_composite(galaxy)
        alpha_review.convert("RGB").save(args.output / f"h1-alpha-{name}.png", "PNG", optimize=True)

    if args.e2_hero and args.r22_hero and args.e2_hero.exists() and args.r22_hero.exists():
        panels = [
            (Image.open(args.e2_hero).convert("RGB"), "E2"),
            (Image.open(args.r22_hero).convert("RGB"), "R2.2"),
            (hero_keys["middle"], "H1"),
        ]
        board = Image.new("RGB", (5760, 1080), (2, 6, 16))
        draw = ImageDraw.Draw(board)
        for index, (panel, label) in enumerate(panels):
            x = index * 1920
            board.paste(panel.resize((1920, 1080), Image.Resampling.LANCZOS), (x, 0))
            draw.rounded_rectangle((x + 38, 34, x + 150, 80), radius=10, fill=(3, 10, 24))
            draw.text((x + 60, 49), label, fill=(205, 228, 245))
        board.save(args.output / "e2-vs-r22-vs-h1.png", "PNG", optimize=True)

    start = Image.open(args.galaxy_frames / "h1_0001.png").convert("RGBA")
    middle = Image.open(args.galaxy_frames / "h1_0096.png").convert("RGBA")
    end = Image.open(args.galaxy_frames / "h1_0192.png").convert("RGBA")
    stats = {
        "galaxy_rgba_start_end_mae_percent": round(normalized_difference(start, end), 8),
        "hero_start_end_mae_percent": round(normalized_difference(hero_keys["start"], hero_keys["end"]), 8),
        "galaxy_start_middle_mae_percent": round(normalized_difference(start, middle), 8),
        "alpha_corner_values": {
            name: [
                Image.open(args.galaxy_frames / f"h1_{frame:04d}.png").convert("RGBA").getchannel("A").getpixel(point)
                for point in ((0, 0), (1279, 0), (0, 719), (1279, 719))
            ]
            for name, frame in keyframes.items()
        },
        "video_frames": 192,
        "fps": 24,
        "duration_seconds": 8,
        "video_size": [1280, 720],
        "hero_key_size": [1920, 1080],
    }
    (args.output / "h1-loop-alpha-qa.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
