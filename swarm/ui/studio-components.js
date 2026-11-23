(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('preview')) return;

  const $ = id => document.getElementById(id);
  const selection = $('component-section');
  const list = $('component-history-list');
  const status = $('component-history-status');
  const dialog = $('component-restore-dialog');
  const form = $('component-restore-form');
  const confirm = $('component-restore-confirm');
  const cancel = $('component-restore-cancel');
  const dialogStatus = $('component-restore-status');
  let active = false;
  let sectionId = '';
  let data, editing;
  let read = 0;
  let loading = false;
  let loadError = '';
  let pending = false;

  function timeLabel(node, timestamp) {
    const date = new Date(timestamp || NaN);
    if (Number.isNaN(date.getTime())) {
      node.removeAttribute('datetime');
      node.textContent = 'Time unavailable';
    } else {
      node.dateTime = date.toISOString();
      node.textContent = date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
    }
  }

  function pathsList(node, paths) {
    node.replaceChildren(...paths.map(path => {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.textContent = path;
      li.append(code);
      return li;
    }));
  }

  function currentVersions() {
    return data?.selectedSection === sectionId ? data.versions : [];
  }

  function selectedVersion() {
    if (editing?.projectId !== data?.projectId || editing?.sectionId !== sectionId) return null;
    return currentVersions().find(version => version.snapshotId === editing.snapshotId &&
      version.expectedRevision === editing.expectedRevision);
  }

  function markStale(message = 'This version changed. Close this dialog and review the refreshed history.') {
    editing.stale = true;
    dialogStatus.textContent = message;
  }

  function paintControls() {
    const idle = !pending && !loading && !loadError && !data?.busy;
    const versions = currentVersions();
    selection.disabled = pending || !data?.sections.length;
    const idleNoticeHidden = !data?.busy || pending;
    $('component-history-busy').hidden = idleNoticeHidden;
    $('component-restore-busy').hidden = idleNoticeHidden;
    list.hidden = !versions.length;
    const empty = $('component-history-empty');
    empty.textContent = loadError || (loading ? 'Loading component history…' : !data?.sections.length ?
      'No project sections are available.' : 'No published versions for this section.');
    empty.hidden = !loadError && versions.length > 0;
    for (const button of list.querySelectorAll('button')) button.disabled = !idle;

    if (editing && !pending && !loading && !loadError && !editing.stale && !selectedVersion()) markStale();
    confirm.disabled = !idle || !editing || editing.stale || !selectedVersion();
    cancel.disabled = pending;
  }

  function render() {
    const focused = document.activeElement?.dataset.snapshotId;
    selection.replaceChildren(...(data?.sections || []).map(section => new Option(section.label, section.id)));
    selection.value = sectionId;
    list.replaceChildren(...currentVersions().map(version => {
      const row = document.createElement('li');
      const time = document.createElement('time');
      const paths = document.createElement('ul');
      const button = document.createElement('button');
      timeLabel(time, version.createdAt);
      paths.className = 'studio-component-paths';
      pathsList(paths, version.paths);
      button.type = 'button';
      button.className = 'studio-button';
      button.dataset.snapshotId = version.snapshotId;
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', dialog.id);
      button.textContent = 'Restore…';
      button.addEventListener('click', () => openDialog(version));
      row.append(time, paths, button);
      return row;
    }));
    if (focused) findButton(focused)?.focus();
  }

  function findButton(snapshotId) {
    return Array.from(list.querySelectorAll('button')).find(button => button.dataset.snapshotId === snapshotId);
  }

  async function json(url, options) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || 'The component request could not be completed.');
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async function refresh(busy) {
    if (!active) return;
    const request = ++read;
    if (data && typeof busy === 'boolean') data.busy = busy;
    loading = true;
    paintControls();
    try {
      const query = sectionId ? '?sectionId=' + encodeURIComponent(sectionId) : '';
      const next = await json('/api/component-versions' + query);
      if (request !== read) return;
      if (typeof next.projectId !== 'string' || !Array.isArray(next.sections) || !Array.isArray(next.versions)) {
        throw new Error('Component history is unavailable.');
      }
      data = next;
      sectionId = next.selectedSection || '';
      loadError = '';
      render();
    } catch {
      if (request === read) loadError = 'Component history could not be loaded.';
    } finally {
      if (request === read) {
        loading = false;
        paintControls();
      }
    }
  }

  function openDialog(version) {
    const section = data.sections.find(option => option.id === sectionId);
    editing = { projectId: data.projectId, sectionId, snapshotId: version.snapshotId, expectedRevision: version.expectedRevision };
    $('component-restore-section').textContent = section?.label || sectionId;
    timeLabel($('component-restore-time'), version.createdAt);
    $('component-restore-digest').textContent = version.expectedRevision;
    pathsList($('component-restore-paths'), version.paths);
    dialogStatus.textContent = '';
    status.textContent = '';
    dialog.showModal();
    $('component-restore-title').focus();
    paintControls();
  }

  selection.addEventListener('change', () => {
    sectionId = selection.value;
    status.textContent = '';
    refresh();
  });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    const trigger = findButton(editing?.snapshotId);
    (trigger && !trigger.disabled ? trigger : selection).focus();
    editing = undefined;
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (confirm.disabled) return;
    const { projectId, sectionId, snapshotId, expectedRevision } = editing;
    pending = true;
    dialogStatus.textContent = 'Checking and restoring the component…';
    paintControls();
    let sent = false;
    try {
      const { token } = await json('/api/anchor/session');
      if (typeof token !== 'string' || !token) throw new Error('Operator access is unavailable.');
      sent = true;
      const result = await json('/api/component-rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-swarm-anchor-token': token },
        body: JSON.stringify({ projectId, sectionId, snapshotId, expectedRevision }),
      });
      if (!result.undoId || !Array.isArray(result.restored) || result.snapshotId !== snapshotId) {
        throw new Error('The restore could not be confirmed.');
      }
      const count = result.restored.length;
      status.textContent = count === 1 ? 'Restored 1 file.' : `Restored ${count} files.`;
      dialog.close();
    } catch (error) {
      if (sent) markStale(error.status === 409
        ? `${error.message} Close this dialog and review the refreshed history.`
        : `${error.message} Close this dialog and check the history before trying again.`);
      else dialogStatus.textContent = error.message;
      dialogStatus.focus();
    } finally {
      pending = false;
      refresh();
    }
  });

  window.StudioComponentHistory = {
    show(showing) {
      if (active === showing) return;
      active = showing;
      if (active) refresh();
      else {
        read++;
        loading = false;
      }
    },
    refresh,
  };
})();
