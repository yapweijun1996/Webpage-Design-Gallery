"""Exercise the GJH landing-page concepts in Chrome; optionally capture gallery previews."""
import argparse
import functools
import hashlib
import http.server
import os
import threading
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VERSIONS = tuple(f'v{number}' for number in range(12, 20))

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def review_task(page, version):
    if version == 'v12':
        assert page.locator('.hero .lead-link').get_attribute('href') == '#brands'
        assert page.locator('.brand-all').get_attribute('href').endswith('/explore-our-brand/')
    elif version == 'v13':
        assert page.locator('.hero .primary').get_attribute('href') == 'https://www.gjhglobal.com/contact-us/'
    elif version == 'v14':
        assert 'ai illustration' in page.locator('.hero-photo figcaption').inner_text().lower()
        assert page.locator('#story .text-link').get_attribute('href').endswith('/about-us/')
    elif version == 'v15':
        assert [link.get_attribute('href') for link in page.locator('.ticker a').all()] == [
            '#portfolio', 'https://www.gjhglobal.com/sony/', 'https://www.gjhglobal.com/borsch-med/'
        ]
    elif version == 'v16':
        assert page.locator('.hero .round-link').get_attribute('href') == '#collection'
    elif version == 'v17':
        links = page.locator('#occasions article a')
        assert [link.get_attribute('href') for link in links.all()] == [
            'https://www.gjhglobal.com/mili/', 'https://www.gjhglobal.com/newmoon/', 'https://www.gjhglobal.com/gogo/'
        ]
        url = links.nth(1).get_attribute('href')
        page.route(url, lambda route: route.fulfill(content_type='text/html', body='<title>Brand destination fixture</title>'))
        links.nth(1).focus()
        page.keyboard.press('Enter')
        page.wait_for_url(url)
        page.go_back()
        assert links.nth(1).locator('[data-last-opened]').is_visible()
    elif version == 'v18':
        for scene in ('listen', 'watch', 'play', 'connect'):
            link = page.locator(f'.channels a[href="#{scene}"]')
            link.focus()
            page.keyboard.press('Enter')
            page.wait_for_function('fragment => location.hash === fragment', arg='#' + scene)
            assert link.get_attribute('aria-current') == 'true'
            assert page.locator('.scene:visible').count() == 1
            assert page.locator(f'#{scene} a[href^="https://"]').is_visible()
        page.go_back()
        assert page.locator('#play').is_visible()
        page.reload()
        assert page.locator('#play').is_visible()
    elif version == 'v19':
        page.locator('[name="category"][value="electronics"]').check()
        page.locator('#topic').select_option('availability')
        page.locator('#prepare-brief').focus()
        page.keyboard.press('Enter')
        draft = page.locator('#brief-text')
        assert 'consumer electronics' in draft.input_value() and 'lead times' in draft.input_value()
        assert draft.evaluate('node => node === document.activeElement')
        page.locator('#select-brief').click()
        assert draft.evaluate('node => node.selectionStart === 0 && node.selectionEnd === node.value.length')
        assert page.locator('#official-contact').get_attribute('href') == 'https://www.gjh.com.sg/contact-us/'
        page.locator('#topic').select_option('partnership')
        assert page.locator('#brief-result').is_hidden() and not draft.input_value()


