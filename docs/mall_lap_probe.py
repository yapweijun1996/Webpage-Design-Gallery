"""Run the GJH v11 mall for N laps in headed Chrome and report FPS per stop.

Usage (serve the repo root first, e.g. python3 -m http.server 8830):
  GALLERY_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  python docs/mall_lap_probe.py --device phone --tier balanced --laps 2

Each lap visits the courtyard, every shop (entrance + a short walk inside),
the lift and the upper level. Rendered frame gaps, render scale and peak
draw calls and triangles come from __mall.performanceReport(). Phones target
30 FPS (p95 <= 36 ms, mean >= 29 FPS); tablets and desktops target 60 FPS
(p95 <= 20 ms, mean >= 57 FPS). Each stop must also fit its tier budget.
Exit code 1 when any stop fails. With no device specified, --tier all uses
the phone preset for Low and the desktop preset for Balanced and Detailed.
"""
import argparse
import json
import math
import os
import platform
import sys

TIERS = {
    "low": (220_000, 70),
    "balanced": (300_000, 90),
    "detailed": (420_000, 110),
}
DEVICES = {
    "phone": (393, 700, 30, 36, 29),
    "tablet": (820, 1180, 60, 20, 57),
    "desktop": (1920, 893, 60, 20, 57),
}

ZONES = ['entry', 'atrium', 'newmoon', 'mili', 'gogo',
         *(f'planned-space-{i:02d}' for i in range(4, 18))]

INIT = """
localStorage.setItem('gjh-v11-tutorial-v1','dismissed');
localStorage.setItem('gjh-v11-graphics-quality-v1','%s');
"""

WALK = """([tx,tz]) => { const m=window.__mall; for(let i=0;i<500;i++){const p=m.state;
  const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz); if(d<.12)break;
  m.setInput({right:dx/d,forward:-dz/d,yaw:0}); m.step(Math.max(17,Math.min(100,d/2.65*1000)));}
  m.setInput({}); const nearby = m.step(20).nearby; m.setInput(null); return nearby; }"""

REPORT = """(start) => {
  const report = window.__mall.performanceReport();
  const frames = report.history.filter(frame => frame.at >= start);
  const peak = key => {
    const values = frames.map(frame => frame[key]).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  };
  const gaps = frames.filter((frame, index) => index > 0 && Number.isFinite(frame.frameMs))
    .map(frame => frame.frameMs);
  return {drawCalls:peak('drawCalls'), triangles:peak('triangles'), zone:report.zone,
    tier:report.graphics.tier, budgetSamples:frames.length, gaps, renderScale:report.renderScale,
    targetFps:report.targetFps, deviceClass:report.deviceClass, tierDowngrades:report.tierDowngrades};
}"""


def stats(gaps):
    values = sorted(gaps)
    if not values:
        return {'frames': 0}
    pick = lambda q: values[math.ceil(len(values) * q) - 1]
    mean = sum(values) / len(values)
    return {'frames': len(values), 'fps': 1000 / mean, 'p95': pick(.95),
            'p99': pick(.99), 'max': values[-1],
            'slow50': sum(1 for v in values if v >= 50)}


def verdict(row, device):
    _, _, target, max_p95, min_fps = DEVICES[device]
    return (row['deviceClass'] == device and row['targetFps'] == target and row['frames'] > 20
            and row['p95'] <= max_p95 and row['fps'] >= min_fps)


def apply_budget(row, device, tier, max_tris, max_draws):
    row['budgetPass'] = (row['tier'] == tier and row['budgetSamples'] > 0
                         and row['triangles'] is not None and row['triangles'] <= max_tris
                         and row['drawCalls'] is not None and row['drawCalls'] <= max_draws)
    row['pass'] = verdict(row, device) and row['budgetPass']
    return row


def capture(page, label, dwell_ms, walk_key=None, walk_ms=0):
    start = page.evaluate('performance.now()')
    page.wait_for_timeout(dwell_ms)
    if walk_key:
        page.keyboard.down(walk_key)
        page.wait_for_timeout(walk_ms)
        page.keyboard.up(walk_key)
        page.wait_for_timeout(400)
    report = page.evaluate(REPORT, start)
    return {'stop': label, **stats(report.pop('gaps')), **report}


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


