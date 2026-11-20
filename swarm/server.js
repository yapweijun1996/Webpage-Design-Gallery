#!/usr/bin/env node
'use strict';
// Swarm server: orchestrates N Codex CLI workers on one page, streams live events to the browser (SSE).
// No dependencies. Controlled by swarm/cli.js (or plain HTTP).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'template');
const UI = path.join(ROOT, 'ui');
const PORT = Number(process.env.SWARM_PORT) || 8800;
const PROJECT = path.join(ROOT, 'projects', process.env.SWARM_PROJECT || 'home');
const MODEL = process.env.SWARM_MODEL || 'gpt-6.2-sol';
const EFFORT = process.env.SWARM_EFFORT || 'low';
// Company-style pipeline: a Manager sets direction, workers propose and discuss, the Manager decides, then build/review cycles.
const PLAN = [
  { key: 'kickoff', label: 'Kickoff', who: 'manager', meeting: true },
  { key: 'propose', label: 'Proposals', who: 'workers', meeting: true },
  { key: 'respond', label: 'Discussion', who: 'workers', meeting: true },
  { key: 'decide', label: 'Decisions', who: 'manager', meeting: true },
  { key: 'build', label: 'Build', who: 'workers' },
  { key: 'review1', label: 'Review 1', who: 'manager', meeting: true },
  { key: 'improve', label: 'Improve together', who: 'workers' },
  { key: 'review2', label: 'Review 2', who: 'manager', meeting: true },
  { key: 'apply', label: 'Apply feedback', who: 'workers' }
];
const MANAGER = { id: '00', name: 'Manager', color: '#f4f4f5', section: '', lane: 'art director: owns direction.md, decisions.md, review1.md and review2.md. Aligns the team, settles conflicts, reviews the assembled page.' };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

const GJH_ASSETS = path.resolve(ROOT, '..', 'assets', 'companies', 'gjh'); // read-only image library for /gjh/*
const GJH_V11_ASSETS = path.resolve(ROOT, '..', 'demos', 'corporate', 'gjh', 'v11', 'assets'); // read-only mall concept images for /gjh-v11/*
let agentsDef = JSON.parse(fs.readFileSync(path.join(TEMPLATE, 'agents.json'), 'utf8'));
const state = { project: path.basename(PROJECT), phase: 'idle', round: 0, rounds: PLAN.length, plan: PLAN, model: MODEL + ' / ' + EFFORT, brief: '', agents: {}, feed: [] };
const clients = new Set();
const children = new Map();
let stopped = false;

function emit(evt) {
  evt.ts = Date.now();
  if (evt.type !== 'edit' && evt.type !== 'state') { state.feed.push(evt); if (state.feed.length > 300) state.feed.shift(); }
  const line = 'data: ' + JSON.stringify(evt) + '\n\n';
  for (const c of clients) c.write(line);
}

function initProject(brief) {
  fs.rmSync(PROJECT, { recursive: true, force: true });
  for (const d of ['sections', 'notes', 'inbox', 'discussion']) fs.mkdirSync(path.join(PROJECT, d), { recursive: true });
  fs.writeFileSync(path.join(PROJECT, 'inbox', '00.md'), '');
  for (const f of ['direction.md', 'decisions.md', 'review1.md', 'review2.md']) fs.writeFileSync(path.join(PROJECT, f), '');
  const lanes = agentsDef.map(a => `${a.id} ${a.lane}`).join('\n');
  fs.writeFileSync(path.join(PROJECT, 'CONTRACT.md'), fs.readFileSync(path.join(TEMPLATE, 'CONTRACT.md'), 'utf8').replace('{{LANES}}', lanes));
  fs.writeFileSync(path.join(PROJECT, 'brief.md'), brief || fs.readFileSync(path.join(TEMPLATE, 'brief.md'), 'utf8'));
  fs.copyFileSync(path.resolve(ROOT, '..', 'design-canvas', 'tokens.css'), path.join(PROJECT, 'tokens.css'));
  fs.writeFileSync(path.join(PROJECT, 'agents.json'), JSON.stringify(agentsDef, null, 1)); // the project remembers its own team
  fs.writeFileSync(path.join(PROJECT, 'names.json'), JSON.stringify(agentsDef.map(a => ({ id: a.id, section: a.section })), null, 1));
  for (const a of agentsDef) {
    fs.writeFileSync(path.join(PROJECT, 'sections', `${a.id}-${a.section}.html`), `<section class="s-${a.id}" id="${a.id}-${a.section}"></section>\n`);
    fs.writeFileSync(path.join(PROJECT, 'sections', `${a.id}-${a.section}.css`), '');
    fs.writeFileSync(path.join(PROJECT, 'notes', `${a.id}.md`), '');
    fs.writeFileSync(path.join(PROJECT, 'inbox', `${a.id}.md`), '');
    fs.writeFileSync(path.join(PROJECT, 'discussion', `${a.id}.md`), '');
  }
  state.brief = fs.readFileSync(path.join(PROJECT, 'brief.md'), 'utf8');
  state.agents = {};
  for (const a of [MANAGER, ...agentsDef]) state.agents[a.id] = { id: a.id, name: a.name, color: a.color, section: a.section, lane: a.lane, status: 'queued', thought: '', action: '', target: a.id };
  state.feed = [];
}

