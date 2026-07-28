"""Deterministically build the GEO V4.1.8.1 sculpted tissue-island GLB.

Run with:
    blender.exe --background --factory-startup --python tools/blender/geo_v4_hybrid_membrane.py

An optional output path may be supplied after ``--``.
"""

from __future__ import annotations

import json
import math
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector


SEED = 41811
SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[2]
DEFAULT_OUTPUT = (
    PROJECT_ROOT
    / "public"
    / "models"
    / "geo"
    / "v4"
    / "geo-v4-hybrid-membrane.glb"
)


@dataclass(frozen=True)
class Tear:
    u: float
    v: float
    radius_u: float
    radius_v: float
    angle: float
    phase: float
    open_side: float = 0.0


@dataclass(frozen=True)
class IslandSpec:
    name: str
    layer: str
    center: tuple[float, float, float]
    scale: tuple[float, float]
    rotation: float
    columns: int
    rows: int
    phase: float
    fold: float
    curl: float
    twist: float
    thickness: float
    opacity: float
    parallax: float
    tears: tuple[Tear, ...] = ()


ISLANDS = (
    IslandSpec(
        "Rear_Left_Canopy",
        "rear",
        (-2.55, 1.18, -1.62),
        (2.02, 1.04),
        -0.16,
        17,
        13,
        0.35,
        0.38,
        0.34,
        -0.20,
        0.012,
        0.085,
        0.010,
        (Tear(-0.28, 0.08, 0.09, 0.31, -0.35, 0.8, -0.25),),
    ),
    IslandSpec(
        "Rear_Right_Canopy",
        "rear",
        (2.52, 1.22, -1.72),
        (1.78, 0.94),
        0.21,
        16,
        12,
        1.20,
        0.36,
        0.32,
        0.18,
        0.012,
        0.078,
        0.011,
        (Tear(0.24, -0.04, 0.08, 0.27, 0.46, 2.2, 0.18),),
    ),
    IslandSpec(
        "Rear_Center_Bridge",
        "rear",
        (0.00, -0.10, -2.04),
        (1.12, 0.44),
        -0.12,
        15,
        9,
        2.05,
        0.34,
        0.28,
        -0.12,
        0.009,
        0.050,
        0.008,
        (),
    ),
    IslandSpec(
        "Mid_Answer_Tissue",
        "mid",
        (-2.08, 0.42, -0.62),
        (1.36, 0.78),
        0.26,
        18,
        14,
        2.75,
        0.52,
        0.46,
        0.24,
        0.019,
        0.185,
        0.025,
        (
            Tear(-0.34, 0.06, 0.075, 0.28, -0.62, 3.1, -0.30),
            Tear(0.31, -0.20, 0.085, 0.21, 0.38, 4.4, 0.22),
        ),
    ),
    IslandSpec(
        "Mid_Citation_Tissue",
        "mid",
        (2.06, 0.70, -0.76),
        (1.24, 0.70),
        -0.31,
        17,
        13,
        3.55,
        0.48,
        0.42,
        -0.22,
        0.018,
        0.156,
        0.024,
        (Tear(0.06, 0.08, 0.07, 0.25, 0.72, 1.6, 0.30),),
    ),
    IslandSpec(
        "Mid_Keyword_Tissue",
        "mid",
        (2.06, -0.82, -0.55),
        (1.30, 0.66),
        0.34,
        18,
        12,
        4.25,
        0.50,
        0.44,
        0.27,
        0.018,
        0.164,
        0.027,
        (Tear(-0.24, 0.02, 0.065, 0.24, -0.48, 5.0, -0.18),),
    ),
    IslandSpec(
        "Mid_Core_Left",
        "mid",
        (-0.72, -0.02, -0.70),
        (0.96, 0.58),
        -0.48,
        16,
        11,
        4.90,
        0.56,
        0.50,
        -0.34,
        0.016,
        0.142,
        0.022,
        (Tear(-0.02, -0.04, 0.06, 0.25, -0.18, 5.8, 0.10),),
    ),
    IslandSpec(
        "Mid_Core_Right",
        "mid",
        (0.74, -0.12, -0.82),
        (0.98, 0.60),
        0.52,
        16,
        11,
        5.65,
        0.58,
        0.52,
        0.36,
        0.016,
        0.136,
        0.023,
        (Tear(0.08, 0.05, 0.055, 0.23, 0.22, 0.5, -0.12),),
    ),
    IslandSpec(
        "Foreground_Left_Fragment",
        "foreground",
        (-3.18, -1.34, 0.22),
        (1.26, 0.84),
        0.30,
        15,
        11,
        6.15,
        0.62,
        0.56,
        0.34,
        0.022,
        0.105,
        0.052,
        (Tear(0.16, 0.05, 0.08, 0.30, 0.64, 1.1, 0.24),),
    ),
    IslandSpec(
        "Foreground_TopRight_Fragment",
        "foreground",
        (3.58, 1.62, 0.18),
        (1.08, 0.62),
        -0.36,
        14,
        10,
        6.80,
        0.58,
        0.52,
        -0.30,
        0.021,
        0.092,
        0.056,
        (),
    ),
)


