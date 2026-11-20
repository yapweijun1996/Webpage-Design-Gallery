#!/usr/bin/env node
'use strict';
// swarm CLI: controls the local swarm server. Designed to be driven by a coding agent (Claude Code).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createInterface } = require('node:readline');
const { Readable } = require('node:stream');
const { setTimeout: delay } = require('node:timers/promises');
const { parseArgs } = require('node:util');

const RUN = path.join(__dirname, '.run');
const args = process.argv.slice(2);
const cmd = args[0];
function flag(name) {
  const option = '--' + name;
  const i = args.findIndex((arg, index) => index >= (cmd === 'chat' ? 2 : 1) &&
    (arg === option || arg.startsWith(option + '=')));
  if (i < 0) return undefined;
  return args[i] === option ? args[i + 1] : args[i].slice(option.length + 1);
}
const PORT = Number(flag('port')) || Number(process.env.SWARM_PORT) || 8800;
const BASE = `http://127.0.0.1:${PORT}`;
const HISTORY_LIMIT = 20;
const MAX_TIMER_MS = 2 ** 31 - 1;
const PARTICIPANT_NAMES = { owner: 'Owner', claude: 'Claude', system: 'System' };
const USAGE = `Usage: node swarm/cli.js <command> [--port 8800]
  start [--brief "text" | --brief-file file] [--agents file]
  status
  say <id|all> "message"
  stop
  url
  quit
  chat "text" [--from claude|owner]
  tail [--since N] [--limit N]
  watch
  wait [--idle 20] [--timeout 600]  (seconds)`;

async function request(path, options) {
  try {
    return await fetch(BASE + path, options);
  } catch (error) {
    const reason = error.cause?.code || error.message;
    throw new Error(`Cannot reach ${BASE}${path} (${reason})`);
  }
}

async function api(path, method = 'GET', data, signal) {
  const response = await request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = json?.error ? ` - ${json.error}` : '';
    throw new Error(`${method} ${path} failed (HTTP ${response.status})${detail}`);
  }
  if (json === null) throw new Error(`${method} ${path} returned invalid JSON`);
  return json;
}

async function alive() { try { await api('/api/state'); return true; } catch (_) { return false; } }

function commandOptions(names, start = 1) {
  const options = Object.fromEntries([...names, 'port'].map(name => [name, { type: 'string' }]));
  return parseArgs({ args: args.slice(start), options }).values;
}

function integerOption(value, name, fallback, minimum) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`--${name} must be an integer of at least ${minimum}`);
  }
  return number;
}

function secondsOption(value, name, fallback, minimum) {
  if (value === undefined) return fallback * 1000;
  const milliseconds = Math.ceil(Number(value) * 1000);
  if (!/^\d+(?:\.\d+)?$/.test(value) || milliseconds < minimum || milliseconds > MAX_TIMER_MS) {
    throw new Error(`--${name} must be ${minimum ? 'a positive' : 'a non-negative'} duration in seconds (maximum ${MAX_TIMER_MS / 1000})`);
  }
  return milliseconds;
}

function oneLine(text) {
  return String(text).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ');
}

function participantName(agents, id) {
  return agents[id]?.name ?? PARTICIPANT_NAMES[id] ?? id;
}

function printMessage(message, agents) {
  const time = new Date(message.ts).toTimeString().slice(0, 8);
  const from = participantName(agents, message.from);
  const to = message.to.map(id => participantName(agents, id)).join(',') || 'everyone';
  console.log(oneLine(`#${message.id} ${time} ${from} -> ${to} (${message.kind}): ${message.text}`));
}

async function history(since, signal) {
  const { messages } = await api(`/api/chat?since=${since}`, 'GET', undefined, signal);
  if (!Array.isArray(messages)) throw new Error('GET /api/chat did not return a message list');
  return messages;
}

