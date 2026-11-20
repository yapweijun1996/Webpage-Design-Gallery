#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const projectFlag = args.indexOf('-C');
const project = projectFlag === -1 ? undefined : args[projectFlag + 1];
const prompt = fs.readFileSync(0, 'utf8');
const step = /^STEP: (Triage|Discuss|Decide|Work|Review|Improve|Summary) \| AGENT: (\d{2})$/
  .exec(prompt.split(/\r?\n/, 1)[0]);

if (!project || !step) {
  console.error('Expected -C <project> and a STEP header on stdin.');
  process.exit(1);
}

const [, label, id] = step;
if (process.env.FAKE_FAIL_AGENT === id) process.exit(1);

const outbox = path.join(project, 'chat', `${id}.jsonl`);
const handoffQuestion = '@05, can you match the compact hero?';
const post = (...messages) => {
  fs.appendFileSync(outbox, messages.map(message => JSON.stringify(message) + '\n').join(''));
};
const emit = event => console.log(JSON.stringify(event));
const intentions = {
  Triage: 'I will assign the section updates to agents 02 and 05.',
  Discuss: 'I will coordinate the section handoff.',
  Decide: 'I will confirm the agreed section updates.',
  Work: 'I will update my assigned section.',
  Review: 'I will review the page as a whole.',
  Improve: 'I will tighten the headline to match the page rhythm.',
  Summary: 'I will report the outcome to the owner.'
};

emit({ type: 'item.completed', item: { type: 'agent_message', text: intentions[label] } });
emit({
  type: 'item.started',
  item: { type: 'command_execution', command: `append to chat/${id}.jsonl` }
});
fs.mkdirSync(path.dirname(outbox), { recursive: true });

switch (label) {
  case 'Triage': {
    const direction = path.join(project, 'direction.md');
    if (!fs.existsSync(direction) || !fs.readFileSync(direction, 'utf8').trim()) {
      fs.writeFileSync(direction, 'Use a compact layout and keep the spacing consistent.\n');
    }
    post(
      { kind: 'msg', text: 'I will coordinate two compact section updates.' },
      { kind: 'assign', to: ['02'], text: 'Shorten the hero.', task: 'Replace the hero with a compact section.' },
      { kind: 'assign', to: ['05'], text: 'Align the next update.', task: 'Keep your section compact and align it with the hero.' }
    );
    break;
  }
  case 'Discuss': {
    const history = fs.existsSync(outbox)
      ? fs.readFileSync(outbox, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
      : [];
    // A completed edit resets the discussion for the next owner request.
    const first = history.findLastIndex(message => message.kind === 'done') === history.length - 1;
    if (id === '02') {
      post(first
        ? { kind: 'msg', to: ['05'], text: handoffQuestion }
        : { kind: 'msg', text: 'The hero handoff is settled.' });
    } else if (id === '05' && !first) {
      const transcript = path.join(project, 'channel.md');
      const question = fs.existsSync(transcript)
        ? fs.readFileSync(transcript, 'utf8').split('\n').findLast(line => line.endsWith(handoffQuestion))
        : undefined;
      const reply = question?.match(/^#(\d+)\b/);
      post({ kind: 'msg', text: 'I will match the compact hero.', ...(reply && { reply: Number(reply[1]) }) });
    } else {
      post({ kind: 'msg', text: 'I am reviewing my section.' });
    }
    break;
  }
  case 'Decide':
    fs.writeFileSync(path.join(project, 'decisions.md'), 'Agent 05 will match the compact hero spacing.\n');
    post({ kind: 'decision', text: 'Agent 02 will shorten the hero and agent 05 will match its spacing.' });
    break;
  case 'Review': {
    const review = path.join(project, 'review.md');
    const first = !fs.existsSync(review) || !fs.readFileSync(review, 'utf8').trim();
    fs.writeFileSync(review, first ? 'Tighten the hero headline to match the page rhythm.\n' : 'The page rhythm is cohesive.\n');
    if (first) {
      post({ kind: 'assign', to: ['02'], text: 'Tighten the hero headline.', task: 'Tighten the hero headline to match the page rhythm.' });
    }
    break;
  }
  case 'Work':
  case 'Improve': {
    const sections = path.join(project, 'sections');
    const file = fs.readdirSync(sections).find(name => name.startsWith(`${id}-`) && name.endsWith('.html'));
    if (!file) throw new Error(`No HTML section for agent ${id}`);
    const action = label === 'Improve' ? 'Improved' : 'Updated';
    fs.writeFileSync(path.join(sections, file), `<section class="s-${id}" id="${path.basename(file, '.html')}"><h2>${action} by agent ${id}</h2></section>\n`);
    post({ kind: 'done', text: `${action} ${file}.` });
    break;
  }
  case 'Summary':
    post({ kind: 'msg', to: ['owner'], text: 'The assigned agents have finished their available section updates.' });
    break;
}

emit({ type: 'turn.completed' });
