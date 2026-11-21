'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { crc32, deflateSync } = require('node:zlib');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const Anchors = require('../lib/anchors');

const DESKTOP = 'anchor.desktop.png';
const TABLET = 'anchor.tablet.png';
const MOBILE = 'anchor.mobile.png';

function png(width, height = 2) {
  function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const payload = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload));
    return Buffer.concat([length, payload, crc]);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width + 1) * height))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function project(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-anchors-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function create(projectDir) {
  return Anchors.create(projectDir, { files: { desktop: png(1440) } });
}

function contract() {
  return {
    version: 0,
    recipe: 'corporate-landing',
    brand: 'example',
    tokens: { accent: '#215eda' },
    sections: [{ id: 'hero', block: 'hero', slots: { title: 'Example' } }],
    owners: {},
    rules: { desktop: { columns: 12, typeScale: [16, 32], spacingScale: [4, 8], palette: ['#215eda'], imagery: 'Wide hero' } },
  };
}

function lock(projectDir) {
  const { id, dir } = create(projectDir);
  Anchors.approve(projectDir, id, { by: 'manager' });
  Anchors.lock(projectDir, id, contract());
  return { id, dir };
}

function replace(file, contents) {
  fs.chmodSync(file, 0o644);
  fs.writeFileSync(file, contents);
  fs.chmodSync(file, 0o444);
}

test('creates a draft with PNG dimensions, byte sizes and hashes from buffers and paths', t => {
  const projectDir = project(t);
  const desktop = png(1440, 3);
  const tablet = png(768, 4);
  const tabletPath = path.join(projectDir, 'source.png');
  fs.writeFileSync(tabletPath, tablet);
  const mobile = png(393);
  const { id, dir } = Anchors.create(projectDir, {
    goals: ['Explain the product'], prompt: 'A product landing page', model: 'test-image',
    files: { desktop, tablet: tabletPath, mobile },
  });
  const meta = Anchors.get(projectDir, id);

  assert.equal(id, 'v001');
  assert.equal(dir, path.join(projectDir, 'anchors', id));
  assert.equal(meta.createdAt, new Date(meta.createdAt).toISOString());
  assert.deepEqual(meta.goals, ['Explain the product']);
  assert.equal(meta.prompt, 'A product landing page');
  assert.equal(meta.model, 'test-image');
  assert.equal(meta.status, 'draft');
  assert.equal(meta.contract, null);
  assert.equal(meta.advisor, null);
  assert.equal(meta.approvedBy, null);
  assert.equal(meta.approvedAt, null);
  for (const [name, contents, width, height] of [
    [DESKTOP, desktop, 1440, 3], [TABLET, tablet, 768, 4], [MOBILE, mobile, 393, 2],
  ]) {
    assert.deepEqual(meta.files[name], {
      bytes: contents.length, width, height,
      sha256: createHash('sha256').update(contents).digest('hex'),
    });
    assert.deepEqual(fs.readFileSync(path.join(dir, name)), contents);
  }
  desktop.fill(0);
  fs.writeFileSync(tabletPath, '');
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: true, mismatches: [] });
});

test('reports no current anchor until approval and skips drafts and superseded versions', t => {
  const projectDir = project(t);
  assert.deepEqual(Anchors.list(projectDir), []);
  assert.equal(Anchors.current(projectDir), null);
  assert.equal(Anchors.get(projectDir, 'v001'), null);
  const first = lock(projectDir);
  const second = create(projectDir);
  assert.equal(Anchors.current(projectDir).id, first.id);
  Anchors.approve(projectDir, second.id, { by: 'owner' });
  assert.equal(Anchors.current(projectDir).id, second.id);
  Anchors.supersede(projectDir, second.id, { by: 'claude', reason: 'Return to the earlier direction' });
  assert.equal(Anchors.current(projectDir).id, first.id);
  assert.deepEqual(Anchors.list(projectDir).map(anchor => [anchor.id, anchor.status]), [
    ['v001', 'locked'], ['v002', 'superseded'],
  ]);
});

test('records advisor reviews, Manager approval, and the FASTPATH contract bound to the locked version', t => {
  const projectDir = project(t);
  const { id, dir } = create(projectDir);
  const review = { verdict: 'pass', score: 94, findings: ['Clear hierarchy'] };
  Anchors.setAdvisor(projectDir, id, review);
  assert.deepEqual(Anchors.get(projectDir, id).advisor, review);
  Anchors.approve(projectDir, id, { by: 'claude' });
  const approved = Anchors.get(projectDir, id);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approvedBy, 'claude');
  assert.equal(approved.approvedAt, new Date(approved.approvedAt).toISOString());

  const design = contract();
  Anchors.lock(projectDir, id, { ...design, anchorId: 'v999', anchorSha256: { [DESKTOP]: 'wrong' } });
  const locked = Anchors.get(projectDir, id);
  assert.equal(locked.status, 'locked');
  assert.deepEqual(locked.contract, {
    ...design, anchorId: id, anchorSha256: { [DESKTOP]: approved.files[DESKTOP].sha256 },
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'contract.json'), 'utf8')), locked.contract);
  for (const name of [DESKTOP, 'meta.json', 'contract.json']) {
    assert.equal(fs.statSync(path.join(dir, name)).mode & 0o7777, 0o444, name);
  }
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: true, mismatches: [] });
});

