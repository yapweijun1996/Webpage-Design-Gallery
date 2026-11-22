#!/usr/bin/env node
'use strict';
// Screenshot a URL with headless Chrome so ANY agent (codex or pi) can look at the real rendering.
//   node swarm/tools/shot.js <url> [width=393] [height=844] [out=/tmp/swarm-shot.png]
// Then view the PNG with your image-capable read tool. The #section hash scrolls to a section.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EXPORT } = require('../lib/preview');

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

function main(argv) {
  const [url, w = '393', h = '844', out = '/tmp/swarm-shot.png'] = argv;
  const m = url && /^(https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?)(\/[^#]*)(?:#([\w-]{1,100}))?$/.exec(url);
  if (!m || m[2] !== EXPORT) { console.error('usage: shot.js <http://127.0.0.1:PORT' + EXPORT + '[#section-id]> [width] [height] [out.png]'); return 1; }
  const width = Number(w), height = Number(h);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 200 || width > 3000 || height < 200 || height > 4000) { console.error('width and height must be integers (200-3000, 200-4000)'); return 1; }
  const chrome = findChrome();
  if (!chrome) { console.error('Chrome not found; set CHROME_BIN'); return 2; }
  // The swarm server's /frame page embeds the page in an iframe of the EXACT width (headless windows are at least ~500px wide,
  // so a phone width would otherwise be laid out wider and cropped) and scrolls it to the #section.
  const target = `${m[1]}/frame?w=${width}&h=${height}&src=${encodeURIComponent(m[2])}${m[3] ? '&at=' + encodeURIComponent(m[3]) : ''}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-shot-'));
  try {
    const r = spawnSync(chrome, buildArgs(target, Math.max(width, 500), height, out, profile), { stdio: 'ignore', timeout: 45000 });
    if (r.status !== 0 || !fs.existsSync(out)) { console.error('screenshot failed (is the swarm server running with the /frame route?)'); return 3; }
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
  console.log(`${out} (${fs.statSync(out).size} bytes, ${width}x${height})`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { buildArgs, findChrome, main };
