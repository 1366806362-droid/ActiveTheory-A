#!/usr/bin/env python3
"""Render the single locked Home LookDev V1.2 review frame."""

from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import bpy


FRAME = 145
SAMPLES = 32
CONFIRMATION = "HOME_LOOKDEV_FRAME_145"
ROOT = Path(__file__).resolve().parents[2]
EXPECTED_SCENE = ROOT / "art/hero-cinematic/home-lookdev-v1/hero-cinematic-home-lookdev-v1.blend"
OUTPUT = ROOT / "art/hero-cinematic/home-lookdev-review-v12/frame-145-lookdev-v12.png"
LOG = ROOT / "art/hero-cinematic/home-lookdev-review-v12/home-lookdev-frame-145-log.json"


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm-render", required=True)
    args = parser.parse_args(argv)
    if args.confirm_render != CONFIRMATION:
        raise RuntimeError("Invalid confirmation token; only HOME_LOOKDEV_FRAME_145 is accepted.")
    return args


def configure_optix(scene: bpy.types.Scene) -> dict:
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    if hasattr(scene.render, "use_motion_blur"):
        scene.render.use_motion_blur = True

    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = "OPTIX"
    preferences.get_devices()
    devices = []
    for device in preferences.devices:
        device_type = str(device.type).upper()
        device.use = device_type == "OPTIX"
        devices.append({"name": device.name, "type": device_type, "enabled": bool(device.use)})
    active = [item for item in devices if item["enabled"]]
    if not active:
        raise RuntimeError("No OPTIX Cycles GPU device was enabled; CUDA and CPU fallback are forbidden.")
    if any(item["type"] != "OPTIX" for item in active):
        raise RuntimeError("A non-OPTIX device was enabled.")
    return {"devices": devices, "activeGpuDevices": active}


def main() -> int:
    args = parse_args()
    actual_scene = Path(bpy.data.filepath).resolve()
    if actual_scene != EXPECTED_SCENE.resolve():
        raise RuntimeError(f"Unexpected scene: {actual_scene}; expected {EXPECTED_SCENE.resolve()}.")
    scene = bpy.context.scene
    if scene.get("homeLookdevVersion") != "v1.2":
        raise RuntimeError("Home LookDev scene is not V1.2.")
    device_configuration = configure_optix(scene)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    scene.frame_set(FRAME)
    scene.render.filepath = str(OUTPUT)
    started_at = datetime.now(timezone.utc)
    started_clock = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    duration_seconds = time.perf_counter() - started_clock
    completed_at = datetime.now(timezone.utc)
    log = {
        "schemaVersion": "1.2.0",
        "status": "complete",
        "confirmation": args.confirm_render,
        "scene": str(actual_scene),
        "frame": FRAME,
        "samples": SAMPLES,
        "engine": "CYCLES",
        "device": "GPU",
        "computeBackend": "OPTIX",
        "denoise": True,
        "motionBlur": True,
        "resolution": {"width": 1920, "height": 1080},
        "activeGpuDevices": device_configuration["activeGpuDevices"],
        "devices": device_configuration["devices"],
        "output": str(OUTPUT.resolve()),
        "durationSeconds": round(duration_seconds, 6),
        "host": platform.node(),
        "startedAt": started_at.isoformat(),
        "completedAt": completed_at.isoformat(),
    }
    LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(log, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
