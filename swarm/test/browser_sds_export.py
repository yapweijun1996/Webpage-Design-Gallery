#!/usr/bin/env python3
"""Exercise project catalogs and offline reloads in a real exported Swarm PWA."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_settings_skills import CHROME, SWARM


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def build(root):
    project = root / 'project'
    sections = project / 'sections'
    sections.mkdir(parents=True)
    (project / 'tokens.css').write_text(':root { --surface: white; }')
    (sections / '01-hero.css').write_text('.s-01 { background: var(--surface); }')
    (sections / '01-hero.html').write_text(
        '<section id="01-hero" class="s-01"><h1 data-i18n="hero.title">Welcome</h1>'
        '<p aria-label="Home" data-i18n-attr="aria-label:hero.region">Home</p></section>')
    (project / 'i18n').mkdir()
    catalogs = {'ms': ('Selamat datang', 'Laman utama', 'Bahasa'),
                'zh-Hans': ('欢迎', '首页', '语言')}
    for code, (title, region, _) in catalogs.items():
        (project / 'i18n' / f'{code}.json').write_text(json.dumps({
            'meta': {'lang': code}, 'messages': {'hero.title': title, 'hero.region': region}}))
    output = root / 'site' / 'example'
    subprocess.run(['node', str(SWARM / 'tools/export-page.js'), str(project), '--sds', '--out', str(output)], check=True)
    subprocess.run(['node', str(SWARM / 'tools/export-page.js'), str(project), '--sds', '--langs', 'ms',
                    '--out', str(root / 'site' / 'subset')], check=True)
    return catalogs


def verify(browser, base, catalogs, width):
    context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce')
    try:
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.goto(base)
        expect(page.get_by_role('heading')).to_have_text('Welcome')
        page.wait_for_function('navigator.serviceWorker.controller?.scriptURL === new URL("sw.js", location.href).href')
        assert page.evaluate('navigator.serviceWorker.ready.then(reg => reg.scope)') == base
        expect(page.locator('[data-sds-update-toast]')).to_be_hidden()
        context.set_offline(True)
        for lang, (title, region, language_label) in catalogs.items():
            page.locator('[data-sds-select=lang]').select_option(lang)
            expect(page.get_by_role('heading')).to_have_text(title)
            response = page.reload()
            assert response.from_service_worker and response.ok
            expect(page.get_by_role('heading')).to_have_text(title)
            expect(page.locator('main p')).to_have_attribute('aria-label', region)
            expect(page.locator('[data-i18n="sds.language"]')).to_have_text(language_label)
        page.locator('[data-sds-select=lang]').select_option('en')
        expect(page.get_by_role('heading')).to_have_text('Welcome')
        context.set_offline(False)
        page.locator('[data-sds-select=lang]').select_option('zh-Hans')
        page.goto(base + '../subset/')
        expect(page.get_by_role('heading')).to_have_text('Welcome')
        expect(page.locator('[data-sds-select=lang]')).to_have_value('en')
        assert page.evaluate('SDS.lang.list') == ['en', 'ms']
        assert not errors, errors
    finally:
        context.close()


def verify_update(browser, root, base):
    output = root / 'site' / 'update'
    shutil.copytree(root / 'site' / 'example', output)
    # SimpleHTTPRequestHandler validates If-Modified-Since to the nearest second.
    os.utime(output / 'sw.js', (1_700_000_000, 1_700_000_000))
    context = browser.new_context()
    try:
        page = context.new_page()
        page.add_init_script("sessionStorage.loads = String(Number(sessionStorage.loads || 0) + 1)")
        page.goto(base)
        page.wait_for_function('!!navigator.serviceWorker.controller')
        toast = page.locator('[data-sds-update-toast]')
        expect(toast).to_be_hidden()
        subprocess.run(['node', str(SWARM / 'tools/export-page.js'), str(root / 'project'), '--sds',
                        '--out', str(output), '--title', 'Updated export'], check=True)
        page.get_by_role('button', name='Check updates').click()
        expect(toast).to_be_visible()
        assert page.evaluate('sessionStorage.loads') == '1'
        page.get_by_role('button', name='Update now').click()
        expect(page).to_have_title('Updated export')
        expect(toast).to_be_hidden()
        assert page.evaluate('sessionStorage.loads') == '2'
    finally:
        context.close()


def main():
    with TemporaryDirectory(prefix='swarm-export-browser-') as tmp:
        root = Path(tmp)
        catalogs = build(root)
        handler = partial(Handler, directory=str(root / 'site'))
        with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with sync_playwright() as runtime:
                    executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
                    browser = runtime.chromium.launch(executable_path=executable, headless=True)
                    try:
                        for width in (390, 1440):
                            verify(browser, f'http://127.0.0.1:{server.server_port}/example/', catalogs, width)
                            print(f'PASS exported PWA translation and offline reload at {width}px', flush=True)
                        verify_update(browser, root, f'http://127.0.0.1:{server.server_port}/update/')
                        print('PASS first install and user-approved PWA replacement', flush=True)
                    finally:
                        browser.close()
            finally:
                server.shutdown()
                thread.join()


if __name__ == '__main__':
    main()
