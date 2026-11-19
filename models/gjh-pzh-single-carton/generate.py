"""Link an editable, unprinted single-unit carton study into Blender."""

from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from mesh import Mesh, linear
from pzh_carton import CINNABAR, add_pzh_carton


def build():
    """Create the named carton and return it in the collection of model objects."""
    mesh = Mesh()
    add_pzh_carton(mesh)

    material = bpy.data.materials.new("Unprinted cinnabar paperboard")
    material.diffuse_color = linear(CINNABAR)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .74
    pigment = material.node_tree.nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = "Pigment"
    material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])

    return [mesh.object("Single-unit paperboard carton", material, painted=True)]


if __name__ == "__main__":
    build()
