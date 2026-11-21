(function () {
  'use strict';

  const steps = ['Research', 'Design and Build', 'Review and Polish'];
  const phases = ['Triage', 'Discuss', 'Decide', 'Work', 'Review', 'Improve', 'Summary'];
  const phaseSteps = [0, 0, 0, 1, 2, 2, 2];
  const eventTypes = new Set(['status', 'thought', 'edit', 'doc', 'action', 'chat', 'phase', 'busy', 'round', 'autopilot', 'manager']);
  const icons = {
    progress: 'M3 17l5-5 4 4 8-9m-5 0h5v5',
    team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4m-1-12a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    activity: 'M2 12h5l3-7 4 14 3-7h5',
    artifacts: 'M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
    agent: 'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2',
    chevron: 'm9 6 6 6-6 6',
    chat: 'M20 15a2 2 0 0 1-2 2H9l-5 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z',
    file: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',
    image: 'M3 4h18v16H3zm0 13 5-5 4 4 3-3 6 6M16 8h.01',
    error: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM12 8v4m0 4h.01',
    check: 'm5 12 4 4L19 6'
  };
  const clock = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' });
  const artifactReference = /(?:^|[\s"'`=():/\\<>])((?:assets[\\/]generated[\\/][\w.-]+\.(?:png|webp|jpe?g)|(?:research|review[12]?)\.md))(?![\w/\\-]|\.\w)/gi;
  const text = value => typeof value === 'string' ? value : '';
  const timestamp = value => Number.isFinite(value) && value > 0 && value <= 8.64e15 ? value : 0;
  const agentId = value => /^\d{2}$/.test(text(value)) ? value : '';
  const titles = value => text(value).split(',').map(part => part.trim().toLowerCase()).filter(Boolean);

  function element(tag, classes, content) {
    const node = document.createElement(tag);
    if (classes) node.className = classes;
    if (content != null) node.textContent = content;
    return node;
  }

  function updateText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('studio-activity-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', icons[name]);
    svg.append(path);
    return svg;
  }

  function card(root, label, symbol, embedded = false) {
    const panel = element(embedded ? 'div' : 'section', embedded ? 'studio-activity-card studio-activity-embedded' : 'sds-card studio-activity-card');
    if (!embedded) {
      const heading = element('h2', 'studio-activity-heading');
      heading.append(icon(symbol), label);
      panel.setAttribute('aria-label', label);
      panel.append(heading);
    }
    root?.replaceChildren(panel);
    return panel;
  }

  function listCard(root, label, symbol, emptyLabel, ordered = false) {
    const embedded = symbol !== 'team' && !!root?.closest('[role="tabpanel"]');
    const panel = card(root, label, symbol, embedded);
    const empty = element('p', 'studio-activity-empty', emptyLabel);
    const list = element(ordered ? 'ol' : 'ul', 'studio-activity-list');
    list.setAttribute('role', 'list');
    panel.append(empty, list);
    return { empty, list };
  }

  function timestampNode(time) {
    const node = element('time', 'studio-activity-time');
    if (time) {
      node.textContent = clock.format(time);
      node.dateTime = new Date(time).toISOString();
    }
    return node;
  }

  function statusLabel(status) {
    if (/^(?:working\b|retrying$)/i.test(status)) return 'Working';
    if (/^(?:waiting|done)$/i.test(status)) return 'Done';
    if (/^(?:failed|error)$/i.test(status)) return 'Error';
    return 'Pending';
  }

  function agentTitle(agent) {
    const section = text(agent.section).replace(/[-_]+/g, ' ');
    const fallback = section && section[0].toUpperCase() + section.slice(1) + ' Designer';
    return text(agent.title) || fallback || (agent.id === '00' ? 'Art Director' : 'Designer');
  }

  function mount({ progress, team, activity, artifacts, onOpenAgent } = {}) {
    const progressCard = card(progress, 'Swarm Progress', 'progress');
    const metrics = element('div', 'studio-activity-metrics');
    const counter = element('span');
    const percent = element('span', 'studio-activity-percent');
    const bar = element('progress', 'sds-progress studio-activity-bar');
    bar.max = 100;
    bar.setAttribute('aria-label', 'Swarm progress');
    const milestones = element('ol', 'studio-activity-milestones');
    milestones.setAttribute('aria-label', 'Workflow steps');
    milestones.setAttribute('role', 'list');
    const stepItems = steps.map(label => {
      const item = element('li');
      const dot = element('span', 'studio-activity-dot');
      const status = element('span', 'sds-visually-hidden');
      dot.setAttribute('aria-hidden', 'true');
      dot.append(icon('check'));
      item.append(dot, element('span', '', label), status);
      milestones.append(item);
      return { item, status };
    });
    const context = element('p', 'studio-activity-context');
    context.setAttribute('aria-live', 'polite');
    metrics.append(counter, percent);
    progressCard.append(metrics, bar, milestones, context);

    const roster = listCard(team, 'Agent Team', 'team', 'No agents available.');
    const timeline = listCard(activity, 'Activity', 'activity', 'No activity yet.', true);
    const files = listCard(artifacts, 'Artifacts', 'artifacts', 'Changed files will appear here.');
    const agents = new Map();
    const agentRows = new Map();
    const activityRows = [];
    const fileRows = new Map();
    const seen = new Set();
    let project;
    let hadFeed = false;
    let phase = '';
    let run;
    let roundCount = 0;
    let ordinal = 0;
    let stoppedAt = 0;
    let timer;
    let autopilotStatus;

    function clear() {
      agents.clear();
      agentRows.clear();
      activityRows.length = 0;
      fileRows.clear();
      seen.clear();
      for (const panel of [roster, timeline, files]) panel.list.replaceChildren();
      phase = '';
      run = undefined;
      roundCount = 0;
      stoppedAt = 0;
      hadFeed = false;
      autopilotStatus = undefined;
    }

    function actorName(id) {
      if (id === 'system') return 'System';
      if (id === 'owner') return 'Owner';
      if (id === 'claude') return 'Claude';
      return text(agents.get(id)?.name) || (id ? `Agent ${id}` : 'Swarm');
    }

    function startRun(mode, extra = {}) {
      run = { mode, started: ordinal, step: -1, visited: new Set(), complete: false, ...extra };
    }

    function setStep(step) {
      run.step = step;
      run.visited.add(step);
    }

    function setPhase(next, time) {
      if (!next || next === phase) return;
      if (next === 'running') {
        if (run?.complete || stoppedAt) run = undefined;
        stoppedAt = 0;
      }
      if (next === 'stopped') stoppedAt = time;
      if (next === 'ready' || next === 'done') {
        if (run && phase !== 'stopped') run.complete = true;
      }
      phase = next;
    }

    function notice(value) {
      const squad = /^Squad on ([^:]+):\s*(.*)$/i.exec(value);
      const wave = /^Squad wave (\d+)\/(\d+):\s*(.*)$/i.exec(value);
      const turn = /^(Triage|Discuss|Decide|Work|Review|Improve|Summary) started\b/i.exec(value);
      if (squad) {
        startRun('squad', { section: squad[1], members: titles(squad[2]), wave: 0, total: 0 });
      } else if (wave) {
        const [, number, count, label] = wave;
        const current = Number(number), total = Number(count);
        if (!Number.isSafeInteger(total) || current < 1 || current > total) return;
        if (run?.mode !== 'squad' || run.complete || current < run.wave) {
          startRun('squad', { members: [], wave: 0 });
          if (current > 1) run.started = 0;
        }
        run.wave = current;
        run.total = total;
        run.waveMembers = titles(label);
        run.waveStart = ordinal;
        run.label = label;
        if (/\bresearch/i.test(label)) setStep(0);
        else if (/\b(?:qa|review|polish)\b/i.test(label)) setStep(2);
        else setStep(1);
      } else if (/^Squad finished\b/i.test(value)) {
        if (run?.mode !== 'squad') startRun('squad', { started: 0 });
        run.complete = true;
      } else if (turn || /^Fast lane: Work starts now\b/i.test(value)) {
        const label = turn ? phases.find(name => name.toLowerCase() === turn[1].toLowerCase()) : 'Work';
        if (label === 'Triage' || run?.mode !== 'turn' || run.complete) startRun('turn');
        run.index = phases.indexOf(label);
        run.label = label;
        setStep(phaseSteps[run.index]);
      }
    }

    function setRound(round, label) {
      if (!Number.isInteger(round) || round < 1) return;
      if (run && run.mode !== 'batch') return;
      if (!run) startRun('batch');
      run.wave = round;
      run.total = Math.max(round, roundCount);
      run.label = label || run.label;
      const step = /review|improve|feedback/i.test(run.label) ? 2 : /build/i.test(run.label) ? 1
        : run.label ? 0 : Math.min(2, Math.floor((round - 1) * 3 / run.total));
      for (let previous = 0; previous <= step; previous += 1) run.visited.add(previous);
      setStep(step);
    }

    function setStatus(agent, value, time, order) {
      const next = text(value);
      if (agent.status === next) {
        if (time && !agent.startedAt && statusLabel(next) === 'Working') agent.startedAt = time;
        return;
      }
      const wasWorking = statusLabel(agent.status) === 'Working';
      const isWorking = statusLabel(next) === 'Working';
      if (isWorking && !wasWorking) {
        agent.startedAt = time;
        agent.finishedAt = 0;
      } else if (wasWorking && !isWorking) {
        agent.finishedAt = time || Date.now();
      }
      agent.status = next;
      agent.statusOrder = order;
    }

    function renderProgress() {
      let value = 0;
      let label = 'No active wave';
      let note = 'Waiting for the next run.';
      if (run?.mode === 'squad') {
        const members = run.waveMembers || [];
        const finished = members.filter(title => [...agents.values()].some(agent =>
          text(agent.title || agent.name).toLowerCase() === title && agent.statusOrder > run.waveStart &&
          ['Done', 'Error'].includes(statusLabel(agent.status)))).length;
        const fraction = members.length ? finished / members.length : 0;
        if (run.total) {
          label = `Wave ${run.wave} / ${run.total}`;
          value = (run.wave - 1 + fraction) / run.total;
        } else {
          label = run.complete ? 'Squad complete' : 'Preparing squad';
        }
        note = run.complete ? 'Squad finished' : [run.section, run.label].filter(Boolean).join(' · ');
      } else if (run?.mode === 'turn') {
        label = `Wave ${run.step + 1} / ${steps.length}`;
        value = run.index / phases.length;
        note = run.complete ? 'Turn finished' : run.label;
      } else if (run?.mode === 'batch') {
        label = `Round ${run.wave} / ${run.total}`;
        value = (run.wave - 1) / run.total;
        note = run.complete ? 'Run finished' : run.label || 'In progress';
      } else if (phase === 'running') {
        note = 'Waiting for the first progress update.';
      }
      if (phase === 'stopped') note = 'Run stopped';
      const amount = run?.complete ? 100 : Math.min(99, Math.round(value * 100));
      bar.value = amount;
      updateText(counter, label);
      updateText(percent, `${amount}%`);
      updateText(context, note);
      stepItems.forEach(({ item, status }, index) => {
        let state = 'pending';
        if (run?.visited.has(index)) state = run.complete || index !== run.step ? 'done' : 'current';
        else if (run?.complete && !run.visited.size) state = 'unknown';
        else if (run && (run.complete || index < run.step)) state = 'skipped';
        if (phase === 'stopped' && state === 'current') state = 'stopped';
        item.dataset.step = state;
        if (state === 'current') item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
        updateText(status, ` (${state === 'current' ? 'in progress' : state})`);
      });
    }

    function makeAgentRow(id) {
      const row = element('li');
      const details = element('details', 'sds-disclosure studio-activity-disclosure studio-activity-agent');
      const summary = element('summary', 'studio-activity-agent-summary');
      const avatar = element('span', 'studio-activity-avatar');
      avatar.append(icon('agent'));
      const identity = element('span', 'studio-activity-identity');
      const name = element('span', 'studio-activity-name');
      const title = element('span', 'studio-activity-title');
      const badge = element('span', 'sds-badge studio-activity-badge');
      const elapsed = element('span', 'studio-activity-elapsed');
      identity.append(name, title);
      summary.append(avatar, identity, badge, elapsed, icon('chevron'));
      const body = element('div', 'studio-activity-detail');
      const thought = element('p', 'studio-activity-thought');
      const touched = element('ul', 'studio-activity-touched');
      const fileLabel = element('p', 'studio-activity-detail-label');
      touched.setAttribute('role', 'list');
      body.append(element('p', 'studio-activity-detail-label', 'Last thought'), thought, fileLabel, touched);
      const open = element('button', 'sds-btn sds-btn--ghost sds-btn--sm studio-activity-open', 'Open agent');
      if (typeof onOpenAgent === 'function') {
        open.type = 'button';
        open.addEventListener('click', () => onOpenAgent(id));
        body.append(open);
      }
      details.append(summary, body);
      row.append(details);
      return { row, avatar, name, title, badge, elapsed, thought, fileLabel, touched, open };
    }

    function renderElapsed() {
      const now = Date.now();
      let ticking = false;
      for (const [id, view] of agentRows) {
        const agent = agents.get(id);
        const end = agent.finishedAt || stoppedAt;
        const value = view.pending || !agent.startedAt ? '—' : `${Math.max(0, Math.floor(((end || now) - agent.startedAt) / 1000))}s`;
        updateText(view.elapsed, value);
        view.elapsed.title = value === '—' ? 'Elapsed time unavailable' : `Elapsed time ${value}`;
        ticking ||= !end && value !== '—' && statusLabel(agent.status) === 'Working';
      }
      if (ticking && !timer) timer = window.setInterval(renderElapsed, 1000);
      if (!ticking && timer) {
        window.clearInterval(timer);
        timer = undefined;
      }
    }

    function renderTeam() {
      const visible = [...agents.values()].filter(agent => !run?.members?.length ||
        run.members.includes(text(agent.title || agent.name).toLowerCase()));
      const ids = new Set(visible.map(agent => agent.id));
      for (const [id, view] of agentRows) {
        if (!ids.has(id)) {
          view.row.remove();
          agentRows.delete(id);
        }
      }
      visible.forEach((agent, index) => {
        const { id } = agent;
        if (!agentRows.has(id)) agentRows.set(id, makeAgentRow(id));
        const view = agentRows.get(id);
        const before = roster.list.children[index];
        if (before !== view.row) roster.list.insertBefore(view.row, before || null);
        const name = actorName(id), title = agentTitle(agent);
        updateText(view.name, name);
        updateText(view.title, title);
        view.title.hidden = name === title;
        view.open.setAttribute('aria-label', `Open agent ${name}`);
        view.avatar.style.color = /^#[0-9a-f]{6}$/i.test(agent.color) ? agent.color : '';
        view.pending = run && run.mode !== 'batch' && agent.statusOrder < run.started;
        const badge = view.pending || (phase === 'stopped' && statusLabel(agent.status) === 'Working') ? 'Pending' : statusLabel(agent.status);
        updateText(view.badge, badge);
        view.badge.dataset.status = badge.toLowerCase();
        updateText(view.thought, text(agent.thought) || 'No thought recorded yet.');
        const paths = [...(agent.files || [])];
        updateText(view.fileLabel, paths.length ? 'Files touched' : 'No files recorded.');
        if (paths.length !== view.touched.children.length) {
          view.touched.replaceChildren(...paths.map(path => element('li', '', path)));
        }
      });
      roster.empty.hidden = visible.length > 0;
      renderElapsed();
    }

    function addActivity({ who, label, detail = '', symbol, time }) {
      const row = element('li');
      const disclosure = element('details', 'sds-disclosure studio-activity-disclosure studio-activity-event');
      const summary = element('summary', 'studio-activity-event-summary');
      const title = element('span', 'studio-activity-event-title');
      title.append(label.replace(/\s+/g, ' '), ' · ', element('span', 'studio-activity-event-actor', who));
      summary.append(icon(symbol), title, timestampNode(time), icon('chevron'));
      const body = element('div', 'studio-activity-detail');
      body.append(element('p', 'studio-activity-detail-label', who), element('p', 'studio-activity-thought', label));
      if (detail && detail !== label) body.append(element('p', 'studio-activity-thought studio-activity-secondary', detail));
      disclosure.append(summary, body);
      row.append(disclosure);
      const index = activityRows.findIndex(record => record.time <= time);
      if (index === -1) {
        activityRows.push({ row, time });
        timeline.list.append(row);
      } else {
        timeline.list.insertBefore(row, activityRows[index].row);
        activityRows.splice(index, 0, { row, time });
      }
      if (activityRows.length > 50) activityRows.pop().row.remove();
      timeline.empty.hidden = true;
    }

    function addFile(file, id, time, observed) {
      const path = text(file).replace(/\\/g, '/').replace(/^\.\//, '');
      if (!path || path.length > 512) return;
      const agent = agents.get(id);
      if (agent) {
        agent.files ||= new Set();
        agent.files.add(path);
      }
      let record = fileRows.get(path);
      if (!record) {
        const image = /^assets\/generated\//i.test(path);
        const row = element('li', 'studio-activity-file');
        const description = element('div');
        const label = path.split('/').pop();
        const name = element('span', 'studio-activity-name', label);
        const location = element('span', 'studio-activity-file-path', path);
        const attribution = element('span', 'studio-activity-secondary');
        const type = image ? 'Image' : /\.md$/i.test(path) ? 'Document' : 'File';
        description.append(name);
        if (path !== label) description.append(location);
        description.append(attribution);
        row.append(icon(image ? 'image' : 'file'), description, element('span', 'studio-activity-file-type', type));
        record = { row, attribution, time: 0, observed: false };
        fileRows.set(path, record);
      }
      if (record.observed && !observed) return;
      if (time < record.time && record.observed === observed) return;
      record.time = time;
      record.observed = observed;
      updateText(record.attribution, `${observed ? 'Changed' : 'Reported'} · ${actorName(id)}`);
      // Reconnect history can arrive after newer live edits.
      const next = [...fileRows.values()].sort((a, b) => b.time - a.time);
      const after = next[next.indexOf(record) + 1];
      const following = after?.row.parentNode === files.list ? after.row : null;
      if (record.row.parentNode !== files.list || record.row.nextSibling !== following) files.list.insertBefore(record.row, following);
      files.empty.hidden = true;
    }

    function findReportedFiles(body, id, time) {
      for (const [, path] of text(body).matchAll(artifactReference)) addFile(path, id, time, false);
    }

    function editAuthor(id, path) {
      // HTML watcher events carry the section ID, even when the layout specialist wrote the file.
      if (run?.mode !== 'squad' || run.complete || path !== `sections/${run.section}.html`) return id;
      const layout = [...agents.values()].find(agent => /^layout\b/i.test(agent.title) &&
        run.waveMembers?.includes(agent.title.toLowerCase()));
      return layout?.id || id;
    }

    function consume(ev) {
      if (!eventTypes.has(ev?.type)) return false;
      const msg = ev.type === 'chat' ? ev.msg : null;
      const time = timestamp(msg?.ts) || timestamp(ev.ts);
      const key = Number.isSafeInteger(msg?.id) && msg.id > 0 ? `chat:${msg.id}` : time ? JSON.stringify(ev) : '';
      if (key && seen.has(key)) return false;
      if (key) {
        seen.add(key);
        if (seen.size > 900) seen.delete(seen.values().next().value);
      }
      if (ev.type !== 'edit') hadFeed = true;
      ordinal += 1;
      const id = agentId(ev.id);
      const agent = agents.get(id);
      const who = actorName(id);
      if (ev.type === 'status') {
        if (agent) setStatus(agent, ev.status, time, ordinal);
        const label = statusLabel(text(ev.status));
        if (label === 'Error' || ev.status === 'retrying') {
          addActivity({ who, label: label === 'Error' ? 'Agent failed' : 'Retrying', symbol: 'error', time });
        }
      } else if (ev.type === 'thought' && text(ev.text)) {
        if (agent) agent.thought = ev.text;
        addActivity({ who, label: ev.text, symbol: 'chat', time });
      } else if ((ev.type === 'edit' || ev.type === 'doc') && text(ev.file)) {
        const path = ev.file.replace(/\\/g, '/');
        const author = ev.type === 'edit' ? editAuthor(id, path) : id;
        addFile(path, author, time, true);
        addActivity({ who: actorName(author), label: `Updated ${path}`, symbol: 'file', time });
      } else if (ev.type === 'action' && ev.verb === 'editing') {
        findReportedFiles(ev.cmd, id, time);
      } else if (msg && text(msg.text)) {
        if (msg.from === 'system' && msg.kind === 'system') notice(msg.text);
        if (agentId(msg.from) && msg.kind === 'done') findReportedFiles(msg.text, msg.from, time);
        addActivity({ who: actorName(text(msg.from)), label: msg.text, detail: text(msg.task),
          symbol: msg.kind === 'system' ? 'activity' : 'chat', time });
      } else if (ev.type === 'phase') {
        setPhase(text(ev.phase), time || Date.now());
      } else if (ev.type === 'busy' && ev.busy === false && run?.mode === 'turn') {
        run.complete = true;
      } else if (ev.type === 'round') {
        setRound(ev.round, text(ev.label));
        if (text(ev.label)) addActivity({ who: 'Swarm', label: ev.label, symbol: 'activity', time });
      } else if (ev.type === 'autopilot' && text(ev.status) && ev.status !== autopilotStatus) {
        autopilotStatus = ev.status;
        addActivity({ who: 'Autopilot', label: ev.status, symbol: 'activity', time });
      } else if (ev.type === 'manager' && text(ev.text)) {
        addActivity({ who: 'Manager', label: ev.text, symbol: 'chat', time });
      }
      return true;
    }

    function render() {
      renderProgress();
      renderTeam();
    }

    function setState(state) {
      if (!state || typeof state !== 'object') return;
      const { feed } = state;
      const name = text(state.project);
      if ((name && project && name !== project) || (hadFeed && Array.isArray(feed) && !feed.length)) clear();
      if (name) project = name;
      if (Number.isInteger(state.rounds) && state.rounds > 0) roundCount = state.rounds;
      if (state.agents && typeof state.agents === 'object') {
        const ids = new Set();
        for (const [key, data] of Object.entries(state.agents)) {
          const id = agentId(data?.id || key);
          if (!id || !data) continue;
          ids.add(id);
          const model = agents.get(id) || { id, status: '', statusOrder: 0 };
          Object.assign(model, { name: data.name, title: data.title, section: data.section, color: data.color });
          agents.set(id, model);
        }
        for (const id of agents.keys()) if (!ids.has(id)) agents.delete(id);
      }
      if (Array.isArray(feed) && feed.length) {
        hadFeed = true;
        // Startup snapshots include the same recent events later sent by SSE.
        for (const ev of feed) consume(ev);
      }
      setPhase(text(state.phase), Date.now());
      setRound(state.round, text(state.plan?.[state.round - 1]?.label));
      if (phase === 'done' && run?.mode === 'batch') run.complete = true;
      if (state.agents && typeof state.agents === 'object') {
        for (const [key, data] of Object.entries(state.agents)) {
          const agent = agents.get(agentId(data?.id || key));
          if (!agent) continue;
          setStatus(agent, data.status, 0, ordinal);
          if (typeof data.thought === 'string') agent.thought = data.thought;
        }
      }
      render();
    }

    function onEvent(event) {
      if (event?.type === 'state') return setState(event.state);
      if (consume(event)) render();
    }

    render();
    return { setState, onEvent, dispose: () => window.clearInterval(timer) };
  }

  let current;
  window.StudioActivity = {
    mount(options) {
      current?.dispose();
      current = mount(options);
    },
    setState(state) { current?.setState(state); },
    onEvent(event) { current?.onEvent(event); }
  };
}());
