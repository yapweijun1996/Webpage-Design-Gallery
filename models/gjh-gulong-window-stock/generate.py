"""Keep the first two complete courses of the gallery's unprinted tin display."""
import argparse
import hashlib
from pathlib import Path
import sys

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "demos/corporate/gjh/v11/assets/gallery-assets"
SOURCE = ASSETS / "stacked-can-pyramid.glb"
SOURCE_SHA256 = "cf8cf126e0a0783f4ee9ac585b306caa6714c6dafc6a3dfbbaff117d3d494527"
TOP = .68


def generate(output):
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("Check the source tin courses and material layout before regenerating")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    cans = bpy.data.objects["CANS_BatchedDisplay"]
    mesh = bmesh.new()
    mesh.from_mesh(cans.data)
    # Courses meet exactly. Keep the upper face of the second lid at the
    # common height and remove the next course's downward-facing bottom.
    remove = []
    for face in mesh.faces:
        zs = [v.co.z for v in face.verts]
        if max(zs) > TOP + 1e-5 or (min(zs) >= TOP - 1e-5 and face.normal.z < 0):
            remove.append(face)
    bmesh.ops.delete(mesh, geom=remove, context="FACES")
    mesh.to_mesh(cans.data)
    mesh.free()
    cans.name = "Two courses of unprinted window stock"
    bpy.data.objects["ASSET_StackedCanPyramid"].name = "Gu Long window stock"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_yup=True,
                              export_cameras=False, export_lights=False, export_animations=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ASSETS / "gulong-window-stock.glb")
    generate(parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []).output)
