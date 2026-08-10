"""Validate the locked Blender-to-Three handoff conversion."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from itertools import combinations
from pathlib import Path

from convert_handoff_to_three import (
    DEFAULT_BASELINE,
    DEFAULT_OUTPUT,
    ROOT,
    EXPECTED_BASELINE_SHA256,
    convert_baseline,
    load_baseline,
    serialize_payload,
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", default=str(DEFAULT_BASELINE))
    parser.add_argument("--three", default=str(DEFAULT_OUTPUT))
    parser.add_argument(
        "--output",
        default=str(ROOT / "art/hero-cinematic/handoff-alignment-v1/handoff-alignment-validation.json"),
    )
    return parser.parse_args()


def finite_tree(value):
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return True
    if isinstance(value, (int, float)):
        return math.isfinite(value)
    if isinstance(value, list):
        return all(finite_tree(item) for item in value)
    if isinstance(value, dict):
        return all(finite_tree(item) for item in value.values())
    return False


def distance(left, right):
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right)))


def main():
    args = parse_args()
    baseline_path = Path(args.baseline)
    three_path = Path(args.three)
    baseline, baseline_sha = load_baseline(baseline_path)
    three_bytes = three_path.read_bytes()
    three = json.loads(three_bytes.decode("utf-8"))
    run_one = convert_baseline(baseline, baseline_sha)
    run_two = convert_baseline(baseline, baseline_sha)
    serialized_one = serialize_payload(run_one)
    serialized_two = serialize_payload(run_two)
    checks = []

    def check(identifier, passed, actual=None, expected=None):
        checks.append({"id": identifier, "pass": bool(passed), "actual": actual, "expected": expected})

    quaternion = three["camera"]["quaternionXYZW"]
    quaternion_norm = math.sqrt(sum(value * value for value in quaternion))
    anchors = [three["entryAnchors"][name]["position"] for name in ("geo", "a5", "brandMind")]
    anchor_distances = [distance(left, right) for left, right in combinations(anchors, 2)]
    handoff = three["handoff"]
    output_sha = hashlib.sha256(three_bytes).hexdigest().upper()
    generated_sha = hashlib.sha256(serialized_one).hexdigest().upper()

    check("baselineSha256", baseline_sha == EXPECTED_BASELINE_SHA256, baseline_sha, EXPECTED_BASELINE_SHA256)
    check("finiteCoordinates", finite_tree(three), finite_tree(three), True)
    check("quaternionNormalized", abs(quaternion_norm - 1.0) <= 1e-8, round(quaternion_norm, 12), 1.0)
    check("cameraForwardAligned", three["camera"]["forwardAlignmentDot"] >= 0.999999, three["camera"]["forwardAlignmentDot"], ">= 0.999999")
    check("verticalFovReasonable", 20.0 <= three["camera"]["verticalFovDeg"] <= 90.0, three["camera"]["verticalFovDeg"], "20..90")
    check("entryAnchorsDistinct", min(anchor_distances) > 1.0, [round(value, 6) for value in anchor_distances], "> 1")
    check("galaxyAnchorsExist", all(three["galaxy"][name]["position"] for name in ("masterAnchor", "coreAnchor")))
    check("frameRange", [three["render"]["frameStart"], three["render"]["frameEnd"]] == [1, 240], [three["render"]["frameStart"], three["render"]["frameEnd"]], [1, 240])
    check("fps", three["render"]["fps"] == 30, three["render"]["fps"], 30)
    check("handoffMonotonic", 0 <= handoff["prepareStart"] <= handoff["blendStart"] <= handoff["blendEnd"] <= handoff["finalProgress"] <= 1, handoff)
    check("blendRangeLocked", [handoff["blendStart"], handoff["blendEnd"]] == [0.96, 1.0], [handoff["blendStart"], handoff["blendEnd"]], [0.96, 1.0])
    check("deterministicConversion", serialized_one == serialized_two)
    check("outputMatchesConversion", three_bytes == serialized_one, output_sha, generated_sha)
    check("outputShaStable", output_sha == generated_sha, output_sha, generated_sha)
    check("noNaNOrInfinity", all(token not in three_bytes for token in (b"NaN", b"Infinity", b"-Infinity")))

    payload = {
        "schemaVersion": "1.0.0",
        "passed": sum(1 for item in checks if item["pass"]),
        "failed": sum(1 for item in checks if not item["pass"]),
        "checks": checks,
        "sourceBaselineSha256": baseline_sha,
        "threeContractSha256": output_sha,
        "deterministicSha256": generated_sha,
        "cameraForwardAlignmentDot": three["camera"]["forwardAlignmentDot"],
        "cyclesOrOptixRenderExecuted": False,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(payload, ensure_ascii=False))
    if payload["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
