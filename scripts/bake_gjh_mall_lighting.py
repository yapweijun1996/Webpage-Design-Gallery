"""Rasterize the V11 planar contact and cove lighting atlas (Node + Pillow)."""
import argparse
import io
import json
import math
from pathlib import Path
import subprocess

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'demos/corporate/gjh/v11/assets'
SIZES = (1024, 2048)


def source_geometry():
    # Use the live room frames, door openings and authored fixture envelopes.
    script = """
      import {atriumLayout} from './atrium-layout.js';
      import {expandedLayout} from './expanded-layout.js';
      import {interiorStores} from './interiors/config.js';
      import {bakeAtlasSplit, bakeAtlasGutter} from './mall-baked-lighting.js';
      console.log(JSON.stringify({bounds:expandedLayout.bounds, stores:Object.values(interiorStores),
        pierXs:atriumLayout.anchorPierXs, split:bakeAtlasSplit, gutter:bakeAtlasGutter}));
    """
    return json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e', script], cwd=ASSETS, text=True
    ))


class Raster:
    def __init__(self, width, height, bounds):
        self.alpha = Image.new('L', (width, height))
        self.min_x, self.min_z = bounds['minX'], bounds['minZ']
        self.dx = (bounds['maxX'] - self.min_x) / width
        self.dz = (bounds['maxZ'] - self.min_z) / height

    def stamp(self, x, z, width, depth, yaw, spread, opacity):
        """Bake a soft, oriented distance field around a wall or contact footprint."""
        c, s = math.cos(yaw), math.sin(yaw)
        w, d = width/2, depth/2
        radius_x = abs(c)*w + abs(s)*d + spread
        radius_z = abs(s)*w + abs(c)*d + spread
        left = max(0, math.floor((x-radius_x-self.min_x)/self.dx))
        right = min(self.alpha.width, math.ceil((x+radius_x-self.min_x)/self.dx))
        top = max(0, math.floor((z-radius_z-self.min_z)/self.dz))
        bottom = min(self.alpha.height, math.ceil((z+radius_z-self.min_z)/self.dz))
        if right <= left or bottom <= top:
            return
        px = [self.min_x+(i+.5)*self.dx-x for i in range(left, right)]
        values = bytearray()
        for row in range(top, bottom):
            pz = self.min_z+(row+.5)*self.dz-z
            for p in px:
                u = max(0, abs(p*c-pz*s)-w)
                v = max(0, abs(p*s+pz*c)-d)
                fade = max(0, 1-math.hypot(u,v)/spread)
                values.append(round(255*opacity*fade*fade*(3-2*fade)))
        box = (left, top, right, bottom)
        stamp = Image.frombytes('L', (right-left, bottom-top), bytes(values))
        self.alpha.paste(ImageChops.lighter(stamp, self.alpha.crop(box)), box)


def shade_store(floor, ceiling, store):
    frame = store['frame']
    ox, _, oz = frame['world_origin_m']
    yaw = math.radians(frame['yaw_world_deg'])
    c, s = math.cos(yaw), math.sin(yaw)
    width, depth = frame['lot_width_depth_m']
    if store['id'] in ('S01', 'S02', 'S03'):
        left, back, front = 4.67, -4.32, 6
    else:
        left, back, front = width/2-.30, -depth/2+.45, depth/2-.18
    middle = (front+back)/2

    def stamp(raster, x, z, w, d, turn, spread, opacity):
        raster.stamp(ox+x*c+z*s, oz-x*s+z*c, w, d, yaw+math.radians(turn), spread, opacity)

    for raster, spread, opacity in ((floor,.78,.24), (ceiling,1.04,.18)):
        stamp(raster, 0, back, 2*left, .1, 0, spread, opacity)
        for side in (-1, 1):
            stamp(raster, side*left, middle, .1, front-back, 0, spread, opacity)
            # Storefront mullions cast a soft edge with a passage at the door.
            door = frame['door_width_m']/2
            stamp(raster, side*(door+left)/2, front, left-door, .08, 0, .5, opacity*.65)
    for item in store['colliders']:
        x, _, z = item['center']
        w, _, d = item['size']
        stamp(floor, x, z, w, d, item['yaw'], .36, .29)
    for item in store['props']:
        x, y, z = item['position_m']
        w, h, d = item['envelope_whd_m']
        if y <= .12 and h >= .40 and min(w,d) >= .26:
            stamp(floor, x, z, w, d, item['yaw_deg'], .31, .26)


def bake(size, source):
    bounds = source['bounds']
    split = round(size*source['split'])
    gutter = round(size*source['gutter'])
    floor = Raster(size, split-2*gutter, bounds)
    ceiling = Raster(size, size-split-2*gutter, bounds)
    width, depth = bounds['maxX']-bounds['minX'], bounds['maxZ']-bounds['minZ']
    cx, cz = bounds['minX']+width/2, bounds['minZ']+depth/2
    for raster, opacity in ((floor,.20), (ceiling,.17)):
        for x in (bounds['minX'], bounds['maxX']):
            raster.stamp(x, cz, .22, depth, 0, 1.2, opacity)
        for z in (bounds['minZ'], bounds['maxZ']):
            raster.stamp(cx, z, width, .22, 0, 1.2, opacity)
    for store in source['stores']:
        shade_store(floor, ceiling, store)
    # A short soft echo of each lacquer pier base gives the polished floor
    # local detail while the zone PMREM supplies the view-dependent skylight.
    for x in source['pierXs']:
        for z, width, opacity in ((.69, .31, .19), (1.08, .24, .105), (1.48, .16, .055)):
            floor.stamp(x, z, width, .45, 0, .24, opacity)
    # Recessed public roof areas darken between the cove runs. Perimeter and
    # shop profiles stay distinct from the transparent skylight geometry.
    ambient = Image.new('L', ceiling.alpha.size, 21)
    gaps = Raster(size, ceiling.alpha.height, bounds)
    for x in (-9, 29):
        gaps.stamp(x, 20, .08, 27, 0, 3, 21/255)
    for z in (6.5, 33.5):
        gaps.stamp(10, z, 38, .08, 0, 3, 21/255)
    ceiling.alpha = ImageChops.lighter(ceiling.alpha, ImageChops.subtract(ambient, gaps.alpha))

    atlas = Image.new('RGBA', (size, size))
    alpha = Image.new('L', atlas.size)
    alpha.paste(floor.alpha, (0,gutter))
    alpha.paste(ceiling.alpha, (0,split+gutter))
    atlas.putalpha(alpha)
    output = io.BytesIO()
    atlas.save(output, 'WEBP', lossless=True, method=6)
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = source_geometry()
    for size in SIZES:
        output = ASSETS / f'mall-light-ao-{size}.webp'
        data = bake(size, source)
        if args.check:
            # libwebp versions may choose different lossless encodings.
            with Image.open(output) as current, Image.open(io.BytesIO(data)) as expected:
                if (current.mode, current.size, current.tobytes()) != (expected.mode, expected.size, expected.tobytes()):
                    parser.exit(1, f'Regenerate {output.relative_to(ROOT)}\n')
        else:
            output.write_bytes(data)


if __name__ == '__main__':
    main()
