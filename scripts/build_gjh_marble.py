"""Generate the shared 512 px ivory marble tile for the mall and lift atlas."""
import argparse
import io
import math
from pathlib import Path

from PIL import Image


OUTPUT = (Path(__file__).resolve().parents[1]
          / 'demos/corporate/gjh/v11/assets/concourse-marble.webp')


def marble_tile():
    size = 512
    pixels = bytearray()
    for row in range(size):
        v = math.tau * row / size
        for column in range(size):
            u = math.tau * column / size
            bend = .31 * math.sin(u + 2*v) + .19 * math.sin(3*u - v) + .07 * math.sin(9*u + 4*v)
            phase = u + v + bend
            main = abs(math.sin(phase))
            striation = abs(math.sin(phase + .21 + .10 * math.cos(2*u - v)))
            cloud = 3.3 * math.cos(u - v) + 2.2 * math.sin(2*u + v) + 1.1 * math.sin(11*u - 7*v)
            vein = 16 * math.exp(-75*main**2) + 6 * math.exp(-145*striation**2)
            pixels.extend(round(value + cloud - vein*strength) for value,strength in
                          ((225,1.13),(220,1.03),(210,.88)))
    return Image.frombytes('RGB', (size, size), bytes(pixels))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    encoded = io.BytesIO()
    marble_tile().save(encoded, format='WEBP', lossless=True)
    if args.check:
        if OUTPUT.read_bytes() != encoded.getvalue():
            raise SystemExit(f'Regenerate {OUTPUT.name}')
    else:
        OUTPUT.write_bytes(encoded.getvalue())
