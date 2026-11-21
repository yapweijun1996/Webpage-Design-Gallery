'use strict';

const { execFile } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const { ALLOWLIST } = require('./settings');

const READINESS_LIMIT_MS = 10_000;
const SECTION_PATH = /(?:^|[\s/"'`=():<>;&|])(?:sections|notes|discussion)\/(\d{2})(?!\d)/g;
const SHELL_WRAPPER = /^(?:\S*\/)?(?:zsh|bash|sh)\s+-l?c\s+["']?/;
const WRITES = /(?:^|[\s;&|(])(?:tee\b|apply_patch\b|python3?\b.*write|perl\s+-pi\b|sed\s+-i\b)|>\s*\S|<<\s*["']?EOF/;
const READS = /(?:^|[;&|(])\s*(?:cat|sed|rg|grep|head|tail|less|more|ls|find|wc|stat|nl|awk)\b/;
const WEB_URL = /(?<=["'])https?:\/\/[^\s"'`<>|]+|https?:\/\/[^\s"'`<>|;&()]+/i;
const WEB_COMMAND = /(?:^|[^\w.-])(?:curl|wget)\s/;
const PI_TOOL_VERBS = new Map([
  ['read', 'reading'], ['write', 'editing'], ['edit', 'editing'], ['bash', 'running'],
]);

function action(verb, target) {
  const sections = new Set();
  for (const match of target.matchAll(SECTION_PATH)) sections.add(match[1]);
  return { kind: 'action', verb, target, sections: [...sections] };
}

function researchAction(target) {
  return { kind: 'action', verb: 'researching', target, sections: [] };
}

function thought(text) {
  if (typeof text === 'string' && text.trim()) return { kind: 'thought', text: text.trim() };
}

function errorText(value, fallback) {
  const text = typeof value === 'string' ? value : value?.message;
  return typeof text === 'string' && text.trim() ? text.trim() : fallback;
}

function codexEvent(event, completedSearches) {
  const item = event.item;
  if (event.type === 'item.started' && item?.type === 'command_execution') {
    if (typeof item.command !== 'string') return;
    const command = item.command.trim().replace(SHELL_WRAPPER, '');
    // A network fetch (curl/wget) that does not touch project files is research, even when it redirects output elsewhere.
    const fetchesWeb = /(?:^|[\s;&|(])(?:curl|wget)\s/.test(command) && !/(?:sections|notes|discussion|chat)\/\d\d/.test(command);
    const verb = fetchesWeb ? 'researching' : WRITES.test(command) ? 'editing' : READS.test(command) ? 'reading' : 'running';
    return action(verb, item.command);
  }
  if (event.type === 'item.completed' && item?.type === 'web_search') {
    const query = typeof item.query === 'string' && item.query.trim();
    const target = query || (typeof item.text === 'string' && item.text.trim());
    if (!target || completedSearches.has(item.id)) return;
    if (typeof item.id === 'string') completedSearches.add(item.id);
    return researchAction(target);
  }
  if (event.type === 'item.completed' && item?.type === 'agent_message') return thought(item.text);
  if (event.type === 'item.completed' && item?.type === 'error') {
    const text = errorText(item.message ?? item.text, 'Codex reported an error.');
    if (!/ignoring\s+(?:\d+\s+)?unrecognized configuration settings?/i.test(text)) return { kind: 'error', text };
  }
  if (event.type === 'turn.failed') {
    return { kind: 'error', text: errorText(event.error ?? event.message, 'Codex turn failed.') };
  }
  if (event.type === 'turn.completed') {
    const done = { kind: 'done', ok: true };
    if (event.usage !== undefined) done.usage = event.usage;
    return done;
  }
}

function piEventParser() {
  let textDeltas = '';

  return event => {
    if (event.type === 'message_start' && event.message?.role === 'assistant') textDeltas = '';

    if (event.type === 'message_update') {
      const delta = event.assistantMessageEvent;
      if (delta?.type === 'text_delta' && typeof delta.delta === 'string') textDeltas += delta.delta;
    }

    if (event.type === 'message_end' && event.message?.role === 'assistant') {
      const content = event.message.content;
      const parts = Array.isArray(content)
        ? content.filter(part => part?.type === 'text' && typeof part.text === 'string')
        : [];
      const text = parts.length ? parts.map(part => part.text).join('') : textDeltas;
      textDeltas = '';
      const message = thought(text);
      const usage = event.message.usage;
      return [usage && { kind: 'usage', usage }, message].filter(Boolean);
    }

    if (event.type === 'tool_execution_start') {
      const verb = PI_TOOL_VERBS.get(event.toolName);
      const target = event.toolName === 'bash' ? event.args?.command : event.args?.path;
      if (!verb || typeof target !== 'string') return;
      if (event.toolName === 'bash') {
        const url = target.match(WEB_URL)?.[0];
        if (url || WEB_COMMAND.test(target)) return researchAction(url || target);
      }
      return action(verb, target);
    }

    if (event.type === 'agent_settled') {
      if (event.aborted === false) return { kind: 'done', ok: true };
      if (event.aborted === true) {
        const text = errorText(event.error ?? event.errorMessage, 'pi run aborted.');
        return { kind: 'error', text };
      }
    }
  };
}

function jsonLines(normalize) {
  const decoder = new StringDecoder('utf8');
  let pending = '';

  function consume(chunk, flush = false) {
    const lines = (pending + chunk).split('\n');
    pending = flush ? '' : lines.pop();
    const events = [];
    for (const line of lines) {
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (event === null || typeof event !== 'object') continue;
      const normalized = normalize(event);
      if (Array.isArray(normalized)) events.push(...normalized);
      else if (normalized) events.push(normalized);
    }
    return events;
  }

  return {
    push(chunk) { return consume(typeof chunk === 'string' ? chunk : decoder.write(chunk)); },
    end() { return consume(decoder.end(), true); },
  };
}

function probe(command, args, deadline) {
  const timeout = Math.floor(deadline - performance.now());
  if (timeout < 1) return Promise.resolve({ timedOut: true });

  return new Promise(resolve => {
    const child = execFile(command, args, { timeout, killSignal: 'SIGKILL', maxBuffer: 65_536 }, (error, stdout, stderr) => {
      const timedOut = error?.killed === true && error.signal === 'SIGKILL' && error.code === null;
      resolve({ error, stdout: stdout.trim(), stderr: stderr.trim(), timedOut });
    });
    child.stdin?.end();
  });
}

const adapters = {
  codex: {
    args: ({ model, effort, projectDir, research }) => [
      'exec', '--json', '-m', model, '-c', `model_reasoning_effort=${effort}`,
      ...(research === true ? ['-c', 'web_search="live"'] : []),
      '-s', 'workspace-write', '--skip-git-repo-check', '-C', projectDir, '-',
    ],
    parser() {
      const completedSearches = new Set();
      return jsonLines(event => codexEvent(event, completedSearches));
    },
    authArgs: () => ['login', 'status'],
    loggedIn: ({ stdout, stderr }) => !/\bnot logged in\b/i.test(`${stdout}\n${stderr}`),
  },
  pi: {
    // pi has no sandbox and can access the network through its bash tool without extra flags.
    args: ({ model, effort }) => [
      '-p', '--mode', 'json', '--model', `openai-codex/${model}`, '--thinking', effort,
      '--no-session', '--no-extensions', '--no-skills', '--no-context-files',
    ],
    parser: () => jsonLines(piEventParser()),
    authArgs: model => ['auth', 'check', '--model', `openai-codex/${model}`, '--json'],
    loggedIn({ stdout }) {
      try { return JSON.parse(stdout)?.status === 'ready'; } catch { return false; }
    },
  },
};

function assertModel(model) {
  if (typeof model !== 'string' || !Object.hasOwn(ALLOWLIST.models, model)) throw new Error('Unsupported model');
}

function get(name) {
  if (typeof name !== 'string' || !Object.hasOwn(ALLOWLIST.runners, name)) throw new Error('Unsupported runner');
  const adapter = adapters[name];

  function binary(env = process.env) {
    return (env.SWARM_TEST === '1' && env['SWARM_' + name.toUpperCase()]) || ALLOWLIST.runners[name];
  }

  return {
    name,
    binary,
    buildCommand({ model, effort, projectDir, research }) {
      assertModel(model);
      if (!ALLOWLIST.efforts.includes(effort)) throw new Error('Unsupported reasoning effort');
      const args = adapter.args({ model, effort, projectDir, research });
      return { command: binary(), args, cwd: projectDir, input: 'stdin' };
    },
    createParser: adapter.parser,
    async readiness({ model, timeoutMs = READINESS_LIMIT_MS }) {
      assertModel(model);
      const limit = Number.isFinite(timeoutMs) && timeoutMs > 0
        ? Math.max(1, Math.min(READINESS_LIMIT_MS, Math.floor(timeoutMs)))
        : READINESS_LIMIT_MS;
      const start = performance.now();
      const deadline = start + limit;
      const command = binary();
      let version = '';
      const result = (ok, detail) => ({ ok, version, login: ok, detail, ms: Math.round(performance.now() - start) });
      const timeout = () => result(false, `Readiness check timed out after ${limit} ms.`);

      const versionCheck = await probe(command, ['--version'], deadline);
      if (versionCheck.timedOut) return timeout();
      if (versionCheck.error?.code === 'ENOENT') return result(false, `${name} binary not found.`);
      if (versionCheck.error) return result(false, `Could not get the ${name} version.`);
      version = versionCheck.stdout || versionCheck.stderr;

      const authCheck = await probe(command, adapter.authArgs(model), deadline);
      if (authCheck.timedOut) return timeout();
      if (authCheck.error || !adapter.loggedIn(authCheck)) return result(false, `${name} is not logged in.`);
      return result(true, `${name} is ready.`);
    },
  };
}

module.exports = { get };
