#!/usr/bin/env python3
"""Render the isolated Galaxy Hero Asset V1 beauty with a verified Cycles GPU."""

from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import bpy
import OpenImageIO as oiio


CONFIRMATION = "GALAXY_HERO_V1_LOOKDEV"


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--confirm-render", required=True)
    args = parser.parse_args(argv)
    if args.confirm_render != CONFIRMATION:
        raise RuntimeError("Invalid confirmation token for Galaxy Hero V1 lookdev.")
    return args


def configure_cycles(scene: bpy.types.Scene, config: dict) -> dict:
    render = config["render"]
    requested_backend = str(render["backend"]).upper()
    if requested_backend not in {"OPTIX", "CUDA"}:
        raise RuntimeError(f"Unsupported GPU backend: {requested_backend}")
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = int(render["samples"])
    scene.cycles.use_denoising = bool(render["denoise"])
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.012
    scene.render.resolution_x = int(render["width"])
    scene.render.resolution_y = int(render["height"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.film_transparent = True
    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = requested_backend
    preferences.get_devices()
    devices = []
    for device in preferences.devices:
        device_type = str(device.type).upper()
        is_target_gpu = device_type == requested_backend and "RTX 5060 Ti" in device.name
        device.use = is_target_gpu
        devices.append({"name": device.name, "type": device_type, "enabled": bool(device.use)})
    active = [device for device in devices if device["enabled"]]
    if not active:
        raise RuntimeError(f"RTX 5060 Ti was not enabled through {requested_backend}; CPU fallback is forbidden.")
    if any(device["type"] != requested_backend for device in active):
        raise RuntimeError("A non-requested Cycles device was enabled.")
    return {"requestedBackend": requested_backend, "devices": devices, "activeGpuDevices": active}


def composite_black_preview(source_path: Path, output_path: Path) -> None:
    source = oiio.ImageBuf(str(source_path))
    source_spec = source.spec()
    if source.has_error:
        raise RuntimeError(source.geterror())
    destination_spec = oiio.ImageSpec(source_spec.width, source_spec.height, 4, oiio.FLOAT)
    background = oiio.ImageBuf(destination_spec)
    result = oiio.ImageBuf(destination_spec)
    oiio.ImageBufAlgo.fill(background, (0.0, 0.0, 0.0, 1.0))
    oiio.ImageBufAlgo.over(result, source, background)
    if not result.write(str(output_path)):
        raise RuntimeError(result.geterror())


def main() -> int:
    args = parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    rgba_path = output_dir / "GALAXY_HERO_V1_RGBA.png"
    preview_path = output_dir / "GALAXY_HERO_V1_PREVIEW.png"
    log_path = output_dir / "galaxy-hero-v1-render-log.json"
    scene = bpy.context.scene
    if scene.get("galaxyHeroAssetVersion") != "v1":
        raise RuntimeError("Loaded scene is not Galaxy Hero Asset V1.")
    device_configuration = configure_cycles(scene, config)
    scene.render.filepath = str(rgba_path)
    started_at = datetime.now(timezone.utc)
    started_clock = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    render_seconds = time.perf_counter() - started_clock
    composite_black_preview(rgba_path, preview_path)
    completed_at = datetime.now(timezone.utc)
    log = {
        "schemaVersion": config["schemaVersion"],
        "status": "complete",
        "scene": str(Path(bpy.data.filepath).resolve()),
        "engine": "CYCLES",
        "device": "GPU",
        "backend": device_configuration["requestedBackend"],
        "activeGpuDevices": device_configuration["activeGpuDevices"],
        "devices": device_configuration["devices"],
        "resolution": {"width": scene.render.resolution_x, "height": scene.render.resolution_y},
        "samples": scene.cycles.samples,
        "denoise": scene.cycles.use_denoising,
        "filmTransparent": scene.render.film_transparent,
        "pointCount": int(scene["galaxyHeroPointCount"]),
        "rgbaOutput": str(rgba_path),
        "previewOutput": str(preview_path),
        "renderSeconds": round(render_seconds, 6),
        "host": platform.node(),
        "startedAt": started_at.isoformat(),
        "completedAt": completed_at.isoformat(),
    }
    log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(log, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
