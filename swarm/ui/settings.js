(() => {
  'use strict';

  const runnerLabels = { codex: 'Codex CLI (OpenAI)', pi: 'pi (pi.dev)' };
  const icons = {
    plus: 'M6 2v8M2 6h8',
    minus: 'M2 6h8',
    chevron: 'm3 4 3 3 3-3',
    trash: 'M1.5 3h9M4 3V1.5h4V3M2.5 3l.5 7.5h6l.5-7.5M5 5v3.5M7 5v3.5'
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

  function createTeamEditor(id, team, choices, headingLevel, isOpen) {
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
    const heading = groupHeading(section, 'Team: parallel workers', id + '-team', headingLevel);
    const summary = live('ss-summary');
    const notice = live('ss-team-notice');
    const retry = button('Retry', 'ss-button', refresh);
    retry.hidden = true;
    const list = el('div', 'ss-team-list');
    const titles = el('datalist');
    titles.id = id + '-team-titles';

    const bar = el('div', 'ss-team-bar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Team actions');
    const feedback = live('ss-feedback', 'alert');
    const actions = el('div', 'ss-actions');
    const state = live('ss-state');
    const actionButtons = el('div', 'ss-action-buttons');
    const reset = button('Reset', 'ss-button', () => {
      render('Team changes reset.');
      heading.focus();
    });
    const submit = button('Save team', 'ss-button ss-primary', submitDraft);
    actionButtons.append(reset, submit);
    actions.append(state, actionButtons);
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
    addActions.append(add, capacity);
    addFields.append(addHeading, addName.box, addTitle.box, addSection.box, addLane.box, addActions);
    addForm.append(addFields);
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
    section.append(summary, notice, retry, list, addForm, titles, jumpToActions);
    bar.hidden = list.hidden = addForm.hidden = jumpToActions.hidden = true;

    let saved;
    let draft = [];
    let cards = [];
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
      resetAdd();
      clearErrors();
      update();
      cards.at(-1).fields.name.input.focus();
    });

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
      const dot = el('span', 'ss-team-dot');
      dot.setAttribute('aria-hidden', 'true');
      if (/^#[0-9a-f]{6}$/i.test(agent.color)) dot.style.backgroundColor = agent.color;
      const sectionName = el('h' + (headingLevel + 1), 'ss-team-section', agent.id + '-' + agent.section);
      sectionName.id = prefix + '-section';
      sectionName.tabIndex = -1;
      if (agent.section) {
        sectionName.title = sectionName.textContent;
      } else {
        const placeholder = el('input', 'ss-team-section-placeholder');
        placeholder.readOnly = true;
        placeholder.tabIndex = -1;
        placeholder.placeholder = 'hero';
        placeholder.setAttribute('aria-label', 'Section name for worker ' + agent.id);
        placeholder.setAttribute('aria-describedby', sectionName.id + '-error');
        sectionName.append(placeholder);
      }
      card.setAttribute('aria-labelledby', sectionName.id);
      const badge = el('span', 'ss-team-new', 'new, not saved');
      badge.hidden = saved.some(worker => worker.id === agent.id);
      const confirm = el('div', 'ss-team-confirm');
      confirm.hidden = true;
      const question = el('p');
      question.id = prefix + '-remove-question';
      const remove = button('', 'ss-button ss-team-remove', () => {
        updateText(question, 'Remove ' + (agent.name?.trim() || 'Agent ' + Number(agent.id)) +
          '? Its section moves to retired/, nothing is deleted.');
        confirm.hidden = false;
        remove.setAttribute('aria-expanded', 'true');
        cancel.focus();
      });
      remove.append(icon('trash'));
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
        updateDefaultName();
        clearErrors();
        update();
        const destination = cards[index] ?? cards[index - 1];
        (destination?.fields.section.input ?? addHeading).focus();
      });
      const confirmActions = el('div', 'ss-action-buttons');
      for (const choice of [cancel, proceed]) choice.setAttribute('aria-describedby', question.id);
      confirmActions.append(cancel, proceed);
      confirm.append(question, confirmActions);
      confirm.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          cancel.click();
        }
      });
      const body = el('div', 'ss-team-fields');
      const overrides = el('div', 'ss-team-overrides');
      const fields = { section: trackField({ box: card, input: sectionName }) };
      const boxes = {};
      for (const [key, label] of [['name', 'Name'], ['title', 'Job title'], ['lane', 'Lane']]) {
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
      for (const [key, label] of [['runner', 'Runner'], ['model', 'Model'], ['effort', 'Effort']]) {
        const input = el('select');
        input.id = prefix + '-' + key;
        input.add(new Option('Default', ''));
        for (const [value, name] of choices[key]) input.add(new Option(name, value));
        input.value = agent[key] ?? '';
        const box = labeledField(label, input);
        fields[key] = trackField({ box, input });
        input.addEventListener('change', () => {
          if (input.value) agent[key] = input.value;
          else delete agent[key];
          if (key === 'runner' && !input.value) {
            for (const override of ['model', 'effort']) {
              delete agent[override];
              fields[override].input.value = '';
              fieldError(fields[override]);
            }
          }
          edited(key);
        });
        boxes[key] = box;
      }
      boxes.name.classList.add('ss-team-name');
      boxes.lane.classList.add('ss-team-lane');
      identity.append(dot, sectionName, boxes.name, remove);
      overrides.append(boxes.model, boxes.effort);
      body.append(boxes.title, boxes.runner, overrides, boxes.lane);
      card.prepend(identity, badge, confirm, body);
      fields.section.error.classList.add('ss-team-card-error');
      identity.after(fields.section.error);
      list.append(card);
      draft.push(agent);
      const syncOverrides = () => {
        overrides.hidden = !agent.runner && fields.model.error.hidden && fields.effort.error.hidden;
      };
      cards.push({ fields, syncOverrides });
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
      const dirty = isDirty();
      const full = draft.length >= maxWorkers;
      const next = nextWorkerId();
      const validAdd = validText(addName.input.value, 'name') && validText(addTitle.input.value, 'title') &&
        validSection(addSection.input.value) && validText(addLane.input.value, 'lane');
      const count = draft.length;
      updateText(summary, count + (count === 1 ? ' worker' : ' workers') +
        ', up to ' + maxParallel + ' run at the same time');
      updateText(state, saving ? 'Saving team…' : busy ? 'Team is working' :
        dirty ? 'Unsaved team changes' : (message || 'Team changes'));
      updateText(capacity, full ? 'Maximum of 16 workers reached.' : next ? '' : 'No worker IDs remain above the current maximum.');
      add.disabled = !validAdd || full || !next || saving;
      reset.disabled = saving || (!dirty && ![addName, addTitle, addSection, addLane]
        .some(({ input }) => input.value !== input.defaultValue));
      submit.disabled = busy || saving || !dirty;
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
      if (!preserveAdd) addForm.reset();
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
        if (titles.children.length !== data.titles.length ||
            data.titles.some((title, index) => titles.children[index].value !== title)) {
          titles.replaceChildren(...data.titles.map(title => new Option(title, title)));
        }
        if (!saved || !isDirty()) {
          saved = data.agents.map(normalizeWorker);
          if (!baseline || isDirty()) render('', true);
        }
        bar.hidden = list.hidden = addForm.hidden = jumpToActions.hidden = false;
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
      setMaxParallel(value) {
        maxParallel = value;
        if (saved) update();
      }
    };
  }

  function createPanel({ root, load, save, test, team }) {
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
    header.append(title, summary, nav);
    const focusTarget = title.hidden ? summary : title;
    focusTarget.tabIndex = -1;

    const shell = el('div', 'ss-form');
    const body = el('div', 'ss-body');
    const notice = live('ss-notice');
    const retry = button('Retry', 'ss-button', () => refresh());
    retry.hidden = true;
    const controls = el('div', 'ss-controls');
    controls.hidden = true;

    const rolesGroup = el('section', 'ss-group');
    const rolesHeading = groupHeading(rolesGroup, 'Roles', id + '-roles', headingLevel);
    const basic = el('fieldset', 'ss-controls ss-defaults');
    rolesGroup.append(basic);
    const researchGroup = el('section', 'ss-group');
    const researchHeading = groupHeading(researchGroup, 'Research', id + '-research', headingLevel);
    const researchInputs = el('fieldset', 'ss-card');
    researchGroup.append(researchInputs);
    const autopilotGroup = el('section', 'ss-group');
    const autopilotHeading = groupHeading(autopilotGroup, 'Autopilot', id + '-autopilot', headingLevel);
    const autopilotInputs = el('fieldset', 'ss-card');
    autopilotGroup.append(autopilotInputs);
    const advancedGroup = el('section', 'ss-group');
    const advancedHeading = groupHeading(advancedGroup, 'Advanced', id + '-advanced', headingLevel);
    const more = el('fieldset', 'ss-controls');
    advancedGroup.append(more);
    controls.append(rolesGroup, researchGroup, autopilotGroup, advancedGroup);
    body.append(notice, retry, controls);

    const dock = el('div', 'ss-dock');
    const footer = el('form', 'ss-footer');
    footer.id = id + '-form';
    footer.noValidate = true;
    footer.hidden = true;
    const feedback = live('ss-feedback', 'alert');
    const timing = el('p', 'ss-help', 'Changes apply from the next agent turn.');
    const actions = el('div', 'ss-actions');
    const state = live('ss-state');
    const actionButtons = el('div', 'ss-action-buttons');
    const reset = button('Reset', 'ss-button', resetDraft);
    const submit = button('Save settings', 'ss-button ss-primary');
    submit.type = 'submit';
    actionButtons.append(reset, submit);
    actions.append(state, actionButtons);
    footer.append(feedback, actions, timing);
    dock.append(footer);
    shell.append(body, dock);
    section.append(header, shell);
    root.replaceChildren(section);

    const fields = new Map();
    const runnerCards = new Map();
    const pendingTests = new Set();
    const shortcuts = [];
    const settingsGroups = [basic, researchInputs, autopilotInputs, more];
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
    body.addEventListener('scroll', syncSection, { passive: true });
    body.addEventListener('focusin', syncSection);

    function addShortcut(label, heading) {
      const link = el('a', '', label);
      link.href = '#' + heading.id;
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        body.scrollTop += heading.getBoundingClientRect().top - body.getBoundingClientRect().top - 16;
        heading.focus({ preventScroll: true });
        syncSection();
      });
      shortcuts.push({ link, heading });
      nav.append(link);
    }

    function syncSection() {
      if (!shortcuts.length || !body.clientHeight) return;
      const viewport = body.getBoundingClientRect();
      const focused = document.activeElement;
      let editing;
      if (body.contains(focused)) {
        const field = focused.getBoundingClientRect();
        if (field.bottom > viewport.top && field.top < viewport.bottom) {
          editing = shortcuts.find(({ heading }) => heading.parentElement.contains(focused));
        }
      }
      const atEnd = body.scrollTop > 0 && body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
      const current = editing ?? (atEnd ? shortcuts.at(-1) :
        shortcuts.findLast(({ heading }) => heading.getBoundingClientRect().top <= viewport.top + 20) ?? shortcuts[0]);
      // Keep the active actions outside the scroll area so the last field stays unobstructed.
      dock.dataset.section = current.heading === teamEditor?.heading ? 'team' : 'settings';
      for (const { link } of shortcuts) {
        if (link === current.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
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

    function selectField(parent, path, label, options, help) {
      const box = el('div', 'ss-field');
      const select = el('select');
      select.id = id + '-' + path;
      const caption = el('label', '', label);
      caption.htmlFor = select.id;
      select.add(new Option('Same as default', ''));
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

    function build(allowlist) {
      const runners = Object.keys(allowlist.runners).map(key => [key, runnerLabels[key]]);
      const models = Object.entries(allowlist.models);
      const efforts = allowlist.efforts.map(key => [key, key === 'medium' ? 'Medium' : key]);
      modelLabels = new Map(models);
      addShortcut('Roles', rolesHeading);
      addShortcut('Research', researchHeading);
      addShortcut('Autopilot', autopilotHeading);
      radioGroup(basic, 'defaults.runner', 'Runner', runners,
        'Codex CLI limits writes to the project. For pi, the server checks which files changed after each turn.',
        'ss-runners', true);
      radioGroup(basic, 'defaults.model', 'Default model', models,
        'Used by any role that inherits the default model.', 'ss-options');
      radioGroup(basic, 'defaults.effort', 'Reasoning effort', efforts,
        'Choose how much reasoning the model can use per turn.', 'ss-options ss-segments');
      if (team) {
        teamEditor = createTeamEditor(id, team, {
          runner: runners.map(([key]) => [key, key === 'codex' ? 'Codex CLI' : 'pi']),
          model: models,
          effort: efforts
        }, headingLevel, () => section.isConnected && !section.closest('[hidden]'));
        advancedGroup.before(teamEditor.section);
        dock.append(teamEditor.bar);
        addShortcut('Team', teamEditor.heading);
      }
      addShortcut('Advanced', advancedHeading);

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
      updateDraft(message);
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
      dirty = JSON.stringify(draft) !== JSON.stringify(saved);
      const { runner, model, effort } = { ...draft.defaults, ...draft.roles.workers };
      updateText(summary, 'Workers: ' + runner + ', ' + modelLabels.get(model) + ', ' + effort);
      updateText(counter, draft.channel.standingRules.length + ' / 1,000');
      const message = saving ? 'Saving…' : dirty ? 'Unsaved changes' : cleanMessage;
      actions.hidden = !message;
      actionButtons.hidden = !dirty && !saving;
      updateText(state, message);
      reset.disabled = saving;
      submit.disabled = saving;
    }

    function renderErrors(errors) {
      let firstInput;
      let firstMessage;
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
        if (text && !firstInput) {
          firstInput = inputs.find(input => input.checked) || inputs[0];
          firstMessage = message;
        }
      }
      feedback.textContent = general.join(' ') || (firstInput ? 'Review the highlighted fields.' : '');
      if (firstInput) {
        if (advanced.contains(firstInput)) advanced.open = true;
        firstInput.focus();
        firstMessage.scrollIntoView({ block: 'nearest' });
      }
    }

    function resetDraft() {
      writeSettings(saved, 'Changes reset.');
      focusTarget.focus({ preventScroll: true });
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
        focusTarget.focus({ preventScroll: true });
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
        if (!saved) build(data.allowlist);
        if (saved === baseline && !saving) {
          saved = data.settings;
          if (dirty) updateDraft();
          else writeSettings(saved);
        }
        controls.hidden = false;
        footer.hidden = false;
        nav.hidden = false;
        notice.textContent = '';
        paintStatus();
        syncSection();
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
        editor?.refresh()
      ]).then(() => undefined);
    }

    return {
      open() {
        section.hidden = false;
        return refresh();
      },
      close() {
        section.hidden = true;
        teamEditor?.stopPolling();
      },
      refresh
    };
  }

  window.SwarmSettings = {
    init(options) {
      panel = createPanel(options);
      return panel.open();
    },
    open() { return panel?.open(); },
    close() { panel?.close(); },
    refresh() { return panel?.refresh(); }
  };
})();
