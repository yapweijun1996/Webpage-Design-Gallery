#!/usr/bin/env python3
"""Verify Studio's local repair status and approval gate with injected QA states."""

from copy import deepcopy
from hashlib import sha256
import os
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

from browser_studio_anchors import CHROME, fixture, in_dialog, png, state


def run_repair_case(browser, base, width):
    project_id = state(base)['projectId']
    desktop = png(1440)
    digest = sha256(desktop).hexdigest()
    token = 'repair-fixture'
    anchor = {'id': 'v001', 'status': 'locked', 'files': {'anchor.desktop.png': {'sha256': digest}}}
    summary = {
        'projectId': project_id, 'busy': False, 'canEdit': True,
        'flow': {'state': 'qa', 'anchorId': anchor['id'], 'approved': True},
        'anchors': [{**anchor, 'id': 'v002', 'status': 'superseded'}, anchor],
        'qa': {'anchorId': anchor['id'], 'ok': False, 'completeCoverage': True, 'stale': False, 'breakpoints': [
            {'name': 'desktop', 'width': 1440, 'status': 'fail', 'score': 76},
        ]},
    }
    qa_requests, approvals = [], []

    def anchor_api(route):
        action = urlparse(route.request.url).path.removeprefix('/api/anchor/')
        if action == 'state':
            route.fulfill(json=summary)
        elif action == 'session':
            route.fulfill(json={'token': token})
        elif action.startswith('image/'):
            route.fulfill(body=desktop, content_type='image/png')
        else:
            assert route.request.method == 'POST'
            assert route.request.headers.get('x-swarm-anchor-token') == token
            payload = route.request.post_data_json
            assert payload['projectId'] == project_id and payload['anchorId'] == anchor['id']
            if action == 'qa':
                # Hold the request while simulating progress events from the server.
                qa_requests.append(route)
            else:
                assert action == 'finish' and payload['sha256'] == digest
                approvals.append(payload)
                summary['flow']['state'] = 'done'
                route.fulfill(json=summary)

    context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce')
    try:
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script('''(() => {
          const NativeEventSource = window.EventSource;
          window.EventSource = class extends NativeEventSource {
            constructor(...args) {
              super(...args);
              if (args[0] === '/events') {
                window.emitFixtureAnchor = () => this.dispatchEvent(
                  new MessageEvent('message', { data: JSON.stringify({ type: 'anchor' }) })
                );
              }
            }
          };
        })()''')
        page.route('**/api/anchor/**', anchor_api)
        page.goto(base + '/studio', wait_until='domcontentloaded')
        expect(page.locator('#status-text')).to_have_text('Idle')
        if width == 393:
            page.locator('#viewbtn').click()
            page.locator('#menu-review').click()
        else:
            page.get_by_role('tab', name='Review').click()

        qa_status = page.locator('#anchor-qa-status')
        repair = page.locator('#anchor-qa-repair')
        repair_status = page.locator('#anchor-qa-repair-status')
        scope = page.locator('#anchor-qa-repair-scope')
        detail = page.locator('#anchor-qa-repair-detail')
        run_button = page.locator('#anchor-run-qa')
        finish_button = page.locator('#anchor-finish')
        expect(qa_status).to_have_text('Visual QA found issues.')
        expect(repair).to_be_hidden()

        dialog = in_dialog(page, 'run-qa')
        expect(dialog.get_by_text('visual QA can ask the assigned worker to fix it and run QA again.', exact=False)).to_be_visible()
        page.keyboard.press('Escape')
        expect(dialog).to_be_hidden()
        expect(run_button).to_be_focused()
        assert not qa_requests
        dialog = in_dialog(page, 'run-qa')
        with page.expect_request(lambda request: request.url.endswith('/api/anchor/qa')) as sent:
            dialog.locator('#anchor-dialog-submit').click()
        assert set(sent.value.post_data_json) == {'projectId', 'anchorId', 'appearance'}
        expect(dialog).to_be_hidden()

        def update(status, *, section=None, worker=None, message=None):
            summary['qa']['repair'] = {'status': status, 'sectionId': section, 'ownerId': worker, 'message': message}
            page.evaluate('window.emitFixtureAnchor()')

        summary['busy'] = True
        summary['flow']['state'] = 'implementing'
        update('queued', section='02-hero', worker='02', message='Waiting for the assigned worker.')
        expect(repair_status).to_have_text('Scoped repair queued.')
        expect(scope).to_have_text('Section 02-hero · Worker 02')
        expect(detail).to_have_text('Waiting for the assigned worker.')
        expect(run_button).to_be_disabled()
        assert len(qa_requests) == 1
        queued = deepcopy(summary)
        update('running', section='02-hero', worker='02')
        expect(repair_status).to_have_text('Scoped repair in progress.')
        expect(detail).to_be_hidden()
        expect(run_button).to_be_disabled()
        expect(finish_button).to_be_hidden()
        page.evaluate('''() => {
          const status = document.getElementById('anchor-qa-repair-status');
          window.repairReadback = [];
          new MutationObserver(() => window.repairReadback.push(status.textContent))
            .observe(status, { childList: true });
        }''')
        qa_requests[0].fulfill(json=queued)
        expect(page.locator('#anchor-status')).to_have_text('Visual QA results saved.')
        expect(repair_status).to_have_text('Scoped repair in progress.')
        assert 'Scoped repair queued.' not in page.evaluate('window.repairReadback')

        summary['flow']['state'] = 'final_review'
        summary['qa'].update(ok=True, stale=True)
        update('published', section='02-hero', worker='02', message='Checking the repaired preview.')
        expect(repair_status).to_have_text('Scoped repair published.')
        expect(detail).to_have_text('Checking the repaired preview.')
        expect(qa_status).to_have_text('The preview changed after visual QA.')
        expect(run_button).to_be_disabled()
        expect(finish_button).to_be_hidden()

        summary['busy'] = False
        terminal_labels = {
            'no-change': 'The worker made no changes.',
            'failed': 'Scoped repair failed.',
            'skipped': 'Scoped repair skipped.',
            'cancelled': 'Scoped repair cancelled.',
        }
        for status, label in terminal_labels.items():
            update(status)
            expect(repair_status).to_have_text(label)
            expect(scope).to_be_hidden()
        page.locator('#anchor-selection').select_option('v002')
        expect(repair).to_be_hidden()
        page.locator('#anchor-selection').select_option(anchor['id'])

        summary['qa'].update(stale=False)
        update('published', section='02-hero', worker='02')
        expect(qa_status).to_have_text('Visual QA passed.')
        dialog = in_dialog(page, 'finish')
        expect(dialog.get_by_role('heading', name='Final approval')).to_be_focused()
        page.keyboard.press('Escape')
        expect(dialog).to_be_hidden()
        assert not approvals
        dialog = in_dialog(page, 'finish')
        dialog.locator('#anchor-dialog-submit').click()
        expect(page.locator('#anchor-phase')).to_have_text('Complete')
        assert len(approvals) == 1 and len(qa_requests) == 1
        assert not errors, errors
        assert page.evaluate('document.documentElement.scrollWidth === document.documentElement.clientWidth')
    finally:
        context.close()


def main():
    executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=executable, headless=True)
        try:
            with fixture() as (base, _):
                for width in (393, 1440):
                    run_repair_case(browser, base, width)
                    print(f'PASS: Studio repair progress, terminal states and explicit final approval at {width}px', flush=True)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
