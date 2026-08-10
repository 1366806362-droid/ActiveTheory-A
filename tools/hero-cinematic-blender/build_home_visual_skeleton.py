#!/usr/bin/env python3
"""Build deterministic Hero V2 visual asset slots without starting a final render."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.geometry import interpolate_bezier


GALAXY_COLLECTIONS = (
    "GALAXY_BULGE",
    "GALAXY_ARMS",
    "GALAXY_STAR_DISK",
    "GALAXY_DUST_LANES",
    "GALAXY_NEBULA",
    "GALAXY_HALO",
)
EXTRA_COLLECTIONS = (
    "HOME_VISUAL_STAR_FIELDS",
    "HOME_VISUAL_COSMIC_FLOW",
    "HOME_VISUAL_DEBUG",
)
MATERIAL_NAMES = (
    "MAT_GALAXY_CORE",
    "MAT_GALAXY_STAR",
    "MAT_DUST",
    "MAT_NEBULA",
    "MAT_FLOW_PARTICLE",
    "MAT_NEAR_STAR",
)
FLOW_NAMES = (
    "FLOW_MAIN_01",
    "FLOW_MAIN_02",
    "FLOW_SUPPORT_01",
    "FLOW_SUPPORT_02",
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--camera-config", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--art-dir", required=True)
    parser.add_argument("--preset", choices=("companySkeleton", "homeLookdev"), default="companySkeleton")
    parser.add_argument("--render-debug", action="store_true")
    return parser.parse_args(argv)


def load_json(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha256_file(path: str | Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def rounded_vector(vector) -> list[float]:
    return [round(float(value), 7) for value in vector]


def object_curve_signature(names: list[str] | tuple[str, ...]) -> str:
    payload = []
    for name in sorted(names):
        obj = bpy.data.objects.get(name)
        if not obj or obj.type != "CURVE":
            payload.append({"name": name, "missing": True})
            continue
        splines = []
        for spline in obj.data.splines:
            if spline.type == "BEZIER":
                points = [
                    {
                        "co": rounded_vector(point.co),
                        "left": rounded_vector(point.handle_left),
                        "right": rounded_vector(point.handle_right),
                    }
                    for point in spline.bezier_points
                ]
            else:
                points = [rounded_vector(point.co) for point in spline.points]
            splines.append({"type": spline.type, "points": points})
        payload.append({
            "name": name,
            "matrixWorld": [rounded_vector(row) for row in obj.matrix_world],
            "splines": splines,
            "activeFrameStart": obj.get("activeFrameStart"),
            "activeFrameEnd": obj.get("activeFrameEnd"),
        })
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest().upper()


def remove_collection(name: str) -> None:
    collection = bpy.data.collections.get(name)
    if not collection:
        return
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)


def make_collections() -> dict[str, bpy.types.Collection]:
    for name in GALAXY_COLLECTIONS + EXTRA_COLLECTIONS:
        remove_collection(name)
    root = bpy.context.scene.collection
    collections = {}
    for name in GALAXY_COLLECTIONS + EXTRA_COLLECTIONS:
        collection = bpy.data.collections.new(name)
        root.children.link(collection)
        collections[name] = collection
    return collections


def link_object(obj: bpy.types.Object, collection: bpy.types.Collection) -> bpy.types.Object:
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def basic_material(name: str, color: tuple[float, float, float], emission: float = 0.0) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing:
        bpy.data.materials.remove(existing)
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    material.use_fake_user = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = 0.68
    emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
    if emission_input:
        emission_input.default_value = (*color, 1.0)
    strength_input = shader.inputs.get("Emission Strength")
    if strength_input:
        strength_input.default_value = emission
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material["templateOnly"] = True
    material["homeEmissionReference"] = emission
    return material


def create_materials(config: dict) -> dict[str, bpy.types.Material]:
    params = config["materials"]
    colors = {
        "MAT_GALAXY_CORE": ((0.74, 0.81, 0.92), params["emissionStrength"]),
        "MAT_GALAXY_STAR": ((0.34, 0.54, 0.78), params["emissionStrength"] * 0.55),
        "MAT_DUST": ((0.055, 0.045, 0.07), 0.0),
        "MAT_NEBULA": ((0.18, 0.28, 0.42), params["nebulaEmission"]),
        "MAT_FLOW_PARTICLE": ((0.12, 0.42, 0.58), params["emissionStrength"] * 0.18),
        "MAT_NEAR_STAR": ((0.66, 0.82, 0.94), params["emissionStrength"] * 0.7),
    }
    result = {}
    for name in MATERIAL_NAMES:
        color, emission = colors[name]
        material = basic_material(name, color, emission)
        material["emissionStrength"] = float(params["emissionStrength"])
        material["blackbodyTemperature"] = float(params["blackbodyTemperature"])
        material["dustAbsorption"] = float(params["dustAbsorption"])
        material["volumeDensity"] = float(params["volumeDensity"])
        material["anisotropy"] = float(params["anisotropy"])
        material["nebulaEmission"] = float(params["nebulaEmission"])
        material["starBrightnessRange"] = list(params["starBrightnessRange"])
        result[name] = material
    return result


def create_triangle_cloud(
    name: str,
    positions: list[tuple[float, float, float]],
    sizes: list[float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    seed: int,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    vertices = []
    faces = []
    for position, size in zip(positions, sizes):
        x, y, z = position
        base = len(vertices)
        vertices.extend([
            (x - size, y, z - size * 0.55),
            (x + size, y, z - size * 0.55),
            (x, y, z + size),
        ])
        faces.append((base, base + 1, base + 2))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = parent
    obj["generatorSeed"] = seed
    obj["pointCount"] = len(positions)
    obj["nonZeroThickness"] = True
    return obj


def create_poly_curve(
    name: str,
    points: list[tuple[float, float, float]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    parent: bpy.types.Object | None = None,
    bevel: float = 0.0,
) -> bpy.types.Object:
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 4
    data.bevel_depth = bevel
    data.bevel_resolution = 1
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    data.materials.append(material)
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.parent = parent
    return obj


def distribute_counts(total: int, ratios: dict) -> dict[str, int]:
    keys = ["bulge", "arms", "starDisk", "halo"]
    result = {key: int(total * float(ratios[key])) for key in keys}
    result["arms"] += total - sum(result.values())
    return result


def make_galaxy_root(config: dict, collections: dict) -> bpy.types.Object:
    master = bpy.data.objects.get("GALAXY_MASTER_ANCHOR")
    if not master:
        raise RuntimeError("Locked GALAXY_MASTER_ANCHOR is missing.")
    root = bpy.data.objects.new("GALAXY_VISUAL_ROOT", None)
    collections["GALAXY_STAR_DISK"].objects.link(root)
    root.parent = master
    root.rotation_euler = tuple(math.radians(value) for value in config["galaxy"]["orientationDegrees"])
    root["assetSlot"] = "HOME_LOOKDEV_GALAXY"
    root["usesLegacyDisc"] = False
    proxy = bpy.data.objects.get("GALAXY_PROXY_DISC")
    if proxy:
        proxy.hide_render = True
        proxy.hide_viewport = True
        proxy["replacedByVisualSkeleton"] = True
    return root


def bulge_positions(count: int, galaxy: dict, rng: random.Random) -> tuple[list, list]:
    positions, sizes = [], []
    for _ in range(count):
        radius = min(abs(rng.gauss(0.0, galaxy["bulgeRadius"] * 0.42)), galaxy["bulgeRadius"])
        angle = rng.random() * math.tau
        vertical_scale = max(0.12, 1.0 - radius / galaxy["bulgeRadius"])
        positions.append((
            math.cos(angle) * radius,
            math.sin(angle) * radius * 0.82,
            rng.gauss(0.0, galaxy["bulgeHeight"] * 0.28 * vertical_scale + 0.3),
        ))
        sizes.append(rng.uniform(0.18, 0.48))
    return positions, sizes


def disk_positions(count: int, galaxy: dict, rng: random.Random) -> tuple[list, list]:
    positions, sizes = [], []
    for _ in range(count):
        radial_ratio = math.sqrt(rng.random())
        radius = galaxy["diskRadius"] * radial_ratio
        angle = rng.random() * math.tau
        thickness = galaxy["diskThickness"] * (0.16 + 0.84 * (1.0 - radial_ratio) ** 1.7)
        positions.append((radius * math.cos(angle), radius * math.sin(angle), rng.gauss(0.0, thickness * 0.28)))
        sizes.append(rng.uniform(0.11, 0.28))
    return positions, sizes


def spiral_coordinate(galaxy: dict, arm_index: int, progress: float, noise: float = 0.0) -> tuple[float, float, float]:
    phase = galaxy["armPhaseOffsets"][arm_index]
    radial_scale = galaxy["armRadialScales"][arm_index]
    radius = (galaxy["bulgeRadius"] * 0.58 + progress * (galaxy["diskRadius"] - galaxy["bulgeRadius"] * 0.35)) * radial_scale
    angle = phase + galaxy["armTwist"] * (progress ** 0.86) + noise
    return radius * math.cos(angle), radius * math.sin(angle), 0.0


def arm_positions(count: int, galaxy: dict, arm_index: int, rng: random.Random) -> tuple[list, list]:
    positions, sizes = [], []
    for _ in range(count):
        progress = rng.random()
        angular_noise = rng.gauss(0.0, galaxy["armNoise"] * (0.4 + progress))
        x, y, _ = spiral_coordinate(galaxy, arm_index, progress, angular_noise)
        spread = galaxy["armSpread"] * galaxy["diskRadius"] * (0.18 + 0.82 * progress)
        radial_angle = math.atan2(y, x)
        radial_offset = rng.gauss(0.0, spread * 0.18)
        x += math.cos(radial_angle) * radial_offset
        y += math.sin(radial_angle) * radial_offset
        thickness = galaxy["diskThickness"] * (0.28 + 0.72 * (1.0 - progress))
        positions.append((x, y, rng.gauss(0.0, thickness * 0.24)))
        sizes.append(rng.uniform(0.12, 0.34) * (1.1 - progress * 0.28))
    return positions, sizes


def halo_positions(count: int, galaxy: dict, rng: random.Random) -> tuple[list, list]:
    positions, sizes = [], []
    for _ in range(count):
        radius = galaxy["diskRadius"] * rng.uniform(0.72, 1.28)
        theta = rng.random() * math.tau
        vertical = rng.gauss(0.0, galaxy["diskThickness"] * 1.35)
        positions.append((math.cos(theta) * radius, math.sin(theta) * radius, vertical))
        sizes.append(rng.uniform(0.08, 0.22))
    return positions, sizes


def create_galaxy_layers(config: dict, preset: dict, collections: dict, materials: dict, rng: random.Random) -> dict:
    galaxy = config["galaxy"]
    root = make_galaxy_root(config, collections)
    counts = distribute_counts(int(preset["galaxyStarCount"]), galaxy["layerRatios"])
    layer_builders = {
        "bulge": ("GALAXY_BULGE_STARS", "GALAXY_BULGE", "MAT_GALAXY_CORE", bulge_positions),
        "starDisk": ("GALAXY_STAR_DISK_STARS", "GALAXY_STAR_DISK", "MAT_GALAXY_STAR", disk_positions),
        "halo": ("GALAXY_HALO_STARS", "GALAXY_HALO", "MAT_GALAXY_STAR", halo_positions),
    }
    for index, (key, spec) in enumerate(layer_builders.items()):
        name, collection_name, material_name, builder = spec
        positions, sizes = builder(counts[key], galaxy, rng)
        create_triangle_cloud(name, positions, sizes, collections[collection_name], materials[material_name], config["seed"] + index, root)

    arm_total = counts["arms"]
    base_per_arm = arm_total // galaxy["armCount"]
    remaining = arm_total - base_per_arm * galaxy["armCount"]
    for arm_index in range(galaxy["armCount"]):
        arm_count = base_per_arm + (1 if arm_index < remaining else 0)
        positions, sizes = arm_positions(arm_count, galaxy, arm_index, rng)
        cloud = create_triangle_cloud(
            f"SPIRAL_ARM_STARS_{arm_index + 1:02d}", positions, sizes,
            collections["GALAXY_ARMS"], materials["MAT_GALAXY_STAR"],
            config["seed"] + 100 + arm_index, root,
        )
        cloud["armIndex"] = arm_index + 1
        cloud["phaseOffset"] = galaxy["armPhaseOffsets"][arm_index]
        guide_points = [spiral_coordinate(galaxy, arm_index, step / 47) for step in range(48)]
        guide = create_poly_curve(
            f"SPIRAL_ARM_GUIDE_{arm_index + 1:02d}", guide_points,
            collections["GALAXY_ARMS"], materials["MAT_GALAXY_STAR"], root,
        )
        guide.hide_render = True
        guide["guideOnly"] = True

    create_dust_lanes(config, collections, materials, root)
    create_nebula_regions(config, collections, materials, root)
    return {"root": root, "counts": counts}


def create_dust_lanes(config: dict, collections: dict, materials: dict, root: bpy.types.Object) -> None:
    galaxy = config["galaxy"]
    dust = config["dustLanes"]
    for lane_index in range(dust["count"]):
        arm_index = lane_index % galaxy["armCount"]
        points = []
        for step in range(44):
            progress = step / 43
            x, y, _ = spiral_coordinate(galaxy, arm_index, progress, 0.035 * math.sin(step * 0.73 + lane_index))
            angle = math.atan2(y, x)
            offset = dust["radialOffsets"][lane_index]
            points.append((
                x + math.cos(angle) * offset,
                y + math.sin(angle) * offset,
                dust["verticalOffsets"][lane_index] + math.sin(progress * 9 + lane_index) * 0.22,
            ))
        lane = create_poly_curve(
            f"DUST_LANE_{lane_index + 1:02d}", points,
            collections["GALAXY_DUST_LANES"], materials["MAT_DUST"], root,
        )
        lane.hide_render = True
        lane["assetSlotOnly"] = True
        lane["laneWidth"] = dust["widths"][lane_index]
        lane["density"] = dust["density"][lane_index]
        lane["armOffset"] = dust["radialOffsets"][lane_index]


def create_nebula_regions(config: dict, collections: dict, materials: dict, root: bpy.types.Object) -> None:
    for region in config["nebulaRegions"]:
        anchor = bpy.data.objects.new(region["name"], None)
        collections["GALAXY_NEBULA"].objects.link(anchor)
        anchor.parent = root
        anchor.location = region["position"]
        anchor.empty_display_type = "SPHERE"
        anchor.empty_display_size = max(region["scale"]) * 0.32
        for key in ("density", "emission", "temperatureBias", "noiseScale"):
            anchor[key] = region[key]
        anchor["scaleReference"] = region["scale"]

        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0)
        proxy = link_object(bpy.context.object, collections["GALAXY_NEBULA"])
        proxy.name = f"{region['name']}_PROXY"
        proxy.parent = root
        proxy.location = region["position"]
        proxy.scale = region["scale"]
        proxy.data.materials.append(materials["MAT_NEBULA"])
        proxy.display_type = "WIRE"
        proxy.hide_render = True
        proxy["assetSlotOnly"] = True
        proxy["volumeEnabledCompany"] = False


def attach_star_field_slots(config: dict, collections: dict) -> None:
    for key, collection_name, existing_name in (
        ("far", "HERO_FAR_STARS", "PROXY_FAR_STARS"),
        ("mid", "HERO_MID_STARS", "PROXY_MID_STARS"),
    ):
        source_collection = bpy.data.collections.get(collection_name)
        if not source_collection:
            raise RuntimeError(f"Locked star collection is missing: {collection_name}")
        slot = bpy.data.objects.new(f"{key.upper()}_STAR_FIELD_ASSET_SLOT", None)
        collections["HOME_VISUAL_STAR_FIELDS"].objects.link(slot)
        slot["companyCount"] = config["starFields"][key]["companyCount"]
        slot["homeCount"] = config["starFields"][key]["homeCount"]
        slot["sizeRange"] = config["starFields"][key]["sizeRange"]
        slot["brightnessRange"] = config["starFields"][key]["brightnessRange"]
        slot["sourceProxy"] = existing_name
        existing = bpy.data.objects.get(existing_name)
        if existing:
            existing["assetSlot"] = slot.name
            existing["companyCount"] = config["starFields"][key]["companyCount"]
            existing["homeCount"] = config["starFields"][key]["homeCount"]


def attach_near_pass_slots(config: dict) -> None:
    near = config["nearPass"]
    rng = random.Random(config["seed"] + 900)
    for index in range(near["count"]):
        path = bpy.data.objects.get(f"PATH_NEAR_PASS_{index + 1:02d}")
        if not path:
            raise RuntimeError(f"Locked Near Pass path {index + 1:02d} is missing.")
        path["assetSlot"] = "NEAR_STAR"
        path["size"] = rng.uniform(*near["sizeRange"])
        path["brightness"] = rng.uniform(*near["brightnessRange"])
        path["temperature"] = rng.uniform(*near["temperatureRangeKelvin"])
        path["trailStrength"] = rng.uniform(*near["trailStrengthRange"])
        path["motionBlurWeight"] = rng.uniform(*near["motionBlurWeightRange"])
        path["motionBlurEnabledCompany"] = False
        path["generatorSeed"] = config["seed"] + 900 + index


def sample_bezier_curve(obj: bpy.types.Object, samples_per_segment: int = 24) -> list[Vector]:
    points = []
    for spline in obj.data.splines:
        if spline.type != "BEZIER" or len(spline.bezier_points) < 2:
            continue
        for index in range(len(spline.bezier_points) - 1):
            left = spline.bezier_points[index]
            right = spline.bezier_points[index + 1]
            segment = interpolate_bezier(left.co, left.handle_right, right.handle_left, right.co, samples_per_segment)
            if points:
                segment = segment[1:]
            points.extend(obj.matrix_world @ point for point in segment)
    return points


def create_cosmic_flow_particles(config: dict, preset_name: str, collections: dict, materials: dict) -> None:
    flow_config = config["cosmicFlow"]["paths"]
    for flow_index, name in enumerate(FLOW_NAMES):
        curve = bpy.data.objects.get(name)
        if not curve:
            raise RuntimeError(f"Locked Cosmic Flow path is missing: {name}")
        params = flow_config[name]
        curve.hide_render = True
        curve["curveVisibleInFormalRender"] = False
        for key in ("spreadRadius", "speed", "brightness", "sizeVariation", "flowNoise", "depthScatter"):
            curve[key] = params[key]
        curve["particleCountCompany"] = params["companyParticleCount"]
        curve["particleCountHome"] = params["homeParticleCount"]
        curve["generatorSeed"] = config["seed"] + 1200 + flow_index

        particle_count = params["companyParticleCount"] if preset_name == "companySkeleton" else params["homeParticleCount"]
        samples = sample_bezier_curve(curve)
        rng = random.Random(config["seed"] + 1200 + flow_index)
        positions, sizes = [], []
        for particle_index in range(particle_count):
            progress = (particle_index + rng.random() * 0.7) / max(1, particle_count - 1)
            sample_index = min(len(samples) - 1, int(progress * (len(samples) - 1)))
            base = samples[sample_index]
            scatter = Vector((
                rng.gauss(0.0, params["spreadRadius"] * 0.36),
                rng.gauss(0.0, params["spreadRadius"] * 0.28),
                rng.gauss(0.0, params["depthScatter"] * 0.35),
            ))
            point = base + scatter
            positions.append(tuple(point))
            sizes.append(rng.uniform(0.07, 0.15) * (1 + params["sizeVariation"] * rng.random()))
        cloud = create_triangle_cloud(
            f"FLOW_PARTICLES_{name}", positions, sizes,
            collections["HOME_VISUAL_COSMIC_FLOW"], materials["MAT_FLOW_PARTICLE"],
            config["seed"] + 1200 + flow_index,
        )
        cloud["sourceCurve"] = name
        cloud["formalVisual"] = "PARTICLES_ONLY"


def configure_scene(config: dict, preset_name: str, preset: dict) -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = int(preset["renderWidth"])
    scene.render.resolution_y = int(preset["renderHeight"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.engine = preset["engine"]
    scene["visualSkeletonVersion"] = config["visualSkeletonVersion"]
    scene["visualSkeletonPreset"] = preset_name
    scene["visualSkeletonSeed"] = config["seed"]
    scene["visualConfigJson"] = json.dumps(config, ensure_ascii=False, sort_keys=True)
    scene["companyPresetJson"] = json.dumps(config["presets"]["companySkeleton"], sort_keys=True)
    scene["homeLookdevPresetJson"] = json.dumps(config["presets"]["homeLookdev"], sort_keys=True)
    scene["homeLookdevRenderRequested"] = False
    scene["cyclesOrOptixExecuted"] = False
    scene["renderOperatorInvokedByVisualBuilder"] = False
    scene["volumeEnabled"] = bool(preset["volumeEnabled"])
    scene["motionBlurEnabled"] = bool(preset["motionBlur"])
    if hasattr(scene.render, "use_motion_blur"):
        scene.render.use_motion_blur = bool(preset["motionBlur"])
    if preset_name == "homeLookdev":
        scene.cycles.device = "GPU"
        scene.cycles.samples = int(preset["samples"])
        scene.cycles.use_denoising = bool(preset["denoise"])
        scene["cyclesDevice"] = preset["device"]
        scene["cyclesComputeBackend"] = preset["computeBackend"]
        scene["cyclesConfiguredForFutureRender"] = True
    else:
        scene["cyclesConfiguredForFutureRender"] = False
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.background_type = "WORLD"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True


def make_debug_camera(name: str, location: Vector, target: Vector, collection: bpy.types.Collection, lens: float = 48.0) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    camera = bpy.data.objects.new(name, data)
    camera.location = location
    camera.rotation_euler = (target - location).to_track_quat("-Z", "Y").to_euler()
    collection.objects.link(camera)
    return camera


def make_marker(name: str, source: bpy.types.Object, material: bpy.types.Material, collection: bpy.types.Collection) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.5, location=source.matrix_world.translation)
    marker = link_object(bpy.context.object, collection)
    marker.name = name
    marker.data.materials.append(material)
    marker["debugOnly"] = True
    return marker


def render_debug_images(config: dict, art_dir: Path, collections: dict, materials: dict) -> None:
    scene = bpy.context.scene
    original_camera = scene.camera
    original_engine = scene.render.engine
    original_frame = scene.frame_current
    original_resolution = (scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.frame_set(240)
    bpy.context.view_layer.update()
    galaxy_anchor = bpy.data.objects["GALAXY_MASTER_ANCHOR"].matrix_world.translation.copy()

    temporary_objects = []
    visibility = {}
    bevels = {}
    for obj in bpy.data.objects:
        if obj.name.startswith("NEBULA_REGION_") and obj.name.endswith("_PROXY"):
            visibility[obj.name] = obj.hide_render
            obj.hide_render = False
        if obj.name.startswith("DUST_LANE_"):
            visibility[obj.name] = obj.hide_render
            bevels[obj.name] = obj.data.bevel_depth
            obj.hide_render = False
            obj.data.bevel_depth = 0.18

    galaxy_camera = make_debug_camera(
        "CAM_DEBUG_GALAXY_STRUCTURE",
        galaxy_anchor + Vector((0.0, -118.0, 82.0)),
        galaxy_anchor,
        collections["HOME_VISUAL_DEBUG"],
        52.0,
    )
    temporary_objects.append(galaxy_camera)
    scene.camera = galaxy_camera
    scene.render.filepath = str(art_dir / "galaxy-structure-debug.png")
    bpy.ops.render.render(write_still=True)

    flow_visibility = {}
    flow_bevels = {}
    for name in FLOW_NAMES:
        curve = bpy.data.objects[name]
        flow_visibility[name] = curve.hide_render
        flow_bevels[name] = curve.data.bevel_depth
        curve.hide_render = False
        curve.data.bevel_depth = 0.12
    flow_camera = make_debug_camera(
        "CAM_DEBUG_COSMIC_FLOW",
        Vector((5.0, 82.0, 210.0)),
        Vector((5.0, 92.0, 20.0)),
        collections["HOME_VISUAL_DEBUG"],
        48.0,
    )
    temporary_objects.append(flow_camera)
    scene.camera = flow_camera
    scene.render.filepath = str(art_dir / "cosmic-flow-debug.png")
    bpy.ops.render.render(write_still=True)

    for name, hidden in flow_visibility.items():
        bpy.data.objects[name].hide_render = hidden
        bpy.data.objects[name].data.bevel_depth = flow_bevels[name]

    marker_materials = (
        ("DEBUG_GEO_ANCHOR", "ANCHOR_GEO", materials["MAT_FLOW_PARTICLE"]),
        ("DEBUG_5A_ANCHOR", "ANCHOR_5A", materials["MAT_NEBULA"]),
        ("DEBUG_BRAND_MIND_ANCHOR", "ANCHOR_BRAND_MIND", materials["MAT_GALAXY_CORE"]),
    )
    for marker_name, source_name, material in marker_materials:
        marker = make_marker(marker_name, bpy.data.objects[source_name], material, collections["HOME_VISUAL_DEBUG"])
        temporary_objects.append(marker)
    scene.camera = original_camera
    scene.render.filepath = str(art_dir / "final-composition-debug.png")
    bpy.ops.render.render(write_still=True)

    for obj in temporary_objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for name, hidden in visibility.items():
        if bpy.data.objects.get(name):
            bpy.data.objects[name].hide_render = hidden
    for name, depth in bevels.items():
        if bpy.data.objects.get(name):
            bpy.data.objects[name].data.bevel_depth = depth
    scene.camera = original_camera
    scene.render.engine = original_engine
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = original_resolution
    scene.frame_set(original_frame)
    scene["renderOperatorInvokedByVisualBuilder"] = True
    scene["debugWorkbenchRenderCount"] = 3
    scene["cyclesOrOptixExecuted"] = False


def lock_snapshot(camera_config: dict) -> dict:
    camera = bpy.data.objects.get(camera_config["camera"]["name"])
    target = bpy.data.objects.get("TARGET_CAMERA_LOOK")
    if not camera or not target:
        raise RuntimeError("Locked camera or target is missing.")
    bpy.context.scene.frame_set(camera_config["timeline"]["frameEnd"])
    bpy.context.view_layer.update()
    return {
        "cameraPathSignature": object_curve_signature(("PATH_CAMERA_POSITION", "PATH_CAMERA_TARGET")),
        "nearPassSignature": object_curve_signature(tuple(f"PATH_NEAR_PASS_{index:02d}" for index in range(1, 13))),
        "flowSignature": object_curve_signature(FLOW_NAMES),
        "cameraPositionFinal": rounded_vector(camera.matrix_world.translation),
        "cameraQuaternionFinalWXYZ": rounded_vector(camera.matrix_world.to_quaternion()),
        "cameraTargetFinal": rounded_vector(target.matrix_world.translation),
        "entryAnchors": {
            name: rounded_vector(bpy.data.objects[name].matrix_world.translation)
            for name in ("ANCHOR_GEO", "ANCHOR_5A", "ANCHOR_BRAND_MIND")
        },
        "galaxyAnchor": rounded_vector(bpy.data.objects["GALAXY_MASTER_ANCHOR"].matrix_world.translation),
        "frameStart": bpy.context.scene.frame_start,
        "frameEnd": bpy.context.scene.frame_end,
        "fps": bpy.context.scene.render.fps,
    }


def main() -> int:
    args = parse_args()
    config = load_json(args.config)
    baseline = load_json(args.baseline)
    camera_config = load_json(args.camera_config)
    preset = config["presets"][args.preset]
    art_dir = Path(args.art_dir).resolve()
    output = Path(args.output).resolve()
    art_dir.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    if sha256_file(args.baseline) != config["lockedInputs"]["baselineSha256"]:
        raise RuntimeError("Locked handoff baseline SHA-256 mismatch.")

    before = lock_snapshot(camera_config)
    collections = make_collections()
    materials = create_materials(config)
    configure_scene(config, args.preset, preset)
    rng = random.Random(config["seed"])
    galaxy_result = create_galaxy_layers(config, preset, collections, materials, rng)
    attach_star_field_slots(config, collections)
    attach_near_pass_slots(config)
    create_cosmic_flow_particles(config, args.preset, collections, materials)
    after = lock_snapshot(camera_config)
    if before != after:
        raise RuntimeError("Locked Camera, Timeline, Near Pass, Flow, Galaxy anchor, or Entry anchor changed during skeleton generation.")

    scene = bpy.context.scene
    scene["lockedSnapshotJson"] = json.dumps(before, sort_keys=True)
    scene["baselineSha256"] = config["lockedInputs"]["baselineSha256"]
    scene["threeContractSha256"] = config["lockedInputs"]["threeContractSha256"]
    scene["legacyGalaxyProxyUsed"] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    if args.render_debug:
        if args.preset != "companySkeleton":
            raise RuntimeError("Debug rendering is only permitted for companySkeleton.")
        render_debug_images(config, art_dir, collections, materials)
        bpy.ops.wm.save_as_mainfile(filepath=str(output))

    build_report = {
        "schemaVersion": "1.0.0",
        "status": "ok",
        "preset": args.preset,
        "output": str(output),
        "collections": list(GALAXY_COLLECTIONS + EXTRA_COLLECTIONS),
        "galaxyCounts": galaxy_result["counts"],
        "armCount": config["galaxy"]["armCount"],
        "dustLaneCount": config["dustLanes"]["count"],
        "nebulaRegionCount": len(config["nebulaRegions"]),
        "nearPassCount": config["nearPass"]["count"],
        "cosmicFlowCount": len(FLOW_NAMES),
        "debugImagesRendered": 3 if args.render_debug else 0,
        "renderEngine": scene.render.engine,
        "cyclesOrOptixExecuted": False,
        "lockedStateUnchanged": before == after,
        "lockedSnapshot": before,
        "baselineCamera": baseline["camera"],
    }
    (art_dir / "home-visual-skeleton-build.json").write_text(
        json.dumps(build_report, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(build_report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
