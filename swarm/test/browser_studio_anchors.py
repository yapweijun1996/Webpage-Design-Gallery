#!/usr/bin/env python3
"""Exercise Studio's design anchor approval flow in Chrome with a local fixture runner."""

from argparse import ArgumentParser
from contextlib import contextmanager
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import time
from urllib.error import URLError
from uuid import uuid4
import zlib

from playwright.sync_api import expect, sync_playwright

from browser_settings_skills import CHROME, SWARM, free_port
from browser_studio_versions import request


HEADING = 'Swarm design anchor fixture'


def png(width, height=200):
    def chunk(kind, contents):
        return struct.pack('>I', len(contents)) + kind + contents + struct.pack('>I', zlib.crc32(kind + contents))

    header = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    rows = b''.join(b'\x00' + (bytes([24, 77, 67]) if row < height // 4 else bytes([232, 213, 171])) * width
                    for row in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')


def state(base):
    return json.loads(request(base, '/api/anchor/state'))


@contextmanager
def fixture():
    with tempfile.TemporaryDirectory(prefix='swarm-anchor-chrome-') as tmp, tempfile.TemporaryFile() as log:
        fixture_root = Path(tmp)
        generated = fixture_root / 'generated-references'
        generated.mkdir()
        for name, width in {'desktop': 1440, 'tablet': 768, 'mobile': 393}.items():
            (generated / f'anchor.{name}.png').write_bytes(png(width))
        runner = fixture_root / 'codex-fixture'
        runner.write_text('''#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const prompt = fs.readFileSync(0, 'utf8');
if (prompt.startsWith('Create a coordinated high-fidelity website design reference')) {
  const inputs = path.join(__dirname, 'generated-references');
  for (const name of fs.readdirSync(inputs)) fs.copyFileSync(path.join(inputs, name), name);
} else {
  const text = JSON.stringify({ verdict: 'pass', score: 92, findings: ['The type and palette are coherent.'] });
  console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text } }));
}
console.log(JSON.stringify({ type: 'turn.completed' }));
''')
        runner.chmod(0o700)
        name = 'anchors-chrome-' + uuid4().hex[:12]
        project = SWARM / 'projects' / name
        port = free_port()
        base = f'http://127.0.0.1:{port}'
        env = {**os.environ, 'SWARM_PROJECT': name, 'SWARM_PORT': str(port), 'SWARM_TEST': '1',
               'SWARM_CODEX': str(runner), 'SWARM_SETTINGS': str(Path(tmp) / 'settings.json')}
        server = subprocess.Popen(['node', str(SWARM / 'server.js')], env=env, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 6
            while time.monotonic() < deadline:
                assert server.poll() is None, 'Swarm exited before serving the fixture'
                try:
                    state(base)
                    break
                except (URLError, TimeoutError):
                    time.sleep(0.05)
            else:
                raise AssertionError('Anchor API did not start')
            (project / 'review.md').write_text('Fixture review.\n')
            (project / 'sections/02-hero.html').write_text(
                f'<section class="s-02" id="02-hero"><h1>{HEADING}</h1><p>Read the page design before approval.</p></section>\n')
            (project / 'sections/02-hero.css').write_text('.s-02 { min-height: 200px; padding: 24px; }\n')
            yield base, project
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


def in_dialog(page, action):
    page.locator('#anchor-' + action).click()
    dialog = page.locator('#anchor-dialog')
    expect(dialog).to_be_visible()
    return dialog


def choose_png(dialog, size, contents):
    dialog.locator('#anchor-file-' + size).set_input_files({
        'name': size + '.png', 'mimeType': 'image/png', 'buffer': contents,
    })


def assert_dialog_layout(dialog, width):
    layout = dialog.evaluate('''dialog => {
      const body = dialog.querySelector('.studio-anchor-dialog-body');
      const top = dialog.querySelector('header');
      const footer = dialog.querySelector('footer');
      const start = [top.getBoundingClientRect().top, footer.getBoundingClientRect().bottom];
      const max = body.scrollHeight - body.clientHeight;
      body.scrollTop = max / 2;
      const middle = body.scrollTop;
      body.scrollTop = max;
      const end = body.scrollTop;
      body.scrollTop = 0;
      return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth,
               client: body.clientWidth, scroll: body.scrollWidth, middle, end,
               pinned: start[0] === top.getBoundingClientRect().top && start[1] === footer.getBoundingClientRect().bottom };
    }''')
    assert layout['viewport'] == width and layout['document'] <= width, layout
    assert layout['scroll'] <= layout['client'] and layout['pinned'], layout
    assert 0 < layout['middle'] < layout['end'], layout


def assert_anchor_comparison(page):
    compare = page.locator('#compare')
    compare.locator('input[type=file]').set_input_files({'name': 'uploaded.png', 'mimeType': 'image/png', 'buffer': png(120)})
    name = compare.locator('.studio-compare__filename')
    expect(name).to_have_text('uploaded.png')
    storage_key = 'swarm.studio.compare.reference'
    original = page.evaluate('key => localStorage.getItem(key)', storage_key)
    assert original
    page.locator('[data-anchor-breakpoint="mobile"]').click()
    page.locator('#anchor-compare').click()
    expect(name).to_have_text('Mobile design reference for v001')
    expect(compare.get_by_role('heading', name='Reference comparison')).to_be_focused()
    expect(compare.locator('iframe')).to_have_attribute('src', page.url.replace('/studio', '/studio-preview.html?w=393&h=200'))
    assert page.evaluate('key => localStorage.getItem(key)', storage_key) == original
    compare.get_by_role('button', name='Return to uploaded reference').click()
    expect(name).to_have_text('uploaded.png')
    assert page.evaluate('key => localStorage.getItem(key)', storage_key) == original


def assert_generate(page, base):
    panel = page.locator('#anchor-panel')
    expect(panel.get_by_role('button', name='Import anchor')).to_be_enabled()
    dialog = in_dialog(page, 'generate')
    expect(dialog.get_by_text('Use the configured Codex runner', exact=False)).to_be_visible()
    page.keyboard.press('Escape')
    expect(dialog).to_be_hidden()
    assert state(base)['flow']['state'] == 'generating'
    dialog = in_dialog(page, 'generate')
    with page.expect_request(lambda req: req.url.endswith('/api/anchor/generate')) as sent:
        dialog.locator('#anchor-dialog-submit').click()
    assert set(sent.value.post_data_json) == {'projectId'}
    assert sent.value.headers.get('x-swarm-anchor-token')
    expect(panel.locator('#anchor-phase')).to_have_text('Awaiting advisor review')
    expect(panel.locator('#anchor-selection')).to_have_value('v002')
    widths = {file: value['width'] for file, value in state(base)['anchors'][0]['files'].items()}
    assert widths == {'anchor.desktop.png': 1440, 'anchor.tablet.png': 768, 'anchor.mobile.png': 393}, widths


def preserve_capture_comparison(page, url, directory, output):
    sizes = {'desktop': (1440, 900), 'tablet': (768, 1024), 'mobile': (393, 844)}
    decoded = '''
const fs = require('node:fs');
const { compare } = require('./tools/anchor-qa');
const result = compare(...process.argv.slice(1).map(file => fs.readFileSync(file)), { includeImage: false });
console.log(JSON.stringify({ pass: result.pass, score: result.score, threshold: result.threshold,
  aspect: result.aspect, palette: result.palette }));
'''
    comparisons = {}
    for name, (width, height) in sizes.items():
        sample = page.context.new_page()
        independent = directory / f'{name}-independent.png'
        captured = directory / f'{name}.png'
        try:
            sample.set_viewport_size({'width': width, 'height': height})
            sample.goto(url + f'&w={width}&h={height}', wait_until='networkidle', timeout=15000)
            frame = sample.frame_locator('iframe')
            expect(frame.locator('#page > .host')).to_have_count(10)
            expect(frame.get_by_role('heading', name=HEADING, exact=True)).to_be_visible()
            frame.locator('html').evaluate('''async () => {
              await document.fonts.ready;
              await Promise.all([...document.images].map(image => image.decode()));
            }''')
            sample.screenshot(path=str(independent), animations='disabled')
        finally:
            sample.close()
        result = subprocess.run(['node', '-e', decoded, '--', str(independent), str(captured)], cwd=SWARM,
                                check=True, capture_output=True, timeout=20)
        comparisons[name] = json.loads(result.stdout)
        if output and (not comparisons[name]['pass'] or name == 'desktop'):
            shutil.copyfile(independent, output / f'qa-{name}-independent-playwright.png')
            shutil.copyfile(captured, output / f'qa-{name}-studio-capture.png')
    if output:
        (output / 'studio-anchor-capture-comparison.json').write_text(json.dumps({
            'appearance': {'theme': 'light', 'brand': 'none', 'lang': 'en'},
            'referenceSource': 'Independent Playwright screenshot of the detached Studio page',
            'actualSource': 'Runtime QA capture of the isolated Studio iframe',
            'breakpoints': comparisons,
        }, indent=2) + '\n')
    assert all(result['pass'] for result in comparisons.values()), {name: result['score'] for name, result in comparisons.items()}


def capture_references(page, base, project, output):
    page.get_by_role('button', name='Switch to light theme').click()
    url = base + '/studio.html?preview=1&theme=light&brand=none&lang=en'
    script = '''
const fs = require('node:fs');
const path = require('node:path');
const { approvedAnchor } = require('./lib/publication');
const { captureAnchorQA } = require('./lib/anchor-preview-qa');
const [projectDir, url, output] = process.argv.slice(1);
captureAnchorQA({projectDir, anchor: approvedAnchor(projectDir), previewUrl: () => url, includeEvidence: true})
  .then(({ evidence, breakpoints }) => {
    for (const name of ['desktop', 'tablet', 'mobile']) {
      fs.writeFileSync(path.join(output, name + '.png'), evidence[name].screenshot);
    }
    console.log(JSON.stringify(breakpoints.map(({name, status, score}) => ({name, status, score}))));
  }).catch(error => { console.error(error); process.exitCode = 1; });
'''
    with tempfile.TemporaryDirectory(prefix='swarm-anchor-references-') as tmp:
        result = subprocess.run(['node', '-e', script, '--', str(project), url, tmp], cwd=SWARM,
                                capture_output=True, timeout=120)
        assert result.returncode == 0, result.stderr.decode(errors='replace')
        unmatched = json.loads(result.stdout)
        assert any(item['status'] == 'fail' for item in unmatched), unmatched
        directory = Path(tmp)
        preserve_capture_comparison(page, url, directory, output)
        return {name: (directory / (name + '.png')).read_bytes() for name in ['desktop', 'tablet', 'mobile']}


def qa_case(page, base, project, output, references):
    dialog = in_dialog(page, 'import')
    for size, image in references.items():
        choose_png(dialog, size, image)
    dialog.locator('#anchor-dialog-submit').click()
    expect(page.locator('#anchor-selection')).to_have_value('v002')
    dialog = in_dialog(page, 'run-advisor')
    dialog.locator('#anchor-dialog-submit').click()
    dialog = in_dialog(page, 'approve')
    dialog.locator('#anchor-dialog-submit').click()
    dialog = in_dialog(page, 'lock')
    rule = {'columns': 1, 'typeScale': [16], 'spacingScale': [8], 'palette': ['#101422'], 'imagery': 'Use the current render.'}
    contract = {'version': 2, 'recipe': 'fixture', 'brand': 'fixture', 'tokens': {}, 'sections': [], 'owners': {},
                'rules': dict.fromkeys(references, rule)}
    dialog.get_by_label('Design contract JSON').fill(json.dumps(contract))
    dialog.locator('#anchor-dialog-submit').click()

    def pass_qa():
        dialog = in_dialog(page, 'run-qa')
        with page.expect_response(lambda response: response.url.endswith('/api/anchor/qa') and response.request.method == 'POST',
                                  timeout=120000) as received:
            dialog.locator('#anchor-dialog-submit').click()
        assert received.value.ok, received.value.status
        report = state(base)['qa']
        breakpoints = [{key: result[key] for key in ('name', 'width', 'height', 'status', 'score') if key in result}
                       for result in report['breakpoints']]
        assert {result['name']: result['status'] for result in breakpoints} == dict.fromkeys(references, 'pass'), breakpoints
        expect(page.locator('#anchor-qa-status')).to_have_text('Visual QA passed.')
        return {**{key: report[key] for key in ('anchorId', 'contractHash', 'checkedAt', 'ok', 'completeCoverage')},
                'breakpoints': breakpoints}

    pass_qa()
    expect(page.locator('#anchor-finish')).to_be_enabled()
    current = project / 'sections/02-hero.html'
    current.write_bytes(current.read_bytes() + b'<!-- Trigger a changed preview revision for QA. -->\n')
    expect(page.locator('#anchor-qa-status')).to_have_text('The preview changed after visual QA.')
    expect(page.locator('#anchor-finish')).to_be_hidden()
    report = pass_qa()
    if output:
        page.screenshot(path=str(output / 'studio-anchor-qa-1440.png'))
    dialog = in_dialog(page, 'finish')
    dialog.locator('#anchor-dialog-submit').click()
    expect(page.locator('#anchor-phase')).to_have_text('Complete')
    final_state = state(base)['flow']
    assert final_state['state'] == 'done'
    if output:
        page.screenshot(path=str(output / 'studio-anchor-final-1440.png'))
        proof = {**report, 'finalState': final_state['state'], 'referenceSource': 'Runtime QA renderer used to capture the fixture references'}
        (output / 'studio-anchor-qa.json').write_text(json.dumps(proof, indent=2) + '\n')
    current.write_bytes(current.read_bytes() + b'<!-- Trigger another changed preview revision. -->\n')
    expect(page.locator('#anchor-run-qa')).to_be_enabled()


def browser_case(browser, base, project, width, output, with_qa):
    context = browser.new_context(viewport={'width': width, 'height': 844}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(base + '/studio', wait_until='domcontentloaded')
        if width == 393:
            page.locator('#viewbtn').click()
            page.locator('#menu-review').click()
        else:
            page.get_by_role('tab', name='Review').click()
        phase = page.locator('#anchor-phase')
        expect(phase).to_have_text('Ready to set goals')
        dialog = in_dialog(page, 'goals')
        goals = dialog.get_by_label('Design goals')
        expect(goals).to_be_focused()
        goals.fill('Show a readable hierarchy.\n\nUse a calm palette.')
        page.keyboard.press('Escape')
        expect(dialog).to_be_hidden()
        expect(page.locator('#anchor-goals')).to_be_focused()
        dialog = in_dialog(page, 'goals')
        expect(goals).to_have_value('Show a readable hierarchy.\n\nUse a calm palette.')
        dialog.locator('#anchor-dialog-submit').click()
        expect(phase).to_have_text('Ready for references')
        assert state(base)['flow']['goals'] == ['Show a readable hierarchy.', 'Use a calm palette.']

        dialog = in_dialog(page, 'import')
        desktop, mobile = png(1440), png(393)
        choose_png(dialog, 'desktop', png(700))
        dialog.locator('#anchor-dialog-submit').click()
        expect(dialog.get_by_role('status')).to_contain_text('must be 1440 pixels wide')
        choose_png(dialog, 'desktop', desktop)
        choose_png(dialog, 'mobile', mobile)
        dialog.locator('#anchor-dialog-submit').click()
        expect(phase).to_have_text('Awaiting advisor review')
        expect(page.locator('#anchor-image')).to_have_js_property('naturalWidth', 1440)
        expect(page.locator('#anchor-approve')).to_be_hidden()
        assert request(base, '/api/anchor/image/v001/desktop') == desktop

        dialog = in_dialog(page, 'run-advisor')
        with page.expect_request(lambda req: req.url.endswith('/api/anchor/advisor')) as sent:
            dialog.locator('#anchor-dialog-submit').click()
        payload = sent.value.post_data_json
        assert payload['anchorId'] == 'v001' and set(payload) == {'anchorId', 'projectId'}, payload
        assert sent.value.headers.get('x-swarm-anchor-token')
        expect(phase).to_have_text('Awaiting approval', timeout=12000)
        expect(page.locator('#anchor-advisor-status')).to_have_text('Advisor passed · Score 92')
        page.locator('[data-anchor-breakpoint="mobile"]').click()
        expect(page.locator('#anchor-image')).to_have_js_property('naturalWidth', 393)
        expect(page.locator('#anchor-approve')).to_be_disabled()
        page.locator('[data-anchor-breakpoint="desktop"]').click()
        dialog = in_dialog(page, 'approve')
        with page.expect_request(lambda req: req.url.endswith('/api/anchor/approve')) as sent:
            dialog.locator('#anchor-dialog-submit').click()
        assert sent.value.post_data_json['sha256'] == sha256(desktop).hexdigest()
        expect(phase).to_have_text('Approved · Ready to lock')
        expect(page.locator('#anchor-approval')).to_have_text('Approved by owner')
        dialog = in_dialog(page, 'lock')
        editor = dialog.get_by_label('Design contract JSON')
        expect(editor).to_be_focused()
        rule = {'columns': 1, 'typeScale': [16, 24], 'spacingScale': [8, 16], 'palette': ['#184d43'], 'imagery': 'Use a calm reference.'}
        contract = {'version': 1, 'recipe': 'fixture', 'brand': 'fixture', 'tokens': {}, 'sections': [], 'owners': {},
                    'rules': {'desktop': rule}}
        invalid = json.dumps(contract, indent=2)
        editor.fill(invalid)
        dialog.locator('#anchor-dialog-submit').click()
        expect(dialog.get_by_role('status')).to_contain_text('rules for every supplied breakpoint')
        expect(editor).to_have_value(invalid)
        editor.evaluate("element => { element.style.height = '1200px'; }")
        assert_dialog_layout(dialog, width)
        editor.evaluate("element => { element.style.height = ''; }")
        contract['rules']['mobile'] = rule
        editor.fill(json.dumps(contract, indent=2))
        dialog.locator('#anchor-dialog-submit').click()
        expect(phase).to_have_text('Locked')
        expect(page.locator('#anchor-lock')).to_be_hidden()
        frozen = (project / 'anchors/v001/contract.json').read_bytes()
        assert (project / 'contract.json').read_bytes() == frozen
        assert json.loads(frozen)['anchorSha256']['anchor.desktop.png'] == sha256(desktop).hexdigest()
        if output:
            page.screenshot(path=str(output / f'studio-anchors-{width}.png'))
        assert_anchor_comparison(page)

        references = capture_references(page, base, project, output) if width == 1440 and with_qa else None

        dialog = in_dialog(page, 'unlock')
        dialog.get_by_label('Reason').fill('Review an updated direction.')
        dialog.locator('#anchor-dialog-submit').click()
        expect(phase).to_have_text('Ready for references')
        expect(page.locator('#anchor-selection')).to_have_value('v001')
        expect(page.locator('#anchor-compare')).to_be_visible()
        assert (project / 'anchors/v001/contract.json').read_bytes() == frozen
        assert state(base)['anchors'][0]['status'] == 'superseded'
        if references:
            qa_case(page, base, project, output, references)
        if width == 393:
            assert_generate(page, base)
        assert not errors, errors
    finally:
        context.close()


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--qa', action='store_true', help='Also capture all three viewports and verify final approval.')
    args = parser.parse_args()
    output = os.environ.get('SWARM_ANCHOR_EVIDENCE')
    if output:
        output = Path(output)
        output.mkdir(parents=True, exist_ok=True)
    executable = os.environ.get('GALLERY_CHROME') or (str(CHROME) if CHROME.exists() else None)
    with sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=executable, headless=True)
        for width in [393, 1440]:
            with fixture() as (base, project):
                browser_case(browser, base, project, width, output, args.qa)
                print(f'PASS: Studio anchor approval, lock, comparison and unlock at {width}px', flush=True)
                if width == 1440 and args.qa:
                    print('PASS: Studio three-viewport QA, stale evidence, and final approval', flush=True)
        browser.close()


if __name__ == '__main__':
    main()
