'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const staff = require('../lib/staff');

const SWARM = path.resolve(__dirname, '..');
const STAFF = path.join(SWARM, 'staff');
const FIXTURE = path.join(__dirname, 'virtual-staff-fixture');
const ROLE = {
  id: 'sample-designer',
  title: 'Sample Designer',
  crew: 'page',
  agents: ['12', '13'],
  mission: 'Design a sample section.',
  skills: ['ui-ux-core'],
  tools: ['contrast'],
  owns: ['sections/12-sample.*', 'sections/13-sample.*'],
  reviews: ['*'],
  handoffs: { receives: ['brief'], delivers: ['fragments'] },
  definitionOfDone: ['Build the section.', 'Check contrast.', 'Record results.'],
};
const ROSTER = {
  version: '1.0.0',
  crews: { build: 'Build SDS', page: 'Build a page' },
  positions: [ROLE],
};
const TOOLS = '# Tool kit\n\n## contrast\n\n`node swarm/tools/contrast.js <fg> <bg>`\n';

function installFixture(t, { roster = ROSTER, tools = TOOLS, missing = [] } = {}) {
  const files = new Map([
    [path.join(FIXTURE, 'staff.json'), typeof roster === 'string' ? roster : JSON.stringify(roster)],
    [path.join(FIXTURE, 'tools.md'), tools],
  ]);
  const missingFiles = new Set(missing.map(file => path.join(FIXTURE, file)));
  const readFile = fs.readFileSync;
  const stat = fs.statSync;
  t.mock.method(fs, 'readFileSync', (file, ...options) =>
    files.has(file) ? files.get(file) : readFile(file, ...options));
  t.mock.method(fs, 'statSync', (file, ...options) => {
    if (typeof file === 'string' && file.startsWith(FIXTURE + path.sep)) {
      return missingFiles.has(file) ? undefined : { isFile: () => true };
    }
    return stat(file, ...options);
  });
  return FIXTURE;
}

test('ships all 21 positions and maps each GJH agent to its assigned position', t => {
  const roster = JSON.parse(fs.readFileSync(path.join(STAFF, 'staff.json'), 'utf8'));
  const tools = fs.readFileSync(path.join(STAFF, 'tools.md'), 'utf8');
  const staffDir = installFixture(t, { roster, tools });
  assert.deepEqual(staff.validate(staffDir, { strict: true }), { errors: [], warnings: [] });
  const loaded = staff.load(staffDir);
  const build = {
    'art-director': '00',
    'design-token-engineer': 'A',
    'component-engineer': 'B',
    'runtime-engineer': 'C',
    'localization-engineer': 'D',
    'pwa-engineer': 'E',
    'quality-gate-engineer': 'F',
    'standards-lead': 'G',
    'knowledge-librarian': ['H', 'I'],
    'staffing-operations': ['J1', 'J2'],
  };
  const assignedPositions = {
    '01': 'nav-chrome-designer',
    '02': 'hero-designer',
    '03': 'brand-chapter-designer',
    '04': 'brand-chapter-designer',
    '05': 'brand-chapter-designer',
    '06': 'directory-designer',
    '07': 'heritage-storyteller',
    '08': 'concept-showcase-designer',
    '09': 'enquiry-ux-designer',
    '10': 'footer-compliance-designer',
  };
  const lenses = ['accessibility-reviewer', 'localization-reviewer', 'motion-performance-reviewer'];
  assert.equal(loaded.positions.length, 21);
  assert.deepEqual(new Set(Object.keys(loaded.byId)),
    new Set([...Object.keys(build), ...Object.values(assignedPositions), ...lenses]));
  for (const [id, worker] of Object.entries(build)) {
    assert.deepEqual(loaded.byId[id].worker, worker, id);
  }
  for (const id of lenses) assert.deepEqual(loaded.byId[id].agents, []);
  const agents = JSON.parse(fs.readFileSync(path.join(SWARM, 'briefs', 'gjh-agents.json'), 'utf8'));
  assert.deepEqual(new Set(agents.map(agent => agent.id)), new Set(Object.keys(assignedPositions)));
  for (const agent of agents) {
    assert.equal(agent.position, assignedPositions[agent.id]);
    assert.equal(loaded.byAgent(agent.id), loaded.byId[agent.position]);
  }
  assert.equal(loaded.byAgent('00'), loaded.byId['art-director']);
  assert.equal(loaded.byAgent('03'), loaded.byAgent('05'));
  assert.equal(loaded.byAgent('99'), undefined);

  for (const role of loaded.positions) {
    const input = { staffDir, position: role.id, step: 'Build' };
    const prompt = staff.preamble(input);
    assert.ok(prompt.length <= 1400, `${role.id} has a ${prompt.length}-character preamble`);
    assert.equal(prompt, staff.preamble(input));
    assert.ok(prompt.includes(role.mission), `${role.id} mission is intact`);
    for (const item of role.definitionOfDone) assert.ok(prompt.includes(item));
  }
});

test('reports invalid roster JSON', t => {
  const staffDir = installFixture(t, { roster: '{' });
  const report = staff.validate(staffDir);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /Cannot read or parse staff\.json/);
  assert.throws(() => staff.load(staffDir), /Invalid SDS staff roster/);
});

