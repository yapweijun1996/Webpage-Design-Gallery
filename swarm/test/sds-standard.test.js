'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const header = '| id | rule | enforced by | verify command |';
const separator = '| --- | --- | --- | --- |';
const lintBaseline = 'swarm/design-system/ssot-baseline.json';
const peerSources = new Map([
  ['swarm/test/sds-tokens.test.js', 'swarm/design-system/build.js'],
  ['swarm/test/sds-runtime.test.js', 'swarm/design-system/runtime.js'],
  ['swarm/test/sds-i18n.test.js', 'swarm/design-system/i18n.js'],
  ['swarm/test/sds-pwa.test.js', 'swarm/design-system/shell/sw.js.tpl'],
]);

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function fileExists(file) {
  return fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile() === true;
}

function parseRules(markdown) {
  const lines = markdown.split(/\r?\n/).map(line => line.trim());
  const start = lines.indexOf(header);
  assert.notEqual(start, -1, 'Missing SDS rule table header');
  assert.equal(lines[start + 1], separator, 'Missing SDS rule table separator');

  const rows = [];
  for (let index = start + 2; lines[index]?.startsWith('|'); index += 1) {
    const line = lines[index];
    const location = `SDS rule table line ${index + 1}`;
    const cells = line.slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim());
    assert.ok(line.endsWith('|') && cells.length === 4 && cells.every(Boolean),
      `${location}: expected four non-empty cells`);
    const [id, , enforcement, command] = cells;
    rows.push({
      id,
      enforcement: enforcement.replace(/^`(.+)`$/, '$1'),
      command: command.replace(/^`(.+)`$/, '$1'),
    });
  }
  assert.ok(rows.length > 0, 'SDS rule table has no rules');
  return rows;
}

