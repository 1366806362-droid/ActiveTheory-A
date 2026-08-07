"""Validate the generated Hero Cinematic V2 skeleton without rendering."""

import argparse
import json
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    return parser.parse_args(argv)


def camera_position(frame):
    scene = bpy.context.scene
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    camera = scene.camera.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return camera.matrix_world.translation.copy()


def average_motion(start, end):
    positions = [camera_position(frame) for frame in range(start, end + 1)]
    distances = [(b - a).length for a, b in zip(positions, positions[1:])]
    return sum(distances) / max(1, len(distances))


def travel_metrics(start, end):
    positions = [camera_position(frame) for frame in range(start, end + 1)]
    path_distance = sum((b - a).length for a, b in zip(positions, positions[1:]))
    displacement = (positions[-1] - positions[0]).length
    return {
        "frames": [start, end],
        "displacement": round(displacement, 6),
        "pathDistance": round(path_distance, 6),
    }


def galaxy_screen_coverage(frame):
    scene = bpy.context.scene
    scene.frame_set(frame)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    camera = scene.camera.evaluated_get(depsgraph)
    galaxy = bpy.data.objects["GALAXY_PROXY_DISC"].evaluated_get(depsgraph)
    mesh = galaxy.to_mesh()
    try:
        points = [world_to_camera_view(scene, camera, galaxy.matrix_world @ vertex.co) for vertex in mesh.vertices]
    finally:
        galaxy.to_mesh_clear()
    front = [point for point in points if point.z > 0]
    if not front:
        return {"frame": frame, "status": "offscreen", "viewportCoverageEstimate": 0.0}
    min_x = min(point.x for point in front)
    max_x = max(point.x for point in front)
    min_y = min(point.y for point in front)
    max_y = max(point.y for point in front)
    width = max(0.0, min(1.0, max_x) - max(0.0, min_x))
    height = max(0.0, min(1.0, max_y) - max(0.0, min_y))
    projected_width = max(0.0, max_x - min_x)
    projected_height = max(0.0, max_y - min_y)
    projected_area = projected_width * projected_height
    visible_area = width * height
    if width == 0.0 or height == 0.0:
        status = "offscreen"
    elif min_x >= 0.0 and max_x <= 1.0 and min_y >= 0.0 and max_y <= 1.0:
        status = "full"
    else:
        status = "partial"
    return {
        "frame": frame,
        "status": status,
        "viewportCoverageEstimate": round(visible_area, 6),
        "outsideFractionEstimate": round(1.0 - visible_area / projected_area, 6) if projected_area else 1.0,
        "projectedBounds": [round(min_x, 6), round(min_y, 6), round(max_x, 6), round(max_y, 6)],
    }


def visible_near_pass_count(frame):
    scene = bpy.context.scene
    scene.frame_set(frame)
    return sum(
        1 for obj in bpy.data.objects
        if obj.name.startswith("PATH_NEAR_PASS_") and not obj.hide_render
    )


def action_fcurves(action):
    if not action:
        return []
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for channelbag in getattr(strip, "channelbags", []):
                curves.extend(channelbag.fcurves)
    return curves


