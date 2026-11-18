"""Headed Chrome/Metal cold-entry walk. Serve the checkout on localhost:8811."""
import json
import math
import os
import sys

from playwright.sync_api import sync_playwright


ROUTE = [('entry', 2500), ('atrium', 2500), ('mili', 2500),
         ('newmoon', 2500), ('gogo', 2500), ('atrium', 2000)]


def walk(page, label):
    page.goto('http://localhost:8811/demos/corporate/gjh/v11/', wait_until='domcontentloaded')
    page.evaluate("""() => {
      const overlay = document.querySelector('#app-loader');
      const observer = new MutationObserver(() => {
        if (overlay.hidden && window.mallLoader?.snapshot().ready) {
          window.walkStart = performance.now();
          requestAnimationFrame(() => { window.firstWalkFrameMs = performance.now() - window.walkStart; });
          observer.disconnect();
        }
      });
      observer.observe(overlay, {attributes:true, attributeFilter:['hidden']});
    }""")
    page.locator('#arrival-walk').click()
    page.wait_for_function('window.walkStart && window.__mall?.ready && window.__sceneReady', timeout=90000)
    page.locator('#scene').focus()
    frames, events = {}, {}

    def collect():
        report = page.evaluate("""() => {
          const r = __mall.performanceReport();
          return {history:r.history, slow:r.slowFrames, warm:r.warm, uploads:r.uploads,
            start:window.walkStart, firstFrameMs:window.firstWalkFrameMs,
            tier:r.graphics.tier, visible:!document.hidden && document.hasFocus()};
        }""")
        assert report['visible'] and report['tier'] == 'low', report['tier']
        fresh = [f for f in report['history'] if f['at'] >= report['start']]
        assert fresh, 'No live walking RAF samples'
        if frames:
            assert any(f['at'] in frames for f in fresh), 'Lost overlap with five-second history'
            assert fresh[-1]['at'] > max(frames), 'RAF sampling stopped'
        frames.update((f['at'], f) for f in fresh)
        events.update((f['at'], f) for f in report['slow'] if f['at'] >= report['start'])
        return report

    page.wait_for_timeout(1500)
    collect()
    for zone, duration in ROUTE:
        assert page.evaluate('zone => __mall.teleport(zone)', zone), zone
        origin = page.evaluate('() => {const {x,z} = __mall.state; return [x,z]}')
        # setInput() switches to manual simulation and suspends live RAF metrics.
        page.keyboard.down('w')
        try:
            page.wait_for_timeout(duration)
        finally:
            page.keyboard.up('w')
        result = collect()
        position = page.evaluate('() => {const {x,z} = __mall.state; return [x,z]}')
        assert math.dist(origin, position) > .05, f'Walk did not advance at {zone}'

    intervals = sorted(f['frameMs'] for f in frames.values())
    slow = {at: f for at, f in {**frames, **events}.items() if (f['frameMs'] or 0) >= 50}
    first = result['firstFrameMs']
    if first >= 50:
        slow['loader-hide'] = {'reason':'loader-hide-to-raf', 'frameMs':first}
    warm = result['warm']
    print(json.dumps({'run':label, 'tier':result['tier'], 'samples':len(intervals),
                      'fps':round(1000 * len(intervals) / sum(intervals), 1),
                      'p95Ms':intervals[math.ceil(.95 * len(intervals)) - 1],
                      'p99Ms':intervals[math.ceil(.99 * len(intervals)) - 1],
                      'firstFrameMs':first, 'maxMs':max(first, intervals[-1]),
                      'slow>=50':len(slow), 'slowFrames':list(slow.values()), 'warm':warm,
                      'uploads':result['uploads']}, ensure_ascii=False), flush=True)
    return not slow and not warm['skipped'] and warm['reason'] == 'complete' and warm['probes'] >= 20


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                                             headless=False, args=['--use-angle=metal'])
        try:
            context = browser.new_context(viewport={'width':393, 'height':612}, device_scale_factor=3,
                                          has_touch=True, is_mobile=True)
            context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
            return walk(context.new_page(), sys.argv[1])
        finally:
            browser.close()


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
