"""Blender 5.1 background build. Pass -- SHEET_DIRECTORY [--source SOURCE.blend]."""
import argparse
import json
import math
import struct
from pathlib import Path
import random
import sys
import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_elevator_atlas import REGIONS

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "demos/corporate/gjh/v11/assets/elevator"
TIERS = ("low", "balanced", "detailed")

class Part:
    """Build in glTF metres, with a UV island per face on the shared sheet."""
    def __init__(self, name):
        self.name, self.points, self.faces, self.uv = name, [], [], []

    def face(self, points, tile, coords=None):
        start = len(self.points)
        self.points.extend((x,-z,y) for x,y,z in points)
        self.faces.append(tuple(range(start,start+len(points))))
        x,y,w,h = REGIONS[tile]
        coords = coords or [(0,1),(1,1),(1,0),(0,0)][:len(points)]
        self.uv.extend(((x+2+s*(w-4))/512,1-(y+2+t*(h-4))/512) for s,t in coords)

    def rect(self,x,y,z,w,h,tile):
        self.face([(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)],tile)

    def box(self,x,y,z,w,h,d,tile):
        a,b=x-w/2,x+w/2
        c,e=y-h/2,y+h/2
        f,g=z-d/2,z+d/2
        self.rect(x,y,g,w,h,tile)
        self.face([(b,c,f),(a,c,f),(a,e,f),(b,e,f)],tile)
        self.face([(b,c,g),(b,c,f),(b,e,f),(b,e,g)],tile)
        self.face([(a,c,f),(a,c,g),(a,e,g),(a,e,f)],tile)
        self.face([(a,e,g),(b,e,g),(b,e,f),(a,e,f)],tile)
        self.face([(a,c,f),(b,c,f),(b,c,g),(a,c,g)],tile)

    def make(self, material):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.points,[],self.faces)
        uv = mesh.uv_layers.new(name="Finish")
        uv.uv.foreach_set("vector", [n for pair in self.uv for n in pair])
        mesh.materials.append(material)
        mesh.update()
        obj = bpy.data.objects.new(self.name,mesh)
        bpy.context.collection.objects.link(obj)
        return obj

