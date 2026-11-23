#!/usr/bin/env python3
"""Exercise the Skills editor against a disposable Swarm project in Chrome."""

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright


SWARM = Path(__file__).resolve().parents[1]
CHROME = Path('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')


def free_port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def get_json(base, route):
    with urlopen(base + route, timeout=3) as response:
        return json.load(response)


def wait_until_ready(base, server):
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        assert server.poll() is None, 'Swarm exited before serving the fixture'
        try:
            return get_json(base, '/api/skills')
        except (URLError, TimeoutError):
            time.sleep(0.1)
    raise AssertionError('Swarm did not start')


def open_settings(page):
    trigger = page.locator('#setbtn')
    if not trigger.is_visible():
        page.locator('#viewbtn').click()
        trigger.click()
        return page.locator('#viewbtn')
    page.locator('#setbtn').click()
    return trigger


def open_skills(page):
    trigger = open_settings(page)
    page.get_by_role('navigation', name='Settings sections').get_by_role('button', name='Skills', exact=True).click()
    expect(page.get_by_role('heading', name='Project skills')).to_be_focused()
    expect(page.get_by_label('Skill library')).to_be_enabled()
    return trigger


def assert_layout(page, width):
    geometry = page.locator('#setdlg').evaluate('''dialog => {
      const viewport = document.documentElement;
      const content = dialog.querySelector('.ss-body');
      const header = dialog.querySelector('.ss-header');
      const nav = dialog.querySelector('.ss-nav');
      const scrollable = content.scrollHeight > content.clientHeight;
      const top = header.getBoundingClientRect().top;
      for (const ratio of [0, .5, 1]) {
        content.scrollTop = (content.scrollHeight - content.clientHeight) * ratio;
        if (header.getBoundingClientRect().top !== top) return { fixedHeader: false };
      }
      content.scrollTop = 0;
      return { viewport: viewport.clientWidth, document: viewport.scrollWidth,
        content: content.clientWidth, scroll: content.scrollWidth, scrollable,
        navRows: new Set(Array.from(nav.children, child => child.getBoundingClientRect().top)).size,
        fixedHeader: true };
    }''')
    assert geometry['fixedHeader'] and geometry['viewport'] == width, geometry
    assert geometry['document'] <= width and geometry['scroll'] <= geometry['content'], geometry
    if width < 480:
        assert geometry['navRows'] == 1 and geometry['scrollable'], geometry


def assert_text_contrast(locator):
    ratio = locator.evaluate('''node => {
      const parse = value => value.match(/[\\d.]+/g).map(Number);
      const luminance = rgb => rgb.slice(0, 3).map(value => value / 255)
        .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
        .reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0);
      const foreground = luminance(parse(getComputedStyle(node).color));
      for (let parent = node; parent; parent = parent.parentElement) {
        const color = parse(getComputedStyle(parent).backgroundColor);
        if (color.length === 4 && color[3] === 0) continue;
        const background = luminance(color);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      }
      return 0;
    }''')
    assert ratio >= 4.5, f'Insufficient text contrast: {ratio:.2f}:1'


