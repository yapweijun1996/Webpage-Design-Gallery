"""Capture and check the eight GJH portrait poses using the video probe's live rig."""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'docs'))
from mall_browser_probe import URL
from mall_character_probe import capture_baseline


def verify(destination):
    poses = json.loads((destination / 'poses.json').read_text())
    expected = {(tier, subject, distance) for tier in ('low', 'detailed')
                for subject in ('player', 'npc') for distance in (2.5, 5.2)}
    actual = {(pose['tier'], pose['subject'], pose['distance']) for pose in poses}
    if len(poses) != 8 or actual != expected:
        raise ValueError('Incomplete portrait matrix')
    for pose in poses:
        size = (393, 700) if pose['tier'] == 'low' else (1920, 900)
        name = pose['name']
        with Image.open(destination / f'{name}.png') as image:
            if image.size != size or min(pose['buffer']) <= 0:
                raise ValueError(f'Invalid portrait dimensions: {name}')
            for part in ('face', 'hair', 'left-hand', 'right-hand'):
                with Image.open(destination / f'{name}-{part}.png') as crop:
                    if crop.tobytes() != image.crop(pose['boxes'][part]).tobytes():
                        raise ValueError(f'Invalid native crop: {name}/{part}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=URL)
    parser.add_argument('--out', type=Path, default=Path('output/character-candidate'))
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    if not args.verify_only:
        capture_baseline(args.url, None, args.out)
    verify(args.out)
