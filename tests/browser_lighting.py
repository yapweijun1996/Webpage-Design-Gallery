"""Capture the 48 GJH lighting reference views and compare them by pose."""
import argparse
import io
import json
import math
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'docs'))
from mall_browser_probe import URL, enter, launch, assert_teleport, scene_only
from mall_lap_probe import TIERS

# Each arrival has a stable heading from the mall layout. Offset the camera in
# the last two corridor views to include storefronts on both sides of the loop.
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


def capture(url, out):
    from playwright.sync_api import sync_playwright
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query), npcs='off')
    url = urlunsplit(parts._replace(query=urlencode(query)))
    rows = {}
    with sync_playwright() as playwright:
        browser = launch(playwright)
        for width, height in [(390, 844), (1440, 900)]:
            for tier in TIERS:
                context = browser.new_context(viewport=dict(width=width, height=height), device_scale_factor=1,
                                              has_touch=width == 390, is_mobile=width == 390,
                                              service_workers='block')
                context.add_init_script("localStorage.setItem('gjh-v11-mall-theme-v1','everyday')")
                page = enter(context, url, tier)
                scene_only(page)
                for zone, offset in POSES:
                    assert_teleport(page, zone)
                    page.evaluate("""offset => { __mall.setInput({yaw:__mall.state.yaw+offset, pitch:0.10});
                      __mall.step(500); }""", offset)
                    key = f'{width}-{tier}-{zone}'
                    png = page.locator('#scene').screenshot(type='png')
                    (out / f'{key}.png').write_bytes(png)
                    rows[key] = metrics(Image.open(io.BytesIO(png)))
                context.close()
        browser.close()
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=URL)
    parser.add_argument('--out', type=Path, default=Path('output/lighting'))
    parser.add_argument('--baseline', type=Path, default=Path('output/lighting-baseline.json'))
    parser.add_argument('--update-baseline', action='store_true')
    args = parser.parse_args()
    if not args.update_baseline and not args.baseline.is_file():
        parser.error(f'Missing {args.baseline}; capture the approved reference with --update-baseline')
    args.out.mkdir(parents=True, exist_ok=True)
    rows = capture(args.url, args.out)
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