def browser_case(browser, base, catalog, width, output):
    page = browser.new_page(viewport={'width': width, 'height': 844}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/studio', wait_until='domcontentloaded')
    if width >= 1000:
        page.get_by_role('button', name='Switch to light theme').click()
    trigger = open_skills(page)
    assert_layout(page, width)
    assert_text_contrast(page.get_by_role('button', name='Refresh skills'))
    assert_text_contrast(page.get_by_role('navigation', name='Settings sections').get_by_role('button', name='Roles'))
    if output:
        page.screenshot(path=str(output / f'skills-{width}.png'))

    skill = f'browser-skill-{width}'
    instructions = '## Review layout\nUse <strong>clear labels</strong>.'
    page.get_by_role('button', name='New skill').click()
    expect(page.get_by_label('Skill ID')).to_be_focused()
    page.get_by_label('Skill ID').fill(skill)
    page.get_by_label('Description').fill('Check a selected section for layout clarity.')
    page.get_by_label('Instructions (Markdown)').fill(instructions)
    page.get_by_text('Allowed positions', exact=True).click()
    page.get_by_label('All positions', exact=True).uncheck()
    position = catalog['positions'][0]
    page.get_by_label(position['title'], exact=True).check()
    assert_text_contrast(page.get_by_role('button', name='Save skill', exact=True))
    page.get_by_role('button', name='Save skill', exact=True).click()
    expect(page.get_by_text('Skill saved.', exact=True)).to_be_visible()
    detail = get_json(base, '/api/skills/' + skill)
    assert detail['body'] == instructions and detail['meta']['roles'] == [position['id']], detail
    expect(page.get_by_label('Instructions (Markdown)')).to_have_value(instructions)
    assert not page.get_by_text('clear labels', exact=True).count()

    page.get_by_label('Description').fill('Retain this draft while assigning the skill.')
    page.get_by_label('Assign to').select_option('position:' + position['id'])
    page.get_by_label(skill, exact=True).check()
    if output:
        page.screenshot(path=str(output / f'skills-assignment-{width}.png'))
    page.get_by_role('button', name='Save assignment').click()
    expect(page.get_by_text('Assignment saved.', exact=True)).to_be_visible()
    expect(page.get_by_label('Description')).to_have_value('Retain this draft while assigning the skill.')
    page.get_by_role('navigation', name='Settings sections').get_by_role('button', name='Roles', exact=True).click()
    page.get_by_role('navigation', name='Settings sections').get_by_role('button', name='Skills', exact=True).press('Enter')
    expect(page.get_by_label('Description')).to_have_value('Retain this draft while assigning the skill.')
    page.get_by_role('button', name='Save skill', exact=True).click()
    expect(page.get_by_text('Skill saved.', exact=True)).to_be_visible()

    worker = catalog['workers'][0]['id']
    page.get_by_label('Assign to').select_option('worker:' + worker)
    page.get_by_label(skill, exact=True).check()
    page.get_by_role('button', name='Save assignment').click()
    expect(page.get_by_text('Assignment saved.', exact=True)).to_be_visible()
    saved = get_json(base, '/api/skills')['assignments']
    assert skill in saved['byPosition'][position['id']] and skill in saved['byWorker'][worker], saved

    page.get_by_role('button', name='Disable skill').click()
    expect(page.get_by_role('button', name='Enable skill')).to_be_enabled()
    assert not get_json(base, '/api/skills/' + skill)['meta']['enabled']
    page.get_by_role('button', name='Enable skill').click()
    expect(page.get_by_role('button', name='Disable skill')).to_be_enabled()
    assert get_json(base, '/api/skills/' + skill)['meta']['enabled']

    page.once('dialog', lambda dialog: dialog.dismiss())
    page.get_by_role('button', name='Remove project skill').click()
    expect(page.get_by_label('Skill ID')).to_have_value(skill)
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('button', name='Remove project skill').click()
    expect(page.get_by_text('Project skill removed.', exact=False)).to_be_visible()
    assert all(item['id'] != skill for item in get_json(base, '/api/skills')['skills'])
    assert_layout(page, width)

    page.locator('#setclose').click()
    expect(page.locator('#setdlg')).to_be_hidden()
    expect(trigger).to_be_focused()
    if trigger.get_attribute('id') == 'viewbtn':
        trigger.press('Enter')
        page.locator('#setbtn').press('Enter')
    else:
        trigger.press('Enter')
    expect(page.locator('#setdlg')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#setdlg')).to_be_hidden()
    assert not errors, errors
    page.close()


def main():
    output = os.environ.get('SWARM_SKILLS_EVIDENCE')
    if output:
        output = Path(output)
        output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='swarm-skills-browser-') as tmp:
        project_name = 'skills-browser-' + uuid4().hex[:12]
        project = SWARM / 'projects' / project_name
        port = free_port()
        base = f'http://127.0.0.1:{port}'
        env = {**os.environ, 'SWARM_PROJECT': project_name, 'SWARM_PORT': str(port), 'SWARM_TEST': '1',
               'SWARM_SETTINGS': str(Path(tmp) / 'settings.json')}
        with tempfile.TemporaryFile() as log:
            server = subprocess.Popen(['node', str(SWARM / 'server.js')], env=env, stdout=log, stderr=log)
            try:
                catalog = wait_until_ready(base, server)
                executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
                with sync_playwright() as runtime:
                    browser = runtime.chromium.launch(executable_path=executable, headless=True)
                    for width in [393, 1440]:
                        browser_case(browser, base, catalog, width, output)
                        print(f'PASS: Skills editor and assignments at {width}px')
                    browser.close()
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


if __name__ == '__main__':
    main()
