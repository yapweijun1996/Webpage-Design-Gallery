"""Transfer the vector face to the 4K source and rebake Blender's weighted UV layout."""
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from bake_tripo_atlas import chart_roots


def face_stencil():
    # Follows the skin/hair boundary and outer eyewire of the pinned frontal reference.
    mask = Image.new("L", (500, 500))
    ImageDraw.Draw(mask).polygon([(96,295),(108,277),(127,264),(146,255),(168,244),
      (184,230),(203,201),(226,170),(247,155),(282,155),(308,161),(329,181),
      (342,207),(358,236),(369,255),(388,273),(401,297),(392,351),(378,376),
      (354,397),(315,416),(272,428),(226,429),(183,418),(148,399),(124,375),
      (111,350)], fill=255)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(1.3)))


def sample_layers(art, skin_art, xy, jacobian):
    """Integrate the authored layer over each destination texel in projection space."""
    scale = len(art) / 500
    shape = (len(xy), 4)
    skin = np.zeros(shape)
    framed = np.zeros(shape)
    for offset in [(-.25, -.25), (.25, -.25), (-.25, .25), (.25, .25)]:
        projected = (xy + jacobian @ offset) * scale
        u, v = np.clip(projected.astype(int), 0, len(art)-1).T
        skin += skin_art[v, u]
        framed += art[v, u]
    return skin / 4, framed / 4


def compensate_line_filter(image, painted):
    """Restore part of the contrast lost to runtime bilinear sampling."""
    # A normalized blur never samples neighbouring charts through empty gutters.
    rgba = np.asarray(painted, dtype=np.float32)
    alpha = rgba[:, :, 3] / 255
    premult = Image.fromarray(np.rint(rgba[:, :, :3]*alpha[:, :, None]).astype("uint8"))
    kernel = ImageFilter.GaussianBlur(1.0)
    blur_alpha = np.asarray(Image.fromarray(painted[:, :, 3]).filter(kernel), dtype=np.float32) / 255
    blur_rgb = np.asarray(premult.filter(kernel), dtype=np.float32) / np.maximum(blur_alpha[:, :, None], 1/255)
    detail = rgba[:, :, :3] - blur_rgb
    # Ignore flat fills and cel gradients, including the blush. Bound the
    # channel correction at steep transitions to keep outlines free of halos.
    luma = detail @ np.array([.2126, .7152, .0722], dtype=np.float32)
    blend = alpha * np.clip((np.abs(luma)-3)/5, 0, 1)
    correction = np.clip(detail * .8, -18, 18)
    return np.rint(np.clip(image + correction*blend[:, :, None], 0, 255)).astype("uint8")


def facial_charts(source, positions, uv, triangles, charts):
    points = positions * [1050, -1050, 1] + [250, 1050, 0]
    centers = points[triangles].mean(axis=1)
    at = np.clip(centers[:, :2].astype(int), 0, 499)
    stencil = face_stencil()
    inside = (centers[:, 2] > .065) & (stencil[at[:, 1], at[:, 0]] > 0)
    triangle_charts = charts[triangles[:, 0]]
    active = np.unique(triangle_charts[inside])
    # Bangs pass in front of and behind the face projection. Identify whole
    # red-hair UV islands in the unmodified 4K source, including their tips.
    u, v = np.clip((uv[triangles].mean(axis=1)*source.width).astype(int), 0, source.width-1).T
    red, green, blue = np.asarray(source)[v, u].astype(float).T
    hair = (red > 1.45*green) & (red > 1.5*blue) & (green < 114)
    chosen = []
    for chart in active:
        members = triangle_charts == chart
        if positions[triangles[members], 1].max() > .747 and hair[members].mean() > .85:
            continue
        chosen.append(chart)
    return np.isin(charts, chosen)


