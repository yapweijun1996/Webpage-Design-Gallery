import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { icon, registry } from '../demos/corporate/gjh/v11/assets/icons.js';

const root = new URL('../', import.meta.url);
const v11 = new URL('../demos/corporate/gjh/v11/', import.meta.url);
const required = ['run', 'sit', 'pick-up', 'door', 'lift', 'theme', 'camera',
  'shopping-bag', 'cart', 'map-pin', 'search', 'quality-inspection',
  'help-circle', 'close', 'download', 'refresh'];

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return entry.name === 'vendor' ? [] : sources(new URL(`${entry.name}/`, dir));
    return /\.(?:html|js|css)$/.test(entry.name) && !entry.name.includes('.bundle.')
      ? [new URL(entry.name, dir)] : [];
  });
}

// Unlike a blanket non-ASCII check, this allows translated copy, punctuation,
// mathematical signs and keyboard labels. Copyright/trademark signs are text.
const isPictograph = ch => /\p{Extended_Pictographic}/u.test(ch) && !'©®™'.includes(ch);

test('v11 source contains no emoji or decorative icon glyphs', () => {
  for (const file of sources(v11)) {
    const text = readFileSync(file, 'utf8');
    const found = [...text].find(isPictograph);
    assert.equal(found, undefined, `${fileURLToPath(file)} contains pictograph ${found}`);
    assert.doesNotMatch(text, /[←→↑↓↗↘↙↖✓✕✖]/u, `${fileURLToPath(file)} contains an icon glyph`);
  }
});

test('registry contains the required Studio SVGs and is used by v11 UI', () => {
  assert.equal(typeof icon, 'function');
  for (const name of required) {
    assert.equal(typeof registry[name], 'string', `missing ${name}`);
    assert.match(registry[name], /^<svg\b[\s\S]*<\/svg>\s*$/);
  }
  const uiSources = sources(v11).filter(file => /\.(?:html|js)$/.test(file.pathname) && !file.pathname.endsWith('/icons.js'));
  assert.ok(uiSources.some(file => /\bicon\s*\(/.test(readFileSync(file, 'utf8'))), 'v11 UI must call icon()');
  assert.ok(uiSources.some(file => /\bimport\s*\{[^}]*\bicon\b[^}]*\}\s*from\s*['"][^'"]*icons\.js['"]/.test(readFileSync(file, 'utf8'))), 'v11 UI must import the registry renderer');
  for (const file of uiSources) {
    const text = readFileSync(file, 'utf8');
    const references = [
      ...text.matchAll(/\bicon\s*\(\s*(['"`])([^'"`\r\n]+)\1/g),
      ...text.matchAll(/\bdata-icon\s*=\s*(['"])([^'"\r\n]+)\1/g),
    ];
    for (const [, , name] of references) {
      assert.ok(Object.hasOwn(registry, name), `${fileURLToPath(file)} references missing icon ${name}`);
    }
  }
});

test('registry matches the configured Studio checkout byte-for-byte', { skip: !process.env.SVG_ICON_STUDIO_ROOT && 'Set SVG_ICON_STUDIO_ROOT to a Studio checkout to verify catalog bytes' }, () => {
  for (const [name, svg] of Object.entries(registry)) {
    const catalogFile = path.join(process.env.SVG_ICON_STUDIO_ROOT, 'icons', 'catalog', `${name}.svg`);
    assert.deepEqual(Buffer.from(svg, 'utf8'), readFileSync(catalogFile), `${name} differs from Studio`);
  }
  const result = spawnSync('python3', ['scripts/sync_gjh_icons.py', '--studio-root', process.env.SVG_ICON_STUDIO_ROOT, '--check'], {
    cwd: fileURLToPath(root), encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