def main():
    args = parse_args()
    scene = bpy.context.scene
    company = json.loads(scene["companyPresetJson"])
    home = json.loads(scene["homePresetJson"])
    checks = []

    def check(identifier, passed, actual=None, expected=None):
        checks.append({"id": identifier, "pass": bool(passed), "actual": actual, "expected": expected})

    check("cameraExists", scene.camera is not None and scene.camera.name == "CAM_HERO_MASTER")
    check("frameRange", (scene.frame_start, scene.frame_end) == (1, 240), [scene.frame_start, scene.frame_end], [1, 240])
    check("fps", scene.render.fps == 30, scene.render.fps, 30)
    check("cameraPathExists", bpy.data.objects.get("PATH_CAMERA_POSITION") is not None)
    check("targetExists", bpy.data.objects.get("TARGET_CAMERA_LOOK") is not None)
    check("galaxyAnchorExists", bpy.data.objects.get("GALAXY_MASTER_ANCHOR") is not None)
    entry_names = ["ANCHOR_GEO", "ANCHOR_5A", "ANCHOR_BRAND_MIND"]
    check("entryAnchorsExist", all(bpy.data.objects.get(name) for name in entry_names))
    near_count = len([obj for obj in bpy.data.objects if obj.name.startswith("PATH_NEAR_PASS_")])
    check("nearPassCount", 8 <= near_count <= 16, near_count, "8..16")
    flow_names = sorted(obj.name for obj in bpy.data.objects if obj.name.startswith("FLOW_"))
    flow_count = len(flow_names)
    check("cosmicFlowCount", 3 <= flow_count <= 6, flow_count, "3..6")
    check("cosmicFlowStructure", flow_names == ["FLOW_MAIN_01", "FLOW_MAIN_02", "FLOW_SUPPORT_01", "FLOW_SUPPORT_02"], flow_names)
    metadata_path = Path(args.metadata).resolve()
    check("handoffMetadataExists", metadata_path.is_file(), str(metadata_path))
    camera_action = scene.camera.data.animation_data.action if scene.camera.data.animation_data else None
    check("finalCameraKeyframe", bool(camera_action and any(abs(k.co.x - 240) < 0.01 for f in action_fcurves(camera_action) for k in f.keyframe_points)))
    approach_motion = average_motion(198, 226)
    handoff_motion = average_motion(227, 240)
    check("handoffMotionStabilized", handoff_motion < approach_motion * 0.55, round(handoff_motion, 8), f"< {approach_motion * 0.55:.8f}")
    check("companyPreset", company["engine"] == "BLENDER_EEVEE" and company["renderWidth"] <= 1280 and company["samples"] <= 16, company)
    check("homePresetPresentNotExecuted", home["engine"] == "CYCLES" and home["computeBackend"] == "OPTIX" and not home["executed"], home)
    check("noCyclesOrOptixExecution", scene.render.engine != "CYCLES" and not scene["cyclesOrOptixExecuted"], scene.render.engine, "not CYCLES")
    collections = sorted(collection.name for collection in bpy.data.collections if collection.name.startswith("HERO_"))
    check("collectionStructure", all(name in collections for name in [
        "HERO_CAMERAS", "HERO_BACKGROUND", "HERO_FAR_STARS", "HERO_MID_STARS",
        "HERO_NEAR_PASS", "HERO_COSMIC_FLOW", "HERO_GALAXY", "HERO_DUST",
        "HERO_VOLUMES", "HERO_LIGHTS", "HERO_HANDOFF", "HERO_DEBUG"
    ]), collections)
    travel_segments = {
        "immenseSpace": travel_metrics(1, 29),
        "initialTravel": travel_metrics(30, 77),
        "acceleration": travel_metrics(78, 144),
        "discovery": travel_metrics(145, 197),
        "approach": travel_metrics(198, 226),
        "handoff": travel_metrics(227, 240),
    }
    galaxy_coverage = {str(frame): galaxy_screen_coverage(frame) for frame in [1, 78, 145, 198, 240]}
    near_distribution = {str(frame): visible_near_pass_count(frame) for frame in [1, 30, 78, 145, 198, 227, 240]}
    check("earlyCameraTravel", travel_segments["immenseSpace"]["pathDistance"] > 5.0, travel_segments["immenseSpace"])
    check("initialTravelVisible", travel_segments["initialTravel"]["pathDistance"] > 10.0, travel_segments["initialTravel"])
    check("galaxyNotFullyVisibleAtStart", galaxy_coverage["1"]["status"] != "full", galaxy_coverage["1"])
    check("galaxyDiscoveryPartial", galaxy_coverage["145"]["status"] == "partial", galaxy_coverage["145"])
    check(
        "galaxyFinalLargePartial",
        galaxy_coverage["240"]["status"] == "partial"
        and galaxy_coverage["240"]["viewportCoverageEstimate"] >= 0.2
        and galaxy_coverage["240"]["outsideFractionEstimate"] >= 0.3,
        galaxy_coverage["240"],
    )
    check("nearPassHandoffClean", near_distribution["227"] == 0 and near_distribution["240"] == 0, near_distribution)
    payload = {
        "schemaVersion": "1.0.0",
        "blendFile": Path(bpy.data.filepath).name,
        "passed": sum(1 for item in checks if item["pass"]),
        "failed": sum(1 for item in checks if not item["pass"]),
        "checks": checks,
        "motion": {"approachAveragePerFrame": approach_motion, "handoffAveragePerFrame": handoff_motion},
        "cameraTravelDistance": travel_segments,
        "galaxyScreenCoverageEstimate": galaxy_coverage,
        "nearPassVisibleCount": near_distribution,
        "cyclesOrOptixExecuted": False,
    }
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    if payload["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
