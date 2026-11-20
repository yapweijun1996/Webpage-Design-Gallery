#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const project = path.join(root, 'projects', 'e2e-test');
const firstRequest = 'Make the hero shorter, @hero and @pricing please';
const secondRequest = 'Follow up with a compact section handoff.';
const workers = ['02', '05'];

function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function request(base, route, body) {
  const options = { signal: AbortSignal.timeout(1000) };
  if (body) {
    options.method = 'POST';
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(base + route, options);
  assert.ok(response.ok, `${options.method || 'GET'} ${route} returned HTTP ${response.status}`);
  return response.json();
}

async function waitFor(description, deadline, check, checkServer) {
  while (Date.now() < deadline) {
    checkServer();
    const result = await check();
    if (result) return result;
    await delay(20);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

const isSummary = message => message.from === '00' && message.kind === 'msg' && message.to.includes('owner');
const isTriageStart = message => message.from === 'system' && message.text === 'Triage started';

function verifyOwner(messages, id, text) {
  const owner = messages.find(message => message.id === id);
  assert.equal(owner?.from, 'owner', 'Owner request was missing from the channel');
  assert.equal(owner.text, text);
}

function verifyTurn(messages, triageId, summaryId, improves) {
  const turn = messages.filter(message => message.id >= triageId && message.id < summaryId);
  const steps = turn.filter(message => message.from === 'system' && message.text.endsWith(' started'));
  assert.deepEqual(steps.map(message => message.text), [
    'Triage started', 'Discuss started', 'Decide started', 'Work started', 'Review started',
    ...(improves ? ['Improve started'] : []), 'Summary started'
  ]);
  const work = steps.find(message => message.text === 'Work started');
  const review = steps.find(message => message.text === 'Review started');
  const summary = steps.at(-1);
  const decision = turn.find(message => message.from === '00' && message.kind === 'decision');
  assert.ok(decision, 'Manager decision was missing');

  const mention = turn.find(message => message.from === '02' && message.kind === 'msg' && message.to.includes('05'));
  const discussion = turn.filter(message => message.from === '05' && message.kind === 'msg');
  assert.ok(mention, 'Agent 02 did not mention agent 05 during Discuss');
  assert.equal(discussion.length, 2, 'Expected agent 05 to speak once and reply on a Discuss rerun');
  assert.ok(mention.id < discussion[1].id && discussion[1].id < decision.id, 'Discuss rerun was out of order');
  assert.equal(discussion[1].reply, mention.id, 'Agent 05 did not reply to the handoff question');

  for (const id of workers) {
    const assignment = turn.find(message => message.from === '00' && message.kind === 'assign' && message.to.includes(id));
    const done = turn.find(message => message.from === id && message.kind === 'done');
    assert.ok(assignment?.task, `Manager assignment for agent ${id} was missing`);
    assert.ok(assignment.id < mention.id && assignment.id < discussion[0].id, `Agent ${id} was assigned after discussion started`);
    assert.ok(done && decision.id < work.id && work.id < done.id && done.id < review.id,
      `Agent ${id} did not complete Work between Decide and Review`);
  }

  const reviewAssignments = turn.filter(message => message.id > review.id && message.from === '00' && message.kind === 'assign');
  const improved = turn.filter(message => message.id > review.id && message.kind === 'done');
  assert.deepEqual(reviewAssignments.map(message => message.to), improves ? [['02']] : []);
  assert.deepEqual(improved.map(message => message.from), improves ? ['02'] : []);
  if (improves) {
    const improve = steps.find(message => message.text === 'Improve started');
    assert.match(reviewAssignments[0].task, /Tighten the hero headline/);
    assert.ok(reviewAssignments[0].id < improve.id && improve.id < improved[0].id && improved[0].id < summary.id,
      'Review assignment and Improve completion were out of order');
  }
}

function verifySections(expectedEdits) {
  const directory = path.join(project, 'sections');
  const files = fs.readdirSync(directory);
  for (const [id, action] of Object.entries(expectedEdits)) {
    const file = files.find(name => name.startsWith(`${id}-`) && name.endsWith('.html'));
    assert.ok(file, `Expected a section for agent ${id}`);
    const html = fs.readFileSync(path.join(directory, file), 'utf8');
    assert.ok(html.includes(`<section class="s-${id}" id="${path.basename(file, '.html')}">`), `${file} has an invalid section wrapper`);
    assert.ok(html.includes(`<h2>${action} by agent ${id}</h2>`), `${file} was not rewritten by the fake agent`);
  }
}

function verifyDocuments(reviewText) {
  const expected = {
    'direction.md': 'Use a compact layout and keep the spacing consistent.',
    'decisions.md': 'Agent 05 will match the compact hero spacing.',
    'review.md': reviewText
  };
  for (const [file, written] of Object.entries(expected)) {
    assert.equal(fs.readFileSync(path.join(project, file), 'utf8').trim(), written, `${file} was not written`);
  }
}

async function runScenario(failingAgent = '') {
  assert.ok(!fs.existsSync(project), `Test project already exists at ${project}`);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [path.join(root, 'server.js')], {
    env: {
      ...process.env,
      SWARM_PORT: String(port),
      SWARM_PROJECT: 'e2e-test',
      SWARM_TEST: '1', // test mode: lets SWARM_CODEX and SWARM_SETTINGS override the real binary and settings file
      SWARM_CODEX: path.join(__dirname, 'fake-codex.js'),
      SWARM_SETTINGS: path.join(os.tmpdir(), `swarm-e2e-settings-${process.pid}.json`), // missing file = defaults (codex)
      FAKE_FAIL_AGENT: failingAgent
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  let serverError;
  let closed = false;
  server.on('error', error => { serverError = error; });
  const close = new Promise(resolve => server.once('close', () => {
    closed = true;
    resolve();
  }));
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
  }
  const checkServer = () => {
    if (serverError) throw serverError;
    if (closed) throw new Error(`Server exited early (code ${server.exitCode}, signal ${server.signalCode})`);
  };
  const history = async () => (await request(base, '/api/chat')).messages;

  try {
    await waitFor('server startup', Date.now() + 5000, async () => {
      try {
        const state = await request(base, '/api/state');
        return state.project === 'e2e-test';
      } catch (error) {
        if (error.cause?.code === 'ECONNREFUSED') return false;
        throw error;
      }
    }, checkServer);

    const deadline = Date.now() + 30_000;
    const { id: firstId } = await request(base, '/api/chat', { from: 'owner', text: firstRequest });
    assert.ok(Number.isInteger(firstId), 'First POST did not return a message ID');

    if (failingAgent) {
      const messages = await waitFor('Summary after agent failure', deadline, async () => {
        const messages = await history();
        return messages.some(message => message.id > firstId && isSummary(message)) && messages;
      }, checkServer);
      const summary = messages.find(message => message.id > firstId && isSummary(message));
      const failure = messages.find(message =>
        message.id > firstId && message.id < summary.id && message.from === 'system' &&
        message.kind === 'system' && /^Agent 0?5 failed in (Discuss|Work)\b/i.test(message.text));
      verifyOwner(messages, firstId, firstRequest);
      assert.ok(failure, 'Expected a system message about agent 05 failing before Summary');
      assert.ok(messages.some(message => message.id > failure.id && message.id < summary.id &&
        message.from === '02' && message.kind === 'done'), 'Agent 02 did not continue to completion after agent 05 failed');
      assert.ok(messages.some(message => message.id > failure.id && message.id < summary.id &&
        message.from === '02' && message.kind === 'done' && message.text.startsWith('Improved ')),
        'Agent 02 did not finish Improve after agent 05 failed');
      verifySections({ '02': 'Improved' });
      verifyDocuments('Tighten the hero headline to match the page rhythm.');
      return;
    }

    const { id: secondId } = await request(base, '/api/chat', { from: 'owner', text: secondRequest });
    assert.ok(Number.isInteger(secondId) && secondId > firstId, 'Second POST did not return a newer message ID');
    const messages = await waitFor('both Summaries', deadline, async () => {
      const messages = await history();
      return messages.filter(isSummary).length >= 2 && messages;
    }, checkServer);
    const [firstSummary, secondSummary] = messages.filter(isSummary);
    const [firstTriage, secondTriage] = messages.filter(isTriageStart);
    verifyOwner(messages, firstId, firstRequest);
    verifyOwner(messages, secondId, secondRequest);
    assert.ok(firstTriage?.id < secondId && secondId < firstSummary.id, 'Second owner request did not arrive during the first turn');
    assert.ok(secondTriage?.id > firstSummary.id && secondTriage.id < secondSummary.id, 'Second turn was not processed after the first turn');
    verifyTurn(messages, firstTriage.id, firstSummary.id, true);
    verifyTurn(messages, secondTriage.id, secondSummary.id, false);
    verifySections({ '02': 'Updated', '05': 'Updated' });
    verifyDocuments('The page rhythm is cohesive.');
  } catch (error) {
    if (logs.trim()) console.error(logs.trim());
    throw error;
  } finally {
    try {
      if (!closed) {
        server.kill('SIGTERM');
        const killTimer = setTimeout(() => server.kill('SIGKILL'), 2000);
        try {
          await close;
        } finally {
          clearTimeout(killTimer);
        }
      }
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
}

async function main() {
  await runScenario();
  console.log('PASS: channel flow, Discuss rerun, Review assignments, manager documents, and queued request');
  await runScenario('05');
  console.log('PASS: agent 05 failure reported and agent 02 improved its section before Summary');
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
