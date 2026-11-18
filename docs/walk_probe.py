"""Headed Chrome/Metal cold-entry walk. Serve the checkout on localhost:8811."""
import argparse
import json
import math
import os
import sys
from pathlib import Path



ROUTE = [('entry', 2500), ('atrium', 2500), ('mili', 2500),
         ('newmoon', 2500), ('gogo', 2500), ('atrium', 2000)]


def walk(page, label, tier):
    requested_kit = []
    page.on('request', lambda r: requested_kit.append(r.url.rsplit('/',1)[-1])
            if '/signage/models/' in r.url and r.url.endswith('.glb') else None)
    page.goto('http://localhost:8811/demos/corporate/gjh/v11/', wait_until='domcontentloaded')
    page.evaluate("""() => {
      const overlay = document.querySelector('#app-loader');
      const observer = new MutationObserver(() => {
        if (overlay.hidden && window.mallLoader?.snapshot().ready) {
          window.walkStart = performance.now();
          const raf = window.walkRaf = {maxMs:0, slow:[], interrupted:false};
          let previous;
          function sample(at) {
            if (previous === undefined) window.firstWalkFrameMs = performance.now() - window.walkStart;
            else {
              const dt = at - previous;
              raf.maxMs = Math.max(raf.maxMs, dt);
              if (dt >= 50) raf.slow.push({at,frameMs:dt,reason:'observed-raf-gap'});
            }
            previous = at;
            requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
          window.addEventListener('blur', () => { raf.interrupted=true; }, {once:true});
          document.addEventListener('visibilitychange', () => { if(document.hidden)raf.interrupted=true; });
          window.entrySigns = __mall.performanceReport().signage;
          observer.disconnect();
        }
      });
      observer.observe(overlay, {attributes:true, attributeFilter:['hidden']});
    }""")
    page.evaluate("""() => {
      performance.setResourceTimingBufferSize(4096);
      new MutationObserver(() => {
        if (!window.warmStart && mallLoader.snapshot().stage === 'warm') window.warmStart=performance.now();
      }).observe(document.querySelector('#loader-progress'), {attributes:true});
    }""")
    page.evaluate("document.querySelector('#arrival-walk').addEventListener('click', () => window.entryAt=performance.now(), {once:true})")
    page.locator('#arrival-walk').click()
    page.wait_for_function('window.walkStart && window.__mall?.ready && window.__sceneReady', timeout=90000)
    page.locator('#scene').focus()
    frames, events = {}, {}

    def collect():
        report = page.evaluate("""() => {
          const r = __mall.performanceReport();
          return {history:r.history, slow:r.slowFrames, raf:window.walkRaf, warm:r.warm, uploads:r.uploads,
            signage:r.signage, entrySigns:window.entrySigns, entryMs:window.walkStart-window.entryAt,
            warmToHideMs:window.walkStart-window.warmStart,
            kitDuringWarm:performance.getEntriesByType('resource').filter(e=>e.name.includes('/signage/models/')
              && e.name.endsWith('.glb') && e.startTime>=window.warmStart && e.responseEnd<=window.walkStart).length,
            start:window.walkStart, firstFrameMs:window.firstWalkFrameMs,
            tier:r.graphics.tier, visible:!document.hidden && document.hasFocus()};
        }""")
        assert report['visible'] and not report['raf']['interrupted'], 'Foreground observation interrupted'
        assert report['tier'] == tier, report['tier']
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
    for frame in result['raf']['slow']:
        slow.setdefault(frame['at'], frame)
    first = result['firstFrameMs']
    if first >= 50:
        slow['loader-hide'] = {'reason':'loader-hide-to-raf', 'frameMs':first}
    warm = result['warm']
    maximum = max(first, intervals[-1], result['raf']['maxMs'], *(f['frameMs'] for f in slow.values()))
    print(json.dumps({'run':label, 'tier':result['tier'], 'samples':len(intervals),
                      'fps':round(1000 * len(intervals) / sum(intervals), 1),
                      'p95Ms':intervals[math.ceil(.95 * len(intervals)) - 1],
                      'p99Ms':intervals[math.ceil(.99 * len(intervals)) - 1],
                      'firstFrameMs':first, 'maxMs':maximum,
                      'slow>=50':len(slow), 'slowFrames':list(slow.values()), 'warm':warm,
                      'uploads':result['uploads'], 'signage':result['signage'],
                      'entryToHideMs':result['entryMs'], 'warmToHideMs':result['warmToHideMs'],
                      'kitRequests':len(requested_kit),
                      'kitDuringWarm':result['kitDuringWarm']}, ensure_ascii=False), flush=True)
    manifest = Path(__file__).resolve().parents[1] / 'demos/corporate/gjh/v11/assets/signage/models/manifest.json'
    expected = [] if tier == 'low' else [asset['file'] for asset in json.loads(manifest.read_text())['assets']]
    signage = result['signage']
    return (not slow and maximum < 40 and not warm['skipped'] and warm['reason'] == 'complete'
            and warm['ms'] < 6000 and 0 < result['warmToHideMs'] < 6000
            and warm['probes'] >= (20 if tier == 'low' else 23) and signage['tier'] == tier
            and sorted(requested_kit) == sorted(expected) and result['entrySigns']['tier'] == tier
            and result['kitDuringWarm'] == result['entrySigns']['modelsLoaded'] == len(expected)
            and (tier != 'low' or signage['textureMB'] <= 11.2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('label', nargs='?', default='cold-walk')
    parser.add_argument('--tier', choices=['low','balanced','detailed'], default='low')
    args = parser.parse_args()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ['GALLERY_CHROME'],
                                             headless=False, args=['--use-angle=metal'])
        try:
            context = browser.new_context(viewport={'width':393, 'height':612}, device_scale_factor=3,
                                          has_touch=True, is_mobile=True)
            context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
            context.add_init_script(f"localStorage.setItem('gjh-v11-graphics-quality-v1',{json.dumps(args.tier)})")
            return walk(context.new_page(), args.label, args.tier)
        finally:
            browser.close()


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