// ---------- file watcher: edits become cursor/wipe events ----------
let watcher = null;
const debounce = new Map();
function watchProject() {
  if (watcher) watcher.close();
  watcher = fs.watch(PROJECT, { recursive: true }, (_ev, file) => {
    if (!file) return;
    const m = /^(sections|notes)[\\/](\d\d)(?:-[a-z0-9]+)?\.(html|css|md)$/.exec(file);
    const d = /^(?:(direction|decisions|review1|review2)\.md|discussion[\\/](\d\d)\.md)$/.exec(file);
    if (!m && !d) return;
    const key = file;
    clearTimeout(debounce.get(key));
    debounce.set(key, setTimeout(() => emit(m ? { type: 'edit', id: m[2], kind: m[1], file } : { type: 'doc', id: d[2] || '00', file: file.replace(/\\/g, '/') }), 120));
  });
}

// ---------- workers ----------
function prompt(a, step) {
  const n = agentsDef.length, own = `sections/${a.id}-${a.section}.html, sections/${a.id}-${a.section}.css, notes/${a.id}.md, discussion/${a.id}.md`;
  const common = `Read CONTRACT.md and brief.md first and follow them exactly. Also read inbox/${a.id}.md: it holds live instructions from the owner (via the manager).
Live narration rule: before each major step write ONE short sentence (max 20 words) of intent; the owner watches it live.`;
  if (a.id === MANAGER.id) {
    const task = {
      kickoff: `KICKOFF. Read the brief, then write direction.md (max 60 lines): (1) one-paragraph concept and the feeling of the page; (2) a visual system every section must share: background alternation order of the ${n} sections, type scale usage, spacing rhythm, accent usage, image treatment, motion rules; (3) the section order with an explicit HANDOFF line for each neighbour pair (how section N ends and section N+1 opens); (4) a table: agent -> its section -> its one unique contribution -> what to avoid; (5) top 5 risks. Do not touch any other file.`,
      decide: `DECISIONS. Read direction.md and every discussion/*.md (proposals and replies). Resolve conflicts, duplicated ideas and unmet needs. Write decisions.md (max 60 lines): final handoff agreements pair by pair, rulings on every disagreement with a one-line reason, and a DO / DON'T list per agent number. Where an agent's proposal beats direction.md, say so and update the rule in decisions.md. Do not touch any other file.`,
      review1: `REVIEW 1. The team built round one. Read direction.md, decisions.md, brief.md and EVERY sections/*.html and sections/*.css as one page. Write review1.md (max 70 lines): what works; page-level problems (rhythm, repeated copy, clashing styles, weak handoffs, accessibility, 393px mobile risks); then per agent number the top 3 concrete changes ranked by impact. Be specific and kind. Do not touch any other file.`,
      review2: `REVIEW 2. The team has improved the page. Read direction.md, decisions.md, review1.md and EVERY section file. Write review2.md (max 50 lines): which review1 items were fixed, what is still wrong, and per agent number at most 2 final changes. Call out any section that is now off-brief or invented facts. Do not touch any other file.`
    }[step.key];
    return `You are the Manager (art director) of a team of ${n} agents building ONE shared page at the same time. ${common}
You own ONLY: direction.md, decisions.md, review1.md, review2.md. Never edit sections, notes or discussion files.
${task}`;
  }
  const task = {
    propose: `PROPOSAL. Read direction.md and the brief. Do NOT build yet. Write discussion/${a.id}.md with a heading '## Proposal' (max 6 lines): your section's concept, the one thing that makes it distinct, what you need from the section above and below it, and any conflict with direction.md. Edit only discussion/${a.id}.md.`,
    respond: `DISCUSSION. Read EVERY discussion/*.md (all proposals). Do NOT build yet. Append '## Replies' to discussion/${a.id}.md (max 8 lines): react to specific agents by number (agree, ask, resolve overlaps, promise a handoff), flag duplicated ideas, and say what you will change in your plan because of them. Edit only discussion/${a.id}.md.`,
    build: `BUILD. Read direction.md, decisions.md and the discussions, then build your section as agreed (honour your DO/DON'T list and the handoffs). Write notes/${a.id}.md (max 6 lines).`,
    improve: `IMPROVE TOGETHER. Read review1.md and every section, note and decision. Improve YOUR section so the whole page flows and the reviewer's top changes for you are done. Append '## Improve' to notes/${a.id}.md: what changed and up to 2 suggestions to named other agents.`,
    apply: `APPLY FEEDBACK. Read review2.md, the other agents' suggestions in notes/*.md addressed to you, and inbox/${a.id}.md. Apply what you agree with; append '## Apply' to notes/${a.id}.md listing accepted and declined. Keep all facts verified.`
  }[step.key];
  return `You are ${a.name} (worker ${a.id} of ${n}) on a team building ONE shared page that other agents edit at the same time, led by the Manager. ${common}
Your lane: ${a.lane}
You may edit ONLY: ${own}. Other agents and the manager edit their own files at the same time.
${task}`;
}

