"""Bake the owner's editable freezer at an exhibition pose into one enamel draw."""
from hashlib import sha256
import json
from math import cos, radians, sin
from pathlib import Path

import bpy
from mathutils import Vector


SOURCE_SHA = "8fad1f874f8000691c4ee6e1f006a836be8c48fb238fba493550cf4becacbc57"


def source_faces(source):
    if sha256(source.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError("Expected the pinned freezer-cabinet.blend")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    root = bpy.data.objects["ASSET_FreezerCabinet"]
    # Use an intermediate pose from the original 63-degree lid swing.
    lid = bpy.data.objects["MOVABLE_FreezerLid"]
    lid.animation_data_clear()
    lid.rotation_euler.x = -radians(42)
    # Hang the two removable baskets just below the rim for a standing visitor.
    for obj in root.children_recursive:
        if obj.name.startswith("BASKET_"):
            obj.location.z += .20
    bpy.context.view_layer.update()
    faces = []

    def srgb(value):
        return round(255 * (12.92*value if value <= .0031308 else 1.055*value**(1/2.4)-.055))

    def face(points, obj):
        corners = [obj.matrix_world @ Vector(point) for point in points]
        pigment = "".join(f"{srgb(v):02x}" for v in obj.active_material.diffuse_color[:3])
        faces.append(([(p.x,p.z,-p.y) for p in corners],pigment))

    for obj in sorted(root.children_recursive, key=lambda obj: obj.name):
        if obj.type != "MESH":
            continue
        points = [v.co for v in obj.data.vertices]
        half = [max(abs(p[i]) for p in points) for i in range(3)]
        x,y,z = half
        if obj.name.startswith("BASKET_Wire"):
            # Only the aisle-facing strip is exposed below each front basket rail.
            face(((-x,-y,-z),(x,-y,-z),(x,-y,z),(-x,-y,z)),obj)
        elif obj.name == "LID_Panel":
            bevel = next(mod.width for mod in obj.modifiers if mod.type == "BEVEL")
            rim = [(-x+bevel,-y),(x-bevel,-y),(x,-y+bevel),(x,y-bevel),
                   (x-bevel,y),(-x+bevel,y),(-x,y-bevel),(-x,-y+bevel)]
            face([(u,v,z) for u,v in rim],obj)
            face([(u,v,-z) for u,v in reversed(rim)],obj)
            for i,(u,v) in enumerate(rim):
                a,b = rim[(i+1)%len(rim)]
                face(((u,v,-z),(a,b,-z),(a,b,z),(u,v,z)),obj)
        else:
            for poly in obj.data.polygons:
                _,ny,nz = poly.normal
                if obj.name == "CABINET_Base":
                    visible = abs(nz) < .5
                elif obj.name == "CABINET_Floor" or obj.name.startswith("CABINET_Side"):
                    visible = nz > -.5
                elif obj.name.startswith("CABINET_Wall"):
                    visible = abs(ny) > .5 or nz > .5
                elif obj.name.startswith("BASKET_Bottom"):
                    visible = nz > .5
                elif obj.name.startswith("BASKET_Rim"):
                    visible = ny < -.5 or nz > .5
                elif obj.name == "LID_Handle":
                    visible = ny < .5
                else:
                    raise ValueError(f"Unexpected freezer part: {obj.name}")
                if visible:
                    face([points[i] for i in poly.vertices],obj)

    return faces


def add_freezer(room, faces):
    plan = Path(__file__).resolve().parents[2] / "docs/gjh-v11-interior-program.json"
    shop = next(s for s in json.loads(plan.read_text())["stores"] if s["id"] == "S03")
    prop = next(item for item in shop["items"] if item["id"] == "S03-cold")
    points = [point for polygon,_ in faces for point in polygon]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    scale = min(1,*(limit/(b-a) for limit,a,b in zip(prop["size"],lo,hi)))
    ox,oy,oz = prop["xyz"]
    cx,cz = (lo[0]+hi[0])/2,(lo[2]+hi[2])/2
    yaw = radians(prop["yawDeg"])
    for polygon,color in faces:
        transformed = []
        for x,y,z in polygon:
            dx,dz = scale*(x-cx),scale*(z-cz)
            transformed.append((ox+dx*cos(yaw)+dz*sin(yaw),oy+scale*(y-lo[1]),oz-dx*sin(yaw)+dz*cos(yaw)))
        room.face(transformed,color)
