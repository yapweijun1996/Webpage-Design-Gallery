"""Real Chrome checks for persisted appearance, localization and offline language packs."""
import functools
import http.server
import importlib.util
import json
import os
import platform
import re
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('build_gallery', ROOT / 'scripts/build_gallery.py')
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if getattr(self.server, 'stall_locale', False) and self.path.endswith('/locales/zh-Hans.json'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', '100')
            self.end_headers()
            time.sleep(6)
            return
        super().do_GET()


def contrast(first, second):
    def luminance(color):
        channels = [int(value) / 255 for value in re.findall(r"\d+", color)[:3]]
        linear = [value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in channels]
        return sum(value * weight for value, weight in zip(linear, (.2126, .7152, .0722)))
    a, b = sorted((luminance(first), luminance(second)))
    return (b + .05) / (a + .05)


def run():
    packs = {code: json.loads((ROOT / f'locales/{code}.json').read_text()) for code in ('en', 'zh-Hans', 'ms')}
    for pack in packs.values():
        for kind in ('messages', 'patterns'):
            assert pack[kind].keys() == packs['en'][kind].keys(), 'Translation keys incomplete'
            for key, value in pack[kind].items():
                assert value and sorted(re.findall(r'\{\w+\}', key)) == sorted(re.findall(r'\{\w+\}', value)), key
    screenshots = ROOT / 'docs/screenshots/preferences'
    screenshots.mkdir(parents=True, exist_ok=True)
    checks = []
    added = [ROOT / "src/preferences-boot.js", ROOT / "src/preferences.js", *sorted((ROOT / "locales").glob("*.json"))]
    assert sum(path.stat().st_size for path in added) <= 80000, "Preference payload budget exceeded"
    with tempfile.TemporaryDirectory(prefix='gallery-preferences-') as temporary:
        output = Path(temporary) / 'Webpage-Design-Gallery'
        gallery.build(output)
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/'
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), headless=True)
                context = browser.new_context(service_workers='block', reduced_motion='reduce')
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                for width in (1440, 768, 390, 320):
                    page.set_viewport_size({'width': width, 'height': 1000 if width > 650 else 844})
                    for lang in packs:
                        for theme in ('light', 'dark'):
                            page.goto(base, wait_until='networkidle')
                            page.wait_for_selector('html[data-preferences-ready="true"]')
                            page.select_option('#language-select', lang)
                            page.select_option('#theme-select', theme)
                            page.wait_for_function('([lang, theme]) => document.documentElement.lang === lang && document.documentElement.dataset.theme === theme', arg=[lang, theme])
                            assert page.locator('h2').first.inner_text().startswith(packs[lang]['messages']['Companies'])
                            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, lang, theme)
                            assert page.locator('#theme-select').evaluate('(e)=>e.getBoundingClientRect().height >= 44')
                            colors = page.evaluate("""() => ({ background:getComputedStyle(document.body).backgroundColor, text:getComputedStyle(document.body).color, muted:getComputedStyle(document.querySelector('.intro-description')).color, border:getComputedStyle(document.querySelector('#theme-select')).borderTopColor })""")
                            assert contrast(colors['background'], colors['text']) >= 4.5
                            assert contrast(colors['background'], colors['muted']) >= 4.5
                            assert contrast(colors['background'], colors['border']) >= 3
                            assert page.locator('meta[name="theme-color"]').get_attribute('content') == page.locator('.site-header').evaluate('(e)=>getComputedStyle(e).backgroundColor')
                            if width in (1440, 390):
                                page.evaluate('window.scrollTo(0,0)')
                                page.screenshot(path=str(screenshots / f'home-{lang}-{theme}-{width}.png'), full_page=True)
                            page.locator('#company-search').fill('not-present')
                            page.wait_for_function('(message)=>document.querySelector(".empty-results h3").textContent === message', arg=packs[lang]['messages']['No matching companies'])
                            page.locator('[data-reset]').click()
                checks.append('24 responsive language/theme combinations, localized empty state, controls and text/control contrast')
                page.select_option('#theme-select', 'system')
                page.emulate_media(color_scheme='dark')
                page.wait_for_function('() => document.documentElement.dataset.theme === "dark"')
                page.emulate_media(color_scheme='light')
                page.wait_for_function('() => document.documentElement.dataset.theme === "light"')
                page.select_option('#theme-select', 'dark')
                page.reload(wait_until='networkidle')
                assert page.locator('html').get_attribute('data-theme') == 'dark'
                assert page.locator('#theme-select').input_value() == 'dark'
                page.select_option('#language-select', 'zh-Hans')
                page.locator('#company-search').fill('新加坡')
                assert page.locator('.company-card:visible').count() == 1
                page.select_option('#language-select', 'ms')
                assert page.locator('#company-search').input_value() == '新加坡'
                page.locator('#company-search').fill('')
                page.locator('.company-card').click()
                page.wait_for_selector('html[data-preferences-ready]')
                assert page.locator('html').get_attribute('lang') == 'ms'
                page.locator('input[value="v5"]').check()
                page.locator('input[value="v7"]').check()
                page.select_option('#language-select', 'zh-Hans')
                page.wait_for_function('() => document.querySelector("#selection-count").textContent.includes("已选 2")')
                assert page.locator('input[value="v5"]').is_checked()
                assert page.locator('input[value="v7"]').is_checked()
                page.locator('#compare-selected').click()
                page.wait_for_selector('.compare-panel')
                assert page.locator('html').get_attribute('lang') == 'zh-Hans'
                page.select_option('#compare-mode', 'screenshots')
                page.wait_for_function('() => document.querySelector("#compare-status").textContent.includes("截图")')
                page.goto(base + 'designs/index.html?company=gjh&design=v6', wait_until='networkidle')
                page.wait_for_selector('#detail-screenshot')
                page.wait_for_function('() => document.querySelector("h1").textContent === "现代品牌组合"')
                page.goto(base + 'designs/index.html?company=invalid', wait_until='networkidle')
                page.wait_for_function('() => document.querySelector(".error-state h2").textContent === "试试另一个方向。"')
                page.goto(base + 'offline.html', wait_until='networkidle')
                page.wait_for_selector('html[data-preferences-ready]')
                assert '网络连接' in page.locator('h1').inner_text()
                formats = page.evaluate('''async () => {
                  const p = await import(new URL('src/preferences.js', location.href));
                  return [p.formatNumber(12345), p.formatCurrency(12.5), p.formatDate(new Date('2026-11-15T00:00:00Z'), {timeZone:'Asia/Singapore', year:'numeric'})];
                }''')
                assert '12,345' in formats[0] and '12.50' in formats[1] and '2026' in formats[2]
                checks.append('System tracking, persistence, localized search, state-preserving language change, detail/compare/error/offline routes, Intl formats')
                other = context.new_page()
                other.goto(base, wait_until='networkidle')
                other.wait_for_selector('html[data-preferences-ready]')
                other.select_option('#language-select', 'en')
                page.wait_for_function('() => document.documentElement.lang === "en"')
                other.select_option('#theme-select', 'light')
                page.wait_for_function('() => document.documentElement.dataset.theme === "light"')
                page.evaluate("() => {const text=document.createElement('p'); text.id='future-name'; text.textContent='constructor'; document.body.append(text);}")
                other.select_option('#language-select', 'zh-Hans')
                page.wait_for_function('() => document.documentElement.lang === "zh-Hans"')
                assert page.locator('#future-name').text_content() == 'constructor'
                checks.append('Cross-tab preference synchronization and safe unknown message fallback')
                assert not errors, errors
                context.close()
                denied = browser.new_context(service_workers='block')
                denied.add_init_script("Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };")
                d = denied.new_page(); d.goto(base, wait_until='networkidle'); d.wait_for_selector('html[data-preferences-ready]')
                d.select_option('#theme-select', 'dark'); d.select_option('#language-select', 'ms')
                d.wait_for_function('() => document.documentElement.lang === "ms"')
                assert 'tab ini' in d.locator('#preferences-status').text_content()
                denied.close()
                fallback = browser.new_context(service_workers='block')
                fallback.route('**/locales/zh-Hans.json', lambda route: route.abort())
                f = fallback.new_page(); f.goto(base, wait_until='networkidle'); f.wait_for_selector('html[data-preferences-ready]')
                f.select_option('#language-select', 'zh-Hans')
                assert f.locator('html').get_attribute('lang') == 'en'
                assert 'Language unavailable' in f.locator('#preferences-status').inner_text()
                fallback.close()
                fallback_en = browser.new_context(service_workers='block')
                fallback_en.route('**/locales/en.json', lambda route: route.abort())
                f = fallback_en.new_page(); f.goto(base, wait_until='networkidle'); f.wait_for_selector('html[data-preferences-ready]')
                f.select_option('#language-select', 'zh-Hans')
                f.locator('#company-search').fill('not-present')
                f.wait_for_function('() => document.querySelector(".results-status").textContent.includes("匹配公司")')
                fallback_en.close()
                server.stall_locale = True
                stalled = browser.new_context(service_workers='block')
                f = stalled.new_page(); started = time.monotonic()
                f.goto(base, wait_until='domcontentloaded')
                f.wait_for_selector('html[data-preferences-ready]', timeout=8000)
                assert time.monotonic() - started < 7.5
                f.select_option('#language-select', 'zh-Hans')
                assert f.locator('html').get_attribute('lang') == 'en'
                stalled.close(); server.stall_locale = False
                checks.append('Blocked storage, missing English/Chinese packs and stalled response bodies recover to usable UI')
                offline = browser.new_context()
                o = offline.new_page(); o.goto(base, wait_until='networkidle')
                o.evaluate('navigator.serviceWorker.ready')
                o.reload(wait_until='networkidle')
                o.wait_for_function('navigator.serviceWorker.controller !== null')
                o.set_viewport_size({'width':320,'height':844})
                offline.set_offline(True)
                assert o.evaluate('fetch("missing-network-probe").then(()=>false,()=>true)')
                o.reload(wait_until='networkidle'); o.wait_for_selector('html[data-preferences-ready]')
                for lang in ('zh-Hans', 'ms', 'en'):
                    o.select_option('#language-select', lang)
                    assert o.locator('html').get_attribute('lang') == lang
                    assert o.evaluate('document.documentElement.scrollWidth <= innerWidth')
                o.select_option('#language-select', 'ms'); o.select_option('#theme-select', 'dark')
                o.goto(base + 'companies/gjh/index.html', wait_until='networkidle')
                o.wait_for_selector('html[data-preferences-ready]')
                assert o.locator('html').get_attribute('lang') == 'ms'
                assert o.locator('html').get_attribute('data-theme') == 'dark'
                assert o.locator('.design-card').count() == 8
                checks.append('Real failed network probe, offline cold reload, all cached languages and persisted dark Malay deep link')
                offline.close(); browser.close()
                evidence = {'standard':'pwa:product-standard', 'profile':'CONTENT', 'build':json.loads((output/'version.json').read_text()), 'timestamp':datetime.now(timezone.utc).isoformat(), 'os':platform.platform(), 'browser':'Chromium', 'browser_version':browser.version, 'status':'PASS', 'checks':checks, 'limitations':['Physical iOS/Android install, Safari, Firefox, Edge and screen readers NOT_RUN; field performance INSUFFICIENT_DATA']}
                (ROOT/'docs/evidence/preferences-browser.json').write_text(json.dumps(evidence, indent=2)+'\n')
                print(json.dumps(evidence, indent=2))
        finally:
            server.shutdown()


if __name__ == '__main__':
    run()
