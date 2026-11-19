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
from mall_browser_probe import enter, launch, assert_teleport
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
    targetFps:report.targetFps, refreshHz:report.refreshHz, deviceClass:report.deviceClass,
    ...mallProbe.read(start, __mall.state.graphics.sceneId), tierDowngrades:report.tierDowngrades};
}"""


def stats(gaps):
    values = sorted(gaps)
    if not values:
        return {'frames': 0}
    pick = lambda q: values[math.ceil(len(values) * q) - 1]
    mean = sum(values) / len(values)
    return {'frames': len(values), 'meanMs': mean, 'fps': 1000 / mean, 'p95': pick(.95),
            'p99': pick(.99), 'max': values[-1],
            'slow50': sum(1 for v in values if v >= 50)}


def cadence(device, refresh):
    _, _, target, max_p95, min_fps = DEVICES[device]
    if device != 'phone' and refresh and refresh < target:
        return refresh, 1000 / refresh * 1.2, refresh * .95
    return target, max_p95, min_fps


def verdict(row, device):
    target, max_p95, min_fps = cadence(device, row['referenceHz'])
    row.update(requiredFps=min_fps, maxP95Ms=max_p95)
    correct_cap = device != 'phone' or row['targetFps'] <= target + .1
    return (correct_cap and row['deviceClass'] == device and row['targetFps'] >= min_fps
            and row['frames'] > 20 and row['p95'] <= max_p95 and row['fps'] >= min_fps)


def apply_budget(row, device, tier, max_tris, max_draws):
    row['budgetPass'] = (row['tier'] == tier and row['budgetSamples'] > 0
                         and row['triangles'] is not None and row['triangles'] <= max_tris
                         and row['drawCalls'] is not None and row['drawCalls'] <= max_draws)
    row['pass'] = verdict(row, device) and row['budgetPass']
    return row


def capture(page, label, dwell_ms, walk_key=None, walk_ms=0, draw_owners=False):
    start = page.evaluate('owners => { mallProbe.startOwners(owners, __mall.state.graphics.sceneId); '
                          'mallProbe.timing = true; return performance.now(); }',
                          draw_owners)
    page.wait_for_timeout(dwell_ms)
    if walk_key:
        page.keyboard.down(walk_key)
        page.wait_for_timeout(walk_ms)
        page.keyboard.up(walk_key)
        page.wait_for_timeout(400)
    report = page.evaluate(REPORT, start)
    page.evaluate('() => { mallProbe.timing = false; mallProbe.startOwners(false); }')
    return {'stop': label, **stats(report.pop('gaps')), **report}


def run_lap(page, lap, draw_owners=False):
    rows = []
    for zone in ZONES:
        assert_teleport(page, zone)
        page.wait_for_timeout(300)
        row = capture(page, f'L{lap} {zone}', 1500, 'w', 1500, draw_owners and zone == 'entry')
        rows.append(row)
    # Walk around the shaft and verify the arrival before sampling.
    reach_upper(page)
    rows.append(capture(page, f'L{lap} upper-level', 2500, 'w', 1200, draw_owners))
    return rows


def reach_upper(page):
    assert_teleport(page, 'atrium')
    for waypoint in ([2, 18], [-8, 18], [-8, 10], [-6.4, 10]):
        page.evaluate(WALK, waypoint)
    if page.evaluate('__mall.state.elevator.docked !== 0'):
        page.locator('#inspect').click()
        page.wait_for_function('__mall.state.elevator.docked === 0', timeout=20000)
    page.locator('#inspect').click()
    page.wait_for_function("__mall.state.zone === 'upper' && !__mall.state.elevatorTravel", timeout=20000)
    page.locator('#scene').focus()


def native_refresh(context):
    # Calibrate before loading the mall so scene load cannot lower its own gate.
    blank = context.new_page()
    try:
        blank.bring_to_front()
        return blank.evaluate("""() => new Promise(resolve => {
          const times = [];
          function sample(at) {
            times.push(at);
            if (times.length < 62) return requestAnimationFrame(sample);
            const gaps = times.slice(2).map((v,i) => v-times[i+1]).sort((a,b) => a-b);
            resolve(Math.round(1000 / ((gaps[29]+gaps[30])/2)));
          }
          requestAnimationFrame(sample);
        })""")
    finally:
        blank.close()


def run_tier(browser, args, tier, dsf=None):
    device = args.device or ('phone' if (args.width or (393 if tier == 'low' else 1920)) < 500 else 'desktop')
    default_width, default_height = DEVICES[device][:2]
    default_tris, default_draws = TIERS[tier]
    width = args.width or default_width
    height = args.height or default_height
    max_tris = args.max_tris or default_tris
    max_draws = args.max_draws or default_draws
    touch = device != 'desktop'
    context = browser.new_context(viewport={'width': width, 'height': height},
                                  device_scale_factor=dsf or (2 if touch else 1),
                                  has_touch=touch, is_mobile=touch, service_workers='block')
    try:
        reference_hz = args.refresh_hz or native_refresh(context)
        page = enter(context, args.url, tier, observe=True, throttle=args.cpu_throttle)
        page.wait_for_timeout(3000)
        rows = []
        for lap in range(1, args.laps + 1):
            for row in run_lap(page, lap, args.draw_owners):
                row.update(referenceHz=reference_hz, dsf=dsf or (2 if touch else 1),
                           cpuThrottle=args.cpu_throttle)
                rows.append(apply_budget(row, device, tier, max_tris, max_draws))
    finally:
        context.close()
    print(f"{'stop':26} fps   p95   p99   max  slow draw    tris scale  budget  result")
    for row in rows:
        row.update(requestedTier=tier, requestedDevice=device, maxTriangles=max_tris, maxDrawCalls=max_draws)
        print(f"{row['stop']:26} {row.get('fps', 0):5.1f} {row.get('p95', 0):5.1f} {row.get('p99', 0):5.1f} "
              f"{row.get('max', 0):6.1f} {row.get('slow50', 0):3} {row['drawCalls'] or 0:4} "
              f"{row['triangles'] or 0:7}  {row['renderScale']:4.0%}  {'ok' if row['budgetPass'] else 'FAIL':6}  "
              f"{'ok' if row['pass'] else 'FAIL'}")
        if row.get('drawOwners'):
            print('  ' + ', '.join(f"{owner['name']} #{owner['id']} ({owner['calls']})" for owner in row['drawOwners']))
    target, max_p95, min_fps = cadence(device, rows[-1]['referenceHz'])
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
    parser.add_argument('--tier', default=None, choices=[*TIERS, 'all'])
    parser.add_argument('--device', choices=DEVICES, help='Set the viewport, render target and cadence thresholds')
    parser.add_argument('--width', type=positive_int, help='Override the viewport width for a single tier')
    parser.add_argument('--height', type=positive_int, help='Override the viewport height for a single tier')
    parser.add_argument('--max-tris', type=positive_int, help='Override the triangle budget for the selected tiers')
    parser.add_argument('--max-draws', type=positive_int, help='Override the draw-call budget for the selected tiers')
    parser.add_argument('--laps', type=positive_int, default=2)
    parser.add_argument('--json', default='')
    parser.add_argument('--draw-owners', action='store_true', help='Profile draw owners at entry and upper level')
    parser.add_argument('--refresh-hz', type=float, help='Known native refresh; overrides the detected reference')
    parser.add_argument('--cpu-throttle', type=positive_int, default=1)
    parser.add_argument('--dsf', type=int, choices=(2, 3), help='Compare a DSF 1 run with this DSF')
    args = parser.parse_args()
    args.tier = args.tier or ('low' if args.device == 'phone' else 'balanced')
    if args.refresh_hz is not None and (not math.isfinite(args.refresh_hz) or args.refresh_hz <= 0):
        parser.error('--refresh-hz must be finite and positive')
    if args.tier == 'all' and (args.width or args.height):
        parser.error('--tier all uses the preset viewport for each tier')
    tiers = TIERS if args.tier == 'all' else [args.tier]
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = launch(playwright)
        try:
            rows = []
            for tier in tiers:
                first = run_tier(browser, args, tier, 1 if args.dsf else None)
                rows.extend(first)
                if args.dsf:
                    second = run_tier(browser, args, tier, args.dsf)
                    rows.extend(second)
                    for low, high in zip(first, second, strict=True):
                        if low.get('frames') and high.get('frames'):
                            slope = (high['meanMs'] - low['meanMs']) / (args.dsf - 1)
                            high['msPerDsf'] = slope
                            print(f"{tier} {high['stop']}: {slope:+.3f} ms/frame per DSF")
        finally:
            browser.close()
    if args.json:
        with open(args.json, 'w', encoding='utf-8') as handle:
            json.dump(rows, handle, indent=1)
    return int(any(not row['pass'] for row in rows))


if __name__ == '__main__':
    sys.exit(main())
