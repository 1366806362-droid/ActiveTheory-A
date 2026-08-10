#!/usr/bin/env python3
"""Inspect Blender Cycles devices without rendering."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    preferences = bpy.context.preferences.addons["cycles"].preferences
    errors = []
    try:
        preferences.compute_device_type = "OPTIX"
        preferences.get_devices()
    except Exception as error:  # Blender versions expose device backends differently.
        errors.append(str(error))
    devices = [
        {"name": device.name, "type": device.type, "enabled": bool(device.use)}
        for device in preferences.devices
    ]
    report = {
        "schemaVersion": "1.0.0",
        "blenderVersion": bpy.app.version_string,
        "devices": devices,
        "nvidiaVisible": any("NVIDIA" in item["name"].upper() for item in devices),
        "optixAvailable": any(item["type"] == "OPTIX" for item in devices),
        "errors": errors,
        "renderExecuted": False,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
