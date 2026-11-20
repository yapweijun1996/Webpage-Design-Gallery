"""Link the two editable Gu Long 256 g form specimens in Blender."""
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from gulong_tins import SAMPLES, SHELF_TOP, add_gulong_tin, smooth_gulong_tins
from mesh import Mesh


def build():
    """Return separately named objects with the room's sample placements."""
    material = bpy.data.materials.new("Gu Long unprinted pigments")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .63
    shader.inputs["Metallic"].default_value = .14
    pigment = nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = "Pigment"
    material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])

    specimens = []
    for name, colour, x, z in SAMPLES:
        mesh = Mesh()
        band = add_gulong_tin(mesh, colour, 0, 0, 0)
        specimen = mesh.object(name, material, painted=True)
        smooth_gulong_tins(specimen, (band,))
        specimen.location = (x, -z, SHELF_TOP)
        specimens.append(specimen)
    return specimens


if __name__ == "__main__":
    build()
