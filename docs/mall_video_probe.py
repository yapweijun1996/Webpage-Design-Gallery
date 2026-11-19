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
    boxes are reported and a red heat-map plus a contact sheet are written so a
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
from PIL import Image
from playwright.sync_api import sync_playwright

INIT = """
localStorage.setItem('gjh-v11-tutorial-v1','dismissed');
localStorage.setItem('gjh-v11-graphics-quality-v1','%s');
"""

# One scripted path per segment: (zone, [(key, ms) ...], mouse-drag dx per step)
ROUTES = [
    ('atrium', [('w', 3000), ('d', 1500), ('w', 3000), ('a', 1500)], 140),
    ('newmoon', [('w', 2500), ('a', 1200), ('w', 1500), ('d', 2400)], 180),
    ('planned-space-14', [('w', 2500), ('d', 1500), ('s', 1500), ('a', 1500)], 160),
    ('mili', [('w', 2500), ('d', 2000), ('w', 1500)], 160),
    ('gogo', [('w', 2500), ('a', 1500), ('w', 1500)], 160),
]


def analyse(frames, width=320):
    """frames: list of (timestamp_s, jpeg_bytes). Returns metrics and arrays."""
    stamps = np.array([t for t, _ in frames])
    gray = []
    for _, blob in frames:
        image = Image.open(io.BytesIO(blob)).convert('L')
        height = max(1, round(image.height * width / image.width))
        gray.append(np.asarray(image.resize((width, height)), dtype=np.int16))
    stack = np.stack(gray)
    gaps = np.diff(stamps) * 1000
    metrics = {'frames': len(frames), 'seconds': round(float(stamps[-1] - stamps[0]), 2),
               'fps': round(len(frames) / max(stamps[-1] - stamps[0], 1e-6), 1),
               'gaps50': int((gaps >= 50).sum()), 'maxGapMs': round(float(gaps.max()), 1) if len(gaps) else 0}
    blink = np.zeros(stack.shape[1:], dtype=np.int32)
    if len(stack) >= 3:
        a, b, c = stack[:-2], stack[1:-1], stack[2:]
        step = 24
        blink = ((np.abs(b - a) > step) & (np.abs(b - c) > step) & (np.abs(a - c) < step // 2)).sum(axis=0)
    metrics['blinkShare'] = round(float((blink > 0).mean()), 5)
    hot = blink >= max(2, len(stack) // 40)
    metrics['hotShare'] = round(float(hot.mean()), 5)
    ys, xs = np.where(hot)
    metrics['hotBox'] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None
    return metrics, stack, blink, hot


def write_artifacts(folder, frames, stack, blink, hot):
    os.makedirs(folder, exist_ok=True)
    picks = np.linspace(0, len(frames) - 1, 12).astype(int)
    tiles = [Image.open(io.BytesIO(frames[i][1])).convert('RGB').resize((320, 180)) for i in picks]
    sheet = Image.new('RGB', (320 * 4, 180 * 3))
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % 4) * 320, (index // 4) * 180))
    sheet.save(os.path.join(folder, 'contact-sheet.jpg'), quality=85)
    base = Image.open(io.BytesIO(frames[len(frames) // 2][1])).convert('RGB').resize((stack.shape[2], stack.shape[1]))
    overlay = np.asarray(base).copy()
    overlay[hot] = (255, 0, 0)
    Image.fromarray(overlay).resize((960, round(960 * stack.shape[1] / stack.shape[2]))).save(
        os.path.join(folder, 'blink-heatmap.png'))
    for i in picks:
        with open(os.path.join(folder, f'frame-{i:04d}.jpg'), 'wb') as handle:
            handle.write(frames[i][1])


def record_segment(page, cdp, route, seconds):
    zone, moves, drag = route
    assert page.evaluate('z=>__mall.teleport(z)', zone), zone
    page.wait_for_timeout(1200)
    frames = []

    def on_frame(params):
        frames.append((params['metadata']['timestamp'], base64.b64decode(params['data'])))
        cdp.send('Page.screencastFrameAck', {'sessionId': params['sessionId']})

    cdp.on('Page.screencastFrame', on_frame)
    cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 70, 'maxWidth': 960, 'everyNthFrame': 1})
    started = time.time()
    box = page.viewport_size
    cx, cy = box['width'] // 2, box['height'] // 2
    index = 0
    while time.time() - started < seconds:
        key, ms = moves[index % len(moves)]
        index += 1
        page.keyboard.down(key)
        end = time.time() + ms / 1000
        while time.time() < end and time.time() - started < seconds:
            page.wait_for_timeout(250)
        page.keyboard.up(key)
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
    return frames


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8830/demos/corporate/gjh/v11/')
    parser.add_argument('--tier', default='balanced', choices=['low', 'balanced', 'detailed'])
    parser.add_argument('--width', type=int, default=1280)
    parser.add_argument('--height', type=int, default=800)
    parser.add_argument('--segments', type=int, default=3)
    parser.add_argument('--seconds', type=float, default=12)
    parser.add_argument('--gap', type=float, default=10)
    parser.add_argument('--out', default='output/video-probe')
    parser.add_argument('--max-hot-share', type=float, default=0.001, help='share of pixels that blink repeatedly')
    parser.add_argument('--max-gaps', type=int, default=0)
    args = parser.parse_args()
    phone = args.width < 500
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                                             headless=False, args=['--use-angle=metal'])
        context = browser.new_context(viewport={'width': args.width, 'height': args.height},
                                      device_scale_factor=2 if phone else 1, has_touch=phone,
                                      service_workers='block')
        context.add_init_script(INIT % args.tier)
        page = context.new_page()
        page.goto(args.url, wait_until='domcontentloaded')
        page.locator('#arrival-walk').click()
        page.wait_for_function("window.__mall?.ready && window.__sceneReady && "
                               "document.querySelector('#app-loader').hidden", timeout=180000)
        page.locator('#scene').focus()
        page.wait_for_timeout(1500)
        cdp = context.new_cdp_session(page)
        for index in range(args.segments):
            route = ROUTES[index % len(ROUTES)]
            frames = record_segment(page, cdp, route, args.seconds)
            metrics, stack, blink, hot = analyse(frames)
            folder = os.path.join(args.out, f'segment-{index + 1}-{route[0]}')
            write_artifacts(folder, frames, stack, blink, hot)
            metrics.update({'segment': index + 1, 'zone': route[0], 'folder': folder})
            metrics['pass'] = metrics['hotShare'] <= args.max_hot_share and metrics['gaps50'] <= args.max_gaps
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
