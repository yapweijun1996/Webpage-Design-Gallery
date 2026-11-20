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
// Agents run ONLY through the codex or pi CLI, with the allowlisted model and effort from the settings file (lib/settings.js).
const S = require('./lib/settings');
const R = require('./lib/runners');
const G = require('./lib/guard');
const SETTINGS_PATH = (process.env.SWARM_TEST === '1' && process.env.SWARM_SETTINGS) || path.join(ROOT, '.run', 'settings.json'); // override only in test mode
const loaded = S.load(SETTINGS_PATH);
let settings = loaded.settings;
for (const w of loaded.warnings) console.warn('settings:', w);
const readiness = {}; // last readiness result per runner (Settings page "Test")
const modelLabel = () => { const r = S.resolve(settings, 'worker'); return `${r.runner} / ${r.model} / ${r.effort}`; };
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
const DS_DIR = path.join(ROOT, 'design-system');
const STAFF_DIR = path.join(ROOT, 'staff');
const STAFF = require('./lib/staff');
const GJH_V11_ASSETS = path.resolve(ROOT, '..', 'demos', 'corporate', 'gjh', 'v11', 'assets'); // read-only mall concept images for /gjh-v11/*
let agentsDef = JSON.parse(fs.readFileSync(path.join(TEMPLATE, 'agents.json'), 'utf8'));
const state = { project: path.basename(PROJECT), phase: 'idle', round: 0, rounds: PLAN.length, plan: PLAN, model: modelLabel(), brief: '', agents: {}, feed: [] };
const clients = new Set();
const children = new Map();
let stopped = false;

function emit(evt) {
  evt.ts = Date.now();
  if (evt.type !== 'edit' && evt.type !== 'state') { state.feed.push(evt); if (state.feed.length > 300) state.feed.shift(); }
  const line = 'data: ' + JSON.stringify(evt) + '\n\n';
  for (const c of clients) c.write(line);
}

