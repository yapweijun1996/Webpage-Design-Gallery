"""Measure cold GJH walk entry with Playwright and headed Chrome.

Start a server from the repository root, for example python -m http.server 8874.
Pass --url for a deployed HTTP/2 origin and --baseline for a separate baseline
checkout. Keep the device, server encoding and Chrome settings the same.
"""
import argparse
import json
import os
from collections import defaultdict

PROFILES = {
    'local': (0, -1),
    'slow3g': (400, 1600),
    'fast3g': (150, 9000),
    '4g': (40, 20000),
}
TIERS = ('low', 'balanced', 'detailed')


def measure(browser, url, profile, tier, device, timeout):
    phone = device == 'phone'
    context = browser.new_context(
        viewport={'width': 393, 'height': 700} if phone else {'width': 1366, 'height': 900},
        device_scale_factor=2 if phone else 1, has_touch=phone, is_mobile=phone,
        service_workers='block',
    )
    try:
        context.add_init_script(f"""
            localStorage.setItem('gjh-v11-graphics-quality-v1', {json.dumps(tier)});
            localStorage.setItem('gjh-v11-tutorial-v1', 'dismissed');
            window.__loadProbe = {{}};
            new MutationObserver(() => {{
                const probe = window.__loadProbe;
                const enter = document.getElementById('loader-enter-now');
                const loader = document.getElementById('app-loader');
                if (enter && !enter.hidden && !loader.hidden) probe.enter ??= performance.now();
                if (loader?.hidden && window.__sceneReady) probe.playable ??= performance.now();
            }}).observe(document, {{subtree:true, childList:true, attributes:true, attributeFilter:['hidden']}});
        """)
        page = context.new_page()
        cdp = context.new_cdp_session(page)
        cdp.send('Network.enable')
        requests, chunks, completed, lengths = {}, defaultdict(list), {}, {}
        cdp.on('Network.requestWillBeSent', lambda e: requests.setdefault(
            e['requestId'], (e['wallTime'], e['timestamp'], e['request']['url'])))
        cdp.on('Network.dataReceived', lambda e: chunks[e['requestId']].append(
            (e['timestamp'], max(0, e.get('encodedDataLength', 0)))))
        cdp.on('Network.loadingFinished', lambda e: completed.__setitem__(e['requestId'], e['timestamp']))
        cdp.on('Network.responseReceived', lambda e: lengths.__setitem__(e['requestId'], next(
            (int(v) for k, v in e['response']['headers'].items()
             if k.lower() == 'content-length' and str(v).isdigit()), 0)
            if not e['response'].get('fromDiskCache') and e['response']['status'] == 200 else 0))
        latency, rate = PROFILES[profile]
        if rate > 0:
            cdp.send('Network.emulateNetworkConditions', {
                'offline': False, 'latency': latency, 'downloadThroughput': rate * 1000 / 8,
                'uploadThroughput': rate * 1000 / 8 / 4,
            })
        page.goto(url, wait_until='domcontentloaded', timeout=timeout)
        if not url.endswith(('#experience', '#scene')):
            page.locator('#arrival-walk').click(timeout=timeout)
        page.wait_for_function('window.__loadProbe.enter || window.__loadProbe.playable || window.mallLoader?.snapshot().failed',
                               timeout=timeout)
        if page.locator('#loader-enter-now').is_visible():
            page.locator('#loader-enter-now').evaluate('(button) => button.click()')
        page.wait_for_function('window.__loadProbe.playable || window.mallLoader?.snapshot().failed', timeout=timeout)
        result = page.evaluate("""() => ({
            ...window.__loadProbe, origin:performance.timeOrigin / 1000,
            failure:window.mallLoader?.snapshot().failed || undefined,
            protocol:performance.getEntriesByType('navigation')[0]?.nextHopProtocol,
        })""")

        def snapshot(ms):
            if ms is None:
                return None
            end = result['origin'] + ms / 1000
            by_url = defaultdict(int)
            count = 0
            for request_id, (wall, monotonic, request_url) in requests.items():
                if wall > end or not request_url.startswith(('http://', 'https://')):
                    continue
                count += 1
                cutoff = monotonic + end - wall
                transferred = sum(size for at, size in chunks[request_id] if at <= cutoff)
                if not transferred and chunks[request_id] and completed.get(request_id, float('inf')) <= cutoff:
                    transferred = lengths.get(request_id, 0)
                by_url[request_url] += transferred
            return {'seconds': round(ms / 1000, 3), 'bytes': sum(by_url.values()), 'requests': count}

        return {'profile': profile, 'tier': tier, 'device': device, 'protocol': result['protocol'],
                'enterNow': snapshot(result.get('enter')), 'playable': snapshot(result.get('playable')),
                'failure': result.get('failure')}
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8874/demos/corporate/gjh/v11/')
    parser.add_argument('--baseline', help='Optional URL serving the baseline checkout')
    parser.add_argument('--profile', nargs='+', choices=PROFILES, default=list(PROFILES))
    parser.add_argument('--tier', nargs='+', choices=TIERS, default=list(TIERS))
    parser.add_argument('--device', nargs='+', choices=('phone', 'desktop'), default=['phone', 'desktop'])
    parser.add_argument('--timeout', type=int, default=180_000, help='Timeout per wait in milliseconds')
    parser.add_argument('--headless', action='store_true')
    parser.add_argument('--chrome', default=os.environ.get('GALLERY_CHROME'))
    parser.add_argument('--chrome-arg', action='append', default=[])
    args = parser.parse_args()

    from playwright.sync_api import Error, sync_playwright

    failed = False
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chrome, headless=args.headless,
                                              args=args.chrome_arg)
        try:
            for label, url in (('before', args.baseline), ('after', args.url)):
                if not url:
                    continue
                for profile in args.profile:
                    for device in args.device:
                        for tier in args.tier:
                            try:
                                result = measure(browser, url, profile, tier, device, args.timeout)
                            except Error as error:
                                result = {'profile': profile, 'tier': tier, 'device': device,
                                          'failure': str(error).splitlines()[0]}
                            failed |= bool(result.get('failure'))
                            print(json.dumps({'build': label, **result}), flush=True)
        finally:
            browser.close()
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main())
