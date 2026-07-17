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


SCRIPT_DIR = Path(__file__).resolve().parent
BASE_SCRIPT = str(SCRIPT_DIR / "volume_common.py")
R21_SCRIPT = str(SCRIPT_DIR / "animation_common.py")


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def smoothstep(edge0, edge1, value):
    t = np.clip((value - edge0) / max(edge1 - edge0, 1e-6), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def build_edge_mask(table):
    x = table["x"]
    y = table["y"]
    er = table["er"]
    alpha = table["alpha"]
    low_noise = (
        0.54
        + 0.18 * np.sin(x * 8.1 + y * 3.2 + 0.7)
        + 0.13 * np.sin(x * 3.7 - y * 9.4 + 2.0)
        + 0.10 * np.cos(x * 11.3 + y * 6.2 - 0.4)
    )
    low_noise = np.clip(low_noise, 0.08, 0.95)
    outer_band = smoothstep(0.58, 0.96, er)
    soft_alpha_edge = 1.0 - smoothstep(0.38, 0.78, alpha)
    right_up = smoothstep(0.08, 0.48, x) * smoothstep(0.00, 0.45, y) * 0.62
    right_low = smoothstep(0.12, 0.50, x) * (1.0 - smoothstep(-0.36, 0.02, y)) * 0.48
    left_short = (1.0 - smoothstep(-0.48, -0.10, x)) * smoothstep(-0.20, 0.40, y) * 0.40
    lower_gap = smoothstep(-0.48, -0.10, -y) * smoothstep(-0.35, 0.30, x) * 0.28
    sector = np.clip(right_up + right_low + left_short + lower_gap, 0.0, 0.72)
    dissolve = outer_band * soft_alpha_edge * sector * (0.48 + 0.52 * low_noise)
    mask = np.clip(1.0 - dissolve, 0.22, 1.0)
    mask[alpha <= 0.002] = 0.0
    return mask.astype(np.float32), dissolve.astype(np.float32), sector.astype(np.float32)


def save_mask_image(mask, path):
    h, w = mask.shape
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = mask[..., None]
    rgba[..., 3] = 1.0
    image = bpy.data.images.new("H1EdgeDissolveMask", width=w, height=h, alpha=True, float_buffer=False)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(np.flipud(rgba).ravel())
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    return image


def make_curved_disk_mesh(name, table, segments=96, extent=8.30):
    alpha = table["alpha"]
    h, w = alpha.shape
    verts = []
    faces = []
    uvs = []
    for j in range(segments + 1):
        v = j / segments
        py = int(round((1.0 - v) * (h - 1)))
        for i in range(segments + 1):
            u = i / segments
            px = int(round(u * (w - 1)))
            x = (u - 0.5) * extent
            y = (v - 0.5) * extent
            a = float(alpha[py, px])
            er = math.sqrt(((u - 0.5) / 0.39) ** 2 + ((v - 0.5) / 0.26) ** 2)
            low = math.sin(x * 0.72 + y * 0.31 + 0.4) * 0.014
            low += math.cos(x * 0.38 - y * 0.84 - 0.9) * 0.009
            core_bump = math.exp(-((er / 0.30) ** 2)) * 0.026
            z = np.clip(a * (low + core_bump), -0.040, 0.055)
            verts.append((x, y, float(z)))
            uvs.append((u, v))
    stride = segments + 1
    for j in range(segments):
        for i in range(segments):
            a = j * stride + i
            b = a + 1
            c = a + stride + 1
            d = a + stride
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]
    return mesh


