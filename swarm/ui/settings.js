(() => {
  'use strict';

  const runnerLabels = { codex: 'Codex CLI (OpenAI)', pi: 'pi (pi.dev)' };
  const imageKeyFormat = /^sk-[A-Za-z0-9_\-]{20,}$/;
  const icons = {
    plus: 'M6 2v8M2 6h8',
    minus: 'M2 6h8',
    chevron: 'm3 4 3 3 3-3',
    roles: 'M8 10.5v-1A2.5 2.5 0 0 0 5.5 7h-2A2.5 2.5 0 0 0 1 9.5v1M7 3.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M10.5 10.5v-1A2.5 2.5 0 0 0 9 7.2',
    research: 'm10.5 10.5-2-2M9 5.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0',
    autopilot: 'M1 6h2l1.5-4 2 8 1.5-4H11',
    team: 'M7 10.5v-1A2.5 2.5 0 0 0 4.5 7h-1A2.5 2.5 0 0 0 1 9.5v1M6 3.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0M9.5 5v4m-2-2h4',
    images: 'M1.5 2h9v8h-9zM2 8l3-3 2 2 1-1 2 2',
    advanced: 'M1 3.5h10M1 8.5h10M4 2v3M8 7v3'
  };
  let panel;
  let nextId = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const path = document.createElementNS(ns, 'path');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', icons[name]);
    svg.append(path);
    return svg;
  }

  function button(text, className, action) {
    const node = el('button', className, text);
    node.type = 'button';
    if (action) node.addEventListener('click', action);
    return node;
  }

  function live(className, role = 'status') {
    const node = el('p', className);
    node.setAttribute('role', role);
    return node;
  }

  function updateText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function groupHeading(group, label, id, level) {
    const heading = el('h' + level, 'ss-group-title', label);
    heading.id = id;
    heading.tabIndex = -1;
    group.setAttribute('aria-labelledby', id);
    group.append(heading);
    return heading;
  }

  function createTeamEditor(id, team, choices, headingLevel, isOpen, onDirty) {
    const limits = { name: 40, title: 60, lane: 400 };
    const placeholders = { name: 'e.g. Alex', title: 'e.g. Hero Designer', section: 'e.g. hero',
      lane: 'Describe what this worker owns.' };
    const sectionPattern = '[a-z][a-z0-9\\-]{1,24}';
    const sectionFormat = new RegExp('^' + sectionPattern + '$');
    const maxWorkers = 16;
    const palette = ['#f76b15', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24',
      '#22d3ee', '#fb7185', '#a3e635', '#818cf8', '#2dd4bf', '#e879f9'];
    const busyText = 'The team is working: changes can be saved when it finishes';
    const section = el('section', 'ss-team');
    const intro = el('div', 'ss-team-intro');
    const introText = el('div');
    const heading = groupHeading(introText, 'Team workers', id + '-team', headingLevel);
    section.setAttribute('aria-labelledby', heading.id);
    const summary = live('ss-summary');
    const notice = live('ss-team-notice');
    const retry = button('Retry', 'ss-button', refresh);
    retry.hidden = true;
    const workspace = el('div', 'ss-worker-workspace');
    const roster = el('section', 'ss-card ss-worker-roster');
    const rosterHeading = el('h' + (headingLevel + 1), '', 'Workers');
    rosterHeading.id = id + '-roster';
    roster.setAttribute('aria-labelledby', rosterHeading.id);
    const resultCount = live('ss-help');
    const rosterHeader = el('div', 'ss-worker-roster-header');
    rosterHeader.append(rosterHeading, resultCount);
    const filters = el('div', 'ss-worker-filters');
    const search = el('input');
    search.type = 'search';
    search.placeholder = 'Search workers';
    search.setAttribute('aria-label', 'Search workers or scopes');
    const makeSelect = (label, options) => {
      const select = el('select');
      select.setAttribute('aria-label', label);
      for (const [value, name] of options) select.add(new Option(name, value));
      return select;
    };
    const runnerFilter = makeSelect('Filter by runner', [['', 'All runners'], ...choices.runner]);
    const statusLabels = { queued: 'Queued', working: 'Working', retrying: 'Retrying', waiting: 'Ready', done: 'Done', failed: 'Failed', draft: 'New', unknown: 'Unavailable' };
    const statusFilter = makeSelect('Filter by status', [['', 'All statuses'], ...Object.entries(statusLabels)]);
    filters.append(search, runnerFilter, statusFilter);
    const bulk = el('div', 'ss-worker-bulk');
    const selectionCount = el('strong');
    const bulkRunner = makeSelect('Runner for selected workers', [['', 'Default'], ...choices.runner]);
    const apply = button('Apply runner', 'ss-button', applyBulkRunner);
    const clearSelection = button('Clear', 'ss-button', () => {
      checked.clear();
      updateRoster();
      search.focus();
    });
    bulk.append(selectionCount, bulkRunner, apply, clearSelection);
    const columns = el('div', 'ss-worker-row ss-worker-columns');
    columns.setAttribute('aria-hidden', 'true');
    for (const label of ['', 'Worker / scope', 'Runner', 'Status']) columns.append(el('span', '', label));
    const rows = el('ul', 'ss-worker-rows');
    const empty = el('p', 'ss-worker-empty', 'No workers match. Clear search or change the filters.');
    roster.append(rosterHeader, filters, bulk, columns, rows, empty);
    const list = el('div', 'ss-team-list');
    const back = button('← Workers', 'ss-button ss-worker-back', closeWorker);
    workspace.append(roster, list);
    const titles = el('datalist');
    titles.id = id + '-team-titles';

    const bar = el('div', 'ss-team-bar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Team actions');
    const feedback = live('ss-feedback', 'alert');
    const actions = el('div', 'ss-actions');
    const state = live('ss-state');
    const actionButtons = el('div', 'ss-action-buttons');
    const reset = button('Discard changes', 'ss-button ss-discard', () => {
      hideAdd();
      render('Team changes discarded.');
      heading.focus();
    });
    const timing = el('p', 'ss-help');
    const actionState = el('div', 'ss-action-state');
    actionState.append(state, timing);
    const submit = button('Save team', 'ss-button ss-primary', submitDraft);
    actionButtons.append(reset, submit);
    actions.append(actionState, actionButtons);
    bar.append(feedback, actions);

    const addForm = el('form');
    addForm.noValidate = true;
    const addFields = el('fieldset', 'ss-card ss-team-fields');
    const addHeading = el('legend', '', 'Add worker');
    addHeading.tabIndex = -1;
    const addName = textField('Name', 'name', id + '-add-name');
    const addTitle = textField('Job title', 'title', id + '-add-title');
    const addSection = textField('Section name', 'section', id + '-add-section');
    addSection.box.classList.add('ss-team-add-section');
    addSection.input.pattern = sectionPattern;
    addSection.input.autocapitalize = 'none';
    addSection.input.spellcheck = false;
    const sectionHelp = el('p', 'ss-help', 'Use 2 to 25 lowercase letters, digits or hyphens. Start with a letter.');
    sectionHelp.id = addSection.input.id + '-help';
    addSection.input.setAttribute('aria-describedby', sectionHelp.id);
    addSection.box.append(sectionHelp);
    const addLane = textField('Lane', 'lane', id + '-add-lane');
    const add = button('Add worker', 'ss-button');
    add.type = 'submit';
    const capacity = el('p', 'ss-help');
    const addActions = el('div', 'ss-team-add-actions');
    const cancelAdd = button('Cancel', 'ss-button', () => { hideAdd(); addTrigger.focus(); });
    addActions.append(add, cancelAdd, capacity);
    addFields.append(addHeading, addName.box, addTitle.box, addSection.box, addLane.box, addActions);
    addForm.append(addFields);
    const addTrigger = button('+ Add worker', 'ss-button', () => {
      addForm.hidden = false;
      addTrigger.setAttribute('aria-expanded', 'true');
      addName.input.focus();
    });
    addForm.id = id + '-add-worker';
    addTrigger.setAttribute('aria-controls', addForm.id);
    addTrigger.setAttribute('aria-expanded', 'false');
    introText.append(summary);
    intro.append(introText, addTrigger);
    const jumpToActions = el('a', 'ss-team-action-link', 'Go to team actions');
    submit.id = id + '-team-save';
    jumpToActions.href = '#' + submit.id;
    jumpToActions.addEventListener('click', event => {
      event.preventDefault();
      if (!submit.disabled) submit.focus();
      else if (!reset.disabled) reset.focus();
      else bar.focus();
    });
    bar.tabIndex = -1;
    section.append(intro, notice, retry, addForm, workspace, titles, jumpToActions);
    bar.hidden = workspace.hidden = addForm.hidden = addTrigger.hidden = jumpToActions.hidden = true;
    for (const filter of [search, runnerFilter, statusFilter]) filter.addEventListener('input', updateRoster);

    let saved;
    let draft = [];
    let cards = [];
    let activeId;
    let defaults = {};
    let statuses = {};
    const checked = new Set();
    let maxParallel;
    let busy = false;
    let saving = false;
    let loading;
    let busyTimer;

    addForm.addEventListener('input', () => update());
    addForm.addEventListener('submit', event => {
      event.preventDefault();
      if (add.disabled) return;
      const id = nextWorkerId();
      const usedColors = new Set(draft.map(agent => agent.color));
      const color = palette.find(value => !usedColors.has(value)) ?? palette[draft.length % palette.length];
      appendWorker({ id, name: addName.input.value.trim(), title: addTitle.input.value.trim(),
        section: addSection.input.value, lane: addLane.input.value.trim(), color });
      hideAdd();
      clearErrors();
      update();
      selectWorker(id, { edit: true });
    });

    function hideAdd() {
      addForm.hidden = true;
      addTrigger.setAttribute('aria-expanded', 'false');
      if (saved) resetAdd();
    }

    function workerStatus(agent) {
      if (!saved?.some(worker => worker.id === agent.id)) return 'draft';
      const key = String(statuses[agent.id] ?? '').split(' ')[0];
      return Object.hasOwn(statusLabels, key) ? key : 'unknown';
    }

    function setStatus(node, agent) {
      const key = workerStatus(agent);
      node.dataset.status = key;
      updateText(node, statusLabels[key]);
      node.title = statuses[agent.id] || statusLabels[key];
    }

    function runnerName(key) {
      return choices.runner.find(([value]) => value === key)?.[1];
    }

    function workerTitle(agent) {
      return agent.title?.trim() || agent.name?.trim() || 'Worker ' + agent.id;
    }

    function showSelection() {
      for (const { card, agent, title, scope, status, effective, badge } of cards) {
        card.hidden = agent.id !== activeId;
        if (card.hidden) continue;
        if (back.parentElement !== card) card.prepend(back);
        updateText(title, workerTitle(agent));
        updateText(scope, agent.id + ' · ' + agent.section);
        setStatus(status, agent);
        const original = saved?.find(worker => worker.id === agent.id);
        badge.hidden = Boolean(original);
        const current = { ...defaults, ...original };
        updateText(effective, original
          ? [runnerName(current.runner), choices.model.find(([value]) => value === current.model)?.[1] ?? current.model,
              choices.effort.find(([value]) => value === current.effort)?.[1] ?? current.effort].filter(Boolean).join(' · ') || 'Unavailable'
          : 'This worker becomes available after saving.');
      }
    }

    function selectWorker(workerId, { edit = false } = {}) {
      activeId = workerId;
      if (edit) workspace.dataset.editing = 'true';
      updateRoster();
      showSelection();
      if (edit) cards.find(({ agent }) => agent.id === activeId)?.fields.name.input.focus();
    }

    function closeWorker() {
      delete workspace.dataset.editing;
      const trigger = Array.from(rows.querySelectorAll('button')).find(node => node.dataset.worker === activeId);
      (trigger ?? search).focus();
    }

    list.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented && back.getClientRects().length) {
        event.preventDefault();
        closeWorker();
      }
    });

    function updateBulk() {
      bulk.hidden = checked.size === 0;
      updateText(selectionCount, checked.size + ' selected');
      apply.disabled = saving;
      clearSelection.disabled = saving;
    }

    function updateRoster() {
      const query = search.value.trim().toLowerCase();
      const visible = cards.filter(({ agent }) =>
        [agent.id, agent.name, agent.title, agent.section].some(value => value?.toLowerCase().includes(query))
        && (!runnerFilter.value || (agent.runner || defaults.runner) === runnerFilter.value)
        && (!statusFilter.value || workerStatus(agent) === statusFilter.value));
      const focus = rows.contains(document.activeElement) ? document.activeElement : null;
      const focusId = focus?.dataset.worker;
      const focusType = focus?.tagName;
      const fragment = document.createDocumentFragment();
      let restore;
      for (const { agent, fields } of visible) {
        const row = el('li', 'ss-worker-row');
        const check = el('input');
        check.type = 'checkbox';
        check.dataset.worker = agent.id;
        check.checked = checked.has(agent.id);
        check.setAttribute('aria-label', 'Select ' + workerTitle(agent));
        check.addEventListener('change', () => {
          if (check.checked) checked.add(agent.id);
          else checked.delete(agent.id);
          updateBulk();
        });
        const label = el('label', 'ss-worker-check');
        label.append(check);
        const open = button('', 'ss-worker-open', () => selectWorker(agent.id, { edit: true }));
        open.dataset.worker = agent.id;
        open.setAttribute('aria-label', 'Edit ' + workerTitle(agent) + ', worker ' + agent.id);
        if (agent.id === activeId) {
          row.dataset.selected = 'true';
          open.setAttribute('aria-current', 'true');
        }
        const scope = el('span', 'ss-worker-scope', agent.id + ' · ' + agent.section);
        const title = el('strong', '', workerTitle(agent));
        title.title = title.textContent;
        open.append(title, scope);
        if (Object.values(fields).some(field => !field.error.hidden)) {
          scope.append(' · Review fields');
        }
        const runner = runnerName(agent.runner || defaults.runner);
        const runnerText = el('span', 'ss-worker-runner', runner ? runner + (agent.runner ? '' : ' · default') : 'Default');
        const status = el('span', 'ss-worker-status');
        setStatus(status, agent);
        row.append(label, open, runnerText, status);
        if (agent.id === focusId) restore = focusType === 'INPUT' ? check : open;
        fragment.append(row);
      }
      rows.replaceChildren(fragment);
      if (focus) (restore ?? search).focus({ preventScroll: true });
      empty.hidden = visible.length > 0;
      updateText(resultCount, visible.length + ' of ' + draft.length);
      updateBulk();
    }

    function applyBulkRunner() {
      for (const { agent, fields, syncOverrides } of cards) {
        if (!checked.has(agent.id)) continue;
        setRunner(agent, fields, bulkRunner.value);
        syncOverrides();
      }
      checked.clear();
      updateText(feedback, '');
      update();
      search.focus();
    }

    function setRunner(agent, fields, runner) {
      fields.runner.input.value = runner;
      fieldError(fields.runner);
      if (runner) {
        agent.runner = runner;
        return;
      }
      delete agent.runner;
      for (const key of ['model', 'effort']) {
        delete agent[key];
        fields[key].input.value = '';
        fieldError(fields[key]);
      }
    }

    function textField(label, key, fieldId) {
      const input = el(key === 'lane' ? 'textarea' : 'input');
      input.id = fieldId;
      input.required = true;
      input.maxLength = limits[key] ?? 25;
      input.placeholder = placeholders[key];
      if (key === 'title') input.setAttribute('list', titles.id);
      const box = labeledField(label, input);
      if (key === 'lane') {
        input.rows = 2;
        const counter = el('p', 'ss-counter');
        counter.id = fieldId + '-count';
        input.setAttribute('aria-describedby', counter.id);
        const count = () => updateText(counter, input.value.length + ' / ' + limits.lane);
        const surface = el('div', 'ss-team-textarea');
        const footer = el('div', 'ss-field-footer');
        footer.append(counter);
        input.before(surface);
        surface.append(input, footer);
        input.addEventListener('input', count);
        return { box, input, count };
      }
      return { box, input };
    }

    function labeledField(label, input) {
      const box = el('div', 'ss-field');
      const caption = el('label', '', label);
      caption.htmlFor = input.id;
      box.append(caption, input);
      return box;
    }

    function fieldError(field, message = '') {
      field.error.hidden = !message;
      updateText(field.error, message);
      if (message) field.input.setAttribute('aria-invalid', 'true');
      else field.input.removeAttribute('aria-invalid');
    }

    function trackField({ box, input }) {
      const error = el('p', 'ss-error');
      error.id = input.id + '-error';
      error.hidden = true;
      const description = [input.getAttribute('aria-describedby'), error.id].filter(Boolean);
      input.setAttribute('aria-describedby', description.join(' '));
      box.append(error);
      return { input, error };
    }

    function appendWorker(agent) {
      const card = el('article', 'ss-card ss-team-worker');
      const prefix = id + '-worker-' + agent.id;
      const identity = el('div', 'ss-team-identity');
      const title = el('h' + (headingLevel + 1), 'ss-worker-title', workerTitle(agent));
      const scope = el('p', 'ss-worker-editor-scope', agent.id + ' · ' + agent.section);
      const status = el('span', 'ss-worker-status');
      const effective = el('p', 'ss-help');
      const config = el('div', 'ss-worker-effective');
      config.append(el('strong', '', 'Effective configuration'), effective);
      const sectionName = el('input');
      sectionName.readOnly = saved.some(worker => worker.id === agent.id);
      sectionName.value = agent.section;
      sectionName.maxLength = 25;
      sectionName.autocapitalize = 'none';
      sectionName.spellcheck = false;
      sectionName.id = prefix + '-section';
      title.id = prefix + '-title';
      card.setAttribute('aria-labelledby', title.id);
      const badge = el('span', 'ss-team-new', 'new, not saved');
      badge.hidden = saved.some(worker => worker.id === agent.id);
      const confirm = el('div', 'ss-team-confirm');
      confirm.hidden = true;
      const question = el('p');
      question.id = prefix + '-remove-question';
      const remove = button('Remove worker', 'ss-button ss-team-remove', () => {
        updateText(question, 'Remove ' + (agent.name?.trim() || 'Agent ' + Number(agent.id)) +
          '? Its section moves to retired/, nothing is deleted.');
        confirm.hidden = false;
        remove.setAttribute('aria-expanded', 'true');
        cancel.focus();
      });
      remove.title = 'Remove worker ' + agent.id;
      remove.setAttribute('aria-label', remove.title);
      remove.setAttribute('aria-expanded', 'false');
      confirm.id = prefix + '-confirm';
      remove.setAttribute('aria-controls', confirm.id);
      const cancel = button('Cancel', 'ss-button', () => {
        confirm.hidden = true;
        remove.setAttribute('aria-expanded', 'false');
        remove.focus();
      });
      const proceed = button('Confirm removal', 'ss-button', () => {
        const index = draft.indexOf(agent);
        draft.splice(index, 1);
        cards.splice(index, 1);
        card.remove();
        checked.delete(agent.id);
        activeId = (draft[index] ?? draft[index - 1])?.id;
        updateDefaultName();
        clearErrors();
        update();
        closeWorker();
        if (!draft.length) addTrigger.focus();
      });
      const confirmActions = el('div', 'ss-action-buttons');
      for (const choice of [cancel, proceed]) choice.setAttribute('aria-describedby', question.id);
      confirmActions.append(cancel, proceed);
      confirm.append(question, confirmActions);
      confirm.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancel.click();
        }
      });
      const body = el('div', 'ss-team-fields');
      const overrides = el('div', 'ss-team-overrides');
      const sectionBox = labeledField('Assigned scope', sectionName);
      const fields = { section: trackField({ box: sectionBox, input: sectionName }) };
      sectionName.addEventListener('input', () => {
        agent.section = sectionName.value;
        edited('section');
      });
      const boxes = {};
      for (const [key, label] of [['name', 'Display name'], ['title', 'Role / job title'], ['lane', 'Lane']]) {
        const field = textField(label, key, prefix + '-' + key);
        field.input.value = agent[key];
        field.count?.();
        field.input.addEventListener('input', () => {
          agent[key] = field.input.value;
          edited(key);
        });
        fields[key] = trackField(field);
        boxes[key] = field.box;
      }
      for (const [key, label] of [['runner', 'Runner'], ['model', 'Model'], ['effort', 'Reasoning effort']]) {
        const input = el('select');
        input.id = prefix + '-' + key;
        input.add(new Option('Default', ''));
        for (const [value, name] of choices[key]) input.add(new Option(name, value));
        input.value = agent[key] ?? '';
        const box = labeledField(label, input);
        fields[key] = trackField({ box, input });
        input.addEventListener('change', () => {
          if (key === 'runner') setRunner(agent, fields, input.value);
          else if (input.value) agent[key] = input.value;
          else delete agent[key];
          edited(key);
        });
        boxes[key] = box;
      }
      boxes.lane.classList.add('ss-team-lane');
      const metadata = el('div');
      metadata.append(title, scope);
      identity.append(metadata, status);
      overrides.append(boxes.model, boxes.effort);
      body.append(boxes.name, boxes.title, boxes.runner, overrides, sectionBox, boxes.lane);
      card.append(identity, badge, body, config, remove, confirm);
      list.append(card);
      draft.push(agent);
      const syncOverrides = () => {
        for (const key of ['model', 'effort']) {
          fields[key].input.disabled = !agent.runner && fields[key].error.hidden;
        }
      };
      cards.push({ card, agent, title, scope, status, effective, badge, fields, syncOverrides });
      syncOverrides();

      function edited(key) {
        fieldError(fields[key]);
        syncOverrides();
        if (feedback.textContent) updateText(feedback, '');
        update();
      }
    }

    function nextWorkerId() {
      // A persisted id still owns its section until the removal is saved.
      const number = Math.max(0, ...[...saved, ...draft].map(agent => Number(agent.id))) + 1;
      return number <= 99 ? String(number).padStart(2, '0') : '';
    }

    function updateDefaultName() {
      const next = nextWorkerId();
      const name = next ? 'Agent ' + Number(next) : '';
      if (addName.input.value === addName.input.defaultValue) addName.input.value = name;
      addName.input.defaultValue = name;
    }

    function resetAdd() {
      addForm.reset();
      updateDefaultName();
      addLane.count();
    }

    function isDirty() {
      return saved.length !== draft.length || saved.some((agent, index) => {
        const edited = draft[index];
        const fields = Object.keys(agent);
        return fields.length !== Object.keys(edited).length || fields.some(key => agent[key] !== edited[key]);
      });
    }

    function validText(value, key) {
      return typeof value === 'string' && value.trim() !== 'undefined' &&
        value.trim().length > 0 && value.length <= limits[key];
    }

    function validSection(value) {
      return value !== 'undefined' && sectionFormat.test(value);
    }

    function normalizeWorker(agent) {
      const normalized = Object.fromEntries(Object.entries(agent).filter(([, value]) => value !== undefined));
      for (const key of ['name', 'title', 'section', 'lane']) {
        const value = normalized[key];
        if (typeof value !== 'string' || value.trim() === 'undefined') normalized[key] = '';
      }
      return normalized;
    }

    function update(message = '') {
      if (!saved) return;
      const dirty = isDirty();
      const full = draft.length >= maxWorkers;
      const next = nextWorkerId();
      const validAdd = validText(addName.input.value, 'name') && validText(addTitle.input.value, 'title') &&
        validSection(addSection.input.value) && validText(addLane.input.value, 'lane');
      const count = draft.length;
      updateText(summary, count + ' configured · Up to ' + maxParallel + ' run in parallel');
      const pending = draft.filter(agent => {
        const before = saved.find(item => item.id === agent.id);
        return !before || Object.keys(agent).length !== Object.keys(before).length ||
          Object.keys(agent).some(key => agent[key] !== before[key]);
      }).length + saved.filter(agent => !draft.some(item => item.id === agent.id)).length;
      bar.toggleAttribute('data-pending', dirty);
      onDirty(dirty);
      updateText(state, saving ? 'Saving team…' : pending ?
        pending + (pending === 1 ? ' worker' : ' workers') + ' with unsaved changes' :
        message || 'All changes saved');
      updateText(timing, busy ? 'Save is available when the team finishes.' : dirty ?
        'Save to apply from the next agent turn.' : 'Changes apply from the next agent turn.');
      updateText(capacity, full ? 'Maximum of 16 workers reached.' : next ? '' : 'No worker IDs remain above the current maximum.');
      add.disabled = !validAdd || full || !next || saving;
      reset.disabled = saving || (!dirty && ![addName, addTitle, addSection, addLane]
        .some(({ input }) => input.value !== input.defaultValue));
      addTrigger.disabled = full || !next || saving;
      submit.disabled = busy || saving || !dirty;
      updateRoster();
      showSelection();
    }

    function clearErrors() {
      updateText(feedback, '');
      for (const { fields, syncOverrides } of cards) {
        for (const field of Object.values(fields)) fieldError(field);
        syncOverrides();
      }
    }

    function renderErrors(errors) {
      const messages = new Map();
      const general = [];
      for (const { path, message } of errors) {
        const match = /^agents\[(\d+)\](?:\.(\w+))?$/.exec(path);
        const card = match && cards[Number(match[1])];
        const field = card && (card.fields[match[2]] ?? card.fields.section);
        if (field) messages.set(field, [...(messages.get(field) ?? []), message]);
        else general.push(message);
      }
      for (const [field, errors] of messages) fieldError(field, errors.join(' '));
      for (const { syncOverrides } of cards) syncOverrides();
      updateText(feedback, general.join(' ') || 'Review the highlighted team fields.');
      const first = messages.keys().next().value;
      if (first) {
        const owner = cards.find(({ fields }) => Object.values(fields).includes(first));
        if (owner) selectWorker(owner.agent.id);
        workspace.dataset.editing = 'true';
        first.input.focus();
        first.error.scrollIntoView({ block: 'nearest' });
      } else {
        heading.focus();
      }
    }

    function render(message, preserveAdd = false) {
      list.replaceChildren();
      draft = [];
      cards = [];
      for (const agent of saved) appendWorker({ ...agent });
      if (!draft.some(agent => agent.id === activeId)) activeId = draft[0]?.id;
      for (const workerId of checked) if (!draft.some(agent => agent.id === workerId)) checked.delete(workerId);
      if (!preserveAdd) { addForm.reset(); checked.clear(); }
      updateDefaultName();
      addLane.count();
      updateText(feedback, '');
      update(message);
    }

    async function submitDraft() {
      if (submit.disabled) return;
      clearErrors();
      const errors = [];
      draft.forEach((agent, index) => {
        for (const [key, limit] of Object.entries(limits)) {
          if (!validText(agent[key], key)) {
            errors.push({ path: `agents[${index}].${key}`, message: 'Enter 1 to ' + limit + ' characters.' });
          }
        }
        if (!validSection(agent.section)) {
          errors.push({ path: `agents[${index}].section`, message: 'Use 2 to 25 lowercase letters, digits or hyphens. Start with a letter.' });
        }
      });
      if (errors.length) return renderErrors(errors);

      saving = true;
      addFields.disabled = true;
      list.inert = true;
      update();
      let result;
      try {
        result = await team.save(structuredClone(draft));
      } catch {
        result = { ok: false };
      } finally {
        saving = false;
        list.inert = false;
        addFields.disabled = false;
      }
      if (result?.ok) {
        saved = (result.agents ?? draft).map(normalizeWorker);
        render('Team saved.', true);
        heading.focus();
      } else if (result?.busy || result?.error === 'busy') {
        setBusy(true);
      } else {
        update();
        renderErrors(result?.errors?.length ? result.errors : [{ message: 'Could not save team. Try again.' }]);
        // A save adapter may expose only the error messages from a busy response.
        if (!result?.errors?.some(({ path }) => path?.startsWith('agents'))) refresh();
      }
    }

    function stopPolling() {
      clearTimeout(busyTimer);
    }

    function setBusy(value) {
      busy = value;
      updateText(notice, busy ? busyText : '');
      stopPolling();
      if (busy && isOpen()) busyTimer = setTimeout(refresh, 2500);
      update();
    }

    function refresh() {
      if (loading || saving) return loading;
      retry.hidden = true;
      if (!saved) updateText(notice, 'Loading team…');
      const baseline = saved;
      const previousMaxParallel = maxParallel;
      loading = Promise.resolve().then(() => team.load()).then(data => {
        if (saved !== baseline || saving) return;
        if (maxParallel === previousMaxParallel) maxParallel = data.maxParallel;
        if (data.statuses) statuses = data.statuses;
        const offeredTitles = data.titles ?? [];
        if (titles.children.length !== offeredTitles.length ||
            offeredTitles.some((title, index) => titles.children[index].value !== title)) {
          titles.replaceChildren(...offeredTitles.map(title => new Option(title, title)));
        }
        if (!saved || !isDirty()) {
          saved = data.agents.map(normalizeWorker);
          if (!baseline || isDirty()) render('', true);
        }
        bar.hidden = workspace.hidden = addTrigger.hidden = jumpToActions.hidden = false;
        setBusy(Boolean(data.busy));
      }).catch(() => {
        setBusyAfterLoadFailure();
      }).finally(() => {
        loading = undefined;
      });
      return loading;
    }

    function setBusyAfterLoadFailure() {
      updateText(notice, busy ? busyText + '. Could not check team status.' : 'Could not load team.');
      retry.hidden = false;
      stopPolling();
      if (busy && isOpen()) busyTimer = setTimeout(refresh, 2500);
    }

    return {
      section,
      heading,
      bar,
      refresh,
      stopPolling,
      showRoster() { delete workspace.dataset.editing; },
      setDefaults(value) {
        defaults = value;
        if (saved) update();
      },
      setWorkerStatus(workerId, status) {
        if (statuses[workerId] === status) return;
        statuses = { ...statuses, [workerId]: status };
        if (saved && draft.some(agent => agent.id === workerId)) {
          updateRoster();
          showSelection();
        }
      },
      setMaxParallel(value) {
        maxParallel = value;
        if (saved) update();
      }
    };
  }

  function createImageKeyBlock(id, images) {
    const block = el('fieldset', 'ss-card ss-image-key');
    block.hidden = true;
    const legend = el('legend', '', 'OpenAI API key');
    const input = el('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.id = id + '-image-key';
    const label = el('label', '', 'Enter API key');
    label.htmlFor = input.id;
    const help = el('p', 'ss-help', 'The key is stored only on this computer in a private file, never shown again, never sent to agents or the channel. Images are generated by OpenAI and billed to your OpenAI account.');
    help.id = input.id + '-help';
    const status = live('ss-image-key-status');
    const feedback = live('ss-image-key-feedback');
    feedback.id = input.id + '-feedback';
    input.setAttribute('aria-describedby', help.id + ' ' + feedback.id);

    const actions = el('div', 'ss-image-key-actions');
    const save = button('Save key', 'ss-button', saveKey);
    const remove = button('Remove key', 'ss-button', removeKey);
    const test = button('Test key', 'ss-button', testKey);
    actions.append(save, remove, test);
    const field = el('div', 'ss-field');
    field.append(label, input);
    block.append(legend, status, field, actions, feedback, help);

    let keyStatus;
    let pending;

    function showFeedback(message = '', error = false) {
      feedback.toggleAttribute('data-error', error);
      updateText(feedback, message.replace(/sk-[A-Za-z0-9_\-]{20,}/g, '[redacted]'));
    }

    function setStatus(result) {
      const last4 = typeof result.last4 === 'string' && /^[A-Za-z0-9_\-]{4}$/.test(result.last4) ? result.last4 : '';
      keyStatus = { set: result.set === true, last4 };
    }

    function paint() {
      let text = keyStatus?.set ? 'Key saved' : 'No key saved';
      if (keyStatus?.set && keyStatus.last4) text += ' (ends in ' + keyStatus.last4 + ')';
      if (!keyStatus && !pending) text = 'Key status unavailable';
      updateText(status, pending || text);
      input.readOnly = Boolean(pending);
      for (const action of actions.children) action.setAttribute('aria-disabled', String(Boolean(pending)));
      remove.disabled = test.disabled = !keyStatus?.set;
    }

    async function run(progress, failure, action) {
      pending = progress;
      showFeedback();
      paint();
      try {
        await action();
      } catch {
        showFeedback(failure, true);
      } finally {
        pending = undefined;
        paint();
      }
    }

    function refresh() {
      if (block.hidden || pending) return;
      return run('Checking key status…', 'Could not load key status.', async () => {
        setStatus(await images.loadKey());
      });
    }

    function saveKey() {
      if (pending) return;
      const key = input.value;
      if (!imageKeyFormat.test(key)) {
        input.setAttribute('aria-invalid', 'true');
        showFeedback('Enter an OpenAI API key starting with sk- and followed by at least 20 valid characters.', true);
        input.focus();
        return;
      }
      clearInput();
      return run('Saving key…', 'Could not save the key.', async () => {
        const result = await images.saveKey(key);
        if (result?.ok) setStatus({ set: true, last4: result.last4 ?? key.slice(-4) });
        else showFeedback(typeof result?.error === 'string' && result.error || 'Could not save the key.', true);
      });
    }

    function removeKey() {
      if (pending || !keyStatus?.set) return;
      clearInput();
      return run('Removing key…', 'Could not remove the key.', async () => {
        if ((await images.removeKey())?.ok) {
          setStatus({ set: false });
          if (document.activeElement === remove) input.focus();
        } else showFeedback('Could not remove the key.', true);
      });
    }

    function testKey() {
      if (pending || !keyStatus?.set) return;
      return run('Testing key…', 'Could not test the key.', async () => {
        const result = await images.testKey();
        const message = typeof result?.message === 'string' && result.message;
        showFeedback(message || (result?.ok ? 'The saved key passed the test.' : 'The saved key failed the test.'), !result?.ok);
      });
    }

    function clearInput() {
      input.value = '';
      input.removeAttribute('aria-invalid');
    }

    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      showFeedback();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveKey();
      }
    });

    return {
      block, refresh, clearInput,
      setVisible(visible) {
        if (visible === !block.hidden) return;
        block.hidden = !visible;
        clearInput();
        showFeedback();
        if (visible) return refresh();
      }
    };
  }

  function createPanel({ root, load, save, test, team, images }) {
    const id = 'swarm-settings-' + ++nextId;
    const section = el('section', 'swarm-settings');
    section.hidden = true;
    const title = el('h2', '', 'Settings');
    title.id = id + '-title';
    const dialog = root.closest('dialog, [role="dialog"]');
    const dialogLabel = dialog?.getAttribute('aria-label') ||
      document.getElementById(dialog?.getAttribute('aria-labelledby'))?.textContent;
    title.hidden = dialogLabel?.trim() === title.textContent;
    const headingLevel = title.hidden ? 2 : 3;
    section.setAttribute('aria-labelledby', title.id);
    const header = el('div', 'ss-header');
    const summary = live('ss-summary');
    const nav = el('nav', 'ss-nav');
    nav.setAttribute('aria-label', 'Settings sections');
    nav.hidden = true;
    header.append(title, nav);

    const shell = el('div', 'ss-form');
    const body = el('div', 'ss-body');
    const notice = live('ss-notice');
    const retry = button('Retry', 'ss-button', () => refresh());
    retry.hidden = true;
    const controls = el('div', 'ss-controls');
    controls.hidden = true;

    const rolesGroup = el('section', 'ss-group');
    const rolesHeading = groupHeading(rolesGroup, 'Roles', id + '-roles', headingLevel);
    rolesGroup.append(summary);
    const basic = el('fieldset', 'ss-controls ss-defaults');
    rolesGroup.append(basic);
    const researchGroup = el('section', 'ss-group');
    const researchHeading = groupHeading(researchGroup, 'Research', id + '-research', headingLevel);
    researchGroup.append(el('p', 'ss-summary', 'Control whether agents can search the web.'));
    const researchInputs = el('fieldset', 'ss-card');
    researchGroup.append(researchInputs);
    const autopilotGroup = el('section', 'ss-group');
    const autopilotHeading = groupHeading(autopilotGroup, 'Autopilot', id + '-autopilot', headingLevel);
    autopilotGroup.append(el('p', 'ss-summary', 'Set how many rounds Swarm runs on the visible section.'));
    const autopilotInputs = el('fieldset', 'ss-card ss-autopilot');
    autopilotInputs.append(el('legend', '', 'Cycles per screen'));
    autopilotGroup.append(autopilotInputs);
    const imagesGroup = el('section', 'ss-group');
    const imagesHeading = groupHeading(imagesGroup, 'Image generation', id + '-images', headingLevel);
    const imagesInputs = el('fieldset', 'ss-card ss-images-controls');
    imagesGroup.append(imagesInputs);
    const imageKey = images ? createImageKeyBlock(id, images) : undefined;
    if (imageKey) imagesGroup.append(imageKey.block);
    const advancedGroup = el('section', 'ss-group');
    const advancedHeading = groupHeading(advancedGroup, 'Advanced', id + '-advanced', headingLevel);
    const more = el('fieldset', 'ss-controls');
    advancedGroup.append(more);
    controls.append(rolesGroup, researchGroup, autopilotGroup, imagesGroup, advancedGroup);
    body.append(notice, retry, controls);

    const dock = el('div', 'ss-dock');
    const footer = el('form', 'ss-footer');
    footer.id = id + '-form';
    footer.noValidate = true;
    footer.hidden = true;
    const feedback = live('ss-feedback', 'alert');
    const errorSections = el('div', 'ss-error-sections');
    const timing = el('p', 'ss-help', 'Changes apply from the next agent turn.');
    const actions = el('div', 'ss-actions');
    const state = live('ss-state');
    const actionState = el('div', 'ss-action-state');
    actionState.append(state, timing);
    const actionButtons = el('div', 'ss-action-buttons');
    const reset = button('Discard changes', 'ss-button ss-discard', resetDraft);
    const submit = button('Save settings', 'ss-button ss-primary');
    submit.type = 'submit';
    actionButtons.append(reset, submit);
    actions.append(actionState, actionButtons);
    footer.append(feedback, errorSections, actions);
    dock.append(footer);
    shell.append(body, dock);
    const layout = el('div', 'ss-layout');
    layout.append(header, shell);
    section.append(layout);
    root.replaceChildren(section);

    const fields = new Map();
    const runnerCards = new Map();
    const pendingTests = new Set();
    const shortcuts = [];
    let currentSection;
    const settingsGroups = [basic, researchInputs, autopilotInputs, imagesInputs, more];
    let saved;
    let dirty = false;
    let saving = false;
    let loading;
    let status = {};
    let modelLabels;
    let advanced;
    let counter;
    let teamEditor;

    for (const group of settingsGroups) {
      group.addEventListener('input', () => {
        renderErrors([]);
        updateDraft();
      });
    }
    footer.addEventListener('submit', submitDraft);
    function addShortcut(label, heading, group, glyph) {
      const link = button('', 'ss-nav-button', () => showSection(heading, true));
      link.append(icon(glyph), el('span', '', label));
      link.setAttribute('aria-controls', group.id || heading.id + '-panel');
      if (!group.id) group.id = heading.id + '-panel';
      shortcuts.push({ link, heading, group });
      nav.append(link);
      return link;
    }

    function showSection(heading, focus = false) {
      const next = shortcuts.find(item => item.heading === heading);
      if (!next || (currentSection === next && !focus)) return;
      const changed = next !== currentSection;
      currentSection = next;
      for (const item of shortcuts) {
        item.group.hidden = item !== next;
        if (item === next) item.link.setAttribute('aria-current', 'page');
        else item.link.removeAttribute('aria-current');
      }
      const isTeam = next.heading === teamEditor?.heading;
      if (isTeam && (changed || focus)) teamEditor.showRoster();
      dock.dataset.section = isTeam ? 'team' : 'settings';
      if (changed || focus) body.scrollTop = 0;
      if (focus) next.heading.focus({ preventScroll: true });
    }

    function field(container, path, inputs, read, write, help = '') {
      const message = el('p', 'ss-error');
      message.id = id + '-' + path + '-error';
      message.hidden = true;
      container.append(message);
      fields.set(path, { inputs, read, write, message });
      const description = [help, message.id].filter(Boolean).join(' ');
      for (const input of inputs) {
        input.setAttribute('aria-describedby', description);
        input.setAttribute('form', footer.id);
      }
    }

    function helpText(container, path, text) {
      const help = el('p', 'ss-help', text);
      help.id = id + '-' + path + '-help';
      container.append(help);
      return help.id;
    }

    function radioGroup(parent, path, label, options, help, className, withTest = false) {
      const group = el('fieldset', 'ss-card');
      group.append(el('legend', '', label));
      const choices = el('div', className);
      const inputs = [];
      for (const [value, name] of options) {
        const choice = el('div', 'ss-choice');
        const radioLabel = el('label', 'ss-radio-label');
        const input = el('input');
        input.type = 'radio';
        input.name = id + '-' + path;
        input.value = value;
        inputs.push(input);
        radioLabel.append(input, el('span', '', name));
        choice.append(radioLabel);
        if (withTest) {
          const testButton = button('Test', 'ss-button', () => testRunner(value));
          testButton.setAttribute('aria-label', 'Test ' + name);
          const result = live('ss-readiness');
          const dot = el('span', 'ss-status-dot');
          dot.setAttribute('aria-hidden', 'true');
          const detail = el('span');
          result.append(dot, detail);
          choice.append(testButton, result);
          runnerCards.set(value, { testButton, result, detail });
        }
        choices.append(choice);
      }
      group.append(choices);
      const description = helpText(group, path, help);
      field(group, path, inputs, () => inputs.find(input => input.checked)?.value, value => {
        for (const input of inputs) input.checked = input.value === value;
      }, description);
      parent.append(group);
    }

    function selectField(parent, path, label, options, help, optional = true) {
      const box = el('div', 'ss-field');
      const select = el('select');
      select.id = id + '-' + path;
      const caption = el('label', '', label);
      caption.htmlFor = select.id;
      if (optional) select.add(new Option('Same as default', ''));
      for (const [value, name] of options) select.add(new Option(name, value));
      box.append(caption, select);
      field(box, path, [select], () => select.value || undefined, value => {
        select.value = value ?? '';
      }, help);
      parent.append(box);
    }

    function stepper(parent, path, label, min, max, { descriptionId, description }) {
      const box = el('div', 'ss-field');
      const caption = el('label', '', label);
      const row = el('div', 'ss-stepper');
      const input = el('input');
      input.id = id + '-' + path;
      input.type = 'number';
      input.inputMode = 'numeric';
      input.min = min;
      input.max = max;
      input.step = 1;
      input.required = true;
      caption.htmlFor = input.id;
      function step(direction) {
        const current = input.valueAsNumber;
        const next = Number.isFinite(current) ? Math.trunc(current) + direction : min;
        input.value = Math.max(min, Math.min(max, next));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const decrease = button('', 'ss-button', () => step(-1));
      decrease.setAttribute('aria-label', 'Decrease ' + label.toLowerCase());
      decrease.append(icon('minus'));
      const increase = button('', 'ss-button', () => step(1));
      increase.setAttribute('aria-label', 'Increase ' + label.toLowerCase());
      increase.append(icon('plus'));
      row.append(decrease, input, increase);
      box.append(caption, row);
      const help = description ? helpText(box, path, description) : descriptionId;
      field(box, path, [input], () => input.valueAsNumber, value => {
        input.value = value;
      }, help);
      parent.append(box);
    }

    function build(allowlist, hasImages) {
      const runners = Object.keys(allowlist.runners).map(key => [key, runnerLabels[key]]);
      const models = Object.entries(allowlist.models);
      const efforts = allowlist.efforts.map(key => [key, key === 'medium' ? 'Medium' : key]);
      modelLabels = new Map(models);
      addShortcut('Roles', rolesHeading, rolesGroup, 'roles');
      addShortcut('Research', researchHeading, researchGroup, 'research');
      addShortcut('Autopilot', autopilotHeading, autopilotGroup, 'autopilot');
      radioGroup(basic, 'defaults.runner', 'Runner', runners,
        'Codex CLI limits writes to the project. For pi, the server checks which files changed after each turn.',
        'ss-runners', true);
      radioGroup(basic, 'defaults.model', 'Default model', models,
        'Used by any role that inherits the default model.', 'ss-options');
      radioGroup(basic, 'defaults.effort', 'Reasoning effort', efforts,
        'Choose how much reasoning the model can use per turn.', 'ss-options ss-segments');
      if (team) {
        let teamLink;
        teamEditor = createTeamEditor(id, team, {
          runner: runners.map(([key]) => [key, key === 'codex' ? 'Codex CLI' : 'pi']),
          model: models,
          effort: efforts
        }, headingLevel, () => section.isConnected && !section.closest('[hidden]'),
        pending => {
          if (!teamLink) return;
          teamLink.toggleAttribute('data-pending', pending);
          if (pending) teamLink.setAttribute('aria-description', 'Unsaved team changes');
          else teamLink.removeAttribute('aria-description');
        });
        imagesGroup.before(teamEditor.section);
        dock.append(teamEditor.bar);
        teamLink = addShortcut('Team', teamEditor.heading, teamEditor.section, 'team');
      }
      if (hasImages) addShortcut('Images', imagesHeading, imagesGroup, 'images');
      else imagesGroup.hidden = true;
      addShortcut('Advanced', advancedHeading, advancedGroup, 'advanced');

      if (hasImages) {
        selectField(imagesInputs, 'images.provider', 'Provider', [
          ['codex', 'Codex CLI image skill'], ['openai', 'OpenAI API']
        ], undefined, false);
        const modelField = el('div', 'ss-field');
        const imageModel = el('input');
        imageModel.type = 'text';
        imageModel.id = id + '-images.model';
        imageModel.autocapitalize = 'none';
        imageModel.spellcheck = false;
        const modelLabel = el('label', '', 'Image model');
        modelLabel.htmlFor = imageModel.id;
        modelField.append(modelLabel, imageModel);
        const modelHelp = helpText(modelField, 'images.model', 'Enter a model ID such as gpt-image-1.');
        field(modelField, 'images.model', [imageModel], () => imageModel.value, value => {
          imageModel.value = value;
        }, modelHelp);
        imagesInputs.append(modelField);
        selectField(imagesInputs, 'images.quality', 'Quality', [
          ['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']
        ], undefined, false);
        selectField(imagesInputs, 'images.size', 'Size', [
          ['auto', 'Auto'], ['1024x1024', '1024 × 1024'], ['1536x1024', '1536 × 1024'], ['1024x1536', '1024 × 1536']
        ], undefined, false);
      }

      advanced = el('details', 'ss-card ss-advanced');
      const disclosure = el('summary', '', 'Role overrides');
      disclosure.append(icon('chevron'));
      const overrides = el('div', 'ss-overrides');
      const inheritHelp = helpText(overrides, 'roles', 'Override any default for the manager, the workers or the research step. Example: workers on pi (fast), research on codex (live web search).');
      for (const [role, label] of [['manager', 'Manager'], ['workers', 'Workers'], ['research', 'Research (web search)']]) {
        const group = el('fieldset', 'ss-role');
        group.append(el('legend', '', label));
        selectField(group, 'roles.' + role + '.runner', 'Runner', runners, inheritHelp);
        selectField(group, 'roles.' + role + '.model', 'Model', models, inheritHelp);
        selectField(group, 'roles.' + role + '.effort', 'Effort', efforts, inheritHelp);
        overrides.append(group);
      }
      advanced.append(disclosure, overrides);
      more.append(advanced);

      const limits = el('fieldset', 'ss-card');
      const limitInputs = el('div', 'ss-limits');
      limits.append(el('legend', '', 'Run limits'), limitInputs);
      const limitHelp = helpText(limits, 'limits', 'Run 1 to 16 agents at once and allow 1 to 60 minutes per turn.');
      stepper(limitInputs, 'concurrency.maxParallel', 'Max parallel', 1, 16, { descriptionId: limitHelp });
      stepper(limitInputs, 'timeouts.turnMinutes', 'Timeout (min)', 1, 60, { descriptionId: limitHelp });
      more.append(limits);

      const research = el('div', 'ss-field');
      const researchLabel = el('label', 'ss-switch-label', 'Allow web research');
      const researchSwitch = el('input', 'ss-switch');
      researchSwitch.id = id + '-research.web';
      researchSwitch.type = 'checkbox';
      researchSwitch.setAttribute('role', 'switch');
      researchLabel.append(researchSwitch);
      research.append(researchLabel);
      const researchHelp = helpText(research, 'research.web',
        'Agents can search the web, for example to learn what a brand is and which colours it uses. Web pages are treated as untrusted data.');
      field(research, 'research.web', [researchSwitch], () => researchSwitch.checked, value => {
        researchSwitch.checked = value;
      }, researchHelp);
      researchInputs.append(research);
      stepper(autopilotInputs, 'autopilot.maxCyclesPerScreen', 'Autopilot cycles per screen', 1, 5, {
        description: 'How many improvement rounds the team runs on the screen you are looking at before waiting for you to scroll.'
      });

      radioGroup(more, 'channel.language', 'Channel language', [['zh-Hans', 'Mandarin'], ['en', 'English']],
        'Sets the language agents use in the channel.', 'ss-options ss-segments');

      const rules = el('fieldset', 'ss-card');
      const legend = el('legend', '', 'Standing rules');
      const input = el('textarea');
      input.id = id + '-rules';
      legend.id = id + '-rules-title';
      input.setAttribute('aria-labelledby', legend.id);
      input.maxLength = 1000;
      input.rows = 3;
      counter = el('span', 'ss-counter');
      counter.id = id + '-rules-count';
      const hint = el('div', 'ss-rules-hint');
      const rulesHelp = helpText(hint, 'channel.standingRules', 'Added to each agent prompt.');
      hint.append(counter);
      rules.append(legend, input, hint);
      field(rules, 'channel.standingRules', [input], () => input.value, value => {
        input.value = value;
      }, rulesHelp + ' ' + counter.id);
      more.append(rules);
    }

    function writeSettings(settings, message) {
      for (const [path, { write }] of fields) {
        write(path.split('.').reduce((value, key) => value[key], settings));
      }
      renderErrors([]);
      return updateDraft(message);
    }

    function readDraft() {
      const draft = structuredClone(saved);
      for (const [path, { read }] of fields) {
        const parts = path.split('.');
        const key = parts.pop();
        const target = parts.reduce((value, part) => value[part], draft);
        const value = read();
        if (value === undefined) delete target[key];
        else target[key] = value;
      }
      return draft;
    }

    function updateDraft(cleanMessage = '') {
      const draft = readDraft();
      const keyRefresh = imageKey?.setVisible(draft.images?.provider === 'openai');
      dirty = JSON.stringify(draft) !== JSON.stringify(saved);
      const { runner, model, effort } = { ...draft.defaults, ...draft.roles.workers };
      updateText(summary, 'Workers: ' + runner + ', ' + modelLabels.get(model) + ', ' + effort);
      updateText(counter, draft.channel.standingRules.length + ' / 1,000');
      teamEditor?.setDefaults({ ...saved.defaults, ...saved.roles.workers });
      footer.toggleAttribute('data-pending', dirty);
      updateText(timing, dirty ? 'Save to apply from the next agent turn.' : 'Changes apply from the next agent turn.');
      updateText(state, saving ? 'Saving settings…' : dirty ? 'Unsaved settings' : cleanMessage || 'All changes saved');
      reset.disabled = saving || !dirty;
      submit.disabled = saving || !dirty;
      return keyRefresh;
    }

    function renderErrors(errors) {
      let firstInput;
      let firstMessage;
      const destinations = new Map();
      const general = [];
      const messages = new Map();
      for (const { path, message } of errors) {
        if (fields.has(path)) {
          if (!messages.has(path)) messages.set(path, []);
          messages.get(path).push(message);
        } else {
          general.push(message);
        }
      }
      for (const [path, { inputs, message }] of fields) {
        const text = (messages.get(path) || []).join(' ');
        message.hidden = !text;
        updateText(message, text);
        for (const input of inputs) {
          if (text) input.setAttribute('aria-invalid', 'true');
          else input.removeAttribute('aria-invalid');
        }
        if (text) {
          const input = inputs.find(input => input.checked) || inputs[0];
          const destination = shortcuts.find(({ group }) => group.contains(input));
          if (destination && !destinations.has(destination)) destinations.set(destination, input);
          if (!firstInput) {
            firstInput = input;
            firstMessage = message;
          }
        }
      }
      feedback.textContent = general.join(' ') || (firstInput ? 'Review the highlighted fields.' : '');
      const focusError = input => {
        const destination = shortcuts.find(({ group }) => group.contains(input));
        if (destination) showSection(destination.heading);
        if (advanced?.contains(input)) advanced.open = true;
        input.focus();
      };
      errorSections.replaceChildren(...Array.from(destinations, ([destination, input]) =>
        button('Review ' + destination.link.textContent, 'ss-button ss-discard', () => focusError(input))));
      if (firstInput) {
        focusError(firstInput);
        firstMessage.scrollIntoView({ block: 'nearest' });
      }
    }

    function resetDraft() {
      writeSettings(saved, 'Changes reset.');
      currentSection?.heading.focus({ preventScroll: true });
    }

    async function submitDraft(event) {
      event.preventDefault();
      if (!dirty || saving) return;
      const errors = [];
      for (const [path, { inputs }] of fields) {
        const input = inputs[0];
        if (input.type === 'number' && !input.validity.valid) {
          errors.push({ path, message: 'Enter a whole number from ' + input.min + ' to ' + input.max + '.' });
        }
      }
      if (errors.length) return renderErrors(errors);

      const draft = readDraft();
      saving = true;
      notice.textContent = '';
      renderErrors([]);
      for (const group of settingsGroups) group.disabled = true;
      updateDraft();
      let result;
      try {
        result = await save(draft);
      } catch {
        result = { ok: false };
      } finally {
        saving = false;
        for (const group of settingsGroups) group.disabled = false;
      }
      if (result?.ok) {
        saved = result.settings ?? draft;
        writeSettings(saved, 'Settings saved.');
        teamEditor?.setMaxParallel(saved.concurrency.maxParallel);
        currentSection?.heading.focus({ preventScroll: true });
      } else {
        updateDraft();
        renderErrors(result?.errors?.length ? result.errors : [{ message: 'Could not save settings. Try again.' }]);
      }
    }

    function paintStatus() {
      for (const [runner, { testButton, result, detail }] of runnerCards) {
        const check = status[runner];
        const pending = pendingTests.has(runner);
        testButton.setAttribute('aria-disabled', String(pending));
        updateText(testButton, pending ? 'Testing…' : 'Test');
        result.dataset.state = pending ? 'pending' : check?.ok ? 'ready' : check ? 'failed' : 'unknown';
        let text = 'Not tested';
        if (check) {
          text = check.ok
            ? ['Ready', check.version, check.login ? 'Logged in' : ''].filter(Boolean).join(' · ')
            : [check.version || 'Unavailable', check.detail || 'Not logged in'].join(' · ');
        }
        updateText(detail, pending ? 'Checking version and login…' : text);
      }
    }

    async function testRunner(runner) {
      if (pendingTests.has(runner) || saving) return;
      const model = fields.get('defaults.model').read();
      pendingTests.add(runner);
      paintStatus();
      try {
        status[runner] = await test({ runner, model });
      } catch {
        status[runner] = { ok: false, detail: 'Could not complete the test. Try again.' };
      } finally {
        pendingTests.delete(runner);
        paintStatus();
      }
    }

    function refreshSettings() {
      if (loading) return loading;
      if (saving) return Promise.resolve();
      retry.hidden = true;
      if (!saved) notice.textContent = 'Loading settings…';
      const baseline = saved;
      loading = Promise.resolve().then(load).then(data => {
        status = data.status || {};
        if (!saved) build(data.allowlist, Boolean(data.settings.images));
        let keyRefresh;
        if (saved === baseline && !saving) {
          saved = data.settings;
          keyRefresh = dirty ? updateDraft() : writeSettings(saved);
        }
        controls.hidden = false;
        footer.hidden = false;
        nav.hidden = false;
        notice.textContent = '';
        paintStatus();
        showSection(currentSection?.heading ?? teamEditor?.heading ?? rolesHeading);
        return keyRefresh;
      }).catch(() => {
        notice.textContent = 'Could not load settings.';
        retry.hidden = false;
      }).finally(() => {
        loading = undefined;
      });
      return loading;
    }

    function refresh() {
      const editor = teamEditor;
      return Promise.all([
        refreshSettings().then(() => editor ? undefined : teamEditor?.refresh()),
        editor?.refresh(),
        imageKey?.refresh()
      ]).then(() => undefined);
    }

    return {
      open() {
        section.hidden = false;
        if (root.closest('#team-settings') && teamEditor) showSection(teamEditor.heading);
        return refresh();
      },
      close() {
        section.hidden = true;
        teamEditor?.stopPolling();
        imageKey?.clearInput();
      },
      refresh,
      refreshTeam() {
        if (!section.closest('[hidden]')) return teamEditor?.refresh();
      },
      setWorkerStatus(workerId, status) { teamEditor?.setWorkerStatus(workerId, status); }
    };
  }

  window.SwarmSettings = {
    init(options) {
      panel = createPanel(options);
      return panel.open();
    },
    open() { return panel?.open(); },
    close() { panel?.close(); },
    refresh() { return panel?.refresh(); },
    refreshTeam() { return panel?.refreshTeam(); },
    setWorkerStatus(workerId, status) { panel?.setWorkerStatus(workerId, status); }
  };
})();