def run_tier(browser, args, tier):
    device = args.device or ('phone' if (args.width or (393 if tier == 'low' else 1920)) < 500 else 'desktop')
    default_width, default_height, target, max_p95, min_fps = DEVICES[device]
    default_tris, default_draws = TIERS[tier]
    width = args.width or default_width
    height = args.height or default_height
    max_tris = args.max_tris or default_tris
    max_draws = args.max_draws or default_draws
    touch = device != 'desktop'
    context = browser.new_context(viewport={'width': width, 'height': height},
                                  device_scale_factor=2 if touch else 1,
                                  has_touch=touch, is_mobile=touch, service_workers='block')
    try:
        context.add_init_script(INIT % tier)
        page = context.new_page()
        page.goto(args.url, wait_until='domcontentloaded')
        page.locator('#arrival-walk').click()
        page.wait_for_function("""tier => window.__mall?.ready && window.__sceneReady &&
                               document.querySelector('#app-loader').hidden &&
                               window.__mall.state.graphics.quality?.tier === tier""",
                               arg=tier, timeout=180000)
        page.wait_for_function("""tier => {
          const {interiors, signage} = window.__mall.performanceReport();
          const preload = window.__mall.state.modelPreload;
          return interiors.tier === tier && interiors.preinstalled.shops === 17 &&
            signage.tier === tier && preload && preload.settled === preload.total;
        }""", arg=tier, polling=500, timeout=180000)
        page.locator('#scene').focus()
        page.wait_for_timeout(3000)
        rows = []
        for lap in range(1, args.laps + 1):
            rows.extend(apply_budget(row, device, tier, max_tris, max_draws) for row in run_lap(page, lap))
    finally:
        context.close()
    print(f"{'stop':26} fps   p95   p99   max  slow draw    tris scale  budget  result")
    for row in rows:
        row.update(requestedTier=tier, requestedDevice=device, maxTriangles=max_tris, maxDrawCalls=max_draws)
        print(f"{row['stop']:26} {row.get('fps', 0):5.1f} {row.get('p95', 0):5.1f} {row.get('p99', 0):5.1f} "
              f"{row.get('max', 0):6.1f} {row.get('slow50', 0):3} {row['drawCalls'] or 0:4} "
              f"{row['triangles'] or 0:7}  {row['renderScale']:4.0%}  {'ok' if row['budgetPass'] else 'FAIL':6}  "
              f"{'ok' if row['pass'] else 'FAIL'}")
    budget_passes = sum(row['budgetPass'] for row in rows)
    passes = sum(row['pass'] for row in rows)
    print(f"{device} {tier} {width}x{height} (target {target} FPS, p95 <= {max_p95} ms, mean >= {min_fps} FPS): "
          f"{passes}/{len(rows)} stops pass, "
          f"{budget_passes}/{len(rows)} within {max_tris:,} tris / {max_draws} draws", flush=True)
    return rows


def positive_int(value):
    result = int(value)
    if result < 1:
        raise argparse.ArgumentTypeError('must be positive')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8830/demos/corporate/gjh/v11/')
    parser.add_argument('--tier', default='balanced', choices=[*TIERS, 'all'])
    parser.add_argument('--device', choices=DEVICES, help='Set the viewport, render target and cadence thresholds')
    parser.add_argument('--width', type=positive_int, help='Override the viewport width for a single tier')
    parser.add_argument('--height', type=positive_int, help='Override the viewport height for a single tier')
    parser.add_argument('--max-tris', type=positive_int, help='Override the triangle budget for the selected tiers')
    parser.add_argument('--max-draws', type=positive_int, help='Override the draw-call budget for the selected tiers')
    parser.add_argument('--laps', type=positive_int, default=2)
    parser.add_argument('--json', default='')
    args = parser.parse_args()
    if args.tier == 'all' and (args.width or args.height):
        parser.error('--tier all uses the preset viewport for each tier')
    tiers = TIERS if args.tier == 'all' else [args.tier]
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        # Use the native Windows ANGLE backend on the owner's laptop.
        launch_args = ['--use-angle=metal'] if platform.system() == 'Darwin' else []
        browser = playwright.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME'),
                                             headless=False, args=launch_args)
        try:
            rows = [row for tier in tiers for row in run_tier(browser, args, tier)]
        finally:
            browser.close()
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as handle:
            json.dump(rows, handle, indent=1)
    return int(any(not row['pass'] for row in rows))


if __name__ == '__main__':
    sys.exit(main())
