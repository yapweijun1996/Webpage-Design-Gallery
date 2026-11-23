(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('preview')) return;

  const $ = id => document.getElementById(id);
  const endpoint = '/api/shared-proposals';
  const list = $('shared-proposals-list');
  const dialog = $('shared-proposal-dialog');
  const operation = $('shared-proposal-operation');
  const close = $('shared-proposal-close');
  const review = $('shared-proposal-review');
  const approve = $('shared-proposal-approve');
  const reject = $('shared-proposal-reject');
  const back = $('shared-proposal-back');
  const confirm = $('shared-proposal-confirm');
  const labels = {
    pending: 'Awaiting preview review', reviewed: 'Reviewed', stale: 'Review expired',
    approved: 'Approved', rejected: 'Rejected',
  };
  const progress = {
    review: 'Measuring preview impact…', approve: 'Publishing the approved styles…', reject: 'Rejecting the proposal…',
  };
  const completed = {
    review: 'Preview review saved.', approve: 'Shared styles approved and published.', reject: 'Proposal rejected.',
  };
  let active = false;
  let data, selectedId, decision, pending;
  let read = 0;
  let loading = false;
  let loadError = false;
  let evidenceKey = '';

  function node(tag, text) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    return element;
  }

  function label(proposal) { return Object.hasOwn(labels, proposal.status) ? labels[proposal.status] : 'Status unavailable'; }
  function current() { return data?.proposals.find(proposal => proposal.id === selectedId); }

  function allowed(action, proposal) {
    if (!proposal?.reviewRevision || !['pending', 'reviewed', 'stale'].includes(proposal.status)) return false;
    return action !== 'approve' || (proposal.status === 'reviewed' && proposal.impact?.ok === true);
  }

  function identity(proposal) {
    return { projectId: data.projectId, id: proposal.id, reviewRevision: proposal.reviewRevision };
  }

  function sameReview(target, proposal) {
    return target && proposal && target.projectId === data?.projectId && target.id === proposal.id &&
      target.reviewRevision === proposal.reviewRevision;
  }

  function timestamp(createdAt) {
    const date = new Date(createdAt || NaN);
    const time = node('time', Number.isNaN(date.getTime()) ? 'Time unavailable' :
      date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
    if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
    return time;
  }

  function listedButton(id) {
    return Array.from(list.querySelectorAll('button')).find(button => button.dataset.proposalId === id);
  }

  function paintList() {
    const message = $('shared-proposals-message');
    message.textContent = loadError ? 'Shared style proposals could not be loaded.' :
      !data ? 'Loading proposals…' : !data.proposals.length ? 'No shared style proposals.' :
        data.busy ? 'Proposal actions are available when the project is idle.' : '';
    message.hidden = !message.textContent;
    const focused = document.activeElement?.dataset.proposalId;
    list.replaceChildren(...(data?.proposals || []).map(proposal => {
      const item = node('li');
      const section = proposal.sectionId || 'Project';
      const button = node('button', 'Open proposal');
      button.type = 'button';
      button.className = 'studio-button';
      button.dataset.proposalId = proposal.id;
      button.setAttribute('aria-label', 'Open proposal for ' + section);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', dialog.id);
      button.addEventListener('click', () => {
        selectedId = proposal.id;
        decision = null;
        operation.textContent = '';
        dialog.showModal();
        paintDialog();
        $('shared-proposal-title').focus();
      });
      item.append(node('p', 'tokens.css · ' + section), node('p', label(proposal)), timestamp(proposal.createdAt), button);
      return item;
    }));
    if (focused) listedButton(focused)?.focus();
  }

  function evidence(proposal, width, section, sample) {
    const details = node('details');
    details.append(node('summary', section ? 'View ' + section + ' at ' + width + ' px' : 'View before and proposed previews'));
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      const gallery = node('div');
      gallery.className = 'studio-shared-evidence';
      for (const [side, caption] of [['before', 'Before'], ['after', 'Proposed']]) {
        const figure = node('figure');
        if (section && !sample?.[side]?.sha256) {
          gallery.append(node('p', sample?.[side]?.hidden ? caption + ' section is hidden at this width.' : caption + ' section capture unavailable.'));
          continue;
        }
        const img = node('img');
        const url = `${endpoint}/${encodeURIComponent(proposal.id)}/evidence/${encodeURIComponent(proposal.reviewRevision)}/${width}/${side}`
          + (section ? '?section=' + encodeURIComponent(section) : '');
        img.alt = `${caption} ${section || 'preview'} at ${width} px`;
        img.src = url;
        const full = node('a', caption + ' · Open full image');
        full.href = url;
        full.target = '_blank';
        full.rel = 'noopener';
        const legend = node('figcaption');
        legend.append(full);
        figure.append(legend, img);
        gallery.append(figure);
      }
      details.append(gallery);
    }, { once: true });
    return details;
  }

  function paintImpact(proposal) {
    const impact = proposal?.impact;
    const key = JSON.stringify([proposal?.id, proposal?.status, proposal?.reviewRevision, impact?.digest]);
    if (key === evidenceKey) return;
    evidenceKey = key;
    const summary = $('shared-proposal-impact-status');
    const widths = $('shared-proposal-widths');
    const problems = $('shared-proposal-problems');
    const appearance = $('shared-proposal-appearance');
    summary.textContent = proposal?.status === 'stale' ? 'The preview changed. Measure impact again before approval.' :
      !impact ? 'Measure impact to see how the proposal changes the page.' :
        impact.ok ? 'No blocking regressions detected in the measured previews.' : 'The measured impact blocks approval.';
    const { theme, brand, lang, colorScheme } = impact?.appearance || {};
    appearance.textContent = [theme && 'Theme ' + theme, brand && 'Brand ' + brand, lang && 'Language ' + lang, colorScheme && 'System appearance ' + colorScheme].filter(Boolean).join(' · ');
    appearance.hidden = !appearance.textContent;
    problems.replaceChildren(...(impact?.problems || []).map(problem => node('li', typeof problem === 'string' ? problem : problem.message)));
    problems.hidden = !problems.children.length;
    const canLoadEvidence = proposal && ['reviewed', 'approved'].includes(proposal.status);
    const samples = Array.isArray(impact?.perWidth) ? impact.perWidth : [];
    const sectionReports = Array.isArray(impact?.perSection) ? impact.perSection : [];
    widths.replaceChildren(...samples.filter(sample => Number.isInteger(sample.width) && sample.width > 0).map(sample => {
      const row = node('li');
      const width = sample.width;
      const changed = sectionReports.filter(section => section.widths?.some(measurement => measurement.width === width && measurement.changed))
        .map(section => section.id);
      row.append(node('strong', width + ' px'));
      if (sectionReports.length) row.append(node('p', changed.length ? 'Changed sections · ' + changed.join(', ') : 'No section changes.'));
      const { horizontalOverflow, consoleErrors } = sample;
      if (Number.isFinite(horizontalOverflow?.before) && Number.isFinite(horizontalOverflow?.after)) {
        row.append(node('p', `Horizontal overflow · ${horizontalOverflow.before} → ${horizontalOverflow.after} px`));
      }
      if (Array.isArray(consoleErrors?.added)) {
        row.append(node('p', 'New browser errors · ' + consoleErrors.added.length));
        if (consoleErrors.added.length) {
          const errors = node('ul');
          errors.append(...consoleErrors.added.map(error => node('li', typeof error === 'string' ? error : error.message)));
          row.append(errors);
        }
      }
      if (canLoadEvidence) {
        row.append(evidence(proposal, width));
        for (const section of sectionReports) {
          const measurement = section.widths?.find(entry => entry.width === width);
          if (measurement) row.append(evidence(proposal, width, section.id, measurement));
        }
      }
      return row;
    }));
  }

  function paintChanges(before, after) {
    const limit = 16;
    const previous = before.split('\n');
    const proposed = after.split('\n');
    let start = 0;
    let end = 0;
    while (start < Math.min(previous.length, proposed.length) && previous[start] === proposed[start]) start++;
    if (previous.length !== proposed.length) {
      while (end < Math.min(previous.length, proposed.length) - start &&
          previous[previous.length - end - 1] === proposed[proposed.length - end - 1]) end++;
    }
    function changes(lines, peer, prefix) {
      return lines.slice(start, lines.length - end).flatMap((line, offset) => {
        const index = start + offset;
        if (previous.length === proposed.length && line === peer[index]) return [];
        return [prefix + ' ' + (index + 1) + '  ' + line];
      });
    }
    const removed = changes(previous, proposed, '−');
    const added = changes(proposed, previous, '+');
    $('shared-proposal-previous-lines').textContent = removed.slice(0, limit).join('\n');
    $('shared-proposal-proposed-lines').textContent = added.slice(0, limit).join('\n');
    $('shared-proposal-changes').hidden = !removed.length && !added.length;
    $('shared-proposal-changes-limit').hidden = removed.length <= limit && added.length <= limit;
  }

  function paintDialog() {
    if (!dialog.open) return;
    const proposal = current();
    const busy = data?.busy;
    const enabled = !pending && !loading && !loadError && !busy;
    $('shared-proposal-context').textContent = proposal ?
      [proposal.sectionId, timestamp(proposal.createdAt).textContent, label(proposal)].filter(Boolean).join(' · ') :
      'This proposal is unavailable.';
    const before = $('shared-proposal-before');
    const after = $('shared-proposal-after');
    if (before.textContent !== (proposal?.before || '') || after.textContent !== (proposal?.after || '')) {
      before.textContent = proposal?.before || '';
      after.textContent = proposal?.after || '';
      paintChanges(before.textContent, after.textContent);
    }
    paintImpact(proposal);

    $('shared-proposal-actions').hidden = Boolean(decision);
    $('shared-proposal-confirmation').hidden = !decision;
    $('shared-proposal-decision').hidden = !decision;
    $('shared-proposal-busy').hidden = !busy || Boolean(pending);
    close.disabled = Boolean(pending);
    for (const button of [review, approve, reject]) {
      const action = button.id.split('-').at(-1);
      button.hidden = !proposal || !['pending', 'reviewed', 'stale'].includes(proposal.status);
      button.disabled = !enabled || !allowed(action, proposal);
    }
    if (decision) {
      const currentReview = sameReview(decision, proposal) && !decision.invalid && allowed(decision.action, proposal);
      if (!currentReview && !pending && !loading && !loadError && !decision.invalid) {
        operation.textContent = 'This review changed. Go back and review the latest proposal before deciding.';
      }
      confirm.disabled = !enabled || !currentReview;
      back.disabled = Boolean(pending);
    }
  }

  async function json(url, options) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'The proposal request could not be completed.');
    }
    return result;
  }

  async function refresh(busy) {
    if (!active) return;
    const request = ++read;
    if (data && typeof busy === 'boolean') data.busy = busy;
    loading = true;
    paintDialog();
    try {
      const next = await json(endpoint);
      if (request !== read) return;
      if (typeof next.projectId !== 'string' || !Array.isArray(next.proposals)) throw new Error('Invalid proposal catalog.');
      data = next;
      loadError = false;
    } catch {
      if (request === read) loadError = true;
    } finally {
      if (request === read) {
        loading = false;
        paintList();
        paintDialog();
      }
    }
  }

  function choose(action) {
    const proposal = current();
    if (!allowed(action, proposal)) return;
    decision = { ...identity(proposal), action };
    const approving = action === 'approve';
    const title = $('shared-proposal-confirm-title');
    title.textContent = approving ? 'Approve this proposal?' : 'Reject this proposal?';
    $('shared-proposal-confirm-context').textContent = approving ?
      'This publishes the reviewed tokens.css for the whole page.' :
      'This closes the proposal and leaves the published styles as they are.';
    $('shared-proposal-revision').textContent = decision.reviewRevision;
    confirm.textContent = approving ? 'Confirm approval' : 'Confirm rejection';
    operation.textContent = '';
    paintDialog();
    title.focus();
  }

  async function submit(action, target) {
    if (!target || pending || loading || loadError || data?.busy || target.invalid ||
      !sameReview(target, current()) || !allowed(action, current())) return;
    pending = action;
    operation.textContent = progress[action];
    paintDialog();
    let sent = false;
    try {
      const { token } = await json('/api/anchor/session');
      if (typeof token !== 'string' || !token) throw new Error('Operator access is unavailable.');
      const { projectId, id, reviewRevision } = target;
      sent = true;
      const { proposal } = await json(endpoint + '/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-swarm-anchor-token': token },
        body: JSON.stringify({ projectId, id, reviewRevision }),
      });
      if (proposal?.id !== id) throw new Error('The proposal update could not be confirmed.');
      decision = null;
      operation.textContent = completed[action];
    } catch (error) {
      if (decision && sent) {
        decision.invalid = true;
        operation.textContent = `${error.message} Go back and check the latest review before deciding.`;
      } else {
        operation.textContent = error.message;
      }
    } finally {
      await refresh();
      pending = null;
      paintDialog();
      operation.focus();
    }
  }

  review.onclick = () => { if (current()) submit('review', identity(current())); };
  approve.onclick = () => choose('approve');
  reject.onclick = () => choose('reject');
  confirm.onclick = () => { if (decision) submit(decision.action, decision); };
  back.onclick = () => {
    const button = decision?.action === 'approve' ? approve : reject;
    decision = null;
    operation.textContent = '';
    paintDialog();
    (button.disabled ? $('shared-proposal-title') : button).focus();
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    (listedButton(selectedId) || $('shared-proposals-title')).focus();
    selectedId = decision = null;
  });

  window.StudioSharedProposals = {
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
