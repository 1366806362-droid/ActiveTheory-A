#!/usr/bin/env python3
"""Tiny standard-library mock used to validate the Rapid Beauty Gate lifecycle."""

from __future__ import annotations

import argparse
import json
import struct
import time
import zlib
from pathlib import Path


def write_placeholder_png(path: Path, width: int, height: int) -> None:
    signature = b"\x89PNG\r\n\x1a\n"

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    rows = bytearray()
    width_scale = max(width - 1, 1)
    height_scale = max(height - 1, 1)
    for y in range(height):
        rows.append(0)
        for x in range(width):
            horizontal = x / width_scale
            vertical = y / height_scale
            glow = max(0.0, 1.0 - abs(horizontal - 0.7) * 2.8 - abs(vertical - 0.45) * 2.2)
            rows.extend((
                int(2 + glow * 22),
                int(8 + glow * 90),
                int(20 + glow * 125),
            ))
    payload = signature
    payload += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    payload += chunk(b"IDAT", zlib.compress(bytes(rows), 6))
    payload += chunk(b"IEND", b"")
    path.write_bytes(payload)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--visual-gate-stage", choices=("build", "render"), required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    args.output_directory.mkdir(parents=True, exist_ok=True)
    behavior = config.get("mockBehavior", "success")

    if args.visual_gate_stage == "build":
        if behavior == "builder-error":
            print("Mock builder failure requested.")
            return 3
        (args.output_directory / ".mock-build-ready").write_text("ready\n", encoding="utf-8")
        return 0

    delay = float(config.get("mockDelaySeconds", 0))
    if delay > 0:
        time.sleep(delay)
    if behavior == "error":
        print("Mock renderer failure requested.")
        return 4

    write_placeholder_png(
        args.output_directory / config["outputFile"],
        int(config["resolutionX"]),
        int(config["resolutionY"]),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
