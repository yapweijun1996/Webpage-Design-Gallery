'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createTurns } = require('../lib/turns');

const agents = [
  { id: '00', name: 'Manager', section: '', lane: 'Art direction' },
  { id: '01', name: 'Hero worker', section: 'hero', lane: 'Hero section' },
  { id: '02', name: 'Features worker', section: 'features', lane: 'Features section' },
  { id: '03', name: 'Footer worker', section: 'footer', lane: 'Footer section' },
  { id: '04', name: 'Header worker', section: 'header', lane: 'Header section' }
];

function setup(simulate, options = {}) {
  const messages = [];
  const calls = [];
  const chat = {
    start() {},
    stop() {},
    post(partial) {
      // Test posts supply normalized recipient IDs directly.
      const message = { to: [], kind: 'msg', ...partial, id: messages.length + 1, ts: Date.now() };
      messages.push(message);
      return message;
    },
    history(sinceId = 0) {
      return messages.filter(message => message.id > sinceId);
    },
    render(limit = 80) {
      return messages.slice(-limit).map(message => `#${message.id} [${message.from}] (${message.kind}) ${message.text}`).join('\n');
    }
  };
  const turns = createTurns({
    chat, agents, managerId: '00', ...options,
    async runAgent(call) {
      calls.push(call);
      return (await simulate(call, chat)) ?? true;
    }
  });
  return { chat, turns, calls };
}

function assign(chat, id, task = 'Build the section') {
  return chat.post({ from: '00', to: [id], kind: 'assign', text: `Assignment for ${id}`, task });
}

function runLabels(calls) {
  return calls.map(({ label, id }) => `${label}:${id}`);
}

function notices(chat) {
  return chat.history().filter(message => message.from === 'system' && message.kind === 'system').map(message => message.text);
}

test('a question ends after triage when no current manager assignment exists', async () => {
  const { chat, turns, calls } = setup(({ id }, chat) => {
    chat.post({ from: id, to: ['owner'], text: 'The hero comes first.' });
    chat.post({ from: '01', to: ['02'], kind: 'assign', text: 'A worker assignment is ignored.' });
  });
  assign(chat, '01');
  const owner = chat.post({ from: 'owner', text: 'Which section comes first?' });
  assert.equal(turns.busy(), false);
  const completion = turns.onOwnerMessage(owner);
  assert.equal(turns.busy(), true);
  await completion;
  assert.deepEqual(runLabels(calls), ['Triage:00']);
  assert.deepEqual(notices(chat), ['Triage started']);
  assert.equal(chat.history().find(message => message.to.includes('owner')).text, 'The hero comes first.');
  assert.equal(turns.busy(), false);
});

