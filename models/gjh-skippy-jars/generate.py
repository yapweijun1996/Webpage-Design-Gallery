"""Link two separately editable Skippy 500 g jars into Blender."""

from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from mesh import Mesh
from skippy_jars import SAMPLES, SHELF_DEPTH, SHELF_TOP, add_skippy_jar, smooth_skippy_heels


def build():
    """Return the two named specimen objects at their room placements."""
    material = bpy.data.materials.new("Skippy unprinted pigments")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = .62
    pigment = nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = "Pigment"
    material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])

    specimens = []
    for name, lid, groove, x in SAMPLES:
        mesh = Mesh()
        heel = add_skippy_jar(mesh, lid, groove, 0, 0, 0)
        specimen = mesh.object(name, material, painted=True)
        smooth_skippy_heels(specimen, (heel,))
        specimen.location = (x, -SHELF_DEPTH, SHELF_TOP)
        specimens.append(specimen)
    return specimens


if __name__ == "__main__":
    build()
