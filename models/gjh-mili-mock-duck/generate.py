"""Assemble one editable MILI Vegetarian Mock Duck 280 g can in Blender."""
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "gjh_interiors"))
from mesh import Mesh, linear
from mili_mock_duck import (
    BODY_BLUE,
    TIN_GOLD,
    add_mili_mock_duck,
    apply_mili_mock_duck_normals,
)


def finish(name, colour, metallic, roughness):
    material = bpy.data.materials.new(name)
    material.diffuse_color = linear(colour)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    pigment = material.node_tree.nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = "Pigment"
    material.node_tree.links.new(pigment.outputs["Color"], shader.inputs["Base Color"])
    return material


def build():
    """Link the can to the current collection and return its object."""
    mesh = Mesh()
    first_face = add_mili_mock_duck(mesh)
    blue = finish("Muted blue body", BODY_BLUE, 0.14, 0.48)
    gold = finish("Gold-toned tin", TIN_GOLD, 0.68, 0.35)
    can = mesh.object("MILI Vegetarian Mock Duck 280 g", blue, painted=True)
    can.data.materials.append(gold)
    for face in can.data.polygons:
        if any(mesh.colours[index] != BODY_BLUE for index in face.vertices):
            face.material_index = 1
    apply_mili_mock_duck_normals(can, (first_face,))
    return can


if __name__ == "__main__":
    build()
