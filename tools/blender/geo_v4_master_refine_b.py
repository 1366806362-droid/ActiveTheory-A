"""Prepare and execute GEO V4.1.9-B Candidate B refinement phases.

This script is intentionally split into an inexpensive preparation path and
three independently callable refinement phases. Preparation only opens the
locked V4.1.9 master, records a scene audit, applies the existing Candidate B
baseline, and saves a separate working .blend. It never renders.

Blender arguments must follow ``--``:

    blender.exe --background --factory-startup \
      --python tools/blender/geo_v4_master_refine_b.py -- --prepare-only

    blender.exe --background --factory-startup \
      --python tools/blender/geo_v4_master_refine_b.py -- \
      --phase b1 --preset preview

Review and Final rendering require an NVIDIA OptiX device. CPU fallback is
deliberately prohibited for every render preset.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

import bpy
from mathutils import Vector


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[2]
DEFAULT_CONFIG = SCRIPT_PATH.with_name("geo_v4_master_refine_b_config.json")
SEED_FALLBACK = 41902
PHASES = ("b1", "b2", "b3")
PRESETS = ("preview", "review", "final")


def blender_arguments() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare or execute one GEO V4.1.9-B refinement phase."
    )
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--phase", choices=PHASES)
    parser.add_argument("--preset", choices=PRESETS, default="preview")
    parser.add_argument("--diagnostics", action="store_true")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--working", type=Path)
    parser.add_argument("--audit", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument(
        "--force-working-copy",
        action="store_true",
        help="Explicitly replace an existing working copy during prepare-only.",
    )
    args = parser.parse_args(blender_arguments())
    selected = int(args.prepare_only) + int(bool(args.phase)) + int(args.diagnostics)
    if selected != 1:
        parser.error(
            "Select exactly one action: --prepare-only, --phase b1|b2|b3, "
            "or --diagnostics."
        )
    return args


def resolve_project_path(value: str | Path) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


def load_config(path: Path) -> dict[str, Any]:
    config_path = resolve_project_path(path)
    with config_path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)
    if config.get("schemaVersion") != 1:
        raise RuntimeError(f"Unsupported config schema: {config.get('schemaVersion')}")
    for phase in PHASES:
        if phase not in config["phases"]:
            raise RuntimeError(f"Missing phase config: {phase}")
    expected_plans = {
        "b1": ["b1"],
        "b2": ["b1", "b2"],
        "b3": ["b1", "b2", "b3"],
    }
    if config.get("phasePlans") != expected_plans:
        raise RuntimeError(
            "phasePlans must define deterministic cumulative sequences: "
            f"{expected_plans}"
        )
    for preset in PRESETS:
        if preset not in config["presets"]:
            raise RuntimeError(f"Missing render preset: {preset}")
    return config


def resolved_phase_sequence(
    config: dict[str, Any], phase: str
) -> list[str]:
    if phase not in PHASES:
        raise RuntimeError(f"Unsupported phase: {phase}")
    plan = list(config["phasePlans"][phase])
    if not plan or plan[-1] != phase:
        raise RuntimeError(f"Invalid phase plan for {phase}: {plan}")
    return ["baseline", *plan]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def open_blend(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(path)
    bpy.ops.wm.open_mainfile(filepath=str(path))


def save_blend(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path), check_existing=False)


def set_input(node: bpy.types.Node | None, names: Iterable[str], value: Any) -> bool:
    if node is None:
        return False
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return True
    return False


def object_in_collection(obj: bpy.types.Object, names: set[str]) -> bool:
    return any(collection.name in names for collection in obj.users_collection)


def collection_hierarchy() -> dict[str, Any]:
    parent_by_name: dict[str, str | None] = {
        collection.name: None for collection in bpy.data.collections
    }
    for parent in bpy.data.collections:
        for child in parent.children:
            parent_by_name[child.name] = parent.name
    result: dict[str, Any] = {}
    for collection in sorted(bpy.data.collections, key=lambda item: item.name):
        result[collection.name] = {
            "parent": parent_by_name[collection.name],
            "children": sorted(child.name for child in collection.children),
            "directObjectCount": len(collection.objects),
            "directObjects": sorted(obj.name for obj in collection.objects),
        }
    return result


def material_snapshot(material: bpy.types.Material) -> dict[str, Any]:
    result: dict[str, Any] = {
        "name": material.name,
        "useNodes": material.use_nodes,
        "blendMethod": getattr(material, "surface_render_method", None),
    }
    if not material.use_nodes or material.node_tree is None:
        return result
    nodes = material.node_tree.nodes
    principled = nodes.get("MembraneBody")
    emission = nodes.get("Emission") or nodes.get("EdgeEmission")
    body_visibility = nodes.get("BodyVisibility")
    if principled is not None:
        base_color = principled.inputs.get("Base Color")
        roughness = principled.inputs.get("Roughness")
        transmission = (
            principled.inputs.get("Transmission Weight")
            or principled.inputs.get("Transmission")
        )
        result["principled"] = {
            "baseColor": list(base_color.default_value) if base_color else None,
            "roughness": roughness.default_value if roughness else None,
            "transmission": transmission.default_value if transmission else None,
        }
    if emission is not None and emission.inputs.get("Strength") is not None:
        result["emissionStrength"] = emission.inputs["Strength"].default_value
    if body_visibility is not None:
        result["bodyVisibility"] = body_visibility.inputs[1].default_value
    return result


def cycles_device_diagnostics(enable_optix: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {
        "cyclesAddonAvailable": False,
        "requestedBackend": "OPTIX",
        "optixAvailable": False,
        "enabledOptixDevices": [],
        "devices": [],
        "error": None,
    }
    try:
        addon = bpy.context.preferences.addons.get("cycles")
        if addon is None:
            result["error"] = "Cycles add-on is unavailable"
            return result
        result["cyclesAddonAvailable"] = True
        preferences = addon.preferences
        try:
            preferences.compute_device_type = "OPTIX"
        except Exception as exc:
            result["error"] = f"Cannot select OPTIX: {exc}"
            return result
        preferences.get_devices()
        enabled: list[str] = []
        for device in preferences.devices:
            entry = {
                "name": device.name,
                "type": device.type,
                "use": bool(device.use),
                "isNvidia": "NVIDIA" in device.name.upper()
                or device.type == "OPTIX",
            }
            result["devices"].append(entry)
            should_enable = device.type == "OPTIX"
            if enable_optix:
                device.use = should_enable
            if should_enable:
                enabled.append(device.name)
        result["enabledOptixDevices"] = enabled
        result["optixAvailable"] = bool(enabled)
    except Exception as exc:
        result["error"] = repr(exc)
    return result


def classify_scene_objects() -> dict[str, list[str]]:
    membrane_collections = {
        "Rear_Neural_Canopy",
        "Mid_Living_Tissue",
        "Foreground_Veils",
    }
    fiber_names: list[str] = []
    membrane_names: list[str] = []
    signal_names: list[str] = []
    cavity_names: list[str] = []
    answer_names: list[str] = []
    citation_names: list[str] = []
    keyword_names: list[str] = []
    for obj in bpy.data.objects:
        lower = obj.name.lower()
        if object_in_collection(obj, membrane_collections):
            membrane_names.append(obj.name)
        if obj.type == "CURVE" and (
            "fiber" in lower
            or "branch" in lower
            or "link" in lower
            or "vein" in lower
            or "stream" in lower
        ):
            fiber_names.append(obj.name)
        if "_node_" in lower or lower.startswith("seed_node"):
            signal_names.append(obj.name)
        if any(
            token in lower
            for token in (
                "convergence",
                "lower_bridge",
                "cavity",
                "camera_focus_core",
                "seed_node",
            )
        ):
            cavity_names.append(obj.name)
        if lower.startswith("answer_"):
            answer_names.append(obj.name)
        if lower.startswith("citation_"):
            citation_names.append(obj.name)
        if lower.startswith("keyword_"):
            keyword_names.append(obj.name)
    return {
        "membraneObjects": sorted(membrane_names),
        "neuralFiberObjects": sorted(fiber_names),
        "signalNodeObjects": sorted(signal_names),
        "centralCavityObjects": sorted(cavity_names),
        "answerObjects": sorted(answer_names),
        "citationObjects": sorted(citation_names),
        "keywordObjects": sorted(keyword_names),
    }


def current_candidate_parameters() -> dict[str, Any]:
    scene = bpy.context.scene
    world = scene.world
    background = (
        world.node_tree.nodes.get("WorldBackground")
        if world is not None and world.use_nodes
        else None
    )
    membrane_roles = {
        "rear": bpy.data.materials.get("Rear_Membrane_Master"),
        "mid": bpy.data.materials.get("Mid_Membrane_Master"),
        "foreground": bpy.data.materials.get("Foreground_Membrane_Master"),
    }
    body: dict[str, Any] = {}
    edge: dict[str, Any] = {}
    for role, material in membrane_roles.items():
        if material is None or not material.use_nodes:
            continue
        body_node = material.node_tree.nodes.get("BodyVisibility")
        edge_node = material.node_tree.nodes.get("EdgeEmission")
        body[role] = body_node.inputs[1].default_value if body_node else None
        edge[role] = (
            edge_node.inputs["Strength"].default_value if edge_node else None
        )
    return {
        "sceneCandidateMarker": scene.get("v419b_candidate"),
        "exposure": scene.view_settings.exposure,
        "look": scene.view_settings.look,
        "worldStrength": (
            background.inputs["Strength"].default_value if background else None
        ),
        "bodyVisibility": body,
        "edgeEmission": edge,
        "denseDetailHidden": (
            bpy.data.collections.get("DENSE_DETAIL").hide_render
            if bpy.data.collections.get("DENSE_DETAIL")
            else None
        ),
    }


def build_scene_audit(
    config: dict[str, Any],
    source_path: Path,
    source_sha256: str,
    gpu: dict[str, Any],
) -> dict[str, Any]:
    scene = bpy.context.scene
    type_counts = Counter(obj.type for obj in bpy.data.objects)
    modifiers = [
        {
            "object": obj.name,
            "name": modifier.name,
            "type": modifier.type,
        }
        for obj in bpy.data.objects
        for modifier in obj.modifiers
    ]
    geometry_node_modifiers = [
        entry for entry in modifiers if entry["type"] == "NODES"
    ]
    geometry_node_groups = [
        group.name
        for group in bpy.data.node_groups
        if getattr(group, "bl_idname", "") == "GeometryNodeTree"
    ]
    world = scene.world
    background = (
        world.node_tree.nodes.get("WorldBackground")
        if world is not None and world.use_nodes
        else None
    )
    cycles = scene.cycles
    candidate_baselines = config["candidateBaselines"]
    return {
        "schemaVersion": 1,
        "auditPurpose": "GEO V4.1.9-B prepare-only scene inventory",
        "sourceBlend": str(source_path),
        "sourceSha256": source_sha256,
        "blenderVersion": bpy.app.version_string,
        "blenderBuildDate": bpy.app.build_date.decode(
            "utf-8", errors="replace"
        )
        if isinstance(bpy.app.build_date, bytes)
        else str(bpy.app.build_date),
        "collectionHierarchy": collection_hierarchy(),
        "counts": {
            "objects": len(bpy.data.objects),
            "objectsByType": dict(sorted(type_counts.items())),
            "meshObjects": type_counts.get("MESH", 0),
            "meshDataBlocks": len(bpy.data.meshes),
            "curveObjects": type_counts.get("CURVE", 0),
            "curveDataBlocks": len(bpy.data.curves),
            "materials": len(bpy.data.materials),
            "lights": len(bpy.data.lights),
            "cameras": len(bpy.data.cameras),
            "modifiers": len(modifiers),
            "geometryNodesModifiers": len(geometry_node_modifiers),
            "geometryNodesGroups": len(geometry_node_groups),
        },
        "modifiers": modifiers,
        "geometryNodes": {
            "modifierEntries": geometry_node_modifiers,
            "nodeGroups": sorted(geometry_node_groups),
        },
        "candidateDifferences": {
            key: candidate_baselines[key] for key in ("A", "B", "C")
        },
        "candidateBActualParameters": candidate_baselines["B"],
        "sourceSceneActualParameters": current_candidate_parameters(),
        "world": {
            "name": world.name if world else None,
            "color": (
                list(background.inputs["Color"].default_value)
                if background
                else None
            ),
            "strength": (
                background.inputs["Strength"].default_value
                if background
                else None
            ),
        },
        "colorManagement": {
            "look": scene.view_settings.look,
            "exposure": scene.view_settings.exposure,
            "gamma": scene.view_settings.gamma,
            "viewTransform": scene.view_settings.view_transform,
        },
        "cycles": {
            "renderEngine": scene.render.engine,
            "device": cycles.device,
            "samples": cycles.samples,
            "previewSamples": cycles.preview_samples,
            "useAdaptiveSampling": cycles.use_adaptive_sampling,
            "adaptiveThreshold": cycles.adaptive_threshold,
            "useDenoising": cycles.use_denoising,
            "transparentMaxBounces": cycles.transparent_max_bounces,
            "volumeBounces": cycles.volume_bounces,
            "seed": cycles.seed,
        },
        "gpuDiagnostics": gpu,
        "materials": [
            material_snapshot(material)
            for material in sorted(bpy.data.materials, key=lambda item: item.name)
        ],
        "objects": classify_scene_objects(),
        "visualRisks": config["visualRisks"],
    }


def candidate_base_strength(material: bpy.types.Material) -> float | None:
    if not material.use_nodes or material.node_tree is None:
        return None
    emission = material.node_tree.nodes.get("Emission")
    if emission is None or emission.inputs.get("Strength") is None:
        return None
    if "baseStrength" in material:
        return float(material["baseStrength"])
    current = float(emission.inputs["Strength"].default_value)
    return current / 0.82


def light_base_energy(light: bpy.types.Object) -> float:
    if "baseEnergy" in light:
        return float(light["baseEnergy"])
    current = float(light.data.energy)
    return current / 0.20


def apply_candidate_b_baseline(config: dict[str, Any]) -> None:
    settings = config["candidateBaselines"]["B"]
    scene = bpy.context.scene
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = settings["exposure"]
    if scene.world and scene.world.use_nodes:
        background = scene.world.node_tree.nodes.get("WorldBackground")
        if background:
            background.inputs["Strength"].default_value = settings["worldStrength"]
    for role in ("rear", "mid", "foreground"):
        material = bpy.data.materials.get(f"{role.title()}_Membrane_Master")
        if material is None or not material.use_nodes:
            continue
        body = material.node_tree.nodes.get("BodyVisibility")
        edge = material.node_tree.nodes.get("EdgeEmission")
        if body:
            body.inputs[1].default_value = settings["bodyVisibility"][role]
        if edge:
            edge.inputs["Strength"].default_value = settings["edgeEmission"][role]
    for name in (
        "Deep_Neural_Fiber",
        "Answer_Ice_Fiber",
        "Citation_Cold_Purple_Fiber",
        "Keyword_Cyan_Fiber",
        "Ice_Node",
        "Purple_Node",
        "Cyan_Node",
        "White_Node",
    ):
        material = bpy.data.materials.get(name)
        if material is None:
            continue
        base = candidate_base_strength(material)
        emission = (
            material.node_tree.nodes.get("Emission")
            if material.use_nodes and material.node_tree
            else None
        )
        if base is not None and emission is not None:
            material["baseStrength"] = base
            emission.inputs["Strength"].default_value = (
                base * settings["glowMultiplier"]
            )
    for light in bpy.data.objects:
        if light.type != "LIGHT":
            continue
        base = light_base_energy(light)
        light["baseEnergy"] = base
        light.data.energy = base * settings["lightMultiplier"]
    dense = bpy.data.collections.get("DENSE_DETAIL")
    if dense:
        dense.hide_render = not settings["denseDetail"]
    scene["v419b_candidate"] = "B"


def store_vector_base(obj: bpy.types.Object, key: str, value: Vector) -> None:
    if key not in obj:
        obj[key] = [float(component) for component in value]


def stored_vector(obj: bpy.types.Object, key: str) -> Vector:
    return Vector(tuple(float(value) for value in obj[key]))


def set_emission(material_name: str, strength: float) -> None:
    material = bpy.data.materials.get(material_name)
    if material is None or not material.use_nodes or material.node_tree is None:
        return
    emission = material.node_tree.nodes.get("Emission")
    if emission and emission.inputs.get("Strength"):
        emission.inputs["Strength"].default_value = strength


def phase_b1(config: dict[str, Any]) -> dict[str, Any]:
    settings = config["phases"]["b1"]
    scene = bpy.context.scene
    scene.view_settings.exposure = settings["exposure"]
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world and scene.world.use_nodes:
        background = scene.world.node_tree.nodes.get("WorldBackground")
        if background:
            background.inputs["Strength"].default_value = settings["worldStrength"]
    changed_materials: list[str] = []
    for role, values in settings["membrane"].items():
        material = bpy.data.materials.get(f"{role.title()}_Membrane_Master")
        if material is None or not material.use_nodes:
            continue
        nodes = material.node_tree.nodes
        principled = nodes.get("MembraneBody")
        set_input(principled, ("Base Color",), values["baseColor"])
        set_input(principled, ("Roughness",), values["roughness"])
        set_input(
            principled,
            ("Transmission Weight", "Transmission"),
            values["transmission"],
        )
        set_input(principled, ("IOR",), values["ior"])
        body = nodes.get("BodyVisibility")
        edge = nodes.get("EdgeEmission")
        if body:
            body.inputs[1].default_value = values["bodyVisibility"]
        if edge:
            edge.inputs["Strength"].default_value = values["edgeEmission"]
        changed_materials.append(material.name)
    for name, strength in settings["fiberEmission"].items():
        set_emission(name, strength)
        changed_materials.append(name)
    for name, strength in settings["nodeEmission"].items():
        set_emission(name, strength)
        changed_materials.append(name)
    scaled_nodes = 0
    for obj in bpy.data.objects:
        lower = obj.name.lower()
        category = None
        if lower.startswith("answer_node"):
            category = "answer"
        elif lower.startswith("citation_node"):
            category = "citation"
        elif lower.startswith("keyword_node"):
            category = "keyword"
        elif lower.startswith("seed_node"):
            category = "seed"
        elif "_node_" in lower:
            category = "white"
        if category is None:
            continue
        store_vector_base(obj, "v419b_base_scale", obj.scale.copy())
        obj.scale = stored_vector(obj, "v419b_base_scale") * float(
            settings["nodeScale"][category]
        )
        scaled_nodes += 1
    changed_lights: list[str] = []
    for name, multiplier in settings["lightMultipliers"].items():
        light = bpy.data.objects.get(name)
        if light is None or light.type != "LIGHT":
            continue
        base = light_base_energy(light)
        light["baseEnergy"] = base
        light.data.energy = base * multiplier
        changed_lights.append(name)
    scene["v419b_applied_b1"] = True
    return {
        "materials": sorted(set(changed_materials)),
        "scaledNodes": scaled_nodes,
        "lights": changed_lights,
    }


def iter_curve_points(obj: bpy.types.Object):
    if obj.type != "CURVE":
        return
    for spline in obj.data.splines:
        if spline.type == "BEZIER":
            for point in spline.bezier_points:
                yield point, "co"
        else:
            for point in spline.points:
                yield point, "co"


def phase_b2(config: dict[str, Any]) -> dict[str, Any]:
    settings = config["phases"]["b2"]
    core = Vector(config["corePosition"])
    moved_objects: list[str] = []
    for name, depth_offset in settings["centralObjectDepthOffsets"].items():
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        store_vector_base(obj, "v419b_base_location", obj.location.copy())
        location = stored_vector(obj, "v419b_base_location")
        location.y += float(depth_offset)
        obj.location = location
        moved_objects.append(name)
        modifier = obj.modifiers.get("B2_Cavity_Wrinkle")
        if modifier is None:
            texture_name = f"B2_Cavity_Noise_{name}"
            texture = bpy.data.textures.get(texture_name)
            if texture is None:
                texture = bpy.data.textures.new(texture_name, type="DISTORTED_NOISE")
            texture.noise_scale = settings["centralWrinkle"]["noiseScale"]
            texture.noise_depth = settings["centralWrinkle"]["noiseDepth"]
            modifier = obj.modifiers.new("B2_Cavity_Wrinkle", "DISPLACE")
            modifier.texture = texture
            modifier.texture_coords = "GLOBAL"
        modifier.strength = settings["centralWrinkle"]["strength"]
        modifier.mid_level = settings["centralWrinkle"]["midLevel"]
    converged_curves = 0
    fiber_collections = {"CELLULAR_NETWORK", "DENSE_DETAIL"}
    radius = float(settings["fiberConvergenceRadius"])
    strength = float(settings["fiberConvergenceStrength"])
    depth_pull = float(settings["fiberDepthPull"])
    for obj in bpy.data.objects:
        if (
            obj.type != "CURVE"
            or not object_in_collection(obj, fiber_collections)
            or obj.get("v419b_b2_converged")
        ):
            continue
        changed = False
        inverse = obj.matrix_world.inverted()
        for point, attribute in iter_curve_points(obj):
            coordinate = getattr(point, attribute)
            local = Vector(coordinate[:3])
            world = obj.matrix_world @ local
            distance = math.hypot(world.x - core.x, world.z - core.z)
            factor = max(0.0, 1.0 - distance / radius)
            if factor <= 0.0:
                continue
            world.x += (core.x - world.x) * strength * factor
            world.z += (core.z - world.z) * strength * factor
            world.y += depth_pull * factor
            transformed = inverse @ world
            if len(coordinate) == 4:
                point.co = (*transformed, coordinate[3])
            else:
                point.co = transformed
            changed = True
        if changed:
            obj["v419b_b2_converged"] = True
            converged_curves += 1
    shrunken_cells = 0
    radius = float(settings["cellShrinkRadius"])
    minimum = float(settings["cellMinimumScale"])
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not object_in_collection(obj, fiber_collections):
            continue
        distance = math.hypot(obj.location.x - core.x, obj.location.z - core.z)
        factor = max(0.0, 1.0 - distance / radius)
        if factor <= 0.0:
            continue
        store_vector_base(obj, "v419b_b2_input_scale", obj.scale.copy())
        scale_factor = 1.0 - (1.0 - minimum) * factor
        obj.scale = stored_vector(obj, "v419b_b2_input_scale") * scale_factor
        shrunken_cells += 1
    foreground_changed: list[str] = []
    for name, values in settings["foreground"].items():
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        store_vector_base(obj, "v419b_base_location", obj.location.copy())
        store_vector_base(obj, "v419b_base_scale", obj.scale.copy())
        obj.location = stored_vector(obj, "v419b_base_location") + Vector(
            values["locationOffset"]
        )
        obj.scale = stored_vector(obj, "v419b_base_scale") * float(
            values["scaleMultiplier"]
        )
        foreground_changed.append(name)
    bpy.context.scene["v419b_applied_b2"] = True
    return {
        "centralObjects": moved_objects,
        "convergedCurves": converged_curves,
        "shrunkenCells": shrunken_cells,
        "foregroundObjects": foreground_changed,
    }


def business_region(name: str) -> str | None:
    lower = name.lower()
    for region in ("answer", "citation", "keyword"):
        if lower.startswith(f"{region}_"):
            return region
    return None


def phase_b3(config: dict[str, Any]) -> dict[str, Any]:
    settings = config["phases"]["b3"]
    adjusted_curves = Counter()
    adjusted_nodes = Counter()
    business_collections = {"BUSINESS_ORGANISM", "DENSE_DETAIL"}
    for obj in bpy.data.objects:
        region = business_region(obj.name)
        if region is None or not object_in_collection(obj, business_collections):
            continue
        store_vector_base(obj, "v419b_base_location", obj.location.copy())
        location = stored_vector(obj, "v419b_base_location")
        location.y += float(settings["regionDepthOffsets"][region])
        obj.location = location
        if obj.type == "CURVE":
            curve = obj.data
            if "v419b_base_bevel_depth" not in curve:
                curve["v419b_base_bevel_depth"] = float(curve.bevel_depth)
            curve.bevel_depth = float(curve["v419b_base_bevel_depth"]) * float(
                settings["curveWidthMultipliers"][region]
            )
            adjusted_curves[region] += 1
        elif obj.type == "MESH" and "_node_" in obj.name.lower():
            store_vector_base(obj, "v419b_b3_input_scale", obj.scale.copy())
            obj.scale = stored_vector(obj, "v419b_b3_input_scale") * float(
                settings["nodeScaleMultipliers"][region]
            )
            adjusted_nodes[region] += 1
    for name, strength in settings["materialEmission"].items():
        set_emission(name, strength)
    bpy.context.scene["v419b_applied_b3"] = True
    return {
        "curvesByRegion": dict(adjusted_curves),
        "nodesByRegion": dict(adjusted_nodes),
        "forbiddenStructures": settings["forbiddenStructures"],
    }


def configure_optix_or_fail() -> dict[str, Any]:
    diagnostics = cycles_device_diagnostics(enable_optix=True)
    if not diagnostics["optixAvailable"]:
        raise RuntimeError(
            "NVIDIA OptiX is required for rendering. CPU fallback is disabled. "
            f"Diagnostics: {json.dumps(diagnostics, ensure_ascii=False)}"
        )
    bpy.context.scene.cycles.device = "GPU"
    return diagnostics


def configure_render_preset(
    config: dict[str, Any], preset_name: str
) -> dict[str, Any]:
    preset = config["presets"][preset_name]
    if preset["engine"] != "CYCLES" or preset["device"] != "OPTIX":
        raise RuntimeError(f"Unsafe preset configuration: {preset_name}")
    gpu = configure_optix_or_fail()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = int(preset["samples"])
    scene.cycles.seed = int(config.get("seed", SEED_FALLBACK))
    scene.cycles.use_adaptive_sampling = bool(preset["useAdaptiveSampling"])
    scene.cycles.adaptive_threshold = float(preset["adaptiveThreshold"])
    scene.cycles.use_denoising = True
    if hasattr(scene.cycles, "denoiser"):
        scene.cycles.denoiser = "OPTIX"
    scene.cycles.transparent_max_bounces = int(preset["transparentBounces"])
    scene.cycles.volume_bounces = int(preset["volumeBounces"])
    if hasattr(scene.cycles, "volume_step_rate"):
        scene.cycles.volume_step_rate = float(preset["volumeStepRate"])
    scene.render.resolution_x = int(preset["width"])
    scene.render.resolution_y = int(preset["height"])
    scene.render.resolution_percentage = int(preset["resolutionPercentage"])
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = str(preset["colorDepth"])
    scene.view_settings.look = preset["colorManagement"]
    return gpu


def render_phase(
    config: dict[str, Any],
    phase: str,
    preset: str,
    output_dir: Path,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    camera = bpy.data.objects.get("Camera_Main_16x9")
    if camera is None or camera.type != "CAMERA":
        raise RuntimeError("Camera_Main_16x9 is missing")
    scene.camera = camera
    output = output_dir / f"candidate-b-{phase}-{preset}.png"
    scene.render.filepath = str(output)
    started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    return {
        "output": str(output),
        "seconds": round(time.perf_counter() - started, 3),
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")


def resolved_paths(
    args: argparse.Namespace, config: dict[str, Any]
) -> tuple[Path, Path, Path, Path]:
    paths = config["paths"]
    source = resolve_project_path(args.source or paths["sourceBlend"])
    working = resolve_project_path(args.working or paths["workingBlend"])
    audit = resolve_project_path(args.audit or paths["auditJson"])
    output = resolve_project_path(args.output_dir or paths["renderOutput"])
    return source, working, audit, output


def prepare_only(
    args: argparse.Namespace,
    config: dict[str, Any],
    source: Path,
    working: Path,
    audit_path: Path,
) -> None:
    if source == working:
        raise RuntimeError("Working blend must not overwrite the source master")
    if working.exists() and not args.force_working_copy:
        raise FileExistsError(
            f"Working blend already exists: {working}. "
            "Use --force-working-copy only after preserving it."
        )
    source_before = sha256_file(source)
    expected = config["lockedSourceSha256"].upper()
    if source_before != expected:
        raise RuntimeError(
            f"Source master SHA-256 mismatch: {source_before} != {expected}"
        )
    open_blend(source)
    gpu = cycles_device_diagnostics(enable_optix=False)
    audit = build_scene_audit(config, source, source_before, gpu)
    apply_candidate_b_baseline(config)
    scene = bpy.context.scene
    scene["v419b_working_copy"] = True
    scene["v419b_source_path"] = str(source)
    scene["v419b_source_sha256"] = source_before
    scene["v419b_seed"] = int(config.get("seed", SEED_FALLBACK))
    scene["v419b_prepared_only"] = True
    scene["v419b_candidate"] = "B"
    save_blend(working)
    source_after = sha256_file(source)
    if source_after != source_before:
        raise RuntimeError("Source master changed during prepare-only")
    audit["prepareOnly"] = {
        "success": True,
        "sourceSha256Before": source_before,
        "sourceSha256After": source_after,
        "sourceUnchanged": True,
        "workingBlend": str(working),
        "workingBlendSize": working.stat().st_size,
        "workingBlendSha256": sha256_file(working),
        "workingCandidate": "B",
        "renderExecuted": False,
        "highLoadGeometryNodesExecuted": False,
    }
    write_json(audit_path, audit)
    print("GEO_V4_CANDIDATE_B_PREPARE_OK")
    print(json.dumps(audit["prepareOnly"], ensure_ascii=False, sort_keys=True))


def diagnostics_only(
    config: dict[str, Any],
    source: Path,
    working: Path,
) -> None:
    source_sha256 = sha256_file(source)
    expected = config["lockedSourceSha256"].upper()
    if source_sha256 != expected:
        raise RuntimeError(
            f"Source master SHA-256 mismatch: {source_sha256} != {expected}"
        )
    open_blend(source)
    gpu = cycles_device_diagnostics(enable_optix=False)
    phase_plans = config["phasePlans"]
    b1_sequence = resolved_phase_sequence(config, "b1")
    b2_sequence = resolved_phase_sequence(config, "b2")
    b3_sequence = resolved_phase_sequence(config, "b3")
    summary = {
        "phasePlans": phase_plans,
        "b1ResolvedSequence": b1_sequence,
        "b2ResolvedSequence": b2_sequence,
        "b3ResolvedSequence": b3_sequence,
        "reviewResolvedSequence": b3_sequence,
        "finalResolvedSequence": b3_sequence,
        "sourceBlend": str(source),
        "sourceSha256": source_sha256,
        "workingBlend": str(working),
        "candidate": current_candidate_parameters(),
        "counts": {
            "objects": len(bpy.data.objects),
            "meshes": len(bpy.data.meshes),
            "curves": len(bpy.data.curves),
            "materials": len(bpy.data.materials),
        },
        "gpu": gpu,
        "renderExecuted": False,
        "saveExecuted": False,
    }
    print("GEO_V4_CANDIDATE_B_DIAGNOSTICS_OK")
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))


def execute_phase(
    config: dict[str, Any],
    source: Path,
    working: Path,
    output_dir: Path,
    phase: str,
    preset: str,
) -> None:
    if source == working:
        raise RuntimeError("Working blend must not overwrite the source master")
    source_before = sha256_file(source)
    expected = config["lockedSourceSha256"].upper()
    if source_before != expected:
        raise RuntimeError(
            f"Source master SHA-256 mismatch: {source_before} != {expected}"
        )
    open_blend(source)
    scene = bpy.context.scene
    random.seed(int(config.get("seed", SEED_FALLBACK)))
    apply_candidate_b_baseline(config)
    phase_functions = {"b1": phase_b1, "b2": phase_b2, "b3": phase_b3}
    plan = list(config["phasePlans"][phase])
    resolved_sequence = resolved_phase_sequence(config, phase)
    changes: dict[str, Any] = {}
    for planned_phase in plan:
        changes[planned_phase] = phase_functions[planned_phase](config)
    scene["v419b_working_copy"] = True
    scene["v419b_source_path"] = str(source)
    scene["v419b_source_sha256"] = source_before
    scene["v419b_candidate"] = "B"
    scene["v419b_last_phase"] = phase
    scene["v419b_last_preset"] = preset
    scene["v419b_resolved_sequence"] = json.dumps(resolved_sequence)
    scene["v419b_seed"] = int(config.get("seed", SEED_FALLBACK))
    gpu = configure_render_preset(config, preset)
    save_blend(working)
    source_after_prepare = sha256_file(source)
    if source_after_prepare != source_before:
        raise RuntimeError("Source master changed before rendering")
    render = render_phase(config, phase, preset, output_dir)
    save_blend(working)
    source_after_render = sha256_file(source)
    if source_after_render != source_before:
        raise RuntimeError("Source master changed during phase execution")
    result = {
        "phase": phase,
        "preset": preset,
        "resolvedSequence": resolved_sequence,
        "changes": changes,
        "gpu": gpu,
        "render": render,
        "sourceBlend": str(source),
        "sourceSha256Before": source_before,
        "sourceSha256After": source_after_render,
        "workingBlend": str(working),
        "workingBlendSha256": sha256_file(working),
    }
    print(f"GEO_V4_CANDIDATE_B_{phase.upper()}_{preset.upper()}_OK")
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


def main() -> None:
    args = parse_args()
    config = load_config(args.config)
    source, working, audit_path, output_dir = resolved_paths(args, config)
    if args.prepare_only:
        prepare_only(args, config, source, working, audit_path)
        return
    if args.diagnostics:
        diagnostics_only(config, source, working)
        return
    execute_phase(config, source, working, output_dir, args.phase, args.preset)


if __name__ == "__main__":
    main()
