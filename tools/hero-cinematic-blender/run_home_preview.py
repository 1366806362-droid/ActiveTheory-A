#!/usr/bin/env python3
"""Render only an explicitly confirmed home preview or full sequence in Blender."""

from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy


PREVIEW_FRAMES = [1, 78, 145, 198, 240]


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--frames", required=True)
    parser.add_argument("--confirm-render", required=True)
    parser.add_argument("--force-render", action="store_true")
    return parser.parse_args(argv)


def parse_frames(value: str, confirmation: str) -> list[int]:
    if "-" in value:
        start_text, end_text = value.split("-", 1)
        frames = list(range(int(start_text), int(end_text) + 1))
    else:
        frames = [int(item) for item in value.split(",") if item.strip()]

    if confirmation == "HOME_PREVIEW_5_FRAMES" and frames != PREVIEW_FRAMES:
        raise RuntimeError("Preview confirmation only permits frames 1,78,145,198,240.")
    if confirmation == "HOME_FULL_240_FRAMES" and frames != list(range(1, 241)):
        raise RuntimeError("Full confirmation only permits the locked frame range 1-240.")
    if confirmation not in {"HOME_PREVIEW_5_FRAMES", "HOME_FULL_240_FRAMES"}:
        raise RuntimeError("Render confirmation token is invalid.")
    return frames


def configure_cycles(scene: bpy.types.Scene, settings: dict) -> list[dict]:
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = int(settings["samples"])
    scene.cycles.use_denoising = bool(settings["denoise"])
    scene.render.resolution_x = int(settings["renderWidth"])
    scene.render.resolution_y = int(settings["renderHeight"])
    scene.render.resolution_percentage = 100
    scene.render.fps = int(settings["fps"])
    scene.render.image_settings.file_format = "PNG"
    if hasattr(scene.render, "use_motion_blur"):
        scene.render.use_motion_blur = bool(settings["motionBlur"])

    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = str(settings["computeBackend"])
    preferences.get_devices()
    devices = []
    for device in preferences.devices:
        is_usable = device.type in {"OPTIX", "CUDA"}
        device.use = is_usable
        devices.append({"name": device.name, "type": device.type, "enabled": bool(device.use)})
    if not any(item["enabled"] for item in devices):
        raise RuntimeError("No Cycles GPU device was enabled.")
    return devices


def main() -> int:
    args = parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    settings = config["homeRender"]
    frames = parse_frames(args.frames, args.confirm_render)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    devices = configure_cycles(scene, settings)
    started_at = datetime.now(timezone.utc)

    for frame in frames:
        scene.frame_set(frame)
        scene.render.filepath = str(output_dir / f"frame-{frame:03d}.png")
        bpy.ops.render.render(write_still=True)

    completed_at = datetime.now(timezone.utc)
    log = {
        "schemaVersion": "1.0.0",
        "status": "complete",
        "confirmation": args.confirm_render,
        "frames": frames,
        "engine": "CYCLES",
        "device": "GPU",
        "computeBackend": settings["computeBackend"],
        "samples": settings["samples"],
        "denoise": settings["denoise"],
        "devices": devices,
        "host": platform.node(),
        "startedAt": started_at.isoformat(),
        "completedAt": completed_at.isoformat(),
    }
    (output_dir / "home-preview-render-log.json").write_text(
        json.dumps(log, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