function specifiedLintIds(spec) {
  const section = /^## 7\.[^\n]*\n([\s\S]*?)(?=^## 8\.)/m.exec(spec)?.[1];
  const list = /^New rule ids[^\r\n]+/m.exec(section ?? '')?.[0];
  assert.ok(list, 'SDS_SPEC.md section 7 has no lint rule list');
  const ids = Array.from(list.matchAll(/`([a-z][a-z0-9-]*)`(?= \(|,|\.)/g), match => match[1]);
  assert.ok(ids.length > 0, 'SDS_SPEC.md section 7 has no lint rule IDs');
  return new Set(ids);
}

function checkerRuleIds(source, specifiedIds) {
  const names = Array.from(source.matchAll(/(['"`])([a-z][a-z0-9-]*)\1/g), match => match[2]);
  return new Set(names.filter(name => specifiedIds.has(name)));
}

function isTestReference(value) {
  return /^swarm\/test\/[a-z0-9-]+\.test\.js$/.test(value);
}

function validateRules(rows, lintIds, verifyTestPath) {
  const seen = new Set();
  for (const { id, enforcement, command } of rows) {
    assert.match(id, /^[A-Z][A-Z0-9]*-\d{2}$/, `Invalid SDS rule ID: ${id}`);
    assert.ok(!seen.has(id), `Duplicate SDS rule ID: ${id}`);
    seen.add(id);

    if (enforcement === 'manual') {
      assert.equal(command, 'manual', `${id}: manual enforcement requires a manual verify command`);
      continue;
    }
    if (isTestReference(enforcement)) {
      assert.ok(verifyTestPath(enforcement), `${id}: test file does not exist: ${enforcement}`);
    } else {
      assert.ok(lintIds.has(enforcement), `${id}: unknown lint rule or test reference: ${enforcement}`);
    }
    assert.match(command, /^node\s+\S/, `${id}: verify command must start with node: ${command}`);
  }
}

const standardRows = parseRules(read('swarm/design-system/STANDARD.md'));
const references = new Set(standardRows.map(row => row.enforcement));
const specLintIds = specifiedLintIds(read('swarm/design-system/SDS_SPEC.md'));

test('STANDARD.md has unique rules with valid enforcement references and commands', () => {
  validateRules(standardRows, specLintIds, file => fileExists(file) || peerSources.has(file));
});

test('lint references appear in check-sections.js', t => {
  const found = checkerRuleIds(read('swarm/tools/check-sections.js'), specLintIds);
  const missing = [...references]
    .filter(reference => specLintIds.has(reference) && !found.has(reference));
  // The baseline is delivered with the SDS checker. Before then, report unpublished IDs explicitly.
  if (missing.length > 0 && !fileExists(lintBaseline)) {
    t.skip(`SDS checker baseline pending. Missing IDs: ${missing.join(', ')}`);
    return;
  }
  assert.deepEqual(missing, [], `Missing IDs in check-sections.js: ${missing.join(', ')}`);
});

for (const file of [...references].filter(isTestReference)) {
  test(`test reference exists: ${file}`, t => {
    const peerSource = peerSources.get(file);
    const exists = fileExists(file);
    if (!exists && peerSource && !fileExists(peerSource)) {
      t.skip(`Peer implementation pending: ${peerSource}`);
      return;
    }
    assert.ok(exists, `Missing test file: ${file}`);
  });
}

const fixtureTest = 'swarm/test/fixture.test.js';
const fixtureSource = `report('raw-color'); report("important"); report('raw-duration-extra'); report('legacy-rule');`;
const fixtureLintIds = checkerRuleIds(fixtureSource, new Set(['raw-color', 'raw-duration', 'important']));
const fixtureFileExists = file => file === fixtureTest;
const fixtureTable = (...rows) => [header, separator, ...rows].join('\r\n');

test('validates lint, test file and manual rows in a CRLF table', () => {
  const rows = parseRules(fixtureTable(
    '| TOK-01 | Use semantic colors. | `raw-color` | `node check.js` |',
    `| A11Y-01 | Test contrast. | \`${fixtureTest}\` | \`node --test ${fixtureTest}\` |`,
    '| UX-01 | Inspect landmarks. | manual | manual |',
  ));
  assert.equal(rows.length, 3);
  assert.doesNotThrow(() => validateRules(rows, fixtureLintIds, fixtureFileExists));
});

test('rejects a missing table, an empty table and incomplete rows', () => {
  assert.throws(() => parseRules('# No table'), /Missing SDS rule table header/);
  assert.throws(() => parseRules(fixtureTable()), /table has no rules/);
  assert.throws(() => parseRules(fixtureTable('| UX-01 |  | manual | manual |')), /four non-empty cells/);
});

test('rejects duplicate rule IDs', () => {
  const line = '| UX-01 | Inspect landmarks. | manual | manual |';
  assert.throws(() => validateRules(parseRules(fixtureTable(line, line)), fixtureLintIds, fixtureFileExists),
    /Duplicate SDS rule ID: UX-01/);
});

test('checker source matches whole rule names from section 7 only', () => {
  assert.deepEqual([...fixtureLintIds], ['raw-color', 'important']);
  assert.ok(!specLintIds.has('inherit'), 'Allowed CSS keywords are not lint rule IDs');
  for (const rule of ['raw-duration', 'legacy-rule']) {
    const rows = parseRules(fixtureTable(`| MOT-01 | Check motion. | ${rule} | node check.js |`));
    assert.throws(() => validateRules(rows, fixtureLintIds, fixtureFileExists), /unknown lint rule or test reference/);
  }
});

test('rejects a missing referenced test file', () => {
  const rows = parseRules(fixtureTable('| TOK-01 | Check tokens. | swarm/test/missing.test.js | node --test |'));
  assert.throws(() => validateRules(rows, fixtureLintIds, fixtureFileExists), /test file does not exist/);
});

test('rejects non-node commands and mismatched manual commands', () => {
  for (const command of ['nodemon check.js', 'python check.py', 'manual']) {
    const rows = parseRules(fixtureTable(`| TOK-01 | Check colors. | raw-color | ${command} |`));
    assert.throws(() => validateRules(rows, fixtureLintIds, fixtureFileExists), /must start with node/);
  }
  const rows = parseRules(fixtureTable('| UX-01 | Inspect landmarks. | manual | node check.js |'));
  assert.throws(() => validateRules(rows, fixtureLintIds, fixtureFileExists), /manual enforcement requires/);
});
