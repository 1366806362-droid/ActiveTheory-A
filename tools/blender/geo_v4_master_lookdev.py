"""Generate and render the GEO V4.1.9 high-fidelity Blender master lookdev.

This script intentionally targets offline visual fidelity rather than GLB or
real-time limits. It creates a deterministic Blender master scene, three
lighting/material candidates, supporting closeups and render passes.

Run:
    blender.exe --background --factory-startup --python tools/blender/geo_v4_master_lookdev.py
"""

from __future__ import annotations

import json
import math
import random
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector


SEED = 41901
RNG = random.Random(SEED)
SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[2]
OUTPUT_DIR = PROJECT_ROOT / "art" / "geo-scene" / "v419-blender-master-lookdev"
BLEND_PATH = OUTPUT_DIR / "geo-v4-master-lookdev.blend"
CORE = Vector((0.0, 0.20, -0.55))
QUICK_RENDER = "--quick" in sys.argv
PREVIEW_ONLY = "--preview-only" in sys.argv


@dataclass(frozen=True)
class Hole:
    u: float
    v: float
    ru: float
    rv: float
    angle: float
    phase: float
    open_sign: float = 0.0


@dataclass(frozen=True)
class MembraneSpec:
    name: str
    role: str
    center: tuple[float, float]
    scale: tuple[float, float]
    rotation: float
    depth: float
    phase: float
    thickness: float
    resolution: tuple[int, int]
    holes: tuple[Hole, ...]


MEMBRANES = (
    # Rear neural canopy: overlapping sheets create a continuous ceiling,
    # while their openings preserve real depth.
    MembraneSpec(
        "Rear_Canopy_Left", "rear", (-4.1, 2.45), (3.7, 2.35), -0.12,
        3.15, 0.4, 0.055, (48, 34),
        (
            Hole(-0.28, 0.10, 0.10, 0.34, -0.45, 0.7, -1),
            Hole(0.30, -0.22, 0.13, 0.25, 0.55, 2.1, 1),
        ),
    ),
    MembraneSpec(
        "Rear_Canopy_Center", "rear", (0.0, 2.85), (3.4, 1.95), 0.05,
        3.75, 1.2, 0.048, (46, 32),
        (
            Hole(-0.18, -0.06, 0.09, 0.31, 0.10, 1.8, -1),
            Hole(0.38, 0.15, 0.08, 0.23, -0.70, 3.2, 1),
        ),
    ),
    MembraneSpec(
        "Rear_Canopy_Right", "rear", (4.25, 2.35), (3.45, 2.25), 0.16,
        3.35, 2.0, 0.052, (46, 33),
        (
            Hole(-0.30, -0.08, 0.11, 0.29, 0.55, 2.8, -1),
            Hole(0.28, 0.18, 0.08, 0.22, -0.15, 4.2, 1),
        ),
    ),
    # Mid living tissue: the three semantic regions overlap through two
    # convergence membranes instead of connecting as three tubes.
    MembraneSpec(
        "Mid_Answer_Tissue", "mid", (-4.0, 1.15), (3.25, 2.45), 0.20,
        1.15, 2.7, 0.075, (54, 40),
        (
            Hole(-0.34, 0.10, 0.07, 0.31, -0.55, 3.0, -1),
            Hole(0.08, -0.22, 0.10, 0.25, 0.42, 4.1, 1),
            Hole(0.40, 0.20, 0.07, 0.19, -0.18, 5.3, 0),
        ),
    ),
    MembraneSpec(
        "Mid_Citation_Tissue", "mid", (3.85, 1.65), (2.95, 2.20), -0.22,
        1.35, 3.6, 0.070, (52, 38),
        (
            Hole(-0.18, 0.02, 0.07, 0.26, 0.62, 1.6, 1),
            Hole(0.34, -0.18, 0.09, 0.22, -0.38, 2.9, -1),
        ),
    ),
    MembraneSpec(
        "Mid_Keyword_Tissue", "mid", (3.75, -2.05), (3.10, 1.80), 0.23,
        1.00, 4.4, 0.068, (52, 34),
        (
            Hole(-0.28, 0.05, 0.065, 0.27, -0.52, 4.7, -1),
            Hole(0.27, -0.10, 0.08, 0.20, 0.36, 5.8, 1),
        ),
    ),
    MembraneSpec(
        "Mid_Convergence_Left", "mid", (-1.35, -0.05), (2.35, 1.65), -0.42,
        0.75, 5.1, 0.060, (48, 34),
        (Hole(-0.08, 0.02, 0.055, 0.30, -0.18, 5.7, 1),),
    ),
    MembraneSpec(
        "Mid_Convergence_Right", "mid", (1.30, -0.22), (2.40, 1.70), 0.45,
        0.88, 5.8, 0.060, (48, 34),
        (Hole(0.10, -0.04, 0.052, 0.27, 0.25, 0.8, -1),),
    ),
    MembraneSpec(
        "Mid_Lower_Bridge", "mid", (-0.15, -2.25), (3.10, 1.30), -0.08,
        1.80, 6.5, 0.050, (48, 30),
        (Hole(-0.22, 0.12, 0.08, 0.24, 0.62, 2.2, 1),),
    ),
    # Foreground veils occupy only edge fragments. Their strong depth and DOF
    # provide enclosure without becoming top/bottom masks.
    MembraneSpec(
        "Foreground_Left_Veil", "foreground", (-6.15, -2.65), (2.55, 2.25), 0.40,
        -2.00, 7.2, 0.095, (44, 34),
        (Hole(0.14, 0.05, 0.09, 0.33, 0.55, 3.3, -1),),
    ),
    MembraneSpec(
        "Foreground_Top_Veil", "foreground", (-1.80, 4.15), (3.45, 1.55), -0.16,
        -1.55, 7.9, 0.085, (46, 28),
        (Hole(-0.18, -0.10, 0.08, 0.26, -0.36, 4.1, 1),),
    ),
    MembraneSpec(
        "Foreground_Right_Veil", "foreground", (6.30, 0.00), (2.30, 2.50), -0.30,
        -1.75, 8.6, 0.090, (42, 36),
        (Hole(-0.10, 0.10, 0.07, 0.30, 0.30, 5.0, -1),),
    ),
)


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    t = max(0.0, min(1.0, (value - edge0) / max(edge1 - edge0, 1e-8)))
    return t * t * (3.0 - 2.0 * t)