function digest(a, ev) {
  const it = ev.item || {};
  const ag = state.agents[a.id];
  if (ev.type === 'item.completed' && it.type === 'agent_message' && it.text) {
    ag.thought = it.text.trim();
    emit({ type: 'thought', id: a.id, text: ag.thought });
  } else if (ev.type === 'item.started' && it.type === 'command_execution') {
    const cmd = String(it.command || '');
    const refs = [...cmd.matchAll(/(?:sections|notes|discussion)\/(\d\d)/g)].map(m => m[1]);
    if (/\b(direction|decisions|review[12])\.md/.test(cmd) && a.id !== MANAGER.id) refs.push(MANAGER.id);
    const other = refs.find(r => r !== a.id);
    const writes = /(?:^|\s)(?:tee|apply_patch|python3?\b.*write|perl -pi|sed -i)|>\s*\S|<<\s*['"]?EOF/.test(cmd);
    const verb = writes && !other ? 'editing' : (other ? 'reading' : 'looking');
    ag.action = verb + (other ? ' ' + other : '');
    ag.target = other || a.id;
    emit({ type: 'action', id: a.id, verb, target: ag.target, cmd: cmd.replace(/^\/bin\/zsh -lc\s*/, '').slice(0, 140) });
  } else if (ev.type === 'item.completed' && it.type === 'file_change') {
    ag.action = 'editing';
    ag.target = a.id;
    emit({ type: 'action', id: a.id, verb: 'editing', target: a.id, cmd: 'file change' });
  }
}

const CODEX = process.env.SWARM_CODEX || 'codex';

// Runs ONE agent turn through the Codex CLI (or a test double named by SWARM_CODEX); streams its JSONL events to the browser.
function runCodex(a, label, promptText, isLast, attempt = 1) {
  return new Promise(resolve => {
    const ag = state.agents[a.id];
    if (!ag) return resolve(false);
    ag.status = 'working ' + label; ag.action = 'starting'; ag.target = a.id;
    emit({ type: 'status', id: a.id, status: ag.status });
    const p = spawn(CODEX, ['exec', '--json', '-m', MODEL, '-c', 'model_reasoning_effort=' + EFFORT, '-s', 'workspace-write', '--skip-git-repo-check', '-C', PROJECT, '-'], { stdio: ['pipe', 'pipe', 'ignore'] });
    children.set(a.id, p);
    let settled = false;
    const finish = ok => {
      if (settled) return; settled = true;
      children.delete(a.id);
      if (stopped) return resolve(false);
      if (!ok && attempt < 2) { emit({ type: 'status', id: a.id, status: 'retrying' }); return resolve(runCodex(a, label, promptText, isLast, attempt + 1)); }
      ag.status = ok ? (isLast ? 'done' : 'waiting') : 'failed';
      ag.action = '';
      emit({ type: 'status', id: a.id, status: ag.status });
      resolve(ok);
    };
    p.on('error', () => finish(false));
    p.stdin.on('error', () => {});
    p.stdin.end(promptText);
    let buf = '';
    p.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        try { digest(a, JSON.parse(line)); } catch (_) { /* ignore non-json */ }
      }
    });
    p.on('close', code => finish(code === 0));
  });
}

