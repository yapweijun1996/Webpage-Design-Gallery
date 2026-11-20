'use strict';

const PROMPT_LIMIT = 3600;
const REQUEST_LIMIT = 1200;

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
    `You are ${(name ?? id).slice(0, 100)}, agent ${id}. Your lane: ${(lane || section || 'Manager and team coordinator').slice(0, 300)}.`,
    'Read CONTRACT.md, brief.md, direction.md, decisions.md (if non-empty), and channel.md.',
    `To post, append exactly one JSON object per line to chat/${id}.jsonl. Example:`,
    example,
    'The server maintains channel.md and channel.jsonl. Use your outbox for channel posts.',
    'Live narration rule: before each major step, write one short sentence of intent (max 20 words) in your live commentary.',
    isManager && 'For channel turns, edit only direction.md, decisions.md, and review.md. Append channel posts to your outbox.',
    task,
    assignment && `Your manager assignment (#${assignment.id}): ${(assignment.task || assignment.text).slice(0, 800)}`,
    `Current request #${owner.id} from ${owner.from}:`
  ].filter(Boolean).join('\n');
  const requestLimit = Math.min(REQUEST_LIMIT, Math.max(0, PROMPT_LIMIT - instructions.length - 1));
  return `${instructions}\n${owner.text.slice(0, requestLimit)}`;
}

function createTurns({ chat, runAgent, agents, managerId = '00', maxDiscussRounds = 2, reviewRounds = 1 }) {
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

  function getAssignments(since) {
    const assignments = new Map();
    for (const message of chat.history(since)) {
      if (message.from !== managerId || message.kind !== 'assign') continue;
      for (const id of message.to) {
        if (workers.has(id)) assignments.set(id, message);
      }
    }
    return assignments;
  }

  async function handle(owner) {
    // A queued owner message can precede assignments made for the previous turn.
    const since = Math.max(owner.id, notice('Triage started').id);
    await run(manager, 'Triage', owner);
    const initialAssignments = getAssignments(since);
    if (!initialAssignments.size) return;

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
