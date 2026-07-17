import argparse
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Vector


CONFIGS = {
    "r1": {
        "seed": 3101,
        "stars": 94000,
        "core": 6000,
        "dust": 8000,
        "clouds": 0,
        "cloud_regions": 3,
        "thickness": 0.78,
        "edge_extension": 0.09,
        "volume_factor": 0.0018,
        "nebula_alpha": 0.022,
        "contrast": 0.94,
        "description": "restrained realistic",
    },
    "r2": {
        "seed": 3202,
        "stars": 120000,
        "core": 10000,
        "dust": 12000,
        "clouds": 0,
        "cloud_regions": 5,
        "thickness": 1.00,
        "edge_extension": 0.18,
        "volume_factor": 0.0021,
        "nebula_alpha": 0.030,
        "contrast": 1.00,
        "description": "cinematic volume",
    },
    "r3": {
        "seed": 3303,
        "stars": 147000,
        "core": 13000,
        "dust": 16000,
        "clouds": 0,
        "cloud_regions": 6,
        "thickness": 1.28,
        "edge_extension": 0.35,
        "volume_factor": 0.0024,
        "nebula_alpha": 0.036,
        "contrast": 1.04,
        "description": "grand cosmic depth",
    },
}

PALETTE = {
    "deep": (0.010, 0.035, 0.12, 1.0),
    "ice": (0.18, 0.55, 1.0, 1.0),
    "violet": (0.22, 0.13, 0.48, 1.0),
    "white": (0.72, 0.88, 1.0, 1.0),
    "warm": (1.0, 0.57, 0.27, 1.0),
    "gold": (1.0, 0.75, 0.43, 1.0),
    "dust": (0.003, 0.008, 0.022, 1.0),
}


def srgb_to_linear(v):
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def ensure_clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.compression = 15
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 2048
    scene.render.pixel_aspect_x = 1
    scene.render.pixel_aspect_y = 1
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.image_settings.color_management = "FOLLOW_SCENE"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -0.25
    scene.view_settings.gamma = 1.0
    scene.render.fps = 30
    scene.render.use_file_extension = True
    return scene


def load_reference(path):
    image = bpy.data.images.load(path, check_existing=False)
    image.colorspace_settings.name = "sRGB"
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape(height, width, 4)
    rgba = np.flipud(rgba)
    # Blender exposes decoded sRGB image pixels in scene-linear form.
    rgb = np.clip(rgba[..., :3], 0.0, 1.0)
    alpha = np.clip(rgba[..., 3], 0.0, 1.0)
    bpy.data.images.remove(image)
    return rgb, alpha


def build_sampling_tables(rgb, alpha):
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x = (xx - w * 0.5) / (w * 0.5)
    y = -(yy - h * 0.5) / (h * 0.5)
    # The visible E2 texture is wider than tall. Elliptical radius is only used
    # to set density/thickness, not to invent particle positions.
    er = np.sqrt((x / 0.78) ** 2 + (y / 0.52) ** 2)
    lum = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    valid = alpha > 0.012
    weights = np.where(valid, alpha ** 1.28 * (0.18 + np.sqrt(np.clip(lum, 0, 1))), 0.0)
    edge = valid & (alpha < 0.45) & (er > 0.48)
    core = valid & (er < 0.22)
    dust = valid & (alpha > 0.18) & (lum < 0.16) & (er > 0.12) & (er < 0.80)
    return {
        "rgb": rgb,
        "alpha": alpha,
        "lum": lum,
        "x": x,
        "y": y,
        "er": er,
        "weights": weights,
        "edge": edge,
        "core": core,
        "dust": dust,
    }


def sample_indices(rng, weight_map, count):
    flat = weight_map.ravel().astype(np.float64)
    total = flat.sum()
    if total <= 0:
        raise RuntimeError("Empty sampling mask")
    flat /= total
    return rng.choice(flat.size, size=count, replace=True, p=flat)


