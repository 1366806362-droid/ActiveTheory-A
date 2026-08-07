"""Export Hero handoff values from the evaluated Blender scene."""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view


def args_after_separator():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    return parser.parse_args(argv)


def vector(value):
    return [round(float(component), 6) for component in value]


def object_payload(name):
    obj = bpy.data.objects[name]
    return {"name": name, "position": vector(obj.matrix_world.translation)}


def export_metadata(output):
    scene = bpy.context.scene
    timeline = json.loads(scene["timelineJson"])
    company = json.loads(scene["companyPresetJson"])
    camera = scene.camera
    target = bpy.data.objects["TARGET_CAMERA_LOOK"]
    scene.frame_set(scene.frame_end)
    bpy.context.view_layer.update()
    camera_eval = camera.evaluated_get(bpy.context.evaluated_depsgraph_get())
    target_eval = target.evaluated_get(bpy.context.evaluated_depsgraph_get())
    quaternion = camera_eval.matrix_world.to_quaternion()

    def anchor(name):
        obj = bpy.data.objects[name]
        screen = world_to_camera_view(scene, camera_eval, obj.matrix_world.translation)
        payload = object_payload(name)
        payload["screenNormalized"] = [round(float(screen.x), 6), round(float(screen.y), 6)]
        return payload

    payload = {
        "schemaVersion": scene["heroCinematicSchemaVersion"],
        "fps": scene.render.fps,
        "frameStart": scene.frame_start,
        "frameEnd": scene.frame_end,
        "duration": round((scene.frame_end - scene.frame_start + 1) / scene.render.fps, 6),
        "renderWidth": company["renderWidth"],
        "renderHeight": company["renderHeight"],
        "coordinateSystem": {"source": "Blender Z-up, camera looks local -Z", "target": "Three.js Y-up"},
        "camera": {
            "name": camera.name,
            "position": vector(camera_eval.matrix_world.translation),
            "quaternionWXYZ": vector((quaternion.w, quaternion.x, quaternion.y, quaternion.z)),
            "fovDegrees": round(math.degrees(camera.data.angle), 6),
            "fovAxis": "sensor-fit-dependent",
            "fovHorizontalDegrees": round(math.degrees(camera.data.angle_x), 6),
            "fovVerticalDegrees": round(math.degrees(camera.data.angle_y), 6),
            "target": vector(target_eval.matrix_world.translation),
        },
        "galaxy": {
            "masterAnchor": anchor("GALAXY_MASTER_ANCHOR"),
            "coreAnchor": anchor("GALAXY_CORE_ANCHOR"),
        },
        "entryAnchors": {
            "geo": anchor("ANCHOR_GEO"),
            "a5": anchor("ANCHOR_5A"),
            "brandMind": anchor("ANCHOR_BRAND_MIND"),
        },
        "timeline": timeline["stages"],
        "handoff": {"startProgress": 0.96, "endProgress": 1.0, "finalProgress": 1.0},
        "sourceScene": Path(bpy.data.filepath).name,
    }
    path = Path(output).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": "ok", "output": str(path)}, ensure_ascii=False))
    return payload


if __name__ == "__main__":
    args = args_after_separator()
    export_metadata(args.output)
