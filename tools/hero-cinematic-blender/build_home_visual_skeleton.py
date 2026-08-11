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
from bpy_extras.object_utils import world_to_camera_view
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
STAR_TIER_ORDER = ("micro", "medium", "hero")


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


def attribute_emission_material(
    name: str,
    fallback_color: tuple[float, float, float],
    fallback_strength: float,
) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing:
        bpy.data.materials.remove(existing)
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_fake_user = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    color_attribute = nodes.new("ShaderNodeAttribute")
    color_attribute.attribute_name = "starColor"
    brightness_attribute = nodes.new("ShaderNodeAttribute")
    brightness_attribute.attribute_name = "brightness"
    emission.inputs["Color"].default_value = (*fallback_color, 1.0)
    emission.inputs["Strength"].default_value = fallback_strength
    material.node_tree.links.new(color_attribute.outputs["Color"], emission.inputs["Color"])
    material.node_tree.links.new(brightness_attribute.outputs["Fac"], emission.inputs["Strength"])
    material.node_tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
    material["pointCloudMaterial"] = True
    return material


def volume_material(
    name: str,
    color: tuple[float, float, float],
    density: float,
    emission_color: tuple[float, float, float],
    emission_strength: float,
    noise_scale: float,
    anisotropy: float,
) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing:
        bpy.data.materials.remove(existing)
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_fake_user = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    texture = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "3D"
    noise.inputs["Scale"].default_value = noise_scale
    noise.inputs["Detail"].default_value = 3.2
    noise.inputs["Roughness"].default_value = 0.68
    contrast = nodes.new("ShaderNodeMapRange")
    contrast.clamp = True
    contrast.inputs["From Min"].default_value = 0.24
    contrast.inputs["From Max"].default_value = 0.76
    contrast.inputs["To Min"].default_value = 0.0
    contrast.inputs["To Max"].default_value = 1.0
    distance = nodes.new("ShaderNodeVectorMath")
    distance.operation = "DISTANCE"
    distance.inputs[1].default_value = (0.5, 0.5, 0.5)
    falloff = nodes.new("ShaderNodeMapRange")
    falloff.clamp = True
    falloff.inputs["From Min"].default_value = 0.16
    falloff.inputs["From Max"].default_value = 0.82
    falloff.inputs["To Min"].default_value = 1.0
    falloff.inputs["To Max"].default_value = 0.0
    density_noise = nodes.new("ShaderNodeMath")
    density_noise.operation = "MULTIPLY"
    density_scale = nodes.new("ShaderNodeMath")
    density_scale.operation = "MULTIPLY"
    density_scale.inputs[1].default_value = density
    material.node_tree.links.new(texture.outputs["Generated"], noise.inputs["Vector"])
    material.node_tree.links.new(noise.outputs["Fac"], contrast.inputs["Value"])
    material.node_tree.links.new(texture.outputs["Generated"], distance.inputs[0])
    material.node_tree.links.new(distance.outputs["Value"], falloff.inputs["Value"])
    material.node_tree.links.new(contrast.outputs["Result"], density_noise.inputs[0])
    material.node_tree.links.new(falloff.outputs["Result"], density_noise.inputs[1])
    material.node_tree.links.new(density_noise.outputs[0], density_scale.inputs[0])
    material.node_tree.links.new(density_scale.outputs[0], volume.inputs["Density"])
    volume.inputs["Color"].default_value = (*color, 1.0)
    volume.inputs["Anisotropy"].default_value = anisotropy
    emission_color_input = volume.inputs.get("Emission Color") or volume.inputs.get("Emission")
    if emission_color_input:
        emission_color_input.default_value = (*emission_color, 1.0)
    emission_input = volume.inputs.get("Emission Strength")
    if emission_input:
        emission_density = nodes.new("ShaderNodeMath")
        emission_density.operation = "MULTIPLY"
        emission_density.inputs[1].default_value = emission_strength
        material.node_tree.links.new(density_noise.outputs[0], emission_density.inputs[0])
        material.node_tree.links.new(emission_density.outputs[0], emission_input)
    material.node_tree.links.new(volume.outputs["Volume"], output.inputs["Volume"])
    material["localizedNoiseVolume"] = True
    material["noiseContrast"] = True
    material["densityReference"] = density
    material["emissionReference"] = emission_strength
    return material


