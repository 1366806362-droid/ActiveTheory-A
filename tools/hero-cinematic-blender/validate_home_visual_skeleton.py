#!/usr/bin/env python3
"""Validate the Home Visual Asset Skeleton and its locked handoff inputs."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy


GALAXY_COLLECTIONS = (
    "GALAXY_BULGE",
    "GALAXY_ARMS",
    "GALAXY_STAR_DISK",
    "GALAXY_DUST_LANES",
    "GALAXY_NEBULA",
    "GALAXY_HALO",
)
FLOW_NAMES = (
    "FLOW_MAIN_01",
    "FLOW_MAIN_02",
    "FLOW_SUPPORT_01",
    "FLOW_SUPPORT_02",
)
MATERIAL_NAMES = (
    "MAT_GALAXY_CORE",
    "MAT_GALAXY_STAR",
    "MAT_DUST",
    "MAT_NEBULA",
    "MAT_FLOW_PARTICLE",
    "MAT_NEAR_STAR",
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--camera-config", required=True)
    parser.add_argument("--three-contract", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def load_json(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_file(path: str | Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def close_vector(left, right, tolerance=1e-5) -> bool:
    return len(left) == len(right) and all(abs(float(a) - float(b)) <= tolerance for a, b in zip(left, right))


def quaternion_matches(left, right, tolerance=1e-5) -> bool:
    return close_vector(left, right, tolerance) or close_vector(left, [-value for value in right], tolerance)


def curve_coordinates(name: str) -> list[list[float]]:
    obj = bpy.data.objects.get(name)
    if not obj or obj.type != "CURVE":
        return []
    coordinates = []
    for spline in obj.data.splines:
        if spline.type == "BEZIER":
            coordinates.extend([[round(float(value), 6) for value in point.co] for point in spline.bezier_points])
        else:
            coordinates.extend([[round(float(value), 6) for value in point.co[:3]] for point in spline.points])
    return coordinates


def nested_vectors_match(actual: list[list[float]], expected: list[list[float]], tolerance=2e-5) -> bool:
    return len(actual) == len(expected) and all(close_vector(left, right, tolerance) for left, right in zip(actual, expected))


def mesh_thickness(object_names: list[str]) -> float:
    values = []
    for name in object_names:
        obj = bpy.data.objects.get(name)
        if not obj or obj.type != "MESH":
            continue
        values.extend(float(vertex.co.z) for vertex in obj.data.vertices)
    return max(values) - min(values) if values else 0.0


def main() -> int:
    args = parse_args()
    config = load_json(args.config)
    baseline = load_json(args.baseline)
    camera_config = load_json(args.camera_config)
    checks = []

    def check(identifier, passed, actual=None, expected=None, blocking=True):
        checks.append({
            "id": identifier,
            "pass": bool(passed),
            "actual": actual,
            "expected": expected,
            "blocking": blocking,
        })

    scene = bpy.context.scene
    preset_name = scene.get("visualSkeletonPreset")
    preset = config["presets"].get(preset_name, {})
    collections = {collection.name: collection for collection in bpy.data.collections}
    check("galaxySixCollections", all(name in collections for name in GALAXY_COLLECTIONS), sorted(name for name in GALAXY_COLLECTIONS if name in collections), list(GALAXY_COLLECTIONS))
    check("galaxyCollectionsPopulated", all(len(collections[name].objects) > 0 for name in GALAXY_COLLECTIONS if name in collections))

    arm_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("SPIRAL_ARM_STARS_"))
    guide_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("SPIRAL_ARM_GUIDE_"))
    check("spiralArmCount", len(arm_names) == config["galaxy"]["armCount"], len(arm_names), config["galaxy"]["armCount"])
    check("spiralArmGuides", len(guide_names) == config["galaxy"]["armCount"], guide_names)
    phases = [float(bpy.data.objects[name].get("phaseOffset", 0)) for name in arm_names]
    phase_gaps = [round((phases[(index + 1) % len(phases)] - phases[index]) % math.tau, 6) for index in range(len(phases))] if phases else []
    check("spiralArmsNotPerfectlySymmetric", len(set(phase_gaps)) > 1, phase_gaps, "non-uniform phase gaps")

    thickness_names = ["GALAXY_BULGE_STARS", "GALAXY_STAR_DISK_STARS", "GALAXY_HALO_STARS"] + arm_names
    thickness = mesh_thickness(thickness_names)
    check("galaxyNonZeroThickness", thickness > 0.5, round(thickness, 6), "> 0.5")
    bulge_thickness = mesh_thickness(["GALAXY_BULGE_STARS"])
    disk_thickness = mesh_thickness(["GALAXY_STAR_DISK_STARS"])
    check("coreThickerThanOuterDisk", bulge_thickness > disk_thickness, [round(bulge_thickness, 6), round(disk_thickness, 6)], "bulge > disk")

    dust_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("DUST_LANE_"))
    check("dustLaneStructure", len(dust_names) == config["dustLanes"]["count"], dust_names)
    check("dustLanesOffsetFromArms", all(abs(float(bpy.data.objects[name].get("armOffset", 0))) > 0.1 for name in dust_names))
    nebula_anchors = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("NEBULA_REGION_") and not obj.name.endswith("_PROXY"))
    check("nebulaAnchors", len(nebula_anchors) == len(config["nebulaRegions"]), nebula_anchors)
    check("nebulaParameters", all(all(key in bpy.data.objects[name] for key in ("density", "emission", "temperatureBias", "noiseScale", "scaleReference")) for name in nebula_anchors))

    far_slot = bpy.data.objects.get("FAR_STAR_FIELD_ASSET_SLOT")
    mid_slot = bpy.data.objects.get("MID_STAR_FIELD_ASSET_SLOT")
    check("farStarSlot", far_slot is not None and bpy.data.objects.get("PROXY_FAR_STARS") is not None)
    check("midStarSlot", mid_slot is not None and bpy.data.objects.get("PROXY_MID_STARS") is not None)
    check("starPresetCounts", bool(far_slot and mid_slot and far_slot["companyCount"] == config["starFields"]["far"]["companyCount"] and far_slot["homeCount"] == config["starFields"]["far"]["homeCount"] and mid_slot["companyCount"] == config["starFields"]["mid"]["companyCount"] and mid_slot["homeCount"] == config["starFields"]["mid"]["homeCount"]))

    near_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("PATH_NEAR_PASS_"))
    check("nearPassCount", len(near_names) == config["nearPass"]["count"], len(near_names), config["nearPass"]["count"])
    check("nearPassAssetSlots", all(all(key in bpy.data.objects[name] for key in ("size", "brightness", "temperature", "trailStrength", "motionBlurWeight")) for name in near_names))
    check("nearPassMotionBlurOffCompany", preset_name != "companySkeleton" or all(not bpy.data.objects[name]["motionBlurEnabledCompany"] for name in near_names))

    actual_flows = sorted(name for name in FLOW_NAMES if bpy.data.objects.get(name))
    particle_flows = sorted(obj.get("sourceCurve") for obj in bpy.data.objects if obj.name.startswith("FLOW_PARTICLES_"))
    check("cosmicFlowPaths", actual_flows == sorted(FLOW_NAMES), actual_flows, sorted(FLOW_NAMES))
    check("cosmicFlowParticles", particle_flows == sorted(FLOW_NAMES), particle_flows, sorted(FLOW_NAMES))
    check("flowCurvesHiddenForFormalRender", all(bpy.data.objects[name].hide_render and not bpy.data.objects[name]["curveVisibleInFormalRender"] for name in FLOW_NAMES))
    check("flowParameterSlots", all(all(key in bpy.data.objects[name] for key in ("particleCountCompany", "particleCountHome", "spreadRadius", "speed", "brightness", "sizeVariation", "flowNoise", "depthScatter")) for name in FLOW_NAMES))

    check("materialTemplates", all(bpy.data.materials.get(name) is not None for name in MATERIAL_NAMES), sorted(name for name in MATERIAL_NAMES if bpy.data.materials.get(name)))
    check("randomSeedFixed", scene.get("visualSkeletonSeed") == config["seed"], scene.get("visualSkeletonSeed"), config["seed"])
    company = config["presets"]["companySkeleton"]
    home = config["presets"]["homeLookdev"]
    separated = company["galaxyStarCount"] != home["galaxyStarCount"] and not company["volumeEnabled"] and home["volumeEnabled"] and not company["motionBlur"] and home["motionBlur"] and not company["cycles"] and home["cycles"]
    check("companyHomePresetsSeparated", separated)
    check("activePresetRecorded", preset_name in config["presets"], preset_name)

    expected_camera_path = [[round(float(value), 6) for value in point] for point in camera_config["camera"]["pathPoints"]]
    expected_target_path = [[round(float(value), 6) for value in point] for point in camera_config["camera"]["targetPathPoints"]]
    check("cameraPathUnchanged", nested_vectors_match(curve_coordinates("PATH_CAMERA_POSITION"), expected_camera_path), curve_coordinates("PATH_CAMERA_POSITION"), expected_camera_path)
    check("lookAtPathUnchanged", nested_vectors_match(curve_coordinates("PATH_CAMERA_TARGET"), expected_target_path), curve_coordinates("PATH_CAMERA_TARGET"), expected_target_path)
    check("timelineUnchanged", [scene.frame_start, scene.frame_end, scene.render.fps] == [1, 240, 30], [scene.frame_start, scene.frame_end, scene.render.fps], [1, 240, 30])

    scene.frame_set(240)
    bpy.context.view_layer.update()
    camera = bpy.data.objects.get(baseline["camera"]["name"])
    target = bpy.data.objects.get("TARGET_CAMERA_LOOK")
    camera_position = list(camera.matrix_world.translation) if camera else []
    camera_quaternion = list(camera.matrix_world.to_quaternion()) if camera else []
    target_position = list(target.matrix_world.translation) if target else []
    check("finalCameraPosition", close_vector(camera_position, baseline["camera"]["position"]), camera_position, baseline["camera"]["position"])
    check("finalCameraQuaternion", quaternion_matches(camera_quaternion, baseline["camera"]["quaternionWXYZ"]), camera_quaternion, baseline["camera"]["quaternionWXYZ"])
    check("finalCameraTarget", close_vector(target_position, baseline["camera"]["target"]), target_position, baseline["camera"]["target"])
    check("finalCameraFov", abs(math.degrees(camera.data.angle_x) - baseline["camera"]["fovHorizontalDegrees"]) <= 1e-5, math.degrees(camera.data.angle_x), baseline["camera"]["fovHorizontalDegrees"])

    entry_map = {"geo": "ANCHOR_GEO", "a5": "ANCHOR_5A", "brandMind": "ANCHOR_BRAND_MIND"}
    entry_results = {}
    entries_ok = True
    for key, object_name in entry_map.items():
        actual = list(bpy.data.objects[object_name].matrix_world.translation)
        expected = baseline["entryAnchors"][key]["position"]
        entry_results[key] = {"actual": actual, "expected": expected, "pass": close_vector(actual, expected)}
        entries_ok = entries_ok and entry_results[key]["pass"]
    check("entryAnchorsUnchanged", entries_ok, entry_results)
    galaxy_position = list(bpy.data.objects["GALAXY_MASTER_ANCHOR"].matrix_world.translation)
    check("galaxyAnchorUnchanged", close_vector(galaxy_position, baseline["galaxy"]["masterAnchor"]["position"]), galaxy_position, baseline["galaxy"]["masterAnchor"]["position"])
    check("handoffLocked", baseline["handoff"] == {"startProgress": 0.96, "endProgress": 1.0, "finalProgress": 1.0}, baseline["handoff"])

    check("baselineSha256", sha256_file(args.baseline) == config["lockedInputs"]["baselineSha256"], sha256_file(args.baseline), config["lockedInputs"]["baselineSha256"])
    check("threeContractSha256", sha256_file(args.three_contract) == config["lockedInputs"]["threeContractSha256"], sha256_file(args.three_contract), config["lockedInputs"]["threeContractSha256"])
    check("legacyDiscNotUsed", scene.get("legacyGalaxyProxyUsed") is False and bpy.data.objects.get("GALAXY_PROXY_DISC") is not None and bpy.data.objects["GALAXY_PROXY_DISC"].hide_render)
    check("companyDidNotUseCycles", preset_name != "companySkeleton" or scene.render.engine != "CYCLES", scene.render.engine, "not CYCLES")
    check("cyclesOrOptixNotExecuted", scene.get("cyclesOrOptixExecuted") is False, scene.get("cyclesOrOptixExecuted"), False)
    check("onlyAllowedDebugRenders", int(scene.get("debugWorkbenchRenderCount", 0)) <= 3, int(scene.get("debugWorkbenchRenderCount", 0)), "<= 3")

    failed = [item for item in checks if item["blocking"] and not item["pass"]]
    report = {
        "schemaVersion": "1.0.0",
        "passed": len(checks) - len(failed),
        "failed": len(failed),
        "checks": checks,
        "preset": preset_name,
        "galaxyThickness": round(thickness, 6),
        "bulgeThickness": round(bulge_thickness, 6),
        "diskThickness": round(disk_thickness, 6),
        "spiralArmCount": len(arm_names),
        "dustLaneCount": len(dust_names),
        "nebulaRegionCount": len(nebula_anchors),
        "nearPassCount": len(near_names),
        "cosmicFlowCount": len(actual_flows),
        "cyclesOrOptixExecuted": False,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
