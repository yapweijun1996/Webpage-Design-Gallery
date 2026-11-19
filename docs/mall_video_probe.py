"""Record short gameplay clips of the GJH v11 mall and look for flicker and stutter.

Usage (serve the repo root first, e.g. python3 -m http.server 8830):
  GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  python docs/mall_video_probe.py --tier balanced --segments 3 --seconds 12 --gap 10 --out output/video-probe

Chrome DevTools screencast frames (one JPEG per presented frame, with its
timestamp) are saved per segment. The analysis reports, per segment:
  * presented frame rate and gaps >= 50 ms between presented frames (stutter);
  * blink pixels: pixels that change and change back within three consecutive
    frames (A, B, A). Real motion rarely does that, a flickering model or a
    z-fighting surface does. The share of pixels that blink repeatedly (hotShare, pass
    criterion; blinkShare counts any single blink and is mostly JPEG noise) and their bounding
    boxes are reported and a labelled heat-map plus a contact sheet are written so a
    person (or the manager agent) can look at the footage.
Needs Pillow and numpy. Exit code 1 when a segment exceeds the thresholds.
"""
import argparse
import base64
import io
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageDraw
from mall_browser_probe import enter, launch, assert_teleport
from mall_lap_probe import ZONES, reach_upper, positive_int

# One scripted path per segment: (zone, [(key, ms) ...], mouse-drag dx per step)
ROUTES = [
    ('atrium', [('w', 3000), ('d', 1500), ('w', 3000), ('a', 1500)], 140),
    ('newmoon', [('w', 2500), ('a', 1200), ('w', 1500), ('d', 2400)], 180),
    ('planned-space-14', [('w', 2500), ('d', 1500), ('s', 1500), ('a', 1500)], 160),
    ('mili', [('w', 2500), ('d', 2000), ('w', 1500)], 160),
    ('gogo', [('w', 2500), ('a', 1500), ('w', 1500)], 160),
]


def regions(hot):
    """8-connected components. Boxes use half-open analysis-pixel coordinates."""
    remaining = {(int(x), int(y)) for y, x in zip(*np.nonzero(hot))}
    result = []
    while remaining:
        seed = remaining.pop()
        stack = [seed]
        left, top = right, bottom = seed
        area = 0
        while stack:
            x, y = stack.pop()
            area += 1
            left, top, right, bottom = min(left, x), min(top, y), max(right, x), max(bottom, y)
            for nx in range(x-1, x+2):
                for ny in range(y-1, y+2):
                    if (nx, ny) in remaining:
                        remaining.remove((nx, ny))
                        stack.append((nx, ny))
        result.append({'box': [left, top, right+1, bottom+1], 'area': area})
    result.sort(key=lambda r: (-r['area'], r['box']))
    for i, region in enumerate(result, 1):
        region['label'] = f'R{i:03}'
    return result