def pixels_to_world(table, indices, rng, cfg, role="stars"):
    h, w = table["alpha"].shape
    ys, xs = np.divmod(indices, w)
    sx = table["x"].ravel()[indices]
    sy = table["y"].ravel()[indices]
    er = table["er"].ravel()[indices]
    lum = table["lum"].ravel()[indices]
    alpha = table["alpha"].ravel()[indices]
    rgb = table["rgb"].reshape(-1, 3)[indices]

    # Preserve source UV exactly, with only sub-pixel point jitter.
    jitter = 0.0032 if role == "stars" else 0.0050
    wx = sx * 4.15 + rng.normal(0.0, jitter, len(indices))
    wy = sy * 4.15 + rng.normal(0.0, jitter, len(indices))

    core_zone = er < 0.24
    mid_zone = (er >= 0.24) & (er < 0.67)
    outer_zone = er >= 0.67
    half = np.empty(len(indices), dtype=np.float32)
    half[core_zone] = 0.070
    half[mid_zone] = 0.045
    half[outer_zone] = 0.025
    half *= cfg["thickness"]
    # Truncated normal distributes particles continuously through Z.
    z = np.clip(rng.normal(0.0, half * 0.43), -half, half)
    cluster = (lum > 0.58) & (rng.random(len(indices)) < 0.075)
    z[cluster] = np.clip(
        rng.normal(0.0, 0.070 * cfg["thickness"], cluster.sum()),
        -0.100 * cfg["thickness"],
        0.100 * cfg["thickness"],
    )

    # Three to five source-driven edge sectors receive a short tangent-biased
    # extension. It never generates an ellipse or a full particle ring.
    edge = (alpha < 0.40) & outer_zone
    angle = np.arctan2(wy / 2.2, wx / 3.3)
    sector = (
        ((angle > 0.15) & (angle < 1.25))
        | ((angle > 2.48) | (angle < -2.70))
        | ((angle > -1.40) & (angle < -0.45))
    )
    extend = edge & sector & (rng.random(len(indices)) < cfg["edge_extension"])
    if extend.any():
        sign = np.where(wx[extend] >= 0, 1.0, -1.0)
        radial_x = wx[extend] / np.maximum(np.sqrt(wx[extend] ** 2 + wy[extend] ** 2), 1e-4)
        radial_y = wy[extend] / np.maximum(np.sqrt(wx[extend] ** 2 + wy[extend] ** 2), 1e-4)
        tangent_x = -radial_y * sign
        tangent_y = radial_x * sign
        distance = rng.exponential(0.055 + 0.035 * cfg["thickness"], extend.sum())
        distance = np.clip(distance, 0.0, 0.48 if cfg["description"].startswith("grand") else 0.28)
        if cfg["description"].startswith("grand"):
            right_up = (angle[extend] > 0.15) & (angle[extend] < 1.25)
            distance[right_up] *= 1.45
        wx[extend] += distance * (0.58 * radial_x + 0.42 * tangent_x)
        wy[extend] += distance * (0.58 * radial_y + 0.42 * tangent_y)

    positions = np.column_stack([wx, wy, z]).astype(np.float32)
    return positions, rgb, lum, alpha, er


def palette_bucket(rgb, lum, er, rng, core=False):
    if core:
        choice = rng.random(len(lum))
        labels = np.where(choice < 0.58, "warm", np.where(choice < 0.86, "gold", "white"))
        return labels
    blue = rgb[:, 2]
    red = rgb[:, 0]
    choice = rng.random(len(lum))
    labels = np.full(len(lum), "ice", dtype="<U8")
    labels[(blue > red * 1.38) & (lum < 0.33)] = "deep"
    labels[(red > blue * 0.74) & (blue > 0.22) & (lum < 0.48)] = "violet"
    labels[(lum > 0.55) | (choice > 0.94)] = "white"
    labels[(er < 0.23) & (choice < 0.52)] = "warm"
    labels[(er < 0.23) & (choice >= 0.52) & (choice < 0.80)] = "gold"
    return labels


def star_tiers(rng, count):
    p = rng.random(count)
    tiers = np.zeros(count, dtype=np.int8)
    tiers[(p >= 0.80) & (p < 0.97)] = 1
    tiers[p >= 0.97] = 2
    return tiers


