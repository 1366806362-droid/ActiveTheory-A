#!/usr/bin/env python3
"""Test Home Preview safety rules without starting a Blender render."""

from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = Path(__file__).with_name("run_home_preview.py")


def load_preview_module():
    fake_bpy = types.ModuleType("bpy")
    fake_bpy.types = types.SimpleNamespace(Scene=object)
    sys.modules["bpy"] = fake_bpy
    spec = importlib.util.spec_from_file_location("home_preview_under_test", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


preview = load_preview_module()


class Device:
    def __init__(self, name: str, device_type: str):
        self.name = name
        self.type = device_type
        self.use = True


class Preferences:
    def __init__(self, devices):
        self.devices = devices
        self.compute_device_type = None

    def get_devices(self):
        return self.devices


def make_scene_and_preferences(devices):
    scene = types.SimpleNamespace(
        render=types.SimpleNamespace(
            engine=None,
            resolution_x=0,
            resolution_y=0,
            resolution_percentage=0,
            fps=0,
            image_settings=types.SimpleNamespace(file_format=None),
            use_motion_blur=False,
        ),
        cycles=types.SimpleNamespace(device=None, samples=0, use_denoising=False),
    )
    preferences = Preferences(devices)
    preview.bpy.context = types.SimpleNamespace(
        preferences=types.SimpleNamespace(
            addons={"cycles": types.SimpleNamespace(preferences=preferences)}
        )
    )
    return scene, preferences


SETTINGS = {
    "computeBackend": "OPTIX",
    "renderWidth": 1920,
    "renderHeight": 1080,
    "fps": 30,
    "denoise": True,
    "motionBlur": True,
}


class HomePreviewPipelineTests(unittest.TestCase):
    def test_scene_path_targets_home_lookdev(self):
        wrapper = (MODULE_PATH.with_suffix(".ps1")).read_text(encoding="utf-8")
        self.assertIn(
            "art\\hero-cinematic\\home-lookdev-v1\\hero-cinematic-home-lookdev-v1.blend",
            wrapper,
        )
        self.assertNotIn(
            "art\\hero-cinematic\\blender-shot-v1\\hero-cinematic-v2-prep.blend",
            wrapper,
        )

    def test_samples_default_and_allowed_overrides(self):
        self.assertEqual(preview.resolve_samples(256, None), 256)
        self.assertEqual(preview.resolve_samples(256, 64), 64)
        self.assertEqual(preview.resolve_samples(256, 128), 128)
        self.assertEqual(preview.resolve_samples(256, 256), 256)

    def test_samples_reject_unsupported_values(self):
        for value in (32, 512, -1):
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                preview.resolve_samples(256, value)

    def test_preview_token_keeps_exact_five_frames(self):
        frames = preview.parse_frames("1,78,145,198,240", "HOME_PREVIEW_5_FRAMES")
        self.assertEqual(frames, [1, 78, 145, 198, 240])
        with self.assertRaises(RuntimeError):
            preview.parse_frames("1,78,145,198", "HOME_PREVIEW_5_FRAMES")

    def test_optix_enables_only_optix_and_disables_cuda_and_cpu(self):
        devices = [
            Device("RTX 5060 Ti", "OPTIX"),
            Device("RTX 5060 Ti", "CUDA"),
            Device("Intel CPU", "CPU"),
        ]
        scene, preferences = make_scene_and_preferences(devices)
        result = preview.configure_cycles(scene, SETTINGS, 64)
        self.assertEqual(preferences.compute_device_type, "OPTIX")
        self.assertEqual(result["requestedBackend"], "OPTIX")
        self.assertEqual([item["type"] for item in result["activeGpuDevices"]], ["OPTIX"])
        self.assertTrue(devices[0].use)
        self.assertFalse(devices[1].use)
        self.assertFalse(devices[2].use)
        self.assertEqual(scene.cycles.samples, 64)

    def test_optix_missing_fails_without_cuda_fallback(self):
        devices = [Device("RTX 5060 Ti", "CUDA"), Device("Intel CPU", "CPU")]
        scene, _preferences = make_scene_and_preferences(devices)
        with self.assertRaisesRegex(RuntimeError, "No OPTIX"):
            preview.configure_cycles(scene, SETTINGS, 128)
        self.assertFalse(devices[0].use)
        self.assertFalse(devices[1].use)


if __name__ == "__main__":
    unittest.main(verbosity=2)
