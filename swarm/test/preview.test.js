'use strict';

const assert = require('node:assert/strict');
const { execFile, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { createServer } = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const test = require('node:test');
const { promisify } = require('node:util');
const vm = require('node:vm');
const { createPreview, EXPORT } = require('../lib/preview');
const { findChrome } = require('../tools/shot');
const { startChrome } = require('../tools/impact-check');
const { compare } = require('../tools/visual-compare');

const SWARM = path.join(__dirname, '..');
const ORIGIN = 'http://swarm-preview.test';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-preview-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project');
  const ui = path.join(SWARM, 'ui');
  const designSystem = path.join(SWARM, 'design-system');
  function write(name, source) {
    const file = path.join(project, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }

  write('tokens.css', ':root { --dc-bg: #fff; --dc-ink: #111; }');
  write('sections/01-hero.html', `<section id="01-hero" class="s-01">
    <h1 id="hero-heading" data-i18n="fixture.heading">Morning trail</h1>
    <button id="walk" type="button" onclick="this.textContent='Walk started'">Walk</button>
    <details><summary>Trail notes</summary><p>Bring water.</p></details>
    <a href="#02-end">Skip to the end</a>
  </section>`);
  write('sections/01-hero.css', `.s-01 { min-height: 110vh; padding: 12px; background: var(--sds-color-bg); }
    @media (max-width: 500px) { .s-01 { padding: 24px; } }`);
  write('sections/01-hero.polish.css', '.s-01 button { color: rgb(17, 90, 30); }');
  write('sections/02-end.html', '<section id="02-end" class="s-02"><h2 id="end-heading">Trail complete</h2></section>');
  write('sections/02-end.css', '.s-02 { min-height: 110vh; padding: 12px; }');
  write('i18n/ms.json', JSON.stringify({ messages: { 'fixture.heading': 'Denai pagi' } }));
  execFileSync(process.execPath, [path.join(SWARM, 'tools', 'export-page.js'), project, '--no-pwa'], { stdio: 'pipe' });
  const preview = createPreview({ ui, project, designSystem, library: root, mall: root });

  function response(url, headers = {}, method = 'GET', origin = ORIGIN) {
    const result = {};
    const handled = preview({ url, method, headers }, {
      writeHead(status, headers) { Object.assign(result, { status, headers }); },
      end(body) { result.body = Buffer.from(body); },
    }, origin);
    return handled ? result : null;
  }
  return { root, project, ui, designSystem, response, write };
}

test('preview routes apply an opaque sandbox and limit readable resources', t => {
  const { response, project, root } = fixture(t);
  const isolated = link => response(link).headers['Content-Security-Policy'];
  assert.match(isolated('/studio'), /frame-src http:\/\/swarm-preview\.test\/studio-preview\.html;/);
  assert.match(isolated('/studio-preview.html'), /(?:^|; )sandbox allow-scripts;/);
  assert.match(isolated('/p/dist/preview.html'), /(?:^|; )sandbox allow-scripts;/);
  for (const route of ['/studio-preview.html', '/p/dist/preview.html']) {
    const policy = isolated(route);
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /form-action 'none'/);
    assert.match(policy, /worker-src 'none'/);
    assert.match(policy, /frame-src 'none'/);
    assert.doesNotMatch(policy, /allow-same-origin|allow-top-navigation|allow-popups|\/api\/|\/events/);
  }
  const shot = response('/frame?src=' + encodeURIComponent(EXPORT) + '&at=02-end&w=393');
  assert.equal(shot.status, 200);
  assert.match(shot.body.toString(), /sandbox="allow-scripts" referrerpolicy="no-referrer" src="\/p\/dist\/preview\.html#02-end"/);
  assert.match(shot.headers['Content-Security-Policy'], /frame-src http:\/\/swarm-preview\.test\/p\/dist\/preview\.html;/);
  assert.equal(response('/frame?src=/p/sections/01-hero.html').status, 400);
  assert.equal(response(EXPORT).body.includes(Buffer.from('sandbox="allow-scripts"')), true);
  assert.equal(response('/p/dist/preview.html', { 'sec-fetch-dest': 'document' }).body.includes(Buffer.from('sandbox="allow-scripts"')), true);
  const opaque = { origin: 'null' };
  assert.match(response('/p/sections/01-hero.html', opaque).headers['Content-Type'], /^text\/plain/);
  assert.match(response('/p/sections/01-hero.bundle.css', opaque).body.toString(), /layer: polish/);
  assert.equal(response('/i18n/ms.json', opaque).headers['Access-Control-Allow-Origin'], 'null');
  assert.equal(response('/studio', opaque), null);
  assert.equal(response('/p/dist/preview.html', opaque), null);
  assert.equal(response('/p/sections/01-hero.html', opaque, 'POST'), null);

  const outside = path.join(root, 'unrelated.css');
  fs.writeFileSync(outside, 'body { color: gray; }');
  fs.symlinkSync(outside, path.join(project, 'sections', 'linked.css'));
  assert.equal(response('/p/sections/linked.css', opaque).status, 404);
});

