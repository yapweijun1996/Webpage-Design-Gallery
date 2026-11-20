'use strict';

const PROMPT_LIMIT = 3600;
const REQUEST_LIMIT = 1200;

// When the owner looks at only part of the page, every agent must stay inside that part.
function scopeLine(scope) {
  if (!scope || !Array.isArray(scope.sections) || !scope.sections.length) return '';
  const els = (scope.elements || []).slice(0, 10).map(e => `${e.section}:${e.tag} "${e.text}"`).join('; ');
  return `OWNER SCOPE: the owner is looking at only part of the page. In-scope sections: ${scope.sections.join(', ')}. On-screen elements: ${els || 'not listed'}. Work, review and discuss ONLY these sections and elements. Do not change any other section, and assign no agent outside this scope: everything else stays exactly as it is.`.slice(0, 700);
}

function buildPrompt(agent, label, owner, assignment, isManager) {
  const { id, name, section, lane } = agent;
  const sectionOwnership = `Edit only sections/${id}-${section}.html, sections/${id}-${section}.css, and notes/${id}.md.`;
  const done = 'Finally append one kind:"done" line to your outbox stating what changed in one sentence.';
  const task = {
    Triage: `Answer a question directly. For a build or redesign request, if direction.md is empty or missing, first write direction.md (max 60 lines). Include the concept and feeling, a shared visual system covering background alternation, type scale use, spacing rhythm, accent use, and image treatment, the section order with an explicit HANDOFF line for each neighbouring pair, each agent's unique contribution, and the top risks. If work is needed, then post a short plan and one kind:"assign" line per worker, with exactly that worker ID in to, a one-sentence summary in text, and the concrete task in task (always include both text and task). Keep other worker mentions out of assignment lines.`,
    Discuss: 'Post 1-3 short messages (at most 3 this turn). Be concrete about overlaps, handoffs, questions, or objections. Mention colleagues by ID and set reply to the message ID when answering a peer. Leave implementation for Work.',
    Decide: `Write decisions.md (max 40 lines) with agreed handoffs, rulings on disagreements, and a DO/DON'T list per agent. Post one kind:"decision" message summarizing agreed handoffs and each worker task. Update a task when needed by posting a new kind:"assign" line with only that worker ID in to, a one-sentence summary in text, and the updated task in task.`,
    Work: `Follow the manager's latest assignment and agreed handoffs. ${sectionOwnership} ${done}`,
    Review: 'Read direction.md, decisions.md, and every sections/*.html and sections/*.css file as one assembled page. Write review.md (max 50 lines) covering what works, page-level problems, and the top 3 concrete changes per agent ranked by impact. Then post one kind:"assign" line per worker whose section needs changes, with only that worker ID in to, a one-sentence summary in text, and the concrete change in task. Keep other worker mentions out of assignment lines. Post no assignments if the page is good.',
    Improve: `Read review.md and make the concrete change in the manager's latest review assignment while following agreed handoffs. ${sectionOwnership} ${done}`,
    Summary: 'Post one short wrap-up to the requester. Summarize completed work and any open issues based on the channel.'
  }[label];
  const example = JSON.stringify({
    to: [owner.from], kind: 'msg', text: 'The section handoff is ready to review.', reply: owner.id
  });
  const instructions = [
    `STEP: ${label} | AGENT: ${id}`,
    `You are ${(name ?? id).slice(0, 100)}${agent.title ? ', job title: ' + String(agent.title).slice(0, 80) : ''}, agent ${id}. Your lane: ${(lane || section || 'Manager and team coordinator').slice(0, 300)}.`,
    'Read CONTRACT.md, brief.md, direction.md, decisions.md (if non-empty), and channel.md.',
    `To post, append exactly one JSON object per line to chat/${id}.jsonl. Example:`,
    example,
    'The server maintains channel.md and channel.jsonl. Use your outbox for channel posts.',
    'Live narration rule: before each major step, write one short sentence of intent (max 20 words) in your live commentary.',
    isManager && 'For channel turns, edit only direction.md, decisions.md, and review.md. Append channel posts to your outbox.',
    scopeLine(owner.scope),
    task,
    assignment && `Your manager assignment (#${assignment.id}): ${(assignment.task || assignment.text).slice(0, 800)}`,
    `Current request #${owner.id} from ${owner.from}:`
  ].filter(Boolean).join('\n');
  const requestLimit = Math.min(REQUEST_LIMIT, Math.max(0, PROMPT_LIMIT - instructions.length - 1));
  return `${instructions}\n${owner.text.slice(0, requestLimit)}`;
}

