"""Measure fixed anatomical crops in matched native renders and build a comparison sheet."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

LUMA = np.array([.2126, .7152, .0722])


def region(value):
    try:
        left, top, right, bottom = map(int, value.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Expected left,top,right,bottom in pixels") from exc
    if min(left, top) < 0 or right <= left or bottom <= top:
        raise argparse.ArgumentTypeError("Expected a nonempty region with nonnegative coordinates")
    return left, top, right, bottom


def rgb_crop(image, box):
    if box[2] > image.width or box[3] > image.height:
        raise ValueError(f"Region {box} exceeds image size {image.size}")
    return np.asarray(image.crop(box), dtype=np.float64)


def edge_variance(rgb, boxes):
    edges = []
    for box in boxes:
        crop = rgb_crop(rgb, box) @ LUMA
        if min(crop.shape) < 3:
            raise ValueError(f"Region {box} must contain at least 3 by 3 pixels")
        laplacian = (crop[:-2, 1:-1] + crop[2:, 1:-1] + crop[1:-1, :-2] + crop[1:-1, 2:]
                     - 4 * crop[1:-1, 1:-1])
        edges.append(laplacian.ravel())
    return float(np.concatenate(edges).var())


def measure(rgb, face, skin):
    samples = np.concatenate([rgb_crop(rgb, box).reshape(-1, 3) for box in skin]) / 255
    linear = np.where(samples <= .04045, samples / 12.92, ((samples + .055) / 1.055) ** 2.4)
    return {"size": rgb.size, "laplacian_variance": edge_variance(rgb, [face]),
            "mean_skin_luminance": float((linear @ LUMA).mean()),
            "mean_skin_srgb_luma": float((samples @ LUMA).mean())}


def contact_sheet(images, box, path, label):
    width, height = box[2] - box[0], box[3] - box[1]
    zoom = max(1, min(6, 600 // width))
    cell = max(250, width * zoom)
    out = Image.new('RGB', (2 * cell + 36, height * zoom + 55), '#ededeb')
    draw = ImageDraw.Draw(out)
    for i, (image, title) in enumerate(zip(images, ('Before', 'Redraw'))):
        crop = image.crop(box)
        left = 12 + i * (cell + 12)
        draw.text((left, 9), f'{title}   {label}', fill='#222222')
        draw.text((left, 26), f'{width} x {height} native pixels, shown {zoom}x', fill='#444444')
        out.paste(crop.resize((width * zoom, height * zoom), Image.Resampling.NEAREST), (left, 44))
    out.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("--face", type=region, default=(220, 413, 375, 508))
    parser.add_argument("--skin", type=region, action="append")
    for feature in ("eye", "brow", "mouth"):
        parser.add_argument(f"--{feature}", type=region, action="append",
                            help="Native pixel rectangle, repeat for paired features")
    parser.add_argument("--sheet", type=Path)
    parser.add_argument("--context", type=region, help="Larger portrait region to show in the sheet")
    parser.add_argument("--label", default="")
    gate = parser.add_mutually_exclusive_group()
    gate.add_argument("--target", type=float, default=2, help="Required full-face variance ratio")
    gate.add_argument("--measure-only", action="store_true", help="Report a distance with no acceptance threshold")
    args = parser.parse_args()
    args.skin = args.skin or [(290, 385, 324, 408), (285, 468, 297, 484),
                              (255, 489, 272, 497), (311, 489, 331, 497)]
    images = []
    for path in (args.before, args.after):
        with Image.open(path) as source:
            images.append(source.convert("RGB"))
    if images[0].size != images[1].size:
        parser.error("Use matching pose, framing and native screenshot sizes")
    if args.context:
        rgb_crop(images[0], args.context)
    before, after = (measure(image, args.face, args.skin) for image in images)
    if not before["laplacian_variance"]:
        parser.error("The baseline face crop has zero variance")
    ratio = after["laplacian_variance"] / before["laplacian_variance"]
    features = {}
    for feature in ("eye", "brow", "mouth"):
        boxes = getattr(args, feature)
        if boxes:
            baseline, redraw = (edge_variance(image, boxes) for image in images)
            features[feature] = {"boxes": boxes, "before": baseline, "after": redraw,
                                 "ratio": redraw / baseline if baseline else None}
    if args.sheet:
        contact_sheet(images, args.context or args.face, args.sheet, args.label)
    gate_result = {} if args.measure_only else {"target": args.target, "sharpness_pass": ratio >= args.target}
    print(json.dumps({"face": args.face, "skin": args.skin, "before": before, "after": after,
                      "sharpness_ratio": ratio, **gate_result, "features": features,
                      "skin_not_darker": after["mean_skin_luminance"] >= before["mean_skin_luminance"],
                      "skin_in_range": .55 <= after["mean_skin_luminance"] <= .70}, indent=2))


if __name__ == "__main__":
    main()
