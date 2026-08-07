"""Build a deterministic, preview-safe Hero Cinematic V2 Blender skeleton."""

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


COLLECTIONS = [
    "HERO_CAMERAS", "HERO_BACKGROUND", "HERO_FAR_STARS", "HERO_MID_STARS",
    "HERO_NEAR_PASS", "HERO_COSMIC_FLOW", "HERO_GALAXY", "HERO_DUST",
    "HERO_VOLUMES", "HERO_LIGHTS", "HERO_HANDOFF", "HERO_DEBUG",
]
PREVIEW_FRAMES = [1, 30, 78, 145, 198, 240]


def script_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--art-dir", required=True)
    parser.add_argument("--render-preview", action="store_true")
    return parser.parse_args(argv)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for datablocks in (bpy.data.curves, bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            datablocks.remove(block)


def make_collections():
    result = {}
    root = bpy.context.scene.collection
    for name in COLLECTIONS:
        collection = bpy.data.collections.new(name)
        root.children.link(collection)
        result[name] = collection
    return result


def link_object(obj, collection):
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def material(name, color, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.metallic = 0.0
    mat.roughness = 0.72
    mat["previewEmissionReference"] = emission
    return mat


def bezier_curve(name, points, collection, bevel=0.0, material_ref=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 8
    data.bevel_resolution = 1
    data.bevel_depth = bevel
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    if material_ref:
        data.materials.append(material_ref)
    return obj


def add_follow_path(obj, path, frames, factors):
    constraint = obj.constraints.new("FOLLOW_PATH")
    constraint.name = f"FOLLOW_{path.name}"
    constraint.target = path
    constraint.use_fixed_location = True
    constraint.use_curve_follow = False
    for frame, factor in zip(frames, factors):
        constraint.offset_factor = factor
        constraint.keyframe_insert("offset_factor", frame=frame)
    tune_animation(obj)
    return constraint


def tune_animation(obj):
    animation = obj.animation_data
    if not animation or not animation.action:
        return
    for fcurve in action_fcurves(animation.action):
        for key in fcurve.keyframe_points:
            key.interpolation = "BEZIER"
            key.easing = "EASE_IN_OUT"


def set_constant_animation(obj):
    animation = obj.animation_data
    if not animation or not animation.action:
        return
    for fcurve in action_fcurves(animation.action):
        for key in fcurve.keyframe_points:
            key.interpolation = "CONSTANT"


def action_fcurves(action):
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for channelbag in getattr(strip, "channelbags", []):
                curves.extend(channelbag.fcurves)
    return curves


def fov_to_lens(sensor_width, fov_degrees):
    return sensor_width / (2.0 * math.tan(math.radians(fov_degrees) / 2.0))


def create_camera(config, collections):
    camera_config = config["camera"]
    camera_path = bezier_curve(
        "PATH_CAMERA_POSITION", camera_config["pathPoints"], collections["HERO_CAMERAS"]
    )
    target_path = bezier_curve(
        "PATH_CAMERA_TARGET", camera_config["targetPathPoints"], collections["HERO_CAMERAS"]
    )
    camera_data = bpy.data.cameras.new(camera_config["name"])
    camera_data.sensor_width = camera_config["sensorWidthMm"]
    camera = bpy.data.objects.new(camera_config["name"], camera_data)
    collections["HERO_CAMERAS"].objects.link(camera)
    target = bpy.data.objects.new("TARGET_CAMERA_LOOK", None)
    target.empty_display_type = "SPHERE"
    target.empty_display_size = 1.2
    collections["HERO_CAMERAS"].objects.link(target)
    add_follow_path(camera, camera_path, camera_config["keyframes"], camera_config["pathFactors"])
    add_follow_path(target, target_path, camera_config["keyframes"], camera_config["targetFactors"])
    track = camera.constraints.new("TRACK_TO")
    track.name = "TRACK_CAMERA_TARGET"
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    for frame, fov in zip(camera_config["keyframes"], camera_config["fovDegrees"]):
        camera_data.lens = fov_to_lens(camera_data.sensor_width, fov)
        camera_data.keyframe_insert("lens", frame=frame)
    tune_animation(camera_data)
    bpy.context.scene.camera = camera
    return camera, target


def triangle_star_mesh(name, count, bounds, rng, collection, size, mat):
    vertices, faces = [], []
    for _ in range(count):
        x = rng.uniform(bounds[0][0], bounds[0][1])
        y = rng.uniform(bounds[1][0], bounds[1][1])
        z = rng.uniform(bounds[2][0], bounds[2][1])
        radius = size * rng.uniform(0.45, 1.35)
        base = len(vertices)
        vertices.extend([(x - radius, y, z), (x + radius, y, z), (x, y, z + radius * 1.7)])
        faces.append((base, base + 1, base + 2))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def create_star_proxies(config, collections, rng, materials):
    proxy = config["proxy"]
    triangle_star_mesh(
        "PROXY_FAR_STARS", proxy["farStarCount"],
        ((-90, 90), (15, 210), (-30, 65)), rng,
        collections["HERO_FAR_STARS"], 0.055, materials["far"]
    )
    triangle_star_mesh(
        "PROXY_MID_STARS", proxy["midStarCount"],
        ((-55, 65), (5, 150), (-12, 48)), rng,
        collections["HERO_MID_STARS"], 0.11, materials["mid"]
    )


def create_near_passes(config, collections, rng, mat):
    count = config["proxy"]["nearPassCount"]
    schedules = config["proxy"]["nearPassSchedules"]
    for index in range(count):
        start = Vector((rng.uniform(-24, 24), rng.uniform(-5, 36), rng.uniform(0, 28)))
        end = start + Vector((rng.uniform(10, 30), rng.uniform(45, 85), rng.uniform(-5, 8)))
        middle = start.lerp(end, 0.52) + Vector((rng.uniform(-5, 5), 0, rng.uniform(-2, 3)))
        path = bezier_curve(
            f"PATH_NEAR_PASS_{index + 1:02d}", [start, middle, end],
            collections["HERO_NEAR_PASS"], bevel=0.018, material_ref=mat
        )
        start_frame, end_frame = schedules[index]
        path["activeFrameStart"] = start_frame
        path["activeFrameEnd"] = end_frame
        path.hide_render = True
        path.keyframe_insert("hide_render", frame=max(1, start_frame - 1))
        path.hide_render = False
        path.keyframe_insert("hide_render", frame=start_frame)
        path.keyframe_insert("hide_render", frame=end_frame)
        path.hide_render = True
        path.keyframe_insert("hide_render", frame=min(240, end_frame + 1))
        set_constant_animation(path)


def create_cosmic_flows(config, collections, mat):
    templates = [
        ("FLOW_MAIN_01", [(-72, 12, -15), (-46, 55, -4), (-8, 104, 14), (51, 157, 31)]),
        ("FLOW_MAIN_02", [(-58, 8, 24), (-36, 50, 28), (-2, 102, 30), (57, 161, 36)]),
        ("FLOW_SUPPORT_01", [(-82, 42, 48), (-55, 78, 45), (-18, 118, 40), (48, 166, 39)]),
        ("FLOW_SUPPORT_02", [(38, 18, -25), (30, 64, -13), (34, 112, 9), (62, 157, 27)])
    ]
    for name, points in templates[:config["proxy"]["cosmicFlowCount"]]:
        bezier_curve(
            name, points,
            collections["HERO_COSMIC_FLOW"], bevel=0.035, material_ref=mat
        )


def create_galaxy_proxy(config, collections, camera, materials):
    scene = bpy.context.scene
    scene.frame_set(config["timeline"]["frameEnd"])
    bpy.context.view_layer.update()
    local = Vector(config["proxy"]["galaxyLocal"])
    world = camera.matrix_world @ local
    master = bpy.data.objects.new("GALAXY_MASTER_ANCHOR", None)
    master.empty_display_type = "CIRCLE"
    master.empty_display_size = 4.0
    master.location = world
    collections["HERO_GALAXY"].objects.link(master)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=8, location=(0.0, 0.0, 0.0))
    proxy = link_object(bpy.context.object, collections["HERO_GALAXY"])
    proxy.name = "GALAXY_PROXY_DISC"
    proxy.scale = config["proxy"]["galaxyScale"]
    proxy.rotation_euler = tuple(math.radians(value) for value in config["proxy"]["galaxyRotationDegrees"])
    proxy.data.materials.append(materials["galaxy"])
    proxy.parent = master
    proxy.location = (0.0, 0.0, 0.0)
    for name, offset in (
        ("GALAXY_CORE_ANCHOR", (0.0, 0.0, 0.0)),
        ("GALAXY_ARM_ANCHOR", (18.0, -4.0, 1.5)),
        ("GALAXY_DUST_ANCHOR", (-14.0, 5.0, -1.0)),
    ):
        anchor = bpy.data.objects.new(name, None)
        anchor.empty_display_type = "SPHERE"
        anchor.empty_display_size = 2.0
        anchor.location = offset
        anchor.parent = master
        collections["HERO_GALAXY"].objects.link(anchor)
    return master


def create_entry_anchors(config, collections, camera):
    scene = bpy.context.scene
    scene.frame_set(config["timeline"]["frameEnd"])
    bpy.context.view_layer.update()
    names = {"geo": "ANCHOR_GEO", "a5": "ANCHOR_5A", "brandMind": "ANCHOR_BRAND_MIND"}
    for key, local in config["proxy"]["entryAnchorsCameraLocal"].items():
        anchor = bpy.data.objects.new(names[key], None)
        anchor.empty_display_type = "SPHERE"
        anchor.empty_display_size = 1.8
        anchor.location = camera.matrix_world @ Vector(local)
        anchor["cameraLocalReference"] = list(local)
        collections["HERO_HANDOFF"].objects.link(anchor)


def create_placeholders(config, collections, materials):
    for name, location, scale in (
        ("VOLUME_DEEP_SPACE", (0, 85, 18), (65, 95, 42)),
        ("VOLUME_GALAXY_APPROACH", (38, 142, 27), (32, 28, 18)),
    ):
        bpy.ops.mesh.primitive_cube_add(size=2, location=location)
        obj = link_object(bpy.context.object, collections["HERO_VOLUMES"])
        obj.name = name
        obj.scale = scale
        obj.display_type = "WIRE"
        obj.hide_render = True
        obj["previewSafe"] = True
    for name, location in (("DUST_FOREGROUND", (0, 45, 10)), ("DUST_GALAXY", (36, 134, 27))):
        obj = bpy.data.objects.new(name, None)
        obj.empty_display_type = "CUBE"
        obj.empty_display_size = 8.0
        obj.location = location
        collections["HERO_DUST"].objects.link(obj)
    light_specs = [
        ("LIGHT_GALAXY_CORE", "POINT", (42, 146, 30), 80.0, (0.65, 0.82, 1.0)),
        ("LIGHT_AMBIENT_COLD", "AREA", (0, 60, 40), 25.0, (0.45, 0.65, 1.0)),
        ("LIGHT_RIM_SPACE", "AREA", (-30, 90, 12), 18.0, (0.55, 0.8, 1.0)),
    ]
    for name, kind, location, energy, color in light_specs:
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.color = color
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        collections["HERO_LIGHTS"].objects.link(obj)


def configure_scene(config):
    scene = bpy.context.scene
    timeline = config["timeline"]
    company = config["companyPreview"]
    scene.frame_start = timeline["frameStart"]
    scene.frame_end = timeline["frameEnd"]
    scene.render.fps = timeline["fps"]
    scene.render.engine = company["engine"]
    scene.render.resolution_x = company["renderWidth"]
    scene.render.resolution_y = company["renderHeight"]
    scene.render.resolution_percentage = company["resolutionPercentage"]
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.0015, 0.003, 0.008)
    scene["heroCinematicSchemaVersion"] = config["schemaVersion"]
    scene["timelineJson"] = json.dumps(timeline, ensure_ascii=False, sort_keys=True)
    scene["companyPresetJson"] = json.dumps(company, ensure_ascii=False, sort_keys=True)
    scene["homePresetJson"] = json.dumps(config["homeRender"], ensure_ascii=False, sort_keys=True)
    scene["homeRenderExecuted"] = False
    scene["cyclesOrOptixExecuted"] = False
    scene["scrollProgressMapping"] = "frame = 1 + progress * 239"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.background_type = "WORLD"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True


def render_previews(config, art_dir):
    scene = bpy.context.scene
    original_engine = scene.render.engine
    scene.render.engine = config["companyPreview"]["previewRenderEngine"]
    for frame in PREVIEW_FRAMES:
        scene.frame_set(frame)
        scene.render.filepath = str(art_dir / f"frame-v11-{frame:03d}.png")
        bpy.ops.render.render(write_still=True)
    scene.render.engine = original_engine
    scene.frame_set(config["timeline"]["frameEnd"])


def render_path_overview(config, art_dir, collections, materials):
    scene = bpy.context.scene
    master_camera = scene.camera
    original_engine = scene.render.engine
    original_frame = scene.frame_current
    visibility = {}
    curve_depths = {}
    path_materials = {
        "PATH_CAMERA_POSITION": materials["camera_path"],
        "PATH_CAMERA_TARGET": materials["target_path"],
    }
    for name, mat in path_materials.items():
        obj = bpy.data.objects[name]
        curve_depths[name] = obj.data.bevel_depth
        obj.data.bevel_depth = 0.18
        if not obj.data.materials:
            obj.data.materials.append(mat)
    for obj in bpy.data.objects:
        if obj.name.startswith("PATH_NEAR_PASS_") or obj.name.startswith("FLOW_"):
            visibility[obj.name] = obj.hide_render
            obj.hide_render = False

    marker_specs = [
        ("DEBUG_GALAXY", "GALAXY_MASTER_ANCHOR", 4.0, materials["galaxy_marker"]),
        ("DEBUG_GEO", "ANCHOR_GEO", 2.4, materials["anchor_geo"]),
        ("DEBUG_5A", "ANCHOR_5A", 2.4, materials["anchor_a5"]),
        ("DEBUG_BRAND_MIND", "ANCHOR_BRAND_MIND", 2.4, materials["anchor_brand"]),
    ]
    markers = []
    for debug_name, source_name, radius, mat in marker_specs:
        source = bpy.data.objects[source_name]
        marker_location = source.matrix_world.translation.copy()
        marker_location.z += 4.0 if source_name == "GALAXY_MASTER_ANCHOR" else 12.0
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=radius, location=marker_location)
        marker = link_object(bpy.context.object, collections["HERO_DEBUG"])
        marker.name = debug_name
        marker.data.materials.append(mat)
        markers.append(marker)

    camera_data = bpy.data.cameras.new("CAM_PATH_OVERVIEW")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 220.0
    overview_camera = bpy.data.objects.new("CAM_PATH_OVERVIEW", camera_data)
    overview_camera.location = (5.0, 82.0, 210.0)
    direction = Vector((5.0, 82.0, 14.0)) - overview_camera.location
    overview_camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    collections["HERO_DEBUG"].objects.link(overview_camera)
    scene.camera = overview_camera
    scene.render.engine = config["companyPreview"]["previewRenderEngine"]
    scene.render.filepath = str(art_dir / "camera-path-overview.png")
    bpy.ops.render.render(write_still=True)

    scene.camera = master_camera
    scene.render.engine = original_engine
    scene.frame_set(original_frame)
    for name, depth in curve_depths.items():
        bpy.data.objects[name].data.bevel_depth = depth
    for name, hidden in visibility.items():
        bpy.data.objects[name].hide_render = hidden
    for marker in markers:
        marker.hide_render = True
    overview_camera.hide_render = True


