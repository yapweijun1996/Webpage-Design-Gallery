#!/usr/bin/env python3
"""Exercise and time the Fast Path Studio flow in real Chrome without model calls."""

from argparse import ArgumentParser
from contextlib import contextmanager
import json
from math import ceil
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tempfile
import time
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

from browser_settings_skills import CHROME, SWARM, free_port
from browser_studio_versions import open_versions, request, versions, wait_until_ready


PROMPT = 'Build a GJH corporate landing page with brand cards, about and enquiry sections.'
SLASH_PROMPT = 'Create a GJH corporate website.'
ORIGINAL_TITLE = 'Original Fast Path fixture'
HERO_TITLE = 'Explore our brands'
SECTIONS = ['01-header', '02-hero', '03-brands', '04-about', '05-enquiry', '06-footer']
TARGET_MS = 10000


def read_json(base, route):
    return json.loads(request(base, route))


def eventually(predicate):
    deadline = time.monotonic() + 4
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.05)
    assert predicate(), 'The server did not reach the expected state'


@contextmanager
def swarm_fixture():
    with tempfile.TemporaryDirectory(prefix='swarm-fast-chrome-') as tmp, tempfile.TemporaryFile() as log:
        directory = Path(tmp)
        marker = directory / 'runner.log'
        marker.touch()
        runner = directory / 'codex-fixture'
        runner.write_text(f'#!/bin/sh\nprintf "started\\n" >> {shlex.quote(str(marker))}\nexec /bin/sleep 30\n')
        runner.chmod(0o700)
        name = 'fast-chrome-' + uuid4().hex[:12]
        project = SWARM / 'projects' / name
        port = free_port()
        base = f'http://127.0.0.1:{port}'
        env = {**os.environ, 'SWARM_PROJECT': name, 'SWARM_PORT': str(port), 'SWARM_TEST': '1',
               'SWARM_CODEX': str(runner), 'SWARM_SETTINGS': str(directory / 'settings.json')}
        server = subprocess.Popen(['node', str(SWARM / 'server.js')], env=env, stdout=log, stderr=log)
        try:
            yield base, project, wait_until_ready(base, server), marker
        except Exception:
            log.seek(0)
            print(log.read().decode(errors='replace'))
            raise
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
            if project.exists():
                shutil.rmtree(project)


def design_bytes(project):
    files = [file for file in (project / 'sections').rglob('*') if file.is_file()]
    files.append(project / 'contract.json')
    return {str(file.relative_to(project)): file.read_bytes() for file in files}


def seed_project(project):
    (project / 'sections/02-hero.html').write_text(f'<section class="s-02" id="02-hero"><h1>{ORIGINAL_TITLE}</h1></section>\n')
    (project / 'sections/02-hero.type.css').write_text('.s-02 h1 { color: rgb(29, 82, 171); }\n')
    (project / 'sections/support').mkdir()
    (project / 'sections/support/readme.txt').write_text('Preserved section support.\n')
    (project / 'contract.json').write_text('{"version":1,"recipe":"fixture","brand":"fixture","tokens":{},"sections":[],"owners":{}}\n')
    (project / 'notes/fixture.md').write_text('Preserved project notes.\n')
    (project / 'review.md').write_text('Fixture review.\n')
    (project / 'dist').mkdir(exist_ok=True)
    (project / 'dist/owner.txt').write_text('Preserved export file.\n')
    return design_bytes(project)


def decoded_image(image, timeout):
    expect(image).to_have_js_property('complete', True, timeout=timeout)
    assert image.evaluate('async image => { await image.decode(); return image.naturalWidth; }') > 0


