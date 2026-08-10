"""Lightweight unit tests for the Blender-to-Three handoff converter."""

import json
import math
import unittest
from pathlib import Path

from convert_handoff_to_three import (
    EXPECTED_BASELINE_SHA256,
    convert_baseline,
    convert_position,
    load_baseline,
    serialize_payload,
)


ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "docs/hero-cinematic/blender-shot-v1/hero-handoff-baseline-v11.json"


class HandoffConversionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline, cls.baseline_sha = load_baseline(BASELINE)
        cls.converted = convert_baseline(cls.baseline, cls.baseline_sha)

    def test_baseline_sha_is_locked(self):
        self.assertEqual(self.baseline_sha, EXPECTED_BASELINE_SHA256)

    def test_basis_maps_z_up_to_y_up(self):
        self.assertEqual(convert_position([1, 2, 3]), [1.0, 3.0, -2.0])

    def test_quaternion_is_normalized(self):
        quaternion = self.converted["camera"]["quaternionXYZW"]
        self.assertAlmostEqual(math.sqrt(sum(value * value for value in quaternion)), 1.0, places=8)

    def test_camera_forward_matches_target(self):
        self.assertGreaterEqual(self.converted["camera"]["forwardAlignmentDot"], 0.999999)

    def test_three_uses_vertical_fov(self):
        self.assertEqual(self.converted["camera"]["verticalFovDeg"], 34.537989)
        self.assertNotEqual(self.converted["camera"]["verticalFovDeg"], self.converted["camera"]["horizontalFovDeg"])

    def test_render_target_preserves_aspect(self):
        render = self.converted["render"]
        self.assertEqual([render["width"], render["height"]], [1920, 1080])
        self.assertAlmostEqual(render["aspect"], self.baseline["renderWidth"] / self.baseline["renderHeight"], places=8)

    def test_entry_anchors_are_distinct(self):
        positions = {tuple(anchor["position"]) for anchor in self.converted["entryAnchors"].values()}
        self.assertEqual(len(positions), 3)

    def test_handoff_range_is_locked(self):
        self.assertEqual(self.converted["handoff"], {
            "prepareStart": 0.88,
            "blendStart": 0.96,
            "blendEnd": 1.0,
            "finalProgress": 1.0,
        })

    def test_conversion_is_deterministic(self):
        second = convert_baseline(self.baseline, self.baseline_sha)
        self.assertEqual(serialize_payload(self.converted), serialize_payload(second))

    def test_output_has_no_non_finite_values(self):
        encoded = serialize_payload(self.converted)
        self.assertNotIn(b"NaN", encoded)
        self.assertNotIn(b"Infinity", encoded)
        json.loads(encoded)


if __name__ == "__main__":
    unittest.main(verbosity=2)