function squadPrompt(member, wave, waveNo, plan, owner) {
  const mates = wave.filter(m => m.id !== member.id).map(m => `${m.id} ${m.title}`).join('; ');
  const role = member.id === plan.layoutId
    ? 'You are the integrator: read the layer files your teammates wrote (sections/' + plan.base + '.*.css), add the HTML hooks and classes they need, remove clashes, keep one h1 and valid structure.'
    : 'Write only your own file. If you need an HTML class or hook, post a short message to the layout engineer instead of editing the HTML.';
  const lines = [
    `STEP: Work | AGENT: ${member.id}`,
    `You are ${member.name}, job title: ${member.title}, agent ${member.id}, in squad wave ${waveNo} on section ${plan.base}.`,
    'Read CONTRACT.md, brief.md, direction.md (if present) and channel.md. Open the real page at /p/dist/index.html state when useful.',
    `To post, append exactly one JSON object per line to chat/${member.id}.jsonl. Example: ${JSON.stringify({ to: [plan.layoutId], kind: 'msg', text: 'I need class .hero-title on the headline.', reply: owner.id })}`,
    'Live narration rule: before each major step write one short sentence of intent (max 20 words) in your live commentary.',
    mates && `Teammates working at the same time: ${mates}. Do not edit their files.`,
    role,
    plan.prompts[member.id],
    'Finally append one kind:"done" line to your outbox stating what changed in one sentence.',
    `Current request #${owner.id} from ${owner.from}:`
  ].filter(Boolean).join('\n');
  return lines + '\n' + String(owner.text).slice(0, Math.max(0, PROMPT_LIMIT + 800 - lines.length));
}

