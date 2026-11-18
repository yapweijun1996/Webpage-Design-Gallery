"""Measure three cold, headed Chrome/Metal runs through all 17 GJH V11 shops."""
import argparse
import json
import math
import os
import sys

from playwright.sync_api import Error, sync_playwright


ROUTE = ('newmoon', 'mili', 'gogo', *(f'planned-space-{i:02d}' for i in range(4, 18)))


def walk(page, url, label):
    page.goto(url, wait_until='domcontentloaded')
    page.evaluate("""() => {
      const overlay = document.querySelector('#app-loader');
      const observer = new MutationObserver(() => {
        if (overlay.hidden && window.mallLoader?.snapshot().ready) {
          const at = performance.now();
          window.interiorWalkStart = {at, interiors:__mall.performanceReport().interiors};
          requestAnimationFrame(() => { window.firstWalkFrameMs = performance.now() - at; });
          observer.disconnect();
        }
      });
      observer.observe(overlay, {attributes:true, attributeFilter:['hidden']});
    }""")
    page.locator('#arrival-walk').click()
    page.wait_for_function('window.interiorWalkStart && window.__mall?.ready && window.__sceneReady', timeout=90000)
    page.locator('#scene').focus()
    frames, events = {}, {}

    def collect():
        report = page.evaluate("""() => {
          const r = __mall.performanceReport();
          return {history:r.history, slow:r.slowFrames, warm:r.warm, uploads:r.uploads,
            start:window.interiorWalkStart, firstFrameMs:window.firstWalkFrameMs,
            tier:r.graphics.tier, viewport:r.viewport, interiors:r.interiors,
            visible:!document.hidden && document.hasFocus()};
        }""")
        assert report['visible'], 'Chrome lost visibility or focus'
        assert report['tier'] == 'low', report['tier']
        assert (report['viewport']['width'], report['viewport']['height']) == (393, 612), report['viewport']
        fresh = [f for f in report['history'] if f['at'] >= report['start']['at']]
        assert fresh, 'No live walking RAF samples'
        if frames:
            assert any(f['at'] in frames for f in fresh), 'Lost overlap with five-second history'
            assert fresh[-1]['at'] > max(frames), 'RAF sampling stopped'
        frames.update((f['at'], f) for f in fresh)
        events.update((f['at'], f) for f in report['slow'] if f['at'] >= report['start']['at'])
        return report

    def position():
        return page.evaluate('() => {const {x,z} = __mall.state; return [x,z]}')

    page.wait_for_timeout(1500)
    collect()
    entrances = []
    for zone in ROUTE:
        assert page.evaluate('zone => __mall.teleport(zone)', zone), zone
        origin = position()
        page.wait_for_timeout(3000)
        entrances.append((zone, collect()['interiors']['shops']))
        # Real keys keep the mall's live RAF and physics sampling active.
        page.keyboard.down('w')
        try:
            page.wait_for_timeout(2000)
        finally:
            page.keyboard.up('w')
        result = collect()
        assert math.dist(origin, position()) > .05, f'Walk did not advance at {zone}'

    intervals = sorted(f['frameMs'] for f in frames.values())
    slow = {at: f for at, f in {**frames, **events}.items() if (f['frameMs'] or 0) >= 50}
    first = result['firstFrameMs']
    if first >= 50:
        slow['loader-hide'] = {'reason':'loader-hide-to-raf', 'frameMs':first}
    warm = result['warm']
    preinstalled = result['start']['interiors']['preinstalled']
    longest = max(first, intervals[-1])
    passed = (not slow and longest < 40 and preinstalled['shops'] == len(ROUTE)
              and all(rendered > 0 for _, rendered in entrances)
              and not warm['skipped'] and warm['reason'] == 'complete' and warm['probes'] >= 20)
    print(json.dumps({
        'run':label, 'passed':passed, 'tier':result['tier'], 'samples':len(intervals),
        'fps':round(1000 * len(intervals) / sum(intervals), 1),
        'p95Ms':intervals[math.ceil(.95 * len(intervals)) - 1],
        'p99Ms':intervals[math.ceil(.99 * len(intervals)) - 1], 'firstFrameMs':first,
        'maxMs':longest, 'slow>=50':len(slow), 'slowFrames':list(slow.values()),
        'interiorsAtLoaderHide':result['start']['interiors'], 'interiors':result['interiors'],
        'entrances':entrances, 'warm':warm, 'uploads':result['uploads'],
    }), flush=True)
    return passed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8811/demos/corporate/gjh/v11/')
    args = parser.parse_args()
    results = []
    with sync_playwright() as playwright:
        for label in range(1, 4):
            browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                                                 headless=False, args=['--use-angle=metal'])
            try:
                context = browser.new_context(viewport={'width':393, 'height':612}, device_scale_factor=3,
                                              has_touch=True, is_mobile=True, service_workers='block')
                context.add_init_script("""
                  localStorage.setItem('gjh-v11-tutorial-v1','dismissed');
                  localStorage.setItem('gjh-v11-graphics-quality-v1','low');
                """)
                results.append(walk(context.new_page(), args.url, label))
            except (AssertionError, Error) as error:
                print(json.dumps({'run':label, 'passed':False, 'error':str(error)}), flush=True)
                results.append(False)
            finally:
                browser.close()
    return all(results)


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
