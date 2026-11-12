"""Validate the original mall furnishings as self-contained, metre-scale GLBs."""

import hashlib
import json
import math
import struct
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "demos/corporate/gjh/v11/assets"
FILES = ("gjh-lounge-bench.glb", "gjh-areca-planter.glb")
IDENTITY = (1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    if magic != b"glTF" or version != 2 or length != len(raw):
        raise ValueError("Invalid GLB header or file length")
    chunks = []
    offset = 12
    while offset < len(raw):
        size, kind = struct.unpack_from("<II", raw, offset)
        offset += 8
        if size % 4 or offset + size > len(raw):
            raise ValueError("Invalid GLB chunk extent")
        chunks.append((kind, raw[offset:offset + size]))
        offset += size
    if [kind for kind, _ in chunks] != [0x4E4F534A, 0x004E4942]:
        raise ValueError("Expected one JSON and one embedded BIN chunk")
    return json.loads(chunks[0][1]), chunks[1][1]


def multiply(left, right):
    return tuple(sum(left[row + inner * 4] * right[inner + column * 4] for inner in range(4))
                 for column in range(4) for row in range(4))


def node_matrix(node):
    if "matrix" in node:
        return tuple(node["matrix"])
    x, y, z, w = node.get("rotation", (0, 0, 0, 1))
    sx, sy, sz = node.get("scale", (1, 1, 1))
    tx, ty, tz = node.get("translation", (0, 0, 0))
    return (
        (1 - 2 * (y*y + z*z)) * sx, 2 * (x*y + z*w) * sx, 2 * (x*z - y*w) * sx, 0,
        2 * (x*y - z*w) * sy, (1 - 2 * (x*x + z*z)) * sy, 2 * (y*z + x*w) * sy, 0,
        2 * (x*z + y*w) * sz, 2 * (y*z - x*w) * sz, (1 - 2 * (x*x + y*y)) * sz, 0,
        tx, ty, tz, 1,
    )


def position_points(document, binary, accessor_index):
    accessor = document["accessors"][accessor_index]
    if accessor["componentType"] != 5126 or accessor["type"] != "VEC3" or "sparse" in accessor:
        raise ValueError("Expected directly readable float POSITION data")
    view = document["bufferViews"][accessor["bufferView"]]
    if view.get("buffer", 0) != 0:
        raise ValueError("Position data must use the embedded buffer")
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", 12)
    count = accessor["count"]
    if count < 1 or stride < 12 or start + (count - 1) * stride + 12 > view.get("byteOffset", 0) + view["byteLength"]:
        raise ValueError("Position accessor escapes its buffer view")
    points = [struct.unpack_from("<fff", binary, start + index * stride) for index in range(count)]
    if not all(math.isfinite(value) for point in points for value in point):
        raise ValueError("Non-finite model position")
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    for expected, actual in zip(accessor["min"] + accessor["max"], low + high):
        if not math.isclose(expected, actual, rel_tol=1e-5, abs_tol=1e-5):
            raise ValueError("Declared accessor bounds differ from binary positions")
    return points


def scene_metrics(document, binary):
    points = []
    triangles = 0
    positions_cache = {}

    def visit(index, parent, ancestors):
        nonlocal triangles
        if index in ancestors:
            raise ValueError("Cyclic model scene")
        node = document["nodes"][index]
        transform = multiply(parent, node_matrix(node))
        if "mesh" in node:
            for primitive in document["meshes"][node["mesh"]]["primitives"]:
                if primitive.get("mode", 4) != 4:
                    raise ValueError("Furnishings must use triangle primitives")
                positions = primitive["attributes"]["POSITION"]
                if positions not in positions_cache:
                    positions_cache[positions] = position_points(document, binary, positions)
                count = document["accessors"][primitive.get("indices", positions)]["count"]
                if count % 3:
                    raise ValueError("Incomplete triangle primitive")
                triangles += count // 3
                for point in positions_cache[positions]:
                    points.append(tuple(sum(transform[row + axis * 4] * point[axis] for axis in range(3))
                                        + transform[row + 12] for row in range(3)))
        for child in node.get("children", []):
            visit(child, transform, (*ancestors, index))

    scene = document["scenes"][document.get("scene", 0)]
    for index in scene["nodes"]:
        visit(index, IDENTITY, ())
    if not points:
        raise ValueError("Model scene has no geometry")
    low = [min(point[axis] for point in points) for axis in range(3)]
    high = [max(point[axis] for point in points) for axis in range(3)]
    return [maximum - minimum for minimum, maximum in zip(low, high)], triangles


class FurnishingAssetTests(unittest.TestCase):
    def test_models_match_original_source_receipts_and_physical_bounds(self):
        receipt = json.loads((ASSETS / "furnishings-sources.json").read_text())
        self.assertEqual(receipt["schema_version"], 1)
        self.assertEqual(urlparse(receipt["source_repository"]).scheme, "https")
        self.assertRegex(receipt["source_commit"], r"^[0-9a-f]{40}$")
        entries = {entry["file"]: entry for entry in receipt["assets"]}
        self.assertEqual(set(entries), set(FILES))
        for filename in FILES:
            with self.subTest(model=filename):
                path = ASSETS / filename
                source = entries[filename]
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), source["sha256"])
                self.assertEqual(source["source"], "models/gjh-mall-furniture/exports/" + filename)
                self.assertTrue(source["license"])
                document, binary = read_glb(path)
                self.assertEqual(document["asset"]["version"], "2.0")
                self.assertEqual(len(document["buffers"]), 1)
                self.assertNotIn("uri", document["buffers"][0])
                self.assertLessEqual(document["buffers"][0]["byteLength"], len(binary))
                self.assertTrue(all("uri" not in image for image in document.get("images", [])))
                self.assertNotIn("KHR_draco_mesh_compression", document.get("extensionsRequired", []))
                dimensions, triangles = scene_metrics(document, binary)
                self.assertGreater(triangles, 0)
                self.assertEqual(triangles, source["triangles"])
                self.assertEqual(len(source["dimensions"]), 3)
                for actual, recorded in zip(dimensions, source["dimensions"]):
                    self.assertAlmostEqual(actual, recorded, delta=.03)
                self.assertTrue(all(.2 < extent < 4 for extent in dimensions), dimensions)
                if "bench" in filename:
                    self.assertTrue(1.5 < dimensions[0] < 3.5 and .6 < dimensions[1] < 1.8 and .3 < dimensions[2] < 1.5, dimensions)
                else:
                    self.assertTrue(.8 < dimensions[1] < 3, dimensions)


if __name__ == "__main__":
    unittest.main()