class StudioFixture:
    def __init__(self, context, base, project, project_id, marker, width):
        self.base = base
        self.context = context
        self.project = project
        self.project_id = project_id
        self.marker = marker
        self.width = width
        self.errors = []
        self.accepted = 0
        self.before = seed_project(project)
        self.roster = (project / 'agents.json').read_bytes()
        self.page = self.open_page('/studio')
        self.preview = self.page.frame_locator('#preview-frame')
        self.button = self.page.locator('#fast-preview')
        self.draft = self.page.locator('#composer textarea')
        expect(self.preview.locator('h1')).to_have_text(ORIGINAL_TITLE)
        expect(self.button).to_be_enabled()

    def open_page(self, route):
        page = self.context.new_page()

        def console(message):
            source = message.location.get('url')
            if message.type == 'error' and not (source == self.base + '/favicon.ico' and '404' in message.text):
                self.errors.append((source, message.text))

        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.on('console', console)
        page.goto(self.base + route, wait_until='domcontentloaded')
        return page

    def stop_quality(self):
        request(self.base, '/api/stop', {})
        eventually(lambda: not versions(self.base)['busy'])
        expect(self.button).to_be_enabled()

    def publish(self, entry='button', detailed=False, output=None):
        detached = self.open_page(f'/studio.html?preview=1&w={self.width}') if detailed else None
        if detached:
            detached_frame = detached.frame_locator('iframe')
            expect(detached_frame.locator('h1')).to_have_text(ORIGINAL_TITLE)
        launched = len(self.marker.read_text().splitlines())
        slash = entry == 'chat'
        self.draft.fill('/fast ' + SLASH_PROMPT if slash else PROMPT)
        submit = self.page.locator('#composer').get_by_role('button', name='Send', exact=True) if slash else self.button
        route = '/api/chat' if slash else '/api/fast'

        with self.page.expect_response(lambda response: response.url == self.base + route and response.request.method == 'POST',
                                       timeout=TARGET_MS) as received:
            started = time.perf_counter()
            submit.click(timeout=TARGET_MS)
        response = received.value
        assert response.ok, (route, response.status)

        def remaining_time():
            return max(1, TARGET_MS - round(1000 * (time.perf_counter() - started)))

        heading = self.preview.get_by_role('heading', name=HERO_TITLE, exact=True)
        expect(heading).to_be_visible(timeout=remaining_time())
        for section in SECTIONS:
            expect(self.preview.locator(f'[id="{section}"]')).to_be_attached(timeout=remaining_time())
        decoded_image(self.preview.locator('[id="02-hero"] img'), remaining_time())
        if self.width == 393:
            menu = self.preview.locator('[id="01-header"] details')
            expect(menu).to_have_js_property('open', False, timeout=remaining_time())
            menu.locator('summary').click(timeout=remaining_time())
            expect(menu).to_have_js_property('open', True, timeout=remaining_time())
            expect(menu.locator('a[href="#03-brands"]')).to_be_visible(timeout=remaining_time())
        else:
            cta = self.preview.locator('[id="02-hero"] a[href="#03-brands"]')
            expect(cta).to_be_visible(timeout=remaining_time())
            cta.press('Enter', timeout=remaining_time())
            assert heading.evaluate('() => location.hash') == '#03-brands'
        elapsed = 1000 * (time.perf_counter() - started)
        assert elapsed < TARGET_MS, f'{self.width}px {entry} took {elapsed:.0f} ms'

        if not slash:
            expect(self.page.locator('#fast-preview-status')).to_have_text('Fast preview ready.')
        current_versions = versions(self.base)
        assert current_versions['busy'], 'The staged preview should be available during the background turn'
        checkpoint = current_versions['versions'][0]
        assert checkpoint['label'] == 'Before Fast Path', checkpoint
        eventually(lambda: len(self.marker.read_text().splitlines()) == launched + 1)
        expect(self.preview.locator('#page > .host')).to_have_count(6)
        frame_geometry = heading.evaluate('''() => ({viewport: innerWidth, content: document.documentElement.scrollWidth})''')
        assert frame_geometry['viewport'] == self.width and frame_geometry['content'] <= self.width, frame_geometry
        assert self.page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert (self.project / 'sections/support/readme.txt').read_bytes() == self.before['sections/support/readme.txt']
        assert (self.project / 'notes/fixture.md').read_text() == 'Preserved project notes.\n'
        assert (self.project / 'dist/owner.txt').read_text() == 'Preserved export file.\n'
        assert (self.project / 'agents.json').read_bytes() == self.roster

        if detailed:
            expect(detached_frame.get_by_role('heading', name=HERO_TITLE)).to_be_visible()
            decoded_image(detached_frame.locator('[id="02-hero"] img'), TARGET_MS)
            export = self.open_page('/p/dist/index.html')
            export_frame = export.frame_locator('#preview')
            expect(export_frame.get_by_role('heading', name=HERO_TITLE)).to_be_visible()
            decoded_image(export_frame.locator('[id="02-hero"] img'), TARGET_MS)
            assert export_frame.locator('html').evaluate(
                "root => getComputedStyle(root).getPropertyValue('--sds-color-bg').trim()"
            ), 'The rendered export lost SDS tokens after the quality runner started'
            export.close()
            if output:
                self.page.bring_to_front()
                self.page.screenshot(path=str(output / f'fast-path-{self.width}.png'))

        self.stop_quality()
        if detailed:
            dialog, _ = open_versions(self.page, self.width)
            dialog.get_by_role('radio', name='Before Fast Path').check()
            dialog.get_by_role('button', name='Restore selected version').click()
            expect(dialog.get_by_role('status')).to_have_text('Version restored. Your previous design was saved.')
            dialog.get_by_role('button', name='Close versions').click()
            expect(detached_frame.locator('h1')).to_have_text(ORIGINAL_TITLE)
            detached.close()
        else:
            request(self.base, '/api/rollback', {'projectId': self.project_id, 'id': checkpoint['id']})
        expect(self.preview.locator('h1')).to_have_text(ORIGINAL_TITLE)
        assert design_bytes(self.project) == self.before
        assert ORIGINAL_TITLE.encode() in request(self.base, '/p/dist/preview.html')
        assert not self.errors, self.errors
        self.accepted += 1
        assert read_json(self.base, '/api/metrics')['n'] == self.accepted
        metrics = json.loads((self.project / '.run/metrics.jsonl').read_text().splitlines()[-1])
        return {'width': self.width, 'entry': entry, 'interactiveMs': round(elapsed, 2), 'serverMs': metrics['total']}

    def fallback(self):
        before = versions(self.base)['versions']
        text = 'Build a dashboard for this project.'
        launched = len(self.marker.read_text().splitlines())
        self.draft.fill(text)
        self.button.click()
        expect(self.page.locator('#fast-preview-status')).to_have_text('Sent to the team.')
        eventually(lambda: len(self.marker.read_text().splitlines()) == launched + 1)
        assert sum(message['text'] == text for message in read_json(self.base, '/api/chat')['messages']) == 1
        assert versions(self.base)['versions'] == before
        assert design_bytes(self.project) == self.before
        self.stop_quality()


