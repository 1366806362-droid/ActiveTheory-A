#!/usr/bin/env python3
"""Render the V1.1 Beauty and independent Core, Arms, Dust, and Halo layers."""

from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import bpy


CONFIRMATION = "GALAXY_HERO_V11_MULTILAYER"
COLLECTIONS = {
    "core": "GalaxyV11_Core",
    "arms": "GalaxyV11_Arms",
    "dust": "GalaxyV11_Dust",
    "halo": "GalaxyV11_Halo",
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--confirm-render", required=True)
    args = parser.parse_args(argv)
    if args.confirm_render != CONFIRMATION:
        raise RuntimeError("Invalid confirmation token for Galaxy Hero V1.1.")
    return args


def configure_optix(scene: bpy.types.Scene, config: dict) -> dict:
    render = config["render"]
    backend = str(render["backend"]).upper()
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = int(render["samples"])
    scene.cycles.use_denoising = bool(render["denoise"])
    scene.render.resolution_x = int(render["width"])
    scene.render.resolution_y = int(render["height"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    preferences = bpy.context.preferences.addons["cycles"].preferences
    preferences.compute_device_type = backend
    preferences.get_devices()
    devices = []
    for device in preferences.devices:
        device_type = str(device.type).upper()
        device.use = device_type == backend and "RTX 5060 Ti" in device.name
        devices.append({"name": device.name, "type": device_type, "enabled": bool(device.use)})
    active = [device for device in devices if device["enabled"]]
    if not active:
        raise RuntimeError(f"RTX 5060 Ti was not enabled through {backend}; CPU fallback is forbidden.")
    return {"backend": backend, "devices": devices, "activeGpuDevices": active}


def set_layer_visibility(visible_layers: set[str]) -> None:
    for layer, collection_name in COLLECTIONS.items():
        collection = bpy.data.collections.get(collection_name)
        if collection is None:
            raise RuntimeError(f"Missing V1.1 collection: {collection_name}")
        collection.hide_render = layer not in visible_layers


def set_dust_material(mask_mode: bool) -> None:
    dust = bpy.data.objects.get("GalaxyV11DustVolume")
    if dust is None:
        raise RuntimeError("GalaxyV11DustVolume is missing.")
    material_name = dust["maskMaterial"] if mask_mode else dust["beautyMaterial"]
    dust.data.materials.clear()
    dust.data.materials.append(bpy.data.materials[material_name])


def render_pass(scene: bpy.types.Scene, output_path: Path, visible_layers: set[str], transparent: bool, dust_mask: bool = False) -> float:
    set_layer_visibility(visible_layers)
    set_dust_material(dust_mask)
    scene.render.film_transparent = transparent
    scene.render.filepath = str(output_path)
    started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    return time.perf_counter() - started


def main() -> int:
    args = parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    if scene.get("galaxyHeroAssetVersion") != "v1.1":
        raise RuntimeError("Loaded scene is not Galaxy Hero Asset V1.1.")
    device_configuration = configure_optix(scene, config)
    started_at = datetime.now(timezone.utc)
    total_started = time.perf_counter()
    outputs = {
        "beauty": output_dir / "GALAXY_HERO_V11_PREVIEW.png",
        "core": output_dir / "GALAXY_HERO_V11_CORE_RGBA.png",
        "arms": output_dir / "GALAXY_HERO_V11_ARMS_RGBA.png",
        "dust": output_dir / "GALAXY_HERO_V11_DUST_MASK.png",
        "halo": output_dir / "GALAXY_HERO_V11_HALO_RGBA.png",
    }
    pass_seconds = {
        "beauty": render_pass(scene, outputs["beauty"], {"core", "arms", "dust", "halo"}, False),
        "core": render_pass(scene, outputs["core"], {"core"}, True),
        "arms": render_pass(scene, outputs["arms"], {"arms"}, True),
        "dust": render_pass(scene, outputs["dust"], {"dust"}, True, dust_mask=True),
        "halo": render_pass(scene, outputs["halo"], {"halo"}, True),
    }
    total_seconds = time.perf_counter() - total_started
    completed_at = datetime.now(timezone.utc)
    log = {
        "schemaVersion": config["schemaVersion"],
        "status": "complete",
        "scene": str(Path(bpy.data.filepath).resolve()),
        "engine": "CYCLES",
        "device": "GPU",
        "backend": device_configuration["backend"],
        "activeGpuDevices": device_configuration["activeGpuDevices"],
        "devices": device_configuration["devices"],
        "resolution": {"width": scene.render.resolution_x, "height": scene.render.resolution_y},
        "samples": scene.cycles.samples,
        "denoise": scene.cycles.use_denoising,
        "camera": scene.camera.name,
        "cameraAngleDegrees": scene["galaxyHeroCameraAngleDegrees"],
        "outputs": {name: str(path) for name, path in outputs.items()},
        "passSeconds": {name: round(seconds, 6) for name, seconds in pass_seconds.items()},
        "renderSeconds": round(total_seconds, 6),
        "host": platform.node(),
        "startedAt": started_at.isoformat(),
        "completedAt": completed_at.isoformat(),
    }
    (output_dir / "galaxy-hero-v11-render-log.json").write_text(
        json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(log, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
