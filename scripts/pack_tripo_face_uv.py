"""Pack the seam-safe visitor UV islands with Blender, without reexporting the rig."""
import json
import sys
from pathlib import Path

import bpy
import numpy as np


def main(directory):
    positions, uv, indices = json.loads((directory / "geometry.json").read_text())
    positions = np.asarray(positions)
    uv = np.asarray(uv)
    triangles = np.asarray(indices).reshape(-1, 3)
    face_vertices = np.load(directory / "face-vertices.npy")
    face_triangles = face_vertices[triangles[:, 0]]
    mesh = bpy.data.meshes.new("Visitor UV layout")
    mesh.from_pydata(positions.tolist(), [], triangles.tolist())
    bpy.ops.object.select_all(action="DESELECT")
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Match texels per square metre. The absolute source UV density varies by island.
    spatial = positions[triangles]
    area3d = np.linalg.norm(np.cross(spatial[:, 1] - spatial[:, 0], spatial[:, 2] - spatial[:, 0]), axis=1)
    def density(coords, selected):
        a, b, c = coords[triangles[selected]].transpose(1, 0, 2)
        twice_area = np.abs((b[:, 0]-a[:, 0])*(c[:, 1]-a[:, 1]) - (b[:, 1]-a[:, 1])*(c[:, 0]-a[:, 0]))
        return twice_area.sum() / area3d[selected].sum()
    weight = np.sqrt(4.0 * density(uv, ~face_triangles) / density(uv, face_triangles))
    weighted = uv * np.where(face_vertices, weight, 1.0)[:, None]
    loops = np.array([loop.vertex_index for loop in mesh.loops])
    layer = mesh.uv_layers.new(name="Face weighted atlas")
    layer.uv.foreach_set("vector", weighted[loops].astype("f").ravel())
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=False, merge_overlap=False, margin_method="ADD",
                            margin=.004, shape_method="AABB")
    bpy.ops.object.mode_set(mode="OBJECT")
    result = np.empty((len(loops), 2), dtype="f")
    mesh.uv_layers["Face weighted atlas"].uv.foreach_get("vector", result.ravel())
    packed = np.zeros_like(uv)
    packed[loops] = result
    if not np.allclose(result, packed[loops], atol=2e-6):
        raise ValueError("Packing introduced a split at a shared glTF UV vertex")
    np.save(directory / "packed-uv.npy", packed)
    print(f"Face/body texels per square metre: {density(packed,face_triangles)/density(packed,~face_triangles):.3f}")


if __name__ == "__main__":
    main(Path(sys.argv[-1]))
