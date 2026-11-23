#!/usr/bin/env node
'use strict';
// Screenshot a URL with headless Chrome so ANY agent (codex or pi) can look at the real rendering.
//   node swarm/tools/shot.js <url> [width=393] [height=844] [out=/tmp/swarm-shot.png]
// Then view the PNG with your image-capable read tool. The #section hash scrolls to a section.
const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const { setTimeout: delay } = require('node:timers/promises');
const { EXPORT } = require('../lib/preview');
const { decodePng } = require('./anchor-qa');
const LIVE = '/studio.html?preview=1';
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const PNG_END = Buffer.from('0000000049454e44ae426082', 'hex');
const CAPTURE_TIMEOUT = 45_000;

const CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function findChrome() { return CANDIDATES.find(p => fs.existsSync(p)); }

function buildArgs(url, width, height, out, profile) {
  return ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--disable-background-networking', '--use-mock-keychain', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
    `--window-size=${width},${height}`, '--virtual-time-budget=4000', `--screenshot=${out}`, url];
}

function completedPng(file) {
  let png;
  try { png = fs.readFileSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE) || !png.subarray(-12).equals(PNG_END)) return false;
  decodePng(png);
  return true;
}

async function capture(chrome, args, output, signal) {
  const processGroup = process.platform !== 'win32';
  const child = spawn(chrome, args, { detached: processGroup, stdio: 'ignore' });
  let exit;
  const exited = new Promise(resolve => {
    child.once('error', error => { exit = error; resolve(); });
    child.once('exit', (code, killedBy) => {
      exit = new Error(`Chrome exited (${killedBy ?? code}) before writing a complete PNG`);
      resolve();
    });
  });
  function terminate(killSignal) {
    if (!child.pid) return;
    try {
      if (processGroup) process.kill(-child.pid, killSignal);
      else child.kill(killSignal);
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  try {
    const deadline = performance.now() + CAPTURE_TIMEOUT;
    while (performance.now() < deadline) {
      signal?.throwIfAborted();
      // Chrome can finish writing the image while its headless process stays alive.
      if (completedPng(output)) return;
      if (exit) throw exit;
      await delay(50, undefined, { signal });
    }
    throw new Error('Timed out waiting for a complete PNG');
  } finally {
    if (!exit) {
      terminate('SIGTERM');
      const force = setTimeout(() => terminate('SIGKILL'), 1000);
      try { await exited; }
      finally { clearTimeout(force); }
    }
    if (processGroup) terminate('SIGKILL');
  }
}

async function main(argv, signal) {
  const [url, w = '393', h = '844', out = '/tmp/swarm-shot.png'] = argv;
  const m = url && /^(https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?)(\/[^#]*)(?:#([\w-]{1,100}))?$/.exec(url);
  const source = m && URL.parse(url);
  const live = source?.pathname === '/studio.html' && source.searchParams.get('preview') === '1';
  if (!source || (!live && m[2] !== EXPORT)) {
    console.error('usage: shot.js <http://127.0.0.1:PORT' + LIVE + '[#section-id]> [width] [height] [out.png]');
    return 1;
  }
  const width = Number(w), height = Number(h);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 200 || width > 3000 || height < 200 || height > 4000) { console.error('width and height must be integers (200-3000, 200-4000)'); return 1; }
  const chrome = findChrome();
  if (!chrome) { console.error('Chrome not found; set CHROME_BIN'); return 2; }
  // Lay out the detached Studio frame at the exact dimensions even if Chrome enforces a wider minimum viewport.
  const target = new URL(live ? LIVE : '/frame', m[1]);
  target.searchParams.set('w', width);
  target.searchParams.set('h', height);
  if (live) {
    for (const key of ['theme', 'brand', 'lang']) {
      if (source.searchParams.has(key)) target.searchParams.set(key, source.searchParams.get(key));
    }
    if (m[3]) target.hash = m[3];
  } else {
    target.searchParams.set('src', EXPORT);
    if (m[3]) target.searchParams.set('at', m[3]);
  }
  let scratch;
  try {
    const destination = path.resolve(out);
    scratch = fs.mkdtempSync(path.join(path.dirname(destination), '.swarm-shot-'));
    const png = path.join(scratch, 'capture.png');
    const profile = path.join(scratch, 'profile');
    await capture(chrome, buildArgs(target.href, width, height, png, profile), png, signal);
    signal?.throwIfAborted();
    fs.renameSync(png, destination);
  } catch (error) {
    console.error(`screenshot failed: ${signal?.aborted ? signal.reason.message : error.message}`);
    return 3;
  } finally {
    if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
  }
  console.log(`${out} (${fs.statSync(out).size} bytes, ${width}x${height})`);
  return 0;
}

if (require.main === module) {
  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => controller.abort(new Error(`Interrupted by ${signal}`)));
  }
  main(process.argv.slice(2), controller.signal).then(code => {
    process.exitCode = code;
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 3;
  });
}
module.exports = { buildArgs, findChrome, main };