def materials(sheets):
    maps = {}
    for name in ("base","emission","surface"):
        image = bpy.data.images.load(str(sheets / (name+".png")))
        if name == "surface":
            image.colorspace_settings.name = "Non-Color"
        image.pack()
        maps[name] = image
    result = []
    for is_door in (False, True):
        mat = bpy.data.materials.new("LiftSteelGlass" if is_door else "LiftFinishes")
        mat.use_nodes = True
        mat.use_backface_culling = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = nodes.get("Principled BSDF")
        tex = {}
        for key,image in maps.items():
            tex[key] = nodes.new("ShaderNodeTexImage")
            tex[key].image = image
        links.new(tex["base"].outputs["Color"],bsdf.inputs["Base Color"])
        if is_door:
            links.new(tex["base"].outputs["Alpha"],bsdf.inputs["Alpha"])
            mat.surface_render_method = "BLENDED"
        links.new(tex["emission"].outputs["Color"],bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.65
        split = nodes.new("ShaderNodeSeparateColor")
        links.new(tex["surface"].outputs["Color"],split.inputs["Color"])
        links.new(split.outputs["Green"],bsdf.inputs["Roughness"])
        links.new(split.outputs["Blue"],bsdf.inputs["Metallic"])
        result.append(mat)
    return result

def planter(p,side,lod):
    x,z = side*1.86,.46
    for y,w,h,tile in ((.067,.53,.12,"brass"),(.141,.53,.028,"gold"),(.395,.57,.48,"pot"),(.642,.59,.035,"brass")):
        p.box(x,y,z,w,h,w,tile)
    p.box(x,.664,z,.53,.015,.53,"soil")
    rng = random.Random(110+side)
    count = (24,42,70)[lod]
    for i in range(count):
        ang=i*2.39996
        u,v=math.cos(ang),math.sin(ang)
        radius=rng.uniform(.10,.48)
        height=rng.uniform(.36,.61)-.48*radius
        width=rng.uniform(.051,.096)
        root=(x+.18*radius*u,.67,z+.18*radius*v)
        midx,midz=x+radius*u*.74,z+radius*v*.74
        left=(midx-v*width,.70+height*.78,midz+u*width)
        right=(midx+v*width,.70+height*.78,midz-u*width)
        fold=(midx,.73+height*.86,midz)
        tip=(x+u*radius,.77+height-radius*.50,z+v*radius)
        for face in ((root,left,fold),(fold,left,tip),(root,fold,right),(fold,tip,right)):
            # Folded blades are visible from both floors and from the car.
            p.face(face,"darkleaf" if i%3==0 else "leaf")
            p.face(tuple(reversed(face)),"darkleaf")

def build(tier, mats):
    lod=TIERS.index(tier)
    portal,trim,wood,lamps,plants,sign,floor,panel,car,door = [
        Part(name) for name in ("Portal","GoldTrim","Pilasters","Sconces","Planters","ElevatorSign",
                               "MarbleInlay","FloorIndicator","Cabin","DoorLeft")]
    # A 2 m clear opening centred over the existing west threshold.
    for side in (-1,1):
        x=side*1.52
        portal.box(x,1.69,-.10,.99,3.38,.35,"green")
        portal.box(side*1.085,1.48,.072,.14,2.96,.20,"steel")
        trim.box(side*1.18,1.50,.116,.025,3,.025,"gold")
        wood.box(side*1.67,1.83,.10,.33,3.52,.10,"wood")
        for j in range((4,6,9)[lod]):
            dx=-.145+j*.29/((4,6,9)[lod]-1)
            wood.box(side*1.67+dx,1.83,.174,.022,3.49,.045,"brass" if j==0 else "wood")
        lamps.box(side*1.67,2.25,.218,.23,.42,.12,"brass")
        lamps.box(side*1.67,2.26,.31,.151,.31,.13,"lamp")
        for y in (2.07,2.45):
            lamps.box(side*1.67,y,.305,.185,.046,.16,"brass")
        if lod:
            for dx in (-.083,.083):
                lamps.box(side*1.67+dx,2.26,.367,.012,.315,.018,"brass")
        planter(plants,side,lod)
    portal.box(0,3.00,-.052,2.2,.12,.44,"steel")
    portal.box(0,3.34,-.072,2.96,.56,.33,"green")
    sign.rect(0,3.335,.104,2.50,.477,"sign")
    portal.box(0,3.685,-.024,4.15,.155,.51,"green")
    for y in (3.60,3.777):
        trim.box(0,y,-.012,4.20,.029,.54,"gold")
    trim.box(0,3.034,.157,2.38,.025,.027,"gold")
    for side in (-1,1):
        trim.box(side*1.99,1.79,.07,.025,3.57,.03,"brass")
    # The third landing component is a UV-addressed two-floor display.
    portal.box(1.34,1.53,.12,.27,1.24,.15,"steel")
    portal.box(1.34,1.82,.213,.238,.36,.058,"black")
    panel.rect(1.34,1.83,.246,.224,.15,"display")
    for i in range(2):
        y=1.46-.18*i
        portal.box(1.34,y,.214,.14,.13,.04,"brass")
        dx=.034; dy=.033*(1 if i==0 else -1)
        portal.face([(1.34-dx,y-dy/2,.238),(1.34+dx,y-dy/2,.238),(1.34,y+dy,.238)],"lamp")
    floor.box(0,.009,.69,4.32,.014,1.86,"stone")
    for x in (-2.10,2.10):
        floor.box(x,.018,.69,.16,.003,1.79,"edgeX")
        floor.box(x,.021,.69,.042,.005,1.78,"gold")
    for z in (-.186,1.566):
        floor.box(0,.018,z,4.20,.003,.16,"edgeZ")
        floor.box(0,.021,z,4.20,.005,.043,"gold")
    for j in range(-2,3):
        floor.box(j*.83,.017,.69,.007,.002,1.80,"brass")
    # Moving car: a lit coffer, framed mirrors, waist rail and inlaid stone.
    car.box(0,.004,-1.95,3.14,.052,3.18,"stone")
    car.box(0,1.43,-3.48,3.12,2.86,.12,"green")
    for j in range(3):
        x=(j-1)*.94
        car.box(x,1.64,-3.392,.89,1.94,.034,"mirror")
        car.box(x,.45,-3.392,.89,.40,.034,"wood")
    for side in (-1,1):
        car.box(side*1.54,1.43,-1.95,.10,2.86,3.08,"green")
        car.box(side*1.478,1.56,-2,.042,1.94,2.70,"mirror")
        car.box(side*1.435,1.01,-1.91,.074,.054,2.53,"brass")
        car.box(side*1.41,2.73,-1.95,.041,.045,2.91,"gold")
        car.box(side*1.37,.033,-1.95,.025,.006,2.77,"brass")
    for y,tile in ((1.01,"brass"),(2.69,"gold")):
        car.box(0,y,-3.31,2.91,.054,.078,tile)
    car.rect(0,1.037,-3.260,2.90,.014,"gold")
    for z in (-.57,-3.33):
        car.box(0,.033,z,2.75,.006,.025,"brass")
    car.box(0,2.86,-1.93,3.17,.12,3.18,"green")
    car.box(0,2.787,-1.97,2.58,.022,2.38,"lamp")
    if lod:
        for j in range((3,6)[lod-1]):
            car.box(0,2.767,-2.98+j*2.02/((3,6)[lod-1]-1),2.59,.019,.032,"brass")
    # Both leaves share this mesh, in local coordinates at their closed centres.
    for x in (-.468,.468):
        door.box(x,1.44,0,.067,2.88,.084,"steel")
    for y,h in ((.088,.168),(1.06,.042),(2.81,.14)):
        door.box(0,y,0,.882,h,.082,"steel")
    door.rect(0,1.457,0,.882,2.58,"glass")
    door.face([(.441,.167,-.001),(-.441,.167,-.001),(-.441,2.747,-.001),(.441,2.747,-.001)],"glass")
    if lod:
        for x in (-.432,.432):
            door.box(x,1.459,.034,.012,2.57,.018,"brass")
    if lod==2:
        for x in (-.466,.466):
            door.box(x,1.44,.048,.015,2.83,.012,"mirror")
    for part in (portal,trim,wood,lamps,plants,sign,floor,panel,car):
        part.make(mats[0])
    left=door.make(mats[1])
    left.location.x=-.505
    right=left.copy()
    right.name="DoorRight"
    right.location.x=.505
    bpy.context.collection.objects.link(right)

def share_texture_samplers(path):
    # Blender emits one identical texture record per material. Share it in the
    # delivered file so all conforming viewers can reuse each image/sampler.
    raw=path.read_bytes()
    end=20+struct.unpack_from("<I",raw,12)[0]
    doc=json.loads(raw[20:end])
    textures=[]
    indices=[]
    for texture in doc["textures"]:
        if texture not in textures:
            textures.append(texture)
        indices.append(textures.index(texture))
    doc["textures"]=textures
    for mat in doc["materials"]:
        pbr=mat["pbrMetallicRoughness"]
        for info in (mat["emissiveTexture"],pbr["baseColorTexture"],pbr["metallicRoughnessTexture"]):
            info["index"]=indices[info["index"]]
    chunk=json.dumps(doc,separators=(",",":")).encode()
    chunk+=b" "*(-len(chunk)%4)
    binary=raw[end:]
    path.write_bytes(struct.pack("<4sIII4s",b"glTF",2,20+len(chunk)+len(binary),len(chunk),b"JSON")+chunk+binary)


def main():
    args = argparse.ArgumentParser()
    args.add_argument("sheets",type=Path)
    args.add_argument("--source",type=Path)
    options=args.parse_args(sys.argv[sys.argv.index("--")+1:])
    OUTPUT.mkdir(parents=True,exist_ok=True)
    for tier in TIERS:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mats=materials(options.sheets)
        build(tier,mats)
        if options.source and tier=="detailed":
            options.source.parent.mkdir(parents=True,exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=str(options.source),compress=True)
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT/(tier+".glb")),export_format="GLB",
                                  export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
        share_texture_samplers(OUTPUT/(tier+".glb"))

if __name__=="__main__":
    main()
