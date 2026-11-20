#!/usr/bin/env node
'use strict';
// Swarm server: orchestrates N Codex CLI workers on one page, streams live events to the browser (SSE).
// No dependencies. Controlled by swarm/cli.js (or plain HTTP).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

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
  for (const a of [MANAGER, ...agentsDef]) state.agents[a.id] = { id: a.id, name: a.name, title: a.title || '', color: a.color, section: a.section, lane: a.lane, status: 'queued', thought: '', action: '', target: a.id };
  state.feed = [];
}

// ---------- file watcher: edits become cursor/wipe events ----------
let watcher = null;
const debounce = new Map();
function watchProject() {
  if (watcher) watcher.close();
  watcher = fs.watch(PROJECT, { recursive: true }, (_ev, file) => {
    if (!file) return;
    const m = /^(sections|notes)[\\/](\d\d)(?:-[a-z0-9-]+)?(?:\.(layout|type|color|imagery|icons|motion|polish))?\.(html|css|md)$/.exec(file);
    const d = /^(?:(direction|decisions|review1|review2)\.md|discussion[\\/](\d\d)\.md)$/.exec(file);
    if (!m && !d) return;
    const key = file;
    clearTimeout(debounce.get(key));
    debounce.set(key, setTimeout(() => emit(m ? { type: 'edit', id: (m[3] && (squadAgents.find(x => x.squad.layer === m[3]) || {}).id) || m[2], kind: m[1], file } : { type: 'doc', id: d[2] || '00', file: file.replace(/\\/g, '/') }), 120));
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
  if (a.id === MANAGER.id) return ['direction.md', 'decisions.md', 'review.md', 'review1.md', 'review2.md', 'research.md', 'chat/00.jsonl', 'inbox/00.md'];
  if (a.squad) { let w = []; try { w = SQ.ownedGlobs(a.squad, a.base || '00-none'); } catch (_) { /* no section yet */ } return [...w, `chat/${a.id}.jsonl`, `notes/${a.id}.md`]; }
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
    const role = label === 'Research' ? 'research' : (a.id === MANAGER.id ? 'manager' : 'worker');
    const base = S.resolve(settings, role);
    const own = role === 'worker' ? { runner: a.runner, model: a.model, effort: a.effort } : {};
    const resolved = { ...base, ...Object.fromEntries(Object.entries(own).filter(([, v]) => v)) }; // per-worker override, still checked against the allowlist by the runner
    let runner, cmd;
    try { runner = R.get(resolved.runner); ensureExport(); // agents can open the real rendering at /p/dist/index.html
    cmd = runner.buildCommand({ model: resolved.model, effort: resolved.effort, projectDir: PROJECT, research: label === 'Research' ? true : !!(settings.research && settings.research.web) }); }
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
          const bad = G.violations(before, G.snapshot(PROJECT), [...ownedGlobs(a), ...everyone().filter(o => o.id !== a.id && children.has(o.id)).flatMap(ownedGlobs)]); // files of agents running at the same time are theirs, not a violation
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
  if (label === 'Research' && !(settings.research && settings.research.web)) {
    if (chat) chat.post({ from: 'system', kind: 'system', text: 'Research skipped: web research is switched off in Settings.' });
    return true;
  }
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
const SQ = require('./lib/squad');
const SQ_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#fb923c', '#94a3b8', '#f87171', '#22d3ee', '#c084fc'];
const squadAgents = SQ_AGENTS_BUILD();
function SQ_AGENTS_BUILD() { return SQ.roster().map((spec, i) => ({ id: String(81 + i), name: spec.title, title: spec.title, color: SQ_COLORS[i % SQ_COLORS.length], section: 'sq-' + spec.id, lane: spec.mission, runner: spec.runner, squad: spec })); }
const SQ_FILE = (process.env.SWARM_TEST === '1' && process.env.SWARM_SETTINGS ? process.env.SWARM_SETTINGS + '.squad' : path.join(ROOT, '.run', 'squad.json'));
let squadOn = false;
try { squadOn = !!JSON.parse(fs.readFileSync(SQ_FILE, 'utf8')).on; } catch (_) { /* default off */ }
function setSquad(on) {
  squadOn = !!on;
  try { fs.mkdirSync(path.dirname(SQ_FILE), { recursive: true }); fs.writeFileSync(SQ_FILE, JSON.stringify({ on: squadOn })); } catch (_) { /* best effort */ }
  for (const a of squadAgents) {
    if (squadOn) state.agents[a.id] = state.agents[a.id] || { id: a.id, name: a.name, title: a.title, color: a.color, section: '', lane: a.lane, status: 'queued', thought: '', action: '', target: a.id };
    else delete state.agents[a.id];
  }
  emit({ type: 'state', state });
}
// Plan one squad turn for the screen the owner looks at (first in-scope section).
function squadPlan(owner) {
  const ids = owner.scope && Array.isArray(owner.scope.sections) ? owner.scope.sections : [];
  const def = agentsDef.find(a => a.id === ids[0]);
  if (!def) return null;
  const base = def.id + '-' + def.section;
  const picked = SQ.pickSquad(owner.scope, owner.text);
  const members = picked.map(spec => squadAgents.find(a => a.squad.id === spec.id)).filter(Boolean);
  for (const m of members) m.base = base;
  const byId = new Map(members.map(m => [m.squad.id, m]));
  const waves = SQ.waves(picked).map(w => w.map(spec => byId.get(spec.id)).filter(Boolean)).filter(w => w.length);
  const prompts = {};
  for (const m of members) prompts[m.id] = SQ.promptFor(m.squad, { base, scopeLine: '' });
  return { base, members, waves, prompts, layoutId: (byId.get('layout') || {}).id };
}
const everyone = () => [MANAGER, ...agentsDef, ...squadAgents];
function setupChat() {
  if (chat) chat.stop();
  chat = createChat({ projectDir: PROJECT, agents: everyone().map(a => ({ id: a.id, name: a.name, section: a.section, color: a.color })), emit });
  chat.start();
  turns = createTurns({
    chat, agents: everyone(), managerId: MANAGER.id, maxDiscussRounds: 2, squad: { on: () => squadOn, plan: squadPlan },
    // After each agent process exits, ingest its outbox immediately so the next step sees its messages (no watcher race).
    runAgent: ({ id, label, prompt: pr }) => { const a = everyone().find(x => x.id === id); return a ? runProcess(a, label, pr, false).then(ok => { chat.sync(); return ok; }) : Promise.resolve(false); }
  });
}
let inFlight = 0; // requests being handled or waiting in the queue
function startTurn(msg) {
  inFlight += 1;
  state.phase = 'running'; emit({ type: 'phase', phase: 'running' });
  emit({ type: 'busy', busy: true });
  Promise.resolve(turns.onOwnerMessage(msg)).catch(e => emit({ type: 'chat', msg: chat.post({ from: 'system', text: 'Turn failed: ' + e.message, kind: 'system' }) })).finally(() => { inFlight -= 1; const b = turns.busy(); emit({ type: 'busy', busy: b }); if (!b && state.phase === 'running') { state.phase = 'ready'; emit({ type: 'phase', phase: 'ready' }); } if (!b) maybeAutopilot(); });
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


// ---------- live preview export, screen focus and autopilot ----------
// Agents inspect the real rendering through /p/dist/index.html; re-export (throttled) before each agent turn.
let lastExport = 0;
function ensureExport(force) {
  const now = Date.now();
  if (!force && now - lastExport < 5000) return;
  lastExport = now;
  try { spawnSync(process.execPath, [path.join(ROOT, 'tools', 'export-page.js'), PROJECT, '--no-pwa', '--title', 'Live preview'], { stdio: 'ignore', timeout: 20000 }); } catch (_) { /* the preview is a convenience */ }
}

// Autopilot: the team studies only the screen the owner is looking at, researches and improves it, and moves on when the owner scrolls.
const autopilot = { on: false, scope: null, primary: '', timer: null, cycles: {}, status: 'off' };
const AP_FILE = (process.env.SWARM_TEST === '1' && process.env.SWARM_SETTINGS ? process.env.SWARM_SETTINGS + '.autopilot' : path.join(ROOT, '.run', 'autopilot.json'));
function saveAutopilot() { try { fs.mkdirSync(path.dirname(AP_FILE), { recursive: true }); fs.writeFileSync(AP_FILE, JSON.stringify({ on: autopilot.on, scope: autopilot.scope, primary: autopilot.primary })); } catch (_) { /* best effort */ } }
function loadAutopilot() { try { const d = JSON.parse(fs.readFileSync(AP_FILE, 'utf8')); autopilot.on = !!d.on; autopilot.scope = d.scope || null; autopilot.primary = d.primary || ''; autopilot.status = autopilot.on ? 'watching your screen' : 'off'; } catch (_) { /* first start */ } }
const maxCycles = () => (settings.autopilot && settings.autopilot.maxCyclesPerScreen) || 2;
const sectionName = id => (agentsDef.find(a => a.id === id) || {}).section || '';
function autopilotView() { return { on: autopilot.on, primary: autopilot.primary, sections: autopilot.scope ? autopilot.scope.sections : [], cycle: autopilot.cycles[autopilot.primary] || 0, max: maxCycles(), status: autopilot.status }; }
function emitAutopilot() { emit({ type: 'autopilot', ...autopilotView() }); }

function autopilotText(scope, primary, cycle) {
  const list = scope.sections.map(id => `${id} ${sectionName(id)}`.trim()).join(', ');
  const url = `http://127.0.0.1:${PORT}/p/dist/index.html#${primary}-${sectionName(primary)}`;
  return [
    `AUTOPILOT cycle ${cycle}/${maxCycles()} for the screen the owner is looking at: main section ${primary} ${sectionName(primary)} (on screen: ${list}).`,
    `1) Look at the real rendering first: run \`node ${path.join(ROOT, 'tools', 'export-page.js')} ${PROJECT} --no-pwa\`, then \`node ${path.join(ROOT, 'tools', 'shot.js')} ${url} 393 844 /tmp/swarm-${primary}-m.png\` (and 1440 900 for desktop) and LOOK at the PNG with your image-capable read tool (a browser tool also works). Judge ONLY what is on this screen: hierarchy, image choice and crop, colour and contrast, brand fit, manga style consistency, text fit.`,
    '2) If you are unsure what the brand is, what its colours or meaning are, or what style fits, do NOT guess: the Manager posts one kind:"research" message with the questions (a research agent with live web search answers in research.md with sources before work starts; everyone reads it).',
    '3) Decide the improvements yourselves: swap the background image from the library, change colours, layout or type. Assign concrete changes to the in-scope agents only; discuss briefly where sections touch.',
    '4) If this screen already looks good, say so in one line and assign nothing.'
  ].join(' ');
}

function maybeAutopilot() {
  clearTimeout(autopilot.timer);
  if (!autopilot.on || !autopilot.scope || !autopilot.primary || !turns || !chat) return;
  autopilot.timer = setTimeout(() => { // the screen must stay put for a moment before the team starts
    if (!autopilot.on) return;
    if (inFlight > 0) { autopilot.status = 'waiting for the current request'; return emitAutopilot(); }
    const key = autopilot.primary, done = autopilot.cycles[key] || 0;
    if (done >= maxCycles()) { autopilot.status = 'screen finished: scroll down to continue'; return emitAutopilot(); }
    autopilot.cycles[key] = done + 1; autopilot.status = 'working on this screen'; emitAutopilot();
    ensureExport(true);
    const scope = autopilot.scope;
    const label = scope.sections.map(id => `${id} ${sectionName(id)}`.trim()).join(', ');
    const msg = chat.post({ from: 'claude', text: `[Autopilot ${done + 1}/${maxCycles()}: ${label}] ${autopilotText(scope, key, done + 1)}`.slice(0, 800), scope: { ...scope, mode: 'autopilot' } });
    startTurn(msg);
  }, 3000);
}

function cleanScope(b) {
  const ids = [...new Set((Array.isArray(b.sections) ? b.sections : []).map(String))].filter(id => agentsDef.some(a => a.id === id));
  if (!ids.length) return null;
  const primary = ids.includes(String(b.primary)) ? String(b.primary) : ids[0];
  return { primary, scope: { sections: ids, elements: Array.isArray(b.elements) ? b.elements : [] } };
}


// ---------- team editor: parallel workers with job titles (lib/team.js, TEAM_SPEC.md) ----------
let TEAM = null;
try { TEAM = require('./lib/team'); } catch (_) { /* the team editor API is disabled until lib/team.js exists */ }
function staffPositions() { try { return JSON.parse(fs.readFileSync(path.join(STAFF_DIR, 'staff.json'), 'utf8')).positions || []; } catch (_) { return []; } }
function withTitles(list) { return list.map(a => (a.title ? a : { ...a, title: `${String(a.section || "section").replace(/^./, c => c.toUpperCase())} Designer` })); }
function teamView() { if (!TEAM) return { agents: withTitles(agentsDef), titles: [], maxParallel: settings.concurrency.maxParallel, busy: false }; return { agents: withTitles(agentsDef), titles: TEAM.view(agentsDef, staffPositions()).titles, maxParallel: settings.concurrency.maxParallel, busy: inFlight > 0 || state.phase === 'running' }; }

function createWorkerFiles(a) {
  const base = `${a.id}-${a.section}`;
  fs.mkdirSync(path.join(PROJECT, 'sections'), { recursive: true });
  const html = path.join(PROJECT, 'sections', base + '.html'), css = path.join(PROJECT, 'sections', base + '.css');
  if (!fs.existsSync(html)) fs.writeFileSync(html, `<section class="s-${a.id}" id="${base}"></section>\n`);
  if (!fs.existsSync(css)) fs.writeFileSync(css, '');
  for (const [dir, ext] of [['notes', '.md'], ['inbox', '.md'], ['discussion', '.md']]) { fs.mkdirSync(path.join(PROJECT, dir), { recursive: true }); const f = path.join(PROJECT, dir, a.id + ext); if (!fs.existsSync(f)) fs.writeFileSync(f, ''); }
}
function retireWorkerFiles(a) { // nothing is deleted: the section leaves the page and waits in retired/
  const base = `${a.id}-${a.section}`;
  fs.mkdirSync(path.join(PROJECT, 'retired'), { recursive: true });
  for (const ext of ['.html', '.css']) { const f = path.join(PROJECT, 'sections', base + ext); if (fs.existsSync(f)) fs.renameSync(f, path.join(PROJECT, 'retired', `${Date.now()}-${base}${ext}`)); }
}
function applyTeam(next) {
  const d = TEAM.diff(agentsDef, next);
  d.removed.forEach(retireWorkerFiles);
  d.added.forEach(createWorkerFiles);
  const old = state.agents;
  agentsDef = next;
  fs.writeFileSync(path.join(PROJECT, 'agents.json'), JSON.stringify(agentsDef, null, 1));
  fs.writeFileSync(path.join(PROJECT, 'names.json'), JSON.stringify(agentsDef.map(a => ({ id: a.id, section: a.section })), null, 1));
  state.agents = {};
  for (const a of [MANAGER, ...agentsDef]) {
    const prev = old[a.id] || {};
    state.agents[a.id] = { id: a.id, name: a.name, title: a.title || '', color: a.color, section: a.section, lane: a.lane, status: prev.status || 'queued', thought: prev.thought || '', action: '', target: a.id };
  }
  syncDocs(); // CONTRACT lanes and staff copy
  setupChat(); // new participants for names, mentions and outboxes
  emit({ type: 'state', state });
  return d;
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
  if (p === '/frame') { // same-origin wrapper used by tools/shot.js: an iframe of an exact size, scrolled to a section
    const num = (k, d, lo, hi) => { const v = Number(url.searchParams.get(k)); return Number.isInteger(v) && v >= lo && v <= hi ? v : d; };
    const w = num('w', 393, 200, 3000), h = num('h', 844, 200, 4000);
    const src = url.searchParams.get('src') || '', at = url.searchParams.get('at') || '';
    if (!/^\/p\/[\w./-]+$/.test(src) || (at && !/^[\w-]+$/.test(at))) return send(res, 400, 'bad frame request', 'text/plain');
    return send(res, 200, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0b0d11"><iframe id="f" src="${src}" style="width:${w}px;height:${h}px;border:0;display:block"></iframe><script>var at=${JSON.stringify(at)};document.getElementById('f').onload=function(){setTimeout(function(){try{var d=this.contentDocument,e=at&&d.getElementById(at);if(e)this.contentWindow.scrollTo({top:e.getBoundingClientRect().top+this.contentWindow.scrollY,behavior:'instant'})}catch(_){}}.bind(this),400)}</script>`, 'text/html; charset=utf-8');
  }
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
    // Optional owner scope (what the owner is looking at): shown in the message and enforced by the turn orchestrator.
    let shown = text, scope = null;
    if (b.scope && Array.isArray(b.scope.sections)) {
      const ids = [...new Set(b.scope.sections.map(String))].filter(id => agentsDef.some(a => a.id === id));
      if (ids.length) {
        scope = { sections: ids, elements: Array.isArray(b.scope.elements) ? b.scope.elements : [] };
        const label = ids.map(id => `${id} ${(agentsDef.find(a => a.id === id) || {}).section || ''}`.trim()).join(', ');
        shown = `[Focus: ${label}] ${text}`.slice(0, 800);
      }
    }
    const msg = chat.post({ from, text: shown, scope });
    // Requests are handled one at a time; say so, otherwise a waiting message looks ignored.
    if (ahead > 0) chat.post({ from: 'system', kind: 'system', text: `Queued: ${ahead} request${ahead > 1 ? 's' : ''} ahead. The team will start on #${msg.id} when it finishes the current one (about 5 to 10 minutes). \u5df2\u6392\u961f\uff0c\u56e2\u961f\u5904\u7406\u5b8c\u5f53\u524d\u8bf7\u6c42\u540e\u4f1a\u5f00\u59cb\u5904\u7406\u4f60\u7684\u6d88\u606f\u3002` });
    startTurn(msg);
    return send(res, 200, { id: msg.id });
  }
  if (p === '/api/team' && req.method === 'GET') return send(res, 200, teamView());
  if (p === '/api/team' && req.method === 'PUT') {
    if (!TEAM) return send(res, 501, { error: 'team editor not available' });
    if (inFlight > 0 || state.phase === 'running') return send(res, 409, { error: 'busy' });
    const b = await body(req);
    const r = TEAM.validate(b.agents, { allowlist: S.ALLOWLIST, existing: agentsDef });
    if (!r.ok) return send(res, 400, { errors: r.errors });
    try { const d = applyTeam(r.value); return send(res, 200, { agents: agentsDef, diff: d }); }
    catch (e) { return send(res, 500, { errors: [{ path: '$', message: 'Could not apply the team: ' + e.message }] }); }
  }
  if (p === '/api/squad' && req.method === 'GET') return send(res, 200, { on: squadOn, specialists: squadAgents.map(a => ({ id: a.id, title: a.title, layer: a.squad.layer || '', runner: a.runner })) });
  if (p === '/api/squad' && req.method === 'POST') { const b = await body(req); setSquad(b.on); return send(res, 200, { on: squadOn }); }
  if (p === '/api/autopilot' && req.method === 'GET') return send(res, 200, autopilotView());
  if (p === '/api/autopilot' && req.method === 'POST') {
    const b = await body(req);
    autopilot.on = !!b.on; autopilot.status = autopilot.on ? 'watching your screen' : 'off';
    if (!autopilot.on) clearTimeout(autopilot.timer);
    saveAutopilot(); emitAutopilot(); if (autopilot.on) maybeAutopilot();
    return send(res, 200, autopilotView());
  }
  if (p === '/api/focus' && req.method === 'POST') {
    const c = cleanScope(await body(req));
    if (!c) return send(res, 400, { error: 'no known section on screen' });
    const moved = c.primary !== autopilot.primary;
    autopilot.scope = c.scope; autopilot.primary = c.primary; saveAutopilot();
    if (autopilot.on && moved) { autopilot.status = 'new screen: getting ready'; emitAutopilot(); maybeAutopilot(); }
    else if (autopilot.on) emitAutopilot();
    return send(res, 200, autopilotView());
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
  if (p.startsWith('/assets/generated/')) return serveFile(res, path.join(PROJECT, 'assets', 'generated'), p.slice(18)); // generated images referenced as ../assets/generated/* from sections
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
  for (const a of [MANAGER, ...agentsDef]) state.agents[a.id] = { id: a.id, name: a.name, title: a.title || '', color: a.color, section: a.section, lane: a.lane, status: 'queued', thought: '', action: '', target: a.id };
  watchProject();
  setupChat();
} else {
  initProject('');
  watchProject();
  setupChat();
}
if (squadOn) setSquad(true);
loadAutopilot();
if (autopilot.on) maybeAutopilot(); // resume the owner's autopilot after a restart
process.on('SIGTERM', () => { stopAll(); process.exit(0); });
process.on('SIGINT', () => { stopAll(); process.exit(0); });