test('the bridge checks rendering data and closes the previous frame channel', () => {
  const window = {};
  const channels = [];
  class Channel {
    constructor() {
      this.port1 = {
        sent: [],
        postMessage(message) { this.sent.push(message); },
        close() { this.closed = true; }
      };
      this.port2 = {};
      channels.push(this);
    }
  }
  vm.runInNewContext(fs.readFileSync(path.join(SWARM, 'ui/preview-bridge.js'), 'utf8'), {
    window, URL, MessageChannel: Channel, location: { origin: ORIGIN, href: ORIGIN + '/studio' }
  });

  let load;
  const messages = [];
  const received = [];
  const frame = {
    src: ORIGIN + '/studio-preview.html',
    setAttribute(name, value) { this[name] = value; },
    addEventListener(_type, handler) { load = handler; },
    removeEventListener() { load = undefined; },
    contentWindow: { postMessage(...args) { messages.push(args); } },
  };
  const bridge = window.StudioPreview;
  const send = bridge.connect(frame, (...data) => received.push(data), () => send('appearance', { theme: 'light' }));
  assert.equal(frame.sandbox, 'allow-scripts');
  load();
  assert.equal(messages[0][0], bridge.handshake);
  assert.equal(messages[0][2][0], channels[0].port2);
  assert.equal(channels[0].port1.sent[0][0], 'appearance');
  channels[0].port1.onmessage({ data: ['scope', null] });
  assert.deepEqual(received, [['scope', null]]);

  load();
  assert.equal(channels[0].port1.closed, true);
  channels[0].port1.onmessage({ data: ['scope', null] });
  assert.equal(received.length, 1);
  send.close();
  assert.equal(channels[1].port1.closed, true);

  const summary = { section: '01', tag: 'h1', text: 'Morning trail', path: 'section > h1', rect: { top: 0, left: 0, bottom: 20, right: 100 } };
  assert.equal(bridge.element(summary, ['01'], true).tag, 'h1');
  assert.equal(bridge.element(summary, ['02'], true), null);
  assert.equal(bridge.element({ ...summary, rect: { ...summary.rect, right: -100 } }, ['01'], true), null);
});

const chromePath = findChrome();