function createTurns({ chat, runAgent, agents, managerId = '00', maxDiscussRounds = 2, reviewRounds = 1, squad = null }) {
  const manager = agents.find(agent => agent.id === managerId);
  const workers = new Map(agents.filter(agent => agent.id !== managerId).map(agent => [agent.id, agent]));
  const maxReviewRounds = Math.min(2, Math.trunc(reviewRounds));
  let tail = Promise.resolve();
  let pending = 0;

  function notice(text) {
    return chat.post({ from: 'system', kind: 'system', text });
  }

  async function run(agent, label, owner, assignment) {
    const prompt = buildPrompt(agent, label, owner, assignment, agent.id === managerId);
    try {
      if (await runAgent({ id: agent.id, label, prompt })) return;
    } catch {
      // A failed agent must not prevent its peers or later steps from running.
    }
    notice(`Agent ${agent.id} failed in ${label}`);
  }

  let currentScope = null; // Set of section ids the owner is looking at, or null for the whole page
  function getAssignments(since) {
    const assignments = new Map();
    for (const message of chat.history(since)) {
      if (message.from !== managerId || message.kind !== 'assign') continue;
      // The Manager sometimes omits the recipient ("everyone"); infer it from the text, else from a single-section scope.
      let targets = message.to.filter(id => workers.has(id));
      if (!targets.length) {
        const text = `${message.text || ''} ${message.task || ''}`;
        targets = [...new Set([...text.matchAll(/(?<![\d.#])(0[1-9]|[1-9]\d)(?!\d)/g)].map(m => m[1]))].filter(id => workers.has(id));
        if (!targets.length && currentScope && currentScope.size === 1) targets = [...currentScope];
      }
      for (const id of targets) {
        if (workers.has(id) && (!currentScope || currentScope.has(id))) assignments.set(id, message);
      }
    }
    return assignments;
  }

  async function handle(owner) {
    currentScope = Array.isArray(owner.scope?.sections) && owner.scope.sections.length ? new Set(owner.scope.sections) : null;
    try {
      const plan = squad && squad.on() ? squad.plan(owner) : null;
      if (plan) await handleSquad(owner, plan); else await handleScoped(owner);
    } finally { currentScope = null; }
  }

  // Squad mode: several specialists work on the SAME focused screen. Each writes only its own layer file; waves keep the order researcher, layers in parallel, layout integration, QA.
  async function handleSquad(owner, plan) {
    notice(`Squad on ${plan.base}: ${plan.members.map(m => m.title).join(', ')}`);
    let n = 0;
    for (const wave of plan.waves) {
      n += 1;
      notice(`Squad wave ${n}/${plan.waves.length}: ${wave.map(m => m.title).join(', ')}`);
      await Promise.all(wave.map(async member => {
        const prompt = squadPrompt(member, wave, n, plan, owner);
        try { if (await runAgent({ id: member.id, label: 'Work', prompt })) return; } catch { /* a failed specialist must not block the squad */ }
        notice(`Agent ${member.id} (${member.title}) failed in squad wave ${n}`);
      }));
    }
    notice('Squad finished');
  }

  async function handleScoped(owner) {
    // A queued owner message can precede assignments made for the previous turn.
    const since = Math.max(owner.id, notice('Triage started').id);
    await run(manager, 'Triage', owner);
    const initialAssignments = getAssignments(since);
    if (!initialAssignments.size) return;

    // Fast lane: autopilot cycles and small scopes (two sections or fewer) skip discussion, decision, review and summary.
    // The next autopilot cycle starts by inspecting the result, so it acts as the review.
    const sc = owner.scope;
    if (sc && (sc.mode === 'autopilot' || (Array.isArray(sc.sections) && sc.sections.length <= 2))) {
      notice('Fast lane: Work starts now (discussion and review skipped for a small scope)');
      await Promise.all([...initialAssignments].map(([id, assignment]) => run(workers.get(id), 'Work', owner, assignment)));
      return;
    }

    let roundStart = notice('Discuss started').id;
    let participants = [...initialAssignments.keys()];
    for (let round = 0; round < maxDiscussRounds && participants.length; round += 1) {
      await Promise.all(participants.map(id => run(workers.get(id), 'Discuss', owner, initialAssignments.get(id))));
      const messages = chat.history(roundStart);
      roundStart = messages.at(-1)?.id ?? roundStart;
      participants = [...initialAssignments.keys()].filter(id => messages.some(message =>
        workers.has(message.from) && message.from !== id && message.to.includes(id) &&
        !messages.some(reply => reply.from === id && reply.id > message.id && reply.reply === message.id)
      ));
    }

    notice('Decide started');
    await run(manager, 'Decide', owner);

    notice('Work started');
    const assignments = getAssignments(since);
    await Promise.all([...assignments].map(([id, assignment]) => run(workers.get(id), 'Work', owner, assignment)));

    for (let round = 0; round < maxReviewRounds; round += 1) {
      const reviewStart = notice('Review started').id;
      await run(manager, 'Review', owner);
      const improvements = getAssignments(reviewStart);
      if (!improvements.size) break;

      notice('Improve started');
      await Promise.all([...improvements].map(([id, assignment]) => run(workers.get(id), 'Improve', owner, assignment)));
    }

    notice('Summary started');
    await run(manager, 'Summary', owner);
  }

  function onOwnerMessage(message) {
    pending += 1;
    const turn = tail.then(() => handle(message)).finally(() => { pending -= 1; });
    tail = turn.catch(() => {});
    return turn;
  }

  return { onOwnerMessage, busy: () => pending > 0 };
}

module.exports = { createTurns };
