"""Build the tiled, edge-faded 512 px projection for GJH atrium daylight."""

import argparse
import math
from pathlib import Path
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter


SIZE = 512
TILES = 4
SUN = (255, 242, 219)
PENUMBRA = (75, 85, 98)
MAX_ALPHA = 61
OUTPUT = (Path(__file__).resolve().parents[1]
          / 'demos/corporate/gjh/v11/assets/mall-skylight-dapple-512.png')


def build():
    randomizer = random.Random(76119)
    margin = 48
    mask = Image.new('L', (SIZE + 2 * margin,) * 2)
    draw = ImageDraw.Draw(mask)
    # Overlapping leaf clusters leave pools of sunlight between the branches.
    for _ in range(32):
        center_x, center_y = [randomizer.uniform(0, SIZE) for _ in range(2)]
        for _ in range(randomizer.randint(18, 42)):
            angle = randomizer.uniform(0, math.tau)
            distance = randomizer.uniform(0, 37)
            x = (center_x + math.cos(angle) * distance) % SIZE + margin
            y = (center_y + math.sin(angle) * distance) % SIZE + margin
            length = randomizer.uniform(5, 16)
            width = randomizer.uniform(3, 9)
            for dx in (-SIZE, 0, SIZE):
                for dy in (-SIZE, 0, SIZE):
                    draw.ellipse((round(x + dx - length), round(y + dy - width),
                                  round(x + dx + length), round(y + dy + width)), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(6.5))
    tile = mask.crop((margin, margin, margin + SIZE, margin + SIZE))
    tiled = Image.new('L', (SIZE, SIZE))
    for row in range(TILES):
        top, bottom = row * SIZE // TILES, (row + 1) * SIZE // TILES
        for column in range(TILES):
            left, right = column * SIZE // TILES, (column + 1) * SIZE // TILES
            tiled.paste(tile.resize((right-left, bottom-top), Image.Resampling.LANCZOS), (left, top))

    def edge_fade(pixel):
        distance = min(pixel, SIZE - 1 - pixel)
        # Leave a transparent gutter wider than the maximum UV drift.
        blend = max(0, min(1, (distance - 18) / 35))
        return blend * blend * (3 - 2 * blend)

    fade = [edge_fade(pixel) for pixel in range(SIZE)]
    envelope = Image.frombytes('L', (SIZE, SIZE), bytes(round(255*x*y) for y in fade for x in fade))
    # Keep the floor unchanged at the midpoint and bound the source-over alpha
    # at both ends. Feather the alpha only so the fade keeps the patch colour.
    sunlight = Image.new('RGBA', (SIZE, SIZE), SUN)
    sunlight.putalpha(ImageChops.multiply(
        tiled.point(lambda value: round(MAX_ALPHA * max(0, 1 - value / 95))), envelope))
    shade = Image.new('RGBA', (SIZE, SIZE), PENUMBRA)
    shade.putalpha(ImageChops.multiply(
        tiled.point(lambda value: round(MAX_ALPHA * max(0, (value - 95) / 160))), envelope))
    return Image.alpha_composite(sunlight, shade)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build()
    if args.check:
        with Image.open(OUTPUT) as current:
            if current.mode != result.mode or current.size != result.size or current.tobytes() != result.tobytes():
                raise SystemExit(f'Regenerate {OUTPUT.name}')
    else:
        result.save(OUTPUT, optimize=True)
