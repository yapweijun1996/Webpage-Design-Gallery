"""Build the tiled, edge-faded 512 px projection for GJH atrium daylight."""

import argparse
import math
from pathlib import Path
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter


SIZE = 512
TILES = 4
PANES_X, PANES_Z = 10, 5
SUN = (255, 244, 220)
MAX_ALPHA = 42
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
    # Model the glazed bays in plan. The lateral shear follows the oblique
    # projection across the curved roof; dark mullions stay between the panes.
    panes = Image.new('L', (SIZE, SIZE))
    draw = ImageDraw.Draw(panes)
    for row in range(PANES_Z):
        for column in range(PANES_X):
            left = column * SIZE / PANES_X
            right = (column + 1) * SIZE / PANES_X
            top = row * SIZE / PANES_Z
            bottom = (row + 1) * SIZE / PANES_Z
            draw.polygon([(x + .20 * (y - SIZE/2), y) for x, y in
                          [(left+5, top+6), (right-5, top+6),
                           (right-5, bottom-6), (left+5, bottom-6)]], fill=255)
    panes = panes.filter(ImageFilter.GaussianBlur(3.0))
    dapple = tiled.point(lambda value: round(MAX_ALPHA * (1 - .78 * value / 255)))
    sunlight = Image.new('RGBA', (SIZE, SIZE), SUN)
    sunlight.putalpha(ImageChops.multiply(ImageChops.multiply(panes, dapple), envelope))
    return sunlight


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
