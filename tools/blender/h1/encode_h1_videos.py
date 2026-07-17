from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Encode H1 RGBA and Hero PNG sequences.")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="Path to ffmpeg executable")
    parser.add_argument("--galaxy-frames", type=Path, required=True)
    parser.add_argument("--hero-frames", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    ffmpeg = shutil.which(args.ffmpeg) or args.ffmpeg
    args.output.mkdir(parents=True, exist_ok=True)

    run([
        str(ffmpeg), "-y", "-hide_banner", "-loglevel", "warning",
        "-framerate", "24", "-start_number", "1",
        "-i", str(args.galaxy_frames / "h1_%04d.png"),
        "-frames:v", "192", "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p", "-auto-alt-ref", "0",
        "-row-mt", "1", "-deadline", "good", "-cpu-used", "2",
        "-crf", "18", "-b:v", "0", "-metadata:s:v:0", "alpha_mode=1",
        str(args.output / "h1-galaxy-alpha.webm"),
    ])

    encoders = subprocess.run(
        [str(ffmpeg), "-hide_banner", "-encoders"],
        check=True, capture_output=True, text=True,
    ).stdout
    video_codec = ["-c:v", "libx264", "-crf", "18"] if "libx264" in encoders else ["-c:v", "mpeg4", "-q:v", "2"]
    run([
        str(ffmpeg), "-y", "-hide_banner", "-loglevel", "warning",
        "-framerate", "24", "-start_number", "1",
        "-i", str(args.hero_frames / "hero_%04d.png"),
        "-frames:v", "192", *video_codec, "-pix_fmt", "yuv420p",
        str(args.output / "h1-hero-preview.mp4"),
    ])


if __name__ == "__main__":
    main()