def noise2(x: float, z: float, phase: float) -> float:
    return (
        math.sin(x * 1.37 + z * 1.09 + phase) * 0.48
        + math.sin(x * 2.93 - z * 2.11 + phase * 0.73) * 0.29
        + math.cos(x * 6.17 + z * 4.71 - phase * 1.27) * 0.16
        + math.sin(x * 11.1 - z * 8.4 + phase * 0.31) * 0.07
    )


def membrane_boundary(u: float, v: float, spec: MembraneSpec) -> bool:
    angle = math.atan2(v, u)
    radius = math.sqrt((u / 1.0) ** 2 + (v / 0.92) ** 2)
    contour = (
        0.94
        + math.sin(angle * 3.0 + spec.phase) * 0.085
        + math.sin(angle * 5.0 - spec.phase * 0.63) * 0.052
        + noise2(u * 1.8, v * 2.1, spec.phase) * 0.045
    )
    notch = max(
        0.0,
        math.sin(angle * 2.0 + spec.phase * 1.3) * 0.055
        + math.sin(angle * 7.0 - spec.phase) * 0.028,
    )
    return radius < contour - notch


def hole_distance(u: float, v: float, hole: Hole) -> tuple[float, float, float]:
    c = math.cos(hole.angle)
    s = math.sin(hole.angle)
    du = u - hole.u
    dv = v - hole.v
    along = du * c + dv * s
    across = -du * s + dv * c
    taper = 1.0 + abs(along / max(hole.rv, 1e-6)) * 0.55
    irregular = 1.0 + math.sin(along * 19.0 + hole.phase) * 0.17
    distance = math.sqrt(
        (across / max(hole.ru * irregular / taper, 1e-6)) ** 2
        + (along / max(hole.rv, 1e-6)) ** 2
    )
    return distance, along, across


def map_membrane(u: float, v: float, spec: MembraneSpec) -> Vector:
    sx, sz = spec.scale
    c = math.cos(spec.rotation)
    s = math.sin(spec.rotation)
    lx = u * sx
    lz = v * sz
    x = spec.center[0] + lx * c - lz * s
    z = spec.center[1] + lx * s + lz * c

    role_factor = 0.72 if spec.role == "rear" else 1.0 if spec.role == "mid" else 1.30
    fold = (
        math.sin(u * 3.2 + v * 1.7 + spec.phase) * 0.55
        + math.sin(v * 5.1 - u * 2.4 - spec.phase * 0.6) * 0.30
        + noise2(u * 3.6, v * 3.9, spec.phase) * 0.28
    ) * role_factor
    twist = u * v * (0.72 if spec.role == "mid" else 0.45)
    edge = smoothstep(0.48, 1.0, math.sqrt(u * u + v * v))
    curl = (
        math.sin(math.atan2(v, u) * 3.0 + spec.phase) * edge * 0.58 * role_factor
    )
    core_distance = math.sqrt((x / 2.35) ** 2 + ((z + 0.55) / 1.72) ** 2)
    attraction = 1.0 - smoothstep(0.10, 1.75, core_distance)
    cavity = attraction * attraction * (2.15 if spec.role == "mid" else 0.85)

    y = spec.depth + fold + twist + curl + cavity
    x += math.sin(v * 3.1 + spec.phase) * 0.18 * role_factor
    z += math.sin(u * 3.7 - spec.phase) * 0.14 * role_factor
    return Vector((x, y, z))


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.worlds,
        bpy.data.textures,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def ensure_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for source in list(obj.users_collection):
        source.objects.unlink(obj)
    collection.objects.link(obj)


def set_input(node: bpy.types.Node, names: tuple[str, ...], value) -> bool:
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return True
    return False