test('rejects unauthorized or out-of-order store updates with unchanged files', t => {
  const projectDir = project(t);
  const { id, dir } = create(projectDir);
  const metaFile = path.join(dir, 'meta.json');
  const draft = fs.readFileSync(metaFile);
  assert.throws(() => Anchors.setAdvisor(projectDir, id, { verdict: 'unknown' }), /advisor/);
  assert.throws(() => Anchors.approve(projectDir, id, { by: 'advisor' }), /Manager/);
  assert.throws(() => Anchors.supersede(projectDir, id, { by: 'worker', reason: 'new' }), /Manager/);
  assert.throws(() => Anchors.lock(projectDir, id, contract()), /draft/);
  assert.deepEqual(fs.readFileSync(metaFile), draft);
  assert.deepEqual(fs.readdirSync(dir).sort(), [DESKTOP, 'meta.json']);

  Anchors.approve(projectDir, id, { by: 'owner' });
  const approved = fs.readFileSync(metaFile);
  assert.throws(() => Anchors.lock(projectDir, id, { ...contract(), version: '1' }), /design contract/);
  assert.throws(() => Anchors.lock(projectDir, id, { ...contract(), rules: [] }), /breakpoint rules/);
  assert.deepEqual(fs.readFileSync(metaFile), approved);
  assert.equal(fs.existsSync(path.join(dir, 'contract.json')), false);

  Anchors.lock(projectDir, id, contract());
  const locked = fs.readFileSync(metaFile);
  assert.throws(() => Anchors.setAdvisor(projectDir, id, { verdict: 'revise', score: 25, findings: [] }), /locked/);
  assert.throws(() => Anchors.approve(projectDir, id, { by: 'manager' }), /locked/);
  assert.throws(() => Anchors.lock(projectDir, id, contract()), /locked/);
  assert.throws(() => Anchors.supersede(projectDir, id, { by: 'manager', reason: ' ' }), /reason/);
  assert.deepEqual(fs.readFileSync(metaFile), locked);
});

test('detects changed bytes, file size, mode, missing files, and contract tampering', t => {
  const projectDir = project(t);
  const { id, dir } = lock(projectDir);
  const imagePath = path.join(dir, DESKTOP);
  const contractPath = path.join(dir, 'contract.json');
  const image = fs.readFileSync(imagePath);

  fs.chmodSync(imagePath, 0o644);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: [DESKTOP] });
  const changed = Buffer.from(image);
  changed[changed.length - 1] ^= 1;
  replace(imagePath, changed);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: [DESKTOP] });
  replace(imagePath, image.subarray(0, -1));
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: [DESKTOP] });
  fs.unlinkSync(imagePath);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: [DESKTOP] });
  fs.writeFileSync(imagePath, image);
  fs.chmodSync(imagePath, 0o444);

  const oldContract = fs.readFileSync(contractPath, 'utf8');
  replace(contractPath, oldContract.replace('Wide hero', 'Tall hero'));
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: ['contract.json'] });
  replace(contractPath, oldContract);
  fs.chmodSync(path.join(dir, 'meta.json'), 0o644);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: ['meta.json'] });
});

test('rejects changed image hashes at approval and at lock', t => {
  const projectDir = project(t);
  const { id, dir } = create(projectDir);
  const file = path.join(dir, DESKTOP);
  const original = fs.readFileSync(file);
  const changed = Buffer.from(original);
  changed[changed.length - 1] ^= 1;
  replace(file, changed);
  assert.throws(() => Anchors.approve(projectDir, id, { by: 'manager' }), /verification failed/);
  assert.equal(Anchors.get(projectDir, id).status, 'draft');
  replace(file, original);
  Anchors.approve(projectDir, id, { by: 'manager' });
  replace(file, changed);
  assert.throws(() => Anchors.lock(projectDir, id, contract()), /verification failed/);
  assert.equal(Anchors.get(projectDir, id).status, 'approved');
  assert.equal(fs.existsSync(path.join(dir, 'contract.json')), false);
});

