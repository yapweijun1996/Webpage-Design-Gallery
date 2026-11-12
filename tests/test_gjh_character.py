"""Validate the pinned original visitor and its real, in-place animation data."""

import hashlib
import json
import math
import struct
import unittest
from urllib.parse import urlparse

from test_gjh_furnishings import ASSETS, read_glb, scene_metrics

MODEL = "gjh-mall-visitor.glb"


def float_values(document, binary, index):
    accessor = document["accessors"][index]
    if accessor["componentType"] != 5126 or "sparse" in accessor:
        raise ValueError("Animation samples must be embedded finite floats")
    components = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    view = document["bufferViews"][accessor["bufferView"]]
    if view.get("buffer", 0) != 0:
        raise ValueError("External animation buffer")
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", components * 4)
    end = start + (accessor["count"] - 1) * stride + components * 4
    if accessor["count"] < 1 or stride < components * 4 or end > view.get("byteOffset", 0) + view["byteLength"]:
        raise ValueError("Animation accessor exceeds its buffer view")
    values = [struct.unpack_from("<" + "f" * components, binary, start + i * stride)
              for i in range(accessor["count"])]
    if not all(math.isfinite(v) for row in values for v in row):
        raise ValueError("Non-finite animation data")
    return values


class CharacterAssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = (ASSETS / MODEL).read_bytes()
        cls.document, cls.binary = read_glb(ASSETS / MODEL)

    def test_pinned_source_receipt(self):
        receipt = json.loads((ASSETS / "character-sources.json").read_text())
        self.assertEqual(receipt["schema_version"], 1)
        self.assertEqual(urlparse(receipt["source_repository"]).scheme, "https")
        self.assertRegex(receipt["source_commit"], r"^[0-9a-f]{40}$")
        source = next(entry for entry in receipt["assets"] if entry["file"] == MODEL)
        self.assertEqual(source["source"], "models/gjh-mall-visitor/exports/" + MODEL)
        self.assertEqual(source["sha256"], hashlib.sha256(self.raw).hexdigest())
        self.assertTrue(source["license"].strip())
        dimensions, triangles = scene_metrics(self.document, self.binary)
        self.assertEqual(source["triangles"], triangles)
        self.assertEqual(len(source["dimensions"]), 3)
        for actual, recorded in zip(dimensions, source["dimensions"]):
            self.assertAlmostEqual(actual, recorded, delta=.03)

    def test_embedded_geometry_materials_and_native_scale(self):
        doc = self.document
        self.assertLess(len(self.raw), 2_000_000)
        self.assertEqual(len(doc["buffers"]), 1)
        self.assertNotIn("uri", doc["buffers"][0])
        self.assertLessEqual(doc["buffers"][0]["byteLength"], len(self.binary))
        self.assertTrue(all("uri" not in image for image in doc.get("images", [])))
        self.assertNotIn("KHR_draco_mesh_compression", doc.get("extensionsRequired", []))
        dimensions, triangles = scene_metrics(doc, self.binary)
        self.assertTrue(1.60 <= dimensions[1] <= 1.85, dimensions)
        self.assertTrue(.20 < dimensions[0] < 1.6 and .12 < dimensions[2] < 1.2, dimensions)
        # The reference's 2–5k aspiration has a documented art-quality exception;
        # retain a hard 15k ceiling and the integrated scene's draw-call budget.
        self.assertTrue(500 < triangles <= 15_000, triangles)
        self.assertLessEqual(sum(len(mesh["primitives"]) for mesh in doc["meshes"]), 25)
        self.assertTrue(3 <= len(doc["materials"]) <= 32)
        roots = doc["scenes"][doc.get("scene", 0)]["nodes"]
        self.assertIn("GJHMallVisitor", [doc["nodes"][node].get("name") for node in roots])

    def test_clips_have_finite_looping_articulation_without_root_travel(self):
        doc, binary = self.document, self.binary
        clips = {clip["name"]: clip for clip in doc["animations"]}
        self.assertTrue({"idle", "walk", "sprint"}.issubset(clips))
        scene_roots = set(doc["scenes"][doc.get("scene", 0)]["nodes"])
        for name in ("idle", "walk", "sprint"):
            with self.subTest(clip=name):
                clip = clips[name]
                moving_rotations = set()
                moving_channels = 0
                duration = 0
                for channel in clip["channels"]:
                    sampler = clip["samplers"][channel["sampler"]]
                    self.assertIn(sampler.get("interpolation", "LINEAR"), ("LINEAR", "STEP"))
                    times = [row[0] for row in float_values(doc, binary, sampler["input"])]
                    values = float_values(doc, binary, sampler["output"])
                    self.assertEqual(len(times), len(values))
                    self.assertGreaterEqual(len(times), 2)
                    self.assertTrue(all(a < b for a, b in zip(times, times[1:])))
                    # Blender may export frame 1 as 1/FPS. glTF permits a
                    # nonzero first sample; it is not evidence of root travel.
                    self.assertGreaterEqual(times[0], 0)
                    if any(any(abs(a - b) > 1e-5 for a, b in zip(values[0], row)) for row in values[1:]):
                        moving_channels += 1
                    duration = max(duration, times[-1] - times[0])
                    target = channel["target"]
                    if target["path"] == "rotation":
                        for row in values:
                            self.assertAlmostEqual(sum(v*v for v in row), 1, delta=.003)
                        self.assertGreater(abs(sum(a*b for a, b in zip(values[0], values[-1]))), .995)
                        if any(abs(sum(a*b for a, b in zip(values[0], row))) < .99999 for row in values[1:]):
                            moving_rotations.add(target["node"])
                    elif target["path"] == "translation":
                        # Every local channel closes horizontally; global/root channels
                        # also stay in place throughout, not merely on the last frame.
                        for axis in (0, 2):
                            self.assertAlmostEqual(values[0][axis], values[-1][axis], delta=.02)
                            node_name = doc["nodes"][target["node"]].get("name", "").lower()
                            if target["node"] in scene_roots or node_name in ("root", "hips", "pelvis"):
                                self.assertLess(max(v[axis] for v in values) - min(v[axis] for v in values), .04)
                self.assertTrue(.3 <= duration <= 10, duration)
                self.assertGreater(moving_channels, 0)
                if name != "idle":
                    self.assertGreaterEqual(len(moving_rotations), 6)


if __name__ == "__main__":
    unittest.main()