def smoothstep(edge0: float, edge1: float, value: float) -> float:
    t = max(0.0, min(1.0, (value - edge0) / max(edge1 - edge0, 1e-8)))
    return t * t * (3.0 - 2.0 * t)


def deterministic_noise(x: float, y: float, phase: float = 0.0) -> float:
    low = math.sin(x * 1.71 + y * 1.13 + phase)
    medium = math.sin(x * 3.83 - y * 2.29 + phase * 0.73)
    high = math.cos(x * 7.31 + y * 5.09 - phase * 1.17)
    return low * 0.55 + medium * 0.30 + high * 0.15


def island_boundary(u: float, v: float, spec: IslandSpec) -> bool:
    angle = math.atan2(v, u)
    radial = math.sqrt((u / 1.0) ** 2 + (v / 0.92) ** 2)
    contour = (
        0.92
        + math.sin(angle * 3.0 + spec.phase) * 0.075
        + math.sin(angle * 5.0 - spec.phase * 0.7) * 0.045
        + deterministic_noise(u * 2.1, v * 2.4, spec.phase) * 0.055
    )
    # A few boundary notches keep the silhouette torn rather than leaf-perfect.
    notch = max(
        0.0,
        math.sin(angle * 2.0 + spec.phase * 1.9) * 0.07
        + math.sin(angle * 7.0 - 0.4) * 0.025,
    )
    return radial < contour - notch


def tear_distance(u: float, v: float, tear: Tear) -> float:
    cosine = math.cos(tear.angle)
    sine = math.sin(tear.angle)
    du = u - tear.u
    dv = v - tear.v
    along = du * cosine + dv * sine
    across = -du * sine + dv * cosine
    end_taper = 1.0 + abs(along / max(tear.radius_v, 1e-5)) * 0.45
    irregular = 1.0 + (
        math.sin(along * 17.0 + tear.phase) * 0.16
        + math.sin(across * 29.0 - tear.phase) * 0.08
    )
    return math.sqrt(
        (across / max(tear.radius_u * irregular / end_taper, 1e-5)) ** 2
        + (along / max(tear.radius_v, 1e-5)) ** 2
    )


def local_to_world(u: float, v: float, spec: IslandSpec) -> Vector:
    scale_x, scale_y = spec.scale
    cosine = math.cos(spec.rotation)
    sine = math.sin(spec.rotation)
    local_x = u * scale_x
    local_y = v * scale_y
    rotated_x = local_x * cosine - local_y * sine
    rotated_y = local_x * sine + local_y * cosine
    x = spec.center[0] + rotated_x
    y = spec.center[1] + rotated_y

    fold = (
        math.sin(u * 3.4 + v * 1.7 + spec.phase) * spec.fold * 0.48
        + math.sin(v * 5.1 - u * 2.2 - spec.phase * 0.6) * spec.fold * 0.26
        + deterministic_noise(u * 3.8, v * 3.5, spec.phase) * spec.fold * 0.18
    )
    twist = u * v * spec.twist + math.sin((u - v) * 2.1 + spec.phase) * spec.twist * 0.18
    edge = smoothstep(0.45, 0.98, math.sqrt(u * u + v * v))
    edge_curl = (
        math.sin(math.atan2(v, u) * 3.0 + spec.phase)
        * edge
        * spec.curl
        * 0.42
    )
    core_distance = math.sqrt((x / 1.22) ** 2 + ((y + 0.12) / 0.88) ** 2)
    attraction = 1.0 - smoothstep(0.12, 1.55, core_distance)
    cavity_depth = -attraction * attraction * (
        0.62 if spec.name.startswith("Mid_Core") else 0.20
    )
    z = spec.center[2] + fold + twist + edge_curl + cavity_depth

    # Multi-axis deformation avoids the "noise displaced plane" silhouette.
    x += math.sin(v * 3.2 + spec.phase) * spec.curl * 0.12
    y += math.sin(u * 3.7 - spec.phase) * spec.curl * 0.10

    # Blender is Z-up while glTF/Three.js is Y-up. Store intended Three.js
    # coordinates as (x, -z, y), matching Blender's glTF conversion.
    return Vector((x, -z, y))