def make_membrane_material(name: str, role: str) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (760, 0)
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    transparent.location = (-80, 160)
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    principled.location = (-60, 0)
    principled.name = "MembraneBody"
    set_input(principled, ("Base Color",), (0.004, 0.045, 0.085, 1.0))
    set_input(principled, ("Roughness",), 0.42 if role == "mid" else 0.52)
    set_input(principled, ("Metallic",), 0.0)
    set_input(principled, ("Transmission Weight", "Transmission"), 0.72)
    set_input(principled, ("IOR",), 1.38)
    set_input(principled, ("Subsurface Weight", "Subsurface"), 0.06 if role == "mid" else 0.025)

    texcoord = nodes.new("ShaderNodeTexCoord")
    texcoord.location = (-980, -80)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-770, -60)
    noise.name = "BodyNoise"
    noise.inputs["Scale"].default_value = 1.7 if role == "rear" else 2.4
    noise.inputs["Detail"].default_value = 7.0
    noise.inputs["Roughness"].default_value = 0.72
    noise.inputs["Distortion"].default_value = 0.28
    detail_noise = nodes.new("ShaderNodeTexNoise")
    detail_noise.location = (-760, -300)
    detail_noise.inputs["Scale"].default_value = 12.0
    detail_noise.inputs["Detail"].default_value = 5.0
    detail_noise.inputs["Roughness"].default_value = 0.65
    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    links.new(texcoord.outputs["Generated"], detail_noise.inputs["Vector"])

    body_multiply = nodes.new("ShaderNodeMath")
    body_multiply.operation = "MULTIPLY"
    body_multiply.location = (-300, 180)
    body_multiply.name = "BodyVisibility"
    body_multiply.inputs[1].default_value = 0.28 if role == "rear" else 0.44 if role == "mid" else 0.30
    links.new(noise.outputs["Fac"], body_multiply.inputs[0])

    body_mix = nodes.new("ShaderNodeMixShader")
    body_mix.location = (160, 100)
    links.new(body_multiply.outputs[0], body_mix.inputs[0])
    links.new(transparent.outputs[0], body_mix.inputs[1])
    links.new(principled.outputs[0], body_mix.inputs[2])

    layer_weight = nodes.new("ShaderNodeLayerWeight")
    layer_weight.location = (-730, 300)
    layer_weight.inputs["Blend"].default_value = 0.34
    invert = nodes.new("ShaderNodeMath")
    invert.operation = "SUBTRACT"
    invert.location = (-500, 310)
    invert.inputs[0].default_value = 1.0
    links.new(layer_weight.outputs["Facing"], invert.inputs[1])
    edge_mult = nodes.new("ShaderNodeMath")
    edge_mult.operation = "MULTIPLY"
    edge_mult.location = (-275, 310)
    links.new(invert.outputs[0], edge_mult.inputs[0])
    links.new(detail_noise.outputs["Fac"], edge_mult.inputs[1])

    edge_color = nodes.new("ShaderNodeMixRGB")
    edge_color.blend_type = "MIX"
    edge_color.location = (-40, -240)
    edge_color.inputs[1].default_value = (0.0, 0.0, 0.0, 1.0)
    edge_color.inputs[2].default_value = (
        (0.18, 0.72, 1.0, 1.0)
        if role != "foreground"
        else (0.10, 0.40, 0.58, 1.0)
    )
    links.new(edge_mult.outputs[0], edge_color.inputs[0])

    emission = nodes.new("ShaderNodeEmission")
    emission.location = (180, -180)
    emission.name = "EdgeEmission"
    emission.inputs["Strength"].default_value = 0.16 if role == "mid" else 0.07
    links.new(edge_color.outputs[0], emission.inputs["Color"])

    add = nodes.new("ShaderNodeAddShader")
    add.location = (490, 20)
    links.new(body_mix.outputs[0], add.inputs[0])
    links.new(emission.outputs[0], add.inputs[1])
    links.new(add.outputs[0], output.inputs["Surface"])
    return material


