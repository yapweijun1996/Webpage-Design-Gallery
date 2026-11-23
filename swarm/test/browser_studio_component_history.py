#!/usr/bin/env python3
"""Exercise Studio component restore controls with an injected API in real Chrome."""

import os
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

from browser_settings_skills import CHROME
from browser_studio_anchors import fixture


SECTIONS = [{'id': '01-header', 'label': 'Header'}, {'id': '02-hero', 'label': 'Hero'}]
CREATED_AT = '2026-11-23T09:45:21.000Z'
FILES = [
    'sections/01-header.css',
    'assets/generated/01-header-a-long-filename-for-mobile-layout-and-confirmation.webp',
]


def run_case(browser, base, width):
    project_id = 'component-history-fixture'
    token = 'fixture-operator-grant'
    first = {
        'snapshotId': '01234567-89ab-4def-8123-000000000001',
        'createdAt': CREATED_AT,
        'paths': FILES,
        'expectedRevision': '1' * 64,
    }
    updated = {**first, 'expectedRevision': '2' * 64}
    undo = {**first, 'snapshotId': '01234567-89ab-4def-8123-000000000002', 'expectedRevision': '3' * 64}
    versions = {'01-header': [first], '02-hero': []}
    busy = True
    seen_sections, restores, pending = [], [], []

    def history(route):
        params = parse_qs(urlparse(route.request.url).query)
        seen_sections.append(params.get('sectionId'))
        section = params.get('sectionId', ['01-header'])[0]
        route.fulfill(json={
            'projectId': project_id, 'busy': busy, 'sections': SECTIONS,
            'selectedSection': section, 'versions': versions[section],
        })

    def restore(route):
        assert route.request.method == 'POST'
        assert route.request.headers.get('x-swarm-anchor-token') == token
        payload = route.request.post_data_json
        expected = first if not restores else updated
        assert payload == {
            'projectId': project_id, 'sectionId': '01-header',
            'snapshotId': expected['snapshotId'], 'expectedRevision': expected['expectedRevision'],
            'appearance': {'theme': 'auto', 'brand': 'forest-gold', 'lang': 'ms', 'colorScheme': 'dark'},
        }
        restores.append(payload)
        if len(restores) == 1:
            versions['01-header'] = [updated]
            route.fulfill(status=409, json={'error': 'The component changed after you opened this version.'})
        else:
            pending.append(route)

    context = browser.new_context(viewport={'width': width, 'height': 844}, color_scheme='dark', reduced_motion='reduce')
    try:
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script('''(() => {
          if (window === window.top) {
            for (const [key, value] of Object.entries({theme: 'auto', brand: 'forest-gold', lang: 'ms'})) {
              localStorage.setItem('sds.' + key, value);
            }
          }
          const NativeEventSource = window.EventSource;
          window.EventSource = class extends NativeEventSource {
            constructor(...args) {
              super(...args);
              if (args[0] === '/events') {
                window.emitComponentEvent = event => this.dispatchEvent(
                  new MessageEvent('message', { data: JSON.stringify(event) })
                );
              }
            }
          };
        })()''')
        page.route('**/api/component-versions*', history)
        page.route('**/api/component-rollback', restore)
        page.route('**/api/anchor/session', lambda route: route.fulfill(json={'token': token}))
        page.goto(base + '/studio', wait_until='domcontentloaded')
        expect(page.locator('#status-text')).to_have_text('Idle')
        if width == 393:
            page.locator('#viewbtn').click()
            page.locator('#menu-review').click()
        else:
            page.get_by_role('tab', name='Review').click()

        card = page.get_by_role('region', name='Component history')
        section = card.get_by_role('combobox', name='Section')
        row = card.get_by_role('button', name='Restore…')
        idle_note = page.locator('#component-history-busy')
        dialog = page.get_by_role('dialog', name='Restore component')
        confirm = dialog.get_by_role('button', name='Restore component')
        cancel = dialog.get_by_role('button', name='Cancel')

        expect(section).to_have_value('01-header')
        expect(row).to_be_disabled()
        expect(idle_note).to_be_visible()
        assert seen_sections[0] is None
        busy = False
        page.evaluate("event => window.emitComponentEvent(event)", {'type': 'busy', 'busy': False})
        expect(row).to_be_enabled()
        expect(idle_note).to_be_hidden()

        section.select_option('02-hero')
        expect(card.get_by_text('No published versions for this section.')).to_be_visible()
        expect(row).to_have_count(0)
        section.select_option('01-header')
        expect(row).to_be_enabled()
        assert ['02-hero'] in seen_sections and ['01-header'] in seen_sections
        for path in FILES:
            expect(card.get_by_text(path, exact=True)).to_be_visible()

        row.click()
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role('heading', name='Restore component')).to_be_focused()
        expect(dialog.get_by_text('Header', exact=True)).to_be_visible()
        expect(dialog.locator('time')).to_have_attribute('datetime', CREATED_AT)
        expect(dialog.get_by_text(first['expectedRevision'], exact=True)).to_be_visible()
        for path in FILES:
            expect(dialog.get_by_text(path, exact=True)).to_be_visible()
        assert not restores
        busy = True
        page.evaluate("window.emitComponentEvent({ type: 'busy', busy: true })")
        expect(dialog.get_by_text('Restore is available when the project is idle.')).to_be_visible()
        expect(confirm).to_be_disabled()
        busy = False
        page.evaluate("window.emitComponentEvent({ type: 'busy', busy: false })")
        expect(confirm).to_be_enabled()
        other_width = 1440 if width == 393 else 393
        page.set_viewport_size({'width': other_width, 'height': 700})
        page.keyboard.press('Tab')
        assert dialog.evaluate('dialog => dialog.contains(document.activeElement)')
        assert dialog.evaluate('dialog => dialog.getBoundingClientRect().width < window.innerWidth')
        assert dialog.locator('.studio-component-dialog-body').evaluate('node => node.scrollWidth === node.clientWidth')
        page.set_viewport_size({'width': width, 'height': 844})
        page.keyboard.press('Escape')
        expect(dialog).to_be_hidden()
        expect(row).to_be_focused()
        assert not restores

        row.click()
        confirm.click()
        expect(dialog.get_by_text('The component changed after you opened this version.', exact=False)).to_be_visible()
        expect(confirm).to_be_disabled()
        expect(dialog.locator('#component-restore-status')).to_be_focused()
        expect(dialog.get_by_text(first['expectedRevision'], exact=True)).to_be_visible()
        cancel.click()
        expect(dialog).to_be_hidden()
        expect(row).to_be_enabled()

        row.click()
        expect(dialog.get_by_text(updated['expectedRevision'], exact=True)).to_be_visible()
        with page.expect_request('**/api/component-rollback'):
            confirm.click()
        expect(dialog.get_by_text('Checking and restoring the component…')).to_be_visible()
        assert len(restores) == 2 and len(pending) == 1
        busy = True
        page.evaluate("event => window.emitComponentEvent(event)", {'type': 'busy', 'busy': True})
        expect(confirm).to_be_disabled()
        expect(cancel).to_be_disabled()
        page.keyboard.press('Escape')
        expect(dialog).to_be_visible()
        assert len(restores) == 2

        busy = False
        versions['01-header'] = [undo, updated]
        page.evaluate("window.emitComponentEvent({ type: 'versions' })")
        pending[0].fulfill(json={'snapshotId': updated['snapshotId'], 'undoId': undo['snapshotId'], 'restored': FILES})
        expect(dialog).to_be_hidden()
        expect(card.get_by_text('Restored 2 files.')).to_be_visible()
        expect(row).to_have_count(2)
        expect(card.locator('button').first).to_have_attribute('data-snapshot-id', undo['snapshotId'])
        assert card.evaluate('node => node.scrollWidth === node.clientWidth')
        assert not errors, errors
    finally:
        context.close()


def main():
    executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=executable, headless=True)
        try:
            with fixture() as (base, _project):
                for width in (393, 1440):
                    run_case(browser, base, width)
                    print(f'PASS: Studio component history, stale confirmation and restore at {width}px', flush=True)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