def main():
    args = script_args()
    config_path = Path(args.config).resolve()
    output_path = Path(args.output).resolve()
    art_dir = Path(args.art_dir).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    art_dir.mkdir(parents=True, exist_ok=True)
    reset_scene()
    collections = make_collections()
    configure_scene(config)
    rng = random.Random(config["seed"])
    materials = {
        "far": material("MAT_FAR_STARS", (0.34, 0.48, 0.72)),
        "mid": material("MAT_MID_STARS", (0.56, 0.82, 0.95)),
        "near": material("MAT_NEAR_PASS", (0.72, 0.93, 1.0)),
        "flow": material("MAT_COSMIC_FLOW", (0.12, 0.42, 0.62)),
        "galaxy": material("MAT_GALAXY_PROXY", (0.16, 0.28, 0.58)),
        "camera_path": material("MAT_CAMERA_PATH", (0.22, 0.92, 0.52)),
        "target_path": material("MAT_TARGET_PATH", (0.96, 0.62, 0.18)),
        "galaxy_marker": material("MAT_GALAXY_MARKER", (0.32, 0.48, 0.92)),
        "anchor_geo": material("MAT_ANCHOR_GEO", (0.15, 0.92, 0.95)),
        "anchor_a5": material("MAT_ANCHOR_5A", (0.72, 0.38, 0.95)),
        "anchor_brand": material("MAT_ANCHOR_BRAND", (0.95, 0.62, 0.3)),
    }
    camera, _target = create_camera(config, collections)
    create_star_proxies(config, collections, rng, materials)
    create_near_passes(config, collections, rng, materials["near"])
    create_cosmic_flows(config, collections, materials["flow"])
    create_galaxy_proxy(config, collections, camera, materials)
    create_entry_anchors(config, collections, camera)
    create_placeholders(config, collections, materials)
    bpy.context.scene.frame_set(config["timeline"]["frameEnd"])
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path))
    if args.render_preview:
        render_previews(config, art_dir)
        render_path_overview(config, art_dir, collections, materials)
        bpy.ops.wm.save_as_mainfile(filepath=str(output_path))
    print(json.dumps({
        "status": "ok", "output": str(output_path), "collections": COLLECTIONS,
        "previewFrames": PREVIEW_FRAMES, "engine": bpy.context.scene.render.engine,
        "cyclesOrOptixExecuted": False
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