// Copy the staff handbook and the design system (text and icon assets only) into the project so agents can read them in their sandbox.
function copyTree(from, to, allow) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (e.isDirectory()) copyTree(src, dst, allow);
    else if (allow.test(e.name)) fs.copyFileSync(src, dst);
  }
}
function syncDocs() {
  copyTree(STAFF_DIR, path.join(PROJECT, 'staff'), /\.(md|json)$/);
  copyTree(DS_DIR, path.join(PROJECT, 'design-system'), /\.(md|json|css|js|html|tpl|webmanifest|png)$/);
  const lanes = agentsDef.map(a => `${a.id} ${a.lane}`).join('\n');
  fs.writeFileSync(path.join(PROJECT, 'CONTRACT.md'), fs.readFileSync(path.join(TEMPLATE, 'CONTRACT.md'), 'utf8').replace('{{LANES}}', lanes));
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
  syncDocs();
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


// ---------- agent processes (runner-agnostic) ----------
// Concurrency limit from settings.concurrency.maxParallel.
let running = 0;
const waiters = [];
const slot = {
  acquire() { if (running < settings.concurrency.maxParallel) { running += 1; return Promise.resolve(); } return new Promise(r => waiters.push(r)); },
  release() { running -= 1; while (waiters.length && running < settings.concurrency.maxParallel) { running += 1; waiters.shift()(); } }
};

// Standing owner rules and the channel language go after the STEP line (the first line must stay `STEP: ...`).
function withPreamble(promptText, a, label) {
  let pre = S.preamble(settings);
  try { const sp = STAFF.preamble({ staffDir: path.join(PROJECT, 'staff'), agentId: a.id, step: label }); if (sp) pre = (pre ? pre + '\n' : '') + sp; } catch (_) { /* no staff files in this project: skip */ }
  if (!pre) return promptText;
  if (promptText.startsWith('STEP:')) { const i = promptText.indexOf('\n'); return i < 0 ? promptText + '\n' + pre : promptText.slice(0, i + 1) + pre + '\n' + promptText.slice(i + 1); }
  return pre + '\n' + promptText;
}

function ownedGlobs(a) {
  if (a.id === MANAGER.id) return ['direction.md', 'decisions.md', 'review.md', 'review1.md', 'review2.md', 'chat/00.jsonl', 'inbox/00.md'];
  return [`sections/${a.id}-*.html`, `sections/${a.id}-*.css`, `notes/${a.id}.md`, `discussion/${a.id}.md`, `chat/${a.id}.jsonl`];
}

// Normalized runner events -> cursor moves and thought bubbles.
function applyEvent(a, ev) {
  const ag = state.agents[a.id];
  if (ev.kind === 'thought' && ev.text) {
    ag.thought = ev.text.trim();
    emit({ type: 'thought', id: a.id, text: ag.thought });
  } else if (ev.kind === 'action') {
    const refs = (ev.sections || []).slice();
    if (/\b(direction|decisions|review[12]?)\.md/.test(String(ev.target || '')) && a.id !== MANAGER.id) refs.push(MANAGER.id);
    const other = refs.find(r => r !== a.id);
    const verb = ev.verb === 'running' ? 'looking' : (other && ev.verb === 'editing' ? 'reading' : ev.verb);
    ag.action = verb + (other ? ' ' + other : '');
    ag.target = other || a.id;
    emit({ type: 'action', id: a.id, verb, target: ag.target, cmd: String(ev.target || '').replace(/^\/bin\/zsh -lc\s*/, '').slice(0, 140) });
  }
}

// One process, one turn. Resolves true when the process exited cleanly without a fatal runner error.
function runOnce(a, label, promptText) {
  return new Promise(resolve => {
    const resolved = S.resolve(settings, a.id === MANAGER.id ? 'manager' : 'worker');
    let runner, cmd;
    try { runner = R.get(resolved.runner); cmd = runner.buildCommand({ model: resolved.model, effort: resolved.effort, projectDir: PROJECT }); }
    catch (e) { emit({ type: 'chat', msg: chat ? chat.post({ from: 'system', kind: 'system', text: `Cannot start ${a.name}: ${e.message}` }) : { id: 0 } }); return resolve(false); }
    const parser = runner.createParser();
    const before = resolved.runner === 'pi' ? G.snapshot(PROJECT) : null; // pi has no sandbox: compare the tree after the turn
    const p = spawn(cmd.command, cmd.args, { cwd: cmd.cwd || PROJECT, stdio: ['pipe', 'pipe', 'ignore'] });
    children.set(a.id, p);
    let fatal = false, settled = false;
    const timer = setTimeout(() => { fatal = true; try { p.kill('SIGTERM'); } catch (_) {} }, settings.timeouts.turnMinutes * 60000);
    const handle = evs => { for (const ev of evs) { if (ev.kind === 'error') fatal = true; else applyEvent(a, ev); } };
    const finish = ok => {
      if (settled) return; settled = true;
      clearTimeout(timer); children.delete(a.id);
      if (before && chat) {
        try {
          const bad = G.violations(before, G.snapshot(PROJECT), ownedGlobs(a));
          if (bad.length) chat.post({ from: 'system', kind: 'system', text: `${a.name} changed files outside its ownership: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ' ...' : ''}` });
        } catch (_) { /* guard problems must not fail the turn */ }
      }
      resolve(ok && !fatal);
    };
    p.on('error', () => finish(false));
    p.stdin.on('error', () => {});
    p.stdin.end(withPreamble(promptText, a, label));
    p.stdout.on('data', d => { try { handle(parser.push(d)); } catch (_) { /* parser errors must not kill the run */ } });
    p.on('close', code => { try { handle(parser.end()); } catch (_) {} finish(code === 0); });
  });
}

async function runProcess(a, label, promptText, isLast) {
  const ag = state.agents[a.id];
  if (!ag) return false;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    ag.status = 'working ' + label; ag.action = 'starting'; ag.target = a.id;
    emit({ type: 'status', id: a.id, status: ag.status });
    await slot.acquire();
    let ok = false;
    try { ok = await runOnce(a, label, promptText); } finally { slot.release(); }
    if (stopped) return false;
    if (ok) {
      ag.status = isLast ? 'done' : 'waiting'; ag.action = '';
      emit({ type: 'status', id: a.id, status: ag.status });
      return true;
    }
    if (attempt === 1) emit({ type: 'status', id: a.id, status: 'retrying' });
  }
  ag.status = 'failed'; ag.action = '';
  emit({ type: 'status', id: a.id, status: 'failed' });
  return false;
}

