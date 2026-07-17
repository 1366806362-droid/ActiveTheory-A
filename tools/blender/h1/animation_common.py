import argparse
import importlib.util
import json
import math
import os
import sys
import time
from pathlib import Path

import bpy
import numpy as np


BASE_SCRIPT = str(Path(__file__).with_name("volume_common.py"))


def load_base_module():
    spec = importlib.util.spec_from_file_location("galaxy_base", BASE_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def emission_strength(palette_name):
    if palette_name == "deep":
        return 0.74
    if palette_name in {"white", "gold"}:
        return 1.05
    return 0.90


def set_loop_rotation(obj, multiplier, amplitude_deg=0.65):
    frames = list(range(1, 193, 6))
    if frames[-1] != 192:
        frames.append(192)
    for frame in frames:
        phase = (frame - 1) / 191.0
        obj.rotation_euler[2] = math.radians(amplitude_deg) * multiplier * math.sin(math.tau * phase)
        obj.keyframe_insert(data_path="rotation_euler", index=2, frame=frame)
    for curve in obj.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"


def set_root_depth_motion(root):
    frames = list(range(1, 193, 8))
    if frames[-1] != 192:
        frames.append(192)
    for frame in frames:
        phase = (frame - 1) / 191.0
        root.rotation_euler[0] = math.radians(0.12) * math.sin(math.tau * phase)
        root.rotation_euler[1] = math.radians(0.08) * math.sin(math.tau * phase + math.pi * 0.35)
        root.keyframe_insert(data_path="rotation_euler", index=0, frame=frame)
        root.keyframe_insert(data_path="rotation_euler", index=1, frame=frame)
    for curve in root.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"


def animate_twinkle(materials):
    frames = list(range(1, 193, 12))
    if frames[-1] != 192:
        frames.append(192)
    for index, material in enumerate(materials):
        emission = next((node for node in material.node_tree.nodes if node.type == "EMISSION"), None)
        if emission is None:
            continue
        base = emission.inputs["Strength"].default_value
        phase_offset = index * 0.77
        for frame in frames:
            phase = (frame - 1) / 191.0
            value = base * (1.0 + 0.028 * math.sin(math.tau * phase * 2.0 + phase_offset))
            emission.inputs["Strength"].default_value = value
            emission.inputs["Strength"].keyframe_insert("default_value", frame=frame)
        action = material.node_tree.animation_data.action if material.node_tree.animation_data else None
        if action:
            for curve in action.fcurves:
                for point in curve.keyframe_points:
                    point.interpolation = "BEZIER"
                    point.handle_left_type = "AUTO_CLAMPED"
                    point.handle_right_type = "AUTO_CLAMPED"


def build_r21(scene, base, table):
    cfg = {
        "seed": 3211,
        "stars": 120000,
        "core": 10000,
        "dust": 12000,
        "cloud_regions": 5,
        "thickness": 1.0,
        "edge_extension": 0.18,
        "nebula_alpha": 0.030,
        "volume_factor": 0.0021,
        "contrast": 1.0,
        "description": "cinematic volume r2.1",
    }
    rng = np.random.default_rng(cfg["seed"])
    collection = bpy.data.collections.new("R21Galaxy")
    scene.collection.children.link(collection)
    root = bpy.data.objects.new("R21GalaxyRoot", None)
    collection.objects.link(root)
    root.rotation_euler[2] = math.radians(-6.0)

    inner_root = bpy.data.objects.new("R21InnerArmsRoot", None)
    outer_root = bpy.data.objects.new("R21OuterArmsRoot", None)
    core_root = bpy.data.objects.new("R21CoreRoot", None)
    dust_root = bpy.data.objects.new("R21DustRoot", None)
    nebula_root = bpy.data.objects.new("R21NebulaRoot", None)
    for child in (inner_root, outer_root, core_root, dust_root, nebula_root):
        collection.objects.link(child)
        child.parent = root

    weights = table["weights"].copy()
    mid_mask = (table["er"] >= 0.24) & (table["er"] < 0.67)
    weights[mid_mask] *= 1.18
    idx = base.sample_indices(rng, weights, cfg["stars"])
    pos, rgb, lum, alpha, er = base.pixels_to_world(table, idx, rng, cfg, "stars")
    labels = base.palette_bucket(rgb, lum, er, rng)
    tiers = base.star_tiers(rng, len(idx))
    radii = (0.00172, 0.00372, 0.00855)
    bright_materials = []
    zone_masks = {
        "inner": er < 0.24,
        "mid": (er >= 0.24) & (er < 0.67),
        "outer": er >= 0.67,
    }
    for zone_name, zone_mask in zone_masks.items():
        parent = outer_root if zone_name == "outer" else inner_root
        for palette_name in ("deep", "ice", "violet", "white", "warm", "gold"):
            for tier in range(3):
                mask = zone_mask & (labels == palette_name) & (tiers == tier)
                if not mask.any():
                    continue
                visibility_gain = 1.0
                if zone_name == "mid" and palette_name in {"ice", "white"}:
                    visibility_gain *= 1.12
                if tier == 2:
                    visibility_gain *= 1.04
                material = base.make_emission_material(
                    f"R21-{zone_name}-{palette_name}-{tier}",
                    base.PALETTE[palette_name],
                    emission_strength(palette_name) * visibility_gain,
                    0.92,
                )
                if tier == 2 and zone_name != "outer":
                    bright_materials.append(material)
                base.make_point_instance_object(
                    f"R21-{zone_name}-{palette_name}-{tier}",
                    pos[mask], radii[tier], material, collection, parent,
                )

    ccount = cfg["core"]
    angle = rng.uniform(0.0, math.tau, ccount)
    radial = np.clip(rng.gamma(1.40, 0.080, ccount), 0.0, 0.36)
    cx = np.cos(angle) * radial * 1.22
    cy = np.sin(angle) * radial * 0.72
    cz_sigma = 0.034 * (1.0 - 0.55 * np.clip(radial, 0, 1))
    cz = np.clip(rng.normal(0.0, cz_sigma), -0.070, 0.070)
    cpos = np.column_stack([cx, cy, cz]).astype(np.float32)
    clabels = base.palette_bucket(np.zeros((ccount, 3)), np.ones(ccount), radial, rng, core=True)
    ctiers = base.star_tiers(rng, ccount)
    core_radii = (0.00182, 0.00395, 0.0091)
    for palette_name in ("warm", "gold", "white"):
        for tier in range(3):
            mask = (clabels == palette_name) & (ctiers == tier)
            if not mask.any():
                continue
            material = base.make_emission_material(
                f"R21-Core-{palette_name}-{tier}",
                base.PALETTE[palette_name],
                emission_strength(palette_name) * 1.12 * (1.03 if tier == 2 else 1.0),
                0.92,
            )
            base.make_point_instance_object(
                f"R21-Core-{palette_name}-{tier}", cpos[mask], core_radii[tier],
                material, collection, core_root,
            )

    dust_material = base.make_dust_material("R21-DustMaterial", 0.24)
    dweights = table["dust"].astype(np.float64) * table["alpha"] * (1.0 - table["lum"])
    didx = base.sample_indices(rng, dweights, cfg["dust"])
    dpos, _, _, _, _ = base.pixels_to_world(table, didx, rng, cfg, "dust")
    dpos[:, 2] += rng.normal(0.015, 0.012, len(didx))
    base.make_point_instance_object("R21-Dust", dpos, 0.0032, dust_material, collection, dust_root)

    cloud_colors = {
        "blue": (0.012, 0.065, 0.28, 1),
        "ice": (0.035, 0.18, 0.55, 1),
        "violet": (0.16, 0.035, 0.29, 1),
    }
    region_centers = [
        (1.58, 0.72, "blue"), (-1.45, -0.36, "ice"),
        (0.35, -1.02, "violet"), (-0.35, 0.92, "blue"),
        (2.05, -0.34, "ice"),
    ]
    for i, (px, py, color_name) in enumerate(region_centers):
        local_angle = math.atan2(py / 2.2, px / 3.3) + math.pi * 0.52
        density = cfg["nebula_alpha"] * cfg["volume_factor"] * 0.97 * (1.0 + 0.13 * (i % 3))
        material = base.make_volume_material(
            f"R21-NebulaMaterial-{i}", cloud_colors[color_name], density, cfg["seed"] + i,
        )
        base.make_volume_box(
            f"R21-Nebula-{i}", (px, py, -0.015 + 0.012 * (i % 3)),
            (0.64 + 0.07 * i, 0.18 + 0.025 * (i % 2), 0.11),
            local_angle, material, collection, nebula_root,
        )

    set_loop_rotation(inner_root, 1.000)
    set_loop_rotation(core_root, 1.000)
    set_loop_rotation(outer_root, 0.970)
    set_loop_rotation(dust_root, 0.985)
    set_loop_rotation(nebula_root, 0.940)
    set_root_depth_motion(root)
    animate_twinkle(bright_materials)
    return root, {
        "star_particles": 130000,
        "disk_particles": 120000,
        "core_particles": 10000,
        "dust_particles": 12000,
        "nebula_volume_objects": 5,
        "mid_arm_density_weight_gain": 0.18,
        "mid_ice_white_visibility_gain": 0.12,
        "core_visibility_gain": 0.12,
        "nebula_strength_change": -0.03,
        "speeds": {"inner": 1.0, "outer": 0.97, "nebula": 0.94, "dust": 0.985},
        "rotation_amplitude_degrees": 0.65,
        "uses_visible_e2_plane": False,
    }


def render_key(scene, camera, output, frame, name):
    scene.frame_set(frame)
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 2048
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = os.path.join(output, f"r21-galaxy-rgba-{name}.png")
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--frames", required=True)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    os.makedirs(args.output, exist_ok=True)
    os.makedirs(args.frames, exist_ok=True)
    base = load_base_module()
    started = time.time()
    scene = base.ensure_clean_scene()
    base.setup_world(scene)
    rgb, alpha = base.load_reference(args.source)
    table = base.build_sampling_tables(rgb, alpha)
    _, stats = build_r21(scene, base, table)
    camera = base.make_camera(scene)
    camera.data.lens = 68
    base.point_camera(camera, (0.0, -5.70, 20.0))
    scene.frame_start = 1
    scene.frame_end = 192
    scene.render.fps = 24
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = os.path.join(args.frames, "r21_")
    bpy.ops.render.render(animation=True)
    render_key(scene, camera, args.output, 1, "start")
    render_key(scene, camera, args.output, 96, "middle")
    render_key(scene, camera, args.output, 192, "end")
    stats.update({
        "frames": 192,
        "fps": 24,
        "duration_seconds": 8,
        "render_seconds": round(time.time() - started, 2),
        "blender_version": bpy.app.version_string,
        "engine": "BLENDER_EEVEE_NEXT",
        "color_management": "AgX / Medium High Contrast",
    })
    with open(os.path.join(args.output, "r21-render-stats.json"), "w", encoding="utf-8") as fh:
        json.dump(stats, fh, ensure_ascii=False, indent=2)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(args.frames), "r21-dynamic.blend"))
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