def field_attributes(position: Vector, spec: IslandSpec) -> tuple[float, float, float, float]:
    x = position.x
    y = position.z
    core_distance = math.sqrt((x / 1.25) ** 2 + ((y + 0.12) / 0.92) ** 2)
    attraction = 1.0 - smoothstep(0.12, 2.20, core_distance)
    business_weight = 0.18
    if "Answer" in spec.name:
        business_weight = 0.92
    elif "Citation" in spec.name:
        business_weight = 0.62
    elif "Keyword" in spec.name:
        business_weight = 0.72
    density = min(
        1.0,
        0.16
        + business_weight * 0.56
        + attraction * 0.28
        + (deterministic_noise(x * 0.9, y * 0.9, spec.phase) * 0.5 + 0.5) * 0.12,
    )
    thickness = min(1.0, 0.16 + density * 0.62)
    layer = 0.0 if spec.layer == "rear" else 0.5 if spec.layer == "mid" else 1.0
    return density, attraction, thickness, layer


def create_island(spec: IslandSpec, material: bpy.types.Material) -> bpy.types.Object:
    vertices: list[Vector] = []
    uvs: list[tuple[float, float]] = []
    colors: list[tuple[float, float, float, float]] = []
    index_map: dict[tuple[int, int], int] = {}

    for row in range(spec.rows + 1):
        v = row / spec.rows * 2.0 - 1.0
        for column in range(spec.columns + 1):
            u = column / spec.columns * 2.0 - 1.0
            if not island_boundary(u, v, spec):
                continue
            index_map[(column, row)] = len(vertices)
            position = local_to_world(u, v, spec)
            vertices.append(position)
            uvs.append(((u + 1.0) * 0.5, (v + 1.0) * 0.5))
            colors.append(field_attributes(position, spec))

    faces: list[tuple[int, int, int, int]] = []
    for row in range(spec.rows):
        for column in range(spec.columns):
            corners = (
                index_map.get((column, row)),
                index_map.get((column + 1, row)),
                index_map.get((column + 1, row + 1)),
                index_map.get((column, row + 1)),
            )
            if any(index is None for index in corners):
                continue
            u = (column + 0.5) / spec.columns * 2.0 - 1.0
            v = (row + 0.5) / spec.rows * 2.0 - 1.0
            if any(tear_distance(u, v, tear) < 1.0 for tear in spec.tears):
                continue
            # Sparse cuts open some tears to the boundary without forming a
            # smooth closed boolean hole.
            open_cut = False
            for tear in spec.tears:
                if abs(tear.open_side) < 1e-5:
                    continue
                direction = 1.0 if tear.open_side > 0 else -1.0
                cut_axis = (u - tear.u) * math.cos(tear.angle) + (v - tear.v) * math.sin(tear.angle)
                cut_cross = -(u - tear.u) * math.sin(tear.angle) + (v - tear.v) * math.cos(tear.angle)
                if (
                    cut_axis * direction > tear.radius_v * 0.52
                    and abs(cut_cross) < tear.radius_u * 0.38
                    and deterministic_noise(u * 9.0, v * 7.0, tear.phase) > -0.20
                ):
                    open_cut = True
                    break
            if open_cut:
                continue
            faces.append(corners)  # type: ignore[arg-type]

    mesh = bpy.data.meshes.new(f"{spec.name}_Geometry")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)

    uv_layer = mesh.uv_layers.new(name="OrganicUV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]

    color_layer = mesh.color_attributes.new(
        name="TissueData",
        type="FLOAT_COLOR",
        domain="POINT",
    )
    for index, color in enumerate(colors):
        color_layer.data[index].color = color

    island = bpy.data.objects.new(spec.name, mesh)
    bpy.context.collection.objects.link(island)
    island["geoV4Layer"] = spec.layer
    island["geoV4Opacity"] = spec.opacity
    island["geoV4Parallax"] = spec.parallax
    island["geoV4DeterministicSeed"] = SEED
    island.data.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = True

    subdivision = island.modifiers.new(name="Tissue_Subdivision", type="SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 2
    subdivision.render_levels = 2
    subdivision.show_only_control_edges = True

    solidify = island.modifiers.new(name="Tissue_Thickness", type="SOLIDIFY")
    solidify.thickness = spec.thickness
    solidify.offset = -0.18 if spec.layer != "foreground" else 0.10
    solidify.use_even_offset = True
    solidify.use_quality_normals = True

    bpy.context.view_layer.objects.active = island
    island.select_set(True)
    bpy.ops.object.modifier_apply(modifier=subdivision.name)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    island.select_set(False)
    mesh.update(calc_edges=True)
    return island


def parse_output_path() -> Path:
    if "--" not in sys.argv:
        return DEFAULT_OUTPUT
    arguments = sys.argv[sys.argv.index("--") + 1 :]
    return Path(arguments[0]).resolve() if arguments else DEFAULT_OUTPUT


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
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def gather_stats(objects: list[bpy.types.Object], output: Path, elapsed: float) -> dict:
    triangle_count = 0
    vertex_count = 0
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    layer_counts = {"rear": 0, "mid": 0, "foreground": 0}

    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        triangle_count += len(mesh.loop_triangles)
        vertex_count += len(mesh.vertices)
        layer_counts[obj["geoV4Layer"]] += 1
        for vertex in mesh.vertices:
            world = obj.matrix_world @ vertex.co
            gltf_world = Vector((world.x, world.z, -world.y))
            minimum.x = min(minimum.x, gltf_world.x)
            minimum.y = min(minimum.y, gltf_world.y)
            minimum.z = min(minimum.z, gltf_world.z)
            maximum.x = max(maximum.x, gltf_world.x)
            maximum.y = max(maximum.y, gltf_world.y)
            maximum.z = max(maximum.z, gltf_world.z)

    return {
        "asset": str(output),
        "sizeBytes": output.stat().st_size,
        "meshCount": len(objects),
        "islandCount": len(objects),
        "layerCounts": layer_counts,
        "triangleCount": triangle_count,
        "vertexCount": vertex_count,
        "materialCount": len({material.name for obj in objects for material in obj.data.materials}),
        "textureCount": 0,
        "animationCount": 0,
        "boundingBox": {
            "min": [round(value, 5) for value in minimum],
            "max": [round(value, 5) for value in maximum],
        },
        "exportSeconds": round(elapsed, 3),
        "seed": SEED,
    }


def main() -> None:
    random.seed(SEED)
    reset_scene()
    output = parse_output_path()
    output.parent.mkdir(parents=True, exist_ok=True)

    material = bpy.data.materials.new(name="GEO_V4_Tissue_Island_Placeholder")
    material.diffuse_color = (0.025, 0.16, 0.23, 0.12)
    material.roughness = 0.78
    material.metallic = 0.0
    material.use_nodes = True

    islands = [create_island(spec, material) for spec in ISLANDS]
    for island in islands:
        island.select_set(True)
    bpy.context.view_layer.objects.active = islands[0]

    started = time.perf_counter()
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_materials="EXPORT",
        export_apply=True,
        export_attributes=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    elapsed = time.perf_counter() - started
    stats = gather_stats(islands, output, elapsed)
    print("GEO_V4_SCULPTED_TISSUE_EXPORT_OK")
    print(json.dumps(stats, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