def project_face(source, positions, uv, triangles, face_vertices, art, skin_art, *, compensate=False):
    points = positions * [1050, -1050, 1] + [250, 1050, 0]
    stencil = face_stencil()
    image = np.asarray(source).copy()
    # Project in UV space, extrapolating a few texels into island gutters.
    # At chart seams, prefer the triangle interior with the largest signed edge distance.
    painted = np.zeros((*image.shape[:2], 4), dtype="uint8") if compensate else None
    gutter = len(image) // 1024
    coverage = np.full(image.shape[:2], -gutter, np.float32)
    for ids in triangles[face_vertices[triangles[:, 0]]]:
        if points[ids, 2].max() <= .065:
            continue
        p = uv[ids]*len(image)
        x, y = np.maximum(0, np.floor(p.min(axis=0)-gutter).astype(int))
        u, v = np.minimum(len(image), np.ceil(p.max(axis=0)+gutter).astype(int))
        a, b, c = p
        matrix = np.stack([a-c, b-c], axis=1)
        det = np.linalg.det(matrix)
        if abs(det) < 1e-5 or x >= u or y >= v:
            continue
        yy, xx = np.mgrid[y:v, x:u] + .5
        inverse = np.linalg.inv(matrix)
        coords = np.stack([xx-c[0], yy-c[1]], axis=-1) @ inverse.T
        weights = np.dstack([coords, 1-coords.sum(axis=2)])
        heights = abs(det) / np.maximum(1e-7, np.linalg.norm(p[[1,2,0]]-p[[2,0,1]], axis=1))
        edge = (weights * heights).min(axis=2)
        xyz = weights @ points[ids]
        front = np.clip(xyz[:, :, :2].astype(int), 0, 499)
        sx, sy = front.transpose(2, 0, 1)
        mask = (edge > coverage[y:v, x:u]) & (xyz[:, :, 2] > .065) & (stencil[sy, sx] > 0)
        if not mask.any():
            continue
        face_xy = points[ids, :2]
        jacobian = (face_xy[:2] - face_xy[2]).T @ inverse
        rgba, framed = sample_layers(art, skin_art, xyz[:, :, :2][mask], jacobian)
        alpha = (rgba[:, 3]/255 * (stencil[sy[mask], sx[mask]]/255))[:, None]
        alpha *= np.clip((xyz[:, :, 2][mask]-.065)/.030, 0, 1)[:, None]
        source_rgb = np.asarray(source.crop((x, y, u, v)))[mask].astype(float)
        red, green, blue = source_rgb.T
        # The original raised eyewire is the only violet surface on the face.
        # Preserve its silhouette in oblique views. Burn the
        # vector rim into that surface only, retaining purple on its sidewalls.
        frame = (blue > red+3) & (blue > green+8)
        vector_rim = np.max(np.abs(framed[:, :3].astype(float)-rgba[:, :3]), axis=1) > 2
        rgba[frame & vector_rim] = framed[frame & vector_rim]
        alpha[frame & ~vector_rim] = 0
        # At the temples the outer hair lock crosses the frontal stencil.
        # Keep the source lock right through the feathered edge of the brush.
        edge_hair = (red > green*1.8) & (green < 85) & (blue < green*1.15)
        # Mixed charts at the temples can include both ears and locks. Preserve
        # hair coloured texels at the temples, beyond the original eyes and brows.
        symmetric_x = np.minimum(sx[mask], 496-sx[mask])
        yy = sy[mask]
        brow = ((symmetric_x-176)/40)**2 + ((yy-237)/15)**2 < 1
        eye = ((symmetric_x-174)/57)**2 + ((yy-311)/44)**2 < 1
        temple = (symmetric_x < 145) | (yy < 272)
        alpha[edge_hair & temple & ~(eye | brow)] = 0
        image[y:v, x:u][mask] = np.rint(rgba[:, :3]*alpha + source_rgb*(1-alpha))
        if painted is not None:
            # Brows, eyes, eyewire and lips. Leave cheeks, hair and body alone.
            linework = ((sy[mask] >= 223) & (sy[mask] <= 360)) | (
                (np.abs(sx[mask]-248) < 34) & (sy[mask] >= 367) & (sy[mask] <= 397))
            rgba[:, 3] = alpha[:, 0] * linework * 255
            painted[y:v, x:u][mask] = np.rint(rgba).astype("uint8")
        coverage[y:v, x:u][mask] = edge[mask]
    if painted is not None:
        image = compensate_line_filter(image, painted)
    return Image.fromarray(image)


def repack_image(source, uv, packed, charts, size):
    atlas = Image.new("RGB", (size, size))
    for chart in np.unique(charts):
        members = charts == chart
        old, new = uv[members]*source.width, packed[members]*size
        extent = np.ptp(new, axis=0)
        if np.min(extent) <= 1e-6:
            continue
        scale = np.ptp(old, axis=0) / extent
        # Rotation disabled in Blender. Source coordinates and packed coordinates
        # share the glTF top-left convention through the entire offline operation.
        shift = old.min(axis=0) - new.min(axis=0)*scale
        start = np.maximum(0, np.floor(new.min(axis=0)).astype(int)-2)
        stop = np.minimum(size, np.ceil(new.max(axis=0)).astype(int)+2)
        box = (*tuple(start*scale+shift), *tuple(stop*scale+shift))
        patch = source.transform(tuple(stop-start), Image.Transform.EXTENT, box, Image.Resampling.BICUBIC)
        atlas.paste(patch, tuple(start))
    return atlas


def main(directory, overlay, skin_overlay):
    positions, uv, indices = json.loads((directory / "geometry.json").read_text())
    positions, uv = np.array(positions), np.array(uv)
    triangles = np.array(indices).reshape(-1, 3)
    charts = np.asarray(chart_roots(len(uv), triangles))
    source = Image.open(directory / "source.jpg").convert("RGB")
    art = Image.open(overlay).convert("RGBA")
    if source.size != (4096, 4096) or art.size != source.size:
        raise ValueError("Both the pinned source and face layer must be 4096 square")
    skin_art = Image.open(skin_overlay).convert("RGBA")
    if skin_art.size != art.size:
        raise ValueError("The frameless skin layer must match the face projection")
    art, skin_art = np.asarray(art), np.asarray(skin_art)
    face = facial_charts(source, positions, uv, triangles, charts)
    composite = project_face(source, positions, uv, triangles, face, art, skin_art)
    np.save(directory / "face-vertices.npy", face)
    subprocess.run([os.environ.get("BLENDER", "blender"), "-b", "-noaudio", "--factory-startup",
        "--disable-autoexec", "--python-exit-code", "1", "--python",
        str(Path(__file__).with_name("pack_tripo_face_uv.py")), "--", str(directory)], check=True,
        env={**os.environ, **({"DYLD_INSERT_LIBRARIES": os.environ["BLENDER_METAL_GUARD"]}
            if "BLENDER_METAL_GUARD" in os.environ else {})})
    packed = np.load(directory / "packed-uv.npy")
    size = 2048
    atlas = repack_image(source, uv, packed, charts, size)
    # Sample the vector projection in the final UV layout. Sampling a second
    # time from the 4K composite would filter the eyelids and lips twice.
    atlas = project_face(atlas, positions, packed, triangles, face, art, skin_art, compensate=True)
    atlas.save(directory / "atlas.jpg", quality=97, subsampling=0)
    atlas.resize((1024,1024), Image.Resampling.LANCZOS).save(directory / "low.jpg", quality=88, subsampling=1, optimize=True)
    composite.resize((512,512), Image.Resampling.LANCZOS).save(directory / "far.jpg", quality=85, subsampling=2, optimize=True)
    (directory / "uv.json").write_text(json.dumps(packed.tolist()))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
