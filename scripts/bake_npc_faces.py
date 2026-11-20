"""Project registered player vector features onto the shipped, animated NPC atlases."""
import argparse
import hashlib
import io
import json
import os
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from bake_tripo_atlas import chart_roots
from project_tripo_face import repack_image, sample_layers

# Boundaries follow the chin, sideburns and individual bangs in bind-space.
OUTLINES = {
    "boy": [(132,322),(149,289),(172,284),(177,270),(201,291),(228,304),
            (257,310),(275,293),(264,269),(269,216),(295,210),(329,217),
            (344,256),(355,280),(372,303),(365,354),(345,390),(309,416),
            (251,433),(193,420),(152,394),(134,360)],
    "crowd": [(105,226),(128,193),(186,184),(224,201),(281,201),(322,182),
              (378,197),(400,230),(395,303),(374,344),(317,378),(246,390),
              (177,376),(126,349),(105,310)],
}


PROFILES = json.loads((Path(__file__).parent / 'avatar_art/npc-profiles.json').read_text())


def pack_crowd(directory, positions, uv, triangles, source):
    """Pack intact islands on the single body geometry used by every outfit."""
    charts = np.array(chart_roots(len(uv), triangles))
    x, y, z = positions[triangles].mean(axis=1).T
    front = (abs(x) < .135) & (y > .63) & (y < .82) & (z > .10)
    face = np.isin(charts, np.unique(charts[triangles[front, 0]]))
    np.save(directory / 'face-vertices.npy', face)
    geometry = [positions.tolist(), uv.tolist(), triangles.ravel().tolist()]
    (directory / 'geometry.json').write_text(json.dumps(geometry))
    env = os.environ.copy()
    if 'BLENDER_METAL_GUARD' in env:
        env['DYLD_INSERT_LIBRARIES'] = env['BLENDER_METAL_GUARD']
    subprocess.run([env.get('BLENDER', 'blender'), '-b', '--factory-startup', '--disable-autoexec',
                    '--python-exit-code', '1', '--python', str(Path(__file__).with_name('pack_tripo_face_uv.py')),
                    '--', str(directory)], check=True, env=env)
    packed = np.load(directory / 'packed-uv.npy').astype('<f4')
    return repack_image(source, uv, packed, charts, 1024), packed


def bake(glb, artwork, profile):
    style = PROFILES[profile]
    data = glb.read_bytes()
    expected = {'boy': '14654a30b34c7ed15b09a23f4f60e0d46f65d44477a5af795f7e38f34416f56c',
                'crowd': '9ada782f1919f7f6a63d570ded64af45c6802c53b4aa2029276715a9a4a46fa7'}
    if hashlib.sha256(data).hexdigest() != expected[profile]:
        raise ValueError(f'Unexpected baseline GLB for {profile}: {glb}')
    length, = struct.unpack_from('<I', data, 12)
    doc = json.loads(data[20:20+length])
    blob = data[28+length:]

    def view(index):
        entry = doc['bufferViews'][index]
        start = entry.get('byteOffset', 0)
        return blob[start:start+entry['byteLength']]

    def accessor(index):
        a = doc['accessors'][index]
        return np.frombuffer(view(a['bufferView']), offset=a.get('byteOffset', 0),
                             dtype={5126:'<f4',5123:'<u2'}[a['componentType']]).reshape(a['count'], -1)

    p = doc['meshes'][0]['primitives'][0]
    positions = accessor(p['attributes']['POSITION'])
    uv = accessor(p['attributes']['TEXCOORD_0'])
    tris = accessor(p['indices']).reshape(-1, 3)
    points = positions * [1050,-1050,1] + [250,1050,0]
    image_view = doc['images'][0]['bufferView']
    source = Image.open(io.BytesIO(view(image_view))).convert('RGB')
    replacement = {}
    if profile == 'crowd':
        source, uv = pack_crowd(artwork.parent, positions, uv, tris, source)
        accessor_info = doc['accessors'][p['attributes']['TEXCOORD_0']]
        uv_view = accessor_info['bufferView']
        if accessor_info.get('byteOffset',0) or len(view(uv_view)) != uv.nbytes:
            raise ValueError('Expected a dedicated, tightly packed UV buffer')
        replacement[uv_view] = uv.tobytes()
        accessor_info.update(min=uv.min(axis=0).tolist(),max=uv.max(axis=0).tolist())
    original = np.asarray(source.resize((1024, 1024), Image.Resampling.BICUBIC))
    image = original.copy()
    art = np.asarray(Image.open(artwork).convert('RGBA'))
    mask = Image.new('L',(500,500))
    ImageDraw.Draw(mask).polygon(OUTLINES[profile], fill=255)
    stencil = np.asarray(mask.filter(ImageFilter.GaussianBlur(2.1)))
    coverage = np.full((1024,1024),-1.5)
    for ids in tris:
        xyz = points[ids]
        if xyz[:,2].max() < .06 or xyz[:,1].min() > 440 or xyz[:,1].max() < 180:
            continue
        a,b,c = uv[ids]*1024
        matrix = np.stack((a-c,b-c),axis=1)
        det = np.linalg.det(matrix)
        if abs(det)<1e-6:
            continue
        x,y = np.maximum(0,np.floor(np.minimum.reduce([a,b,c])-2).astype(int))
        u,v = np.minimum(1024,np.ceil(np.maximum.reduce([a,b,c])+2).astype(int))
        yy,xx = np.mgrid[y:v,x:u]+.5
        inv = np.linalg.inv(matrix)
        weights = np.stack([xx-c[0],yy-c[1]],axis=-1)@inv.T
        weights = np.dstack([weights,1-weights.sum(axis=2)])
        edge = (weights*abs(det)/np.maximum(1e-6,np.linalg.norm([b-c,c-a,a-b],axis=1))).min(axis=2)
        front = weights@xyz
        px,py = np.clip(front[:,:,:2].astype(int),0,499).transpose(2,0,1)
        use = (edge>coverage[y:v,x:u]) & (front[:,:,2]>.06) & (stencil[py,px]>0)
        if not use.any():
            continue
        jacobian = (xyz[:2,:2]-xyz[2,:2]).T@inv
        layer,_ = sample_layers(art,art,front[:,:,:2][use],jacobian)
        rgb = original[y:v,x:u][use].astype(float)
        fx,fy = front[:,:,:2][use].T
        # Replace the old painted features locally, feathering back to original skin.
        eye_x, eye_y = style['eye'][:2]
        radius_x, radius_y = style['eyePatch']
        dx = np.minimum(abs(fx-eye_x),abs(500-fx-eye_x))
        eye = (dx/radius_x)**2 + ((fy-eye_y)/radius_y)**2
        mouth = ((fx-250)/37)**2+((fy-style['mouth'][1])/15)**2
        brow = (dx/46)**2+((fy-style['brow'][1])/15)**2
        clear = np.clip((1.4-np.minimum.reduce([eye,mouth,brow]))/.35,0,1)[:,None]
        under = rgb*(1-clear)+np.array(style['skin'])*clear
        alpha = layer[:,3:4]/255
        painted = under*(1-alpha)+layer[:,:3]*alpha
        blend = stencil[py[use],px[use],None]/255
        image[y:v,x:u][use] = np.rint(rgb*(1-blend)+painted*blend)
        coverage[y:v,x:u][use] = edge[use]
    def output_view(index):
        return replacement[index] if index in replacement else view(index)

    return doc, output_view, image_view, Image.fromarray(image)


