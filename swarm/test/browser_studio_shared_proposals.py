#!/usr/bin/env python3
"""Verify Studio shared-style decisions and live token readback in Chrome."""

import os
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

from browser_settings_skills import CHROME
from browser_studio_anchors import fixture, png


WIDTHS = (393, 768, 1440)
BEFORE = (
    '/* <img src=x onerror="window.unsafeMarker=true"> */\n:root {\n'
    + ''.join(f'  --unchanged-fixture-{index}: {index}px;\n' for index in range(40))
    + '  --shared-proposal-fixture: before;\n}\n'
)
AFTER = BEFORE.replace('--shared-proposal-fixture: before;', '--shared-proposal-fixture: after;')


def run_case(browser, base, project, width):
    created = '2026-11-23T09:45:21.000Z'
    first = {
        'id': '12345678-1234-4321-8123-000000000001', 'sectionId': '01-header', 'createdAt': created,
        'status': 'pending', 'before': BEFORE, 'after': AFTER, 'impact': None, 'reviewRevision': '1' * 64,
    }
    second = {**first, 'id': '12345678-1234-4321-8123-000000000002', 'sectionId': '02-hero'}
    catalog = {'projectId': 'shared-style-fixture', 'busy': True, 'proposals': [first, second]}
    mutations, evidence_reads, held = [], [], []
    tokens = project / 'tokens.css'
    original = tokens.read_text()
    tokens.write_text(original + '\n' + BEFORE)

    def measure(proposal, *, ok, revision):
        problem = 'New horizontal overflow at 393 px.'
        proposal.update(status='reviewed', reviewRevision=revision * 64, impact={
            'ok': ok, 'digest': revision * 64, 'appearance': {'theme': 'light', 'brand': 'none', 'lang': 'en'},
            'widths': list(WIDTHS), 'problems': [] if ok else [problem],
            'perWidth': [{
                'width': measured,
                'horizontalOverflow': {'before': 0, 'after': 0 if ok or measured != 393 else 12},
                'consoleErrors': {'before': [], 'after': [], 'added': []},
            } for measured in WIDTHS],
            'perSection': [{'id': '02-hero', 'widths': [{'width': measured, 'changed': True, 'before': {'sha256': 'a'*64}, 'after': {'sha256': 'b'*64}} for measured in WIDTHS]}],
        })

    def shared_api(route):
        tail = urlparse(route.request.url).path.removeprefix('/api/shared-proposals').strip('/')
        if not tail:
            return route.fulfill(json=catalog)
        if '/evidence/' in tail:
            proposal_id, _, revision, measured, side = tail.split('/')
            section = parse_qs(urlparse(route.request.url).query).get('section', [None])[0]
            assert section in (None, '02-hero')
            evidence_reads.append((proposal_id, revision, int(measured), side, section))
            assert first['status'] in ('reviewed', 'approved') and proposal_id == first['id']
            assert revision == first['reviewRevision'] and int(measured) in WIDTHS and side in ('before', 'after')
            return route.fulfill(content_type='image/png', body=png(int(measured), 20))
        assert route.request.method == 'POST'
        assert route.request.headers.get('x-swarm-anchor-token') == 'fixture-grant'
        proposal = second if tail == 'reject' else first
        assert route.request.post_data_json == {
            'projectId': catalog['projectId'], 'id': proposal['id'], 'reviewRevision': proposal['reviewRevision'],
        }
        mutations.append(tail)
        if tail == 'review':
            reviews = mutations.count('review')
            if reviews == 1:
                held.append(route)
                return
            measure(first, ok=True, revision=str(reviews + 1))
        elif tail == 'approve':
            if mutations.count('approve') == 1:
                proposal.update(status='stale', reviewRevision='8' * 64)
                return route.fulfill(status=409, json={'error': 'The measured preview changed.'})
            proposal['status'] = 'approved'
            tokens.write_text(original + '\n' + AFTER)
        else:
            assert tail == 'reject'
            proposal['status'] = 'rejected'
        route.fulfill(json={'proposal': proposal})

    context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce')
    try:
        context.add_init_script('''(() => {
          const OriginalEventSource = window.EventSource;
          window.EventSource = class extends OriginalEventSource {
            constructor(...args) {
              super(...args);
              if (args[0] === '/events') window.emitSharedFixture = event => this.onmessage({ data: JSON.stringify(event) });
            }
          };
        })()''')
        context.route(
            lambda url: urlparse(url).path.split('/')[:3] == ['', 'api', 'shared-proposals'],
            shared_api,
        )
        context.route('**/api/anchor/session', lambda route: route.fulfill(json={'token': 'fixture-grant'}))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '/studio', wait_until='domcontentloaded')
        expect(page.locator('#status-text')).to_have_text('Idle')
        detached = context.new_page()
        detached.on('pageerror', lambda error: errors.append(str(error)))
        detached.goto(base + '/studio?preview=1&w=393&theme=light#02-hero', wait_until='domcontentloaded')
        frames = [page.frame_locator('#preview-frame'), detached.frame_locator('iframe')]
        for frame in frames:
            expect(frame.locator('#host-02 .body h1')).to_be_attached()
            assert frame.locator('html').evaluate("el => getComputedStyle(el).getPropertyValue('--shared-proposal-fixture').trim()") == 'before'
            frame.locator('html').evaluate("el => { el.dataset.fixtureView = 'open'; }")
        expect(frames[1].locator('html')).to_have_attribute('data-studio-theme', 'light')

        if width == 393:
            page.locator('#viewbtn').click()
            page.locator('#menu-review').click()
        else:
            page.get_by_role('tab', name='Review').click()
        panel = page.get_by_role('region', name='Shared style proposals')
        open_first = panel.get_by_role('button', name='Open proposal for 01-header')
        open_first.click()
        dialog = page.get_by_role('dialog', name='Review shared tokens')
        measure_button = dialog.get_by_role('button', name='Measure preview impact')
        approve = dialog.get_by_role('button', name='Approve…')
        close = dialog.get_by_role('button', name='Close proposal')
        expect(dialog.get_by_role('heading', name='Review shared tokens')).to_be_focused()
        assert dialog.locator('#shared-proposal-before').text_content() == BEFORE
        assert dialog.locator('#shared-proposal-after').text_content() == AFTER
        expect(dialog.locator('#shared-proposal-after img')).to_have_count(0)
        expect(dialog.locator('#shared-proposal-previous-lines')).to_have_text('− 43 --shared-proposal-fixture: before;')
        expect(dialog.locator('#shared-proposal-proposed-lines')).to_have_text('+ 43 --shared-proposal-fixture: after;')
        assert not page.evaluate('window.unsafeMarker')
        assert not evidence_reads and not mutations
        expect(approve).to_be_disabled()
        expect(measure_button).to_be_disabled()
        expect(dialog.get_by_text('Proposal actions are available when the project is idle.')).to_be_visible()
        catalog['busy'] = False
        page.evaluate("window.emitSharedFixture({type:'busy', busy:false})")
        expect(measure_button).to_be_enabled()

        with page.expect_request('**/api/shared-proposals/review'):
            measure_button.click()
        expect(dialog.get_by_text('Measuring preview impact…')).to_be_visible()
        expect(close).to_be_disabled()
        page.keyboard.press('Escape')
        expect(dialog).to_be_visible()
        measure(first, ok=False, revision='2')
        held[0].fulfill(json={'proposal': first})
        expect(dialog.get_by_text('The measured impact blocks approval.')).to_be_visible()
        expect(dialog.get_by_text('New horizontal overflow at 393 px.')).to_be_visible()
        expect(approve).to_be_disabled()
        for measured in WIDTHS:
            row = dialog.locator('#shared-proposal-widths > li').filter(has_text=f'{measured} px')
            expect(row.get_by_text('Changed sections · 02-hero')).to_be_visible()
            row.get_by_text('View before and proposed previews').click()
            for side in ('Before', 'Proposed'):
                img = row.get_by_role('img', name=f'{side} preview at {measured} px')
                img.evaluate('image => image.decode()')
                assert img.evaluate('image => image.naturalWidth') == measured
            row.get_by_text(f'View 02-hero at {measured} px').click()
            for side in ('Before', 'Proposed'):
                img = row.get_by_role('img', name=f'{side} 02-hero at {measured} px')
                img.evaluate('image => image.decode()')
        assert len(evidence_reads) == len(WIDTHS) * 4
        assert sum(read[-1] == '02-hero' for read in evidence_reads) == len(WIDTHS) * 2

        measure_button.click()
        expect(approve).to_be_enabled()
        approve.click()
        confirm = dialog.get_by_role('button', name='Confirm approval')
        expect(dialog.get_by_role('heading', name='Approve this proposal?')).to_be_focused()
        expect(dialog.locator('#shared-proposal-revision')).to_have_text('3' * 64)
        assert mutations == ['review', 'review']
        confirm.press('Enter')
        expect(dialog.get_by_text('The measured preview changed.')).to_be_visible()
        expect(confirm).to_be_disabled()
        expect(dialog.locator('#shared-proposal-revision')).to_have_text('3' * 64)
        expect(dialog.get_by_role('img')).to_have_count(0)
        dialog.get_by_role('button', name='Back').click()
        expect(approve).to_be_disabled()
        measure_button.click()
        expect(approve).to_be_enabled()
        approve.click()
        expect(dialog.locator('#shared-proposal-revision')).to_have_text('4' * 64)
        confirm.click()
        expect(dialog.get_by_text('Shared styles approved and published.')).to_be_visible()
        for studio in (page, detached):
            studio.evaluate("window.emitSharedFixture({type:'shared-style'})")
        for frame in frames:
            expect(frame.locator('link[href^="/tokens.css?swarm_shared="]')).to_be_attached()
            frame.locator('link[href^="/tokens.css?swarm_shared="]').evaluate(
                """link => link.sheet
                    ? Promise.resolve()
                    : new Promise((resolve, reject) => {
                      link.addEventListener('load', resolve, {once:true});
                      link.addEventListener('error', reject, {once:true});
                    })"""
            )
            root = frame.locator('html')
            assert root.evaluate("el => getComputedStyle(el).getPropertyValue('--shared-proposal-fixture').trim()") == 'after'
            expect(root).to_have_attribute('data-fixture-view', 'open')
        expect(frames[1].locator('html')).to_have_attribute('data-studio-theme', 'light')
        assert urlparse(detached.url).fragment == '02-hero'

        close.click()
        expect(open_first).to_be_focused()
        panel.get_by_role('button', name='Open proposal for 02-hero').click()
        dialog.get_by_role('button', name='Reject…').click()
        assert 'reject' not in mutations
        dialog.get_by_role('button', name='Confirm rejection').press('Enter')
        expect(dialog.get_by_text('Proposal rejected.')).to_be_visible()
        assert tokens.read_text() == original + '\n' + AFTER
        assert mutations == ['review', 'review', 'approve', 'review', 'approve', 'reject']
        assert dialog.locator('.studio-shared-dialog-body').evaluate('body => body.scrollWidth === body.clientWidth')
        assert not errors, errors
    finally:
        tokens.write_text(original)
        context.close()


def main():
    executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=executable, headless=True)
        try:
            with fixture() as (base, project):
                for width in (393, 1440):
                    run_case(browser, base, project, width)
                    print(f'PASS: Studio shared proposals evidence, decisions and live preview at {width}px', flush=True)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