def analyse(frames, width=320):
    if len(frames) < 3:
        raise ValueError('Fewer than three screencast frames; cannot measure flicker')
    stamps = np.array([t for t, _ in frames])
    a = b = blink = None
    for _, blob in frames:
        image = Image.open(io.BytesIO(blob)).convert('L')
        height = max(1, round(image.height * width / image.width))
        c = np.asarray(image.resize((width, height)), dtype=np.int16)
        if blink is None:
            blink = np.zeros(c.shape, dtype=np.int32)
        if a is not None:
            blink += (np.abs(b-a) > 24) & (np.abs(b-c) > 24) & (np.abs(a-c) < 12)
        a, b = b, c
    gaps = np.diff(stamps) * 1000
    metrics = {'frames': len(frames), 'seconds': round(float(stamps[-1] - stamps[0]), 2),
               'fps': round((len(frames) - 1) / max(stamps[-1] - stamps[0], 1e-6), 1),
               'gaps50': int((gaps >= 50).sum()), 'maxGapMs': round(float(gaps.max()), 1) if len(gaps) else 0}
    metrics['blinkShare'] = round(float((blink > 0).mean()), 5)
    hot = blink >= max(2, len(frames) // 40)
    metrics['hotShare'] = round(float(hot.mean()), 5)
    ys, xs = np.where(hot)
    metrics['hotBox'] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None
    metrics['regions'] = regions(hot)
    metrics['analysisSize'] = [width, height]
    return metrics, hot


def write_artifacts(folder, frames, hot, region_list):
    os.makedirs(folder, exist_ok=True)
    picks = np.linspace(0, len(frames) - 1, 12).astype(int)
    tiles = [Image.open(io.BytesIO(frames[i][1])).convert('RGB').resize((320, 180)) for i in picks]
    sheet = Image.new('RGB', (320 * 4, 180 * 3))
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % 4) * 320, (index // 4) * 180))
    sheet.save(os.path.join(folder, 'contact-sheet.jpg'), quality=85)
    source = Image.open(io.BytesIO(frames[len(frames) // 2][1])).convert('RGB')
    height, width = hot.shape
    overlay = np.asarray(source.resize((width, height))).copy()
    overlay[hot] = (255, 0, 0)
    marked = Image.fromarray(overlay).resize(source.size)
    draw = ImageDraw.Draw(marked)
    for region in region_list:
        x, y, right, bottom = region['box']
        box = (x*source.width//width, y*source.height//height,
               int(np.ceil(right*source.width/width)), int(np.ceil(bottom*source.height/height)))
        name = region['label']
        source.crop(box).save(os.path.join(folder, name + '.png'))
        draw.rectangle((box[0], box[1], box[2]-1, box[3]-1), outline='red')
        draw.text(box[:2], name, fill='yellow')
    marked.save(os.path.join(folder, 'blink-heatmap.png'))
    timeline = []
    for i, (stamp, data) in enumerate(frames):
        filename = f'frame-{i:04d}.jpg'
        with open(os.path.join(folder, filename), 'wb') as handle:
            handle.write(data)
        timeline.append({'file': filename, 'seconds': stamp-frames[0][0]})
    with open(os.path.join(folder, 'timeline.json'), 'w') as handle:
        json.dump(timeline, handle)


def record_segment(page, cdp, route, seconds):
    zone, moves, drag = route
    if zone == 'upper':
        reach_upper(page)
    else:
        assert_teleport(page, zone)
    page.wait_for_timeout(1200)
    frames = []

    def on_frame(params):
        frames.append((params['metadata']['timestamp'], base64.b64decode(params['data'])))
        cdp.send('Page.screencastFrameAck', {'sessionId': params['sessionId']})

    cdp.on('Page.screencastFrame', on_frame)
    cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 70, 'maxWidth': 960, 'everyNthFrame': 1})
    visited = set()
    started = time.monotonic()
    page.wait_for_timeout(350)  # Record the entrance before walking.
    box = page.viewport_size
    cx, cy = box['width'] // 2, box['height'] // 2
    index = 0
    while time.monotonic() - started < seconds:
        key, ms = moves[index % len(moves)]
        index += 1
        page.keyboard.down(key)
        end = time.monotonic() + ms / 1000
        while time.monotonic() < end and time.monotonic() - started < seconds:
            page.wait_for_timeout(250)
        page.keyboard.up(key)
        visited.add(page.evaluate('__mall.state.zone'))
        # camera orbit: drag left/right and a little up/down while standing, then a still moment
        page.mouse.move(cx, cy)
        page.mouse.down()
        for step in range(1, 9):
            page.mouse.move(cx + (drag if index % 2 else -drag) * step / 8, cy + (24 if index % 3 == 0 else -18) * step / 8)
            page.wait_for_timeout(40)
        page.mouse.up()
        page.wait_for_timeout(900)
    cdp.send('Page.stopScreencast')
    page.wait_for_timeout(300)
    cdp.remove_listener('Page.screencastFrame', on_frame)
    return frames, visited


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8830/demos/corporate/gjh/v11/')
    parser.add_argument('--tier', choices=['low', 'balanced', 'detailed'])
    parser.add_argument('--width', type=positive_int)
    parser.add_argument('--height', type=positive_int)
    parser.add_argument('--segments', type=positive_int)
    parser.add_argument('--seconds', type=float, default=12)
    parser.add_argument('--gap', type=float, default=10)
    parser.add_argument('--out', default='output/video-probe')
    parser.add_argument('--max-hot-share', type=float, default=0.001, help='share of pixels that blink repeatedly')
    parser.add_argument('--max-gaps', type=int, default=0)
    parser.add_argument('--device', choices=('phone', 'desktop'))
    parser.add_argument('--route', choices=('default', 'shops', 'upper', 'character'), default='default')
    args = parser.parse_args()
    if args.seconds <= 0 or args.gap < 0:
        parser.error('seconds must be positive and gap non-negative')
    if args.route == 'character':
        from mall_character_probe import capture_baseline
        return capture_baseline(args.url, args.device, args.out if args.out != 'output/video-probe' else 'output/character-baseline')
    from playwright.sync_api import sync_playwright
    phone = args.device == 'phone' if args.device else (args.width or 1280) < 500
    args.tier = args.tier or ('low' if phone else 'balanced')
    args.width = args.width or (393 if phone else 1280)
    args.height = args.height or (700 if phone else 800)
    routes = ROUTES
    if args.route == 'shops':
        routes = [(zone, [('w', 2400), ('d', 750), ('a', 750)], 100) for zone in ZONES[2:]]
        if args.segments and args.segments < len(routes):
            parser.error('--route shops requires at least 17 segments')
    elif args.route == 'upper':
        routes = [('upper', [('w', 1200), ('a', 800), ('s', 1200)], 120)]
    count = args.segments or (3 if args.route == 'default' else len(routes))
    results = []
    with sync_playwright() as playwright:
        browser = launch(playwright)
        context = browser.new_context(viewport={'width': args.width, 'height': args.height},
                                      device_scale_factor=2 if phone else 1, has_touch=phone,
                                      is_mobile=phone, service_workers='block')
        page = enter(context, args.url, args.tier)
        page.wait_for_timeout(1500)
        cdp = context.new_cdp_session(page)
        for index in range(count):
            route = routes[index % len(routes)]
            frames, visited = record_segment(page, cdp, route, args.seconds)
            metrics, hot = analyse(frames)
            folder = os.path.join(args.out, f'segment-{index + 1}-{route[0]}')
            write_artifacts(folder, frames, hot, metrics['regions'])
            metrics['visitedZones'] = sorted(visited)
            metrics['routePass'] = args.route not in ('upper', 'shops') or route[0] in visited
            metrics.update({'segment': index + 1, 'zone': route[0], 'folder': folder})
            metrics['pass'] = metrics['routePass'] and metrics['hotShare'] <= args.max_hot_share and metrics['gaps50'] <= args.max_gaps
            results.append(metrics)
            print(json.dumps(metrics), flush=True)
            page.wait_for_timeout(int(args.gap * 1000))
        browser.close()
    with open(os.path.join(args.out, 'summary.json'), 'w') as handle:
        json.dump(results, handle, indent=1)
    failed = [r['segment'] for r in results if not r['pass']]
    print(f"{args.tier}: {len(results) - len(failed)}/{len(results)} segments clean")
    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
