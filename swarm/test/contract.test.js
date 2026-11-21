'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { applyPatch, validate } = require('../lib/contract');

function contract() {
  return {
    version: 1,
    recipe: 'corporate-landing',
    brand: 'gjh',
    tokens: { color: { primary: '#113322', secondary: '#448822' } },
    sections: [{ id: 'hero', block: 'hero', slots: { title: 'Welcome', body: 'Our story' } }],
    owners: {},
  };
}

function patch(ops, owner = 'designer', baseVersion = 1) {
  return { baseVersion, owner, ops };
}

function rejection(result, code, path) {
  assert.equal(result.ok, false);
  assert.equal(Object.hasOwn(result, 'contract'), false);
  assert.equal(result.errors.length, 1);
  assert.deepEqual(Object.keys(result.errors[0]).sort(), ['code', 'message']);
  assert.equal(result.errors[0].code, code);
  assert.ok(result.errors[0].message.startsWith(`${path}:`), result.errors[0].message);
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

test('validate accepts a design contract and does not modify it', () => {
  const input = deepFreeze(contract());
  assert.deepEqual(validate(input), { ok: true, errors: [] });
  assert.deepEqual(input, contract());
});

test('validate reports invalid contract fields at their paths', () => {
  rejection(validate(null), 'invalid', '$');
  rejection(validate({ ...contract(), version: '1' }), 'invalid', '/version');
  rejection(validate({ ...contract(), recipe: '' }), 'invalid', '/recipe');
  rejection(validate({ ...contract(), brand: null }), 'invalid', '/brand');
  rejection(validate({ ...contract(), tokens: [] }), 'invalid', '/tokens');
  rejection(validate({ ...contract(), sections: {} }), 'invalid', '/sections');
  rejection(validate({ ...contract(), owners: { '/version': 'editor' } }), 'invalid', '/owners/~1version');
  rejection(validate({ ...contract(), extra: true }), 'invalid', '/extra');
  const input = contract();
  input.sections.push({ ...input.sections[0], slots: {} });
  rejection(validate(input), 'invalid', '/sections/1/id');
  input.sections[1].id = 'second';
  input.sections[1].slots = null;
  rejection(validate(input), 'invalid', '/sections/1/slots');
});

test('stale patches report the base version path for older and newer versions', () => {
  for (const version of [0, 2]) {
    rejection(applyPatch(contract(), patch([
      { op: 'set', path: '/sections/0/slots/title', value: 'New title' },
    ], 'designer', version)), 'stale', '/baseVersion');
  }
});

test('conflicts report the target path across equivalent and overlapping paths', () => {
  const input = contract();
  input.owners['sections.0.slots.title'] = 'writer';
  const title = { op: 'set', path: '/sections/0/slots/title', value: 'New title' };
  rejection(applyPatch(input, patch([title])), 'conflict', title.path);
  rejection(applyPatch(input, patch([
    { op: 'set', path: '/sections/0/slots', value: { title: 'New title' } },
  ])), 'conflict', '/sections/0/slots');
  assert.equal(applyPatch(input, patch([title], 'writer')).ok, true);
  assert.equal(applyPatch(input, patch([
    { op: 'set', path: '/sections/0/slots/body', value: 'New body' },
  ])).ok, true);
});

test('ownership is recorded for each new version and includes removed paths', () => {
  const removal = applyPatch(contract(), patch([{ op: 'remove', path: '/tokens/color/primary' }]));
  assert.deepEqual(removal.contract.owners, { '/tokens/color/primary': 'designer' });
  const change = { op: 'set', path: '/tokens/color/primary', value: '#557733' };
  rejection(applyPatch(removal.contract, patch([change], 'writer', 2)), 'conflict', change.path);
  const next = applyPatch(removal.contract, patch([
    { op: 'set', path: '/tokens/color/secondary', value: '#668844' },
  ], 'writer', 2));
  assert.equal(next.contract.version, 3);
  assert.deepEqual(next.contract.owners, { '/tokens/color/secondary': 'writer' });
  assert.equal(applyPatch(next.contract, patch([change], 'writer', 3)).ok, true);
});

test('invalid patches report malformed operations, paths, and final schema', () => {
  rejection(applyPatch(contract(), { ...patch([]), owner: '' }), 'invalid', '/owner');
  rejection(applyPatch(contract(), patch([{ op: 'replace', path: '/brand' }])), 'invalid', '/ops/0/op');
  rejection(applyPatch(contract(), patch([{ op: 'set', path: '/brand' }])), 'invalid', '/ops/0/value');
  rejection(applyPatch(contract(), patch([{ op: 'set', path: '/version', value: 2 }])), 'invalid', '/ops/0/path');
  rejection(applyPatch(contract(), patch([{ op: 'set', path: '/tokens/a~2b', value: true }])), 'invalid', '/ops/0/path');
  rejection(applyPatch(contract(), patch([
    { op: 'set', path: '/sections/4/slots/title', value: 'Missing section' },
  ])), 'invalid', '/sections/4/slots/title');
  rejection(applyPatch(contract(), patch([{ op: 'remove', path: '/tokens/missing' }])), 'invalid', '/tokens/missing');
  rejection(applyPatch(contract(), patch([{ op: 'set', path: '/sections/0/slots', value: [] }])), 'invalid', '/sections/0/slots');
  rejection(applyPatch(contract(), patch([{ op: 'remove', path: '/recipe' }])), 'invalid', '/recipe');
});

test('prototype keys are rejected in both path syntaxes and nested data', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const token = JSON.parse(`{"${key}":{"polluted":true}}`);
    rejection(validate({ ...contract(), tokens: token }), 'invalid', `/tokens/${key}`);
    rejection(applyPatch(contract(), patch([
      { op: 'set', path: '/tokens/color', value: token },
    ])), 'invalid', `/ops/0/value/${key}`);
    for (const path of [`/tokens/${key}/polluted`, `tokens.${key}.polluted`]) {
      rejection(applyPatch(contract(), patch([{ op: 'set', path, value: true }])), 'invalid', '/ops/0/path');
    }
  }
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
});

