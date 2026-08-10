"""Convert the locked Blender handoff baseline into a Three.js contract."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path


EXPECTED_BASELINE_SHA256 = "E69F9447183BD925F9164091BAC7B0BBD098E38CD2DA1C6ED7BE4C848F294268"
BASIS_BLENDER_TO_THREE = (
    (1.0, 0.0, 0.0),
    (0.0, 0.0, 1.0),
    (0.0, -1.0, 0.0),
)
TARGET_RENDER_WIDTH = 1920
TARGET_RENDER_HEIGHT = 1080
HANDOFF_PREPARE_START = 0.88
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BASELINE = ROOT / "docs/hero-cinematic/blender-shot-v1/hero-handoff-baseline-v11.json"
DEFAULT_OUTPUT = ROOT / "docs/hero-cinematic/blender-shot-v1/hero-handoff-three-v11.json"
DEFAULT_PREVIEW_OUTPUT = ROOT / "art/hero-cinematic/handoff-alignment-v1/three-handoff-preview.json"
DEFAULT_JS_OUTPUT = ROOT / "src/hero-cinematic/hybrid/heroHandoffThreeV11.generated.js"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def load_baseline(path: Path) -> tuple[dict, str]:
    raw = path.read_bytes()
    return json.loads(raw.decode("utf-8")), sha256_bytes(raw)


def matrix_multiply(left, right):
    return tuple(
        tuple(sum(left[row][index] * right[index][column] for index in range(3)) for column in range(3))
        for row in range(3)
    )


def matrix_vector(matrix, vector):
    return tuple(sum(matrix[row][index] * vector[index] for index in range(3)) for row in range(3))


def normalize(vector):
    length = math.sqrt(sum(component * component for component in vector))
    if length <= 1e-12:
        raise ValueError("Cannot normalize a zero-length vector.")
    return tuple(component / length for component in vector)


def quaternion_wxyz_to_matrix(quaternion):
    w, x, y, z = normalize(tuple(float(value) for value in quaternion))
    return (
        (1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)),
        (2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)),
        (2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)),
    )


def matrix_to_quaternion_xyzw(matrix):
    m00, m01, m02 = matrix[0]
    m10, m11, m12 = matrix[1]
    m20, m21, m22 = matrix[2]
    trace = m00 + m11 + m22
    if trace > 0:
        scale = math.sqrt(trace + 1.0) * 2.0
        w = 0.25 * scale
        x = (m21 - m12) / scale
        y = (m02 - m20) / scale
        z = (m10 - m01) / scale
    elif m00 > m11 and m00 > m22:
        scale = math.sqrt(1.0 + m00 - m11 - m22) * 2.0
        w = (m21 - m12) / scale
        x = 0.25 * scale
        y = (m01 + m10) / scale
        z = (m02 + m20) / scale
    elif m11 > m22:
        scale = math.sqrt(1.0 + m11 - m00 - m22) * 2.0
        w = (m02 - m20) / scale
        x = (m01 + m10) / scale
        y = 0.25 * scale
        z = (m12 + m21) / scale
    else:
        scale = math.sqrt(1.0 + m22 - m00 - m11) * 2.0
        w = (m10 - m01) / scale
        x = (m02 + m20) / scale
        y = (m12 + m21) / scale
        z = 0.25 * scale
    result = normalize((x, y, z, w))
    if result[3] < 0:
        result = tuple(-component for component in result)
    return result


def round_vector(vector):
    return [round(float(component), 9) for component in vector]


def convert_position(position):
    return round_vector(matrix_vector(BASIS_BLENDER_TO_THREE, tuple(float(value) for value in position)))


def subtract(left, right):
    return tuple(float(a) - float(b) for a, b in zip(left, right))


def dot(left, right):
    return sum(a * b for a, b in zip(left, right))


def convert_anchor(anchor):
    payload = {
        "name": anchor["name"],
        "position": convert_position(anchor["position"]),
    }
    if "screenNormalized" in anchor:
        payload["sourceScreenNormalized"] = [round(float(value), 9) for value in anchor["screenNormalized"]]
    return payload


def convert_baseline(baseline: dict, baseline_sha256: str) -> dict:
    source_aspect = baseline["renderWidth"] / baseline["renderHeight"]
    target_aspect = TARGET_RENDER_WIDTH / TARGET_RENDER_HEIGHT
    if not math.isclose(source_aspect, target_aspect, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError(f"Baseline aspect {source_aspect} does not match target aspect {target_aspect}.")

    camera = baseline["camera"]
    blender_rotation = quaternion_wxyz_to_matrix(camera["quaternionWXYZ"])
    # Blender and Three cameras share local +Y up / -Z forward conventions.
    # Only the world basis changes, so the converted camera world rotation is B * R.
    three_rotation = matrix_multiply(BASIS_BLENDER_TO_THREE, blender_rotation)
    quaternion_xyzw = matrix_to_quaternion_xyzw(three_rotation)
    position = convert_position(camera["position"])
    target = convert_position(camera["target"])
    forward = normalize(matrix_vector(three_rotation, (0.0, 0.0, -1.0)))
    target_direction = normalize(subtract(target, position))
    alignment_dot = dot(forward, target_direction)

    result = {
        "schemaVersion": "1.0.0",
        "sourceBaselineVersion": "hero-handoff-baseline-v11",
        "sourceBaselineSha256": baseline_sha256,
        "coordinateSystem": {
            "source": "Blender right-handed Z-up; camera local +Y up and -Z forward",
            "target": "Three.js right-handed Y-up; camera local +Y up and -Z forward",
            "basisMatrixRowMajor": [list(row) for row in BASIS_BLENDER_TO_THREE],
            "positionRule": "[x, y, z] -> [x, z, -y]",
            "rotationRule": "R_three_world = basis_blender_to_three * R_blender_world",
            "quaternionOrder": "[x, y, z, w]",
        },
        "render": {
            "width": TARGET_RENDER_WIDTH,
            "height": TARGET_RENDER_HEIGHT,
            "aspect": round(target_aspect, 9),
            "sourcePreviewWidth": baseline["renderWidth"],
            "sourcePreviewHeight": baseline["renderHeight"],
            "fps": baseline["fps"],
            "frameStart": baseline["frameStart"],
            "frameEnd": baseline["frameEnd"],
            "duration": baseline["duration"],
        },
        "timeline": baseline["timeline"],
        "camera": {
            "name": camera["name"],
            "position": position,
            "quaternionXYZW": round_vector(quaternion_xyzw),
            "target": target,
            "forwardDirection": round_vector(forward),
            "targetDirection": round_vector(target_direction),
            "forwardAlignmentDot": round(alignment_dot, 12),
            "horizontalFovDeg": camera["fovHorizontalDegrees"],
            "verticalFovDeg": camera["fovVerticalDegrees"],
            "near": 0.1,
            "far": 1000.0,
        },
        "galaxy": {
            "masterAnchor": convert_anchor(baseline["galaxy"]["masterAnchor"]),
            "coreAnchor": convert_anchor(baseline["galaxy"]["coreAnchor"]),
        },
        "entryAnchors": {
            "geo": convert_anchor(baseline["entryAnchors"]["geo"]),
            "a5": convert_anchor(baseline["entryAnchors"]["a5"]),
            "brandMind": convert_anchor(baseline["entryAnchors"]["brandMind"]),
        },
        "handoff": {
            "prepareStart": HANDOFF_PREPARE_START,
            "blendStart": baseline["handoff"]["startProgress"],
            "blendEnd": baseline["handoff"]["endProgress"],
            "finalProgress": baseline["handoff"]["finalProgress"],
        },
    }
    return result


def serialize_payload(payload: dict) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n").encode("utf-8")


def write_payload(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(serialize_payload(payload))


def write_javascript(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False)
    source = (
        "// Generated by tools/hero-cinematic-blender/convert_handoff_to_three.py.\n"
        "// Do not edit handoff values manually.\n"
        "function deepFreeze(value) {\n"
        "  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;\n"
        "  Object.values(value).forEach(deepFreeze);\n"
        "  return Object.freeze(value);\n"
        "}\n\n"
        f"export const HERO_HANDOFF_THREE_V11 = deepFreeze({json_text});\n"
    )
    path.write_text(source, encoding="utf-8", newline="\n")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_BASELINE))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--preview-output", default=str(DEFAULT_PREVIEW_OUTPUT))
    parser.add_argument("--js-output", default=str(DEFAULT_JS_OUTPUT))
    return parser.parse_args()


def main():
    args = parse_args()
    baseline, baseline_sha = load_baseline(Path(args.input))
    if baseline_sha != EXPECTED_BASELINE_SHA256:
        raise SystemExit(f"Baseline SHA-256 mismatch: {baseline_sha}")
    payload = convert_baseline(baseline, baseline_sha)
    output = Path(args.output)
    write_payload(output, payload)
    if args.preview_output:
        write_payload(Path(args.preview_output), payload)
    if args.js_output:
        write_javascript(Path(args.js_output), payload)
    print(json.dumps({
        "status": "ok",
        "output": str(output.resolve()),
        "sha256": sha256_bytes(serialize_payload(payload)),
        "forwardAlignmentDot": payload["camera"]["forwardAlignmentDot"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
