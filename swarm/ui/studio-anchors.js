(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('preview')) return;

  const $ = id => document.getElementById(id);
  const panel = $('anchor-panel');
  const dialog = $('anchor-dialog');
  const form = $('anchor-form');
  const image = $('anchor-image');
  const selection = $('anchor-selection');
  const status = $('anchor-status');
  const dialogStatus = $('anchor-dialog-status');
  const controls = Array.from(panel.querySelectorAll('[data-anchor-action]'));
  const devices = Array.from(panel.querySelectorAll('[data-anchor-breakpoint]'));
  const widths = { desktop: 1440, tablet: 768, mobile: 393 };
  const desktopActions = ['approve', 'lock', 'finish'];
  const phases = {
    goals: 'Ready to set goals', generating: 'Ready for references', advisor_review: 'Awaiting advisor review',
    awaiting_approval: 'Awaiting approval', locked: 'Locked', implementing: 'Implementing',
    qa: 'Quality review', final_review: 'Awaiting final review', done: 'Complete', failed: 'Needs attention',
  };
  const successes = {
    goals: 'Design goals saved.', generate: 'References generated for advisor review.',
    import: 'Anchor imported for advisor review.', advisor: 'Advisor review saved.',
    approve: 'Image approved.', lock: 'Design contract locked.', revise: 'Revision requested.',
    unlock: 'Anchor unlocked.', qa: 'Visual QA results saved.', finish: 'Final approval saved.',
  };
  let active = false;
  let data, token, editing, trigger;
  let request = 0;
  let pending = false;
  let updating = false;
  let readAppearance;
  let currentId, selectedId, breakpoint = 'desktop', followActive = true;

  function selectedAnchor() { return data?.anchors.find(anchor => anchor.id === selectedId); }
  function file(anchor, size) { return anchor?.files?.[`anchor.${size}.png`]; }
  function imageUrl(id, size) { return `/api/anchor/image/${encodeURIComponent(id)}/${size}`; }
  function visibleDesktop() {
    const anchor = selectedAnchor();
    const digest = file(anchor, 'desktop')?.sha256;
    return anchor && breakpoint === 'desktop' && !image.hidden && image.getAttribute('src') === imageUrl(anchor.id, 'desktop') &&
      image.currentSrc === image.src && image.complete && image.naturalWidth === widths.desktop &&
      /^[a-f0-9]{64}$/.test(digest || '') ? digest : null;
  }

  function item(text) {
    const entry = document.createElement('li');
    entry.textContent = text;
    return entry;
  }

  function availableActions() {
    if (!data?.canEdit) return [];
    const { state, approved, anchorId } = data.flow;
    if (state === 'goals') return ['goals'];
    if (state === 'generating') return ['generate', 'import'];
    if (!anchorId || anchorId !== selectedId || !selectedAnchor()) return [];
    if (state === 'advisor_review') return ['advisor'];
    if (state === 'awaiting_approval') return [approved ? 'lock' : 'approve', 'revise'];
    if (state === 'locked') return ['qa', 'unlock'];
    if (state === 'implementing' || state === 'qa') return ['qa'];
    if (state === 'final_review') return data.qa?.ok && !data.qa.stale ? ['qa', 'finish'] : ['qa'];
    if (state === 'done' && data.qa?.stale) return ['qa'];
    return [];
  }

  function allowed(action, available = availableActions()) {
    return Boolean(token && !updating && !data?.busy && available.includes(action) &&
      (!desktopActions.includes(action) || visibleDesktop()));
  }

  function paintActions() {
    const available = availableActions();
    for (const button of controls) {
      const action = button.dataset.anchorAction;
      button.hidden = !available.includes(action);
      button.disabled = pending || !allowed(action, available);
    }
    const access = $('anchor-access');
    access.textContent = !data ? '' : data.busy ? 'Design anchor actions are available when the project is idle.' :
      !data.canEdit || (!token && !updating) ? 'Operator access is unavailable.' :
        available.some(action => desktopActions.includes(action)) && !visibleDesktop()
          ? 'Open the desktop reference to continue.' : '';
    access.hidden = !access.textContent;
    const unchanged = editing && editing.projectId === data?.projectId &&
      (!editing.anchorId || editing.anchorId === data.flow.anchorId) &&
      (!editing.sha256 || editing.sha256 === visibleDesktop());
    $('anchor-dialog-submit').disabled = pending || !unchanged || !allowed(editing?.action, available);
    $('anchor-dialog-close').disabled = pending;
  }

  function paintQA(anchor) {
    const qa = data.qa;
    $('anchor-qa').hidden = qa?.anchorId !== anchor.id;
    if (qa?.anchorId !== anchor.id) return;
    $('anchor-qa-status').textContent = qa.stale ? 'The preview changed after visual QA.' :
      !qa.ok ? 'Visual QA found issues.' : qa.completeCoverage ? 'Visual QA passed.' : 'Visual QA passed the available references.';
    const results = Array.isArray(qa.breakpoints) ? qa.breakpoints : [];
    const summary = results.map(({ name, width, status: result, score, message }) =>
      item([`${name} · ${width} px`, String(result || '').replaceAll('_', ' '), Number.isFinite(score) ? `Score ${Math.round(score)}` : null, message]
        .filter(Boolean).join(' · ')));
    const list = $('anchor-qa-results');
    list.replaceChildren(...summary);
    list.hidden = summary.length === 0;
  }

  function paintReference() {
    const anchor = selectedAnchor();
    const reference = $('anchor-reference');
    reference.hidden = !anchor;
    if (!anchor) {
      image.removeAttribute('src');
      image.hidden = true;
      paintActions();
      return;
    }
    if (!file(anchor, breakpoint)) breakpoint = 'desktop';
    for (const button of devices) {
      const key = button.dataset.anchorBreakpoint;
      button.hidden = !file(anchor, key);
      button.setAttribute('aria-pressed', String(key === breakpoint));
    }
    const selected = file(anchor, breakpoint);
    const url = imageUrl(anchor.id, breakpoint);
    image.hidden = !selected;
    const full = $('anchor-full-image');
    full.hidden = !selected;
    $('anchor-compare').hidden = !selected || !['approved', 'locked', 'superseded'].includes(anchor.status);
    if (selected) {
      image.alt = `${breakpoint[0].toUpperCase() + breakpoint.slice(1)} design reference for ${anchor.id}`;
      if (image.getAttribute('src') !== url) image.src = url;
      full.href = url;
    }
    const advisor = anchor.advisor;
    const currentReview = data.flow.state === 'advisor_review' && anchor.id === currentId;
    $('anchor-advisor').hidden = !advisor && !currentReview;
    const score = Number.isFinite(advisor?.score) ? ` · Score ${advisor.score}` : '';
    $('anchor-advisor-status').textContent = advisor?.verdict === 'pass' ? `Advisor passed${score}` :
      advisor?.verdict === 'revise' ? `Advisor requested revision${score}` : 'Advisor review pending';
    const findings = (Array.isArray(advisor?.findings) ? advisor.findings : [])
      .map(finding => typeof finding === 'string' ? finding : finding?.detail || finding?.message || finding?.text)
      .filter(text => typeof text === 'string' && text.trim());
    const list = $('anchor-advisor-findings');
    list.replaceChildren(...findings.map(item));
    list.hidden = findings.length === 0;
    $('anchor-approval').hidden = !anchor.approvedBy;
    $('anchor-approval').textContent = anchor.approvedBy ? `Approved by ${anchor.approvedBy}` : '';
    paintQA(anchor);
    paintActions();
  }

  function setData(next) {
    if (data && data.projectId !== next.projectId) {
      token = undefined;
      selectedId = undefined;
      followActive = true;
    }
    data = next;
    const { flow, anchors } = next;
    $('anchor-phase').textContent = flow.failure?.reason ||
      (flow.state === 'awaiting_approval' && flow.approved ? 'Approved · Ready to lock' : phases[flow.state] || flow.state);
    const goals = Array.isArray(flow.goals) ? flow.goals.filter(goal => typeof goal === 'string') : [];
    const goalList = $('anchor-goals-list');
    goalList.hidden = goals.length === 0;
    goalList.replaceChildren(...goals.map(item));
    const latest = [...anchors].sort((a, b) => b.id.length - a.id.length || b.id.localeCompare(a.id));
    if (followActive || !latest.some(anchor => anchor.id === selectedId)) {
      const nextId = flow.anchorId || latest[0]?.id;
      if (nextId !== selectedId) breakpoint = 'desktop';
      selectedId = nextId;
    }
    currentId = flow.anchorId;
    selection.replaceChildren(...latest.map(anchor =>
      new Option(`${anchor.id} · ${anchor.status}${anchor.id === currentId ? ' (active)' : ''}`, anchor.id)));
    selection.value = selectedId || '';
    paintReference();
  }

  async function json(url, options) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || 'The design anchor request could not be completed.');
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async function refresh() {
    if (!active || pending) return;
    const id = ++request;
    updating = true;
    paintActions();
    try {
      const next = await json('/api/anchor/state');
      if (id !== request) return;
      setData(next);
      if (next.canEdit && !token) {
        const grant = await json('/api/anchor/session');
        if (id !== request) return;
        token = typeof grant.token === 'string' ? grant.token : undefined;
      }
    } catch {
      if (id !== request) return;
      if (!data) $('anchor-phase').textContent = 'Design anchors are unavailable';
    } finally {
      if (id === request) {
        updating = false;
        paintActions();
      }
    }
  }

  function open(action, button) {
    if (!allowed(action)) return;
    trigger = button;
    const anchorId = ['goals', 'generate', 'import'].includes(action) ? undefined : currentId;
    const sha256 = desktopActions.includes(action) ? visibleDesktop() : undefined;
    editing = { action, projectId: data.projectId, anchorId, sha256 };
    const context = $('anchor-dialog-context');
    const descriptions = {
      generate: 'Use the configured Codex runner to generate images from the current design goals.',
      approve: `Approve the displayed desktop reference for ${anchorId}.`,
      lock: `Review the design contract for ${anchorId} before locking.`,
      advisor: `Start an advisor review for ${anchorId}.`,
      qa: `Check the current preview against ${anchorId}.`,
      finish: `Finalize the checked design for ${anchorId}.`,
    };
    context.textContent = descriptions[action] || (anchorId ? `Anchor ${anchorId}` : '');
    context.hidden = !context.textContent;
    $('anchor-dialog-title').textContent = button.textContent;
    $('anchor-dialog-submit').textContent = button.textContent;
    dialogStatus.textContent = '';
    const fieldMode = action === 'revise' || action === 'unlock' ? 'reason' : action;
    for (const fields of form.querySelectorAll('[data-anchor-fields]')) fields.hidden = fields.dataset.anchorFields !== fieldMode;
    dialog.showModal();
    const field = form.querySelector('[data-anchor-fields]:not([hidden]) :is(textarea, input)');
    (field || $('anchor-dialog-title')).focus();
    paintActions();
  }

  async function png(file, size) {
    if (file.size > 4 * 1024 * 1024) throw new Error(`${size} PNG must be at most 4 MiB.`);
    const header = new Uint8Array(await file.slice(0, 24).arrayBuffer());
    if (header.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)) {
      throw new Error(`Choose a PNG for ${size}.`);
    }
    const view = new DataView(header.buffer);
    if (view.getUint32(16) !== widths[size] || view.getUint32(20) < 1 || view.getUint32(20) > 2400) {
      throw new Error(`The ${size} PNG must be ${widths[size]} pixels wide and at most 2400 pixels high.`);
    }
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error(`The ${size} PNG could not be decoded.`); }
    const fits = bitmap.width === widths[size] && bitmap.height <= 2400;
    bitmap.close();
    if (!fits) throw new Error(`The ${size} PNG must be ${widths[size]} pixels wide and at most 2400 pixels high.`);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result.split(',')[1]));
      reader.addEventListener('error', () => reject(new Error(`The ${size} PNG could not be read.`)));
      reader.readAsDataURL(file);
    });
  }

  async function fieldsFor(action) {
    if (action === 'goals') {
      const goals = $('anchor-goal-notes').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (!goals.length) throw new Error('Enter at least one design goal.');
      return { goals };
    }
    if (action === 'import') {
      if (!$('anchor-file-desktop').files[0]) throw new Error('Choose a desktop PNG.');
      const entries = [];
      for (const size of Object.keys(widths)) {
        const chosen = $(`anchor-file-${size}`).files[0];
        if (chosen) entries.push([size, await png(chosen, size)]);
      }
      return { files: Object.fromEntries(entries) };
    }
    if (action === 'lock') {
      let contract;
      try { contract = JSON.parse($('anchor-contract').value); }
      catch { throw new Error('Enter a valid design contract JSON object.'); }
      if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new Error('Enter a valid design contract JSON object.');
      return { contract };
    }
    if (action === 'revise' || action === 'unlock') {
      const reason = $('anchor-reason').value.trim();
      if (!reason) throw new Error('Enter a reason for the change.');
      return { reason };
    }
    if (action === 'qa') return { appearance: readAppearance?.() };
    return {};
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !editing || $('anchor-dialog-submit').disabled) return;
    const { action, ...target } = editing;
    const runsInBackground = ['generate', 'advisor', 'qa'].includes(action);
    pending = true;
    request += 1;
    const feedback = runsInBackground ? status : dialogStatus;
    const progress = { generate: 'Generating references…', advisor: 'Advisor review in progress…', qa: 'Visual QA in progress…' };
    feedback.textContent = progress[action] || 'Saving…';
    if (runsInBackground) {
      trigger = undefined;
      dialog.close();
    }
    paintActions();
    let saved = false;
    try {
      const fields = await fieldsFor(action);
      const result = await json(`/api/anchor/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-swarm-anchor-token': token },
        body: JSON.stringify({ ...target, ...fields }),
      });
      if (result.projectId === target.projectId && result.flow) setData(result);
      saved = true;
      form.reset();
      status.textContent = successes[action];
    } catch (error) {
      if (error.status === 401 || error.status === 403) token = undefined;
      feedback.textContent = error.message;
    } finally {
      pending = false;
      if (saved && !runsInBackground) {
        trigger = undefined;
        dialog.close();
      }
      refresh();
      paintActions();
    }
  });

  for (const button of controls) button.addEventListener('click', () => open(button.dataset.anchorAction, button));
  for (const button of devices) button.addEventListener('click', () => { breakpoint = button.dataset.anchorBreakpoint; paintReference(); });
  selection.addEventListener('change', () => {
    selectedId = selection.value;
    followActive = selectedId === currentId;
    breakpoint = 'desktop';
    paintReference();
  });
  image.addEventListener('load', paintActions);
  image.addEventListener('error', () => { status.textContent = 'The design reference could not be loaded.'; paintActions(); });
  $('anchor-compare').addEventListener('click', () => window.StudioCompare?.showAnchor(image.getAttribute('src'), image.alt));
  $('anchor-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
  dialog.addEventListener('click', event => { if (!pending && event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    editing = undefined;
    (trigger?.getClientRects().length ? trigger : $('anchor-title')).focus({ preventScroll: true });
  });

  window.StudioAnchors = {
    show(visible, appearance) {
      readAppearance = appearance;
      if (active === visible) return;
      active = visible;
      if (visible) refresh();
      else request += 1;
    },
    refresh,
    previewChanged() { if (data?.qa) refresh(); },
  };
}());