test('runs every step in order and starts peer turns in parallel', { timeout: 1000 }, async () => {
  const discussed = Promise.withResolvers();
  const worked = Promise.withResolvers();
  const improved = Promise.withResolvers();
  const { chat, turns, calls } = setup(async ({ id, label }, chat) => {
    if (label === 'Triage') {
      assign(chat, '01');
      assign(chat, '02');
    }
    if (label === 'Discuss') {
      if (id === '01') await discussed.promise;
      else discussed.resolve();
      chat.post({ from: id, text: 'My section can use the shared spacing.' });
    }
    if (label === 'Decide') {
      chat.post({ from: id, kind: 'decision', text: 'Use the shared spacing.' });
      assign(chat, '01', 'Use the larger gap below the hero');
    }
    if (label === 'Work') {
      if (id === '01') await worked.promise;
      else worked.resolve();
      chat.post({ from: id, kind: 'done', text: 'Updated the section.' });
    }
    if (label === 'Review') {
      assign(chat, '01', 'Tighten the hero headline');
      assign(chat, '02', 'Match the feature heading to the hero');
    }
    if (label === 'Improve') {
      if (id === '01') await improved.promise;
      else improved.resolve();
      chat.post({ from: id, kind: 'done', text: 'Applied the review.' });
    }
    if (label === 'Summary') chat.post({ from: id, to: ['claude'], text: 'Both sections are complete.' });
  });
  const owner = chat.post({ from: 'claude', text: 'Improve the hero and features.' });
  await turns.onOwnerMessage(owner);
  assert.deepEqual(runLabels(calls), [
    'Triage:00', 'Discuss:01', 'Discuss:02', 'Decide:00', 'Work:01', 'Work:02',
    'Review:00', 'Improve:01', 'Improve:02', 'Summary:00'
  ]);
  assert.deepEqual(notices(chat), [
    'Triage started', 'Discuss started', 'Decide started', 'Work started', 'Review started', 'Improve started', 'Summary started'
  ]);
  const messages = chat.history(owner.id);
  for (const text of ['Updated the section.', 'Applied the review.']) {
    assert.deepEqual(messages.filter(message => message.kind === 'done' && message.text === text)
      .map(message => message.from).sort(), ['01', '02']);
  }
  assert.equal(messages.at(-1).text, 'Both sections are complete.');

  for (const { id, label, prompt } of calls) {
    assert.equal(prompt.split('\n')[0], `STEP: ${label} | AGENT: ${id}`);
    assert.ok(prompt.length <= 3600);
    assert.ok(prompt.includes(`chat/${id}.jsonl`));
    assert.ok(prompt.includes(agents.find(agent => agent.id === id).lane));
    for (const filename of ['CONTRACT.md', 'brief.md', 'direction.md', 'decisions.md', 'channel.md']) {
      assert.ok(prompt.includes(filename));
    }
    assert.match(prompt, /one short sentence of intent/);
    if (id === '00') assert.match(prompt, /edit only direction\.md, decisions\.md, and review\.md/);
    const example = JSON.parse(prompt.split('\n').find(line => line.startsWith('{')));
    assert.equal(example.kind, 'msg');
    assert.equal(example.reply, owner.id);
  }
  const triage = calls.find(call => call.label === 'Triage').prompt;
  assert.match(triage, /build or redesign.*direction\.md is empty.*first write direction\.md \(max 60 lines\).*HANDOFF.*post a short plan/);
  for (const topic of ['concept and feeling', 'background alternation', 'type scale use', 'spacing rhythm', 'accent use', 'image treatment', 'unique contribution', 'top risks']) {
    assert.ok(triage.includes(topic), `Triage did not cover ${topic}`);
  }
  assert.match(calls.find(call => call.label === 'Discuss').prompt, /at most 3 this turn.*Be concrete/);
  assert.match(calls.find(call => call.label === 'Decide').prompt,
    /Write decisions\.md \(max 40 lines\).*agreed handoffs.*rulings on disagreements.*DO\/DON'T.*kind:"decision"/);
  const heroWork = calls.find(call => call.label === 'Work' && call.id === '01').prompt;
  assert.match(heroWork, /Edit only sections\/01-hero\.html, sections\/01-hero\.css, and notes\/01\.md/);
  assert.match(heroWork, /kind:"done"/);
  assert.match(heroWork, /Use the larger gap below the hero/);
  const review = calls.find(call => call.label === 'Review').prompt;
  assert.match(review, /every sections\/\*\.html and sections\/\*\.css file as one assembled page/);
  assert.match(review, /Write review\.md \(max 50 lines\).*what works.*page-level problems.*top 3 concrete changes per agent/);
  assert.match(review, /one kind:"assign" line per worker.*concrete change in task.*Post no assignments if the page is good/);
  const heroImprove = calls.find(call => call.label === 'Improve' && call.id === '01').prompt;
  assert.match(heroImprove, /Read review\.md.*Edit only sections\/01-hero\.html, sections\/01-hero\.css, and notes\/01\.md.*kind:"done"/);
  assert.match(heroImprove, /Tighten the hero headline/);
});

test('a review without manager assignments skips Improve and ends the review cycle', async () => {
  const { chat, turns, calls } = setup(({ label }, chat) => {
    if (label === 'Triage') assign(chat, '01');
    if (label === 'Work') assign(chat, '02', 'This assignment preceded Review');
    if (label === 'Review') chat.post({ from: '01', to: ['04'], kind: 'assign', text: 'A worker cannot assign improvements.' });
  }, { reviewRounds: 2 });
  await turns.onOwnerMessage(chat.post({ from: 'owner', text: 'Update the hero.' }));
  assert.deepEqual(runLabels(calls), ['Triage:00', 'Discuss:01', 'Decide:00', 'Work:01', 'Review:00', 'Summary:00']);
  assert.deepEqual(notices(chat).slice(-2), ['Review started', 'Summary started']);
});

test('reviewRounds caps the cycle at two reviews and uses only fresh manager assignments', async () => {
  let reviews = 0;
  const { chat, turns, calls } = setup(({ label }, chat) => {
    if (label === 'Triage') assign(chat, '01');
    if (label === 'Review') {
      reviews += 1;
      assign(chat, reviews === 1 ? '02' : '03', `Change from review ${reviews}`);
    }
  }, { reviewRounds: 3 });
  await turns.onOwnerMessage(chat.post({ from: 'owner', text: 'Refine the page layout.' }));
  assert.deepEqual(runLabels(calls).slice(4), ['Review:00', 'Improve:02', 'Review:00', 'Improve:03', 'Summary:00']);
  assert.deepEqual(notices(chat).slice(4), ['Review started', 'Improve started', 'Review started', 'Improve started', 'Summary started']);
  assert.deepEqual(calls.filter(call => call.label === 'Improve').map(call => call.prompt.match(/Change from review \d/)[0]), [
    'Change from review 1', 'Change from review 2'
  ]);
});

test('bounds the request excerpt separately while preserving the step instructions and assignment', async () => {
  const longAgents = agents.map(agent => ({ ...agent, name: 'n'.repeat(2000), lane: 'l'.repeat(2000) }));
  const request = 'r'.repeat(1200);
  const task = 'a'.repeat(400);
  const { chat, turns, calls } = setup(({ label }, chat) => {
    if (label === 'Triage') assign(chat, '01', task);
    if (label === 'Review') assign(chat, '01', task);
  }, { agents: longAgents });
  await turns.onOwnerMessage(chat.post({ from: 'owner', text: `${request}do not include this suffix` }));
  for (const { id, label, prompt } of calls) {
    assert.ok(prompt.length <= 3600);
    assert.equal(prompt.split('\n')[0], `STEP: ${label} | AGENT: ${id}`);
    assert.equal(prompt.split('\n').at(-1), request);
    if (id === '01') assert.ok(prompt.includes(`${task}\nCurrent request`));
  }
  const improve = calls.find(call => call.label === 'Improve').prompt;
  assert.ok(improve.length > 2499, 'Expected the new cap to retain more context');
  assert.match(improve, /notes\/01\.md.*kind:"done"/);
});

test('discussion reruns only assigned workers with unanswered peer mentions in the last round', async () => {
  let questionId;
  const { chat, turns, calls } = setup(({ id, label }, chat) => {
    if (label === 'Triage') {
      for (const worker of ['01', '02', '03']) assign(chat, worker);
      chat.post({ from: id, to: ['02'], text: 'An earlier manager mention.' });
    }
    if (label !== 'Discuss') return;
    if (id === '01') {
      chat.post({ from: id, to: ['01', '03', '04'], text: 'Can you confirm the spacing?' });
      questionId = chat.post({ from: id, to: ['02'], text: 'Can you confirm the order?' }).id;
      chat.post({ from: '00', to: ['02'], text: 'A manager mention during discussion.' });
    }
    if (id === '02') chat.post({ from: id, reply: questionId, text: 'Confirmed.' });
    if (id === '03') chat.post({ from: id, to: ['01'], text: 'Can you confirm the handoff?' });
  }, { maxDiscussRounds: 2 });
  await turns.onOwnerMessage(chat.post({ from: 'owner', text: 'Agree on the handoff.' }));
  assert.deepEqual(runLabels(calls.filter(call => call.label === 'Discuss')), [
    'Discuss:01', 'Discuss:02', 'Discuss:03', 'Discuss:01', 'Discuss:03'
  ]);
  assert.equal(calls.at(-1).label, 'Summary');
});

test('discussion stops early when the new round has no unanswered mentions', async () => {
  let roundsForSecondWorker = 0;
  const { chat, turns, calls } = setup(({ id, label }, chat) => {
    if (label === 'Triage') {
      assign(chat, '01');
      assign(chat, '02');
    }
    if (label === 'Discuss' && id === '01') {
      chat.post({ from: id, to: ['02'], text: 'What is the handoff?' });
    }
    if (label === 'Discuss' && id === '02' && ++roundsForSecondWorker === 2) {
      chat.post({ from: id, text: 'I can match your spacing.' });
    }
  }, { maxDiscussRounds: 4 });
  await turns.onOwnerMessage(chat.post({ from: 'owner', text: 'Plan the handoff.' }));
  assert.deepEqual(runLabels(calls.filter(call => call.label === 'Discuss')), ['Discuss:01', 'Discuss:02', 'Discuss:02']);
});

test('queued messages run in FIFO order without inheriting prior-turn assignments', async () => {
  const firstStarted = Promise.withResolvers();
  const releaseFirst = Promise.withResolvers();
  const { chat, turns, calls } = setup(async ({ label, prompt }, chat) => {
    if (label === 'Triage' && prompt.endsWith('First request')) {
      firstStarted.resolve();
      await releaseFirst.promise;
      assign(chat, '01');
    }
    if (label === 'Decide') assign(chat, '02');
    if (label === 'Review') assign(chat, '03');
  });
  const first = turns.onOwnerMessage(chat.post({ from: 'owner', text: 'First request' }));
  await firstStarted.promise;
  const second = turns.onOwnerMessage(chat.post({ from: 'owner', text: 'Second request' }));
  const third = turns.onOwnerMessage(chat.post({ from: 'claude', text: 'Third request' }));
  assert.equal(turns.busy(), true);
  assert.deepEqual(runLabels(calls), ['Triage:00']);
  releaseFirst.resolve();
  await Promise.all([first, second, third]);
  assert.deepEqual(runLabels(calls), [
    'Triage:00', 'Discuss:01', 'Decide:00', 'Work:01', 'Work:02', 'Review:00', 'Improve:03',
    'Summary:00', 'Triage:00', 'Triage:00'
  ]);
  assert.deepEqual(calls.filter(call => call.label === 'Triage').map(call => call.prompt.split('\n').at(-1)), [
    'First request', 'Second request', 'Third request'
  ]);
  assert.equal(turns.busy(), false);
});

test('false and rejected runs post failure notices and preserve the rest of the flow', async () => {
  let reviews = 0;
  const { chat, turns, calls } = setup(({ id, label }, chat) => {
    if (label === 'Triage') {
      assign(chat, '01');
      assign(chat, '02');
    }
    if (label === 'Discuss' && id === '01') return false;
    if (label === 'Work' && id === '01') throw new Error('Fake agent failure');
    if (label === 'Work') chat.post({ from: id, kind: 'done', text: 'Updated features.' });
    if (label === 'Review') {
      if (++reviews === 2) return false;
      assign(chat, '01');
      assign(chat, '02');
    }
    if (label === 'Improve' && id === '01') throw new Error('Fake improvement failure');
    if (label === 'Improve') chat.post({ from: id, kind: 'done', text: 'Improved features.' });
  }, { reviewRounds: 2 });
  await turns.onOwnerMessage(chat.post({ from: 'owner', text: 'Update both sections.' }));
  assert.deepEqual(notices(chat), [
    'Triage started', 'Discuss started', 'Agent 01 failed in Discuss', 'Decide started',
    'Work started', 'Agent 01 failed in Work', 'Review started', 'Improve started',
    'Agent 01 failed in Improve', 'Review started', 'Agent 00 failed in Review', 'Summary started'
  ]);
  assert.deepEqual(chat.history().filter(message => message.kind === 'done').map(message => [message.from, message.text]), [
    ['02', 'Updated features.'], ['02', 'Improved features.']
  ]);
  assert.equal(calls.at(-1).label, 'Summary');
  assert.equal(turns.busy(), false);
});

test('owner scope limits assignments and prompts to the sections the owner is looking at', async () => {
  const { chat, turns, calls } = setup(({ id, label }, chat) => {
    if (label === 'Triage') for (const target of ['01', '02', '03']) assign(chat, target); // the manager tries to involve three sections
  });
  const owner = chat.post({
    from: 'owner', text: 'Make this part bolder',
    scope: { sections: ['01'], elements: [{ section: '01', tag: 'h1', text: 'Explore our brands', path: 'section > h1' }] }
  });
  await turns.onOwnerMessage(owner);
  const workers = calls.filter(call => call.id !== '00').map(call => `${call.label}:${call.id}`);
  assert.ok(workers.length > 0, 'the in-scope worker still runs');
  assert.ok(workers.every(entry => entry.endsWith(':01')), `only section 01 may run, got ${workers}`);
  const prompt = calls.find(call => call.id === '01').prompt;
  assert.match(prompt, /OWNER SCOPE/);
  assert.match(prompt, /In-scope sections: 01/);
  assert.match(prompt, /Explore our brands/);
  assert.match(calls[0].prompt, /OWNER SCOPE/, 'the manager sees the scope in Triage too');
});

test('without a scope every assigned section still runs', async () => {
  const { chat, turns, calls } = setup(({ label }, chat) => {
    if (label === 'Triage') for (const target of ['01', '02']) assign(chat, target);
  });
  await turns.onOwnerMessage(chat.post({ from: 'owner', text: 'Update the whole page' }));
  const ids = new Set(calls.filter(call => call.label === 'Work').map(call => call.id));
  assert.deepEqual([...ids].sort(), ['01', '02']);
  assert.doesNotMatch(calls[0].prompt, /OWNER SCOPE/);
});
