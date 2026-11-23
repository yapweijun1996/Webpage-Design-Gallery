# Swarm channel spec (group chat for the owner, the manager agent and 10 worker agents)

Goal: a Slack-like channel. The owner (human) or Claude types a request, the Manager agent triages and @mentions workers, the workers discuss in the channel, then the assigned workers edit their sections in parallel, and everything is visible live in the browser. Node 23, no npm dependencies, CommonJS, English comments and identifiers.

## Participants (ids)
- `owner` (the human), `claude` (the controlling coding agent), `00` Manager, `01`..`10` workers (more or fewer is possible; ids come from the agents list). `system` is used for server notices.
- Colors: owner `#8ab4ff`, claude `#d97757`, system `#8b93a7`; agents carry their own `color`.

## Message schema (one JSON object)
```
{ "id": 17,            // integer, assigned by the server, strictly increasing from 1
  "ts": 1760000000000, // ms epoch, assigned by the server
  "from": "03",        // participant id
  "to": ["02","05"],   // mentioned participant ids, [] = everyone
  "kind": "msg",       // "msg" | "assign" | "decision" | "done" | "system"
  "text": "...",       // plain text, max 800 chars (server truncates), may contain @03 or @Agent 3 style mentions
  "task": "...",       // only for kind "assign": what the assignee must do (max 400 chars)
  "reply": 12 }        // optional: id of the message this answers
```
`@mention` parsing: `@03`, `@3`, `@agent3`, `@Agent 3`, `@manager`, `@all`, `@everyone`, and `@<section name>` (e.g. `@hero`) all resolve to participant ids; unknown mentions are ignored. Parsed mentions are merged into `to` (deduplicated, sorted).

## Storage and posting protocol
Project dir = `swarm/projects/<name>/` (called PROJECT below).
- `PROJECT/channel.jsonl`: append-only canonical log, written ONLY by the server (`lib/chat.js`).
- `PROJECT/channel.md`: server-maintained plain-text transcript of the last 80 messages, rewritten after each post, one line per message: `#17 [Agent 3 -> Agent 2,Agent 5] (assign) text...`. Agents READ this file to follow the conversation.
- `PROJECT/chat/NN.jsonl`: outbox per worker (`NN` = worker id). Workers append one JSON line: `{"to":["02"],"kind":"msg","text":"...","task":"...","reply":12}` (only `text` required). The server watches worker outboxes, tracks byte offsets to ingest each line once, and stamps the sender from the filename. Malformed lines are skipped and reported as a `system` message.
- The Manager emits one final assistant response per channel step with the object `{"swarmChannel":[{"kind":"msg","text":"..."}]}`. An empty array is valid. The parser limits each completed Manager assistant text to 96 KiB of UTF-8. A response may contain bare JSON or a standalone fenced JSON block. The server accepts at most 24 posts per batch, binds their sender to the launched Manager process, and validates the whole batch before publishing after a successful exit. Assignments are accepted only during Triage, Decide, and Review. `chat/00.jsonl` is no longer a live input. Previous Manager posts remain in the channel history.
- The server stamps canonical IDs and timestamps, appends published messages to `channel.jsonl`, refreshes `channel.md`, and emits SSE events. Manager process binding does not provide operating-system isolation for worker files.
- Owner/Claude messages arrive over HTTP (below) and use the same `post()`.

## HTTP API (added to `server.js` by the manager; do not implement in lib files)
- `POST /api/chat` body `{ "from": "owner"|"claude", "text": "..." }` -> `{ "id": n }`; starts a turn (see below).
- `GET /api/chat?since=<id>` -> `{ "messages": [...] }` (all with id > since; since defaults to 0).
- SSE `/events` gets `{type:"chat", msg:{...}}` for every message. Existing event types (`status`, `thought`, `action`, `edit`, `doc`, `round`, `phase`, `state`, `manager`) are unchanged.

## lib/chat.js contract
```js
const { createChat, parseMentions } = require('./chat');
const chat = createChat({ projectDir, agents, emit });   // agents: [{id,name,section,color}] including manager '00'
chat.start();                 // creates channel files and watches worker outboxes
chat.stop();
chat.post(partialMsg);        // -> full msg (id, ts assigned). partialMsg: {from, to?, text, kind?, task?, reply?}; parses @mentions into `to`
chat.publishManager(posts, { allowAssignments }); // server-only publisher for one successfully completed Manager envelope
chat.history(sinceId = 0);    // -> array of messages with id > sinceId
chat.render(limit = 80);      // -> channel.md text
parseMentions(text, agents);  // -> sorted unique array of ids
```
`emit(evt)` is called with `{type:'chat', msg}` after each post. Reset: calling `createChat` on a project dir whose files were deleted starts at id 1.