function runWorker(a, step) { return runCodex(a, step.label, prompt(a, step), step === PLAN[PLAN.length - 1]); }

// ---------- channel (group chat) ----------
const { createChat } = require('./lib/chat');
const { createTurns } = require('./lib/turns');
let chat = null, turns = null;
const everyone = () => [MANAGER, ...agentsDef];
function setupChat() {
  if (chat) chat.stop();
  chat = createChat({ projectDir: PROJECT, agents: everyone().map(a => ({ id: a.id, name: a.name, section: a.section, color: a.color })), emit });
  chat.start();
  turns = createTurns({
    chat, agents: everyone(), managerId: MANAGER.id, maxDiscussRounds: 2,
    // After each agent process exits, ingest its outbox immediately so the next step sees its messages (no watcher race).
    runAgent: ({ id, label, prompt: pr }) => { const a = everyone().find(x => x.id === id); return a ? runCodex(a, label, pr, false).then(ok => { chat.sync(); return ok; }) : Promise.resolve(false); }
  });
}
function startTurn(msg) {
  state.phase = 'running'; emit({ type: 'phase', phase: 'running' });
  emit({ type: 'busy', busy: true });
  Promise.resolve(turns.onOwnerMessage(msg)).catch(e => emit({ type: 'chat', msg: chat.post({ from: 'system', text: 'Turn failed: ' + e.message, kind: 'system' }) })).finally(() => { const b = turns.busy(); emit({ type: 'busy', busy: b }); if (!b && state.phase === 'running') { state.phase = 'ready'; emit({ type: 'phase', phase: 'ready' }); } });
}

function prepare(brief, agentsFile) {
  stopped = false;
  agentsDef = JSON.parse(fs.readFileSync(agentsFile || path.join(TEMPLATE, 'agents.json'), 'utf8'));
  initProject(brief);
  watchProject();
  setupChat();
}

async function runAll(brief, agentsFile) {
  prepare(brief, agentsFile);
  state.phase = 'running';
  emit({ type: 'state', state });
  for (let i = 0; i < PLAN.length; i++) {
    if (stopped) break;
    const step = PLAN[i];
    state.round = i + 1;
    emit({ type: 'round', round: i + 1, label: step.label, meeting: !!step.meeting });
    await Promise.all((step.who === 'manager' ? [MANAGER] : agentsDef).map(a => runWorker(a, step)));
  }
  // the manager finishes with the team: mark it done
  if (!stopped && state.agents[MANAGER.id]) { state.agents[MANAGER.id].status = 'done'; emit({ type: 'status', id: MANAGER.id, status: 'done' }); }
  state.phase = stopped ? 'stopped' : 'done';
  emit({ type: 'phase', phase: state.phase });
}

function stopAll() {
  stopped = true;
  for (const p of children.values()) p.kill('SIGTERM');
}

