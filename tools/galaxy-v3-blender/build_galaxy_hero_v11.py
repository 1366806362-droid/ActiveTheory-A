#!/usr/bin/env python3
"""Build Galaxy Hero Asset V1.1 from independent analytic OpenVDB fields."""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
import openvdb
from mathutils import Vector


LAYER_COLLECTIONS = {
    "core": "GalaxyV11_Core",
    "arms": "GalaxyV11_Arms",
    "dust": "GalaxyV11_Dust",
    "halo": "GalaxyV11_Halo",
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def wrap_angle(value: np.ndarray) -> np.ndarray:
    return np.arctan2(np.sin(value), np.cos(value))


def smooth_window(value: np.ndarray, start: float, end: float, feather: float) -> np.ndarray:
    left = np.clip((value - start) / feather, 0.0, 1.0)
    right = np.clip((end - value) / feather, 0.0, 1.0)
    return left * left * (3.0 - 2.0 * left) * right * right * (3.0 - 2.0 * right)


def noise_field(x: np.ndarray, y: np.ndarray, z: np.ndarray | None = None) -> np.ndarray:
    coarse = 0.5 + 0.5 * np.sin(x * 1.19 + np.sin(y * 0.83) * 1.45) * np.cos(y * 1.07 - x * 0.31)
    medium = 0.5 + 0.5 * np.sin(x * 2.91 + y * 1.73 + np.sin(x * 0.54) * 2.1)
    fine = 0.5 + 0.5 * np.cos(x * 6.27 - y * 4.19 + np.sin(y * 1.7))
    result = coarse * 0.5 + medium * 0.32 + fine * 0.18
    if z is not None:
        result = result * (0.76 + 0.24 * (0.5 + 0.5 * np.sin(z * 8.3 + x * 1.12 - y * 0.67)))
    return np.clip(result, 0.0, 1.0).astype(np.float32)


def create_coordinates(config: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray, float]:
    field = config["field"]
    xy_count = int(field["resolutionXY"])
    z_count = int(field["resolutionZ"])
    xy_size = float(field["worldSizeXY"])
    z_size = float(field["worldSizeZ"])
    voxel_size = xy_size / xy_count
    x = (np.arange(xy_count, dtype=np.float32) + 0.5) * voxel_size - xy_size * 0.5
    y = (np.arange(xy_count, dtype=np.float32) + 0.5) * voxel_size - xy_size * 0.5
    z = (np.arange(z_count, dtype=np.float32) + 0.5) * (z_size / z_count) - z_size * 0.5
    return x[:, None, None], y[None, :, None], z[None, None, :], voxel_size


def spiral_distance(angle: np.ndarray, radius: np.ndarray, center_phase: np.ndarray) -> np.ndarray:
    return np.abs(wrap_angle(angle - center_phase)) * np.maximum(radius, 0.35)


def galaxy_color(radius: np.ndarray, outer_radius: float) -> np.ndarray:
    t = np.clip(radius / outer_radius, 0.0, 1.0)
    warm = np.array((1.0, 0.74, 0.43), dtype=np.float32)
    neutral = np.array((0.93, 0.95, 1.0), dtype=np.float32)
    cool = np.array((0.48, 0.64, 0.88), dtype=np.float32)
    warm_mix = np.clip(t / 0.38, 0.0, 1.0)[..., None]
    cool_mix = np.clip((t - 0.38) / 0.62, 0.0, 1.0)[..., None]
    inner = warm * (1.0 - warm_mix) + neutral * warm_mix
    return (inner * (1.0 - cool_mix) + cool * cool_mix).astype(np.float32)


def create_arms_field(config: dict, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    field = config["field"]
    core_x = float(field["coreOffsetX"])
    outer_radius = float(field["outerRadius"])
    rotation = math.radians(float(field["rotationDegrees"]))
    gx = x - core_x
    gy = y
    radius = np.sqrt(gx * gx + gy * gy)
    angle = np.arctan2(gy, gx)
    phase_curve = rotation + 2.42 * np.log1p(radius / 0.42)
    base_window = smooth_window(radius, 0.42, outer_radius, 0.34)
    cloud_2d = noise_field(gx[..., 0], gy[..., 0])[:, :, None]
    cloud_3d = noise_field(gx, gy, z)
    filament = np.clip((cloud_2d - 0.27) / 0.68, 0.0, 1.0) ** 1.35

    hero_distance = spiral_distance(angle, radius, phase_curve)
    hero_width = 0.23 + radius * 0.095
    hero = np.exp(-((hero_distance / hero_width) ** 2) * 1.38)
    hero_break = 1.0 - 0.97 * np.exp(-((radius - 3.55) / 0.48) ** 2)
    hero_break *= 1.0 - 0.58 * np.exp(-((radius - 5.45) / 0.34) ** 2)
    hero *= base_window * hero_break

    depth_distance = spiral_distance(angle, radius, phase_curve + math.pi)
    depth_width = 0.19 + radius * 0.076
    depth = np.exp(-((depth_distance / depth_width) ** 2) * 1.55)
    depth_break = 1.0 - 0.82 * np.exp(-((radius - 2.35) / 0.31) ** 2)
    depth_break *= 1.0 - 0.91 * np.exp(-((radius - 4.55) / 0.42) ** 2)
    depth_break *= 1.0 - 0.7 * np.exp(-((radius - 5.75) / 0.28) ** 2)
    depth *= base_window * depth_break * 0.58

    secondary_c_distance = spiral_distance(angle, radius, phase_curve + 1.37)
    secondary_c = np.exp(-((secondary_c_distance / (0.18 + radius * 0.055)) ** 2) * 1.8)
    secondary_c *= smooth_window(radius, 0.75, 3.05, 0.38) * 0.34

    secondary_d_distance = spiral_distance(angle, radius, phase_curve - 1.18)
    secondary_d = np.exp(-((secondary_d_distance / (0.23 + radius * 0.06)) ** 2) * 1.9)
    secondary_d *= smooth_window(radius, 4.15, 6.25, 0.34) * 0.18
    secondary_d *= np.clip((cloud_2d - 0.44) / 0.5, 0.0, 1.0)

    void_a = 1.0 - 0.93 * np.exp(-(((gx + 2.25) / 1.05) ** 2 + ((gy - 0.55) / 0.7) ** 2))
    void_b = 1.0 - 0.84 * np.exp(-(((gx - 1.6) / 0.72) ** 2 + ((gy + 2.35) / 0.62) ** 2))
    void_c = 1.0 - 0.72 * np.exp(-(((gx + 3.8) / 0.9) ** 2 + ((gy + 2.7) / 0.75) ** 2))
    void_mask = void_a * void_b * void_c

    hero_z = 0.1 + 0.055 * np.sin(radius * 1.7 + angle * 2.0)
    depth_z = -0.16 + 0.045 * np.cos(radius * 1.3 - angle)
    disk_thickness = 0.11 + radius * 0.012
    hero_volume = hero * np.exp(-((z - hero_z) / disk_thickness) ** 2)
    depth_volume = depth * np.exp(-((z - depth_z) / (disk_thickness * 1.22)) ** 2)
    secondary_volume = (secondary_c + secondary_d) * np.exp(-((z + 0.02) / (disk_thickness * 0.92)) ** 2)
    medium_variation = (0.16 + filament * 0.72 + cloud_3d * 0.2) * void_mask
    density = (hero_volume + depth_volume + secondary_volume) * medium_variation

    knot_spec = (
        (1.45, 0.0, 0.27, 1.1),
        (2.25, 0.0, 0.2, 0.72),
        (3.0, 0.0, 0.34, 0.88),
        (4.45, 0.0, 0.3, 0.62),
        (5.9, 0.0, 0.42, 0.48),
        (1.8, math.pi, 0.2, 0.55),
        (3.85, math.pi, 0.28, 0.48),
        (5.25, math.pi, 0.38, 0.34),
    )
    knot_density = np.zeros_like(density, dtype=np.float32)
    knot_emission = np.zeros_like(density, dtype=np.float32)
    for knot_radius, phase_offset, size, strength in knot_spec:
        knot_angle = rotation + 2.42 * math.log1p(knot_radius / 0.42) + phase_offset
        kx = core_x + knot_radius * math.cos(knot_angle)
        ky = knot_radius * math.sin(knot_angle)
        kz = 0.11 if phase_offset == 0.0 else -0.14
        blob = np.exp(-(((x - kx) / size) ** 2 + ((y - ky) / (size * 0.72)) ** 2 + ((z - kz) / (size * 0.5)) ** 2))
        knot_density += (blob * strength * 0.16).astype(np.float32)
        knot_emission += (blob * strength * 1.35).astype(np.float32)

    density = np.clip(density * 0.24 + knot_density, 0.0, 0.42).astype(np.float32)
    emission = np.clip(density * (2.1 + cloud_3d * 3.4) + knot_emission, 0.0, 3.6).astype(np.float32)
    color_2d = galaxy_color(radius[..., 0], outer_radius)
    color = np.broadcast_to(color_2d[:, :, None, :], density.shape + (3,)).copy()
    active = density > 0.0012
    density[~active] = 0.0
    emission[~active] = 0.0
    color[~active] = 0.0
    return density, emission, color.astype(np.float32)


def create_core_field(config: dict, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    core_x = float(config["field"]["coreOffsetX"])
    gx = x - core_x
    gy = y
    ellipsoid = np.sqrt((gx / 1.15) ** 2 + (gy / 1.0) ** 2 + (z / 0.58) ** 2)
    inner = np.exp(-((ellipsoid / 0.25) ** 2))
    mid = np.exp(-((ellipsoid / 0.58) ** 2))
    outer = np.exp(-((ellipsoid / 1.22) ** 2))
    texture = noise_field(gx * 1.45, gy * 1.45, z * 1.8)
    angle = np.arctan2(gy, gx)
    radius = np.sqrt(gx * gx + gy * gy)
    interruption_a = 1.0 - 0.76 * np.exp(-((wrap_angle(angle - 0.48 - radius * 0.58) / 0.17) ** 2))
    interruption_b = 1.0 - 0.54 * np.exp(-((wrap_angle(angle + 2.15 + radius * 0.4) / 0.24) ** 2))
    local_void = 1.0 - 0.62 * np.exp(-(((gx + 0.34) / 0.3) ** 2 + ((gy - 0.16) / 0.22) ** 2 + (z / 0.3) ** 2))
    breakup = np.clip(0.32 + texture * 0.9, 0.0, 1.2) * interruption_a * interruption_b * local_void
    density = np.clip((inner * 0.28 + mid * 0.18 + outer * 0.055) * breakup, 0.0, 0.32).astype(np.float32)
    emission = np.clip((inner * 5.0 + mid * 1.85 + outer * 0.34) * (0.34 + texture * 0.82) * interruption_a * local_void, 0.0, 5.5).astype(np.float32)
    warm = np.array((1.0, 0.86, 0.64), dtype=np.float32)
    ivory = np.array((1.0, 0.95, 0.82), dtype=np.float32)
    champagne = np.array((0.92, 0.76, 0.5), dtype=np.float32)
    core_mix = np.clip(ellipsoid[..., None] / 1.2, 0.0, 1.0)
    mid_mix = np.clip(ellipsoid[..., None] / 0.58, 0.0, 1.0)
    color = ivory * (1.0 - mid_mix) + warm * mid_mix
    color = color * (1.0 - core_mix * 0.52) + champagne * (core_mix * 0.52)
    active = density > 0.0008
    density[~active] = 0.0
    emission[~active] = 0.0
    color[~active] = 0.0
    return density, emission, color.astype(np.float32)


def create_dust_field(config: dict, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    field = config["field"]
    core_x = float(field["coreOffsetX"])
    outer_radius = float(field["outerRadius"])
    rotation = math.radians(float(field["rotationDegrees"]))
    gx = x - core_x
    gy = y
    radius = np.sqrt(gx * gx + gy * gy)
    angle = np.arctan2(gy, gx)
    phase_curve = rotation + 2.42 * np.log1p(radius / 0.42)
    cloud = noise_field(gx * 1.2, gy * 1.2, z * 0.8)
    hero_offset = 0.16 + 0.035 * np.sin(radius * 2.2)
    depth_offset = -0.13 + 0.045 * np.cos(radius * 1.7)
    hero_distance = spiral_distance(angle, radius, phase_curve + hero_offset)
    depth_distance = spiral_distance(angle, radius, phase_curve + math.pi + depth_offset)
    hero_width = 0.13 + radius * 0.035
    depth_width = 0.11 + radius * 0.03
    hero = np.exp(-((hero_distance / hero_width) ** 2) * 1.25)
    depth = np.exp(-((depth_distance / depth_width) ** 2) * 1.35) * 0.72
    radial_window = smooth_window(radius, 0.55, outer_radius - 0.25, 0.4)
    break_hero = 1.0 - 0.98 * np.exp(-((radius - 3.35) / 0.38) ** 2)
    break_hero *= 1.0 - 0.68 * np.exp(-((radius - 5.2) / 0.26) ** 2)
    break_depth = 1.0 - 0.9 * np.exp(-((radius - 2.65) / 0.3) ** 2)
    break_depth *= 1.0 - 0.84 * np.exp(-((radius - 4.7) / 0.36) ** 2)
    z_profile_hero = np.exp(-((z - 0.15 - 0.035 * np.sin(radius * 1.8)) / (0.085 + radius * 0.006)) ** 2)
    z_profile_depth = np.exp(-((z + 0.1 - 0.03 * np.cos(radius * 1.4)) / (0.075 + radius * 0.006)) ** 2)
    irregular = np.clip((cloud - 0.24) / 0.7, 0.0, 1.0) ** 1.2
    density = ((hero * break_hero * z_profile_hero) + (depth * break_depth * z_profile_depth)) * radial_window * irregular
    density = np.clip(density * 0.72, 0.0, 0.78).astype(np.float32)
    density[density < 0.002] = 0.0
    emission = np.clip(density * 1.4, 0.0, 1.0).astype(np.float32)
    return density, emission


def create_halo_field(config: dict, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    core_x = float(config["field"]["coreOffsetX"])
    gx = x - core_x
    gy = y
    radius = np.sqrt(gx * gx + gy * gy)
    angle = np.arctan2(gy, gx)
    ellipsoid = np.sqrt((gx / 6.6) ** 2 + (gy / 5.8) ** 2 + (z / 1.35) ** 2)
    cloud = noise_field(gx * 0.62, gy * 0.62, z * 0.9)
    sector = 0.35 + 0.65 * np.clip(0.5 + 0.5 * np.sin(angle * 2.0 + radius * 0.72), 0.0, 1.0)
    missing = 1.0 - 0.82 * np.exp(-((wrap_angle(angle - 2.25) / 0.52) ** 2))
    density = np.exp(-((ellipsoid / 0.8) ** 2) * 1.6) * cloud * sector * missing
    density *= smooth_window(radius, 0.8, 7.0, 0.7)
    density = np.clip(density * 0.009, 0.0, 0.012).astype(np.float32)
    emission = np.clip(density * 9.0, 0.0, 0.08).astype(np.float32)
    color = np.zeros(density.shape + (3,), dtype=np.float32)
    color[..., 0] = 0.42
    color[..., 1] = 0.52
    color[..., 2] = 0.68
    active = density > 0.00015
    density[~active] = 0.0
    emission[~active] = 0.0
    color[~active] = 0.0
    return density, emission, color


def write_vdb(path: Path, density: np.ndarray, emission: np.ndarray, color: np.ndarray | None, config: dict) -> dict:
    field = config["field"]
    xy_size = float(field["worldSizeXY"])
    z_size = float(field["worldSizeZ"])
    xy_count = int(field["resolutionXY"])
    z_count = int(field["resolutionZ"])
    voxel_size = xy_size / xy_count
    z_scale = (z_size / z_count) / voxel_size
    transform = openvdb.createLinearTransform(voxelSize=voxel_size)
    transform.postScale((1.0, 1.0, z_scale))
    transform.postTranslate((-xy_size * 0.5, -xy_size * 0.5, -z_size * 0.5))
    grids = []
    for name, values in (("density", density), ("emission", emission)):
        grid = openvdb.FloatGrid()
        grid.name = name
        grid.gridClass = openvdb.GridClass.FOG_VOLUME
        grid.transform = transform.deepCopy()
        grid.copyFromArray(values)
        grids.append(grid)
    if color is not None:
        color_grid = openvdb.Vec3SGrid()
        color_grid.name = "color"
        color_grid.transform = transform.deepCopy()
        color_grid.copyFromArray(color)
        grids.append(color_grid)
    path.parent.mkdir(parents=True, exist_ok=True)
    openvdb.write(str(path), grids=grids)
    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "activeVoxels": int(np.count_nonzero(density)),
        "maxDensity": float(np.max(density)),
        "maxEmission": float(np.max(emission)),
    }


def create_volume_material(name: str, density_scale: float, emission_scale: float, fallback_color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    density_attribute = nodes.new("ShaderNodeAttribute")
    emission_attribute = nodes.new("ShaderNodeAttribute")
    color_attribute = nodes.new("ShaderNodeAttribute")
    density_multiply = nodes.new("ShaderNodeMath")
    emission_multiply = nodes.new("ShaderNodeMath")
    density_attribute.attribute_name = "density"
    emission_attribute.attribute_name = "emission"
    color_attribute.attribute_name = "color"
    density_multiply.operation = "MULTIPLY"
    density_multiply.inputs[1].default_value = density_scale
    emission_multiply.operation = "MULTIPLY"
    emission_multiply.inputs[1].default_value = emission_scale
    volume.inputs["Color"].default_value = fallback_color
    volume.inputs["Emission Color"].default_value = fallback_color
    volume.inputs["Anisotropy"].default_value = 0.16
    links.new(density_attribute.outputs["Fac"], density_multiply.inputs[0])
    links.new(emission_attribute.outputs["Fac"], emission_multiply.inputs[0])
    links.new(density_multiply.outputs[0], volume.inputs["Density"])
    links.new(emission_multiply.outputs[0], volume.inputs["Emission Strength"])
    links.new(color_attribute.outputs["Color"], volume.inputs["Color"])
    links.new(color_attribute.outputs["Color"], volume.inputs["Emission Color"])
    links.new(volume.outputs["Volume"], output.inputs["Volume"])
    return material


def create_dust_material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    density_attribute = nodes.new("ShaderNodeAttribute")
    density_multiply = nodes.new("ShaderNodeMath")
    density_attribute.attribute_name = "density"
    density_multiply.operation = "MULTIPLY"
    density_multiply.inputs[1].default_value = 5.2
    volume.inputs["Color"].default_value = (0.018, 0.011, 0.007, 1.0)
    volume.inputs["Absorption Color"].default_value = (0.003, 0.002, 0.0015, 1.0)
    volume.inputs["Emission Strength"].default_value = 0.0
    volume.inputs["Anisotropy"].default_value = 0.22
    links.new(density_attribute.outputs["Fac"], density_multiply.inputs[0])
    links.new(density_multiply.outputs[0], volume.inputs["Density"])
    links.new(volume.outputs["Volume"], output.inputs["Volume"])
    return material


def create_dust_mask_material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    volume = nodes.new("ShaderNodeVolumePrincipled")
    density_attribute = nodes.new("ShaderNodeAttribute")
    emission_attribute = nodes.new("ShaderNodeAttribute")
    density_multiply = nodes.new("ShaderNodeMath")
    emission_multiply = nodes.new("ShaderNodeMath")
    density_attribute.attribute_name = "density"
    emission_attribute.attribute_name = "emission"
    density_multiply.operation = "MULTIPLY"
    density_multiply.inputs[1].default_value = 0.35
    emission_multiply.operation = "MULTIPLY"
    emission_multiply.inputs[1].default_value = 4.0
    volume.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    volume.inputs["Emission Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    links.new(density_attribute.outputs["Fac"], density_multiply.inputs[0])
    links.new(emission_attribute.outputs["Fac"], emission_multiply.inputs[0])
    links.new(density_multiply.outputs[0], volume.inputs["Density"])
    links.new(emission_multiply.outputs[0], volume.inputs["Emission Strength"])
    links.new(volume.outputs["Volume"], output.inputs["Volume"])
    return material


def create_volume_object(scene: bpy.types.Scene, collection: bpy.types.Collection, name: str, vdb_path: Path, material: bpy.types.Material) -> bpy.types.Object:
    volume = bpy.data.volumes.new(name)
    volume.filepath = str(vdb_path)
    volume.is_sequence = False
    volume.materials.append(material)
    obj = bpy.data.objects.new(name, volume)
    collection.objects.link(obj)
    obj.visible_shadow = True
    return obj


def configure_scene(scene: bpy.types.Scene, config: dict) -> None:
    render = config["render"]
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = int(render["width"])
    scene.render.resolution_y = int(render["height"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.image_settings.compression = 18
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = float(render["exposure"])
    scene.world.color = (0.0, 0.0, 0.0)
    scene.cycles.samples = int(render["samples"])
    scene.cycles.use_denoising = bool(render["denoise"])
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.01
    scene.cycles.volume_step_rate = 0.65
    scene.cycles.volume_max_steps = 1024
    scene.cycles.volume_bounces = 2
    scene.cycles.transparent_max_bounces = 12


def create_camera(scene: bpy.types.Scene, config: dict) -> None:
    camera_collection = bpy.data.collections.new("GalaxyV11_Camera")
    scene.collection.children.link(camera_collection)
    camera_data = bpy.data.cameras.new("GalaxyV11LookdevCamera")
    camera = bpy.data.objects.new("GalaxyV11LookdevCamera", camera_data)
    camera_collection.objects.link(camera)
    camera.location = config["camera"]["location"]
    camera_data.lens = float(config["camera"]["lensMm"])
    camera_data.sensor_width = 36.0
    target = Vector(config["camera"]["target"])
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def main() -> int:
    args = parse_args()
    started = time.perf_counter()
    config_path = Path(args.config).resolve()
    output_path = Path(args.output).resolve()
    output_dir = Path(args.output_dir).resolve()
    report_path = Path(args.report).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    output_dir.mkdir(parents=True, exist_ok=True)
    clear_scene()
    scene = bpy.context.scene
    configure_scene(scene, config)
    create_camera(scene, config)
    collections = {}
    for layer, name in LAYER_COLLECTIONS.items():
        collection = bpy.data.collections.new(name)
        scene.collection.children.link(collection)
        collections[layer] = collection

    x, y, z, _ = create_coordinates(config)
    vdb_reports = {}

    arms = create_arms_field(config, x, y, z)
    arms_path = output_dir / "galaxy-v11-arms.vdb"
    vdb_reports["arms"] = write_vdb(arms_path, *arms, config)
    create_volume_object(scene, collections["arms"], "GalaxyV11ArmsVolume", arms_path, create_volume_material("GalaxyV11ArmsMaterial", 2.2, 1.55, (0.78, 0.84, 0.95, 1.0)))
    del arms

    core = create_core_field(config, x, y, z)
    core_path = output_dir / "galaxy-v11-core.vdb"
    vdb_reports["core"] = write_vdb(core_path, *core, config)
    create_volume_object(scene, collections["core"], "GalaxyV11CoreVolume", core_path, create_volume_material("GalaxyV11CoreMaterial", 2.4, 1.35, (1.0, 0.86, 0.64, 1.0)))
    del core

    dust = create_dust_field(config, x, y, z)
    dust_path = output_dir / "galaxy-v11-dust.vdb"
    vdb_reports["dust"] = write_vdb(dust_path, dust[0], dust[1], None, config)
    dust_obj = create_volume_object(scene, collections["dust"], "GalaxyV11DustVolume", dust_path, create_dust_material("GalaxyV11DustMaterial"))
    dust_obj["beautyMaterial"] = "GalaxyV11DustMaterial"
    dust_obj["maskMaterial"] = "GalaxyV11DustMaskMaterial"
    create_dust_mask_material("GalaxyV11DustMaskMaterial")
    del dust

    halo = create_halo_field(config, x, y, z)
    halo_path = output_dir / "galaxy-v11-halo.vdb"
    vdb_reports["halo"] = write_vdb(halo_path, *halo, config)
    create_volume_object(scene, collections["halo"], "GalaxyV11HaloVolume", halo_path, create_volume_material("GalaxyV11HaloMaterial", 1.0, 0.75, (0.42, 0.52, 0.68, 1.0)))
    del halo

    scene["galaxyHeroAssetVersion"] = "v1.1"
    scene["galaxyHeroAssetMode"] = "multilayer-openvdb"
    scene["galaxyHeroRenderBackend"] = config["render"]["backend"]
    scene["galaxyHeroCameraAngleDegrees"] = config["camera"]["angleDegrees"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path), check_existing=False)
    build_seconds = time.perf_counter() - started
    report = {
        "schemaVersion": config["schemaVersion"],
        "status": "ok",
        "scene": str(output_path),
        "architecture": "independent analytic OpenVDB layers",
        "camera": {"name": scene.camera.name, "angleDegrees": config["camera"]["angleDegrees"]},
        "collections": LAYER_COLLECTIONS,
        "vdb": vdb_reports,
        "resolution": {"width": config["render"]["width"], "height": config["render"]["height"]},
        "samples": config["render"]["samples"],
        "buildSeconds": round(build_seconds, 6),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