def make_emission_material(name: str, color: tuple[float, float, float, float], strength: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.name = "Emission"
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = strength
    material.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def make_dark_fiber_material(name: str, color: tuple[float, float, float, float], strength: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    set_input(principled, ("Base Color",), color)
    set_input(principled, ("Roughness",), 0.5)
    emission = nodes.new("ShaderNodeEmission")
    emission.name = "Emission"
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = strength
    add = nodes.new("ShaderNodeAddShader")
    material.node_tree.links.new(principled.outputs[0], add.inputs[0])
    material.node_tree.links.new(emission.outputs[0], add.inputs[1])
    material.node_tree.links.new(add.outputs[0], output.inputs["Surface"])
    return material


def create_membrane(spec: MembraneSpec, material: bpy.types.Material, collection: bpy.types.Collection) -> bpy.types.Object:
    columns, rows = spec.resolution
    vertices: list[Vector] = []
    uvs: list[tuple[float, float]] = []
    index_map: dict[tuple[int, int], int] = {}

    for row in range(rows + 1):
        v = row / rows * 2.0 - 1.0
        for column in range(columns + 1):
            u = column / columns * 2.0 - 1.0
            if not membrane_boundary(u, v, spec):
                continue
            index_map[(column, row)] = len(vertices)
            vertices.append(map_membrane(u, v, spec))
            uvs.append(((u + 1.0) * 0.5, (v + 1.0) * 0.5))

    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows):
        for column in range(columns):
            corners = (
                index_map.get((column, row)),
                index_map.get((column + 1, row)),
                index_map.get((column + 1, row + 1)),
                index_map.get((column, row + 1)),
            )
            if any(index is None for index in corners):
                continue
            u = (column + 0.5) / columns * 2.0 - 1.0
            v = (row + 0.5) / rows * 2.0 - 1.0
            remove = False
            for hole in spec.holes:
                distance, along, across = hole_distance(u, v, hole)
                if distance < 1.0:
                    remove = True
                    break
                if hole.open_sign != 0:
                    sign = 1.0 if hole.open_sign > 0 else -1.0
                    if (
                        along * sign > hole.rv * 0.45
                        and abs(across) < hole.ru * 0.40
                        and noise2(u * 8.0, v * 7.0, hole.phase) > -0.12
                    ):
                        remove = True
                        break
            if not remove:
                faces.append(corners)  # type: ignore[arg-type]

    mesh = bpy.data.meshes.new(f"{spec.name}_Geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    uv_layer = mesh.uv_layers.new(name="OrganicUV")
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]

    obj = bpy.data.objects.new(spec.name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["lookdevRole"] = spec.role
    obj["deterministicSeed"] = SEED

    subdiv = obj.modifiers.new("Lookdev_Subdivision", "SUBSURF")
    subdiv.subdivision_type = "CATMULL_CLARK"
    subdiv.levels = 1
    subdiv.render_levels = 2
    subdiv.show_only_control_edges = True

    displace_texture = bpy.data.textures.new(f"{spec.name}_FoldTexture", type="CLOUDS")
    displace_texture.noise_scale = 0.42 if spec.role == "mid" else 0.62
    displace_texture.noise_depth = 2
    displace = obj.modifiers.new("Micro_Folds", "DISPLACE")
    displace.texture = displace_texture
    displace.strength = 0.16 if spec.role == "mid" else 0.10
    displace.texture_coords = "GLOBAL"

    solidify = obj.modifiers.new("Variable_Thin_Tissue", "SOLIDIFY")
    solidify.thickness = spec.thickness
    solidify.offset = -0.18 if spec.role != "foreground" else 0.08
    solidify.use_even_offset = True
    solidify.use_quality_normals = True
    return obj


def create_curve(
    name: str,
    points: list[Vector],
    material: bpy.types.Material,
    bevel: float,
    collection: bpy.types.Collection,
    cyclic: bool = False,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, point in enumerate(points):
        bezier = spline.bezier_points[index]
        bezier.co = point
        bezier.handle_left_type = "AUTO"
        bezier.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def surface_y(x: float, z: float, depth: float = 1.0, phase: float = 0.0) -> float:
    core_distance = math.sqrt((x / 2.5) ** 2 + ((z + 0.55) / 1.8) ** 2)
    attraction = 1.0 - smoothstep(0.10, 1.75, core_distance)
    return (
        depth
        + math.sin(x * 0.76 + z * 0.42 + phase) * 0.34
        + math.sin(z * 1.31 - x * 0.37 - phase) * 0.18
        + attraction * attraction * 1.75
    )


def tissue_point(x: float, z: float, depth: float, phase: float, front_offset: float = -0.035) -> Vector:
    return Vector((x, surface_y(x, z, depth, phase) + front_offset, z))


def create_cell_boundaries(
    collection: bpy.types.Collection,
    dense_collection: bpy.types.Collection,
    materials: dict[str, bpy.types.Material],
) -> None:
    regions = (
        (-4.0, 1.3, 2.7, 1.8, 34, "ice"),
        (3.8, 1.8, 2.4, 1.6, 25, "purple"),
        (3.8, -2.0, 2.5, 1.35, 25, "cyan"),
        (0.0, -0.25, 2.9, 1.8, 30, "ice"),
    )
    cell_index = 0
    for cx, cz, rx, rz, count, color_key in regions:
        for _ in range(count):
            center_x = cx + RNG.uniform(-rx, rx)
            center_z = cz + RNG.uniform(-rz, rz)
            if ((center_x - cx) / rx) ** 2 + ((center_z - cz) / rz) ** 2 > 1.0:
                continue
            radius_x = RNG.uniform(0.18, 0.52)
            radius_z = RNG.uniform(0.15, 0.44)
            segments = RNG.randint(5, 9)
            start = RNG.uniform(0.0, math.tau)
            span = RNG.uniform(math.pi * 1.05, math.pi * 1.82)
            points = []
            for step in range(segments):
                angle = start + span * step / max(segments - 1, 1)
                stretch = 1.0 + math.sin(angle * 3.0 + cell_index) * 0.16
                x = center_x + math.cos(angle) * radius_x * stretch
                z = center_z + math.sin(angle) * radius_z / stretch
                points.append(tissue_point(x, z, 1.0, cell_index * 0.13))
            target_collection = dense_collection if cell_index % 4 == 0 else collection
            create_curve(
                f"CellBoundary_{cell_index:03d}",
                points,
                materials[color_key],
                RNG.uniform(0.004, 0.010),
                target_collection,
                cyclic=False,
            )
            cell_index += 1


def curved_path(start: Vector, end: Vector, phase: float, lift: float, points: int = 7) -> list[Vector]:
    result = []
    for index in range(points):
        t = index / (points - 1)
        smooth = t * t * (3.0 - 2.0 * t)
        x = start.x * (1.0 - smooth) + end.x * smooth
        z = start.z * (1.0 - smooth) + end.z * smooth
        x += math.sin(t * math.pi * 2.0 + phase) * lift * (1.0 - abs(t * 2.0 - 1.0))
        z += math.sin(t * math.pi * 1.5 - phase) * lift * 0.52
        depth = 0.82 + math.sin(phase) * 0.18
        result.append(tissue_point(x, z, depth, phase))
    return result


def create_ico_source(name: str) -> bpy.types.Mesh:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
    obj = bpy.context.object
    mesh = obj.data
    mesh.name = f"{name}_Mesh"
    bpy.data.objects.remove(obj, do_unlink=True)
    return mesh


def create_linked_node(
    name: str,
    position: Vector,
    radius: float,
    mesh: bpy.types.Mesh,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = position
    obj.scale = (radius, radius, radius)
    if len(obj.data.materials) == 0:
        obj.data.materials.append(material)
    return obj


def create_business_organism(
    collection: bpy.types.Collection,
    dense_collection: bpy.types.Collection,
    materials: dict[str, bpy.types.Material],
    node_meshes: dict[str, bpy.types.Mesh],
) -> None:
    # ANSWER: four local neural clusters, connected through tissue branches.
    answer_centers = (
        Vector((-4.75, 0.0, 2.35)),
        Vector((-3.90, 0.0, 1.55)),
        Vector((-4.55, 0.0, 0.72)),
        Vector((-3.15, 0.0, 1.95)),
    )
    for cluster_index, center in enumerate(answer_centers):
        center.y = surface_y(center.x, center.z, 0.82, cluster_index)
        for branch in range(6):
            angle = (branch / 6.0) * math.tau + cluster_index * 0.42
            endpoint = Vector(
                (
                    center.x + math.cos(angle) * RNG.uniform(0.55, 1.25),
                    0,
                    center.z + math.sin(angle) * RNG.uniform(0.42, 0.95),
                )
            )
            endpoint.y = surface_y(endpoint.x, endpoint.z, 0.82, branch)
            create_curve(
                f"Answer_Branch_{cluster_index}_{branch}",
                curved_path(center, endpoint, cluster_index + branch * 0.31, 0.16, 5),
                materials["ice"],
                0.010 if branch < 2 else 0.006,
                collection,
            )
        for node_index in range(18):
            x = center.x + RNG.gauss(0, 0.34)
            z = center.z + RNG.gauss(0, 0.28)
            position = tissue_point(x, z, 0.78, node_index * 0.17, -0.06)
            create_linked_node(
                f"Answer_Node_{cluster_index}_{node_index}",
                position,
                RNG.uniform(0.018, 0.055),
                node_meshes["ice"],
                materials["ice_node"],
                collection,
            )
        if cluster_index < 3:
            create_curve(
                f"Answer_Convergence_{cluster_index}",
                curved_path(center, CORE, 1.2 + cluster_index, 0.34, 9),
                materials["ice"],
                0.012,
                collection,
            )

    # CITATION: three sparse source organizations with short local links.
    citation_centers = (
        Vector((3.15, 0, 2.72)),
        Vector((4.25, 0, 2.05)),
        Vector((3.72, 0, 1.18)),
    )
    for cluster_index, center in enumerate(citation_centers):
        center.y = surface_y(center.x, center.z, 0.98, 3.4 + cluster_index)
        local_nodes = []
        for node_index in range(14):
            x = center.x + RNG.gauss(0, 0.38)
            z = center.z + RNG.gauss(0, 0.30)
            position = tissue_point(x, z, 0.96, 3.7 + node_index, -0.055)
            local_nodes.append(position)
            material_key = "purple_node" if node_index % 3 else "white_node"
            create_linked_node(
                f"Citation_Node_{cluster_index}_{node_index}",
                position,
                RNG.uniform(0.020, 0.060),
                node_meshes["purple" if node_index % 3 else "white"],
                materials[material_key],
                collection,
            )
        for link_index in range(0, len(local_nodes) - 2, 2):
            create_curve(
                f"Citation_Link_{cluster_index}_{link_index}",
                curved_path(local_nodes[link_index], local_nodes[link_index + 2], 4.1 + link_index, 0.10, 4),
                materials["purple"],
                0.006,
                collection,
            )
        if cluster_index != 1:
            create_curve(
                f"Citation_Filtered_{cluster_index}",
                curved_path(center, CORE, 4.8 + cluster_index, 0.38, 9),
                materials["purple"],
                0.009,
                collection,
            )

    # KEYWORD: two semantic veins embedded in surrounding tissue, with local
    # side branches so they do not read as parallel rails.
    keyword_starts = (Vector((5.55, 0, -2.85)), Vector((4.75, 0, -1.72)))
    for vein_index, start in enumerate(keyword_starts):
        start.y = surface_y(start.x, start.z, 0.82, 5.2 + vein_index)
        main_points = curved_path(start, CORE, 5.4 + vein_index * 0.9, 0.55, 11)
        create_curve(
            f"Keyword_Vein_{vein_index}",
            main_points,
            materials["cyan"],
            0.012,
            collection,
        )
        for branch_index in range(5):
            anchor = main_points[min(2 + branch_index, len(main_points) - 2)]
            side = -1 if (branch_index + vein_index) % 2 else 1
            endpoint = Vector(
                (
                    anchor.x + side * RNG.uniform(0.28, 0.72),
                    anchor.y,
                    anchor.z + RNG.uniform(-0.42, 0.42),
                )
            )
            endpoint.y = surface_y(endpoint.x, endpoint.z, 0.84, branch_index)
            create_curve(
                f"Keyword_Branch_{vein_index}_{branch_index}",
                curved_path(anchor, endpoint, 6.1 + branch_index, 0.12, 5),
                materials["cyan"],
                0.006,
                collection,
            )
        for node_index in range(24):
            t = RNG.random()
            point = main_points[min(int(t * (len(main_points) - 1)), len(main_points) - 1)].copy()
            point.x += RNG.gauss(0, 0.16)
            point.z += RNG.gauss(0, 0.13)
            create_linked_node(
                f"Keyword_Node_{vein_index}_{node_index}",
                point,
                RNG.uniform(0.014, 0.043),
                node_meshes["cyan"],
                materials["cyan_node"],
                collection if node_index % 4 else dense_collection,
            )


def create_seed(
    collection: bpy.types.Collection,
    materials: dict[str, bpy.types.Material],
    node_mesh: bpy.types.Mesh,
) -> None:
    for index in range(42):
        radius = RNG.random() ** 0.55 * 0.38
        angle = RNG.random() * math.tau
        z_offset = RNG.gauss(0.0, 0.16)
        position = CORE + Vector(
            (
                math.cos(angle) * radius,
                RNG.gauss(-0.08, 0.12),
                math.sin(angle) * radius * 0.72 + z_offset,
            )
        )
        create_linked_node(
            f"Seed_Node_{index:02d}",
            position,
            RNG.uniform(0.018, 0.055),
            node_mesh,
            materials["white_node"] if index % 5 == 0 else materials["ice_node"],
            collection,
        )


def create_tissue_fibers(
    collection: bpy.types.Collection,
    dense_collection: bpy.types.Collection,
    materials: dict[str, bpy.types.Material],
) -> None:
    anchor_regions = (
        (-5.8, -1.0, 4.7, 3.7, 42),
        (1.0, -3.0, 6.0, 6.0, 54),
    )
    fiber_index = 0
    for min_x, min_z, width, height, count in anchor_regions:
        for _ in range(count):
            start = Vector(
                (
                    min_x + RNG.random() * width,
                    0,
                    min_z + RNG.random() * height,
                )
            )
            target_mix = RNG.uniform(0.35, 0.88)
            end = start.lerp(CORE, target_mix)
            start.y = surface_y(start.x, start.z, 1.05, fiber_index * 0.11)
            end.y = surface_y(end.x, end.z, 0.95, fiber_index * 0.13)
            target_collection = dense_collection if fiber_index % 5 == 0 else collection
            create_curve(
                f"Tissue_Fiber_{fiber_index:03d}",
                curved_path(start, end, fiber_index * 0.27, RNG.uniform(0.12, 0.42), RNG.randint(5, 8)),
                materials["fiber"],
                RNG.uniform(0.003, 0.009),
                target_collection,
            )
            fiber_index += 1


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def create_camera(name: str, location: tuple[float, float, float], target: Vector, lens: float) -> bpy.types.Object:
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = 36.0
    data.dof.use_dof = True
    data.dof.aperture_fstop = 3.2
    camera = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    point_camera(camera, target)
    return camera


def create_area_light(
    name: str,
    location: tuple[float, float, float],
    target: Vector,
    color: tuple[float, float, float],
    energy: float,
    size: float,
) -> bpy.types.Object:
    data = bpy.data.lights.new(name=name, type="AREA")
    data.color = color
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    light = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(light)
    light.location = location
    point_camera(light, target)
    return light


def configure_world() -> bpy.types.World:
    world = bpy.data.worlds.new("GEO V4 Deep Navy World")
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.name = "WorldBackground"
    background.inputs["Color"].default_value = (0.0004, 0.0022, 0.0085, 1.0)
    background.inputs["Strength"].default_value = 0.065
    bpy.context.scene.world = world
    return world


def configure_cycles(scene: bpy.types.Scene) -> dict:
    result = {"backend": "CPU", "device": "CPU"}
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = 48
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
    scene.cycles.use_denoising = True
    scene.cycles.preview_samples = 16
    scene.cycles.seed = SEED
    try:
        preferences = bpy.context.preferences.addons["cycles"].preferences
        preferences.get_devices()
        for backend in ("OPTIX", "CUDA"):
            try:
                preferences.compute_device_type = backend
                preferences.get_devices()
                enabled = []
                for device in preferences.devices:
                    use = device.type == backend
                    device.use = use
                    if use:
                        enabled.append(device.name)
                if enabled:
                    result = {"backend": backend, "device": ", ".join(enabled)}
                    break
            except Exception:
                continue
        if result["backend"] == "CPU":
            scene.cycles.device = "CPU"
    except Exception:
        scene.cycles.device = "CPU"
    return result


def configure_scene(scene: bpy.types.Scene) -> None:
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.engine = "CYCLES"


def render_still(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    output: Path,
    samples: int,
) -> float:
    scene.camera = camera
    scene.cycles.samples = samples
    scene.render.filepath = str(output)
    started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    return time.perf_counter() - started


def set_collection_render(collection: bpy.types.Collection, visible: bool) -> None:
    collection.hide_render = not visible


def set_variant(
    key: str,
    scene: bpy.types.Scene,
    membrane_materials: dict[str, bpy.types.Material],
    glow_materials: list[bpy.types.Material],
    lights: dict[str, bpy.types.Object],
    dense_collection: bpy.types.Collection,
) -> None:
    settings = {
        "A": {
            "exposure": -0.54,
            "world": 0.016,
            "body": {"rear": 0.012, "mid": 0.030, "foreground": 0.016},
            "edge": {"rear": 0.050, "mid": 0.14, "foreground": 0.058},
            "glow": 0.82,
            "lights": 0.20,
            "dense": False,
        },
        "B": {
            "exposure": -0.88,
            "world": 0.008,
            "body": {"rear": 0.007, "mid": 0.018, "foreground": 0.010},
            "edge": {"rear": 0.034, "mid": 0.095, "foreground": 0.040},
            "glow": 0.68,
            "lights": 0.14,
            "dense": False,
        },
        "C": {
            "exposure": -0.42,
            "world": 0.020,
            "body": {"rear": 0.018, "mid": 0.043, "foreground": 0.024},
            "edge": {"rear": 0.070, "mid": 0.18, "foreground": 0.080},
            "glow": 0.94,
            "lights": 0.24,
            "dense": True,
        },
    }[key]
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = settings["exposure"]
    scene.world.node_tree.nodes["WorldBackground"].inputs["Strength"].default_value = settings["world"]
    for role, material in membrane_materials.items():
        material.node_tree.nodes["BodyVisibility"].inputs[1].default_value = settings["body"][role]
        material.node_tree.nodes["EdgeEmission"].inputs["Strength"].default_value = settings["edge"][role]
    for material in glow_materials:
        emission = material.node_tree.nodes.get("Emission")
        if emission is not None:
            base = material.get("baseStrength", emission.inputs["Strength"].default_value)
            material["baseStrength"] = base
            emission.inputs["Strength"].default_value = base * settings["glow"]
    for light in lights.values():
        base = light.get("baseEnergy", light.data.energy)
        light["baseEnergy"] = base
        light.data.energy = base * settings["lights"]
    set_collection_render(dense_collection, settings["dense"])


def make_normal_override() -> bpy.types.Material:
    material = bpy.data.materials.new("Normal_Pass_Override")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    geometry = nodes.new("ShaderNodeNewGeometry")
    scale = nodes.new("ShaderNodeVectorMath")
    scale.operation = "SCALE"
    scale.inputs["Scale"].default_value = 0.5
    add = nodes.new("ShaderNodeVectorMath")
    add.operation = "ADD"
    add.inputs[1].default_value = (0.5, 0.5, 0.5)
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 1.0
    material.node_tree.links.new(geometry.outputs["Normal"], scale.inputs[0])
    material.node_tree.links.new(scale.outputs[0], add.inputs[0])
    material.node_tree.links.new(add.outputs[0], emission.inputs["Color"])
    material.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def make_depth_override() -> bpy.types.Material:
    material = bpy.data.materials.new("Depth_Pass_Override")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    camera_data = nodes.new("ShaderNodeCameraData")
    map_range = nodes.new("ShaderNodeMapRange")
    map_range.inputs["From Min"].default_value = 10.0
    map_range.inputs["From Max"].default_value = 22.0
    map_range.inputs["To Min"].default_value = 1.0
    map_range.inputs["To Max"].default_value = 0.0
    map_range.clamp = True
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Strength"].default_value = 1.0
    material.node_tree.links.new(camera_data.outputs["View Distance"], map_range.inputs["Value"])
    material.node_tree.links.new(map_range.outputs["Result"], emission.inputs["Color"])
    material.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
    return material


def create_preview_animation(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    output: Path,
) -> float:
    started = time.perf_counter()
    ffmpeg_arg = None
    if "--ffmpeg" in sys.argv:
        index = sys.argv.index("--ffmpeg")
        if index + 1 < len(sys.argv):
            ffmpeg_arg = sys.argv[index + 1]
    ffmpeg = ffmpeg_arg or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg executable is required; pass --ffmpeg <absolute-path>")
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-loop",
            "1",
            "-i",
            str(OUTPUT_DIR / "candidate-a-balanced.png"),
            "-vf",
            "scale=1408:792,zoompan=z='min(zoom+0.00035,1.04)':"
            "x='iw/2-(iw/zoom/2)+8*sin(on/24)':"
            "y='ih/2-(ih/zoom/2)+5*cos(on/30)':d=120:s=1280x720:fps=20",
            "-t",
            "6",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-movflags",
            "+faststart",
            str(output),
        ],
        check=True,
    )
    elapsed = time.perf_counter() - started
    return elapsed


def main() -> None:
    started_total = time.perf_counter()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if PREVIEW_ONLY:
        if not BLEND_PATH.exists():
            raise FileNotFoundError(BLEND_PATH)
        bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
        scene = bpy.context.scene
        camera = bpy.data.objects["Camera_Main_16x9"]
        elapsed = create_preview_animation(
            scene,
            camera,
            OUTPUT_DIR / "geo-v419-master-lookdev-preview.mp4",
        )
        scene.render.engine = "CYCLES"
        scene.render.resolution_x = 1920
        scene.render.resolution_y = 1080
        scene.render.image_settings.file_format = "PNG"
        scene.camera = camera
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
        print("GEO_V4_MASTER_LOOKDEV_PREVIEW_OK")
        print(json.dumps({"previewSeconds": round(elapsed, 3)}, sort_keys=True))
        return
    reset_scene()
    scene = bpy.context.scene
    configure_scene(scene)
    gpu = configure_cycles(scene)
    world = configure_world()

    membrane_collection = ensure_collection("MASTER_MEMBRANES")
    rear_collection = ensure_collection("Rear_Neural_Canopy", membrane_collection)
    mid_collection = ensure_collection("Mid_Living_Tissue", membrane_collection)
    foreground_collection = ensure_collection("Foreground_Veils", membrane_collection)
    cell_collection = ensure_collection("CELLULAR_NETWORK")
    dense_collection = ensure_collection("DENSE_DETAIL")
    business_collection = ensure_collection("BUSINESS_ORGANISM")
    seed_collection = ensure_collection("DATA_SEED")

    membrane_materials = {
        role: make_membrane_material(f"{role.title()}_Membrane_Master", role)
        for role in ("rear", "mid", "foreground")
    }
    materials = {
        "fiber": make_dark_fiber_material("Deep_Neural_Fiber", (0.010, 0.095, 0.17, 1.0), 0.22),
        "ice": make_dark_fiber_material("Answer_Ice_Fiber", (0.045, 0.34, 0.62, 1.0), 0.82),
        "purple": make_dark_fiber_material("Citation_Cold_Purple_Fiber", (0.20, 0.095, 0.43, 1.0), 0.68),
        "cyan": make_dark_fiber_material("Keyword_Cyan_Fiber", (0.010, 0.32, 0.46, 1.0), 0.72),
        "ice_node": make_emission_material("Ice_Node", (0.28, 0.68, 1.0, 1.0), 3.8),
        "purple_node": make_emission_material("Purple_Node", (0.42, 0.20, 0.78, 1.0), 3.2),
        "cyan_node": make_emission_material("Cyan_Node", (0.02, 0.58, 0.78, 1.0), 3.3),
        "white_node": make_emission_material("White_Node", (0.74, 0.90, 1.0, 1.0), 4.6),
    }
    glow_materials = list(materials.values())

    for spec in MEMBRANES:
        target_collection = (
            rear_collection
            if spec.role == "rear"
            else mid_collection
            if spec.role == "mid"
            else foreground_collection
        )
        create_membrane(spec, membrane_materials[spec.role], target_collection)

    node_meshes = {
        "ice": create_ico_source("Ice_Node"),
        "purple": create_ico_source("Purple_Node"),
        "cyan": create_ico_source("Cyan_Node"),
        "white": create_ico_source("White_Node"),
    }
    create_cell_boundaries(cell_collection, dense_collection, materials)
    create_tissue_fibers(cell_collection, dense_collection, materials)
    create_business_organism(business_collection, dense_collection, materials, node_meshes)
    create_seed(seed_collection, materials, node_meshes["white"])

    focus = bpy.data.objects.new("Camera_Focus_Core", None)
    bpy.context.scene.collection.objects.link(focus)
    focus.location = CORE
    main_camera = create_camera("Camera_Main_16x9", (0.0, -15.5, 0.45), CORE, 49.0)
    answer_camera = create_camera("Camera_Answer_Closeup", (-4.1, -9.2, 1.65), Vector((-3.9, 0.7, 1.45)), 62.0)
    cavity_camera = create_camera("Camera_Cavity_Closeup", (0.0, -8.3, -0.15), CORE, 66.0)
    citation_camera = create_camera("Camera_Citation_Closeup", (3.85, -9.2, 1.95), Vector((3.7, 0.8, 1.8)), 62.0)
    keyword_camera = create_camera("Camera_Keyword_Closeup", (3.75, -9.0, -1.75), Vector((3.55, 0.6, -1.85)), 62.0)
    for camera in (main_camera, answer_camera, cavity_camera, citation_camera, keyword_camera):
        camera.data.dof.focus_object = focus

    lights = {
        "ambient": create_area_light("Ambient_Top", (0.0, -1.0, 7.0), CORE, (0.12, 0.32, 0.54), 550.0, 7.5),
        "answer": create_area_light("Answer_Ice_Key", (-5.5, -3.5, 3.2), Vector((-4.0, 0.7, 1.4)), (0.18, 0.62, 1.0), 820.0, 3.2),
        "citation": create_area_light("Citation_Purple_Key", (5.2, -2.0, 4.0), Vector((3.8, 0.8, 1.8)), (0.34, 0.18, 0.62), 610.0, 2.8),
        "cavity": create_area_light("Cavity_Ice_Rim", (0.0, 5.4, -0.15), CORE, (0.24, 0.72, 1.0), 1040.0, 2.6),
        "foreground": create_area_light("Foreground_Rim", (-4.0, -6.0, -2.2), Vector((-3.2, 0.0, -1.5)), (0.08, 0.30, 0.48), 410.0, 3.8),
    }

    render_times: dict[str, float] = {}
    for key, filename in (
        ("A", "candidate-a-balanced.png"),
        ("B", "candidate-b-darker.png"),
        ("C", "candidate-c-organic-dense.png"),
    ):
        set_variant(key, scene, membrane_materials, glow_materials, lights, dense_collection)
        render_times[filename] = render_still(
            scene,
            main_camera,
            OUTPUT_DIR / filename,
            8 if QUICK_RENDER else 48,
        )

    if QUICK_RENDER:
        set_variant("A", scene, membrane_materials, glow_materials, lights, dense_collection)
        scene.camera = main_camera
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
        print("GEO_V4_MASTER_LOOKDEV_QUICK_OK")
        print(json.dumps({"engine": "Cycles", "gpu": gpu}, ensure_ascii=False, sort_keys=True))
        return

    set_variant("A", scene, membrane_materials, glow_materials, lights, dense_collection)

    # Membrane only.
    set_collection_render(cell_collection, False)
    set_collection_render(business_collection, False)
    set_collection_render(seed_collection, False)
    render_times["membrane-only.png"] = render_still(scene, main_camera, OUTPUT_DIR / "membrane-only.png", 36)

    # Full organism without the placeholder seed.
    set_collection_render(cell_collection, True)
    set_collection_render(business_collection, True)
    set_collection_render(seed_collection, False)
    render_times["organism-no-seed.png"] = render_still(scene, main_camera, OUTPUT_DIR / "organism-no-seed.png", 40)

    set_collection_render(seed_collection, True)
    render_times["center-cavity-closeup.png"] = render_still(scene, cavity_camera, OUTPUT_DIR / "center-cavity-closeup.png", 40)
    render_times["answer-closeup.png"] = render_still(scene, answer_camera, OUTPUT_DIR / "answer-closeup.png", 36)
    render_times["citation-closeup.png"] = render_still(scene, citation_camera, OUTPUT_DIR / "citation-closeup.png", 36)
    render_times["keyword-closeup.png"] = render_still(scene, keyword_camera, OUTPUT_DIR / "keyword-closeup.png", 36)

    # Foreground depth evidence uses a slightly shallower DOF.
    original_fstop = main_camera.data.dof.aperture_fstop
    main_camera.data.dof.aperture_fstop = 2.0
    render_times["foreground-depth.png"] = render_still(scene, main_camera, OUTPUT_DIR / "foreground-depth.png", 36)
    main_camera.data.dof.aperture_fstop = original_fstop

    view_layer = scene.view_layers[0]
    original_override = view_layer.material_override
    original_exposure = scene.view_settings.exposure
    original_world_strength = world.node_tree.nodes["WorldBackground"].inputs["Strength"].default_value
    scene.view_settings.exposure = 0.0
    world.node_tree.nodes["WorldBackground"].inputs["Strength"].default_value = 0.0
    view_layer.material_override = make_normal_override()
    render_times["normal-pass.png"] = render_still(scene, main_camera, OUTPUT_DIR / "normal-pass.png", 1)
    view_layer.material_override = make_depth_override()
    render_times["depth-pass.png"] = render_still(scene, main_camera, OUTPUT_DIR / "depth-pass.png", 1)
    view_layer.material_override = original_override
    scene.view_settings.exposure = original_exposure
    world.node_tree.nodes["WorldBackground"].inputs["Strength"].default_value = original_world_strength

    set_variant("A", scene, membrane_materials, glow_materials, lights, dense_collection)
    scene.camera = main_camera
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    preview_time = create_preview_animation(
        scene,
        main_camera,
        OUTPUT_DIR / "geo-v419-master-lookdev-preview.mp4",
    )
    render_times["geo-v419-master-lookdev-preview.mp4"] = preview_time

    # Restore the master to Candidate A / Cycles before final save.
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.image_settings.file_format = "PNG"
    scene.camera = main_camera
    set_variant("A", scene, membrane_materials, glow_materials, lights, dense_collection)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    stats = {
        "seed": SEED,
        "blend": str(BLEND_PATH),
        "engine": "Cycles",
        "gpu": gpu,
        "membraneCount": len(MEMBRANES),
        "renderTimesSeconds": {key: round(value, 3) for key, value in render_times.items()},
        "totalSeconds": round(time.perf_counter() - started_total, 3),
    }
    print("GEO_V4_MASTER_LOOKDEV_OK")
    print(json.dumps(stats, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
