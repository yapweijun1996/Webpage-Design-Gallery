"""Keep the homepage theme consistent across gallery routes, isolated from demos."""
import functools
import http.server
import importlib.util
import json
import os
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('build_gallery', ROOT / 'scripts/build_gallery.py')
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)
ROUTES = ('', 'companies/index.html', 'companies/gjh/index.html',
          'designs/index.html?company=gjh&design=v6',
          'compare/index.html?company=gjh&left=v5&right=v7', 'offline.html')


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass


def signature(page):
    return page.evaluate('''() => {
      const body = getComputedStyle(document.body);
      const header = getComputedStyle(document.querySelector('.site-header'));
      const symbol = getComputedStyle(document.querySelector('.identity-symbol i'));
      return [body.backgroundColor, body.color, header.backgroundColor, symbol.backgroundColor,
        ...['--page','--surface','--ink','--muted','--accent','--line','--color-surface-subtle','--color-focus','--color-action-hover'].map(key=>body.getPropertyValue(key).trim())];
    }''')


def run():
    screenshots = ROOT / 'docs/screenshots/gallery-theme'
    screenshots.mkdir(parents=True, exist_ok=True)
    evidence = []
    with tempfile.TemporaryDirectory(prefix='gallery-theme-') as temporary:
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
                for width in (1440, 768, 390):
                    page.set_viewport_size({'width': width, 'height': 900 if width == 1440 else 844})
                    for theme in ('light', 'dark'):
                        page.goto(base, wait_until='networkidle')
                        page.wait_for_selector('html[data-preferences-ready]')
                        page.select_option('#theme-select', theme)
                        expected = signature(page)
                        for route in ROUTES:
                            page.goto(base + route, wait_until='networkidle')
                            page.wait_for_selector('html[data-preferences-ready]')
                            if route.startswith('designs/'):
                                page.wait_for_selector('#detail-screenshot')
                            if route.startswith('compare/'):
                                page.wait_for_selector('.compare-panel')
                            assert signature(page) == expected, (width, theme, route, signature(page), expected)
                            assert page.locator('html').get_attribute('data-theme') == theme
                            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, theme, route)
                            assert page.locator('meta[name="theme-color"]').get_attribute('content') == expected[2]
                            if route == 'companies/gjh/index.html':
                                assert page.locator('.design-card').first.evaluate('(e)=>getComputedStyle(e).backgroundColor') == expected[0]
                                page.screenshot(path=str(screenshots / f'company-{theme}-{width}.png'))
                            if route.startswith('compare/'):
                                frame = page.locator('iframe').first
                                baseline = frame.content_frame.locator('body').evaluate('(e)=>getComputedStyle(e).backgroundColor')
                                assert frame.content_frame.locator('body.gallery').count() == 0
                                page.select_option('#theme-select', 'dark' if theme == 'light' else 'light')
                                assert frame.content_frame.locator('body').evaluate('(e)=>getComputedStyle(e).backgroundColor') == baseline
                                page.select_option('#theme-select', theme)
                        evidence.append({'width':width, 'theme':theme, 'routes':len(ROUTES), 'status':'PASS'})
                assert not errors, errors
                browser.close()
            (ROOT / 'docs/evidence/gallery-theme.json').write_text(json.dumps({'build':json.loads((output/'version.json').read_text()), 'checks':evidence, 'pageErrors':errors}, indent=2)+'\n')
            print(json.dumps(evidence, indent=2))
        finally:
            server.shutdown()


if __name__ == '__main__':
    run()
