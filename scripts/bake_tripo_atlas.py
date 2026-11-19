"""Repack the pinned Tripo source's connected UV charts into one portrait atlas."""
import json
import math
import sys
from pathlib import Path

from PIL import Image


def bake(directory):
    positions, uv, indices = json.loads((directory / 'geometry.json').read_text())
    source = Image.open(directory / 'source.jpg').convert('RGB')
    if source.size != (4096, 4096):
        raise ValueError(f'Expected a 4K source, got {source.size}')
    parents = list(range(len(uv)))

    def root(i):
        while i != parents[i]:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    for a, b, c in zip(indices[::3], indices[1::3], indices[2::3]):
        parents[root(b)] = root(a)
        parents[root(c)] = root(a)
    groups = {}
    for i in range(len(uv)):
        groups.setdefault(root(i), []).append(i)
    charts = []
    for vertices in groups.values():
        u, v = zip(*(uv[i] for i in vertices))
        # All source corners are in glTF image space (origin at the top left).
        left, top = math.floor(min(u)*4096), math.floor(min(v)*4096)
        right, bottom = math.ceil(max(u)*4096), math.ceil(max(v)*4096)
        weight = 1.5 if sum(positions[i][1] for i in vertices)/len(vertices) > .55 else 1
        charts.append((left, top, max(1, right-left), max(1, bottom-top), weight, vertices))
    charts.sort(key=lambda chart: -chart[3]*chart[4])
    size, pad = 2048, 4

    def layout(scale):
        x = y = row = 0
        placements = []
        for _, _, w, h, weight, _ in charts:
            width = max(1, round(w*weight*scale))
            height = max(1, round(h*weight*scale))
            if width+2*pad > size:
                return None
            if x+width+2*pad > size:
                y += row
                row = x = 0
            if y+height+2*pad > size:
                return None
            placements.append((x+pad, y+pad, width, height))
            row = max(row, height+2*pad)
            x += width+2*pad
        return placements

    lo, hi = 0, 1
    for _ in range(22):
        mid = (lo+hi)/2
        if layout(mid):
            lo = mid
        else:
            hi = mid
    atlas = Image.new('RGB', (size, size))
    for (left, top, w, h, _, vertices), (x, y, width, height) in zip(charts, layout(lo), strict=True):
        # Resample adjacent source texels into each gutter, around each resized chart.
        box = (left-pad*w/width, top-pad*h/height, left+w+pad*w/width, top+h+pad*h/height)
        patch = source.transform((width+pad*2, height+pad*2), Image.Transform.EXTENT,
                                 box, resample=Image.Resampling.BICUBIC)
        atlas.paste(patch, (x-pad, y-pad))
        for i in vertices:
            u, v = uv[i]
            uv[i] = [(x+(u*4096-left)*width/w)/size, (y+(v*4096-top)*height/h)/size]
    atlas.save(directory / 'atlas.jpg', quality=95, subsampling=0)
    (directory / 'uv.json').write_text(json.dumps(uv))


if __name__ == '__main__':
    bake(Path(sys.argv[1]))
