"""Link editable, unprinted Borsch Med pack studies into the current collection."""

from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from mesh import Mesh
from borsch_packs import add_borsch_lingzhi_pair, add_borsch_patch_pack


def build():
    """Create the named pack parts and return their Blender objects."""
    source = Mesh()
    parts = add_borsch_patch_pack(source, x=0, y=0, z=0)
    parts.update(add_borsch_lingzhi_pair(source, x=.74))

    material = bpy.data.materials.new("Unprinted pack pigments")
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .65
    pigment = material.node_tree.nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = "Pigment"
    material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])

    objects = []
    for name, faces in parts.items():
        first = source.faces[faces.start][0]
        stop = source.faces[faces.stop - 1][-1] + 1
        part = Mesh()
        part.points = source.points[first:stop]
        part.colours = source.colours[first:stop]
        part.faces = [tuple(index - first for index in source.faces[i]) for i in faces]
        objects.append(part.object(name, material, painted=True))
    return objects


if __name__ == "__main__":
    build()