test('Studio, agent captures, Compare and the export render in opaque frames in Chrome', {
  skip: process.env.SWARM_PREVIEW_CHROME_TEST !== '1' ? 'Set SWARM_PREVIEW_CHROME_TEST=1 to run the Chrome fixture' :
    chromePath ? false : 'Chrome is unavailable',
}, async t => {
  const { root, ui, designSystem, response } = fixture(t);
  const evidence = process.env.SWARM_PREVIEW_EVIDENCE;
  if (evidence) fs.mkdirSync(evidence, { recursive: true });
  function saveEvidence(name, png) {
    if (evidence) fs.writeFileSync(path.join(evidence, name + '.png'), png);
  }
  const browser = startChrome(chromePath, path.join(root, 'chrome'), 1440);
  try {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => browser.send(method, params, sessionId);
    const sessions = new Map();
    const errors = [];
    const posts = [];
    const state = { project: 'Preview fixture', phase: 'idle', agents: {
      '01': { id: '01', section: 'hero', name: 'Trail', color: '#299951', status: 'working' },
      '02': { id: '02', section: 'end', name: 'Journal', color: '#294799', status: 'idle' },
    }, feed: [] };
    const data = {
      '/events': ['text/event-stream', 'data: ' + JSON.stringify({ type: 'state', state }) + '\n\n'],
      '/api/state': ['application/json', JSON.stringify(state)],
      '/api/autopilot': ['application/json', '{"on":false}'],
      '/api/squad': ['application/json', '{"on":false}'],
      '/api/chat': ['application/json', '{"messages":[]}'],
      '/api/focus': ['application/json', '{"on":true}'],
    };
    function lookup(url, headers, method) {
      const result = response(url.pathname + url.search, headers, method, url.origin);
      let status = result?.status ?? 404;
      let content = result?.body ?? Buffer.alloc(0);
      let responseHeaders = result?.headers ?? {};
      if (!result && headers.origin && headers.origin !== url.origin) {
        status = 403;
      } else if (!result && data[url.pathname]) {
        status = 200;
        content = Buffer.from(data[url.pathname][1]);
        if (url.pathname === '/api/autopilot' && method === 'POST') content = Buffer.from('{"on":true}');
        responseHeaders = { 'Content-Type': data[url.pathname][0] };
      } else if (!result && /^\/(?:ds\/)?[\w-]+\.(?:js|css)$/.test(url.pathname)) {
        const file = url.pathname.startsWith('/ds/') ? path.join(designSystem, url.pathname.slice(4)) : path.join(ui, url.pathname.slice(1));
        if (fs.existsSync(file)) {
          status = 200;
          content = fs.readFileSync(file);
          responseHeaders = { 'Content-Type': file.endsWith('.css') ? 'text/css' : 'text/javascript' };
        }
      }
      return { status, content, responseHeaders };
    }
    async function serveRequest(send, { requestId, request }) {
      const url = new URL(request.url);
      if (url.origin !== ORIGIN) return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key.toLowerCase(), value]));
      if (request.method === 'POST' && request.postData) posts.push([url.pathname, JSON.parse(request.postData)]);
      const { status, content, responseHeaders } = lookup(url, headers, request.method);
      return send('Fetch.fulfillRequest', {
        requestId, responseCode: status, body: content.toString('base64'),
        responseHeaders: Object.entries(responseHeaders).map(([name, value]) => ({ name, value })),
      });
    }

    async function observe(id) {
      const send = (method, params) => browser.send(method, params, id);
      const contexts = new Map();
      sessions.set(id, contexts);
      browser.events.on(id + ':Runtime.executionContextCreated', ({ context }) => {
        if (context.auxData?.isDefault) contexts.set(context.auxData.frameId, context.uniqueId);
      });
      browser.events.on(id + ':Runtime.executionContextDestroyed', ({ executionContextUniqueId }) => {
        for (const [frameId, uniqueId] of contexts) {
          if (uniqueId === executionContextUniqueId) contexts.delete(frameId);
        }
      });
      browser.events.on(id + ':Runtime.executionContextsCleared', () => contexts.clear());
      browser.events.on(id + ':Runtime.exceptionThrown', ({ exceptionDetails }) => {
        errors.push(exceptionDetails.exception?.description || exceptionDetails.text);
      });
      browser.events.on(id + ':Log.entryAdded', ({ entry }) => {
        if (entry.level === 'error' && entry.source === 'security') errors.push(entry.text);
      });
      browser.events.on(id + ':Fetch.requestPaused', request => {
        serveRequest(send, request).catch(error => errors.push(error.message));
      });
      await Promise.all([
        send('Page.enable'), send('Runtime.enable'), send('Log.enable'),
        send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }),
      ]);
    }

    // Sandboxed frames can have separate CDP sessions. Install the same offline interception before resuming them.
    browser.events.on(sessionId + ':Target.attachedToTarget', ({ sessionId: id }) => {
      observe(id).then(() => browser.send('Runtime.runIfWaitingForDebugger', {}, id))
        .catch(error => { if (sessions.has(id)) errors.push(error.message); });
    });
    browser.events.on(sessionId + ':Target.detachedFromTarget', ({ sessionId: id }) => sessions.delete(id));
    await observe(sessionId);
    await send('Target.setAutoAttach', {
      autoAttach: true, waitForDebuggerOnStart: true, flatten: true, filter: [{ type: 'iframe' }, { exclude: true }],
    });

    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, mobile: false, deviceScaleFactor: 1 });
    const evalIn = async (expression, context) => {
      const result = await browser.send('Runtime.evaluate', {
        expression, uniqueContextId: context?.uniqueId, returnByValue: true, awaitPromise: true,
      }, context?.id ?? sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || expression);
      return result.result.value;
    };
    async function until(check, label) {
      for (let i = 0; i < 80; i++) {
        const result = await check();
        if (result) return result;
        await delay(50);
      }
      assert.fail(label + (errors.length ? '\n' + errors.join('\n') : ''));
    }
    async function child(fragment) {
      for (const [id, contexts] of sessions) {
        const { frameTree } = await browser.send('Page.getFrameTree', {}, id).catch(error => {
          if (sessions.has(id)) throw error;
          return {};
        });
        const frames = id === sessionId ? frameTree.childFrames ?? [] : [frameTree];
        const frame = frames.find(item => item?.frame.url.includes(fragment))?.frame;
        const uniqueId = frame && contexts.get(frame.id);
        if (uniqueId) return { id, uniqueId };
      }
    }

    await send('Page.navigate', { url: ORIGIN + '/studio' });
    const stage = await until(async () => {
      const context = await child('/studio-preview.html');
      return context && await evalIn("!!document.querySelector('#walk')", context) && context;
    }, 'Studio preview never rendered');
    assert.equal(await evalIn('window.origin', stage), 'null');
    assert.deepEqual(await evalIn("Array.from(document.querySelector('#preview-frame').sandbox)"), ['allow-scripts']);
    assert.equal(await evalIn("document.querySelector('#preview-frame').contentDocument"), null);
    assert.equal(await evalIn("getComputedStyle(document.querySelector('#walk')).color", stage), 'rgb(17, 90, 30)');
    assert.equal(await evalIn("document.querySelector('#walk').click(); document.querySelector('#walk').textContent", stage), 'Walk started');
    await evalIn("SDS.theme.set('light'); SDS.brand.set('forest-gold'); SDS.lang.set('ms'); true");
    await until(() => evalIn("document.documentElement.dataset.theme === 'light' && document.documentElement.dataset.brand === 'forest-gold' && document.querySelector('h1').textContent === 'Denai pagi'", stage), 'Appearance never synchronized');
    const renderedHero = `(() => {
      const hero = document.getElementById('01-hero');
      const style = getComputedStyle(hero);
      const button = document.getElementById('walk');
      return [hero.querySelector('h1').textContent, style.backgroundColor, style.padding, getComputedStyle(button).color];
    })()`;
    const desktopHero = await evalIn(renderedHero, stage);
    assert.deepEqual(desktopHero, ['Denai pagi', 'rgb(251, 247, 235)', '12px', 'rgb(17, 90, 30)']);
    await evalIn("document.querySelector('#focusbtn').click(); document.querySelector('#swfocus').click(); true");
    await until(() => evalIn("/01 hero/.test(document.querySelector('#prompt-scope').textContent)"), 'Focus scope never reached the parent composer');
    await evalIn("document.querySelector('#pick').click(); true");
    await until(() => evalIn("document.body.classList.contains('picking')", stage), 'Picking was never armed');
    const bounds = await evalIn("document.querySelector('#walk').getBoundingClientRect().toJSON()", stage);
    const box = await evalIn("document.querySelector('#preview-frame').getBoundingClientRect().toJSON()");
    const x = box.left + (bounds.left + bounds.width / 2) * box.width / 1440;
    const y = box.top + (bounds.top + bounds.height / 2) * box.width / 1440;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await until(() => evalIn("!document.querySelector('#askpop').hidden && document.querySelector('#askpop .ae').textContent.includes('Walk started')"), 'Picking never opened the owner prompt');
    assert.match(await evalIn("document.querySelector('#prompt-scope').textContent"), /01 hero/);
    const selectedAppearance = { theme: 'light', brand: 'forest-gold', lang: 'ms' };
    await evalIn("document.querySelector('#asktext').value = 'Make the button easier to read'; document.querySelector('#askpop').requestSubmit(); true");
    const pickedRequest = await until(() => posts.find(([route]) => route === '/api/chat')?.[1], 'Element request was never submitted');
    assert.deepEqual(pickedRequest.scope.appearance, selectedAppearance);
    await evalIn("document.querySelector('#composer textarea').value = 'Review this screen'; document.querySelector('#composer form').requestSubmit(); true");
    const composerRequest = await until(() => posts.find(([route, data]) => route === '/api/chat' && data.text === 'Review this screen')?.[1], 'Scoped composer request was never submitted');
    assert.deepEqual(composerRequest.scope.appearance, selectedAppearance);
    await evalIn("document.querySelector('#swauto').click(); true");
    const initialFocus = await until(() => posts.find(([route]) => route === '/api/focus')?.[1], 'Autopilot focus was never submitted');
    assert.deepEqual(initialFocus.appearance, selectedAppearance);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await evalIn("SDS.theme.set('auto'); true");
    const changedFocus = await until(() => posts.find(([route, data]) => route === '/api/focus' && data.appearance.theme === 'dark')?.[1], 'Autopilot focus missed an appearance-only update');
    assert.deepEqual(changedFocus.sections, initialFocus.sections);
    await evalIn("SDS.theme.set('light'); true");
    await send('Emulation.setEmulatedMedia', { features: [] });

    await evalIn(`(async () => {
      document.querySelector('#compare-btn').click();
      const canvas = document.createElement('canvas');
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const files = new DataTransfer();
      files.items.add(new File([blob], 'fixture.png', { type: 'image/png' }));
      const input = document.querySelector('.studio-compare input[type="file"]');
      input.files = files.files;
      input.dispatchEvent(new Event('change'));
    })()`);
    await until(async () => {
      const context = await child('/studio-preview.html?w=');
      return context && await evalIn("window.origin === 'null' && document.querySelector('#hero-heading')?.textContent === 'Denai pagi'", context);
    }, 'Compare preview never rendered');
    assert.deepEqual(await evalIn("Array.from(document.querySelector('.studio-compare__frame').sandbox)"), ['allow-scripts']);

    await send('Page.navigate', { url: ORIGIN + '/studio.html?preview=1&w=393' });
    const detached = await until(async () => {
      const context = await child('/studio-preview.html');
      return context && await evalIn("window.origin === 'null' && innerWidth === 393 && document.querySelector('h1')?.textContent === 'Denai pagi'", context) && context;
    }, 'Detached preview never rendered at phone width');
    const phoneHero = await evalIn(renderedHero, detached);
    assert.deepEqual(phoneHero, ['Denai pagi', 'rgb(251, 247, 235)', '24px', 'rgb(17, 90, 30)']);

    for (const [width, height, expected] of [[393, 844, phoneHero], [768, 1024, desktopHero], [1440, 900, desktopHero]]) {
      const route = `/studio.html?preview=1&w=${width}&h=${height}&theme=light&brand=forest-gold&lang=ms#02-end`;
      await send('Page.navigate', { url: ORIGIN + route });
      const capture = await until(async () => {
        const context = await child('/studio-preview.html');
        return context && await evalIn(`window.origin === 'null' && innerWidth === ${width} && innerHeight === ${height} &&
          document.querySelector('h1')?.textContent === 'Denai pagi' &&
          Math.abs(document.getElementById('02-end')?.getBoundingClientRect().top) < 2`, context) && context;
      }, `Live screenshot preview never rendered at ${width}×${height}`);
      assert.deepEqual(await evalIn(renderedHero, capture), expected);
      await evalIn("location.hash = '01-hero'; true");
      await until(() => evalIn('Math.abs(document.getElementById("01-hero").getBoundingClientRect().top) < 2', capture), 'Preview did not follow the changed anchor');
      if (width !== 768) {
        const app = createServer((req, res) => {
          const url = new URL(req.url, 'http://' + req.headers.host);
          const { status, content, responseHeaders } = lookup(url, req.headers, req.method);
          res.writeHead(status, responseHeaders).end(content);
        });
        await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
        try {
          const output = path.join(root, 'agent-shot.png');
          const url = `http://127.0.0.1:${app.address().port}${route.replace('#02-end', '#01-hero')}`;
          await promisify(execFile)(process.execPath, [path.join(SWARM, 'tools', 'shot.js'), url, width, height, output], { timeout: 25_000 });
          const picture = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
          const agentPng = fs.readFileSync(output);
          const detachedPng = Buffer.from(picture.data, 'base64');
          assert.equal(compare(agentPng, detachedPng).differentRatio, 0);
          saveEvidence(`agent-${width}`, agentPng);
          saveEvidence(`detached-studio-${width}`, detachedPng);
        } finally {
          app.closeAllConnections();
          await new Promise(resolve => app.close(resolve));
        }
      }
    }

    await send('Page.navigate', { url: ORIGIN + '/frame?src=' + encodeURIComponent(EXPORT) + '&at=02-end&w=393&h=844' });
    const exported = await until(async () => {
      const context = await child('/p/dist/preview.html');
      return context && await evalIn("document.readyState === 'complete' && Math.abs(document.getElementById('02-end')?.getBoundingClientRect().top) < 2", context) && context;
    }, 'Screenshot preview never scrolled to the selected section');
    assert.deepEqual(await evalIn('[window.origin, innerWidth, innerHeight]', exported), ['null', 393, 844]);
    const png = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 393, height: 844, scale: 1 } });
    assert.equal(Buffer.from(png.data, 'base64').readUInt32BE(16), 393);
    assert.equal(Buffer.from(png.data, 'base64').readUInt32BE(20), 844);

    if (evidence) {
      await send('Emulation.setDeviceMetricsOverride', { width: 2250, height: 1250, mobile: false, deviceScaleFactor: 1 });
      await send('Page.navigate', { url: ORIGIN + '/studio' });
      await until(async () => {
        const context = await child('/studio-preview.html');
        return context && await evalIn("document.querySelector('h1')?.textContent === 'Denai pagi'", context);
      }, 'Studio evidence preview never loaded');
      for (const [device, width, height] of [['mobile', 393, 844], ['desktop', 1440, 900]]) {
        const { x, y } = await evalIn(`(() => {
          document.querySelector('[data-device=${device}]').click();
          const frame = document.getElementById('preview-frame');
          frame.style.height = '${height}px';
          const { left, top } = frame.getBoundingClientRect();
          return { x: Math.round(left), y: Math.round(top) };
        })()`);
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 } });
        saveEvidence(`studio-region-${width}`, Buffer.from(shot.data, 'base64'));
      }
    }
  } finally {
    await browser.close();
  }
});