def make_emission_material(name, rgba, strength=1.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    mat.diffuse_color = (*rgba[:3], alpha)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    emission = nt.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = rgba
    emission.inputs["Strength"].default_value = strength
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = alpha
    nt.links.new(trans.outputs[0], mix.inputs[1])
    nt.links.new(emission.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return mat


def make_dust_material(name, alpha):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = PALETTE["dust"]
    bsdf.inputs["Roughness"].default_value = 0.96
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = alpha
    nt.links.new(trans.outputs[0], mix.inputs[1])
    nt.links.new(bsdf.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return mat


def make_volume_material(name, color, density, seed):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    volume = nt.nodes.new("ShaderNodeVolumePrincipled")
    texcoord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 3.6
    noise.inputs["Detail"].default_value = 4.8
    noise.inputs["Roughness"].default_value = 0.72
    noise.inputs["Distortion"].default_value = 0.22
    noise.inputs["W"].default_value = seed * 0.173
    dist = nt.nodes.new("ShaderNodeVectorMath")
    dist.operation = "DISTANCE"
    dist.inputs[1].default_value = (0.5, 0.5, 0.5)
    fade = nt.nodes.new("ShaderNodeMapRange")
    fade.inputs["From Min"].default_value = 0.10
    fade.inputs["From Max"].default_value = 0.48
    fade.inputs["To Min"].default_value = 1.0
    fade.inputs["To Max"].default_value = 0.0
    fade.clamp = True
    multiply = nt.nodes.new("ShaderNodeMath")
    multiply.operation = "MULTIPLY"
    strength = nt.nodes.new("ShaderNodeMath")
    strength.operation = "MULTIPLY"
    strength.inputs[1].default_value = density
    nt.links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    nt.links.new(texcoord.outputs["Generated"], dist.inputs[0])
    nt.links.new(dist.outputs["Value"], fade.inputs["Value"])
    nt.links.new(noise.outputs["Fac"], multiply.inputs[0])
    nt.links.new(fade.outputs["Result"], multiply.inputs[1])
    nt.links.new(multiply.outputs[0], strength.inputs[0])
    nt.links.new(strength.outputs[0], volume.inputs["Density"])
    volume.inputs["Color"].default_value = color
    if "Emission Color" in volume.inputs:
        volume.inputs["Emission Color"].default_value = color
    if "Emission Strength" in volume.inputs:
        volume.inputs["Emission Strength"].default_value = 0.005
    nt.links.new(volume.outputs["Volume"], out.inputs["Volume"])
    return mat


def make_volume_box(name, center, scale, rotation, material, collection, root):
    verts = [
        (-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
        (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1),
    ]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = root
    obj.location = center
    obj.scale = scale
    obj.rotation_euler[2] = rotation
    return obj


def make_point_instance_object(name, positions, radius, material, collection, root):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(positions.tolist(), [], [])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = root
    modifier = obj.modifiers.new(name="PointInstances", type="NODES")
    ng = bpy.data.node_groups.new(name + "Nodes", "GeometryNodeTree")
    ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes = ng.nodes
    links = ng.links
    group_in = nodes.new("NodeGroupInput")
    group_out = nodes.new("NodeGroupOutput")
    mesh_to_points = nodes.new("GeometryNodeMeshToPoints")
    mesh_to_points.mode = "VERTICES"
    mesh_to_points.inputs["Radius"].default_value = radius
    set_mat = nodes.new("GeometryNodeSetMaterial")
    set_mat.inputs["Material"].default_value = material
    links.new(group_in.outputs["Geometry"], mesh_to_points.inputs["Mesh"])
    # Native point-cloud geometry keeps 100k–180k particles practical in
    # Eevee Next while retaining true 3D positions and perspective sizing.
    links.new(mesh_to_points.outputs["Points"], set_mat.inputs["Geometry"])
    links.new(set_mat.outputs["Geometry"], group_out.inputs["Geometry"])
    modifier.node_group = ng
    return obj


def make_camera(scene):
    data = bpy.data.cameras.new("Camera")
    data.lens = 68
    data.sensor_width = 36
    data.dof.use_dof = False
    camera = bpy.data.objects.new("Camera", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    return camera


def point_camera(camera, location, target=(0.0, 0.0, 0.0)):
    camera.location = location
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_world(scene):
    world = bpy.data.worlds.new("TransparentWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    bg.inputs["Strength"].default_value = 0.0
    scene.world = world


def setup_compositor(scene):
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    render = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"
    glare.quality = "HIGH"
    glare.threshold = 0.72
    glare.size = 6
    glare.mix = -0.94
    composite = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(render.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], composite.inputs["Image"])


def build_candidate(scene, table, name, cfg):
    rng = np.random.default_rng(cfg["seed"])
    collection = bpy.data.collections.new(name.upper() + "Galaxy")
    scene.collection.children.link(collection)
    root = bpy.data.objects.new(name.upper() + "GalaxyRoot", None)
    collection.objects.link(root)
    # A fixed horizontal composition. Perspective cameras prove depth; this root
    # rotation is shared by all candidates and does not use a visible texture plane.
    root.rotation_euler = (0.0, 0.0, math.radians(-6.0))

    materials = {}
    for key, rgba in PALETTE.items():
        if key == "dust":
            continue
        strength = 0.74 if key == "deep" else (1.05 if key in {"white", "gold"} else 0.90)
        materials[key] = make_emission_material(f"{name}-{key}", rgba, strength * cfg["contrast"], 0.92)
    dust_material = make_dust_material(f"{name}-dust", 0.20 if name == "r1" else 0.24)
    cloud_colors = {
        "blue": (0.012, 0.065, 0.28, 1),
        "ice": (0.035, 0.18, 0.55, 1),
        "violet": (0.16, 0.035, 0.29, 1),
    }

    # Main source-driven stellar disk.
    idx = sample_indices(rng, table["weights"], cfg["stars"])
    pos, rgb, lum, alpha, er = pixels_to_world(table, idx, rng, cfg, "stars")
    labels = palette_bucket(rgb, lum, er, rng)
    tiers = star_tiers(rng, len(idx))
    radii = (0.00172, 0.00372, 0.00855)
    for palette_name in ("deep", "ice", "violet", "white", "warm", "gold"):
        for tier in range(3):
            mask = (labels == palette_name) & (tiers == tier)
            if not mask.any():
                continue
            radius = radii[tier] * (1.0 + 0.04 * (cfg["thickness"] - 1.0))
            make_point_instance_object(
                f"{name}-Stars-{palette_name}-{tier}", pos[mask], radius,
                materials[palette_name], collection, root,
            )

    # Warm continuous 3D core, generated as a volume rather than an image plane.
    ccount = cfg["core"]
    angle = rng.uniform(0.0, math.tau, ccount)
    radial = np.clip(rng.gamma(1.40, 0.080, ccount), 0.0, 0.36)
    cx = np.cos(angle) * radial * 1.22
    cy = np.sin(angle) * radial * 0.72
    cz_sigma = 0.034 * cfg["thickness"] * (1.0 - 0.55 * np.clip(radial, 0, 1))
    cz = np.clip(rng.normal(0.0, cz_sigma), -0.070 * cfg["thickness"], 0.070 * cfg["thickness"])
    cpos = np.column_stack([cx, cy, cz]).astype(np.float32)
    clabels = palette_bucket(np.zeros((ccount, 3)), np.ones(ccount), radial, rng, core=True)
    ctiers = star_tiers(rng, ccount)
    core_radii = (0.00182, 0.00395, 0.0091)
    for palette_name in ("warm", "gold", "white"):
        for tier in range(3):
            mask = (clabels == palette_name) & (ctiers == tier)
            if mask.any():
                make_point_instance_object(
                    f"{name}-Core-{palette_name}-{tier}", cpos[mask], core_radii[tier],
                    materials[palette_name], collection, root,
                )

    # 3D dust is sampled only from genuine dark source lanes. It locally occludes
    # emission behind it; no inverse-luminance ellipse or closed black ring exists.
    dweights = table["dust"].astype(np.float64) * table["alpha"] * (1.0 - table["lum"])
    didx = sample_indices(rng, dweights, cfg["dust"])
    dpos, _, _, _, der = pixels_to_world(table, didx, rng, cfg, "dust")
    dpos[:, 2] += rng.normal(0.015, 0.012 * cfg["thickness"], len(didx))
    # Keep dust grains fine and irregular.
    make_point_instance_object(f"{name}-Dust", dpos, 0.0032, dust_material, collection, root)

    # Local volumetric nebulae: source-driven clusters with real Z distribution,
    # never a plane and never a full elliptical fog sheet.
    region_centers = [
        (1.58, 0.72, "blue"), (-1.45, -0.36, "ice"),
        (0.35, -1.02, "violet"), (-0.35, 0.92, "blue"),
        (2.05, -0.34, "ice"), (-2.05, 0.35, "violet"),
    ][: cfg["cloud_regions"]]
    for i, (px, py, color_name) in enumerate(region_centers):
        local_angle = math.atan2(py / 2.2, px / 3.3) + math.pi * 0.52
        density = cfg["nebula_alpha"] * cfg["volume_factor"] * (1.0 + 0.13 * (i % 3))
        material = make_volume_material(
            f"{name}-NebulaMaterial-{i}", cloud_colors[color_name], density, cfg["seed"] + i,
        )
        make_volume_box(
            f"{name}-Nebula-{i}", (px, py, (-0.015 + 0.012 * (i % 3))),
            (0.64 + 0.07 * i, 0.18 + 0.025 * (i % 2), 0.11 * cfg["thickness"]),
            local_angle, material, collection, root,
        )

    return root, {
        "star_particles": int(cfg["stars"] + cfg["core"]),
        "disk_particles": int(cfg["stars"]),
        "core_particles": int(cfg["core"]),
        "dust_particles": int(cfg["dust"]),
        "nebula_points": 0,
        "nebula_volume_objects": int(cfg["cloud_regions"]),
        "nebula_regions": int(cfg["cloud_regions"]),
        "thickness_multiplier": cfg["thickness"],
        "size_tiers": {"micro": 0.80, "medium": 0.17, "bright": 0.03},
        "uses_visible_e2_plane": False,
    }


def render_view(scene, camera, out_path, view):
    if view == "front":
        scene.render.resolution_x = 2048
        scene.render.resolution_y = 2048
        camera.data.lens = 68
        point_camera(camera, (0.0, -5.70, 20.0))
    elif view == "tilt":
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 900
        camera.data.lens = 70
        point_camera(camera, (0.0, -11.2, 17.2))
    else:
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 900
        camera.data.lens = 68
        point_camera(camera, (0.0, -20.0, 3.5))
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--candidate", choices=sorted(CONFIGS), required=True)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    os.makedirs(args.output, exist_ok=True)
    started = time.time()
    scene = ensure_clean_scene()
    setup_world(scene)
    rgb, alpha = load_reference(args.source)
    table = build_sampling_tables(rgb, alpha)
    cfg = CONFIGS[args.candidate]
    _, stats = build_candidate(scene, table, args.candidate, cfg)
    camera = make_camera(scene)
    render_view(scene, camera, os.path.join(args.output, f"{args.candidate}-galaxy-rgba.png"), "front")
    render_view(scene, camera, os.path.join(args.output, f"{args.candidate}-tilt.png"), "tilt")
    render_view(scene, camera, os.path.join(args.output, f"{args.candidate}-side.png"), "side")
    stats["render_seconds"] = round(time.time() - started, 2)
    stats["candidate"] = args.candidate.upper()
    stats["description"] = cfg["description"]
    stats["blender_version"] = bpy.app.version_string
    stats["engine"] = "BLENDER_EEVEE_NEXT"
    stats["color_management"] = "AgX / Medium High Contrast"
    stats["source_used_only_for_sampling"] = True
    with open(os.path.join(args.output, f"{args.candidate}-render-stats.json"), "w", encoding="utf-8") as fh:
        json.dump(stats, fh, ensure_ascii=False, indent=2)
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
