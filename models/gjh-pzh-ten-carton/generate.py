"""Link an editable, unprinted S05 ten-unit intermediate carton into Blender."""

from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from mesh import Mesh, linear
from pzh_carton import TEN_PAPERBOARD, TEN_TEAR_STRIP, add_pzh_ten_carton


def build():
    """Create the named paperboard and film meshes in the current collection."""
    body, strip = Mesh(), Mesh()
    add_pzh_ten_carton(body, strip_mesh=strip)

    objects = []
    for mesh, name, colour, roughness in (
        (body, "Ten-unit paperboard carton", TEN_PAPERBOARD, .74),
        (strip, "Continuous film tear strip", TEN_TEAR_STRIP, .66),
    ):
        material = bpy.data.materials.new(name)
        material.diffuse_color = linear(colour)
        material.use_nodes = True
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = roughness
        pigment = material.node_tree.nodes.new("ShaderNodeVertexColor")
        pigment.layer_name = "Pigment"
        material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])
        objects.append(mesh.object(name, material, painted=True))
    return objects


if __name__ == "__main__":
    build()