function runWorker(a, step) { return runProcess(a, step.label, prompt(a, step), step === PLAN[PLAN.length - 1]); }

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
    runAgent: ({ id, label, prompt: pr }) => { const a = everyone().find(x => x.id === id); return a ? runProcess(a, label, pr, false).then(ok => { chat.sync(); return ok; }) : Promise.resolve(false); }
  });
}
let inFlight = 0; // requests being handled or waiting in the queue
function startTurn(msg) {
  inFlight += 1;
  state.phase = 'running'; emit({ type: 'phase', phase: 'running' });
  emit({ type: 'busy', busy: true });
  Promise.resolve(turns.onOwnerMessage(msg)).catch(e => emit({ type: 'chat', msg: chat.post({ from: 'system', text: 'Turn failed: ' + e.message, kind: 'system' }) })).finally(() => { inFlight -= 1; const b = turns.busy(); emit({ type: 'busy', busy: b }); if (!b && state.phase === 'running') { state.phase = 'ready'; emit({ type: 'phase', phase: 'ready' }); } });
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
  if (p === '/api/settings' && req.method === 'GET') return send(res, 200, { settings, allowlist: S.ALLOWLIST, resolved: { manager: S.resolve(settings, 'manager'), worker: S.resolve(settings, 'worker') }, status: readiness });
  if (p === '/api/settings' && req.method === 'PUT') {
    const r = S.save(SETTINGS_PATH, await body(req));
    if (!r.ok) return send(res, 400, { errors: r.errors });
    settings = r.settings; state.model = modelLabel(); emit({ type: 'settings', model: state.model });
    return send(res, 200, { settings });
  }
  if (p === '/api/settings/test' && req.method === 'POST') {
    const b = await body(req);
    const check = S.validate({ defaults: { runner: b.runner, model: b.model || settings.defaults.model, effort: 'medium' } });
    if (!check.ok) return send(res, 400, { errors: check.errors });
    const result = await R.get(b.runner).readiness({ model: b.model || settings.defaults.model });
    readiness[b.runner] = result;
    return send(res, 200, result);
  }
  if (p === '/api/chat' && req.method === 'GET') return send(res, 200, { messages: chat ? chat.history(Number(url.searchParams.get('since')) || 0) : [] });
  if (p === '/api/chat' && req.method === 'POST') {
    const b = await body(req);
    const text = String(b.text || '').trim();
    const from = b.from === 'owner' ? 'owner' : 'claude';
    if (!text) return send(res, 400, { error: 'empty' });
    if (!chat) return send(res, 409, { error: 'channel not ready' });
    const ahead = inFlight;
    const msg = chat.post({ from, text });
    // Requests are handled one at a time; say so, otherwise a waiting message looks ignored.
    if (ahead > 0) chat.post({ from: 'system', kind: 'system', text: `Queued: ${ahead} request${ahead > 1 ? 's' : ''} ahead. The team will start on #${msg.id} when it finishes the current one (about 5 to 10 minutes). \u5df2\u6392\u961f\uff0c\u56e2\u961f\u5904\u7406\u5b8c\u5f53\u524d\u8bf7\u6c42\u540e\u4f1a\u5f00\u59cb\u5904\u7406\u4f60\u7684\u6d88\u606f\u3002` });
    startTurn(msg);
    return send(res, 200, { id: msg.id });
  }
  if (p === '/api/sync' && req.method === 'POST') {
    if (!fs.existsSync(PROJECT)) return send(res, 409, { error: 'no project' });
    syncDocs();
    return send(res, 200, { ok: true });
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
  if (p.startsWith('/ds/')) return serveFile(res, DS_DIR, p.slice(4));
  const cat = /^\/i18n\/(en|zh-Hans|ms)\.json$/.exec(p);
  if (cat) { // catalog for the preview: SDS shell strings + the project's own extracted strings
    const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } };
    const a = read(path.join(DS_DIR, 'i18n', cat[1] + '.json')), b = read(path.join(PROJECT, 'i18n', cat[1] + '.json'));
    return send(res, 200, { meta: (b || a || {}).meta || { lang: cat[1] }, messages: { ...((a || {}).messages || {}), ...((b || {}).messages || {}) } });
  }
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