## lib/turns.js contract (orchestration of one owner message)
```js
const { createTurns } = require('./turns');
const turns = createTurns({ chat, runAgent, agents, managerId: '00', maxDiscussRounds: 2 });
await turns.onOwnerMessage(msg);   // msg = a posted message from owner/claude
turns.busy();                      // -> boolean
```
- `runAgent({ id, label, prompt })` is provided by the server: runs one Codex CLI turn for agent `id` with that prompt and resolves `true` (success) or `false`. In unit tests it is a fake.
- Messages that arrive while busy are queued (FIFO) and handled after the current one; none are lost.
- Flow for one owner message M:
  1. TRIAGE: run the Manager with label `Triage`. The Manager reads `channel.md` and responds with a short plan and one `kind:"assign"` message per worker it wants involved (`to:[id]`, `task`) in the same envelope. If the Manager posts no assignment, the flow ends after its reply.
  2. DISCUSS (up to `maxDiscussRounds`): the assigned workers run in parallel with label `Discuss`; each reads `channel.md`, posts 1-3 short messages (@ colleagues about overlaps, handoffs, questions, objections). After a round, only workers that were @mentioned by a peer message in that round and have not yet replied run again; stop when none remain.
  3. DECIDE: manager runs with label `Decide`, posts one `kind:"decision"` message summarizing agreed handoffs and per-worker task; may update `assign` tasks by posting new assign messages.
  4. WORK: the latest assignments from the successful Triage and Decide phases of this turn choose the workers. They run in parallel with label `Work`, edit their own files, and post a `kind:"done"` message to their outbox.
  5. SUMMARY: manager runs with label `Summary` and posts one short wrap-up to the owner.
- A `system` message is posted at the start of each step (`Triage started`, ...). A failed `runAgent` posts a `system` message `Agent N failed in <label>` and the flow continues.
- The FIRST line of every prompt is exactly `STEP: <Label> | AGENT: <id>` (e.g. `STEP: Discuss | AGENT: 03`), so test doubles can recognise the step. Labels: `Triage`, `Discuss`, `Decide`, `Work`, `Summary`.
- Test hook: the server starts the agent binary named by env `SWARM_CODEX` (default `codex`) with the same arguments as Codex CLI (`exec --json ... -C <PROJECT> -`, prompt on stdin) and parses Codex JSONL events on stdout (`item.completed` with `item.type:"agent_message"` and `item.text`; `item.started` with `item.type:"command_execution"` and `item.command`; `turn.completed`). Env `SWARM_PROJECT` selects the project dir name and `SWARM_PORT` the port.
- Prompts include the agent's role and lane, project context, an example of the participant's posting format, and the live narration rule. Work prompts include the worker's file ownership. Manager prompts request the final assistant envelope and worker prompts retain JSON-line outboxes.

## UI contract
- `ui/channel.js` + `ui/channel.css` expose `window.SwarmChannel` : `init({ root, agents, send, onJump })`, `setHistory(messages)`, `add(msg)`, `setStatus(id, statusText)`, `setBusy(bool)`. `root` is an element the module fills; `send(text)` is called when the owner submits; `onJump(id)` is called when a participant name is clicked.
- `ui/docs.js` + `ui/docs.css` expose `window.SwarmDocs`: `init({ root, base, files })`, `refresh(file)` where files default to `direction.md, decisions.md, review1.md, review2.md`, fetched from `base + file`.
- Both are plain scripts (no modules, no dependencies), theme-neutral dark UI that matches the existing viewer (background `#13161c`, text `#e8eaf0`, border `#262b36`), keyboard accessible, work at 330px width (sidebar) and 393px (phone), escape all text (no innerHTML with raw user text), and honor prefers-reduced-motion.

## Ownership
Each worker owns the files listed in its own assignment and must not edit any other file. `server.js`, `ui/index.html`, `template/*` are owned by the manager (Claude).
