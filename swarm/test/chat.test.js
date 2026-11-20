'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const { createChat, parseMentions } = require('../lib/chat');

const agents = [
  { id: '05', name: 'Agent 5', section: 'feature-grid' },
  { id: '00', name: 'Manager', section: '' },
  { id: '03', name: 'Agent 3', section: 'proof' },
  { id: '02', name: 'Agent 2', section: 'hero' },
];

function setup(t) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-chat-'));
  const events = [];
  const stores = [];
  const options = { projectDir, agents, emit: (event) => events.push(event) };
  const openChat = () => {
    const chat = createChat(options);
    stores.push(chat);
    return chat;
  };
  t.after(() => {
    for (const store of stores) store.stop();
    fs.rmSync(projectDir, { recursive: true, force: true });
  });
  return { projectDir, events, openChat, chat: openChat() };
}

async function waitFor(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for outbox ingestion');
    await delay(10);
  }
}

test('parses numeric, agent, manager, section and broadcast mentions', () => {
  for (const alias of ['@03', '@3', '@agent3', '@Agent 3', '@AGENT\t3']) {
    assert.deepEqual(parseMentions(alias, agents), ['03']);
  }
  assert.deepEqual(parseMentions('@feature-grid @manager @hero @03, @hero!', agents), ['00', '02', '03', '05']);
  for (const alias of ['@all', '@everyone']) {
    assert.deepEqual(parseMentions(alias, agents), ['00', '02', '03', '05']);
  }
  assert.deepEqual(parseMentions('test@hero.org @36 @Agent 31 @heroic @hero-copy @unknown', agents), []);
});

test('ingests existing lines, enforces the filename sender and emits the saved message', (t) => {
  const { projectDir, chat, events } = setup(t);
  const chatDir = path.join(projectDir, 'chat');
  fs.mkdirSync(chatDir);
  const original = { id: 99, ts: 1, from: 'owner', to: ['05', '02', '05', 'bad'], text: 'Ping @hero', reply: 1 };
  fs.writeFileSync(path.join(chatDir, '03.jsonl'), `${JSON.stringify(original)}\n`);
  fs.writeFileSync(path.join(chatDir, '99.jsonl'), '{"text":"Unknown sender"}\n');
  chat.start();

  const [msg] = chat.history();
  assert.ok(Number.isSafeInteger(msg.ts) && msg.ts > original.ts);
  assert.deepEqual(msg, {
    id: 1, ts: msg.ts, from: '03', to: ['02', '05'], kind: 'msg', text: 'Ping @hero', reply: 1,
  });
  assert.deepEqual(events, [{ type: 'chat', msg }]);
  assert.equal(fs.readFileSync(path.join(projectDir, 'channel.jsonl'), 'utf8'), `${JSON.stringify(msg)}\n`);
});

test('waits for a complete UTF-8 line and ingests rapid appends once with the poll fallback', async (t) => {
  t.mock.method(fs, 'watch', () => { throw new Error('Watcher unavailable'); });
  const { projectDir, chat, events } = setup(t);
  const chatDir = path.join(projectDir, 'chat');
  fs.mkdirSync(chatDir);
  const outbox = path.join(chatDir, '03.jsonl');
  const line = Buffer.from('{"text":"Near the café"}\n');
  const split = line.indexOf(Buffer.from('é')) + 1;
  fs.writeFileSync(outbox, line.subarray(0, split));
  chat.start();
  assert.deepEqual(chat.history(), []);

  fs.appendFileSync(outbox, line.subarray(split));
  fs.appendFileSync(outbox, '{"text":"Second"}\n{"text":"Third"}\n');
  await waitFor(() => events.length >= 3);
  fs.appendFileSync(outbox, '{"text":"Fourth"}\n');
  await waitFor(() => events.length >= 4);
  chat.stop();
  chat.start();
  assert.deepEqual(chat.history().map(({ text }) => text), ['Near the café', 'Second', 'Third', 'Fourth']);
  assert.equal(events.length, 4);
});

