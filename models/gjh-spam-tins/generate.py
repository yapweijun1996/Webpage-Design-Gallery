"""Link three editable, unprinted SPAM 340 g specimens in Blender."""
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from mesh import Mesh
from spam_tins import SAMPLES, SHELF_DEPTH, SHELF_TOP, add_spam_tin


def build():
    """Return three named objects at the installed shelf positions."""
    material = bpy.data.materials.new("SPAM tin pigments")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .63
    shader.inputs["Metallic"].default_value = .14
    pigment = nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = "Pigment"
    material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])

    specimens = []
    for name, colour, x in SAMPLES:
        mesh = Mesh()
        add_spam_tin(mesh, colour, 0, 0, 0)
        specimen = mesh.object(name, material, painted=True)
        specimen.location = (x, -SHELF_DEPTH, SHELF_TOP)
        specimens.append(specimen)
    return specimens


if __name__ == "__main__":
    build()
