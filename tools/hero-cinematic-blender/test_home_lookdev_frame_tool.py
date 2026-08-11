#!/usr/bin/env python3
"""Test the locked single-frame Home LookDev tool without rendering."""

from __future__ import annotations

import importlib.util
import sys
import types
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("run_home_lookdev_frame.py")
PREVIEW_PATH = Path(__file__).with_name("run_home_preview.py")


def load_module(path: Path, name: str):
    fake_bpy = types.ModuleType("bpy")
    fake_bpy.types = types.SimpleNamespace(Scene=object)
    sys.modules["bpy"] = fake_bpy
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


lookdev = load_module(MODULE_PATH, "home_lookdev_frame_under_test")
preview = load_module(PREVIEW_PATH, "home_preview_guard_under_test")


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


def make_scene(devices):
    scene = types.SimpleNamespace(
        render=types.SimpleNamespace(
            engine=None,
            resolution_x=0,
            resolution_y=0,
            resolution_percentage=0,
            image_settings=types.SimpleNamespace(file_format=None),
            film_transparent=True,
            use_motion_blur=False,
        ),
        cycles=types.SimpleNamespace(device=None, samples=0, use_denoising=False),
    )
    preferences = Preferences(devices)
    lookdev.bpy.context = types.SimpleNamespace(
        preferences=types.SimpleNamespace(
            addons={"cycles": types.SimpleNamespace(preferences=preferences)}
        )
    )
    return scene, preferences


class HomeLookdevFrameToolTests(unittest.TestCase):
    def test_constants_lock_single_frame_and_samples(self):
        self.assertEqual(lookdev.FRAME, 145)
        self.assertEqual(lookdev.SAMPLES, 32)
        self.assertEqual(lookdev.CONFIRMATION, "HOME_LOOKDEV_FRAME_145")

    def test_confirmation_rejects_any_other_token(self):
        original = sys.argv
        try:
            sys.argv = ["tool", "--", "--confirm-render", "WRONG"]
            with self.assertRaisesRegex(RuntimeError, "only HOME_LOOKDEV_FRAME_145"):
                lookdev.parse_args()
            sys.argv = ["tool", "--", "--confirm-render", "HOME_LOOKDEV_FRAME_145"]
            self.assertEqual(lookdev.parse_args().confirm_render, "HOME_LOOKDEV_FRAME_145")
        finally:
            sys.argv = original

    def test_optix_only_and_32_samples(self):
        devices = [
            Device("RTX 5060 Ti", "OPTIX"),
            Device("RTX 5060 Ti", "CUDA"),
            Device("Intel CPU", "CPU"),
        ]
        scene, preferences = make_scene(devices)
        result = lookdev.configure_optix(scene)
        self.assertEqual(preferences.compute_device_type, "OPTIX")
        self.assertEqual(scene.cycles.samples, 32)
        self.assertTrue(devices[0].use)
        self.assertFalse(devices[1].use)
        self.assertFalse(devices[2].use)
        self.assertEqual([item["type"] for item in result["activeGpuDevices"]], ["OPTIX"])

    def test_optix_missing_has_no_fallback(self):
        devices = [Device("RTX 5060 Ti", "CUDA"), Device("Intel CPU", "CPU")]
        scene, _preferences = make_scene(devices)
        with self.assertRaisesRegex(RuntimeError, "No OPTIX"):
            lookdev.configure_optix(scene)
        self.assertFalse(devices[0].use)
        self.assertFalse(devices[1].use)

    def test_wrapper_has_no_frame_or_sample_override(self):
        wrapper = MODULE_PATH.with_suffix(".ps1").read_text(encoding="utf-8")
        self.assertIn("HOME_LOOKDEV_FRAME_145", wrapper)
        self.assertIn("frame-145-lookdev-v12.png", wrapper)
        self.assertNotIn("[int]$Frame", wrapper)
        self.assertNotIn("[int]$Samples", wrapper)
        self.assertIn("$null -ne $exitCode", wrapper)
        self.assertIn("$log.status -ne 'complete'", wrapper)

    def test_formal_preview_whitelist_remains_unchanged(self):
        self.assertEqual(preview.PREVIEW_FRAMES, [1, 78, 145, 198, 240])
        self.assertEqual(preview.ALLOWED_SAMPLES, (64, 128, 256))
        self.assertNotIn(32, preview.ALLOWED_SAMPLES)


if __name__ == "__main__":
    unittest.main(verbosity=2)