// ---------- http ----------
function send(res, code, body, type) { res.writeHead(code, { 'content-type': type || 'application/json', 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
function serveFile(res, base, rel) {
  const full = path.normalize(path.join(base, rel));
  if (!full.startsWith(base + path.sep) && full !== base) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(full, (err, buf) => err ? send(res, 404, 'not found', 'text/plain') : send(res, 200, buf, MIME[path.extname(full)] || 'application/octet-stream'));
}
function body(req) { return new Promise(r => { let s = ''; req.on('data', d => s += d); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch (_) { r({}); } }); }); }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  if (p === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write('data: ' + JSON.stringify({ type: 'state', state }) + '\n\n');
    clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  if (p === '/api/state') return send(res, 200, state);
  if (p === '/api/chat' && req.method === 'GET') return send(res, 200, { messages: chat ? chat.history(Number(url.searchParams.get('since')) || 0) : [] });
  if (p === '/api/chat' && req.method === 'POST') {
    const b = await body(req);
    const text = String(b.text || '').trim();
    const from = b.from === 'owner' ? 'owner' : 'claude';
    if (!text) return send(res, 400, { error: 'empty' });
    if (!chat) return send(res, 409, { error: 'channel not ready' });
    const msg = chat.post({ from, text });
    startTurn(msg);
    return send(res, 200, { id: msg.id });
  }
  if (p === '/api/init' && req.method === 'POST') {
    if (state.phase === 'running') return send(res, 409, { error: 'busy' });
    const b = await body(req);
    let af = '';
    if (b.agents) { af = path.resolve(b.agents); if (!af.startsWith(ROOT + path.sep) || !fs.existsSync(af)) return send(res, 400, { error: 'agents file must be inside swarm/' }); }
    prepare(b.brief || '', af);
    state.phase = 'ready'; state.round = 0;
    emit({ type: 'state', state });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/run' && req.method === 'POST') {
    if (state.phase === 'running') return send(res, 409, { error: 'already running' });
    const b = await body(req);
    let af = '';
    if (b.agents) { af = path.resolve(b.agents); if (!af.startsWith(ROOT + path.sep) || !fs.existsSync(af)) return send(res, 400, { error: 'agents file must be inside swarm/' }); }
    runAll(b.brief || '', af);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/say' && req.method === 'POST') {
    const b = await body(req);
    const ids = b.to === 'all' ? agentsDef.map(a => a.id) : [String(b.to).padStart(2, '0')];
    const text = String(b.text || '').trim();
    if (!text) return send(res, 400, { error: 'empty' });
    for (const id of ids) if (state.agents[id]) fs.appendFileSync(path.join(PROJECT, 'inbox', id + '.md'), `\n- ${new Date().toISOString()} manager: ${text}\n`);
    emit({ type: 'manager', to: b.to, text });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/stop' && req.method === 'POST') { stopAll(); return send(res, 200, { ok: true }); }
  if (p.startsWith('/p/')) return serveFile(res, PROJECT, p.slice(3));
  if (p.startsWith('/gjh/')) return serveFile(res, GJH_ASSETS, p.slice(5));
  if (p.startsWith('/gjh-v11/')) return serveFile(res, GJH_V11_ASSETS, p.slice(9));
  if (p === '/tokens.css') return serveFile(res, PROJECT, 'tokens.css');
  if (p === '/') return serveFile(res, UI, 'index.html');
  return serveFile(res, UI, p.slice(1));
}).listen(PORT, '127.0.0.1', () => console.log(`swarm listening on http://127.0.0.1:${PORT}`));

// Idle project so the viewer has something to show before the first run.
if (fs.existsSync(PROJECT)) {
  const remembered = path.join(PROJECT, 'agents.json');
  if (fs.existsSync(remembered)) agentsDef = JSON.parse(fs.readFileSync(remembered, 'utf8'));
  state.brief = fs.existsSync(path.join(PROJECT, 'brief.md')) ? fs.readFileSync(path.join(PROJECT, 'brief.md'), 'utf8') : '';
  for (const a of [MANAGER, ...agentsDef]) state.agents[a.id] = { id: a.id, name: a.name, color: a.color, section: a.section, lane: a.lane, status: 'queued', thought: '', action: '', target: a.id };
  watchProject();
  setupChat();
} else {
  initProject('');
  watchProject();
  setupChat();
}
process.on('SIGTERM', () => { stopAll(); process.exit(0); });
process.on('SIGINT', () => { stopAll(); process.exit(0); });
