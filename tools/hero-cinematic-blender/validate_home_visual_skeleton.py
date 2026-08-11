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
STAR_TIER_ORDER = ("micro", "medium", "hero")


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


def geometry_thickness(object_names: list[str]) -> float:
    values = []
    for name in object_names:
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        if obj.type == "MESH":
            values.extend(float(vertex.co.z) for vertex in obj.data.vertices)
        elif obj.type == "POINTCLOUD":
            values.extend(float(point.co.z) for point in obj.data.points)
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

    bulge_star_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("GALAXY_BULGE_STARS_"))
    disk_star_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("GALAXY_STAR_DISK_STARS_"))
    halo_star_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("GALAXY_HALO_STARS_"))
    arm_point_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("SPIRAL_ARM_POINTS_"))
    thickness_names = bulge_star_names + disk_star_names + halo_star_names + arm_point_names
    thickness = geometry_thickness(thickness_names)
    check("galaxyNonZeroThickness", thickness > 0.5, round(thickness, 6), "> 0.5")
    bulge_thickness = geometry_thickness(bulge_star_names)
    disk_thickness = geometry_thickness(disk_star_names)
    check("coreThickerThanOuterDisk", bulge_thickness > disk_thickness, [round(bulge_thickness, 6), round(disk_thickness, 6)], "bulge > disk")

    dust_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("DUST_LANE_") and obj.type == "CURVE")
    check("dustLaneStructure", len(dust_names) == config["dustLanes"]["count"], dust_names)
    check("dustLanesOffsetFromArms", all(abs(float(bpy.data.objects[name].get("armOffset", 0))) > 0.1 for name in dust_names))
    nebula_anchors = sorted(name for name in (region["name"] for region in config["nebulaRegions"]) if bpy.data.objects.get(name))
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
    check("flowParameterSlots", all(all(key in bpy.data.objects[name] for key in ("particleCountCompany", "particleCountHome", "spreadRadius", "speed", "brightness", "sizeVariation", "flowNoise", "depthScatter", "dropout")) for name in FLOW_NAMES))

    check("materialTemplates", all(bpy.data.materials.get(name) is not None for name in MATERIAL_NAMES), sorted(name for name in MATERIAL_NAMES if bpy.data.materials.get(name)))
    galaxy_point_clouds = [bpy.data.objects[name] for name in bulge_star_names + disk_star_names + halo_star_names + arm_point_names]
    check(
        "v12NativePointCloudStars",
        preset_name != "homeLookdev" or (galaxy_point_clouds and all(obj.type == "POINTCLOUD" for obj in galaxy_point_clouds)),
        sorted({obj.type for obj in galaxy_point_clouds}), "POINTCLOUD",
    )
    star_tiers = sorted({str(obj.get("starTier")) for obj in galaxy_point_clouds})
    check("v12ThreeStarTiers", preset_name != "homeLookdev" or star_tiers == sorted(STAR_TIER_ORDER), star_tiers, sorted(STAR_TIER_ORDER))
    proxy_names = ("PROXY_FAR_STARS", "PROXY_MID_STARS")
    proxy_hidden = all(bpy.data.objects.get(name) and bpy.data.objects[name].hide_render for name in proxy_names)
    triangle_cloud_visible = [
        obj.name for obj in bpy.data.objects
        if obj.type == "MESH" and obj.get("pointCount") and not obj.hide_render
    ]
    check("v12TriangleProxiesHidden", preset_name != "homeLookdev" or (proxy_hidden and not triangle_cloud_visible), triangle_cloud_visible, [])
    dust_volumes = [obj for obj in bpy.data.objects if obj.name.startswith("DUST_LANE_VOLUME_")]
    expected_dust_volumes = config["dustLanes"]["count"] * config["dustLanes"]["volumeSegmentsPerLane"]
    check("v12VisibleDustVolumes", preset_name != "homeLookdev" or (len(dust_volumes) == expected_dust_volumes and all(not obj.hide_render for obj in dust_volumes)), len(dust_volumes), expected_dust_volumes)
    nebula_volumes = [obj for obj in bpy.data.objects if obj.name.startswith("NEBULA_REGION_") and obj.name.endswith("_VOLUME")]
    check("v12VisibleNebulaVolumes", preset_name != "homeLookdev" or (len(nebula_volumes) == len(config["nebulaRegions"]) and all(not obj.hide_render for obj in nebula_volumes)), len(nebula_volumes), len(config["nebulaRegions"]))
    background_clouds = [obj for obj in bpy.data.objects if obj.name.startswith("HOME_FAR_STARS_") or obj.name.startswith("HOME_MID_STARS_")]
    check("v12DeepSpacePointFields", preset_name != "homeLookdev" or (len(background_clouds) == 6 and all(obj.type == "POINTCLOUD" for obj in background_clouds)), len(background_clouds), 6)
    flow_clouds = [obj for obj in bpy.data.objects if obj.name.startswith("FLOW_PARTICLES_")]
    flow_point_count = sum(int(obj.get("pointCount", 0)) for obj in flow_clouds)
    check("v12SparsePointFlow", preset_name != "homeLookdev" or (len(flow_clouds) == len(FLOW_NAMES) and all(obj.type == "POINTCLOUD" for obj in flow_clouds) and flow_point_count < 4000), flow_point_count, "< 4000")
    near_stars = [obj for obj in bpy.data.objects if obj.name.startswith("NEAR_PASS_STAR_")]
    check("v12NearPassPointStars", preset_name != "homeLookdev" or (len(near_stars) == len(config["nearPass"]["visiblePathIndicesFrame145"]) and all(obj.type == "POINTCLOUD" for obj in near_stars) and all(bpy.data.objects[name].hide_render for name in near_names)), len(near_stars), len(config["nearPass"]["visiblePathIndicesFrame145"]))
    core_volume = bpy.data.objects.get("GALAXY_CORE_GLOW_VOLUME")
    deep_space_ok = bool(scene.world and scene.world.use_nodes and scene.view_settings.view_transform == "AgX" and scene.view_settings.exposure < 0.0)
    check("v12CoreAndDeepSpace", preset_name != "homeLookdev" or (core_volume is not None and not core_volume.hide_render and deep_space_ok), {"coreVolume": core_volume is not None, "viewTransform": scene.view_settings.view_transform, "exposure": scene.view_settings.exposure})

    tier_config = config["galaxy"]["starTiers"]
    check(
        "v12SubPixelStarRadii",
        preset_name != "homeLookdev" or (
            tier_config["micro"]["radiusRange"] == [0.003, 0.009]
            and tier_config["medium"]["radiusRange"] == [0.018, 0.043]
            and tier_config["hero"]["radiusRange"] == [0.07, 0.15]
        ),
        {name: tier_config[name]["radiusRange"] for name in STAR_TIER_ORDER},
    )
    check(
        "v12HeroStarsScarce",
        preset_name != "homeLookdev" or (
            float(tier_config["micro"]["ratio"]) >= 0.95 and float(tier_config["hero"]["ratio"]) <= 0.001
        ),
        {name: tier_config[name]["ratio"] for name in STAR_TIER_ORDER},
    )
    arm_envelopes = [obj for obj in bpy.data.objects if obj.name.startswith("GALAXY_ARM_LIGHT_ENVELOPE_")]
    expected_envelopes = config["galaxy"]["armCount"] * config["galaxy"]["armLightEnvelope"]["segmentsPerArm"]
    check(
        "v12ContinuousArmLightEnvelope",
        preset_name != "homeLookdev" or (
            len(arm_envelopes) == expected_envelopes
            and all(not obj.hide_render and obj.get("continuousArmEnvelope") for obj in arm_envelopes)
        ),
        len(arm_envelopes), expected_envelopes,
    )
    diffuse_point_count = sum(int(bpy.data.objects[name].get("pointCount", 0)) for name in disk_star_names + halo_star_names)
    diffuse_planned_count = int(preset.get("galaxyStarCount", 0) * (config["galaxy"]["layerRatios"]["starDisk"] + config["galaxy"]["layerRatios"]["halo"]))
    check("v12RightEdgeDiffuseThinned", preset_name != "homeLookdev" or diffuse_point_count < diffuse_planned_count, diffuse_point_count, f"< {diffuse_planned_count}")
    outer_core = bpy.data.objects.get("GALAXY_CORE_OUTER_VOLUME")
    check("v12WarmCoreFalloff", preset_name != "homeLookdev" or bool(outer_core and outer_core.get("neutralOuterFalloff") and not outer_core.hide_render), outer_core.name if outer_core else None)
    core_dust = [obj for obj in bpy.data.objects if obj.name.startswith("DUST_CORE_VOLUME_")]
    check("v12CoreForegroundDust", preset_name != "homeLookdev" or (len(core_dust) == config["dustLanes"]["coreVolumeCount"] and all(obj.get("coreForegroundDust") for obj in core_dust)), len(core_dust), config["dustLanes"]["coreVolumeCount"])
    volume_materials = [material for material in bpy.data.materials if material.get("localizedNoiseVolume")]
    check("v12VolumeNoiseContrast", preset_name != "homeLookdev" or (volume_materials and all(material.get("noiseContrast") for material in volume_materials)), len(volume_materials), "> 0, all contrast-shaped")
    background_radius_max = max((max(obj.get("radiusRange", [0.0])) for obj in background_clouds), default=0.0)
    check("v12BackgroundStarsReduced", preset_name != "homeLookdev" or background_radius_max <= 0.066, background_radius_max, "<= 0.066")
    near_radius_max = max((max(obj.get("radiusRange", [0.0])) for obj in near_stars), default=0.0)
    check("v12NearPassReduced", preset_name != "homeLookdev" or (len(near_stars) <= 2 and near_radius_max <= 0.045), {"count": len(near_stars), "maxRadius": near_radius_max}, {"count": "<= 2", "maxRadius": "<= 0.045"})
    check("v12SceneVersion", preset_name != "homeLookdev" or scene.get("homeLookdevVersion") == "v1.2", scene.get("homeLookdevVersion"), "v1.2")
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
        "schemaVersion": "1.2.0",
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
        "galaxyPointCount": sum(int(obj.get("pointCount", 0)) for obj in galaxy_point_clouds),
        "totalPointCount": sum(int(obj.get("pointCount", 0)) for obj in bpy.data.objects if obj.type == "POINTCLOUD"),
        "volumeCount": sum(1 for obj in bpy.data.objects if obj.get("localizedVolume")),
        "armEnvelopeCount": len(arm_envelopes),
        "cyclesOrOptixExecuted": False,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
