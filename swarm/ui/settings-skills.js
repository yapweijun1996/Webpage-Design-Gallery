(() => {
  'use strict';

  const allPositions = '*';
  const skillIdPattern = '[a-z0-9\\-]{2,40}';

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(label, action, primary = false) {
    const node = element('button', primary ? 'ss-button ss-primary' : 'ss-button', label);
    node.type = action ? 'button' : 'submit';
    if (action) node.addEventListener('click', action);
    return node;
  }

  function field(parent, label, control) {
    const wrappingLabel = element('label', 'ss-field');
    wrappingLabel.append(element('span', '', label), control);
    parent.append(wrappingLabel);
    return control;
  }

  function status(role) {
    const node = element('p', role === 'alert' ? 'ss-error' : 'ss-help');
    node.setAttribute('role', role);
    return node;
  }

  async function api(path, method = 'GET', payload) {
    const response = await fetch(path, {
      method,
      ...(payload ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } : {})
    });
    const data = await response.json();
    if (response.ok) return data;
    const detail = data.errors?.map(error => typeof error === 'string' ? error : error.message).join(' ');
    throw new Error(detail || data.error || 'The request could not be completed.');
  }

  const skillPath = id => '/api/skills/' + encodeURIComponent(id);

  function createEditor({ sectionId, headingLevel, onDirty }) {
    const section = element('section', 'ss-group ss-skills');
    const heading = element(`h${headingLevel}`, 'ss-group-title', 'Project skills');
    heading.id = sectionId + '-heading';
    heading.tabIndex = -1;
    section.setAttribute('aria-labelledby', heading.id);
    const statusLine = status('status');
    const libraryError = status('alert');
    const retry = button('Refresh skills', () => refresh());
    const catalogControls = element('div', 'ss-skill-catalog');
    const catalogChoice = field(catalogControls, 'Skill library', element('select'));
    const newSkill = button('New skill', () => chooseSkill('', true));
    catalogControls.append(newSkill);
    section.append(heading, statusLine, libraryError, retry, catalogControls);

    const skillForm = element('form', 'ss-card ss-skill-form');
    const skillHeading = element(`h${headingLevel + 1}`, '', 'Skill details');
    const skillMeta = status('status');
    skillForm.append(skillHeading, skillMeta);
    const skillName = field(skillForm, 'Skill ID', element('input'));
    skillName.required = true;
    skillName.pattern = skillIdPattern;
    skillName.minLength = 2;
    skillName.maxLength = 40;
    skillName.placeholder = 'e.g. layout-review';
    skillName.spellcheck = false;
    skillName.autocapitalize = 'none';
    const description = field(skillForm, 'Description', element('textarea'));
    description.required = true;
    description.maxLength = 300;
    description.rows = 2;
    const markdown = field(skillForm, 'Instructions (Markdown)', element('textarea'));
    markdown.maxLength = 8000;
    markdown.rows = 8;
    const rolesDetails = element('details', 'ss-skill-role-list');
    const rolesCaption = element('summary', '', 'Allowed positions');
    const roleList = element('fieldset', 'ss-skill-options');
    roleList.append(element('legend', '', 'Positions that can use this skill'));
    rolesDetails.append(rolesCaption, roleList);
    const allRoles = addCheck(roleList, allPositions, 'All positions');
    const roleChecks = new Map();
    skillForm.append(rolesDetails);
    const skillError = status('alert');
    const skillFeedback = status('status');
    const skillActions = element('div', 'ss-skill-actions');
    const remove = button('Remove project skill', removeSkill);
    const toggle = button('Disable skill', toggleSkill);
    const saveSkill = button('Save skill', null, true);
    skillActions.append(remove, toggle, saveSkill);
    skillForm.append(skillError, skillFeedback, skillActions);

    const assignmentForm = element('form', 'ss-card ss-skill-form');
    const assignmentHeading = element(`h${headingLevel + 1}`, '', 'Skill assignments');
    assignmentForm.append(assignmentHeading, element('p', 'ss-help', 'Workers use enabled skills allowed for their position.'));
    const targetChoice = field(assignmentForm, 'Assign to', element('select'));
    const assignmentList = element('fieldset', 'ss-skill-options');
    const assignmentError = status('alert');
    const assignmentFeedback = status('status');
    const saveAssignment = button('Save assignment', null, true);
    const assignmentActions = element('div', 'ss-skill-actions');
    assignmentActions.append(saveAssignment);
    assignmentForm.append(assignmentList, assignmentError, assignmentFeedback, assignmentActions);
    section.append(skillForm, assignmentForm);

    let catalog;
    let loadingCatalog;
    let openingSkill = false;
    let activeSkill;
    let baseline;
    let selectedId = '';
    let assignmentTarget = '';
    let assignmentBaseline = [];
    let pending = false;

    function addCheck(parent, value, label) {
      const wrapper = element('label', 'ss-skill-check');
      const input = element('input');
      input.type = 'checkbox';
      input.value = value;
      wrapper.append(input, element('span', '', label));
      parent.append(wrapper);
      return input;
    }

    function skillDraft() {
      const roles = allRoles.checked ? [allPositions] : Array.from(roleChecks).filter(([, input]) => input.checked).map(([id]) => id);
      return { id: skillName.value.trim(), description: description.value, body: markdown.value, roles: roles.sort() };
    }

    function assignmentDraft() {
      return Array.from(assignmentList.querySelectorAll('input:checked'), input => input.value).sort();
    }

    const skillDirty = () => Boolean(baseline) && JSON.stringify(skillDraft()) !== JSON.stringify(baseline);
    const assignmentDirty = () => JSON.stringify(assignmentDraft()) !== JSON.stringify(assignmentBaseline);

    function paint() {
      const loading = Boolean(loadingCatalog) || openingSkill;
      const busy = !catalog || loading || pending || Boolean(catalog?.busy);
      const draftingSkill = skillDirty();
      const draftingAssignment = assignmentDirty();
      catalogControls.hidden = !catalog;
      catalogChoice.disabled = pending || loading;
      newSkill.disabled = catalogChoice.disabled;
      retry.disabled = pending || openingSkill || Boolean(loadingCatalog);
      skillForm.hidden = !baseline || openingSkill;
      assignmentForm.hidden = !catalog;
      saveSkill.disabled = busy || !draftingSkill;
      toggle.hidden = !activeSkill;
      toggle.disabled = busy || draftingSkill;
      remove.hidden = activeSkill?.source !== 'project';
      remove.disabled = busy || draftingSkill;
      targetChoice.disabled = pending || loading;
      assignmentList.hidden = !assignmentTarget;
      assignmentActions.hidden = !assignmentTarget;
      assignmentList.disabled = pending;
      saveAssignment.disabled = busy || !assignmentTarget || !draftingAssignment;
      for (const input of [skillName, description, markdown, allRoles]) input.disabled = pending;
      for (const input of roleChecks.values()) input.disabled = pending || allRoles.checked;
      onDirty(draftingSkill || draftingAssignment);
    }

    function paintCatalog() {
      catalogChoice.replaceChildren(new Option('Choose a skill', ''));
      for (const skill of catalog.skills) {
        const state = skill.enabled ? '' : ' (disabled)';
        catalogChoice.add(new Option(skill.id + state, skill.id));
      }
      catalogChoice.value = selectedId;

      targetChoice.replaceChildren(new Option('Choose a position or worker', ''));
      for (const [key, label, rows] of [['position', 'Positions', catalog.positions], ['worker', 'Workers', catalog.workers]]) {
        if (!rows.length) continue;
        const group = element('optgroup');
        group.label = label;
        for (const row of rows) {
          const name = key === 'position' ? row.title || row.id : `${row.id} · ${row.name || row.title || 'Worker'}`;
          group.append(new Option(name, `${key}:${row.id}`));
        }
        targetChoice.append(group);
      }
      targetChoice.value = assignmentTarget;
    }

    function writeSkill(detail) {
      const { meta, body } = detail || { meta: { id: '', description: '', roles: [allPositions] }, body: '' };
      activeSkill = detail?.meta;
      skillName.value = meta.id;
      skillName.readOnly = Boolean(activeSkill);
      description.value = meta.description;
      markdown.value = body;
      skillMeta.textContent = detail ? `${meta.source === 'builtin' ? 'Built in' : 'Project'} · v${meta.version} · ${meta.enabled ? 'Enabled' : 'Disabled'}` : '';
      saveSkill.textContent = meta.source === 'builtin' ? 'Save project override' : 'Save skill';
      toggle.textContent = meta.enabled ? 'Disable skill' : 'Enable skill';
      const selectedRoles = new Set(meta.roles);
      allRoles.checked = selectedRoles.has(allPositions);
      for (const input of roleChecks.values()) input.parentElement.remove();
      roleChecks.clear();
      for (const role of catalog.positions) roleChecks.set(role.id, addCheck(roleList, role.id, role.title || role.id));
      for (const [id, input] of roleChecks) input.checked = selectedRoles.has(id);
      baseline = skillDraft();
    }

    async function chooseSkill(id, create = false, force = false) {
      if (!force && skillDirty() && !window.confirm('Discard unsaved skill changes?')) {
        catalogChoice.value = selectedId;
        return;
      }
      selectedId = id;
      catalogChoice.value = id;
      libraryError.textContent = '';
      skillError.textContent = '';
      if (!force) skillFeedback.textContent = '';
      baseline = undefined;
      activeSkill = undefined;
      if (id) {
        openingSkill = true;
        paint();
        try { writeSkill(await api(skillPath(id))); }
        catch (error) { libraryError.textContent = error.message; }
        finally { openingSkill = false; }
      } else if (create) {
        writeSkill();
      }
      paint();
      if (create) skillName.focus();
    }

    function writeAssignment() {
      assignmentList.replaceChildren(element('legend', '', 'Skills to assign'));
      if (!assignmentTarget) {
        assignmentBaseline = [];
        return;
      }
      const [key, id] = assignmentTarget.split(':');
      const assignments = key === 'position' ? catalog.assignments.byPosition : catalog.assignments.byWorker;
      const selected = new Set(assignments[id] || []);
      for (const skill of catalog.skills) {
        const label = skill.id + (skill.enabled ? '' : ' (disabled)');
        addCheck(assignmentList, skill.id, label).checked = selected.has(skill.id);
      }
      assignmentBaseline = assignmentDraft();
    }

    function refresh() {
      if (loadingCatalog) return loadingCatalog;
      if (pending || openingSkill) return Promise.resolve();
      libraryError.textContent = '';
      if (!catalog) statusLine.textContent = 'Loading skills…';
      loadingCatalog = loadCatalog().catch(error => {
        libraryError.textContent = error.message;
        statusLine.textContent = '';
      }).finally(() => {
        loadingCatalog = undefined;
        paint();
      });
      paint();
      return loadingCatalog;
    }

    async function loadCatalog() {
      const next = await api('/api/skills');
      const sameProject = next.projectId === catalog?.projectId;
      const retainSkill = sameProject && skillDirty();
      const retainAssignment = sameProject && assignmentDirty();
      const wasCreating = sameProject && !selectedId && baseline;
      catalog = next;
      if (!sameProject) {
        selectedId = '';
        assignmentTarget = '';
      }
      paintCatalog();
      if (!targetChoice.value) assignmentTarget = '';
      if (!retainAssignment || !assignmentTarget) writeAssignment();
      const count = `${catalog.skills.length} ${catalog.skills.length === 1 ? 'skill' : 'skills'}`;
      statusLine.textContent = catalog.busy ? `${count}. The team is working. Refresh when it finishes.` : count;
      if (!retainSkill) {
        const id = catalogChoice.value || (!wasCreating && catalog.skills[0]?.id) || '';
        await chooseSkill(id, false, true);
      }
      paint();
    }

    async function mutate(path, method, payload, feedback, apply) {
      if (!catalog || pending || catalog.busy || loadingCatalog || openingSkill) return false;
      pending = true;
      paint();
      feedback.textContent = '';
      try {
        await api(path, method, { ...payload, projectId: catalog.projectId });
      } catch (error) {
        feedback.textContent = error.message;
        return false;
      } finally {
        pending = false;
        paint();
      }
      apply();
      await refresh();
      return true;
    }

    async function toggleSkill() {
      const enabled = !activeSkill.enabled;
      if (await mutate(skillPath(selectedId), 'PATCH', { enabled }, skillError, () => {})) {
        skillFeedback.textContent = enabled ? 'Skill enabled.' : 'Skill disabled.';
        if (section.getClientRects().length && document.activeElement === document.body) toggle.focus();
      }
    }

    async function removeSkill() {
      if (!window.confirm(`Remove the project version of ${selectedId}?`)) return;
      if (await mutate(skillPath(selectedId), 'DELETE', {}, skillError, () => {})) {
        statusLine.textContent = 'Project skill removed. ' + statusLine.textContent;
        if (section.getClientRects().length && document.activeElement === document.body) catalogChoice.focus();
      }
    }

    catalogChoice.addEventListener('change', () => chooseSkill(catalogChoice.value));
    skillForm.addEventListener('input', () => {
      skillError.textContent = '';
      skillFeedback.textContent = '';
      paint();
    });
    skillForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (saveSkill.disabled) return;
      const { id, ...draft } = skillDraft();
      if (!activeSkill && catalog.skills.some(skill => skill.id === id)) {
        skillError.textContent = 'That skill already exists. Choose it from the library to edit it.';
        skillName.focus();
        return;
      }
      if (await mutate(skillPath(id), 'PUT', { ...draft, enabled: activeSkill?.enabled ?? true }, skillError, () => {
        selectedId = id;
        baseline = skillDraft();
      })) skillFeedback.textContent = 'Skill saved.';
    });
    targetChoice.addEventListener('change', () => {
      if (assignmentDirty() && !window.confirm('Discard unsaved assignment changes?')) {
        targetChoice.value = assignmentTarget;
        return;
      }
      assignmentTarget = targetChoice.value;
      assignmentError.textContent = '';
      assignmentFeedback.textContent = '';
      writeAssignment();
      paint();
    });
    assignmentList.addEventListener('input', () => {
      assignmentError.textContent = '';
      assignmentFeedback.textContent = '';
      paint();
    });
    assignmentForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (saveAssignment.disabled) return;
      const [key, id] = assignmentTarget.split(':');
      const ids = assignmentDraft();
      if (await mutate('/api/skill-assignments', 'PUT', { target: { [key]: id }, ids }, assignmentError, () => {
        assignmentBaseline = ids;
      })) assignmentFeedback.textContent = 'Assignment saved.';
    });

    paint();
    return { section, heading, refresh };
  }

  window.SwarmSkillSettings = { createEditor };
})();