def sample_group(browser, width, runs, cache, output):
    samples = []

    def collect(fixture, runs):
        for index in range(runs):
            entry = 'chat' if cache == 'warm' and index == 0 else 'button'
            samples.append({'cache': cache, **fixture.publish(entry)})

    def context():
        return browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce')

    if cache == 'warm':
        with swarm_fixture() as server, context() as chrome:
            fixture = StudioFixture(chrome, *server, width)
            fixture.publish(detailed=True, output=output)
            fixture.fallback()
            collect(fixture, runs)
    else:
        for _ in range(runs):
            with swarm_fixture() as server, context() as chrome:
                collect(StudioFixture(chrome, *server, width), 1)
    return samples


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--warm-runs', type=int, default=10)
    parser.add_argument('--cold-runs', type=int, default=5)
    args = parser.parse_args()
    if min(args.warm_runs, args.cold_runs) < 1:
        parser.error('Run counts must be positive.')

    output = os.environ.get('SWARM_FAST_PATH_EVIDENCE')
    if output:
        output = Path(output)
        output.mkdir(parents=True, exist_ok=True)
    executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
    samples, summaries = [], []
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=executable, headless=True)
        try:
            for width in (393, 1440):
                for cache, runs in [('warm', args.warm_runs), ('cold', args.cold_runs)]:
                    group = sample_group(browser, width, runs, cache, output)
                    times = sorted(sample['interactiveMs'] for sample in group)
                    summary = {'width': width, 'cache': cache, 'n': len(times),
                               'p50Ms': times[ceil(len(times) * .50) - 1],
                               'p95Ms': times[ceil(len(times) * .95) - 1], 'maxMs': times[-1]}
                    samples.extend(group)
                    summaries.append(summary)
                    print(f"PASS: {width}px {cache}, n={len(times)}, click-to-interactive "
                          f"p50 {summary['p50Ms']:.0f} ms, p95 {summary['p95Ms']:.0f} ms, max {summary['maxMs']:.0f} ms", flush=True)
        finally:
            browser.close()
    if output:
        report = {'targetMs': TARGET_MS, 'samples': samples, 'summary': summaries,
                  'warm': 'Same server and browser context after one unmeasured successful request.',
                  'cold': 'First Fast Path request on a new server and browser context. Chrome startup and OS cache are excluded.',
                  'criterion': 'Click to six attached sections, decoded hero image and an opened mobile menu or keyboard-activated desktop CTA.'}
        (output / 'fast-path-timings.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
