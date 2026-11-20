"""Check real header control, text, focus and action bounds across viewports."""
import argparse
import functools
import http.server
import json
import os
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_gjh_guide import ROOT, Quiet, ready, guide, closed


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path(tempfile.gettempdir()) / 'gjh-header-bounds')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    rows = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=[
                '--use-angle=' + os.environ.get('GALLERY_WEBGL_BACKEND', 'swiftshader'),
                '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            for width, height in [(320, 568), (390, 844), (639, 826), (768, 1024), (1440, 900)]:
                context = browser.new_context(viewport={'width': width, 'height': height},
                    device_scale_factor=2, has_touch=width < 1000, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                ready(page, f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/')
                guide(page)
                page.locator('#guide-skip').click(); page.locator('#guide-card').wait_for(state="hidden"); page.locator('#scene').focus()
                closed(page)

                page.locator('#bag-open').focus()
                page.keyboard.press('Tab')
                row = page.evaluate('''() => {
                  const e = document.querySelector('#view-toggle'), r = e.getBoundingClientRect();
                  const style = getComputedStyle(e), range = document.createRange();
                  range.selectNodeContents(e);
                  const labels = [...range.getClientRects()].map(r => r.toJSON());
                  return {viewport:[innerWidth, innerHeight], rect:r.toJSON(), labels,
                    focus:document.activeElement === e, focusVisible:e.matches(':focus-visible'),
                    ring:parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset)),
                    hit:[[2,2],[r.width-2,2],[2,r.height-2],[r.width-2,r.height-2],
                      [r.width/2,r.height/2]].every(([x,y]) => e.contains(document.elementFromPoint(r.x+x,r.y+y))),
                    previousRight:document.querySelector('#bag-open').getBoundingClientRect().right,
                    text:e.textContent, aria:e.getAttribute('aria-label')};
                }''')
                print(json.dumps(row), flush=True)
                box = row['rect']
                assert box['width'] >= 44 and box['height'] >= 44 and row['hit'], row
                assert row['focus'] and row['focusVisible'] and row['ring'] >= 2, row
                assert box['left'] - row['ring'] >= 0 and box['right'] + row['ring'] <= width, row
                assert box['left'] - row['ring'] >= row['previousRight'] - .05, row
                assert box['top'] - row['ring'] >= 0 and box['bottom'] + row['ring'] <= height, row
                assert row['text'] == 'Store Directory' and row['aria'], row
                for label in row['labels']:
                    assert label['left'] >= box['left'] and label['right'] <= box['right'] and label['top'] >= box['top'] and label['bottom'] <= box['bottom'], row
                page.screenshot(path=str(args.output / f'header-focus-{width}.png'))
                page.keyboard.press('Enter')
                assert page.locator('#store-list').is_visible()
                page.locator('#view-toggle').click()
                assert page.locator('#scene').is_visible()
                assert not errors, errors
                rows.append(row)
                context.close()
            browser.close()
    finally:
        server.shutdown()
    (args.output / 'results.json').write_text(json.dumps(rows, indent=2) + '\n')
    print('PASS: header bounds, focus and directory round trip across five viewports')


if __name__ == '__main__':
    run()
