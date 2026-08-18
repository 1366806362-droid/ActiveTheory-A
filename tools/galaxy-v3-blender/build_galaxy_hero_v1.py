#!/usr/bin/env python3
"""Build the isolated Galaxy Hero Asset V1 Blender lookdev scene."""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


TAU = math.tau
ARM_PHASES = (0.0, math.pi, math.pi * 0.5, math.pi * 1.5)
ARM_WEIGHTS = (1.0, 0.94, 0.46, 0.38)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def read_config(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def set_socket(node, name: str, value) -> None:
    socket = node.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def create_collection(scene: bpy.types.Scene) -> bpy.types.Collection:
    collection = bpy.data.collections.new("GalaxyHeroV1")
    scene.collection.children.link(collection)
    return collection


def configure_scene(scene: bpy.types.Scene, config: dict) -> None:
    render = config["render"]
    scene.render.engine = render["engine"]
    scene.render.resolution_x = int(render["width"])
    scene.render.resolution_y = int(render["height"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.compression = 20
    scene.render.film_transparent = bool(render["filmTransparent"])
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = float(render["exposure"])
    scene.view_settings.gamma = 1.0
    scene.world.color = (0.0, 0.0, 0.0)
    if hasattr(scene, "cycles"):
        scene.cycles.samples = int(render["samples"])
        scene.cycles.use_denoising = bool(render["denoise"])
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.012
        scene.cycles.transparent_max_bounces = 10
        scene.cycles.volume_bounces = 2
        scene.cycles.volume_step_rate = 1.35
        scene.cycles.volume_max_steps = 512


def create_camera(scene: bpy.types.Scene, config: dict, collection: bpy.types.Collection) -> None:
    camera_data = bpy.data.cameras.new("GalaxyHeroLookdevCamera")
    camera = bpy.data.objects.new("GalaxyHeroLookdevCamera", camera_data)
    collection.objects.link(camera)
    camera.location = config["camera"]["location"]
    camera_data.lens = float(config["camera"]["lensMm"])
    camera_data.sensor_width = 36.0
    target = Vector(config["camera"]["target"])
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera


def create_emissive_point_material(name: str, strength: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (1.0, 0.9, 0.72, 1.0)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    color_attribute = nodes.new("ShaderNodeAttribute")
    intensity_attribute = nodes.new("ShaderNodeAttribute")
    layer_weight = nodes.new("ShaderNodeLayerWeight")
    invert_facing = nodes.new("ShaderNodeMath")
    edge_power = nodes.new("ShaderNodeMath")
    strength_scale = nodes.new("ShaderNodeMath")
    color_attribute.attribute_name = "star_color"
    intensity_attribute.attribute_name = "star_intensity"
    invert_facing.operation = "SUBTRACT"
    invert_facing.inputs[0].default_value = 1.0
    edge_power.operation = "POWER"
    edge_power.inputs[1].default_value = 1.8
    strength_scale.operation = "MULTIPLY"
    strength_scale.inputs[1].default_value = strength
    links.new(color_attribute.outputs["Color"], emission.inputs["Color"])
    links.new(intensity_attribute.outputs["Fac"], strength_scale.inputs[0])
    links.new(strength_scale.outputs[0], emission.inputs["Strength"])
    links.new(layer_weight.outputs["Facing"], invert_facing.inputs[1])
    links.new(invert_facing.outputs[0], edge_power.inputs[0])
    links.new(edge_power.outputs[0], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return material


def create_point_cloud(
    collection: bpy.types.Collection,
    name: str,
    points: list[tuple[float, float, float]],
    radii: list[float],
    colors: list[tuple[float, float, float, float]],
    intensities: list[float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    point_cloud = bpy.data.pointclouds.new(name)
    point_cloud.resize(len(points))
    point_cloud.attributes["position"].data.foreach_set("vector", [value for point in points for value in point])
    radius_attribute = point_cloud.attributes.new("radius", "FLOAT", "POINT")
    radius_attribute.data.foreach_set("value", radii)
    color_attribute = point_cloud.attributes.new("star_color", "FLOAT_COLOR", "POINT")
    color_attribute.data.foreach_set("color", [value for color in colors for value in color])
    intensity_attribute = point_cloud.attributes.new("star_intensity", "FLOAT", "POINT")
    intensity_attribute.data.foreach_set("value", intensities)
    point_cloud.materials.append(material)
    obj = bpy.data.objects.new(name, point_cloud)
    collection.objects.link(obj)
    obj.visible_shadow = False
    return obj


def lerp_color(a: tuple[float, float, float], b: tuple[float, float, float], amount: float) -> tuple[float, float, float, float]:
    t = min(1.0, max(0.0, amount))
    return (
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        1.0,
    )


def galaxy_color(radius: float, outer_radius: float, rng: random.Random) -> tuple[float, float, float, float]:
    normalized = radius / outer_radius
    warm = (1.0, 0.78, 0.48)
    neutral = (0.92, 0.94, 1.0)
    cool = (0.48, 0.66, 0.92)
    if normalized < 0.34:
        color = lerp_color(warm, neutral, normalized / 0.34)
    else:
        color = lerp_color(neutral, cool, (normalized - 0.34) / 0.66)
    temperature_jitter = rng.uniform(-0.045, 0.045)
    return (
        min(1.0, max(0.0, color[0] + temperature_jitter)),
        min(1.0, max(0.0, color[1] + temperature_jitter * 0.45)),
        min(1.0, max(0.0, color[2] - temperature_jitter * 0.25)),
        1.0,
    )


def spiral_center(theta: float, phase: float, outer_radius: float, turns: float) -> Vector:
    maximum_theta = turns * TAU
    radius = 0.34 + (outer_radius - 0.34) * (theta / maximum_theta) ** 0.9
    angle = theta + phase + 0.09 * math.sin(theta * 1.7 + phase * 0.8)
    return Vector((radius * math.cos(angle), radius * math.sin(angle), 0.0))


def generate_arm_stars(config: dict, rng: random.Random) -> tuple[list, list, list, list]:
    galaxy = config["galaxy"]
    outer_radius = float(galaxy["outerRadius"])
    turns = float(galaxy["turns"])
    points: list[tuple[float, float, float]] = []
    radii: list[float] = []
    colors: list[tuple[float, float, float, float]] = []
    intensities: list[float] = []
    counts = (
        int(galaxy["dominantArmStars"]),
        int(galaxy["dominantArmStars"] * 0.92),
        int(galaxy["secondaryArmStars"]),
        int(galaxy["secondaryArmStars"] * 0.78),
    )
    maximum_theta = turns * TAU
    for arm_index, count in enumerate(counts):
        phase = ARM_PHASES[arm_index]
        weight = ARM_WEIGHTS[arm_index]
        for _ in range(count):
            theta = maximum_theta * rng.random() ** 0.78
            center = spiral_center(theta, phase, outer_radius, turns)
            radius = math.hypot(center.x, center.y)
            clump = 0.55 + 0.45 * math.sin(theta * 3.4 + arm_index * 1.7) ** 2
            width = (0.055 + radius * 0.045) * (0.65 + clump * 0.7) / max(weight, 0.5)
            angle = math.atan2(center.y, center.x)
            radial_offset = rng.gauss(0.0, width)
            tangent_offset = rng.gauss(0.0, width * 0.45)
            x = center.x + math.cos(angle) * radial_offset - math.sin(angle) * tangent_offset
            y = center.y + math.sin(angle) * radial_offset + math.cos(angle) * tangent_offset
            thickness = 0.055 + 0.22 * math.exp(-radius * 0.48) + radius * 0.008
            z = rng.gauss(0.0, thickness) + 0.035 * math.sin(theta * 1.9 + arm_index)
            gap_wave = 0.5 + 0.5 * math.sin(theta * 2.15 + arm_index * 2.6)
            gap_factor = 0.24 if gap_wave < 0.14 else 1.0
            brightness = weight * gap_factor * (0.28 + rng.random() ** 2 * 1.35) * (0.72 + clump * 0.55)
            star_radius = (0.0021 + rng.random() ** 3 * 0.0058) * (0.85 + weight * 0.25)
            points.append((x, y, z))
            radii.append(star_radius)
            colors.append(galaxy_color(radius, outer_radius, rng))
            intensities.append(brightness)
    return points, radii, colors, intensities


def generate_core_stars(config: dict, rng: random.Random) -> tuple[list, list, list, list]:
    count = int(config["galaxy"]["coreStars"])
    points, radii, colors, intensities = [], [], [], []
    for _ in range(count):
        radial = min(1.8, abs(rng.gauss(0.0, 0.56)))
        angle = rng.random() * TAU
        points.append((radial * math.cos(angle), radial * math.sin(angle), rng.gauss(0.0, 0.21 * (1.25 - min(radial, 1.0) * 0.45))))
        radii.append(0.0025 + rng.random() ** 3 * 0.008)
        colors.append(lerp_color((1.0, 0.68, 0.34), (1.0, 0.94, 0.78), rng.random() ** 0.45))
        intensities.append(0.6 + rng.random() ** 2 * 2.5)
    return points, radii, colors, intensities


def generate_halo_stars(config: dict, rng: random.Random) -> tuple[list, list, list, list]:
    galaxy = config["galaxy"]
    outer_radius = float(galaxy["outerRadius"])
    count = int(galaxy["haloStars"])
    points, radii, colors, intensities = [], [], [], []
    for _ in range(count):
        radius = outer_radius * (0.15 + 0.95 * rng.random() ** 0.55)
        angle = rng.random() * TAU
        z = rng.gauss(0.0, 0.22 + radius * 0.055)
        points.append((radius * math.cos(angle), radius * math.sin(angle), z))
        radii.append(0.0018 + rng.random() ** 4 * 0.0042)
        colors.append(lerp_color((0.78, 0.84, 0.95), (0.52, 0.66, 0.86), radius / outer_radius))
        intensities.append(0.12 + rng.random() ** 3 * 0.55)
    return points, radii, colors, intensities


def generate_detached_stars(config: dict, rng: random.Random) -> tuple[list, list, list, list]:
    galaxy = config["galaxy"]
    outer_radius = float(galaxy["outerRadius"])
    count = int(galaxy["detachedStars"])
    cluster_centers = [
        (outer_radius * 0.92, 0.42),
        (outer_radius * 1.02, 2.18),
        (outer_radius * 0.88, 3.52),
        (outer_radius * 1.08, 5.32),
    ]
    points, radii, colors, intensities = [], [], [], []
    for index in range(count):
        center_radius, center_angle = cluster_centers[index % len(cluster_centers)]
        radius = center_radius + rng.gauss(0.0, 0.34)
        angle = center_angle + rng.gauss(0.0, 0.18)
        points.append((radius * math.cos(angle), radius * math.sin(angle), rng.gauss(0.0, 0.12)))
        radii.append(0.0019 + rng.random() ** 3 * 0.0048)
        colors.append(lerp_color((0.86, 0.9, 1.0), (0.48, 0.64, 0.88), rng.random()))
        intensities.append(0.14 + rng.random() ** 2 * 0.75)
    return points, radii, colors, intensities


def generate_knot_stars(config: dict, rng: random.Random) -> tuple[list, list, list, list]:
    galaxy = config["galaxy"]
    count = int(galaxy["knotStars"])
    outer_radius = float(galaxy["outerRadius"])
    turns = float(galaxy["turns"])
    maximum_theta = turns * TAU
    knot_centers = []
    for arm_index in (0, 1):
        for fraction in (0.28, 0.46, 0.66, 0.82):
            center = spiral_center(maximum_theta * fraction, ARM_PHASES[arm_index], outer_radius, turns)
            knot_centers.append(center)
    points, radii, colors, intensities = [], [], [], []
    for index in range(count):
        center = knot_centers[index % len(knot_centers)]
        spread = 0.07 + 0.08 * ((index % 5) / 4)
        points.append((center.x + rng.gauss(0.0, spread), center.y + rng.gauss(0.0, spread), rng.gauss(0.035, 0.065)))
        radii.append(0.004 + rng.random() ** 2 * 0.012)
        colors.append(lerp_color((1.0, 0.77, 0.48), (0.66, 0.8, 1.0), rng.random() ** 1.5))
        intensities.append(1.4 + rng.random() ** 2 * 4.2)
    return points, radii, colors, intensities


def create_arm_material(name: str, opacity: float, strength: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    color_attribute = nodes.new("ShaderNodeAttribute")
    density_attribute = nodes.new("ShaderNodeAttribute")
    texture_coordinate = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    ramp = nodes.new("ShaderNodeValToRGB")
    density_multiply = nodes.new("ShaderNodeMath")
    opacity_multiply = nodes.new("ShaderNodeMath")
    color_attribute.attribute_name = "arm_color"
    density_attribute.attribute_name = "arm_density"
    noise.noise_dimensions = "3D"
    set_socket(noise, "Scale", 3.1)
    set_socket(noise, "Detail", 5.0)
    set_socket(noise, "Roughness", 0.72)
    set_socket(noise, "Distortion", 0.38)
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    density_multiply.operation = "MULTIPLY"
    opacity_multiply.operation = "MULTIPLY"
    opacity_multiply.inputs[1].default_value = opacity
    emission.inputs["Strength"].default_value = strength
    links.new(color_attribute.outputs["Color"], emission.inputs["Color"])
    links.new(texture_coordinate.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(density_attribute.outputs["Fac"], density_multiply.inputs[0])
    links.new(ramp.outputs["Color"], density_multiply.inputs[1])
    links.new(density_multiply.outputs[0], opacity_multiply.inputs[0])
    links.new(opacity_multiply.outputs[0], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return material


def create_spiral_ribbon_mesh(config: dict, collection: bpy.types.Collection) -> bpy.types.Object:
    galaxy = config["galaxy"]
    outer_radius = float(galaxy["outerRadius"])
    turns = float(galaxy["turns"])
    segments = int(galaxy["armSegments"])
    width_segments = int(galaxy["armWidthSegments"])
    vertices, faces, colors, densities, material_indices = [], [], [], [], []
    maximum_theta = turns * TAU
    for arm_index, phase in enumerate(ARM_PHASES):
        start = len(vertices)
        arm_weight = ARM_WEIGHTS[arm_index]
        for segment in range(segments):
            t = segment / (segments - 1)
            theta = maximum_theta * t
            center = spiral_center(theta, phase, outer_radius, turns)
            forward = spiral_center(min(maximum_theta, theta + maximum_theta / segments), phase, outer_radius, turns) - center
            tangent = forward.normalized() if forward.length > 0 else Vector((1.0, 0.0, 0.0))
            normal = Vector((-tangent.y, tangent.x, 0.0))
            radius = math.hypot(center.x, center.y)
            base_width = (0.31 + radius * 0.085) * (1.0 if arm_index < 2 else 0.7)
            gap = 0.18 if math.sin(theta * 2.1 + arm_index * 2.3) < -0.83 else 1.0
            clump = 0.58 + 0.42 * math.sin(theta * 3.25 + arm_index * 1.4) ** 2
            radial_fade = math.sin(math.pi * min(1.0, max(0.0, t))) ** 0.55
            secondary_window = 1.0
            if arm_index >= 2:
                secondary_window = min(1.0, max(0.0, (t - 0.14) / 0.12)) * min(1.0, max(0.0, (0.76 - t) / 0.14))
            for width_index in range(width_segments + 1):
                across = width_index / width_segments * 2.0 - 1.0
                edge_fade = max(0.0, 1.0 - abs(across) ** 1.45)
                irregular = 1.0 + 0.16 * math.sin(theta * 6.1 + across * 3.8 + arm_index)
                point = center + normal * (across * base_width * irregular)
                point.z = 0.025 * math.sin(theta * 1.9 + across * 2.2 + arm_index)
                vertices.append(tuple(point))
                colors.append(galaxy_color(radius, outer_radius, random.Random(9000 + arm_index * 100000 + segment * 31 + width_index)))
                densities.append(arm_weight * gap * clump * radial_fade * edge_fade * secondary_window)
        row = width_segments + 1
        for segment in range(segments - 1):
            for width_index in range(width_segments):
                a = start + segment * row + width_index
                b = a + 1
                c = a + row + 1
                d = a + row
                faces.append((a, b, c, d))
                material_indices.append(0 if arm_index < 2 else 1)
    mesh = bpy.data.meshes.new("GalaxyArmMediumMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    color_attribute = mesh.attributes.new("arm_color", "FLOAT_COLOR", "POINT")
    color_attribute.data.foreach_set("color", [value for color in colors for value in color])
    density_attribute = mesh.attributes.new("arm_density", "FLOAT", "POINT")
    density_attribute.data.foreach_set("value", densities)
    obj = bpy.data.objects.new("GalaxyArmContinuousMedium", mesh)
    collection.objects.link(obj)
    obj.data.materials.append(create_arm_material("DominantArmGas", 0.26, 1.45))
    obj.data.materials.append(create_arm_material("SecondaryArmGas", 0.13, 0.95))
    for polygon, material_index in zip(mesh.polygons, material_indices):
        polygon.material_index = material_index
    obj.visible_shadow = False
    return obj


def create_dust_material() -> bpy.types.Material:
    material = bpy.data.materials.new("BrokenDustLaneMaterial")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    mix = nodes.new("ShaderNodeMixShader")
    density_attribute = nodes.new("ShaderNodeAttribute")
    texture_coordinate = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    ramp = nodes.new("ShaderNodeValToRGB")
    multiply = nodes.new("ShaderNodeMath")
    attenuation = nodes.new("ShaderNodeMath")
    density_attribute.attribute_name = "dust_density"
    diffuse.inputs["Color"].default_value = (0.004, 0.0025, 0.0018, 1.0)
    diffuse.inputs["Roughness"].default_value = 1.0
    noise.noise_dimensions = "3D"
    set_socket(noise, "Scale", 5.8)
    set_socket(noise, "Detail", 4.5)
    set_socket(noise, "Roughness", 0.78)
    set_socket(noise, "Distortion", 0.48)
    ramp.color_ramp.elements[0].position = 0.34
    ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.82, 0.82, 0.82, 1.0)
    multiply.operation = "MULTIPLY"
    attenuation.operation = "MULTIPLY"
    attenuation.inputs[1].default_value = 0.58
    links.new(texture_coordinate.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(density_attribute.outputs["Fac"], multiply.inputs[0])
    links.new(ramp.outputs["Color"], multiply.inputs[1])
    links.new(multiply.outputs[0], attenuation.inputs[0])
    links.new(attenuation.outputs[0], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(diffuse.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs["Surface"])
    return material


def create_dust_lanes(config: dict, collection: bpy.types.Collection) -> bpy.types.Object:
    galaxy = config["galaxy"]
    outer_radius = float(galaxy["outerRadius"])
    turns = float(galaxy["turns"])
    segments = int(galaxy["dustSegments"])
    width_segments = int(galaxy["dustWidthSegments"])
    maximum_theta = turns * TAU
    vertices, faces, densities = [], [], []
    for arm_index in (0, 1):
        phase = ARM_PHASES[arm_index]
        start = len(vertices)
        for segment in range(segments):
            t = segment / (segments - 1)
            theta = maximum_theta * t
            center = spiral_center(theta, phase, outer_radius, turns)
            radius = math.hypot(center.x, center.y)
            angle = math.atan2(center.y, center.x)
            lane_offset = 0.11 + radius * 0.018
            center += Vector((math.cos(angle) * lane_offset, math.sin(angle) * lane_offset, 0.0))
            forward = spiral_center(min(maximum_theta, theta + maximum_theta / segments), phase, outer_radius, turns) - center
            tangent = forward.normalized() if forward.length > 0 else Vector((1.0, 0.0, 0.0))
            normal = Vector((-tangent.y, tangent.x, 0.0))
            lane_width = 0.15 + radius * 0.035
            broken = 0.0 if math.sin(theta * 2.75 + arm_index * 2.4) < -0.35 else 1.0
            variable = 0.54 + 0.46 * math.sin(theta * 4.1 + arm_index) ** 2
            for width_index in range(width_segments + 1):
                across = width_index / width_segments * 2.0 - 1.0
                edge = max(0.0, 1.0 - abs(across) ** 1.7)
                point = center + normal * (across * lane_width * (0.84 + 0.22 * math.sin(theta * 5.3 + across)) + 0.045 * math.sin(theta * 4.7 + arm_index))
                point.z = 0.105 + 0.035 * math.sin(theta * 2.2 + across * 1.7)
                vertices.append(tuple(point))
                densities.append(broken * variable * edge * (0.72 + 0.18 * math.sin(theta * 1.3)))
        row = width_segments + 1
        for segment in range(segments - 1):
            for width_index in range(width_segments):
                a = start + segment * row + width_index
                faces.append((a, a + 1, a + row + 1, a + row))
    mesh = bpy.data.meshes.new("GalaxyDustLaneMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    density_attribute = mesh.attributes.new("dust_density", "FLOAT", "POINT")
    density_attribute.data.foreach_set("value", densities)
    obj = bpy.data.objects.new("GalaxyBrokenDustLanes", mesh)
    collection.objects.link(obj)
    obj.data.materials.append(create_dust_material())
    return obj


def create_volume_material(name: str, color: tuple[float, float, float, float], density: float, emission: float, noise_scale: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    texture_coordinate = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    ramp = nodes.new("ShaderNodeValToRGB")
    density_multiply = nodes.new("ShaderNodeMath")
    emission_multiply = nodes.new("ShaderNodeMath")
    noise.noise_dimensions = "3D"
    set_socket(noise, "Scale", noise_scale)
    set_socket(noise, "Detail", 4.5)
    set_socket(noise, "Roughness", 0.68)
    set_socket(noise, "Distortion", 0.32)
    ramp.color_ramp.elements[0].position = 0.27
    ramp.color_ramp.elements[0].color = (0.04, 0.04, 0.04, 1.0)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    density_multiply.operation = "MULTIPLY"
    density_multiply.inputs[1].default_value = density
    emission_multiply.operation = "MULTIPLY"
    emission_multiply.inputs[1].default_value = emission
    set_socket(volume, "Color", color)
    set_socket(volume, "Emission Color", color)
    set_socket(volume, "Anisotropy", 0.12)
    links.new(texture_coordinate.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], density_multiply.inputs[0])
    links.new(ramp.outputs["Color"], emission_multiply.inputs[0])
    links.new(density_multiply.outputs[0], volume.inputs["Density"])
    links.new(emission_multiply.outputs[0], volume.inputs["Emission Strength"])
    links.new(volume.outputs["Volume"], output.inputs["Volume"])
    return material


def create_volume_ellipsoid(collection: bpy.types.Collection, name: str, scale: tuple[float, float, float], material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
    obj = bpy.context.object
    obj.name = name
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.scale = scale
    obj.data.materials.append(material)
    obj.visible_shadow = False
    return obj


def main() -> int:
    args = parse_args()
    config_path = Path(args.config).resolve()
    output_path = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    config = read_config(config_path)
    rng = random.Random(int(config["seed"]))
    clear_scene()
    scene = bpy.context.scene
    configure_scene(scene, config)
    collection = create_collection(scene)
    create_camera(scene, config, collection)

    stellar_material = create_emissive_point_material("GalaxyStellarMaterial", 2.1)
    core_material = create_emissive_point_material("GalaxyCoreStarMaterial", 3.0)
    knot_material = create_emissive_point_material("GalaxyKnotMaterial", 3.6)
    faint_material = create_emissive_point_material("GalaxyFaintStarMaterial", 1.35)

    arm_data = generate_arm_stars(config, rng)
    core_data = generate_core_stars(config, rng)
    halo_data = generate_halo_stars(config, rng)
    detached_data = generate_detached_stars(config, rng)
    knot_data = generate_knot_stars(config, rng)
    create_point_cloud(collection, "GalaxyArmStars", *arm_data, stellar_material)
    create_point_cloud(collection, "GalaxyCoreStars", *core_data, core_material)
    create_point_cloud(collection, "GalaxyHaloStars", *halo_data, faint_material)
    create_point_cloud(collection, "GalaxyDetachedStarGroups", *detached_data, faint_material)
    create_point_cloud(collection, "GalaxyStarFormingKnots", *knot_data, knot_material)
    create_spiral_ribbon_mesh(config, collection)
    create_dust_lanes(config, collection)
    create_volume_ellipsoid(
        collection,
        "GalaxyCoreVolume",
        (1.18, 1.18, 0.52),
        create_volume_material("GalaxyCoreVolumeMaterial", (1.0, 0.72, 0.42, 1.0), 0.05, 2.0, 2.7),
    )
    create_volume_ellipsoid(
        collection,
        "GalaxyLayeredBulge",
        (2.0, 2.0, 0.7),
        create_volume_material("GalaxyBulgeVolumeMaterial", (1.0, 0.82, 0.58, 1.0), 0.012, 0.36, 3.8),
    )
    create_volume_ellipsoid(
        collection,
        "GalaxyVerticalHalo",
        (4.4, 4.4, 1.15),
        create_volume_material("GalaxyHaloVolumeMaterial", (0.38, 0.52, 0.72, 1.0), 0.0015, 0.035, 2.1),
    )

    rotation = math.radians(float(config["galaxy"]["rotationDegrees"]))
    for obj in collection.objects:
        if obj.type != "CAMERA":
            obj.rotation_euler.z = rotation

    scene["galaxyHeroAssetVersion"] = "v1"
    scene["galaxyHeroAssetMode"] = "blender-lookdev"
    scene["galaxyHeroPointCount"] = sum(len(data[0]) for data in (arm_data, core_data, halo_data, detached_data, knot_data))
    scene["galaxyHeroRenderBackend"] = config["render"]["backend"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), check_existing=False)
    report = {
        "schemaVersion": config["schemaVersion"],
        "status": "ok",
        "scene": str(output_path),
        "pointCount": int(scene["galaxyHeroPointCount"]),
        "objects": sorted(obj.name for obj in collection.objects),
        "renderEngine": config["render"]["engine"],
        "backend": config["render"]["backend"],
        "resolution": {"width": config["render"]["width"], "height": config["render"]["height"]},
        "samples": config["render"]["samples"],
        "filmTransparent": config["render"]["filmTransparent"],
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
