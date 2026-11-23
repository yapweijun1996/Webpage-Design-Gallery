#!/usr/bin/env python3
"""Verify snapshot, restore and live Studio previews in Chrome."""

import base64
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile
import time
import zlib
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

from browser_settings_skills import CHROME, SWARM, free_port


REFERENCE = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVQIHWP4DwABAQEAG6+mGQAAAABJRU5ErkJggg=='
)


def request(base, route, body=None):
    data = json.dumps(body).encode() if body is not None else None
    with urlopen(Request(base + route, data=data, headers={'Content-Type': 'application/json'}), timeout=4) as response:
        return response.read()


def versions(base, body=None):
    return json.loads(request(base, '/api/versions', body))


def expect_conflict(base, route, body, message):
    try:
        request(base, route, body)
    except HTTPError as response:
        with response:
            assert response.code == 409 and message in json.load(response)['error']
    else:
        raise AssertionError(f'{route} unexpectedly accepted a version change')


def wait_until_ready(base, server):
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        assert server.poll() is None, 'Swarm exited before serving the fixture'
        try:
            return versions(base)['projectId']
        except (URLError, TimeoutError):
            time.sleep(0.1)
    raise AssertionError('Swarm did not start')


def seed_design(project, slug, heading, color, marker):
    sections = project / 'sections'
    for existing in sections.glob('01-*'):
        existing.unlink()
    html = f'<section id="01-{slug}"><h1 data-fixture>{heading}</h1></section>\n'.encode()
    css = f'[data-fixture] {{ color: {color}; }}\n'.encode()
    stem = sections / ('01-' + slug)
    stem.with_suffix('.html').write_bytes(html)
    stem.with_suffix('.css').write_bytes(css)
    (project / 'contract.json').write_text(json.dumps({'fixture': marker}))
    return html, css


def open_versions(page, width):
    trigger = page.get_by_role('button', name='Manage versions')
    if width == 393:
        trigger = page.locator('#drawerbtn')
        trigger.click()
        page.get_by_role('navigation', name='Project', exact=True).get_by_role('button', name='Versions').click()
    else:
        trigger.click()
    dialog = page.get_by_role('dialog', name='Project versions')
    expect(dialog.get_by_label('Version name')).to_be_focused()
    expect(dialog.get_by_role('button', name='Save version')).to_be_enabled()
    return dialog, trigger


def assert_layout(dialog, width):
    geometry = dialog.evaluate('''dialog => {
      const viewport = document.documentElement;
      const body = dialog.querySelector('.studio-versions-body');
      const header = dialog.querySelector('header');
      const footer = dialog.querySelector('footer');
      const scroll = body.scrollHeight - body.clientHeight;
      const top = header.getBoundingClientRect().top;
      const bottom = footer.getBoundingClientRect().bottom;
      const positions = [0, .5, 1].map(ratio => {
        body.scrollTop = scroll * ratio;
        return { offset: body.scrollTop, pinned: header.getBoundingClientRect().top === top
          && footer.getBoundingClientRect().bottom === bottom };
      });
      body.scrollTop = 0;
      return { viewport: viewport.clientWidth, document: viewport.scrollWidth,
        visible: body.clientWidth, content: body.scrollWidth, positions, top, bottom };
    }''')
    assert geometry['viewport'] == width and geometry['document'] <= width, geometry
    assert geometry['content'] <= geometry['visible'] and 0 <= geometry['top'] < geometry['bottom'] <= 844, geometry
    positions = geometry['positions']
    assert all(item['pinned'] for item in positions), geometry
    assert 0 == positions[0]['offset'] < positions[1]['offset'] < positions[2]['offset'], geometry


def assert_previews(previews, heading, color):
    for frame in previews:
        label = frame.locator('h1[data-fixture]')
        expect(label).to_have_text(heading)
        expect(label).to_have_css('color', color)


def png_pixel(rgba):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    header = struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
            + chunk(b'IDAT', zlib.compress(bytes((0, *rgba)))) + chunk(b'IEND', b''))


def read_pixel(image):
    return image.evaluate('''async image => {
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    }''')