def make_disk_material(source_path, mask_image):
    mat = bpy.data.materials.new("H1CurvedE2Material")
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    mat.use_transparency_overlap = False
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    transparent = nt.nodes.new("ShaderNodeBsdfTransparent")
    emission = nt.nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 0.83
    mix = nt.nodes.new("ShaderNodeMixShader")
    uv = nt.nodes.new("ShaderNodeTexCoord")
    color_tex = nt.nodes.new("ShaderNodeTexImage")
    color_image = bpy.data.images.load(source_path, check_existing=True)
    color_image.colorspace_settings.name = "sRGB"
    color_tex.image = color_image
    mask_tex = nt.nodes.new("ShaderNodeTexImage")
    mask_tex.image = mask_image
    mask_tex.interpolation = "Linear"
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    alpha_mul = nt.nodes.new("ShaderNodeMath")
    alpha_mul.operation = "MULTIPLY"
    alpha_strength = nt.nodes.new("ShaderNodeMath")
    alpha_strength.operation = "MULTIPLY"
    alpha_strength.inputs[1].default_value = 0.94
    nt.links.new(uv.outputs["UV"], color_tex.inputs["Vector"])
    nt.links.new(uv.outputs["UV"], mask_tex.inputs["Vector"])
    nt.links.new(color_tex.outputs["Color"], emission.inputs["Color"])
    nt.links.new(mask_tex.outputs["Color"], sep.inputs["Color"])
    nt.links.new(color_tex.outputs["Alpha"], alpha_mul.inputs[0])
    nt.links.new(sep.outputs["Red"], alpha_mul.inputs[1])
    nt.links.new(alpha_mul.outputs[0], alpha_strength.inputs[0])
    nt.links.new(alpha_strength.outputs[0], mix.inputs[0])
    nt.links.new(transparent.outputs[0], mix.inputs[1])
    nt.links.new(emission.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def make_loop_arc(obj, base_z_deg=-6.0, amplitude_deg=2.40):
    frames = list(range(1, 193, 6))
    if frames[-1] != 192:
        frames.append(192)
    for frame in frames:
        phase = (frame - 1) / 191.0
        arc = 0.5 - 0.5 * math.cos(math.tau * phase)
        obj.rotation_euler[2] = math.radians(base_z_deg + amplitude_deg * arc)
        obj.keyframe_insert(data_path="rotation_euler", index=2, frame=frame)
    for curve in obj.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "BEZIER"
            point.handle_left_type = "AUTO_CLAMPED"
            point.handle_right_type = "AUTO_CLAMPED"


def make_nebula_drift(root):
    frames = list(range(1, 193, 8))
    if frames[-1] != 192:
        frames.append(192)
    for frame in frames:
        phase = (frame - 1) / 191.0
        arc = 0.5 - 0.5 * math.cos(math.tau * phase)
        root.location.x = 0.018 * math.sin(math.tau * phase)
        root.location.y = 0.012 * math.sin(math.tau * phase + 0.45)
        root.rotation_euler[2] = math.radians(0.42 * arc)
        root.keyframe_insert(data_path="location", index=0, frame=frame)
        root.keyframe_insert(data_path="location", index=1, frame=frame)
        root.keyframe_insert(data_path="rotation_euler", index=2, frame=frame)


def build_h1(scene, base, r21, table, source_path, mask_path):
    rng = np.random.default_rng(4101)
    collection = bpy.data.collections.new("H1HybridGalaxy")
    scene.collection.children.link(collection)
    root = bpy.data.objects.new("H1HybridRoot", None)
    collection.objects.link(root)
    disk_root = bpy.data.objects.new("H1CurvedDiskRoot", None)
    particle_root = bpy.data.objects.new("H1EdgeParticlesRoot", None)
    core_root = bpy.data.objects.new("H1CoreStarsRoot", None)
    nebula_root = bpy.data.objects.new("H1NebulaRoot", None)
    for child in (disk_root, particle_root, core_root, nebula_root):
        collection.objects.link(child)
        child.parent = root

    mask, dissolve, sectors = build_edge_mask(table)
    mask_image = save_mask_image(mask, mask_path)
    disk_mesh = make_curved_disk_mesh("H1CurvedGalaxyDisk", table, 96, 8.30)
    disk_material = make_disk_material(source_path, mask_image)
    disk_mesh.materials.append(disk_material)
    disk = bpy.data.objects.new("H1CurvedGalaxyDisk", disk_mesh)
    collection.objects.link(disk)
    disk.parent = disk_root

    cfg = {
        "thickness": 1.0,
        "edge_extension": 0.42,
        "description": "hybrid h1",
    }
    alpha = table["alpha"]
    lum = table["lum"]
    er = table["er"]
    edge_gate = smoothstep(0.42, 0.90, er) * sectors
    removed = alpha * dissolve
    weights = (0.35 + np.sqrt(np.clip(lum, 0.0, 1.0))) * (
        removed * 3.5 + alpha * edge_gate * 0.42
    )
    weights *= (alpha > 0.008)
    particle_count = 40000
    indices = base.sample_indices(rng, weights, particle_count)
    positions, rgb, pl_lum, pl_alpha, pl_er = base.pixels_to_world(table, indices, rng, cfg, "stars")
    labels = base.palette_bucket(rgb, pl_lum, pl_er, rng)
    tiers = base.star_tiers(rng, particle_count)
    z = positions[:, 2]
    layers = np.full(particle_count, "mid", dtype="<U5")
    layers[z < -0.010] = "rear"
    layers[z > 0.010] = "front"
    radii = (0.00155, 0.00345, 0.0078)
    layer_radius = {"rear": 0.82, "mid": 1.0, "front": 1.18}
    layer_strength = {"rear": 0.62, "mid": 0.82, "front": 1.02}
    bright_materials = []
    for layer_name in ("rear", "mid", "front"):
        for palette_name in ("deep", "ice", "violet", "white", "warm", "gold"):
            base_strength = 0.54 if palette_name == "deep" else (0.94 if palette_name in {"white", "gold"} else 0.76)
            for tier in range(3):
                use = (layers == layer_name) & (labels == palette_name) & (tiers == tier)
                if not use.any():
                    continue
                material = base.make_emission_material(
                    f"H1-{layer_name}-{palette_name}-{tier}", base.PALETTE[palette_name],
                    base_strength * layer_strength[layer_name] * (1.04 if tier == 2 else 1.0), 0.90,
                )
                if tier == 2 and layer_name != "rear":
                    bright_materials.append(material)
                base.make_point_instance_object(
                    f"H1-{layer_name}-{palette_name}-{tier}", positions[use],
                    radii[tier] * layer_radius[layer_name], material, collection, particle_root,
                )

    core_count = 4000
    theta = rng.uniform(0.0, math.tau, core_count)
    radius = np.clip(rng.gamma(1.35, 0.065, core_count), 0.0, 0.25)
    core_positions = np.column_stack([
        np.cos(theta) * radius * 1.18,
        np.sin(theta) * radius * 0.72,
        np.clip(rng.normal(0.0, 0.030, core_count), -0.070, 0.070),
    ]).astype(np.float32)
    core_labels = base.palette_bucket(np.zeros((core_count, 3)), np.ones(core_count), radius, rng, core=True)
    core_tiers = base.star_tiers(rng, core_count)
    core_radii = (0.00155, 0.00345, 0.0076)
    for palette_name in ("warm", "gold", "white"):
        for tier in range(3):
            use = (core_labels == palette_name) & (core_tiers == tier)
            if not use.any():
                continue
            material = base.make_emission_material(
                f"H1-Core-{palette_name}-{tier}", base.PALETTE[palette_name],
                (0.86 if palette_name == "warm" else 0.94) * (1.02 if tier == 2 else 1.0), 0.88,
            )
            base.make_point_instance_object(
                f"H1-Core-{palette_name}-{tier}", core_positions[use], core_radii[tier],
                material, collection, core_root,
            )

    cloud_colors = {
        "blue": (0.010, 0.050, 0.21, 1),
        "ice": (0.025, 0.13, 0.38, 1),
        "violet": (0.105, 0.025, 0.19, 1),
        "warm": (0.16, 0.065, 0.025, 1),
    }
    cloud_regions = [
        (1.62, 0.72, "blue", 0.000040),
        (-1.48, -0.30, "ice", 0.000034),
        (0.42, 0.18, "warm", 0.000022),
        (1.88, -0.50, "violet", 0.000030),
    ]
    for i, (px, py, color_name, density) in enumerate(cloud_regions):
        local_angle = math.atan2(py / 2.2, px / 3.3) + math.pi * 0.52
        material = base.make_volume_material(
            f"H1-NebulaMaterial-{i}", cloud_colors[color_name], density, 4101 + i,
        )
        base.make_volume_box(
            f"H1-Nebula-{i}", (px, py, -0.020 + 0.018 * (i % 3)),
            (0.70 + 0.05 * i, 0.16 + 0.025 * (i % 2), 0.12),
            local_angle, material, collection, nebula_root,
        )

    make_loop_arc(root, -6.0, 2.40)
    make_nebula_drift(nebula_root)
    r21.animate_twinkle(bright_materials)
    return root, {
        "disk_subdivision": "96x96",
        "disk_vertices": 97 * 97,
        "disk_faces": 96 * 96,
        "disk_z_min": -0.040,
        "disk_z_max": 0.055,
        "edge_dissolve_radial_start": 0.58,
        "edge_dissolve_radial_end": 0.96,
        "edge_dissolve_min_mask": 0.22,
        "edge_particle_count": particle_count,
        "core_particle_count": core_count,
        "total_3d_particles": particle_count + core_count,
        "nebula_regions": len(cloud_regions),
        "rotation_amplitude_degrees": 2.40,
        "uses_e2_texture": True,
        "uses_flat_static_plane": False,
    }


def render_debug(scene, base, camera, output, name, location, lens):
    scene.frame_set(96)
    old_lens = camera.data.lens
    old_loc = camera.location.copy()
    camera.data.lens = lens
    base.point_camera(camera, location)
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = os.path.join(output, f"h1-{name}.png")
    bpy.ops.render.render(write_still=True)
    camera.data.lens = old_lens
    base.point_camera(camera, tuple(old_loc))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--frames", required=True)
    parser.add_argument("--mask", required=True)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    os.makedirs(args.output, exist_ok=True)
    os.makedirs(args.frames, exist_ok=True)
    os.makedirs(os.path.dirname(args.mask), exist_ok=True)
    base = load_module(BASE_SCRIPT, "h1_base")
    r21 = load_module(R21_SCRIPT, "h1_r21")
    started = time.time()
    scene = base.ensure_clean_scene()
    base.setup_world(scene)
    scene.view_settings.exposure = -0.04
    rgb, alpha = base.load_reference(args.source)
    table = base.build_sampling_tables(rgb, alpha)
    _, stats = build_h1(scene, base, r21, table, args.source, args.mask)
    camera = base.make_camera(scene)
    camera.data.lens = 68
    base.point_camera(camera, (0.0, -5.70, 20.0))
    scene.frame_start = 1
    scene.frame_end = 192
    scene.render.fps = 24
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = os.path.join(args.frames, "h1_")
    bpy.ops.render.render(animation=True)
    render_debug(scene, base, camera, args.output, "tilt", (0.0, -12.5, 12.5), 58)
    render_debug(scene, base, camera, args.output, "side", (0.0, -19.0, 2.8), 58)
    stats.update({
        "frames": 192,
        "fps": 24,
        "duration_seconds": 8,
        "render_seconds": round(time.time() - started, 2),
        "blender_version": bpy.app.version_string,
        "engine": "BLENDER_EEVEE_NEXT",
        "color_management": "AgX / Medium High Contrast",
        "exposure_ev": -0.04,
    })
    with open(os.path.join(args.output, "h1-render-stats.json"), "w", encoding="utf-8") as fh:
        json.dump(stats, fh, ensure_ascii=False, indent=2)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(args.frames), "h1-hybrid.blend"))
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