test('supersede preserves locked files and increasing versions cross the padding boundary', t => {
  const projectDir = project(t);
  const { id, dir } = lock(projectDir);
  const image = fs.readFileSync(path.join(dir, DESKTOP));
  const design = fs.readFileSync(path.join(dir, 'contract.json'));
  Anchors.supersede(projectDir, id, { by: 'manager', reason: 'New direction' });
  assert.equal(Anchors.current(projectDir), null);
  assert.equal(Anchors.get(projectDir, id).supersededReason, 'New direction');
  assert.equal(Anchors.get(projectDir, id).supersededBy, 'manager');
  assert.deepEqual(fs.readFileSync(path.join(dir, DESKTOP)), image);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'contract.json')), design);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: true, mismatches: [] });
  assert.throws(() => Anchors.lock(projectDir, id, contract()), /superseded/);
  assert.equal(create(projectDir).id, 'v002');

  // Seed an existing high version without creating hundreds of sample images.
  const highest = path.join(projectDir, 'anchors', 'v999');
  fs.mkdirSync(highest);
  fs.writeFileSync(path.join(highest, 'meta.json'), JSON.stringify({ id: 'v999', status: 'draft' }));
  assert.equal(create(projectDir).id, 'v1000');
  assert.equal(create(projectDir).id, 'v1001');
  assert.deepEqual(Anchors.list(projectDir).map(anchor => anchor.id), ['v001', 'v002', 'v999', 'v1000', 'v1001']);
});

test('requires a desktop PNG and the specified breakpoint widths', t => {
  const projectDir = project(t);
  assert.throws(() => Anchors.create(projectDir, { files: { mobile: png(393) } }), /desktop/);
  assert.throws(() => Anchors.create(projectDir, { files: { desktop: Buffer.alloc(100) } }), /Invalid PNG/);
  assert.throws(() => Anchors.create(projectDir, { files: { desktop: png(768) } }), /1440 pixels/);
  assert.throws(() => Anchors.create(projectDir, { files: { desktop: png(1440), tablet: png(1440) } }), /768 pixels/);
  assert.throws(() => Anchors.create(projectDir, { files: { desktop: png(1440), mobile: png(768) } }), /393 pixels/);
  assert.equal(fs.existsSync(path.join(projectDir, 'anchors')), false);
  assert.equal(create(projectDir).id, 'v001');
});

test('rejects traversal in IDs, input file keys, paths, and stored file names', t => {
  const projectDir = project(t);
  const { id, dir } = create(projectDir);
  for (const invalid of ['..', '../v001', 'v001/../v001', 'v001\\..', '/v001', 'v001\n', 'v000', 'constructor']) {
    assert.throws(() => Anchors.get(projectDir, invalid), /Invalid anchor ID/);
    assert.throws(() => Anchors.verify(projectDir, invalid), /Invalid anchor ID/);
    assert.throws(() => Anchors.lock(projectDir, invalid, contract()), /Invalid anchor ID/);
    assert.throws(() => Anchors.supersede(projectDir, invalid, { by: 'manager', reason: 'test' }), /Invalid anchor ID/);
  }
  for (const key of ['../escape.png', '/escape.png', '..\\escape.png', 'desktop/../mobile']) {
    assert.throws(() => Anchors.create(projectDir, { files: { desktop: png(1440), [key]: png(768) } }), /file name/);
  }
  assert.throws(() => Anchors.create(projectDir, { files: { desktop: 'source/../escape.png' } }), /source path/);
  const metadataPath = path.join(dir, 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  meta.files['../../escape.png'] = meta.files[DESKTOP];
  replace(metadataPath, JSON.stringify(meta));
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: ['../../escape.png'] });
  assert.equal(fs.existsSync(path.join(projectDir, 'escape.png')), false);
});

test('rejects symlinks in write destinations and stored image paths', t => {
  const projectDir = project(t);
  const outside = path.join(projectDir, 'outside');
  const root = path.join(projectDir, 'anchors');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, root);
  assert.throws(() => create(projectDir), /Invalid anchor directory/);
  assert.deepEqual(fs.readdirSync(outside), []);
  fs.unlinkSync(root);

  const { id, dir } = create(projectDir);
  const image = path.join(dir, DESKTOP);
  const target = path.join(outside, DESKTOP);
  fs.renameSync(image, target);
  fs.symlinkSync(target, image);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: false, mismatches: [DESKTOP] });
  assert.throws(() => Anchors.create(projectDir, { files: { desktop: image } }), /Invalid anchor file/);
  assert.equal(fs.statSync(target).mode & 0o7777, 0o444);
});