def assert_asset_updates(project, slug, previews, html):
    name = f'01-{slug}-fixture.png'
    asset = project / 'assets' / 'generated' / name
    asset.parent.mkdir(parents=True, exist_ok=True)
    before, after = [196, 58, 44, 255], [22, 90, 211, 255]
    asset.write_bytes(png_pixel(before))
    section = project / 'sections' / f'01-{slug}.html'
    css = section.with_suffix('.css')
    css.write_bytes(css.read_bytes() + f'[data-fixture] {{ min-height: 150vh; background-image: url(../assets/generated/{name}); }}'.encode())
    fragment = html.replace(b'</section>', f'<img crossorigin="anonymous" src="/p/assets/generated/{name}?mode=preview#fixture" alt="Generated fixture"></section>'.encode())
    section.write_bytes(fragment.replace(b'Current layout', b'Updated after restore'))

    images = [frame.locator('img[alt="Generated fixture"]') for frame in previews]
    versioned_source = re.compile(r'\?swarm_asset=.*&mode=preview#fixture$')
    for image in images:
        expect(image).to_have_attribute('src', versioned_source)
        assert read_pixel(image) == before
    prior_sources = [image.get_attribute('src') for image in images]
    labels = [frame.locator('h1[data-fixture]') for frame in previews]
    prior_styles = [label.evaluate('label => getComputedStyle(label).backgroundImage') for label in labels]
    stage = previews[1].locator('html')
    scroll = stage.evaluate('() => { window.scrollTo(0, 120); return window.scrollY; }')
    assert scroll == 120, scroll

    temporary = asset.with_name('.fixture-publish')
    temporary.write_bytes(png_pixel(after))
    temporary.replace(asset)
    for image, old_source in zip(images, prior_sources):
        expect(image).not_to_have_attribute('src', old_source)
        expect(image).to_have_attribute('src', versioned_source)
        assert read_pixel(image) == after
    for label, old_style in zip(labels, prior_styles):
        style = label.evaluate('label => getComputedStyle(label).backgroundImage')
        assert 'swarm_asset=' in style and style != old_style, style
    assert stage.evaluate('() => window.scrollY') == scroll