test('reports malformed outbox lines by agent name and continues processing', async (t) => {
  const { projectDir, chat, events } = setup(t);
  chat.start();
  fs.writeFileSync(path.join(projectDir, 'chat', '02.jsonl'), 'not JSON\n{"task":"No text"}\n{"text":"Valid"}\n');
  await waitFor(() => events.length >= 3);
  const [syntaxNotice, schemaNotice, valid] = chat.history();
  for (const notice of [syntaxNotice, schemaNotice]) {
    assert.equal(notice.from, 'system');
    assert.equal(notice.kind, 'system');
    assert.match(notice.text, /Agent 2/);
  }
  assert.equal(valid.from, '02');
  assert.equal(valid.text, 'Valid');
});

test('resumes ids and byte offsets from disk after creating a fresh store', (t) => {
  const { projectDir, chat, openChat, events } = setup(t);
  chat.start();
  chat.post({ from: 'owner', text: 'First' });
  const outbox = path.join(projectDir, 'chat', '03.jsonl');
  fs.writeFileSync(outbox, '{"text":"Second"}\n{"text":"Thi');
  chat.stop();
  chat.start();
  chat.stop();

  fs.appendFileSync(outbox, 'rd"}\n');
  const reopened = openChat();
  reopened.start();
  const fourth = reopened.post({ from: 'claude', text: 'Fourth' });
  assert.equal(fourth.id, 4);
  assert.deepEqual(reopened.history(1).map(({ id, text }) => [id, text]), [
    [2, 'Second'], [3, 'Third'], [4, 'Fourth'],
  ]);
  assert.deepEqual(events.map(({ msg }) => msg.id), [1, 2, 3, 4]);
});

test('retries an outbox line when the log append failed after preparing its cursor', (t) => {
  const { projectDir, chat, openChat, events } = setup(t);
  chat.start();
  chat.post({ from: 'owner', text: 'Existing log entry' });
  chat.stop();
  fs.writeFileSync(path.join(projectDir, 'chat', '03.jsonl'), '{"text":"Retry me"}\n');

  const failedAppend = t.mock.method(fs, 'appendFileSync', () => { throw new Error('Append failed'); });
  assert.throws(() => chat.start(), /Append failed/);
  failedAppend.mock.restore();

  const reopened = openChat();
  reopened.start();
  assert.deepEqual(reopened.history(1).map(({ id, text }) => [id, text]), [[2, 'Retry me']]);
  assert.deepEqual(events.map(({ msg }) => msg.id), [1, 2]);
});

test('truncates text and assignment tasks and defaults an unrecognized kind', (t) => {
  const { chat } = setup(t);
  chat.start();
  const assignment = chat.post({
    from: '03', kind: 'assign', text: 'x'.repeat(799) + '🚀extra', task: 'y'.repeat(401),
  });
  assert.equal(assignment.text, 'x'.repeat(799) + '🚀');
  assert.equal(assignment.task, 'y'.repeat(400));

  const msg = chat.post({ from: 'owner', kind: 'invalid', text: 'Short', task: 'Ignore', reply: -1 });
  assert.equal(msg.kind, 'msg');
  assert.ok(!Object.hasOwn(msg, 'task'));
  assert.ok(!Object.hasOwn(msg, 'reply'));
});

test('rewrites the last 80 messages using the transcript format', (t) => {
  const { projectDir, chat } = setup(t);
  chat.start();
  for (let i = 1; i <= 96; i++) chat.post({ from: 'owner', text: `Message ${i}` });
  chat.post({ from: '03', to: ['05', '02'], kind: 'assign', text: 'first\r\nsecond' });
  const expected = '#97 [Agent 3 -> Agent 2,Agent 5] (assign) first second\n';
  const transcript = fs.readFileSync(path.join(projectDir, 'channel.md'), 'utf8');
  assert.equal(transcript, chat.render());
  assert.equal(chat.render(1), expected);
  assert.equal(chat.render(0), '');
  const lines = transcript.trimEnd().split('\n');
  assert.equal(lines.length, 80);
  assert.equal(lines[0], '#18 [Owner -> Everyone] (msg) Message 18');
  assert.equal(lines.at(-1), expected.trimEnd());
});