test('non-JSON data is rejected without invoking accessors', () => {
  const input = contract();
  Object.defineProperty(input.tokens, 'danger', {
    enumerable: true,
    get() { assert.fail('Getter was called'); },
  });
  rejection(validate(input), 'invalid', '/tokens/danger');
  rejection(applyPatch(contract(), patch([
    { op: 'set', path: '/tokens/color', value: { bad: undefined } },
  ])), 'invalid', '/ops/0/value/bad');
});

test('contract and patch limits count UTF-8 bytes and cap operation count', () => {
  const input = contract();
  const bytes = Buffer.byteLength(JSON.stringify({ ...input, tokens: { text: '' } }));
  input.tokens = { text: 'a'.repeat(256 * 1024 - bytes) };
  assert.equal(validate(input).ok, true);
  input.tokens.text = input.tokens.text.slice(1) + 'é';
  rejection(validate(input), 'invalid', '$');
  rejection(applyPatch(contract(), patch([
    { op: 'set', path: '/sections/0/slots/title', value: 'é'.repeat(32768) },
  ])), 'invalid', '$');
  const operation = { op: 'set', path: '/tokens/color/primary', value: '#001100' };
  assert.equal(applyPatch(contract(), patch(Array(100).fill(operation))).ok, true);
  rejection(applyPatch(contract(), patch(Array(101).fill(operation))), 'invalid', '/ops');
});

test('patches cannot produce contracts that exceed the size or depth limit', () => {
  const input = contract();
  input.tokens.large = 'x'.repeat(250 * 1024);
  rejection(applyPatch(input, patch([
    { op: 'set', path: '/tokens/more', value: 'x'.repeat(8 * 1024) },
  ])), 'invalid', '$');

  let value = 'x';
  const chain = Array(15).fill('node');
  for (const node of chain) value = { [node]: value };
  const deep = contract();
  deep.tokens.chain = value;
  const path = ['/tokens/chain', ...chain.slice(1), 'other'].join('/');
  const result = applyPatch(deep, patch([{ op: 'set', path, value: { tree: { ...value } } }]));
  rejection(result, 'invalid', `${path}/tree/${chain.join('/')}`);
  assert.match(result.errors[0].message, /depth/);
});

test('applyPatch is deterministic and fully detaches the result from both inputs', () => {
  const input = deepFreeze(contract());
  const payload = deepFreeze(patch([
    { op: 'set', path: 'sections.0.slots.title', value: 'New title' },
    { op: 'remove', path: '/sections/0/slots/body' },
    { op: 'set', path: '/tokens/color/a~1b~0c', value: { day: '#225511' } },
  ]));
  const first = applyPatch(input, payload);
  const second = applyPatch(input, payload);
  assert.equal(first.ok, true);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first.errors, []);
  assert.equal(first.contract.version, 2);
  assert.deepEqual(first.contract.sections[0].slots, { title: 'New title' });
  assert.deepEqual(first.contract.tokens.color['a/b~c'], { day: '#225511' });
  assert.equal(validate(first.contract).ok, true);

  first.contract.tokens.color.secondary = 'changed';
  first.contract.tokens.color['a/b~c'].day = 'changed';
  assert.deepEqual(input, contract());
  assert.equal(payload.ops[2].value.day, '#225511');
  assert.equal(second.contract.tokens.color.secondary, '#448822');
});

test('a later rejected operation leaves the original contract and patch intact', () => {
  const input = deepFreeze(contract());
  const update = deepFreeze(patch([
    { op: 'set', path: '/sections/0/slots/title', value: 'New title' },
    { op: 'set', path: '/sections/0/block', value: false },
  ]));
  rejection(applyPatch(input, update), 'invalid', '/sections/0/block');
  assert.deepEqual(input, contract());
  assert.equal(update.ops[1].value, false);
});

test('structural array changes conflict with owned indexes', () => {
  const input = contract();
  input.sections.push({ id: 'footer', block: 'footer', slots: {} });
  input.owners = { '/sections/1/slots/title': 'writer' };
  rejection(applyPatch(input, patch([{ op: 'remove', path: '/sections/0' }])), 'conflict', '/sections/0');
  const result = applyPatch(input, patch([{ op: 'remove', path: '/sections/0' }], 'writer'));
  assert.deepEqual(result.contract.sections.map(section => section.id), ['footer']);
  assert.deepEqual(result.contract.owners, { '/sections': 'writer' });
});