test('ignores prototype keys and inherited values in files, metadata, reviews, and contracts', t => {
  const projectDir = project(t);
  const junk = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true}}');
  const files = Object.assign(Object.create({ mobile: 'inherited' }), { desktop: png(1440) });
  for (const [key, value] of Object.entries(junk)) {
    Object.defineProperty(files, key, { value, enumerable: true });
  }
  const { id } = Anchors.create(projectDir, { goals: { keep: [{ valid: true, ...junk }] }, files });
  assert.throws(() => Anchors.create(projectDir, { files: Object.create({ desktop: png(1440) }) }), /desktop/);
  assert.throws(() => Anchors.approve(projectDir, id, Object.create({ by: 'manager' })), /Manager/);
  Anchors.setAdvisor(projectDir, id, { verdict: 'revise', score: 40, findings: [{ detail: 'Spacing', ...junk }] });
  Anchors.approve(projectDir, id, { by: 'manager' });
  const design = contract();
  design.tokens = { ...design.tokens, ...junk };
  design.rules.desktop = { ...design.rules.desktop, ...junk };
  Anchors.lock(projectDir, id, { ...design, ...junk });
  const anchor = Anchors.get(projectDir, id);
  assert.deepEqual(anchor.goals, { keep: [{ valid: true }] });
  assert.deepEqual(anchor.advisor.findings, [{ detail: 'Spacing' }]);
  assert.deepEqual(anchor.contract.tokens, { accent: '#215eda' });
  assert.deepEqual(Object.keys(anchor.files), [DESKTOP]);
  for (const key of Object.keys(junk)) {
    assert.equal(Object.hasOwn(anchor.contract, key), false);
    assert.equal(Object.hasOwn(anchor.contract.rules.desktop, key), false);
  }
  assert.equal({}.polluted, undefined);
});

test('a crash after writing a draft and before publishing it leaves prior versions intact', t => {
  const projectDir = project(t);
  const { dir } = lock(projectDir);
  const metadata = fs.readFileSync(path.join(dir, 'meta.json'));
  const child = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const path = require('node:path');
    const Anchors = require(process.argv[1]);
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (path.basename(to) === 'v002') {
        const staged = JSON.parse(fs.readFileSync(path.join(from, 'meta.json'), 'utf8'));
        if (staged.id === 'v002' && fs.existsSync(path.join(from, '${DESKTOP}'))) process.exit(73);
        process.exit(74);
      }
      return rename(from, to);
    };
    Anchors.create(process.argv[2], { files: { desktop: process.argv[3] } });
  `, require.resolve('../lib/anchors'), projectDir, path.join(dir, DESKTOP)], { encoding: 'utf8' });
  assert.equal(child.status, 73, child.stderr);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'meta.json')), metadata);
  assert.deepEqual(Anchors.list(projectDir).map(anchor => anchor.id), ['v001']);
  assert.equal(create(projectDir).id, 'v002');
});

test('an interrupted metadata rename leaves the old version readable and permits a retry', t => {
  const projectDir = project(t);
  const { id, dir } = create(projectDir);
  const file = path.join(dir, 'meta.json');
  const before = fs.readFileSync(file);
  const rename = fs.renameSync;
  const mock = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === file) {
      assert.equal(JSON.parse(fs.readFileSync(from, 'utf8')).status, 'approved');
      throw new Error('simulated pre-rename failure');
    }
    return rename(from, to);
  });
  assert.throws(() => Anchors.approve(projectDir, id, { by: 'manager' }), /simulated pre-rename failure/);
  mock.mock.restore();
  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(fs.readdirSync(dir).sort(), [DESKTOP, 'meta.json']);
  Anchors.approve(projectDir, id, { by: 'manager' });
  assert.equal(Anchors.get(projectDir, id).status, 'approved');
});

test('an interrupted lock keeps the staged contract invisible until metadata commits', t => {
  const projectDir = project(t);
  const { id, dir } = create(projectDir);
  Anchors.approve(projectDir, id, { by: 'manager' });
  const metadata = path.join(dir, 'meta.json');
  const before = fs.readFileSync(metadata);
  const rename = fs.renameSync;
  const mock = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === metadata) throw new Error('simulated pre-rename failure');
    return rename(from, to);
  });
  assert.throws(() => Anchors.lock(projectDir, id, contract()), /simulated pre-rename failure/);
  mock.mock.restore();
  assert.deepEqual(fs.readFileSync(metadata), before);
  assert.equal(Anchors.current(projectDir).status, 'approved');
  assert.equal(Anchors.current(projectDir).contract, null);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: true, mismatches: [] });

  const revised = { ...contract(), version: 1 };
  Anchors.lock(projectDir, id, revised);
  assert.equal(Anchors.get(projectDir, id).contract.version, 1);
  assert.deepEqual(Anchors.verify(projectDir, id), { ok: true, mismatches: [] });
});
