"""Run the GJH v11 mall for N laps in headed Chrome and report FPS per stop.

Usage (serve the repo root first, e.g. python3 -m http.server 8830):
  GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  python docs/mall_lap_probe.py --tier balanced --width 1920 --height 893 --laps 2

Each lap visits the courtyard, every shop (entrance + a short walk inside),
the lift and the upper level. Frame gaps come from requestAnimationFrame, draw
calls and triangles from __mall.performanceReport(). A stop passes when
p95 <= 20 ms, p99 <= 25 ms, no frame >= 50 ms and mean FPS >= 57 (60 Hz
display). Exit code 1 when any stop fails.
"""
import argparse
import json
import os
import sys

from playwright.sync_api import sync_playwright

ZONES = ['entry', 'atrium', 'newmoon', 'mili', 'gogo',
         *(f'planned-space-{i:02d}' for i in range(4, 18))]

INIT = """
localStorage.setItem('gjh-v11-tutorial-v1','dismissed');
localStorage.setItem('gjh-v11-graphics-quality-v1','%s');
window.__gaps=[];let last=performance.now();
(function t(){const n=performance.now();window.__gaps.push([n,n-last]);last=n;requestAnimationFrame(t)})();
"""

WALK = """([tx,tz]) => { const m=window.__mall; for(let i=0;i<500;i++){const p=m.state;
  const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz); if(d<.12)break;
  m.setInput({right:dx/d,forward:-dz/d,yaw:0}); m.step(Math.max(17,Math.min(100,d/2.65*1000)));}
  m.setInput({}); return m.step(20).nearby; }"""

REPORT = """() => { const r=window.__mall.performanceReport();
  return {drawCalls:r.drawCalls,triangles:r.triangles,zone:r.zone,tier:r.tier}; }"""


def stats(gaps):
    values = sorted(g for _, g in gaps)
    if not values:
        return {'frames': 0}
    pick = lambda q: values[min(len(values) - 1, int(len(values) * q))]
    mean = sum(values) / len(values)
    return {'frames': len(values), 'fps': round(1000 / mean, 1), 'p95': round(pick(.95), 1),
            'p99': round(pick(.99), 1), 'max': round(values[-1], 1),
            'slow50': sum(1 for v in values if v >= 50)}


def verdict(row):
    return (row.get('frames', 0) > 20 and row['p95'] <= 20 and row['p99'] <= 25
            and row['slow50'] == 0 and row['fps'] >= 57)


def capture(page, label, dwell_ms, walk_key=None, walk_ms=0):
    start = page.evaluate('performance.now()')
    page.wait_for_timeout(dwell_ms)
    if walk_key:
        page.keyboard.down(walk_key)
        page.wait_for_timeout(walk_ms)
        page.keyboard.up(walk_key)
        page.wait_for_timeout(400)
    gaps = [g for g in page.evaluate('window.__gaps') if g[0] > start]
    row = {'stop': label, **stats(gaps), **page.evaluate(REPORT)}
    row['pass'] = verdict(row)
    return row


def run_lap(page, lap):
    rows = []
    for zone in ZONES:
        assert page.evaluate('z=>__mall.teleport(z)', zone), zone
        page.wait_for_timeout(300)
        row = capture(page, f'L{lap} {zone}', 1500, 'w', 1500)
        rows.append(row)
    # Upper level through the lift: walk around the shaft, ride, dwell, ride back.
    page.evaluate('z=>__mall.teleport(z)', 'atrium')
    for waypoint in ([2, 18], [-8, 18], [-8, 10], [-6.4, 10]):
        page.evaluate(WALK, waypoint)
    page.locator('#inspect').click()
    page.wait_for_timeout(5000)
    rows.append(capture(page, f'L{lap} upper-level', 2500, 'w', 1200))
    page.locator('#inspect').click()
    page.wait_for_timeout(5000)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8830/demos/corporate/gjh/v11/')
    parser.add_argument('--tier', default='balanced', choices=['low', 'balanced', 'detailed'])
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=893)
    parser.add_argument('--laps', type=int, default=2)
    parser.add_argument('--json', default='')
    args = parser.parse_args()
    phone = args.width < 500
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                                             headless=False, args=['--use-angle=metal'])
        context = browser.new_context(viewport={'width': args.width, 'height': args.height},
                                      device_scale_factor=2 if phone else 1,
                                      has_touch=phone, service_workers='block')
        context.add_init_script(INIT % args.tier)
        page = context.new_page()
        page.goto(args.url, wait_until='domcontentloaded')
        page.locator('#arrival-walk').click()
        page.wait_for_function("window.__mall?.ready && window.__sceneReady && "
                               "document.querySelector('#app-loader').hidden", timeout=180000)
        page.locator('#scene').focus()
        page.wait_for_timeout(1500)
        rows = []
        for lap in range(1, args.laps + 1):
            rows += run_lap(page, lap)
        browser.close()
    print(f"{'stop':26} fps   p95   p99   max  slow draw    tris  result")
    for r in rows:
        print(f"{r['stop']:26} {r.get('fps', 0):5} {r.get('p95', 0):5} {r.get('p99', 0):5} "
              f"{r.get('max', 0):6} {r.get('slow50', 0):3} {r.get('drawCalls', 0):4} "
              f"{r.get('triangles', 0):7}  {'ok' if r['pass'] else 'FAIL'}")
    failed = [r['stop'] for r in rows if not r['pass']]
    print(f"{args.tier} {args.width}x{args.height}: {len(rows) - len(failed)}/{len(rows)} stops pass")
    if args.json:
        with open(args.json, 'w') as handle:
            json.dump(rows, handle, indent=1)
    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
