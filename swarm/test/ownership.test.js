'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { build, classify, approvalRequired } = require('../lib/ownership');
const { roster } = require('../lib/squad');

const agents = [{ id: '01', section: 'header' }, { id: '02', section: 'hero' }];
const sections = ['01-header', '02-hero', '03-brands', '04-footer'];

test('classifies the section, individual files, and global design inputs', () => {
  const manifest = build({ agents, sections });
  const header = [
    'sections/01-header.html', 'sections/01-header.css', 'sections/01-header.layout.css',
    'sections/01-header.polish.css', 'notes/01.md', 'chat/01.jsonl', 'assets/generated/01-header-nav.webp',
  ];
  for (const file of header) assert.equal(classify(manifest, '01', file), 'owned', file);

  const foreign = [
    'sections/02-hero.html', 'sections/03-brands.css', 'sections/04-footer.html', 'sections/01-header.extra.css',
    'notes/02.md', 'chat/02.jsonl', 'assets/generated/02-hero-arrow.svg', 'assets/generated/01-header-nav/file.svg',
  ];
  for (const file of foreign) assert.equal(classify(manifest, '01', file), 'foreign', file);

  for (const file of ['tokens.css', 'design-system/theme/tokens.json', 'contract.json', 'CONTRACT.md',
    'brief.md', 'direction.md', 'decisions.md']) assert.equal(classify(manifest, '01', file), 'shared', file);
  for (const file of ['anchors/v001/anchor.desktop.png', 'agents.json', 'ownership.json', '.run/ws/data']) {
    assert.equal(classify(manifest, '01', file), 'forbidden', file);
  }
});

test('uses the actual squad plan shape and assigns each specialist only their declared writes', () => {
  const specialists = roster();
  const members = specialists.map((spec, index) => ({ id: String(index + 81), squad: spec }));
  const manifest = build({ agents, sections, squad: { base: '01-header', members } });
  const claims = {
    layout: 'sections/01-header.html', type: 'sections/01-header.type.css',
    'image-gen': 'assets/generated/01-header-nav.png', qa: 'sections/01-header.polish.css', researcher: 'research.md',
  };
  for (const member of members) {
    const claim = claims[member.squad.id];
    if (claim) assert.equal(classify(manifest, member.id, claim), 'owned');
    assert.equal(classify(manifest, member.id, 'sections/02-hero.html'), 'foreign');
    assert.equal(classify(manifest, member.id, `notes/${member.id}.md`), 'owned');
  }
  assert.equal(classify(manifest, '81', 'sections/01-header.layout.css'), 'owned');
  assert.equal(classify(manifest, '01', 'sections/01-header.html'), 'foreign');
  assert.equal(classify(manifest, '01', 'assets/generated/01-header-nav.png'), 'foreign');
  assert.equal(classify(manifest, '01', 'sections/01-header.css'), 'owned');
  assert.equal(classify(manifest, '01', 'assets/generated/01-header-nav.svg'), 'owned');
});

test('launch ownership reserves Manager planning documents and worker discussion drafts', () => {
  const roster = [{ id: '00' }, ...agents];
  const legacy = build({ agents: roster, sections });
  assert.deepEqual(legacy.workers, ['01', '02']);
  assert.equal(classify(legacy, '01', 'discussion/01.md'), 'foreign');

  const active = build({ agents: roster, sections, launchContext: true });
  assert.deepEqual(active.workers, ['00', '01', '02']);
  for (const file of ['direction.md', 'decisions.md', 'review.md', 'review1.md', 'review2.md', 'research.md']) {
    assert.equal(classify(active, '00', file), 'owned', file);
    assert.equal(classify(active, '01', file), 'foreign', file);
  }
  assert.equal(classify(active, '01', 'discussion/01.md'), 'owned');
  assert.equal(classify(active, '01', 'discussion/02.md'), 'foreign');
  assert.equal(classify(active, '00', 'discussion/01.md'), 'foreign');
  assert.equal(classify(active, '00', 'sections/01-header.html'), 'foreign');
  for (const file of ['channel.md', 'inbox/01.md', 'staff/handbook/qa.md']) {
    assert.equal(classify(active, '01', file), 'shared', file);
    assert.equal(classify(active, '00', file), 'shared', file);
  }
  for (const file of ['channel.jsonl', 'chat/00.jsonl', 'chat/.offsets.json', 'dist/index.html',
    'names.json', 'skills.json', 'skills/qa/SKILL.md', 'integration/log.jsonl']) {
    assert.equal(classify(active, '01', file), 'forbidden', file);
    assert.equal(classify(active, '00', file), 'forbidden', file);
  }
  assert.throws(() => build({ agents: [...roster, { id: '00', section: 'mock' }], launchContext: true }), /reserved/);
});

test('manifest serialization is deterministic across input order and duplicate section files', () => {
  const squad = roster().map(spec => ({ ...spec, base: '01-header' }));
  const first = build({ agents, sections, squad });
  const second = build({ agents: [...agents].reverse(), sections: ['01-header.css', ...sections].reverse(),
    squad: [...squad].reverse() });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(classify(JSON.parse(JSON.stringify(first)), 'layout', 'sections/01-header.html'), 'owned');
  assert.deepEqual(first.sections, sections);
});

test('reports approval reasons for additions, modifications and removals outside ownership', () => {
  const manifest = build({ agents, sections });
  assert.deepEqual(approvalRequired(manifest, '01', ['sections/01-header.html']), { required: false, reasons: [] });
  assert.deepEqual(approvalRequired(manifest, '01', {
    added: ['tokens.css'], changed: ['sections/02-hero.html', 'sections/01-header.html'], removed: ['agents.json'],
  }), {
    required: true,
    reasons: [
      { code: 'shared', path: 'tokens.css' }, { code: 'foreign', path: 'sections/02-hero.html' },
      { code: 'forbidden', path: 'agents.json' },
    ],
  });
});

test('invalid IDs, traversal, aliases and prototype keys cannot create ownership', () => {
  const manifest = build({ agents, sections });
  for (const file of ['../tokens.css', '/tokens.css', 'C:/tokens.css', 'sections\\01-header.html',
    './sections/01-header.html', 'sections//01-header.html', 'sections/../sections/01-header.html',
    'sections/01-header.html\0', 'assets/generated/__proto__/file.png', 'constructor', 'prototype']) {
    assert.equal(classify(manifest, '01', file), 'forbidden', file);
  }
  for (const id of ['__proto__', 'constructor', 'prototype', '../01', 'sections/01']) {
    assert.throws(() => build({ agents: [{ id, section: 'header' }] }), /Invalid worker ID/);
    assert.equal(classify(manifest, id, 'sections/01-header.html'), 'foreign');
  }
  const inherited = { ...manifest, owned: Object.create({ 'tokens.css': '01' }) };
  assert.equal(classify(inherited, '01', 'tokens.css'), 'shared');
  assert.throws(() => build({ agents: [...agents, agents[0]] }), /Duplicate worker ID/);
  const layout = roster().find(spec => spec.id === 'layout');
  assert.throws(() => build({ agents, squad: { base: '01-header', members: [
    { id: '81', squad: layout }, { id: '82', squad: layout },
  ] } }), /Duplicate squad ownership/);
});