def emit(doc,view,image_view,atlas,size,path):
    jpeg = io.BytesIO()
    atlas.resize((size,size),Image.Resampling.LANCZOS).save(jpeg,'JPEG',quality=95,subsampling=0)
    # Copy all non-image views verbatim, including animation tracks and inverse binds.
    bins = bytearray()
    result = json.loads(json.dumps(doc))
    for i,entry in enumerate(result['bufferViews']):
        data = jpeg.getvalue() if i==image_view else view(i)
        entry.update(byteOffset=len(bins),byteLength=len(data))
        bins.extend(data)
        bins.extend(bytes(-len(bins)%4))
    result['buffers'][0]['byteLength'] = len(bins)
    header = json.dumps(result,separators=(',',':')).encode()
    header += b' '*(-len(header)%4)
    path.write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(header)+len(bins),len(header),0x4e4f534a)
                     +header+struct.pack('<I4s',len(bins),b'BIN\0')+bins)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline',type=Path,help='Unmodified v11 assets directory from 6ec566df')
    parser.add_argument('output',type=Path,help='Candidate v11 assets directory')
    args = parser.parse_args()
    if args.baseline.resolve() == args.output.resolve():
        parser.error("Use separate baseline and output directories")
    with tempfile.TemporaryDirectory() as tmp:
        for profile,filename in [('boy','gjh-tripo-npc-boy'),('crowd','chibi-crowd/base_body')]:
            artwork = Path(tmp)/f'{profile}.png'
            subprocess.run(['node',str(Path(__file__).parent/'avatar_art/npc_face.cjs'),profile,str(artwork)],check=True)
            baked = bake(args.baseline/(filename+'.glb'),artwork,profile)
            sizes = [(1024,'-1k'),(512,'')] if profile=='boy' else [(1024,''),(512,'-512')]
            for size,suffix in sizes:
                emit(*baked,size,args.output/(filename+suffix+'.glb'))
    manifest = args.output/'chibi-crowd/manifest.json'
    data = json.loads(manifest.read_text())
    body = next(item for item in data['modules'] if item['id']=='neutral-body')
    def receipt(name):
        binary = (manifest.parent/name).read_bytes()
        return dict(file=name,bytes=len(binary),sha256=hashlib.sha256(binary).hexdigest())
    body.update(receipt('base_body.glb'), compact=receipt('base_body-512.glb'),
                optimization='Registered facial vector projection. Both atlas sizes preserve the original skin and topology. Blender packs face islands at twice the linear texel density.')
    manifest.write_text(json.dumps(data,indent=2)+'\n')


if __name__ == '__main__':
    main()