async function watch() {
  let { agents } = await api('/api/state');
  const response = await request('/events', { headers: { accept: 'text/event-stream' } });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GET /events failed (HTTP ${response.status})`);
  }
  const input = Readable.fromWeb(response.body);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let data = [];
  try {
    for await (const line of lines) {
      if (line === '' && data.length) {
        const event = JSON.parse(data.join('\n'));
        data = [];
        if (event.type === 'state') agents = event.state.agents;
        if (event.type === 'chat') printMessage(event.msg, agents);
        if (event.type === 'round') console.log(oneLine(`Round ${event.round}: ${event.label}`));
        if (event.type === 'status') console.log(oneLine(`${participantName(agents, event.id)}: ${event.status}`));
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''));
      }
    }
  } finally {
    input.destroy();
  }
  throw new Error('The /events stream closed');
}

async function waitForIdle(idleMs, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  const signal = AbortSignal.timeout(timeoutMs);
  const pollMs = Math.max(50, Math.min(1000, idleMs));
  let idleSince;
  let agents = {};
  let recent = [];
  let since = 0;
  let idle = false;

  while (performance.now() < deadline) {
    try {
      const [state, messages] = await Promise.all([
        api('/api/state', 'GET', undefined, signal),
        history(since, signal),
      ]);
      agents = state.agents;
      recent = recent.concat(messages).slice(-HISTORY_LIMIT);
      since = recent.at(-1)?.id ?? since;
    } catch (error) {
      if (signal.aborted) break;
      throw error;
    }
    const now = performance.now();
    const working = Object.values(agents).some(agent => agent.status.startsWith('working'));
    idleSince = working ? undefined : idleSince ?? now;
    if (idleSince !== undefined && now < deadline && now - idleSince >= idleMs) {
      idle = true;
      break;
    }
    const nextPoll = idleSince === undefined ? pollMs : Math.min(pollMs, idleMs - (now - idleSince));
    await delay(Math.max(0, Math.min(nextPoll, deadline - now)));
  }

  recent.forEach(message => printMessage(message, agents));
  if (!idle) {
    console.error(`Timed out after ${timeoutMs / 1000} seconds waiting for agents to become idle`);
    process.exitCode = 2;
  }
}

(async () => {
  if (cmd === 'start') {
    if (!(await alive())) {
      fs.mkdirSync(RUN, { recursive: true });
      const out = fs.openSync(path.join(RUN, 'server.log'), 'a');
      const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], { detached: true, stdio: ['ignore', out, out], env: { ...process.env, SWARM_PORT: String(PORT) } });
      child.unref();
      fs.writeFileSync(path.join(RUN, 'server.pid'), String(child.pid));
      for (let i = 0; i < 50 && !(await alive()); i++) await delay(100);
      if (!(await alive())) throw new Error('Server did not start. See swarm/.run/server.log');
    }
    const brief = flag('brief-file') ? fs.readFileSync(flag('brief-file'), 'utf8') : flag('brief');
    if (args.includes('--keep')) { console.log(`server up, project kept as is. Watch live: ${BASE}/`); return; } // no init: keeps finished work
    const body = { brief: brief || '', agents: flag('agents') ? path.resolve(flag('agents')) : undefined };
    if (args.includes('--legacy')) {
      await api('/api/run', 'POST', body); // fixed-phase pipeline (kickoff/proposals/build/review)
      console.log(`started the fixed-phase pipeline. Watch live: ${BASE}/`);
    } else {
      await api('/api/init', 'POST', body); // channel mode: project + channel ready, the team waits for a message
      if (flag('say')) { const sent = await api('/api/chat', 'POST', { from: 'claude', text: flag('say') }); console.log(`sent #${sent.id}`); }
      console.log(`channel ready. Watch live: ${BASE}/`);
    }
  } else if (cmd === 'status') {
    const s = await api('/api/state');
    console.log(`phase=${s.phase} round=${s.round}/${s.rounds} model=${s.model}`);
    for (const a of Object.values(s.agents)) console.log(`${a.id} ${a.name.padEnd(9)} ${a.section.padEnd(9)} ${a.status.padEnd(11)} ${a.action.padEnd(12)} ${a.thought.slice(0, 80)}`);
  } else if (cmd === 'say') {
    await api('/api/say', 'POST', { to: args[1], text: args.slice(2).join(' ') });
    console.log('sent');
  } else if (cmd === 'stop') {
    await api('/api/stop', 'POST');
    console.log('stopping agents');
  } else if (cmd === 'url') {
    console.log(BASE + '/');
  } else if (cmd === 'quit') {
    const pid = Number(fs.readFileSync(path.join(RUN, 'server.pid'), 'utf8'));
    process.kill(pid, 'SIGTERM'); console.log('server stopped');
  } else if (cmd === 'chat') {
    const text = args[1];
    if (!text?.trim()) throw new Error('chat requires a non-empty quoted message');
    const { from = 'claude' } = commandOptions(['from'], 2);
    if (from !== 'claude' && from !== 'owner') throw new Error('--from must be claude or owner');
    const { id } = await api('/api/chat', 'POST', { from, text });
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('POST /api/chat did not return a message ID');
    console.log(`sent #${id}`);
  } else if (cmd === 'tail') {
    const options = commandOptions(['since', 'limit']);
    const since = integerOption(options.since, 'since', 0, 0);
    const limit = integerOption(options.limit, 'limit', HISTORY_LIMIT, 1);
    const [{ agents }, messages] = await Promise.all([api('/api/state'), history(since)]);
    messages.slice(-limit).forEach(message => printMessage(message, agents));
  } else if (cmd === 'watch') {
    commandOptions([]);
    await watch();
  } else if (cmd === 'wait') {
    const options = commandOptions(['idle', 'timeout']);
    await waitForIdle(secondsOption(options.idle, 'idle', 20, 0), secondsOption(options.timeout, 'timeout', 600, 1));
  } else if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(USAGE);
  } else {
    throw new Error(`Unknown command "${cmd}". Run node swarm/cli.js --help for usage`);
  }
})().catch(error => {
  console.error(oneLine(error.message));
  process.exitCode = 1;
});
