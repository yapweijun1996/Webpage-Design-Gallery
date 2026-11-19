"""Measure face detail in display-referred luma and skin brightness in linear sRGB."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


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


def measure(path, face, skin):
    with Image.open(path) as image:
        rgb = image.convert("RGB")
    weights = np.array([.2126, .7152, .0722])
    crop = rgb_crop(rgb, face) @ weights
    if min(crop.shape) < 3:
        raise ValueError("Face region must contain at least 3 by 3 pixels")
    laplacian = (crop[:-2, 1:-1] + crop[2:, 1:-1] + crop[1:-1, :-2] + crop[1:-1, 2:]
                 - 4 * crop[1:-1, 1:-1])
    samples = np.concatenate([rgb_crop(rgb, box).reshape(-1, 3) for box in skin]) / 255
    linear = np.where(samples <= .04045, samples / 12.92, ((samples + .055) / 1.055) ** 2.4)
    return {"size": rgb.size, "laplacian_variance": float(laplacian.var()),
            "mean_skin_luminance": float((linear @ weights).mean()),
            "mean_skin_srgb_luma": float((samples @ weights).mean())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("--face", type=region, default=(220, 413, 375, 508),
                        help="Eye, brow and mouth region, left,top,right,bottom")
    parser.add_argument("--skin", type=region, action="append",
                        help="Skin patch, left,top,right,bottom (repeatable)")
    args = parser.parse_args()
    # Fixed anatomical patches on the supplied 600px crops: forehead, nose bridge and cheeks.
    args.skin = args.skin or [(290, 385, 324, 408), (285, 468, 297, 484),
                              (255, 489, 272, 497), (311, 489, 331, 497)]
    before, after = (measure(p, args.face, args.skin) for p in (args.before, args.after))
    if before["size"] != after["size"]:
        parser.error("Use matching pose, framing and native screenshot sizes")
    if not before["laplacian_variance"]:
        parser.error("The baseline crop has zero variance")
    ratio = after["laplacian_variance"] / before["laplacian_variance"]
    print(json.dumps({"face": args.face, "skin": args.skin, "before": before, "after": after,
                      "sharpness_ratio": ratio, "sharpness_pass": ratio >= 1.6,
                      "skin_not_darker": after["mean_skin_luminance"] >= before["mean_skin_luminance"],
                      "skin_in_range": .55 <= after["mean_skin_luminance"] <= .70}, indent=2))


if __name__ == "__main__":
    main()
