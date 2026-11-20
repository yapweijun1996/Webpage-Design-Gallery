(() => {
  'use strict';

  const runnerLabels = { codex: 'Codex CLI (OpenAI)', pi: 'pi (pi.dev)' };
  const icons = {
    plus: 'M6 2v8M2 6h8',
    minus: 'M2 6h8',
    chevron: 'm3 4 3 3 3-3'
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

  function createPanel({ root, load, save, test }) {
    const id = 'swarm-settings-' + ++nextId;
    const section = el('section', 'swarm-settings');
    section.hidden = true;
    const title = el('h2', '', 'Settings');
    title.id = id + '-title';
    section.setAttribute('aria-labelledby', title.id);
    const header = el('div', 'ss-header');
    const summary = live('ss-summary');
    header.append(title, summary);

    const form = el('form', 'ss-form');
    form.noValidate = true;
    const body = el('div', 'ss-body');
    const notice = live('ss-notice');
    const retry = button('Retry', 'ss-button', () => refresh());
    retry.hidden = true;
    const controls = el('fieldset', 'ss-controls');
    controls.hidden = true;
    body.append(notice, retry, controls);

    const footer = el('footer', 'ss-footer');
    footer.hidden = true;
    const feedback = live('ss-feedback', 'alert');
    const timing = el('p', 'ss-help', 'Changes apply from the next agent turn.');
    const actions = el('div', 'ss-actions');
    const state = live('ss-state');
    const actionButtons = el('div', 'ss-action-buttons');
    const reset = button('Reset', 'ss-button', resetDraft);
    const submit = button('Save', 'ss-button ss-primary');
    submit.type = 'submit';
    actionButtons.append(reset, submit);
    actions.append(state, actionButtons);
    footer.append(feedback, actions, timing);
    form.append(body, footer);
    section.append(header, form);
    root.replaceChildren(section);

    const fields = new Map();
    const runnerCards = new Map();
    const pendingTests = new Set();
    let saved;
    let dirty = false;
    let saving = false;
    let loading;
    let status = {};
    let modelLabels;
    let advanced;
    let counter;

    controls.addEventListener('input', () => {
      renderErrors([]);
      updateDraft();
    });
    form.addEventListener('submit', submitDraft);

    function field(container, path, inputs, read, write, help = '') {
      const message = el('p', 'ss-error');
      message.id = id + '-' + path + '-error';
      message.hidden = true;
      container.append(message);
      fields.set(path, { inputs, read, write, message });
      const description = [help, message.id].filter(Boolean).join(' ');
      for (const input of inputs) input.setAttribute('aria-describedby', description);
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
      radioGroup(controls, 'defaults.runner', 'Runner', runners,
        'Codex CLI limits writes to the project. For pi, the server checks which files changed after each turn.',
        'ss-runners', true);
      radioGroup(controls, 'defaults.model', 'Default model', models,
        'Used by any role that inherits the default model.', 'ss-options');
      radioGroup(controls, 'defaults.effort', 'Reasoning effort', efforts,
        'Choose how much reasoning the model can use per turn.', 'ss-options ss-segments');

      advanced = el('details', 'ss-card ss-advanced');
      const disclosure = el('summary', '', 'Advanced');
      disclosure.append(icon('chevron'));
      const overrides = el('div', 'ss-overrides');
      const inheritHelp = helpText(overrides, 'roles', 'Override any default for the manager or workers.');
      for (const [role, label] of [['manager', 'Manager'], ['workers', 'Workers']]) {
        const group = el('fieldset', 'ss-role');
        group.append(el('legend', '', label));
        selectField(group, 'roles.' + role + '.runner', 'Runner', runners, inheritHelp);
        selectField(group, 'roles.' + role + '.model', 'Model', models, inheritHelp);
        selectField(group, 'roles.' + role + '.effort', 'Effort', efforts, inheritHelp);
        overrides.append(group);
      }
      advanced.append(disclosure, overrides);
      controls.append(advanced);

      const limits = el('fieldset', 'ss-card');
      const limitInputs = el('div', 'ss-limits');
      limits.append(el('legend', '', 'Run limits'), limitInputs);
      const limitHelp = helpText(limits, 'limits', 'Run 1 to 16 agents at once and allow 1 to 60 minutes per turn.');
      stepper(limitInputs, 'concurrency.maxParallel', 'Max parallel', 1, 16, { descriptionId: limitHelp });
      stepper(limitInputs, 'timeouts.turnMinutes', 'Timeout (min)', 1, 60, { descriptionId: limitHelp });
      controls.append(limits);

      const automation = el('div', 'ss-card ss-automation');
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
      automation.append(research);
      stepper(automation, 'autopilot.maxCyclesPerScreen', 'Autopilot cycles per screen', 1, 5, {
        description: 'How many improvement rounds the team runs on the screen you are looking at before waiting for you to scroll.'
      });
      controls.append(automation);

      radioGroup(controls, 'channel.language', 'Channel language', [['zh-Hans', 'Mandarin'], ['en', 'English']],
        'Sets the language agents use in the channel.', 'ss-options ss-segments');

      const rules = el('fieldset', 'ss-card');
      const legend = el('legend', '', 'Standing rules');
      const input = el('textarea');
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
      controls.append(rules);
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
      title.focus({ preventScroll: true });
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
      controls.disabled = true;
      updateDraft();
      let result;
      try {
        result = await save(draft);
      } catch {
        result = { ok: false };
      } finally {
        saving = false;
        controls.disabled = false;
      }
      if (result?.ok) {
        saved = result.settings ?? draft;
        writeSettings(saved, 'Settings saved.');
        title.focus({ preventScroll: true });
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

    function refresh() {
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
        notice.textContent = '';
        paintStatus();
      }).catch(() => {
        notice.textContent = 'Could not load settings.';
        retry.hidden = false;
      }).finally(() => {
        loading = undefined;
      });
      return loading;
    }

    title.tabIndex = -1;
    return {
      open() {
        section.hidden = false;
        return refresh();
      },
      close() {
        section.hidden = true;
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
