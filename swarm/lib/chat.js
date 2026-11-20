'use strict';

const fs = require('node:fs');
const path = require('node:path');

const KINDS = new Set(['msg', 'assign', 'decision', 'done', 'system']);

function parseMentions(text, agents) {
  const aliases = new Map([
    ['all', agents.map(({ id }) => id)],
    ['everyone', agents.map(({ id }) => id)],
  ]);
  for (const { id, section } of agents) {
    const alias = section?.trim().toLowerCase().replace(/[ \t]+/g, ' ');
    if (alias && !aliases.has(alias)) {
      aliases.set(alias, [id]);
    }
  }
  for (const { id } of agents) {
    const number = id.replace(/^0+(?=\d)/, '');
    for (const alias of [id, number, `agent${number}`, `agent ${number}`]) {
      aliases.set(alias, [id]);
    }
    if (id === '00') aliases.set('manager', [id]);
  }

  const pattern = [...aliases.keys()]
    .sort((a, b) => b.length - a.length)
    .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll(' ', '[ \\t]+'))
    .join('|');
  const mentions = new RegExp(`(?<![\\p{L}\\p{N}_@])@(${pattern})(?![\\p{L}\\p{N}_-])`, 'gu');
  const recipients = new Set();
  for (const [, alias] of text.toLowerCase().matchAll(mentions)) {
    for (const id of aliases.get(alias.replace(/[ \t]+/g, ' '))) {
      recipients.add(id);
    }
  }
  return [...recipients].sort();
}

function readIfPresent(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return '';
  }
}

function truncate(text, limit) {
  return Array.from(text).slice(0, limit).join('');
}

function createChat({ projectDir, agents, emit }) {
  const chatDir = path.join(projectDir, 'chat');
  const logPath = path.join(projectDir, 'channel.jsonl');
  const transcriptPath = path.join(projectDir, 'channel.md');
  const checkpointPath = path.join(chatDir, '.offsets.json');
  const names = new Map([['owner', 'Owner'], ['claude', 'Claude'], ['system', 'System']]);
  for (const { id, name } of agents) names.set(id, name);

  const log = readIfPresent(logPath);
  const messages = log.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  const checkpoint = messages.length && readIfPresent(checkpointPath);
  const { offsets = {}, pending } = checkpoint ? JSON.parse(checkpoint) : {};
  let separator = log && !log.endsWith('\n') ? '\n' : '';
  let watcher;
  let poll;

  // The log determines whether the last prepared outbox cursor was committed.
  if (pending) {
    const committed = messages.findLast(({ id }) => id === pending.message.id);
    if (JSON.stringify(committed) === JSON.stringify(pending.message)) {
      offsets[pending.agentId] = pending.cursor;
    }
  }

  function render(limit = 80) {
    if (limit <= 0) return '';
    return messages.slice(-limit).map(({ id, from, to, kind, text }) => {
      const sender = names.get(from) ?? from;
      const recipients = to.length ? to.map((target) => names.get(target)).join(',') : 'Everyone';
      return `#${id} [${sender} -> ${recipients}] (${kind}) ${text.replace(/[\r\n\u2028\u2029]+/g, ' ')}\n`;
    }).join('');
  }

  function append({ from, to, kind, text, task, reply }, source) {
    const truncatedText = truncate(text, 800);
    const recipients = Array.isArray(to) ? to.filter((id) => names.has(id)) : [];
    const msg = {
      id: (messages.at(-1)?.id ?? 0) + 1,
      ts: Date.now(),
      from,
      to: [...new Set([...recipients, ...parseMentions(truncatedText, agents)])].sort(),
      kind: KINDS.has(kind) ? kind : 'msg',
      text: truncatedText,
    };
    if (msg.kind === 'assign' && typeof task === 'string') msg.task = truncate(task, 400);
    if (Number.isSafeInteger(reply) && reply > 0) msg.reply = reply;

    if (source) {
      // Prepare the cursor before appending so a restart can recover either outcome.
      const tempPath = `${checkpointPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify({ offsets, pending: { ...source, message: msg } }));
      fs.renameSync(tempPath, checkpointPath);
    }
    fs.appendFileSync(logPath, `${separator}${JSON.stringify(msg)}\n`);
    separator = '';
    messages.push(msg);
    if (source) offsets[source.agentId] = source.cursor;
    fs.writeFileSync(transcriptPath, render());
    emit({ type: 'chat', msg });
    return msg;
  }

  function post(partialMsg) {
    fs.mkdirSync(projectDir, { recursive: true });
    return append(partialMsg);
  }

  function ingest(agentId) {
    let fd;
    try {
      fd = fs.openSync(path.join(chatDir, `${agentId}.jsonl`), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ELOOP') return;
      throw error;
    }

    try {
      const { dev, ino, size } = fs.fstatSync(fd);
      const previous = offsets[agentId];
      const offset = previous?.dev === dev && previous.ino === ino && previous.offset <= size
        ? previous.offset : 0;
      if (offset === size) return;

      // Decode only complete lines so offsets stay correct across split UTF-8 writes.
      const buffer = Buffer.allocUnsafe(size - offset);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const count = fs.readSync(fd, buffer, bytesRead, buffer.length - bytesRead, offset + bytesRead);
        if (count === 0) break;
        bytesRead += count;
      }
      const data = buffer.subarray(0, bytesRead);
      let start = 0;
      for (let end = data.indexOf(10); end !== -1; end = data.indexOf(10, start)) {
        let candidate;
        try {
          candidate = JSON.parse(data.toString('utf8', start, end));
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
        // An assign line may carry only `task` (agents often omit `text`); use the task as the visible text.
        if (candidate && typeof candidate.text !== 'string' && typeof candidate.task === 'string' && candidate.task.trim()) {
          candidate = { ...candidate, text: candidate.task };
        }
        const message = typeof candidate?.text === 'string'
          ? { ...candidate, from: agentId }
          : { from: 'system', kind: 'system', text: `Malformed outbox line from ${names.get(agentId)} (${agentId})` };
        append(message, { agentId, cursor: { dev, ino, offset: offset + end + 1 } });
        start = end + 1;
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  const outboxes = new Map(agents.map(({ id }) => [`${id}.jsonl`, id]));

  function scan() {
    for (const agentId of outboxes.values()) ingest(agentId);
  }

  function start() {
    if (poll) return;
    fs.mkdirSync(chatDir, { recursive: true });
    fs.closeSync(fs.openSync(logPath, 'a'));
    fs.writeFileSync(transcriptPath, render());
    scan();
    try {
      watcher = fs.watch(chatDir, (_event, filename) => {
        if (!filename) scan();
        else if (outboxes.has(filename)) ingest(outboxes.get(filename));
      });
      watcher.on('error', () => watcher?.close());
    } catch {
      // Polling also covers platforms or directories without a usable watcher.
    }
    poll = setInterval(scan, 500);
  }

  function stop() {
    watcher?.close();
    watcher = undefined;
    clearInterval(poll);
    poll = undefined;
  }

  function history(sinceId = 0) {
    return messages.filter(({ id }) => id > sinceId);
  }

  // sync(): ingest every outbox right now (callers use it after an agent process exits, before reading history).
  return { start, stop, post, history, render, sync: scan };
}

module.exports = { createChat, parseMentions };
