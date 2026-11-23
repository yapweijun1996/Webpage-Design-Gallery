#!/usr/bin/env node
'use strict';
// Swarm server: orchestrates N Codex CLI workers on one page, streams live events to the browser (SSE).
// No dependencies. Controlled by swarm/cli.js (or plain HTTP).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { randomUUID } = require('node:crypto');
const { ProjectInputError, ProjectBusyError, projectPath, projectIdentity, parsePreparation, withProjectLock } = require('./lib/project-init');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'template');
const UI = path.join(ROOT, 'ui');
const PORT = Number(process.env.SWARM_PORT) || 8800;
const LIVE_PREVIEW = `http://127.0.0.1:${PORT}/studio.html?preview=1`;
const PROJECT = projectPath(ROOT, process.env.SWARM_PROJECT || 'home');
const TARGET = { project: path.basename(PROJECT), projectId: projectIdentity(PROJECT) };
// Agents run ONLY through the codex or pi CLI, with the allowlisted model and effort from the settings file (lib/settings.js).
const S = require('./lib/settings');
const R = require('./lib/runners');
const SKILLS = require('./lib/skills');
const { createUsage, normalizeUsage, addUsage } = require('./lib/usage');
const ownership = require('./lib/ownership');
const integrator = require('./lib/integrator');
const { approvedAnchor, canRestore, createPublication } = require('./lib/publication');
const publication = createPublication(PROJECT);
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
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const GJH_ASSETS = path.resolve(ROOT, '..', 'assets', 'companies', 'gjh'); // read-only image library for /gjh/*
const DS_DIR = path.join(ROOT, 'design-system');
const STAFF_DIR = path.join(ROOT, 'staff');
const STAFF = require('./lib/staff');
const staffRoster = STAFF.load();
const GJH_V11_ASSETS = path.resolve(ROOT, '..', 'demos', 'corporate', 'gjh', 'v11', 'assets'); // read-only mall concept images for /gjh-v11/*
let agentsDef = JSON.parse(fs.readFileSync(path.join(TEMPLATE, 'agents.json'), 'utf8'));
const state = { ...TARGET, phase: 'idle', round: 0, rounds: PLAN.length, plan: PLAN, model: modelLabel(), brief: '', agents: {}, feed: [] };
state.usage = { ...createUsage(), agents: Object.create(null) };
const clients = new Set();
const children = new Map();
const imageTurns = new Map();
let imageWrites = 0;
let stopped = false;

function emit(evt) {
  evt.ts = Date.now();
  if (!['edit', 'state', 'usage'].includes(evt.type)) { state.feed.push(evt); if (state.feed.length > 300) state.feed.shift(); }
  const line = 'data: ' + JSON.stringify(evt) + '\n\n';
  for (const c of clients) c.write(line);
}

function previewSections() {
  const dir = path.join(PROJECT, 'sections');
  const files = fs.lstatSync(dir, { throwIfNoEntry: false })?.isDirectory()
    ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  return files.filter(file => file.isFile()).map(file => /^(\d{2})-([a-z0-9-]+)\.html$/.exec(file.name))
    .filter(Boolean).sort((a, b) => a[0].localeCompare(b[0])).map(([, id, section]) => ({ id, section }));
}

function refreshPreviewSections() {
  const catalog = previewSections();
  if (JSON.stringify(catalog) === JSON.stringify(state.previewSections)) return false;
  state.previewSections = catalog;
  return true;
}

function workersForSections(roster) {
  const available = previewSections();
  return roster.map(agent => {
    const found = available.filter(({ id }) => id === agent.id);
    return found.length === 1 && found[0].section !== agent.section
      ? { ...agent, section: found[0].section } : agent;
  });
}