def browser_case(browser, base, project, project_id, width, output):
    original_roster = (project / 'agents.json').read_bytes()
    active_slug = next(agent['section'] for agent in json.loads(original_roster) if agent['id'] == '01')
    archived_slug = 'archived-layout-fixture'
    fixture_notes = project / 'notes' / 'fixture.md'
    fixture_notes.write_text('Project notes stay with the active project.\n')
    archive = seed_design(project, archived_slug, 'Archived layout', '#14629a', 'archived')
    archived_id = versions(base, {'projectId': project_id, 'label': 'Design archive'})['id']
    current = seed_design(project, active_slug, 'Current layout', '#a13244', 'current')
    for index in range(18):
        versions(base, {'projectId': project_id, 'label': f'Checkpoint {index + 1}'})

    context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce')
    errors = []

    def studio_page(route):
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + route, wait_until='domcontentloaded')
        return page

    try:
        page = studio_page('/studio')
        detached = studio_page(f'/studio.html?preview=1&w={width}')
        review = studio_page('/studio')
        if width == 393:
            review.locator('#drawerbtn').click()
            review.get_by_role('button', name='Compare reference').click()
        else:
            review.get_by_role('tab', name='Review').click()
        review.locator('#compare input[type=file]').set_input_files({
            'name': 'reference.png', 'mimeType': 'image/png', 'buffer': REFERENCE,
        })
        previews = [page.frame_locator('#preview-frame'), detached.frame_locator('iframe'),
                    review.frame_locator('iframe[title="Actual design preview"]')]
        assert_previews(previews, 'Current layout', 'rgb(161, 50, 68)')
        draft = page.locator('#composer textarea')
        draft.fill('Keep this draft after closing versions.')

        dialog, trigger = open_versions(page, width)
        assert_layout(dialog, width)
        dialog.get_by_role('button', name='Close versions').click()
        expect(dialog).to_be_hidden()
        expect(trigger).to_be_focused()
        expect(draft).to_have_value('Keep this draft after closing versions.')
        dialog, _ = open_versions(page, width)
        page.keyboard.press('Escape')
        expect(dialog).to_be_hidden()
        expect(trigger).to_be_focused()
        dialog, _ = open_versions(page, width)
        page.mouse.click(10, 10)
        expect(dialog).to_be_hidden()
        expect(trigger).to_be_focused()

        dialog, _ = open_versions(page, width)
        dialog.get_by_label('Version name').fill('Chrome checkpoint')
        dialog.get_by_role('button', name='Save version').click()
        expect(dialog.get_by_role('status')).to_have_text('Version saved.')
        expect(dialog.get_by_role('radio', name='Chrome checkpoint')).to_be_visible()
        assert len(versions(base)['versions']) == 20
        if output:
            page.screenshot(path=str(output / f'studio-versions-{width}.png'))

        restore = dialog.get_by_role('button', name='Restore selected version')
        dialog.get_by_role('radio', name='Design archive').check()
        restore.click()
        expect(dialog.get_by_role('status')).to_have_text('Version restored. Your previous design was saved.')
        assert_previews(previews, 'Archived layout', 'rgb(20, 98, 154)')
        assert request(base, f'/p/sections/01-{archived_slug}.html') == archive[0]
        assert request(base, f'/p/sections/01-{archived_slug}.css') == archive[1]
        assert b'Archived layout' in request(base, '/p/dist/preview.html')
        assert json.loads((project / 'contract.json').read_text())['fixture'] == 'archived'
        assert archived_id in {version['id'] for version in versions(base)['versions']}
        assert (project / 'agents.json').read_bytes() == original_roster
        assert fixture_notes.read_text() == 'Project notes stay with the active project.\n'

        dialog.get_by_role('radio', name='Before restore').check()
        restore.click()
        assert_previews(previews, 'Current layout', 'rgb(161, 50, 68)')
        assert request(base, f'/p/sections/01-{active_slug}.html') == current[0]
        assert request(base, f'/p/sections/01-{active_slug}.css') == current[1]
        assert b'Current layout' in request(base, '/p/dist/preview.html')
        assert json.loads((project / 'contract.json').read_text())['fixture'] == 'current'

        history = versions(base)['versions']
        lock = project.parent / f'.{project.name}.init'
        lock.mkdir()
        try:
            expect_conflict(base, '/api/versions', {'projectId': project_id}, 'locked')
            expect_conflict(base, '/api/rollback', {'projectId': project_id, 'id': archived_id}, 'locked')
        finally:
            lock.rmdir()

        request(base, '/api/chat', {'from': 'owner', 'text': 'Fixture to hold an active turn.'})
        try:
            expect(dialog.get_by_text('Versions can be changed when the project is idle.')).to_be_visible()
            expect(dialog.get_by_role('button', name='Save version')).to_be_disabled()
            expect(restore).to_be_disabled()
            expect_conflict(base, '/api/versions', {'projectId': project_id}, 'current work')
            expect_conflict(base, '/api/rollback', {'projectId': project_id, 'id': archived_id}, 'current work')
        finally:
            request(base, '/api/stop', {})
        expect(dialog.get_by_role('button', name='Save version')).to_be_enabled()
        assert versions(base)['versions'] == history
        assert_previews(previews, 'Current layout', 'rgb(161, 50, 68)')

        assert_asset_updates(project, active_slug, previews, current[0])
        assert_previews(previews, 'Updated after restore', 'rgb(161, 50, 68)')
        dialog.get_by_role('button', name='Close versions').click()
        expect(draft).to_have_value('Keep this draft after closing versions.')
        assert not errors, errors
    finally:
        context.close()


def main():
    output = os.environ.get('SWARM_VERSION_EVIDENCE')
    if output:
        output = Path(output)
        output.mkdir(parents=True, exist_ok=True)
    executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=executable, headless=True)
        for width in [393, 1440]:
            with tempfile.TemporaryDirectory(prefix='swarm-browser-versions-') as tmp, tempfile.TemporaryFile() as log:
                project_name = 'versions-browser-' + uuid4().hex[:12]
                project = SWARM / 'projects' / project_name
                port = free_port()
                base = f'http://127.0.0.1:{port}'
                fake_runner = Path(tmp) / 'codex-fixture'
                fake_runner.write_text('#!/bin/sh\nexec /bin/sleep 30\n')
                fake_runner.chmod(0o700)
                env = {**os.environ, 'SWARM_PROJECT': project_name, 'SWARM_PORT': str(port), 'SWARM_TEST': '1',
                       'SWARM_CODEX': str(fake_runner), 'SWARM_SETTINGS': str(Path(tmp) / 'settings.json')}
                server = subprocess.Popen(['node', str(SWARM / 'server.js')], env=env, stdout=log, stderr=log)
                try:
                    project_id = wait_until_ready(base, server)
                    browser_case(browser, base, project, project_id, width, output)
                    print(f'PASS: Studio versions, embedded viewer, comparison and detached viewer at {width}px')
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
        browser.close()


if __name__ == '__main__':
    main()