def create_materials(config: dict) -> dict[str, bpy.types.Material]:
    params = config["materials"]
    result = {
        "MAT_GALAXY_CORE": attribute_emission_material("MAT_GALAXY_CORE", (1.0, 0.72, 0.46), 2.0),
        "MAT_GALAXY_STAR": attribute_emission_material("MAT_GALAXY_STAR", (0.9, 0.92, 1.0), 1.0),
        "MAT_DUST": volume_material(
            "MAT_DUST", (0.012, 0.009, 0.014), params["dustAbsorption"],
            (0.0, 0.0, 0.0), 0.0, 4.8, 0.12,
        ),
        "MAT_NEBULA": volume_material(
            "MAT_NEBULA", (0.1, 0.16, 0.24), params["volumeDensity"],
            (0.16, 0.24, 0.36), params["nebulaEmission"], 2.4, params["anisotropy"],
        ),
        "MAT_FLOW_PARTICLE": attribute_emission_material("MAT_FLOW_PARTICLE", (0.48, 0.62, 0.8), 0.15),
        "MAT_NEAR_STAR": attribute_emission_material("MAT_NEAR_STAR", (0.88, 0.92, 1.0), 4.0),
    }
    for name, material in result.items():
        material["emissionStrength"] = float(params["emissionStrength"])
        material["blackbodyTemperature"] = float(params["blackbodyTemperature"])
        material["dustAbsorption"] = float(params["dustAbsorption"])
        material["volumeDensity"] = float(params["volumeDensity"])
        material["anisotropy"] = float(params["anisotropy"])
        material["nebulaEmission"] = float(params["nebulaEmission"])
        material["starBrightnessRange"] = list(params["starBrightnessRange"])
    return result