function recipeContract() {
  try {
    const contract = JSON.parse(fs.readFileSync(path.join(PROJECT, 'contract.json'), 'utf8'));
    if (typeof contract?.recipe === 'string' && Object.hasOwn(loadAll().recipes, contract.recipe)) return contract;
  } catch { /* Existing projects can work without a Fast Path contract. */ }
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
function syncDocs(project = PROJECT, roster = agentsDef) {
  copyTree(STAFF_DIR, path.join(project, 'staff'), /\.(md|json)$/);
  copyTree(DS_DIR, path.join(project, 'design-system'), /\.(md|json|css|js|html|tpl|webmanifest|png)$/);
  const lanes = roster.map(a => `${a.id} ${a.lane}`).join('\n');
  fs.writeFileSync(path.join(project, 'CONTRACT.md'), fs.readFileSync(path.join(TEMPLATE, 'CONTRACT.md'), 'utf8').replace('{{LANES}}', lanes));
}

function writeProject(project, brief, roster) {
  for (const d of ['sections', 'notes', 'inbox', 'discussion']) fs.mkdirSync(path.join(project, d), { recursive: true });
  fs.writeFileSync(path.join(project, 'inbox', '00.md'), '');
  for (const f of ['direction.md', 'decisions.md', 'review1.md', 'review2.md']) fs.writeFileSync(path.join(project, f), '');
  fs.writeFileSync(path.join(project, 'brief.md'), brief);
  fs.copyFileSync(path.resolve(ROOT, '..', 'design-canvas', 'tokens.css'), path.join(project, 'tokens.css'));
  syncDocs(project, roster);
  fs.writeFileSync(path.join(project, 'agents.json'), JSON.stringify(roster, null, 1)); // the project remembers its own team
  fs.writeFileSync(path.join(project, 'names.json'), JSON.stringify(roster.map(a => ({ id: a.id, section: a.section })), null, 1));
  for (const a of roster) {
    fs.writeFileSync(path.join(project, 'sections', `${a.id}-${a.section}.html`), `<section class="s-${a.id}" id="${a.id}-${a.section}"></section>\n`);
    fs.writeFileSync(path.join(project, 'sections', `${a.id}-${a.section}.css`), '');
    fs.writeFileSync(path.join(project, 'notes', `${a.id}.md`), '');
    fs.writeFileSync(path.join(project, 'inbox', `${a.id}.md`), '');
    fs.writeFileSync(path.join(project, 'discussion', `${a.id}.md`), '');
  }
}

function queuedAgents(roster) {
  return Object.fromEntries([MANAGER, ...roster].map(a => [a.id, { id: a.id, name: a.name, title: a.title || '', color: a.color, section: a.section, lane: a.lane, status: 'queued', thought: '', action: '', target: a.id }]));
}

// ---------- file watcher: edits become cursor/wipe events ----------
let watcher = null;
const debounce = new Map();
function createProjectWatcher() {
  return fs.watch(PROJECT, { recursive: true }, (_ev, file) => {
    if (!file) return;
    const m = /^(sections|notes)[\\/](\d\d)(?:-[a-z0-9-]+)?(?:\.(layout|type|color|imagery|icons|motion|polish))?\.(html|css|md)$/.exec(file);
    const d = /^(?:(direction|decisions|review|review1|review2|research)\.md|discussion[\\/](\d\d)\.md)$/.exec(file);
    const asset = /^assets[\\/]generated[\\/][\w.-]+$/.test(file) && !/[\\/]\./.test(file);
    if (!m && !d && !asset) return;
    const key = file;
    clearTimeout(debounce.get(key));
    debounce.set(key, setTimeout(() => {
      debounce.delete(key);
      if (asset) return emit({ type: 'asset', file: file.replace(/\\/g, '/') });
      if (m?.[1] === 'sections' && refreshPreviewSections()) emit({ type: 'state', state });
      else emit(m ? { type: 'edit', id: (m[3] && squadAgents.find(x => x.squad.layer === m[3])?.id) || m[2], kind: m[1], file }
        : { type: 'doc', id: d[2] || '00', file: file.replace(/\\/g, '/') });
    }, 120));
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
function withPreamble(promptText, a, label, { appearance, position, guidance }) {
  let pre = S.preamble(settings);
  try { const sp = STAFF.preamble({ staffDir: path.join(PROJECT, 'staff'), agentId: a.id, position, step: label }); if (sp) pre = (pre ? pre + '\n' : '') + sp; } catch (_) { /* no staff files in this project: skip */ }
  const rendering = `Inspect the same live rendering as Studio at \`${previewUrl(appearance)}\`.`;
  pre = pre ? `${pre}\n${rendering}` : rendering;
  if (guidance) pre += `\n\nLocal skill guidance for this role. Permissions are defined by the project and runner.\n${guidance}`;
  if (promptText.startsWith('STEP:')) { const i = promptText.indexOf('\n'); return i < 0 ? promptText + '\n' + pre : promptText.slice(0, i + 1) + pre + '\n' + promptText.slice(i + 1); }
  return pre + '\n' + promptText;
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

const MANAGER_CHANNEL_PHASES = new Set(['Triage', 'Decide', 'Review', 'Summary']);
const IMPLEMENTATION_PHASES = new Set(['Work', 'Improve', 'Build', 'Improve together', 'Apply feedback']);

// A successful process exit is necessary before a workspace can enter publication checks.
function runOnce(a, label, promptText, appearance, launchChannel, execution) {
  return new Promise(resolve => {
    const role = label === 'Research' ? 'research' : (a.id === MANAGER.id ? 'manager' : 'worker');
    const base = S.resolve(settings, role);
    const own = role === 'worker' ? { runner: a.runner, model: a.model, effort: a.effort } : {};
    const resolved = { ...base, ...Object.fromEntries(Object.entries(own).filter(([, v]) => v)) }; // per-worker override, still checked against the allowlist by the runner
    const position = staffRoster.byId[a.position]?.id ?? staffRoster.byAgent(a.id)?.id;
    const skills = SKILLS.resolve({ projectDir: PROJECT, workerId: a.id, position, runner: resolved.runner });
    const manager = a.id === MANAGER.id;
    const managerChannel = manager && MANAGER_CHANNEL_PHASES.has(label);
    const imageToken = a.squad?.id === 'image-gen' ? randomUUID() : null;
    const warn = text => launchChannel?.post({ from: 'system', kind: 'system', text });
    const cancelled = () => stopped || chat !== launchChannel || execution?.isCurrent?.() === false;
    let runner, workspace, anchor, p;
    try {
      if (cancelled()) return resolve(false);
      try { anchor = approvedAnchor(PROJECT); }
      catch (error) { if (IMPLEMENTATION_PHASES.has(label)) throw error; }
      runner = R.get(resolved.runner);
      ensureExport();
      const manifest = a.launchManifest ?? ownership.build({ agents: [MANAGER, ...workersForSections(agentsDef)], launchContext: true });
      workspace = integrator.open(PROJECT, a.id, manifest, { skillDirs: skills.dirs });
      const cmd = runner.buildCommand({ model: resolved.model, effort: resolved.effort, projectDir: workspace.dir,
        skillDirs: workspace.skillDirs, research: label === 'Research' || !!settings.research?.web });
      const env = { ...R.childEnvironment(process.env), SWARM_PORT: String(PORT) };
      if (imageToken) {
        imageTurns.set(imageToken, { root: workspace.dir, base: a.base, pending: 0 });
        env.SWARM_IMAGE_TURN = imageToken;
      }
      p = spawn(cmd.command, cmd.args, { cwd: cmd.cwd || workspace.dir, env, stdio: ['pipe', 'pipe', 'ignore'] });
    } catch (error) {
      if (imageToken) imageTurns.delete(imageToken);
      if (workspace) integrator.close(workspace);
      warn(`Cannot start ${a.name}: ${error.message}`);
      return resolve(false);
    }
    const parser = runner.createParser({ managerChannel });
    children.set(a.id, p);
    let fatal = false, settled = false;
    let managerPosts;
    let reportedUsage = false;
    const recordUsage = usage => {
      const agentUsage = state.usage.agents[a.id] ??= { name: a.title || a.name, runners: [], ...createUsage() };
      if (!agentUsage.runners.includes(resolved.runner)) agentUsage.runners.push(resolved.runner);
      addUsage(state.usage, usage);
      addUsage(agentUsage, usage);
      emit({ type: 'usage', usage: state.usage });
    };
    const timer = setTimeout(() => { fatal = true; try { p.kill('SIGTERM'); } catch (_) {} }, settings.timeouts.turnMinutes * 60000);
    const handle = evs => {
      for (const ev of evs) {
        if (ev.kind === 'error') fatal = true;
        else if (ev.kind === 'manager-channel') managerPosts = ev.messages;
        else if (ev.kind === 'usage' || ev.kind === 'done') {
          const usage = normalizeUsage(resolved.runner, ev.usage, resolved.model);
          if (usage) {
            reportedUsage = true;
            recordUsage(usage);
          }
        } else {
          if (managerChannel && ev.kind === 'thought') managerPosts = undefined;
          applyEvent(a, ev);
        }
      }
    };
    const finish = async ok => {
      if (settled) return; settled = true;
      if (!reportedUsage) recordUsage(null);
      clearTimeout(timer); children.delete(a.id);
      const unfinishedImage = imageTurns.get(imageToken)?.pending > 0;
      if (imageToken) imageTurns.delete(imageToken);
      try {
        if (!ok || fatal || cancelled() || unfinishedImage || (managerChannel && !managerPosts)) return resolve(false);
        const managerOptions = { allowAssignments: label !== 'Summary' };
        const result = await publication.publish(workspace, { anchor, workerId: a.id,
          owner: manager ? null : a.base || `${a.id}-${a.section}`,
          cancelled,
          checkOutbox(outbox) {
            if (managerChannel) launchChannel.validateManagerPosts(managerPosts, managerOptions);
            else if (!manager) launchChannel.validateWorkerOutbox(a.id, outbox);
          },
        });
        if (!result.ok) {
          const reason = result.rejected[0];
          if (reason?.code !== 'cancelled') warn(`${a.name} changes rejected: ${reason?.message || 'Publication checks failed.'}`);
          return resolve(false);
        }
        const visual = result.merged.some(file => file.startsWith('sections/') || file.startsWith('assets/'));
        execution?.published(visual);
        if (managerChannel) launchChannel.publishManager(managerPosts, managerOptions);
        else if (!manager) launchChannel.publishWorker(a.id, result.outbox);
        if (visual) ensureExport(true);
        return resolve(true);
      } catch (error) {
        warn(`Could not publish ${a.name}'s turn: ${error.message}`);
        return resolve(false);
      } finally {
        try { integrator.close(workspace); } catch { console.warn('Could not close a worker workspace.'); }
      }
    };
    p.on('error', () => finish(false));
    p.stdin.on('error', () => {});
    const anchorContext = anchor ? `\nFollow locked anchor ${anchor.id}. Read anchors/${anchor.id}/contract.json and ${anchor.files.map(file => `anchors/${anchor.id}/${file}`).join(', ')} before editing.\n` : '';
    const guidance = anchorContext + (resolved.runner === 'codex' ? skills.text : '');
    p.stdin.end(withPreamble(promptText, a, label, { appearance, position, guidance }));
    p.stdout.on('data', d => { try { handle(parser.push(d)); } catch (_) { /* parser errors must not kill the run */ } });
    p.on('close', code => { try { handle(parser.end()); } catch (_) {} finish(code === 0); });
  });
}

async function runProcess(a, label, promptText, isLast, appearance, launchChannel = chat, execution) {
  const ag = state.agents[a.id];
  if (!ag) return false;
  if (label === 'Research' && !(settings.research && settings.research.web)) {
    if (chat) chat.post({ from: 'system', kind: 'system', text: 'Research skipped: web research is switched off in Settings.' });
    return true;
  }
  const attempts = execution ? 1 : 2;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (stopped) return false;
    ag.status = 'working ' + label; ag.action = 'starting'; ag.target = a.id;
    emit({ type: 'status', id: a.id, status: ag.status });
    await slot.acquire();
    let ok = false;
    try { if (!stopped) ok = await runOnce(a, label, promptText, appearance, launchChannel, execution); } finally { slot.release(); }
    if (stopped) {
      if (execution) { ag.status = 'waiting'; ag.action = ''; emit({ type: 'status', id: a.id, status: ag.status }); }
      return false;
    }
    if (ok) {
      ag.status = isLast ? 'done' : 'waiting'; ag.action = '';
      emit({ type: 'status', id: a.id, status: ag.status });
      return true;
    }
    if (attempt < attempts) emit({ type: 'status', id: a.id, status: 'retrying' });
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
const { createSecrets } = require('./lib/secrets');
const IMG = require('./lib/imagegen');
const SECRETS_PATH = (process.env.SWARM_TEST === '1' && process.env.SWARM_SETTINGS ? process.env.SWARM_SETTINGS + '.secrets' : path.join(ROOT, '.run', 'secrets.json'));
const secrets = createSecrets(SECRETS_PATH);
function imageSettings() { const i = (settings && settings.images) || {}; return { provider: i.provider || 'codex', model: i.model || 'gpt-image-2', quality: i.quality || 'high', size: i.size || '1536x1024' }; }
const SQ_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#fb923c', '#94a3b8', '#f87171', '#22d3ee', '#c084fc'];
const squadAgents = SQ_AGENTS_BUILD();
function SQ_AGENTS_BUILD() { return SQ.roster().map((spec, i) => ({ id: String(81 + i), name: spec.title, title: spec.title, color: SQ_COLORS[i % SQ_COLORS.length], section: 'sq-' + spec.id, lane: spec.mission, runner: spec.runner, squad: spec })); }
const SQ_FILE = (process.env.SWARM_TEST === '1' && process.env.SWARM_SETTINGS ? process.env.SWARM_SETTINGS + '.squad' : path.join(ROOT, '.run', 'squad.json'));
let squadOn = false;
try { squadOn = !!JSON.parse(fs.readFileSync(SQ_FILE, 'utf8')).on; } catch (_) { /* default off */ }
function setSquad(on) {
  squadOn = !!on && availableSpecialists(agentsDef).length === squadAgents.length;
  try { fs.mkdirSync(path.dirname(SQ_FILE), { recursive: true }); fs.writeFileSync(SQ_FILE, JSON.stringify({ on: squadOn })); } catch (_) { /* best effort */ }
  for (const a of availableSpecialists(agentsDef)) {
    if (squadOn) state.agents[a.id] = state.agents[a.id] || { id: a.id, name: a.name, title: a.title, color: a.color, section: '', lane: a.lane, status: 'queued', thought: '', action: '', target: a.id };
    else delete state.agents[a.id];
  }
  emit({ type: 'state', state });
}
// Plan one squad turn for the screen the owner looks at (first in-scope section).
function squadPlan(owner) {
  const ids = owner.scope && Array.isArray(owner.scope.sections) ? owner.scope.sections : [];
  const roster = workersForSections(agentsDef);
  const def = roster.find(a => a.id === ids[0]);
  if (!def) return null;
  const base = def.id + '-' + def.section;
  // Full squad: every specialist works on the screen at once (owner request: see 10 agents working together).
  const all = SQ.roster();
  // Codex specialists (image generation, web research) take 60-100 s and set the pace of the whole wave: include them only when the request asks for them.
  const wanted = new Set(SQ.pickSquad(owner.scope, owner.text).map(sp => sp.id));
  const picked = all.filter(sp => sp.runner !== 'codex' || wanted.has(sp.id));
  const available = availableSpecialists(roster);
  const members = picked.map(spec => available.find(a => a.squad.id === spec.id)).filter(Boolean);
  for (const m of members) m.base = base;
  const launchManifest = ownership.build({ agents: [MANAGER, ...roster], squad: { base, members }, launchContext: true });
  for (const m of members) m.launchManifest = launchManifest;
  const byId = new Map(members.map(m => [m.squad.id, m]));
  const lane = ids => ids.map(id => byId.get(id)).filter(Boolean);
  const first = picked.filter(sp => sp.id !== 'layout' && sp.id !== 'qa').map(sp => byId.get(sp.id));
  const fast = owner.scope && owner.scope.mode === 'autopilot'; // autopilot: the next cycle starts by inspecting the result, so skip the QA wave
  // Autopilot is built for speed: everyone including layout starts at once (one wave); the next cycle inspects and fixes clashes.
  const waves = (fast ? [[...first, ...lane(['layout'])]] : [first, lane(['layout']), lane(['qa'])]).filter(w => w.length);
  const prompts = {};
  // Inline the context so a specialist needs no file reads before writing (the dominant latency of a CLI agent turn).
  const rd = (f, n) => { try { return fs.readFileSync(path.join(PROJECT, 'sections', f), 'utf8').slice(0, n); } catch (_) { return ''; } };
  const html = rd(base + '.html', 3500);
  const viaApi = imageSettings().provider === 'openai' && secrets.openAIKeyStatus().set;
  for (const m of members) {
    const own = m.squad.layer ? rd(base + '.' + m.squad.layer + '.css', 1500) : '';
    prompts[m.id] = SQ.promptFor(m.squad, { base, scopeLine: '' }) + '\nCURRENT sections/' + base + '.html (trimmed):\n' + html + (own ? '\nCURRENT ' + base + '.' + m.squad.layer + '.css:\n' + own : '') + (viaApi && m.squad.id === 'image-gen' ? '\nIMAGE PROVIDER: use the OpenAI API, not the Codex image skill. Run: node ' + path.join(ROOT, 'tools', 'gen-image.js') + ' --name ' + base + '-<short-slug> --prompt "<detailed prompt>" (it prints JSON with the saved path, already compressed). Never ask for or print any API key.' : '') + '\nEverything you need is above. Do not read other files first; write your output immediately.';
  }
  return { single: waves.length === 1, base, members, waves, prompts, layoutId: (byId.get('layout') || {}).id };
}
const availableSpecialists = roster => squadAgents.filter(spec => !roster.some(worker => worker.id === spec.id));
function everyone(roster) {
  const workers = workersForSections(roster);
  const currentSections = recipeContract() && new Set(previewSections().map(({ id }) => id));
  return [MANAGER, ...workers.filter(({ id }) => !currentSections || currentSections.has(id)), ...availableSpecialists(roster)];
}
function createChannel(people) {
  const channel = createChat({ projectDir: PROJECT, agents: people.map(a => ({ id: a.id, name: a.name, section: a.section, color: a.color })), workspaceOutboxes: true, emit });
  const queue = createTurns({
    chat: channel, agents: people, managerId: MANAGER.id, maxDiscussRounds: 2, squad: { on: () => squadOn, plan: squadPlan },
    runAgent: ({ id, label, prompt: pr, previewAppearance }) => {
      const a = people.find(x => x.id === id);
      if (!a) return Promise.resolve(false);
      return runProcess(a, label, pr, false, previewAppearance, channel);
    }
  });
  return { chat: channel, turns: queue };
}
function setupChat() {
  if (chat) chat.stop();
  ({ chat, turns } = createChannel(everyone(agentsDef)));
  chat.start();
}
let inFlight = 0; // requests being handled or waiting in the queue
function startTurn(msg, appearance, { fastPreview = false } = {}) {
  if (!projectBusy()) stopped = false;
  inFlight += 1;
  state.phase = 'running'; emit({ type: 'phase', phase: 'running' });
  emit({ type: 'busy', busy: true });
  Promise.resolve(turns.onOwnerMessage({ ...msg, fastPreview, previewAppearance: cleanAppearance(appearance) })).catch(e => emit({ type: 'chat', msg: chat.post({ from: 'system', text: 'Turn failed: ' + e.message, kind: 'system' }) })).finally(() => { inFlight -= 1; const b = turns.busy(); emit({ type: 'busy', busy: b }); if (!b && state.phase === 'running') { state.phase = 'ready'; emit({ type: 'phase', phase: 'ready' }); } if (!b) maybeAutopilot(); });
}

function openProject(roster) {
  const nextWatcher = createProjectWatcher();
  let channel;
  try {
    channel = createChannel(everyone(roster));
    channel.chat.start();
    return { watcher: nextWatcher, ...channel };
  } catch (error) {
    channel?.chat.stop();
    nextWatcher.close();
    throw error;
  }
}

function prepare({ brief, roster }, replace) {
  const text = brief || fs.readFileSync(path.join(TEMPLATE, 'brief.md'), 'utf8');
  const nextAgents = queuedAgents(roster);
  const runtime = replace(project => writeProject(project, text, roster), () => openProject(roster));

  // Keep the old channel and watcher available until the replacement has opened successfully.
  watcher?.close();
  chat?.stop();
  for (const timer of debounce.values()) clearTimeout(timer);
  debounce.clear();
  ({ watcher, chat, turns } = runtime);
  agentsDef = roster;
  state.brief = text;
  state.agents = nextAgents;
  refreshPreviewSections();
  if (squadOn) setSquad(true);
  state.feed = [];
  stopped = false;
}

const normalBusy = () => inFlight > 0 || running > 0 || imageWrites > 0 || state.phase === 'running';
const projectBusy = () => normalBusy() || fastPath.busy() || anchorRoutes.busy();
async function runAll() {
  state.phase = 'running';
  emit({ type: 'state', state });
  for (let i = 0; i < PLAN.length; i++) {
    if (stopped) break;
    const step = PLAN[i];
    state.round = i + 1;
    emit({ type: 'round', round: i + 1, label: step.label, meeting: !!step.meeting });
    await Promise.all((step.who === 'manager' ? [MANAGER] : workersForSections(agentsDef)).map(a => runWorker(a, step)));
  }
  // the manager finishes with the team: mark it done
  if (!stopped && state.agents[MANAGER.id]) { state.agents[MANAGER.id].status = 'done'; emit({ type: 'status', id: MANAGER.id, status: 'done' }); }
  state.phase = stopped ? 'stopped' : 'done';
  emit({ type: 'phase', phase: state.phase });
  if (!stopped) maybeAutopilot();
}

function stopAll() {
  stopped = true;
  fastPath.cancel();
  anchorRoutes.cancel();
  imageTurns.clear();
  for (const p of children.values()) p.kill('SIGTERM');
}


// ---------- live preview export, screen focus and autopilot ----------
function cleanAppearance(input) {
  // The SDS runtime owns the supported values. Limit the transport to short preference identifiers.
  return Object.fromEntries(['theme', 'brand', 'lang'].flatMap(key => {
    const value = input?.[key];
    return typeof value === 'string' && /^[a-z0-9-]{1,32}$/i.test(value) ? [[key, value]] : [];
  }));
}

function previewUrl(appearance, section) {
  const url = new URL(LIVE_PREVIEW);
  for (const [key, value] of Object.entries(appearance || {})) url.searchParams.set(key, value);
  if (section) url.hash = section;
  return url.href;
}

// Keep a throttled legacy export for /p/dist/index.html and export-specific checks.
let lastExport = 0;
function ensureExport(force) {
  const now = Date.now();
  if (!force && now - lastExport < 5000) return;
  lastExport = now;
  const args = [path.join(ROOT, 'tools', 'export-page.js'), PROJECT, '--no-pwa', '--title', 'Live preview'];
  if (recipeContract()) args.push('--sds');
  try { spawnSync(process.execPath, args, { stdio: 'ignore', timeout: 20000 }); } catch (_) { /* the preview is a convenience */ }
}

// Autopilot: the team studies only the screen the owner is looking at, researches and improves it, and moves on when the owner scrolls.
const autopilot = { on: false, scope: null, primary: '', timer: null, cycles: {}, status: 'off' };
const AP_FILE = (process.env.SWARM_TEST === '1' && process.env.SWARM_SETTINGS ? process.env.SWARM_SETTINGS + '.autopilot' : path.join(ROOT, '.run', 'autopilot.json'));
function saveAutopilot() { try { fs.mkdirSync(path.dirname(AP_FILE), { recursive: true }); fs.writeFileSync(AP_FILE, JSON.stringify({ on: autopilot.on, scope: autopilot.scope, primary: autopilot.primary })); } catch (_) { /* best effort */ } }
function loadAutopilot() { try { const d = JSON.parse(fs.readFileSync(AP_FILE, 'utf8')); autopilot.on = !!d.on; autopilot.scope = d.scope || null; autopilot.primary = d.primary || ''; autopilot.status = autopilot.on ? 'watching your screen' : 'off'; } catch (_) { /* first start */ } }
const maxCycles = () => (settings.autopilot && settings.autopilot.maxCyclesPerScreen) || 2;
const sectionName = id => state.previewSections?.find(item => item.id === id)?.section || agentsDef.find(a => a.id === id)?.section || '';
function autopilotView() { return { on: autopilot.on, primary: autopilot.primary, sections: autopilot.scope ? autopilot.scope.sections : [], cycle: autopilot.cycles[autopilot.primary] || 0, max: maxCycles(), status: autopilot.status }; }
function emitAutopilot() { emit({ type: 'autopilot', ...autopilotView() }); }

function autopilotText(scope, primary, cycle) {
  const list = scope.sections.map(id => `${id} ${sectionName(id)}`.trim()).join(', ');
  const url = previewUrl(cleanAppearance(scope.appearance), `${primary}-${sectionName(primary)}`);
  return [
    `AUTOPILOT cycle ${cycle}/${maxCycles()} for the screen the owner is looking at: main section ${primary} ${sectionName(primary)} (on screen: ${list}).`,
    `1) Look at the live Studio rendering first: run \`node ${path.join(ROOT, 'tools', 'shot.js')} '${url}' 393 844 /tmp/swarm-${primary}-m.png\` (and 1440 900 for desktop) and LOOK at the PNG with your image-capable read tool (a browser tool also works). Judge ONLY what is on this screen: hierarchy, image choice and crop, colour and contrast, brand fit, manga style consistency, text fit.`,
    '2) If you are unsure what the brand is, what its colours or meaning are, or what style fits, do NOT guess: the Manager posts one kind:"research" message with the questions (a research agent with live web search answers in research.md with sources before work starts; everyone reads it).',
    '3) Decide the improvements yourselves: swap the background image from the library, change colours, layout or type. Assign concrete changes to the in-scope agents only; discuss briefly where sections touch.',
    '4) If this screen already looks good, say so in one line and assign nothing.'
  ].join(' ');
}

function maybeAutopilot() {
  clearTimeout(autopilot.timer);
  if (stopped || !autopilot.on || !autopilot.scope || !autopilot.primary || !turns || !chat) return;
  autopilot.timer = setTimeout(() => { // the screen must stay put for a moment before the team starts
    if (stopped || !autopilot.on) return;
    if (projectBusy()) { autopilot.status = 'waiting for the current request'; return emitAutopilot(); }
    const key = autopilot.primary, done = autopilot.cycles[key] || 0;
    if (done >= maxCycles()) { autopilot.status = 'screen finished: scroll down to continue'; return emitAutopilot(); }
    autopilot.cycles[key] = done + 1; autopilot.status = 'working on this screen'; emitAutopilot();
    ensureExport(true);
    const scope = autopilot.scope;
    const label = scope.sections.map(id => `${id} ${sectionName(id)}`.trim()).join(', ');
    const msg = chat.post({ from: 'claude', text: `[Autopilot ${done + 1}/${maxCycles()}: ${label}] ${autopilotText(scope, key, done + 1)}`.slice(0, 800), scope: { ...scope, mode: 'autopilot' } });
    startTurn(msg, scope.appearance);
  }, 3000);
}

function cleanScope(b) {
  const ids = [...new Set((Array.isArray(b.sections) ? b.sections : []).map(String))].filter(id => agentsDef.some(a => a.id === id));
  if (!ids.length) return null;
  const primary = ids.includes(String(b.primary)) ? String(b.primary) : ids[0];
  return { primary, scope: { sections: ids, elements: Array.isArray(b.elements) ? b.elements : [], appearance: cleanAppearance(b.appearance) } };
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
  workersForSections(d.removed).forEach(retireWorkerFiles);
  workersForSections(d.added).forEach(createWorkerFiles);
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
  refreshPreviewSections();
  if (squadOn) setSquad(true);
  emit({ type: 'state', state });
  return d;
}

// ---------- http ----------
const { createSkillRoutes, matches: isSkillRoute } = require('./lib/skills-routes');
const skillRoutes = createSkillRoutes({
  projectDir: PROJECT, projectId: TARGET.projectId, busy: projectBusy,
  workers: () => withTitles([...agentsDef, ...availableSpecialists(agentsDef)]).map(({ id, name, title }) => ({ id, name, title })),
});
const { createImageRoute } = require('./lib/image-routes');
const imageRoute = createImageRoute({
  projectDir: PROJECT, turns: imageTurns, busy: projectBusy, settings: imageSettings,
  generate: IMG.generate, key: () => secrets.getOpenAIKey(),
  convert: (png, webp) => spawnSync('cwebp', ['-quiet', '-q', '82', png, '-o', webp], { timeout: 30000 }).status === 0,
  startWrite() {
    imageWrites += 1;
    return () => { imageWrites -= 1; };
  },
});
const { createVersionRoutes, matches: isVersionRoute } = require('./lib/version-routes');
const versionRoutes = createVersionRoutes({
  projectDir: PROJECT, projectId: TARGET.projectId, busy: projectBusy,
  canRestore: ({ source }) => canRestore(PROJECT, source),
  changed({ type }) {
    if (type === 'rollback') {
      refreshPreviewSections();
      setupChat();
      if (state.previewSections.length) ensureExport(true);
      else fs.rmSync(path.join(PROJECT, 'dist', 'index.html'), { force: true });
      emit({ type: 'state', state });
    }
    emit({ type: 'versions' });
  },
});
const { createFastPath, FastPathError } = require('./lib/fast-routes');
const { stageFast } = require('./lib/fast-stage');
const { install } = require('./lib/versions');
const { loadAll } = require('./lib/recipes');
const fastPath = createFastPath({
  projectDir: PROJECT, projectId: TARGET.projectId, busy: () => normalBusy() || anchorRoutes.busy(), stageFast, install,
  fallback: submitMessage,
  published({ text, from, appearance, candidate }) {
    refreshPreviewSections();
    setupChat();
    emit({ type: 'state', state });
    emit({ type: 'versions' });
    const sectionIds = candidate.contract.sections.map(({ id }) => id.slice(0, 2));
    const sections = sectionIds.filter(id => agentsDef.some(agent => agent.id === id));
    const scope = sections.length ? { sections, elements: [] } : null;
    const msg = chat.post({ from, text, scope });
    if (scope) startTurn(msg, appearance, { fastPreview: true });
    return { id: msg.id, qualityQueued: Boolean(scope) };
  },
});
const { createAnchorRoutes, matches: isAnchorRoute } = require('./lib/anchor-routes');
const { captureAnchorQA } = require('./lib/anchor-preview-qa');

function repairOwners() {
  const roster = [MANAGER, ...workersForSections(agentsDef)];
  const manifest = ownership.build({ agents: roster, launchContext: true });
  return Object.fromEntries(previewSections().flatMap(({ id, section }) => {
    const base = `${id}-${section}`;
    return state.agents[id] && id !== MANAGER.id && manifest.owned[`sections/${base}.html`] === id ? [[base, id]] : [];
  }));
}

async function runAnchorRepair({ sectionId, ownerId, evidence, anchor, appearance, isValid }) {
  if (!chat || !isValid() || repairOwners()[sectionId] !== ownerId) return 'failed';
  const roster = workersForSections(agentsDef);
  const worker = roster.find(a => a.id === ownerId && `${a.id}-${a.section}` === sectionId);
  if (!worker) return 'failed';
  const launchManifest = ownership.build({ agents: [MANAGER, ...roster], launchContext: true });
  const views = evidence.map(view => {
    const cells = view.cells.map(cell => `row ${cell.row}, column ${cell.column}`).join(' / ');
    return `- ${view.name} (${view.width}×${view.height}), ${view.columns}×${view.rows} grid. Strongest structure differences at ${cells}.`;
  });
  const prompt = [
    `STEP: Work | AGENT: ${ownerId}`,
    `Visual QA requested a repair of ${sectionId} against locked anchor ${anchor.id}.`,
    'Compare the following areas with the locked reference images. Rows and columns start at 1 from the upper left.',
    ...views,
    `Review sections/${sectionId}.html and its stylesheet files. Apply only a verified structural correction inside this section.`,
    'Preserve other sections, shared styling, accessibility and the locked design contract.',
    `Summarize the result with one kind:"done" JSON line in chat/${ownerId}.jsonl.`,
  ].join('\n');
  const channel = chat;
  channel.post({ from: 'system', kind: 'system', text: `Visual QA assigned a scoped repair of ${sectionId} to worker ${ownerId}.` });
  stopped = false;
  let changed = false;
  const ok = await runProcess({ ...worker, launchManifest }, 'Work', prompt, false, appearance, channel,
    { isCurrent: isValid, published: visual => { changed = visual; } });
  if (changed) return 'published';
  return ok ? 'no-change' : 'failed';
}

const anchorRoutes = createAnchorRoutes({
  projectDir: PROJECT,
  projectId: TARGET.projectId,
  busy: () => normalBusy() || fastPath.busy(),
  changed() {
    emit({ type: 'anchor' });
    emit({ type: 'busy', busy: projectBusy() });
  },
  generateAnchor: input => require('./lib/anchor-generation').generateAnchor({ ...input, runnerSettings: settings }),
  reviewAnchor: input => require('./lib/anchor-advisor').reviewAnchor({ ...input, runnerSettings: settings }),
  captureAnchorQA,
  cleanAppearance: input => ({ theme: 'light', brand: 'none', lang: 'en', ...cleanAppearance(input) }),
  previewUrl: (_width, _height, appearance) => previewUrl(appearance),
  repairOwners,
  runRepair: runAnchorRepair,
});
const preview = require('./lib/preview').createPreview({
  ui: UI, project: PROJECT, designSystem: DS_DIR, library: GJH_ASSETS, mall: GJH_V11_ASSETS
});
function send(res, code, body, type) { res.writeHead(code, { 'content-type': type || 'application/json', 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
function serveFile(res, base, rel) {
  const full = path.normalize(path.join(base, rel));
  if (!full.startsWith(base + path.sep) && full !== base) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(full, (err, buf) => err ? send(res, 404, 'not found', 'text/plain') : send(res, 200, buf, MIME[path.extname(full)] || 'application/octet-stream'));
}
function body(req) { return new Promise(r => { let s = ''; req.on('data', d => s += d); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch (_) { r({}); } }); }); }

function submitMessage(input) {
  const text = String(input.text || '').trim();
  const from = input.from === 'owner' ? 'owner' : 'claude';
  if (!text) throw new FastPathError(400, 'empty');
  if (!chat) throw new FastPathError(409, 'channel not ready');
  if (anchorRoutes.busy()) throw new FastPathError(409, 'Wait until the anchor task finishes.');
  if (normalBusy() && !inFlight) throw new FastPathError(409, 'Wait for the fixed-phase run to finish.');
  if (stopped && normalBusy()) throw new FastPathError(409, 'Wait for the stopped turn to finish.');
  fastPath.cancel('A newer request replaced this Fast Path preview.');
  const ahead = inFlight;
  let shown = text, scope = null;
  if (Array.isArray(input.scope?.sections)) {
    const ids = [...new Set(input.scope.sections.map(String))].filter(id => agentsDef.some(a => a.id === id));
    if (ids.length) {
      scope = { sections: ids, elements: Array.isArray(input.scope.elements) ? input.scope.elements : [] };
      const label = ids.map(id => `${id} ${sectionName(id)}`.trim()).join(', ');
      shown = `[Focus: ${label}] ${text}`.slice(0, 800);
    }
  }
  const msg = chat.post({ from, text: shown, scope });
  if (ahead > 0) chat.post({ from: 'system', kind: 'system', text: `Queued: ${ahead} request${ahead > 1 ? 's' : ''} ahead. The team will start on #${msg.id} when it finishes the current one (about 5 to 10 minutes). \u5df2\u6392\u961f\uff0c\u56e2\u961f\u5904\u7406\u5b8c\u5f53\u524d\u8bf7\u6c42\u540e\u4f1a\u5f00\u59cb\u5904\u7406\u4f60\u7684\u6d88\u606f\u3002` });
  startTurn(msg, input.scope?.appearance ?? input.appearance);
  return { id: msg.id };
}

const server = http.createServer(async (req, res) => {
  // Local-API guard: only a page served by this server may call it (blocks cross-site requests and DNS rebinding).
  { const host = String(req.headers.host || '').replace(/:\d+$/, ''), origin = req.headers.origin;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) { res.writeHead(403, { 'content-type': 'text/plain' }); return res.end('forbidden host'); }
    if (preview(req, res, 'http://' + req.headers.host)) return;
    if (origin && origin !== 'http://' + req.headers.host) { res.writeHead(403, { 'content-type': 'text/plain' }); return res.end('forbidden origin'); }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && Number(req.headers['content-length'] || 0) > 0 && !/^application\/json/i.test(req.headers['content-type'] || '')) { res.writeHead(415, { 'content-type': 'text/plain' }); return res.end('json required'); } }
  const url = new URL(req.url, 'http://x');
  let p;
  try { p = decodeURIComponent(url.pathname); }
  catch { return send(res, 400, { error: 'Invalid request path.' }); }
  if (p === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write('data: ' + JSON.stringify({ type: 'state', state }) + '\n\n');
    clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  if (p === '/api/state') return send(res, 200, state);
  if (isSkillRoute(p)) return skillRoutes(req, res, p, send);
  if (isVersionRoute(p)) return versionRoutes(req, res, p, send);
  if (isAnchorRoute(p)) return anchorRoutes.handle(req, res, p, send);
  if (p === '/api/fast' || p === '/api/metrics') return fastPath.handle(req, res, p, send);
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
    const command = /^\/fast(?:\s+|$)/.exec(text);
    if (command) return fastPath.respond(res, send, () => fastPath.run({
      projectId: TARGET.projectId, text: text.slice(command[0].length), from: b.from === 'owner' ? 'owner' : 'claude',
      appearance: b.scope?.appearance ?? b.appearance, scope: b.scope,
    }));
    return fastPath.respond(res, send, () => submitMessage({ ...b, text }));
  }
  if (p === '/api/team' && req.method === 'GET') return send(res, 200, teamView());
  if (p === '/api/team' && req.method === 'PUT') {
    if (!TEAM) return send(res, 501, { error: 'team editor not available' });
    if (inFlight > 0 || state.phase === 'running') return send(res, 409, { error: 'busy' });
    const b = await body(req);
    if (projectBusy()) return send(res, 409, { error: 'busy' });
    const r = TEAM.validate(b.agents, { allowlist: S.ALLOWLIST, existing: agentsDef });
    if (!r.ok) return send(res, 400, { errors: r.errors });
    if (squadOn && availableSpecialists(r.value).length !== squadAgents.length) {
      return send(res, 409, { errors: [{ path: 'agents', message: 'A worker ID overlaps the active squad. Disable squad before assigning that ID.' }] });
    }
    try { const d = applyTeam(r.value); return send(res, 200, { agents: agentsDef, diff: d }); }
    catch (e) { return send(res, 500, { errors: [{ path: '$', message: 'Could not apply the team: ' + e.message }] }); }
  }
  if (p === '/api/secrets/openai' && req.method === 'GET') return send(res, 200, secrets.openAIKeyStatus());
  if (p === '/api/secrets/openai' && req.method === 'PUT') { const b = await body(req); const r = secrets.setOpenAIKey(b.key); return send(res, r.ok ? 200 : 400, r); }
  if (p === '/api/secrets/openai' && req.method === 'DELETE') return send(res, 200, secrets.removeOpenAIKey());
  if (p === '/api/secrets/openai/test' && req.method === 'POST') return send(res, 200, await IMG.testKey({ apiKey: secrets.getOpenAIKey() }));
  if (p === '/api/secrets/openai/models' && req.method === 'GET') return send(res, 200, await IMG.listImageModels({ apiKey: secrets.getOpenAIKey() }));
  if (p === '/api/image' && req.method === 'POST') return imageRoute(req, res, send);
  if (p === '/api/squad' && req.method === 'GET') return send(res, 200, { on: squadOn, specialists: squadAgents.map(a => ({ id: a.id, title: a.title, layer: a.squad.layer || '', runner: a.runner })) });
  if (p === '/api/squad' && req.method === 'POST') {
    const b = await body(req);
    if (projectBusy()) return send(res, 409, { error: 'Wait for the current turn to finish.' });
    if (b.on && availableSpecialists(agentsDef).length !== squadAgents.length) {
      return send(res, 409, { error: 'A worker ID overlaps a squad specialist. Change the roster before enabling squad.' });
    }
    setSquad(b.on);
    return send(res, 200, { on: squadOn });
  }
  if (p === '/api/autopilot' && req.method === 'GET') return send(res, 200, autopilotView());
  if (p === '/api/autopilot' && req.method === 'POST') {
    const b = await body(req);
    autopilot.on = !!b.on; autopilot.status = autopilot.on ? 'watching your screen' : 'off';
    if (autopilot.on && !projectBusy()) stopped = false;
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
  if ((p === '/api/init' || p === '/api/run') && req.method === 'POST') {
    const legacy = p === '/api/run';
    const busy = () => send(res, 409, { error: legacy ? 'already running' : 'busy' });
    if (projectBusy()) return busy();
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (projectBusy()) return busy(); // another request may have started work while this body was arriving
      const input = parsePreparation(ROOT, Buffer.concat(chunks).toString('utf8'), TARGET);
      withProjectLock(PROJECT, (_exists, replace) => prepare(input, replace));
    } catch (error) {
      if (error instanceof ProjectInputError) return send(res, 400, { error: error.message });
      if (error instanceof ProjectBusyError) return send(res, 409, { error: error.message });
      console.error('Project initialization failed:', error);
      return send(res, 500, { error: 'Project initialization failed.' });
    }
    if (legacy) runAll();
    else {
      state.phase = 'ready'; state.round = 0;
      emit({ type: 'state', state });
    }
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
  if (p.startsWith('/ds/')) return serveFile(res, DS_DIR, p.slice(4));
  if (p === '/') return serveFile(res, UI, 'index.html');
  return serveFile(res, UI, p.slice(1));
});

// Idle project so the viewer has something to show before the first run.
withProjectLock(PROJECT, (exists, replace) => {
  if (!exists) return prepare(parsePreparation(ROOT, ''), replace);
  const remembered = path.join(PROJECT, 'agents.json');
  if (fs.existsSync(remembered)) agentsDef = JSON.parse(fs.readFileSync(remembered, 'utf8'));
  state.brief = fs.existsSync(path.join(PROJECT, 'brief.md')) ? fs.readFileSync(path.join(PROJECT, 'brief.md'), 'utf8') : '';
  state.agents = queuedAgents(agentsDef);
  refreshPreviewSections();
  ({ watcher, chat, turns } = openProject(agentsDef));
});
if (squadOn) setSquad(true);
loadAutopilot();
if (autopilot.on) maybeAutopilot(); // resume the owner's autopilot after a restart
server.listen(PORT, '127.0.0.1', () => console.log(`swarm listening on http://127.0.0.1:${PORT}`));
process.on('SIGTERM', () => { stopAll(); process.exit(0); });
process.on('SIGINT', () => { stopAll(); process.exit(0); });
