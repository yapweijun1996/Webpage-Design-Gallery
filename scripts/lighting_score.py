"""Measure screenshot tone and compare it with the GJH lighting concept."""

import argparse
import math
from pathlib import Path

from PIL import Image, ImageOps

try:
    import numpy as np
except ImportError:
    np = None


METRICS = ('mean', 'std', 'p5', 'p95', 'R/B', 'sat', 'dark')
CONCEPT = (.42, .214, .099, .789, 1.57, .411, .26)
LIMITS = ((.34, .50), (.20, 1), (0, .12), (0, .85), (1.45, 1.70), (.38, .45), (.18, .32))


def percentile(sorted_values, fraction):
    index = (len(sorted_values) - 1) * fraction
    lower, upper = math.floor(index), math.ceil(index)
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * (index - lower)


def measure(image, *, crop=None, max_edge=512):
    """Use sRGB Rec.709 luma, population deviation, and mean HSV saturation."""
    image = ImageOps.exif_transpose(image).convert('RGB')
    if crop is not None:
        left, top, right, bottom = crop
        if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
            raise ValueError(f'Crop {crop} is outside the {image.width} × {image.height} image')
        image = image.crop(crop)
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    if np is not None:
        rgb = np.asarray(image, dtype=np.float64).reshape(-1, 3) / 255
        red, _, blue = rgb.mean(axis=0)
        luma = rgb @ np.array([.2126, .7152, .0722])
        high, low = rgb.max(axis=1), rgb.min(axis=1)
        saturation = np.divide(high - low, high, out=np.zeros_like(high), where=high > 0)
        p5, p95 = np.percentile(luma, [5, 95])
        return (luma.mean(), luma.std(), p5, p95, red / blue if blue else math.inf,
                saturation.mean(), (luma < .25).mean())

    red = blue = saturation = 0
    luma = []
    pixels = getattr(image, 'get_flattened_data', image.getdata)()
    for r, g, b in pixels:
        red += r
        blue += b
        high = max(r, g, b)
        saturation += (high - min(r, g, b)) / high if high else 0
        luma.append((.2126 * r + .7152 * g + .0722 * b) / 255)
    count = len(luma)
    avg = math.fsum(luma) / count
    std = math.sqrt(math.fsum((value - avg) ** 2 for value in luma) / count)
    luma.sort()
    return (avg, std, percentile(luma, .05), percentile(luma, .95), red / blue if blue else math.inf,
            saturation / count, sum(value < .25 for value in luma) / count)


def outside_limits(values):
    return [name for name, value, (low, high) in zip(METRICS, values, LIMITS)
            if not low <= value <= high]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs', type=Path, nargs='+', help='Image files or directories of screenshots')
    parser.add_argument('--crop', type=int, nargs=4, metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'),
                        help='Score only this pixel rectangle in each image')
    parser.add_argument('--check', action='store_true', help='Exit 1 when any image misses a target')
    args = parser.parse_args(argv)
    supported = Image.registered_extensions()
    paths = []
    for path in args.inputs:
        if path.is_dir():
            paths.extend(sorted(p for p in path.iterdir() if p.is_file() and p.suffix.lower() in supported))
        elif path.is_file():
            paths.append(path)
        else:
            parser.error(f'Input does not exist: {path}')
    if not paths:
        parser.error('No images found')
    width = max(12, max(len(str(path)) for path in paths))
    print(f'{"Image":<{width}} ' + ' '.join(f'{name:>7}' for name in METRICS) + '  Outside target')
    failed = False
    print(f'{"Concept":<{width}} ' + ' '.join(f'{value:7.3f}' for value in CONCEPT))
    for path in paths:
        try:
            with Image.open(path) as image:
                values = measure(image, crop=args.crop)
        except (OSError, ValueError) as exc:
            parser.error(f'{path}: {exc}')
        misses = outside_limits(values)
        failed |= bool(misses)
        print(f'{str(path):<{width}} ' + ' '.join(f'{value:7.3f}' for value in values)
              + '  ' + (', '.join(misses) or 'PASS'))
    return int(args.check and failed)


if __name__ == '__main__':
    raise SystemExit(main())