def run(capture=False, axe_script=None, site_root=ROOT):
    if axe_script:
        assert hashlib.sha256(axe_script.read_bytes()).hexdigest() == '880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb', 'Expected reviewed axe-core 4.10.3'
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(site_root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            chrome = os.environ.get('GALLERY_CHROME', r'C:\Program Files\Google\Chrome\Application\chrome.exe')
            browser = playwright.chromium.launch(executable_path=chrome, headless=True)
            for version in VERSIONS:
                for width, height in ((320, 800), (390, 844), (768, 1024), (1440, 900)):
                    page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
                    errors = []
                    failed_responses = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                    page.on('response', lambda response: failed_responses.append(f'{response.status} {response.url}') if response.status >= 400 and '127.0.0.1' in response.url else None)
                    response = page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/{version}/index.html', wait_until='networkidle')
                    assert response.status == 200, (version, width, response.status)
                    assert page.locator('h1').count() == 1 and page.locator('h1').is_visible(), (version, width, 'heading')
                    if version == 'v13':
                        page.evaluate('() => document.fonts.ready.then(() => true)')
                        rects = page.locator('h1').evaluate("el => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].map(rect => ({left: rect.left, right: rect.right})); }")
                        assert all(rect['left'] >= 0 and rect['right'] <= width for rect in rects), (version, width, 'clipped heading', rects)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (version, width, 'horizontal overflow')
                    page.keyboard.press('Tab')
                    assert page.evaluate("document.activeElement.getAttribute('href')") == '#main', (version, width, 'skip link')
                    page.keyboard.press('Enter')
                    assert page.evaluate("document.activeElement.id") == 'main', (version, width, 'skip focus')
                    page.evaluate("document.querySelectorAll('img').forEach(img => img.loading = 'eager')")
                    page.wait_for_function("Array.from(document.images).every(img => img.complete)")
                    broken = page.locator('img').evaluate_all('(imgs) => imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.src)')
                    assert not broken, (version, width, broken)
                    # Official artwork and the history composite must keep their original proportions.
                    artwork = {'v12': '.brand-image img', 'v13': '.image img', 'v16': '.brand-image img, .history img'}.get(version)
                    if artwork:
                        distorted = page.locator(artwork).evaluate_all("""imgs => imgs.filter(img => {
                            const box = img.getBoundingClientRect();
                            return Math.abs(box.width / box.height - img.naturalWidth / img.naturalHeight) > 0.01 || getComputedStyle(img).filter !== 'none';
                        }).map(img => img.src)""")
                        assert not distorted, (version, width, 'official artwork proportions', distorted)
                    invalid = page.locator('a[href^="#"]').evaluate_all("links => links.map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.getElementById(decodeURIComponent(h.slice(1))))")
                    assert not invalid, (version, width, invalid)
                    assert not errors, (version, width, errors)
                    assert not failed_responses, (version, width, failed_responses)
                    if axe_script and width in (390, 1440):
                        page.add_script_tag(path=str(axe_script))
                        violations = page.evaluate("""async () => (await axe.run(document, {
                            runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}
                        })).violations.map(item => ({id: item.id, targets: item.nodes.map(node => node.target)}))""")
                        assert not violations, (version, width, violations)
                    if capture and width in (390, 768, 1440):
                        # The skip-link check focuses main; do not capture its focus outline in previews.
                        page.evaluate('document.activeElement.blur(); scrollTo(0, 0)')
                        target = ROOT / 'demos/corporate/gjh' / version
                        (target / 'screenshots').mkdir(exist_ok=True)
                        page.screenshot(path=str(target / 'screenshots' / f'{width}.png'), full_page=True)
                        if width == 1440:
                            with TemporaryDirectory() as temp:
                                frame = Path(temp) / 'frame.png'
                                page.screenshot(path=str(frame))
                                with Image.open(frame) as im:
                                    im.convert('RGB').resize((720, 450), Image.Resampling.LANCZOS).save(target / 'assets/thumbnail.webp', 'WEBP', quality=82)
                    if version == 'v16' and width <= 768:
                        toggle = page.locator('.menu-toggle')
                        toggle.click()
                        assert toggle.get_attribute('aria-expanded') == 'true' and page.locator('#navigation a').first.is_visible()
                        page.keyboard.press('Escape')
                        assert toggle.get_attribute('aria-expanded') == 'false' and toggle.evaluate('(el) => document.activeElement === el')
                    action = page.locator('main a[href^="#"]').first
                    destination = action.get_attribute('href')
                    action.click()
                    assert page.evaluate('location.hash') == destination, (version, width, 'primary action')
                    assert page.locator(destination).is_visible(), (version, width, 'action destination')
                    review_task(page, version)
                    assert not errors and not failed_responses, (version, width, errors, failed_responses)
                    print(f'{version} {width}px PASS', flush=True)
                    page.close()
                if version == 'v13':
                    for width in (370, 371):
                        page = browser.new_page(viewport={'width': width, 'height': 844})
                        page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/{version}/index.html', wait_until='networkidle')
                        page.evaluate('() => document.fonts.ready.then(() => true)')
                        rects = page.locator('h1').evaluate("el => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].map(rect => ({left: rect.left, right: rect.right})); }")
                        assert all(rect['left'] >= 0 and rect['right'] <= width for rect in rects), (version, width, 'clipped heading', rects)
                        page.close()
                for width in (320, 390):
                    context = browser.new_context(viewport={'width': width, 'height': 844}, java_script_enabled=False)
                    page = context.new_page()
                    page.goto(f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/{version}/index.html')
                    assert page.locator('h1').is_visible(), (version, width, 'no JavaScript heading')
                    assert page.locator('nav a').first.is_visible(), (version, width, 'no JavaScript navigation')
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (version, width, 'no JavaScript overflow')
                    if version == 'v17':
                        assert all(link.is_visible() for link in page.locator('#occasions article a').all())
                    elif version == 'v18':
                        assert page.locator('.scene:visible').count() == 4
                    elif version == 'v19':
                        assert page.locator('#fallback-contact').is_visible()
                        assert page.locator('#fallback-contact').get_attribute('href').endswith('/contact-us/')
                    context.close()
            browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--capture', action='store_true')
    parser.add_argument('--axe-script', type=Path, help='Reviewed axe-core 4.10.3 bundle')
    parser.add_argument('--site-root', type=Path, default=ROOT, help='Serve a generated Pages artifact or source tree')
    args = parser.parse_args()
    run(args.capture, args.axe_script, args.site_root.resolve())