def create_point_cloud(
    name: str,
    positions: list[tuple[float, float, float]],
    radii: list[float],
    colors: list[tuple[float, float, float, float]],
    brightness: list[float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    seed: int,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    if not (len(positions) == len(radii) == len(colors) == len(brightness)):
        raise RuntimeError(f"Point cloud attributes are misaligned for {name}.")
    point_cloud = bpy.data.pointclouds.new(name)
    point_cloud.resize(len(positions))
    radius_attribute = point_cloud.attributes.new("radius", "FLOAT", "POINT")
    color_attribute = point_cloud.attributes.new("starColor", "FLOAT_COLOR", "POINT")
    brightness_attribute = point_cloud.attributes.new("brightness", "FLOAT", "POINT")
    point_cloud.attributes["position"].data.foreach_set(
        "vector", [component for position in positions for component in position]
    )
    radius_attribute.data.foreach_set("value", radii)
    color_attribute.data.foreach_set("color", [component for color in colors for component in color])
    brightness_attribute.data.foreach_set("value", brightness)
    point_cloud.materials.append(material)
    obj = bpy.data.objects.new(name, point_cloud)
    collection.objects.link(obj)
    obj.parent = parent
    obj["generatorSeed"] = seed
    obj["pointCount"] = len(positions)
    obj["nonZeroThickness"] = True
    obj["renderPrimitive"] = "NATIVE_POINT_SPHERE"
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


def weighted_star_color(galaxy: dict, rng: random.Random, core_bias: float = 0.0) -> tuple[float, float, float, float]:
    palette = galaxy["temperaturePalette"]
    if core_bias > 0.0 and rng.random() < core_bias:
        warm = next(item for item in palette if item["name"] == "warmWhite")
        color = warm["color"]
    else:
        threshold = rng.random() * sum(float(item["weight"]) for item in palette)
        color = palette[-1]["color"]
        accumulated = 0.0
        for item in palette:
            accumulated += float(item["weight"])
            if threshold <= accumulated:
                color = item["color"]
                break
    variation = rng.uniform(0.9, 1.06)
    return tuple(min(1.0, float(component) * variation) for component in color) + (1.0,)


def create_star_tier_clouds(
    prefix: str,
    positions: list[tuple[float, float, float]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    config: dict,
    rng: random.Random,
    seed: int,
    parent: bpy.types.Object | None,
    core_bias: float = 0.0,
    radius_scale: float = 1.0,
    brightness_scale: float = 1.0,
) -> list[bpy.types.Object]:
    tiers = config["galaxy"]["starTiers"]
    thresholds = []
    running = 0.0
    for tier_name in STAR_TIER_ORDER:
        running += float(tiers[tier_name]["ratio"])
        thresholds.append((running, tier_name))
    buckets = {
        tier_name: {"positions": [], "radii": [], "colors": [], "brightness": []}
        for tier_name in STAR_TIER_ORDER
    }
    for position in positions:
        roll = rng.random()
        tier_name = STAR_TIER_ORDER[-1]
        for threshold, candidate in thresholds:
            if roll <= threshold:
                tier_name = candidate
                break
        tier = tiers[tier_name]
        bucket = buckets[tier_name]
        bucket["positions"].append(position)
        bucket["radii"].append(rng.uniform(*tier["radiusRange"]) * radius_scale)
        bucket["colors"].append(weighted_star_color(config["galaxy"], rng, core_bias))
        bucket["brightness"].append(rng.uniform(*tier["brightnessRange"]) * brightness_scale)
    objects = []
    for tier_index, tier_name in enumerate(STAR_TIER_ORDER):
        bucket = buckets[tier_name]
        if not bucket["positions"]:
            continue
        obj = create_point_cloud(
            f"{prefix}_{tier_name.upper()}",
            bucket["positions"], bucket["radii"], bucket["colors"], bucket["brightness"],
            collection, material, seed + tier_index, parent,
        )
        obj["starTier"] = tier_name
        obj["radiusRange"] = [float(value) * radius_scale for value in tier["radiusRange"]]
        obj["brightnessRange"] = [float(value) * brightness_scale for value in tier["brightnessRange"]]
        objects.append(obj)
    return objects


def create_volume_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    parent: bpy.types.Object | None,
    rotation_z: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=2.0)
    obj = link_object(bpy.context.object, collection)
    obj.name = name
    obj.location = location
    obj.scale = scale
    obj.rotation_euler.z = rotation_z
    obj.parent = parent
    obj.data.materials.append(material)
    obj.display_type = "WIRE"
    obj["localizedVolume"] = True
    return obj


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
    clump_centers = [rng.uniform(0.06, 0.97) for _ in range(int(galaxy["armClumpCount"]))]
    while len(positions) < count:
        if rng.random() < galaxy["armClumpProbability"]:
            progress = max(0.0, min(1.0, rng.gauss(rng.choice(clump_centers), 0.035 + rng.random() * 0.055)))
        else:
            progress = rng.random()
        broken_pattern = 0.5 + 0.5 * math.sin(progress * 31.0 + arm_index * 1.73)
        if rng.random() < galaxy["armDropout"] * (0.35 + 0.65 * broken_pattern):
            continue
        angular_noise = rng.gauss(0.0, galaxy["armNoise"] * (0.4 + progress))
        x, y, _ = spiral_coordinate(galaxy, arm_index, progress, angular_noise)
        width_wave = 1.0 + galaxy["armWidthVariation"] * math.sin(progress * 13.0 + arm_index * 0.91)
        spread = galaxy["armSpread"] * galaxy["diskRadius"] * (0.12 + 0.88 * progress) * max(0.35, width_wave)
        radial_angle = math.atan2(y, x)
        tangent_angle = radial_angle + math.pi * 0.5
        radial_offset = rng.gauss(0.0, spread * 0.24)
        tangent_offset = rng.gauss(0.0, spread * 0.16)
        x += math.cos(radial_angle) * radial_offset
        y += math.sin(radial_angle) * radial_offset
        x += math.cos(tangent_angle) * tangent_offset
        y += math.sin(tangent_angle) * tangent_offset
        local_thickness = 0.72 + 0.28 * math.sin(progress * 17.0 + arm_index * 0.63)
        thickness = galaxy["diskThickness"] * (0.3 + 0.7 * (1.0 - progress)) * galaxy["armVerticalScatter"] * local_thickness
        positions.append((x, y, rng.gauss(0.0, thickness * 0.3)))
        sizes.append(1.0 - progress * 0.25)
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


def thin_particle_wall_at_review_frame(
    positions: list[tuple[float, float, float]],
    root: bpy.types.Object,
    galaxy: dict,
    rng: random.Random,
) -> list[tuple[float, float, float]]:
    """Deterministically thin only the diffuse disk/halo in the fixed Frame 145 right edge."""
    control = galaxy["particleWallControl"]
    scene = bpy.context.scene
    camera = scene.camera
    if not camera:
        raise RuntimeError("Locked scene camera is missing during Frame 145 density shaping.")
    original_frame = scene.frame_current
    scene.frame_set(int(control["frame"]))
    bpy.context.view_layer.update()
    start = float(control["screenStart"])
    end = float(control["screenEnd"])
    minimum_keep = float(control["minimumKeep"])
    frequency = float(control["gapFrequency"])
    gap_strength = float(control["gapStrength"])
    filtered = []
    for position in positions:
        projected = world_to_camera_view(scene, camera, root.matrix_world @ Vector(position))
        edge_factor = max(0.0, min(1.0, (float(projected.x) - start) / max(1e-6, end - start)))
        broken_gap = 0.5 + 0.5 * math.sin(position[0] * 0.17 + position[1] * 0.11 + frequency * projected.y)
        keep_probability = 1.0 - edge_factor * (1.0 - minimum_keep)
        keep_probability *= 1.0 - edge_factor * gap_strength * broken_gap
        if rng.random() <= keep_probability:
            filtered.append(position)
    scene.frame_set(original_frame)
    bpy.context.view_layer.update()
    return filtered


def create_arm_light_envelopes(
    config: dict,
    preset: dict,
    collections: dict,
    root: bpy.types.Object,
) -> list[bpy.types.Object]:
    if not preset["volumeEnabled"]:
        return []
    galaxy = config["galaxy"]
    envelope = galaxy["armLightEnvelope"]
    segment_count = int(envelope["segmentsPerArm"])
    start, end = (float(value) for value in envelope["progressRange"])
    length_min, length_max = (float(value) for value in envelope["lengthRange"])
    width_min, width_max = (float(value) for value in envelope["widthRange"])
    height_min, height_max = (float(value) for value in envelope["heightRange"])
    result = []
    for arm_index in range(galaxy["armCount"]):
        for segment_index in range(segment_count):
            fraction = (segment_index + 0.5) / segment_count
            progress = start + (end - start) * fraction
            phase_jitter = 0.022 * math.sin((arm_index + 1) * 1.91 + segment_index * 1.37)
            x, y, z = spiral_coordinate(galaxy, arm_index, progress, phase_jitter)
            next_progress = min(1.0, progress + 0.014)
            next_x, next_y, _ = spiral_coordinate(galaxy, arm_index, next_progress, phase_jitter)
            clump = 0.5 + 0.5 * math.sin(progress * 27.0 + arm_index * 1.63)
            is_break = ((arm_index * 3 + segment_index) % int(envelope["breakModulo"])) == 4
            break_scale = 0.28 if is_break else 1.0
            density = float(envelope["density"]) * (0.62 + 0.58 * clump) * break_scale
            emission = float(envelope["emission"]) * (0.55 + 0.75 * clump) * (0.2 if is_break else 1.0)
            material = volume_material(
                f"MAT_GALAXY_ARM_LIGHT_ENVELOPE_{arm_index + 1:02d}_{segment_index + 1:02d}",
                (0.075, 0.085, 0.105), density,
                (0.52, 0.58, 0.66), emission,
                float(envelope["noiseScale"]) * (0.86 + 0.22 * clump),
                config["materials"]["anisotropy"],
            )
            length = length_min + (length_max - length_min) * (0.35 + 0.65 * clump)
            width = width_min + (width_max - width_min) * (0.2 + 0.8 * clump)
            height = height_min + (height_max - height_min) * (1.0 - progress * 0.35)
            volume = create_volume_box(
                f"GALAXY_ARM_LIGHT_ENVELOPE_{arm_index + 1:02d}_{segment_index + 1:02d}",
                (x, y, z),
                (length * 0.5, width * (0.62 if is_break else 1.0), height),
                collections["GALAXY_ARMS"], material, root,
                rotation_z=math.atan2(next_y - y, next_x - x),
            )
            volume["armIndex"] = arm_index + 1
            volume["segmentIndex"] = segment_index + 1
            volume["continuousArmEnvelope"] = True
            volume["clumpFactor"] = clump
            volume["intentionalBreak"] = is_break
            result.append(volume)
    return result


def create_galaxy_layers(config: dict, preset: dict, collections: dict, materials: dict, rng: random.Random) -> dict:
    galaxy = config["galaxy"]
    root = make_galaxy_root(config, collections)
    counts = distribute_counts(int(preset["galaxyStarCount"]), galaxy["layerRatios"])
    point_objects = []
    layer_actual_counts = {}
    layer_builders = {
        "bulge": ("GALAXY_BULGE_STARS", "GALAXY_BULGE", "MAT_GALAXY_CORE", bulge_positions),
        "starDisk": ("GALAXY_STAR_DISK_STARS", "GALAXY_STAR_DISK", "MAT_GALAXY_STAR", disk_positions),
        "halo": ("GALAXY_HALO_STARS", "GALAXY_HALO", "MAT_GALAXY_STAR", halo_positions),
    }
    for index, (key, spec) in enumerate(layer_builders.items()):
        name, collection_name, material_name, builder = spec
        positions, _sizes = builder(counts[key], galaxy, rng)
        if preset["engine"] == "CYCLES" and key in {"starDisk", "halo"}:
            positions = thin_particle_wall_at_review_frame(positions, root, galaxy, rng)
        layer_actual_counts[key] = len(positions)
        point_objects.extend(create_star_tier_clouds(
            name, positions, collections[collection_name], materials[material_name], config, rng,
            config["seed"] + index * 10, root,
            core_bias=galaxy["coreWarmBias"] if key == "bulge" else 0.0,
            brightness_scale=1.85 if key == "bulge" else (0.42 if key == "halo" else 0.68),
        ))

    arm_total = counts["arms"]
    base_per_arm = arm_total // galaxy["armCount"]
    remaining = arm_total - base_per_arm * galaxy["armCount"]
    for arm_index in range(galaxy["armCount"]):
        arm_count = base_per_arm + (1 if arm_index < remaining else 0)
        positions, _sizes = arm_positions(arm_count, galaxy, arm_index, rng)
        layer_actual_counts[f"arm{arm_index + 1}"] = len(positions)
        arm_slot = bpy.data.objects.new(f"SPIRAL_ARM_STARS_{arm_index + 1:02d}", None)
        collections["GALAXY_ARMS"].objects.link(arm_slot)
        arm_slot.parent = root
        arm_slot["armIndex"] = arm_index + 1
        arm_slot["phaseOffset"] = galaxy["armPhaseOffsets"][arm_index]
        arm_slot["naturalDistribution"] = True
        point_objects.extend(create_star_tier_clouds(
            f"SPIRAL_ARM_POINTS_{arm_index + 1:02d}", positions,
            collections["GALAXY_ARMS"], materials["MAT_GALAXY_STAR"], config, rng,
            config["seed"] + 100 + arm_index * 10, root, brightness_scale=0.88,
        ))
        guide_points = [spiral_coordinate(galaxy, arm_index, step / 47) for step in range(48)]
        guide = create_poly_curve(
            f"SPIRAL_ARM_GUIDE_{arm_index + 1:02d}", guide_points,
            collections["GALAXY_ARMS"], materials["MAT_GALAXY_STAR"], root,
        )
        guide.hide_render = True
        guide["guideOnly"] = True

    arm_envelopes = create_arm_light_envelopes(config, preset, collections, root)
    core_volume_material = volume_material(
        "MAT_GALAXY_CORE_VOLUME", (0.16, 0.115, 0.075), config["materials"]["volumeDensity"] * 0.68,
        (1.0, 0.68, 0.4), config["materials"]["nebulaEmission"] * 1.05, 3.4, 0.18,
    )
    core_volume = create_volume_box(
        "GALAXY_CORE_GLOW_VOLUME", (0.0, 0.0, 0.0),
        (galaxy["bulgeRadius"] * 0.78, galaxy["bulgeRadius"] * 0.64, galaxy["bulgeHeight"] * 0.52),
        collections["GALAXY_BULGE"], core_volume_material, root,
    )
    core_volume["softCoreGradient"] = True
    outer_core_material = volume_material(
        "MAT_GALAXY_CORE_OUTER_VOLUME", (0.1, 0.085, 0.07), config["materials"]["volumeDensity"] * 0.24,
        (0.68, 0.61, 0.52), config["materials"]["nebulaEmission"] * 0.42, 2.15, 0.24,
    )
    outer_core = create_volume_box(
        "GALAXY_CORE_OUTER_VOLUME", (0.0, 0.0, 0.0),
        (galaxy["bulgeRadius"] * 1.18, galaxy["bulgeRadius"] * 0.94, galaxy["bulgeHeight"] * 0.72),
        collections["GALAXY_BULGE"], outer_core_material, root,
        rotation_z=0.16,
    )
    outer_core["softCoreGradient"] = True
    outer_core["neutralOuterFalloff"] = True
    create_dust_lanes(config, preset, collections, materials, root)
    create_nebula_regions(config, preset, collections, materials, root)
    return {
        "root": root,
        "counts": counts,
        "actualCounts": layer_actual_counts,
        "galaxyPointCount": sum(int(obj.get("pointCount", 0)) for obj in point_objects),
        "armEnvelopeCount": len(arm_envelopes),
    }


def create_dust_lanes(config: dict, preset: dict, collections: dict, materials: dict, root: bpy.types.Object) -> None:
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
        if preset["dustVolumeEnabled"]:
            dust_material = volume_material(
                f"MAT_DUST_LANE_{lane_index + 1:02d}", (0.008, 0.006, 0.01),
                config["materials"]["dustAbsorption"] * dust["density"][lane_index],
                (0.0, 0.0, 0.0), 0.0, 4.0 + lane_index * 0.55, 0.08,
            )
            segment_count = int(dust["volumeSegmentsPerLane"])
            for segment_index in range(segment_count):
                progress = 0.25 + (segment_index + 0.5) * (0.62 / segment_count)
                jitter = 0.018 * math.sin((lane_index + 1) * (segment_index + 2) * 1.37)
                x, y, _ = spiral_coordinate(galaxy, arm_index, progress, jitter)
                next_x, next_y, _ = spiral_coordinate(galaxy, arm_index, min(1.0, progress + 0.012), jitter)
                angle = math.atan2(y, x)
                offset = dust["radialOffsets"][lane_index]
                location = (
                    x + math.cos(angle) * offset,
                    y + math.sin(angle) * offset,
                    dust["verticalOffsets"][lane_index],
                )
                length = sum(dust["volumeLengthRange"]) * 0.5 * (0.82 + 0.18 * math.sin(segment_index + lane_index))
                height = sum(dust["volumeHeightRange"]) * 0.5 * (0.85 + 0.15 * math.cos(segment_index * 1.9))
                volume = create_volume_box(
                    f"DUST_LANE_VOLUME_{lane_index + 1:02d}_{segment_index + 1:02d}", location,
                    (length * 0.5, dust["widths"][lane_index], height),
                    collections["GALAXY_DUST_LANES"], dust_material, root,
                    rotation_z=math.atan2(next_y - y, next_x - x),
                )
                volume["visibleDust"] = True
                volume["sourceLane"] = lane.name

    if preset["dustVolumeEnabled"]:
        scene = bpy.context.scene
        camera = scene.camera
        if not camera:
            raise RuntimeError("Locked scene camera is missing while placing core dust volumes.")
        original_frame = scene.frame_current
        scene.frame_set(int(galaxy["particleWallControl"]["frame"]))
        bpy.context.view_layer.update()
        camera_local = root.matrix_world.inverted() @ camera.matrix_world.translation
        camera_side = Vector((camera_local.x, camera_local.y, 0.0))
        if camera_side.length < 1e-6:
            camera_side = Vector((1.0, 0.0, 0.0))
        camera_side.normalize()
        tangent = Vector((-camera_side.y, camera_side.x, 0.0))
        for core_index in range(int(dust["coreVolumeCount"])):
            lateral = (core_index - (dust["coreVolumeCount"] - 1) * 0.5) * 3.15
            location_vector = camera_side * (1.9 + core_index * 0.72) + tangent * lateral
            material = volume_material(
                f"MAT_DUST_CORE_{core_index + 1:02d}", (0.009, 0.007, 0.008),
                config["materials"]["dustAbsorption"] * (0.82 + core_index * 0.12),
                (0.0, 0.0, 0.0), 0.0, 5.1 + core_index * 0.7, 0.1,
            )
            volume = create_volume_box(
                f"DUST_CORE_VOLUME_{core_index + 1:02d}", tuple(location_vector),
                (galaxy["bulgeRadius"] * (0.54 + core_index * 0.07), 0.72 + core_index * 0.18, 1.15 + core_index * 0.2),
                collections["GALAXY_DUST_LANES"], material, root,
                rotation_z=math.atan2(camera_side.y, camera_side.x) + math.pi * 0.5 + (core_index - 1) * 0.18,
            )
            volume["visibleDust"] = True
            volume["coreForegroundDust"] = True
        scene.frame_set(original_frame)
        bpy.context.view_layer.update()


def create_nebula_regions(config: dict, preset: dict, collections: dict, materials: dict, root: bpy.types.Object) -> None:
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

        warm = float(region["temperatureBias"]) > 0.08
        emission_color = (0.42, 0.19, 0.08) if warm else (0.12, 0.2, 0.34)
        nebula_material = volume_material(
            f"MAT_{region['name']}", (0.055, 0.075, 0.11),
            config["materials"]["volumeDensity"] * float(region["density"]),
            emission_color,
            config["materials"]["nebulaEmission"] * float(region["emission"]),
            2.0 + float(region["noiseScale"]) * 1.8,
            config["materials"]["anisotropy"],
        )
        volume = create_volume_box(
            f"{region['name']}_VOLUME", tuple(region["position"]), tuple(region["scale"]),
            collections["GALAXY_NEBULA"], nebula_material, root,
            rotation_z=float(region["temperatureBias"]) * 0.7,
        )
        volume.hide_render = not bool(preset["volumeEnabled"])
        volume["visibleNebula"] = bool(preset["volumeEnabled"])
        volume["sourceAnchor"] = anchor.name


def create_background_star_field(
    key: str,
    count: int,
    bounds: tuple,
    field_config: dict,
    config: dict,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    rng: random.Random,
) -> None:
    tier_names = STAR_TIER_ORDER
    ratios = config["deepSpace"]["backgroundTierRatios"]
    thresholds = []
    running = 0.0
    for tier_name, ratio in zip(tier_names, ratios):
        running += float(ratio)
        thresholds.append((running, tier_name))
    buckets = {name: {"positions": [], "radii": [], "colors": [], "brightness": []} for name in tier_names}
    radius_multipliers = {"micro": 0.35, "medium": 0.7, "hero": 1.2}
    brightness_multipliers = {"micro": 0.42, "medium": 0.82, "hero": 1.65}
    for _ in range(count):
        roll = rng.random()
        tier_name = tier_names[-1]
        for threshold, candidate in thresholds:
            if roll <= threshold:
                tier_name = candidate
                break
        bucket = buckets[tier_name]
        bucket["positions"].append(tuple(rng.uniform(axis[0], axis[1]) for axis in bounds))
        bucket["radii"].append(rng.uniform(*field_config["sizeRange"]) * radius_multipliers[tier_name])
        bucket["colors"].append(weighted_star_color(config["galaxy"], rng))
        bucket["brightness"].append(
            rng.uniform(*field_config["brightnessRange"]) * brightness_multipliers[tier_name]
        )
    for tier_index, tier_name in enumerate(tier_names):
        bucket = buckets[tier_name]
        obj = create_point_cloud(
            f"HOME_{key.upper()}_STARS_{tier_name.upper()}",
            bucket["positions"], bucket["radii"], bucket["colors"], bucket["brightness"],
            collection, material, config["seed"] + 700 + tier_index,
        )
        obj["starTier"] = tier_name
        obj["deepSpaceBackground"] = True
        obj["radiusRange"] = [
            float(value) * radius_multipliers[tier_name] for value in field_config["sizeRange"]
        ]


def attach_star_field_slots(
    config: dict,
    preset_name: str,
    collections: dict,
    materials: dict,
    rng: random.Random,
) -> None:
    bounds = {
        "far": ((-90, 90), (15, 210), (-30, 65)),
        "mid": ((-55, 65), (5, 150), (-12, 48)),
    }
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
            if preset_name == "homeLookdev":
                existing.hide_render = True
                existing.hide_viewport = True
                existing["replacedByPointCloud"] = True
        if preset_name == "homeLookdev":
            create_background_star_field(
                key, int(config["starFields"][key]["homeCount"]), bounds[key],
                config["starFields"][key], config, collections["HOME_VISUAL_STAR_FIELDS"],
                materials["MAT_GALAXY_STAR"], rng,
            )


def attach_near_pass_slots(config: dict, preset_name: str, collections: dict, materials: dict) -> None:
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
        start_frame = int(path["activeFrameStart"])
        end_frame = int(path["activeFrameEnd"])
        for frame in (max(1, start_frame - 1), start_frame, end_frame, min(240, end_frame + 1)):
            path.hide_render = True
            path.keyframe_insert("hide_render", frame=frame)
        path["formalPathHidden"] = True
        path.hide_render = True

        if preset_name != "homeLookdev" or index + 1 not in near["visiblePathIndicesFrame145"]:
            continue
        samples = sample_bezier_curve(path, samples_per_segment=32)
        if not samples:
            raise RuntimeError(f"Near Pass path has no usable samples: {path.name}")
        color = weighted_star_color(config["galaxy"], rng)
        star = create_point_cloud(
            f"NEAR_PASS_STAR_{index + 1:02d}", [(0.0, 0.0, 0.0)],
            [rng.uniform(*near["pointRadiusRange"])], [color],
            [rng.uniform(*near["pointBrightnessRange"])],
            collections["HOME_VISUAL_STAR_FIELDS"], materials["MAT_NEAR_STAR"],
            config["seed"] + 950 + index,
        )
        star["sourcePath"] = path.name
        star["motionBlurEnabled"] = True
        star["radiusRange"] = list(near["pointRadiusRange"])
        star["brightnessRange"] = list(near["pointBrightnessRange"])
        for frame, factor in (
            (start_frame, 0.0),
            ((start_frame + end_frame) // 2, 0.5),
            (end_frame, 1.0),
        ):
            sample_index = min(len(samples) - 1, int(factor * (len(samples) - 1)))
            star.location = samples[sample_index]
            star.keyframe_insert("location", frame=frame)
        star.hide_render = True
        star.keyframe_insert("hide_render", frame=max(1, start_frame - 1))
        star.hide_render = False
        star.keyframe_insert("hide_render", frame=start_frame)
        star.keyframe_insert("hide_render", frame=end_frame)
        star.hide_render = True
        star.keyframe_insert("hide_render", frame=min(240, end_frame + 1))


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
        for key in ("spreadRadius", "speed", "brightness", "sizeVariation", "flowNoise", "depthScatter", "dropout"):
            curve[key] = params[key]
        curve["particleCountCompany"] = params["companyParticleCount"]
        curve["particleCountHome"] = params["homeParticleCount"]
        curve["generatorSeed"] = config["seed"] + 1200 + flow_index

        particle_count = params["companyParticleCount"] if preset_name == "companySkeleton" else params["homeParticleCount"]
        samples = sample_bezier_curve(curve)
        rng = random.Random(config["seed"] + 1200 + flow_index)
        positions, sizes, colors, brightness = [], [], [], []
        for _particle_index in range(particle_count):
            progress = rng.random()
            discontinuity = 0.5 + 0.5 * math.sin(progress * 29.0 + flow_index * 1.91)
            if rng.random() < params["dropout"] * (0.45 + 0.55 * discontinuity):
                continue
            sample_index = min(len(samples) - 1, int(progress * (len(samples) - 1)))
            base = samples[sample_index]
            scatter = Vector((
                rng.gauss(0.0, params["spreadRadius"] * 0.36),
                rng.gauss(0.0, params["spreadRadius"] * 0.28),
                rng.gauss(0.0, params["depthScatter"] * 0.35),
            ))
            point = base + scatter
            positions.append(tuple(point))
            sizes.append(rng.uniform(0.012, 0.038) * (1 + params["sizeVariation"] * rng.random()))
            colors.append((0.44 + rng.random() * 0.08, 0.55 + rng.random() * 0.08, 0.7 + rng.random() * 0.1, 1.0))
            brightness.append(params["brightness"] * rng.uniform(0.55, 1.35))
        cloud = create_point_cloud(
            f"FLOW_PARTICLES_{name}", positions, sizes, colors, brightness,
            collections["HOME_VISUAL_COSMIC_FLOW"], materials["MAT_FLOW_PARTICLE"],
            config["seed"] + 1200 + flow_index,
        )
        cloud["sourceCurve"] = name
        cloud["formalVisual"] = "SPARSE_POINT_GUIDANCE"
        cloud["dropout"] = params["dropout"]


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
        scene["homeLookdevVersion"] = "v1.2"
        deep_space = config["deepSpace"]
        world = scene.world
        world.use_nodes = True
        nodes = world.node_tree.nodes
        nodes.clear()
        output = nodes.new("ShaderNodeOutputWorld")
        background = nodes.new("ShaderNodeBackground")
        background.inputs["Color"].default_value = (*deep_space["worldColor"], 1.0)
        background.inputs["Strength"].default_value = float(deep_space["worldStrength"])
        world.node_tree.links.new(background.outputs["Background"], output.inputs["Surface"])
        world.color = tuple(deep_space["worldColor"])
        scene.view_settings.view_transform = "AgX"
        try:
            scene.view_settings.look = "AgX - Medium High Contrast"
        except TypeError:
            pass
        scene.view_settings.exposure = float(deep_space["exposure"])
        scene.view_settings.gamma = 1.0
        for light_name, energy, color in (
            ("LIGHT_GALAXY_CORE", 32.0, (1.0, 0.58, 0.32)),
            ("LIGHT_AMBIENT_COLD", 4.0, (0.38, 0.5, 0.72)),
            ("LIGHT_RIM_SPACE", 7.0, (0.48, 0.62, 0.82)),
        ):
            light = bpy.data.objects.get(light_name)
            if light and light.type == "LIGHT":
                light.data.energy = energy
                light.data.color = color
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
    attach_star_field_slots(config, args.preset, collections, materials, rng)
    attach_near_pass_slots(config, args.preset, collections, materials)
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
        "schemaVersion": "1.2.0",
        "status": "ok",
        "preset": args.preset,
        "output": str(output),
        "collections": list(GALAXY_COLLECTIONS + EXTRA_COLLECTIONS),
        "galaxyCounts": galaxy_result["counts"],
        "galaxyActualCounts": galaxy_result["actualCounts"],
        "galaxyPointCount": galaxy_result["galaxyPointCount"],
        "armEnvelopeCount": galaxy_result["armEnvelopeCount"],
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
