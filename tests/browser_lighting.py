"""Capture the 48 GJH lighting reference views and compare them by pose."""
import argparse
import base64
import io
import json
import math
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'docs'))
from mall_browser_probe import URL, enter, launch, assert_teleport
from mall_lap_probe import TIERS

SHOP_X = {'newmoon': -10, 'mili': 0, 'gogo': 10}
SHOP_BOX = r"""async x => {
  const T = await import('./vendor/three.module.min.js');
  const {position, quaternion, fov, aspect} = __mall.state.camera;
  const camera = new T.PerspectiveCamera(fov, aspect);
  camera.position.fromArray(position);
  camera.quaternion.fromArray(quaternion);
  camera.updateMatrixWorld(true);
  const corners = [-4.6,4.6].flatMap(dx => [.10,5.55].map(y =>
    new T.Vector3(x+dx,y,.36).project(camera)
  ));
  return [Math.min(...corners.map(p => (1+p.x)/2)),
          Math.min(...corners.map(p => (1-p.y)/2)),
          Math.max(...corners.map(p => (1+p.x)/2)),
          Math.max(...corners.map(p => (1-p.y)/2))];
}
"""

# Offset the last two corridor cameras to include storefronts along the loop.
POSES = [('entry', 0), ('atrium', .6), ('newmoon', 0), ('mili', 0), ('gogo', 0),
         ('planned-space-04', 0), ('planned-space-08', -.35), ('planned-space-14', .35)]


def metrics(image):
    red, _, blue = ImageStat.Stat(image.convert('RGB')).mean
    lum = ImageStat.Stat(image.convert('L'))
    if blue == 0 or lum.stddev[0] == 0:
        raise ValueError('Empty or monochrome lighting capture')
    return dict(mean=lum.mean[0], stddev=lum.stddev[0], redBlue=red / blue)


def compare(reference, actual):
    errors = []
    for key in sorted(set(reference) | set(actual)):
        if key not in reference or key not in actual:
            errors.append(f'{key}: missing view')
            continue
        for metric, low, high in [('mean', .90, 1.15), ('stddev', .95, None), ('redBlue', .97, None)]:
            base = reference[key][metric]
            value = actual[key][metric]
            if not (math.isfinite(base) and math.isfinite(value) and base > 0 and value >= base*low
                    and (high is None or value <= base*high)):
                errors.append(f'{key} {metric}: {value:.3f} vs reference {base:.3f}')
    return errors


def shop_crop(image, bounds):
    x0, y0, x1, y1 = bounds
    left = max(0, math.floor(x0 * image.width))
    top = max(0, math.floor(y0 * image.height))
    right = min(image.width, math.ceil(x1 * image.width))
    bottom = min(image.height, math.ceil(y1 * image.height))
    if left >= right or top >= bottom:
        raise ValueError('Shopfront is outside the capture')
    return image.crop((left, top, right, bottom))


def capture(url, out, shop_crops=False):
    from playwright.sync_api import sync_playwright
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query), npcs='off')
    url = urlunsplit(parts._replace(query=urlencode(query)))
    rows = {}
    crop_dir = out / 'shop-crops'
    if shop_crops:
        crop_dir.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = launch(playwright)
        for width, height in [(390, 844), (1440, 900)]:
            for tier in TIERS:
                context = browser.new_context(viewport=dict(width=width, height=height), device_scale_factor=1,
                                              has_touch=width == 390, is_mobile=width == 390,
                                              service_workers='block')
                context.add_init_script("localStorage.setItem('gjh-v11-mall-theme-v1','everyday')")
                page = enter(context, url, tier)
                for zone, offset in POSES:
                    assert_teleport(page, zone)
                    # Read the native render buffer during the same task as the
                    # manual frame, before the compositor can discard it.
                    data_url = page.evaluate("""offset => {
                      __mall.setInput({yaw:__mall.state.yaw+offset, pitch:0.10});
                      __mall.step(500);
                      return document.querySelector('#scene').toDataURL();
                    }""", offset)
                    key = f'{width}-{tier}-{zone}'
                    png = base64.b64decode(data_url.split(',', 1)[1])
                    (out / f'{key}.png').write_bytes(png)
                    with Image.open(io.BytesIO(png)) as image:
                        rows[key] = metrics(image)
                        if shop_crops and zone in SHOP_X:
                            crop = shop_crop(image, page.evaluate(SHOP_BOX, SHOP_X[zone]))
                            crop.save(crop_dir / f'{key}.png')
                context.close()
        browser.close()
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=URL)
    parser.add_argument('--out', type=Path, default=Path('output/lighting'))
    parser.add_argument('--baseline', type=Path, default=Path('output/lighting-baseline.json'))
    parser.add_argument('--update-baseline', action='store_true')
    parser.add_argument('--shop-crops', action='store_true',
                        help='Save and score the three original storefront crops at each tier and width')
    args = parser.parse_args()
    if not args.update_baseline and not args.baseline.is_file():
        parser.error(f'Missing {args.baseline}; capture the approved reference with --update-baseline')
    args.out.mkdir(parents=True, exist_ok=True)
    rows = capture(args.url, args.out, args.shop_crops)
    if args.shop_crops:
        sys.path.insert(0, str(ROOT / 'scripts'))
        from lighting_score import main as score
        score([str(args.out / 'shop-crops')])
    report = args.out / 'metrics.json'
    if args.baseline.resolve() == report.resolve():
        parser.error('Reference and measurement paths must differ')
    report.write_text(json.dumps(rows, indent=2))
    if args.update_baseline:
        args.baseline.parent.mkdir(parents=True, exist_ok=True)
        tmp = args.baseline.with_suffix('.tmp.json')
        tmp.write_text(report.read_text())
        tmp.replace(args.baseline)
        print(f'Recorded {len(rows)} lighting reference views')
        return 0
    errors = compare(json.loads(args.baseline.read_text()), rows)
    print(f'{len(rows)} lighting views, {len(errors)} differences outside tolerance')
    for error in errors:
        print(error)
    return int(bool(errors))


if __name__ == '__main__':
    sys.exit(main())