test('reports malformed fields, invalid IDs, and duplicate assignments', t => {
  const roster = {
    version: 'bad',
    crews: {},
    positions: [
      ROLE,
      {
        ...ROLE,
        id: '../invalid',
        title: '',
        crew: 'unknown',
        owns: 'sections/*.html',
        agents: ['13'],
        worker: [],
        handoffs: { receives: [] },
        definitionOfDone: ['Only one check.'],
      },
      { ...ROLE, agents: [] },
      null,
    ],
  };
  const { errors } = staff.validate(installFixture(t, { roster }));
  for (const expected of [
    /version/, /crews/, /id must use/, /duplicate position id/, /Agent "13" is assigned more than once/,
    /title/, /crew must/, /owns/, /worker/, /handoffs/, /definitionOfDone/, /positions\[3\] must be an object/,
  ]) {
    assert.ok(errors.some(error => expected.test(error)), `Missing error for ${expected}: ${errors.join('\n')}`);
  }
});

test('rejects unknown skills and tools even while peer documents are optional', t => {
  const role = { ...ROLE, skills: ['unlisted-skill'], tools: ['unlisted-tool'] };
  const staffDir = installFixture(t, { roster: { ...ROSTER, positions: [role] } });
  const { errors, warnings } = staff.validate(staffDir);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /unknown skill "unlisted-skill"/);
  assert.match(errors[1], /unknown tool "unlisted-tool" in tools\.md/);
  assert.deepEqual(warnings, []);
  assert.throws(() => staff.load(staffDir), /unknown skill "unlisted-skill"/);
});

test('warns about missing known documents and makes them errors in strict mode', t => {
  const staffDir = installFixture(t, { missing: ['handbook/ui-ux-core.md', 'playbooks/sample-designer.md'] });
  const report = staff.validate(staffDir);
  assert.equal(report.errors.length, 0);
  assert.equal(report.warnings.length, 2);
  assert.ok(report.warnings.some(message => message.includes('handbook/ui-ux-core.md')));
  assert.ok(report.warnings.some(message => message.includes('playbooks/sample-designer.md')));
  assert.deepEqual(staff.validate(staffDir, { strict: true }), { errors: report.warnings, warnings: [] });
  assert.equal(staff.load(staffDir).byAgent('12').id, ROLE.id);
  assert.throws(() => staff.load(staffDir, { strict: true }), /Missing staff document/);
});

test('preamble includes the role, tools, three acceptance bullets, and SDS rules', t => {
  const staffDir = installFixture(t);
  const input = { staffDir, agentId: '12', step: 'Review' };
  const prompt = staff.preamble(input);
  for (const expected of [
    'POSITION: Sample Designer.',
    'STEP: Review',
    'MISSION: Design a sample section.',
    'READ FIRST: staff/playbooks/sample-designer.md and handbook packs ui-ux-core.',
    'TOOLS you may run: node swarm/tools/contrast.js <fg> <bg>',
    'DEFINITION OF DONE:',
    'SDS RULES: use var(--sds-*), .sds-* components, data-i18n, and data-reveal.',
  ]) assert.ok(prompt.includes(expected), expected);
  assert.deepEqual(prompt.match(/^- .+/gm), ROLE.definitionOfDone.map(item => `- ${item}`));
  assert.equal(prompt, staff.preamble({ ...input, agentId: '99', position: ROLE.id }));
  assert.equal(staff.preamble({ staffDir, agentId: '99' }), '');
  assert.equal(staff.preamble({ ...input, position: 'unknown-position' }), '');
});

test('caps unusually long preambles while preserving rules and three bullets', t => {
  const long = 'Example role text '.repeat(200);
  const role = { ...ROLE, title: long, mission: long, definitionOfDone: [long, long, long] };
  const staffDir = installFixture(t, { roster: { ...ROSTER, positions: [role] } });
  const input = { staffDir, agentId: '12', step: long };
  const prompt = staff.preamble(input);
  assert.ok(prompt.length <= 1400);
  assert.equal(prompt, staff.preamble(input));
  assert.match(prompt, /^POSITION:/);
  assert.equal(prompt.match(/^- /gm).length, 3);
  assert.match(prompt, /SDS RULES: .*Avoid raw colors, sizes, and durations\.$/);
});

test('staff CLI checks the published roster and rejects invalid options', () => {
  const command = path.join(SWARM, 'lib', 'staff.js');
  const options = { cwd: path.dirname(SWARM), encoding: 'utf8' };
  const check = spawnSync(process.execPath, [command, '--check'], options);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /roster passed validation/);
  const invalid = spawnSync(process.execPath, [command, '--check', '--unknown'], options);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage: node swarm\/lib\/staff\.js --check/);
});

test('staff CLI warns during parallel work and exits 1 for missing documents in strict mode', () => {
  const unavailable = path.join(STAFF, 'handbook', 'ui-ux-core.md');
  const preload = `
    import fs from 'node:fs';
    const stat = fs.statSync;
    fs.statSync = (file, ...options) => file === ${JSON.stringify(unavailable)}
      ? undefined : stat(file, ...options);
  `;
  const command = ['--import', `data:text/javascript,${encodeURIComponent(preload)}`,
    path.join(SWARM, 'lib', 'staff.js'), '--check'];
  const options = { cwd: path.dirname(SWARM), encoding: 'utf8' };
  const check = spawnSync(process.execPath, command, options);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stderr, /Warning: Missing staff document: handbook\/ui-ux-core\.md/);
  const strict = spawnSync(process.execPath, [...command, '--strict'], options);
  assert.equal(strict.status, 1, strict.stderr);
  assert.match(strict.stderr, /Error: Missing staff document: handbook\/ui-ux-core\.md/);
});
