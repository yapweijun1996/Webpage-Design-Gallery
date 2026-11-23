'use strict';

const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const store = require('./shared-tokens');
const integrator = require('./integrator');
const { Violation, projectRoot } = require('./project-files');
const { approvedAnchor, canRestore } = require('./publication');
const { AnchorRequestError } = require('./anchor-manager');
const { withProjectLock, ProjectBusyError } = require('./project-init');
const { readOptions } = require('./version-routes');

const BASE = '/api/shared-proposals';
const matches = route => route === BASE || route.startsWith(BASE + '/');
const IMAGE = /^\/api\/shared-proposals\/([a-f0-9-]{36})\/evidence\/([a-f0-9]{64})\/(393|768|1440)\/(before|after)$/;
const conflict = message => new AnchorRequestError(409, message);
const BUSY = 'Wait until the current Swarm work finishes.';

function createSharedRoutes({ projectDir, projectId, busy, authorize, changed, sections, measure }) {
  let active;
  const isBusy = () => busy() || Boolean(active);
  const notify = action => {
    try { changed(action); }
    catch { console.warn('The shared style notification could not finish.'); }
  };

  function load(project, input) {
    const record = store.get(project, input.id);
    if (!record || record.projectId !== projectId || record.reviewRevision !== input.reviewRevision ||
        !['pending', 'reviewed', 'stale'].includes(record.status)) {
      throw conflict('This proposal changed. Reload it before continuing.');
    }
    return record;
  }

  function scope(project, record) {
    let anchor;
    try { anchor = approvedAnchor(project); }
    catch (error) { throw conflict(error.message); }
    if (record.anchor?.id !== anchor?.id || record.anchor?.contractHash !== anchor?.contractHash ||
        canRestore(project, project) !== true) throw conflict('The anchor changed. Request a fresh style proposal.');
    const catalog = sections();
    if (!catalog.some(({ id, owner }) => id === record.sectionId && owner === record.workerId)) {
      throw conflict('The proposing section or its owner changed.');
    }
    return catalog.map(({ id }) => id);
  }

  async function decide(input, action) {
    if (input.projectId !== projectId) throw conflict('The project changed. Reload Review.');
    if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id) ||
        typeof input.reviewRevision !== 'string' || !/^[a-f0-9]{64}$/.test(input.reviewRevision)) {
      throw new AnchorRequestError(400, 'Choose a style proposal to review.');
    }
    const project = projectRoot(projectDir);
    const record = withProjectLock(project, () => {
      if (isBusy()) throw conflict(BUSY);
      const proposal = load(project, input);
      if (action === 'reject') {
        return store.save(project, { ...proposal, status: 'rejected', decision: { by: 'studio-operator', at: new Date().toISOString() } });
      }
      if (action === 'approve' && (proposal.status !== 'reviewed' || !proposal.impact?.ok)) {
        throw conflict('Review a passing impact report before approving the shared style.');
      }
      return proposal;
    });
    if (action === 'reject') {
      notify(action);
      return store.publicRecord(record);
    }

    const expectedSections = scope(project, record);
    const controller = new AbortController();
    active = controller;
    try {
      notify();
      const result = await integrator.inspectSharedTokens(project, record,
        (before, after) => measure(before, after, { expectedSections, appearance: record.appearance, signal: controller.signal }),
        (report, inputs) => {
          if (controller.signal.aborted || busy()) throw conflict('The style review was interrupted.');
          load(project, input);
          if (JSON.stringify(expectedSections) !== JSON.stringify(scope(project, record))) throw conflict('The section list changed.');
          if (!/^[a-f0-9]{64}$/.test(report.digest)) throw conflict('Chrome did not return a complete impact report.');
          if (action === 'approve') {
            if (!report.ok || record.inputs !== inputs || report.digest !== record.impact.digest) {
              store.save(project, { ...record, status: 'stale' });
              throw conflict('The rendered page changed. Measure the impact again before approval.');
            }
            const decided = { ...record, status: 'approved', decision: { by: 'studio-operator', at: new Date().toISOString(), undoSnapshotId: randomUUID() } };
            integrator.applySharedDecision(project, decided, store.recordFile(project, decided));
            return decided;
          }
          const { evidence, ...impact } = report;
          const images = store.saveEvidence(project, input.id, evidence);
          return store.save(project, { ...record, status: 'reviewed', impact, inputs, images });
        });
      notify(action);
      return store.publicRecord(result);
    } finally {
      active = null;
      notify();
    }
  }

  async function handle(req, res, url, send) {
    try {
      if (req.method === 'GET' && url.pathname === BASE) {
        const proposals = fs.existsSync(projectDir) ? store.list(projectRoot(projectDir)) : [];
        return send(res, 200, { projectId, busy: isBusy(), proposals: proposals.map(store.publicRecord) });
      }
      const image = IMAGE.exec(url.pathname);
      if (req.method === 'GET' && image) {
        const [, id, revision, width, side] = image;
        const project = projectRoot(projectDir);
        const record = store.get(project, id);
        const data = record?.reviewRevision === revision && ['reviewed', 'approved'].includes(record.status) &&
          store.image(project, record, width, side, url.searchParams.get('section'));
        return data ? send(res, 200, data, 'image/png') : send(res, 404, { error: 'Review evidence is unavailable.' });
      }
      const action = url.pathname.slice(BASE.length + 1);
      if (req.method !== 'POST' || !['review', 'approve', 'reject'].includes(action)) {
        return send(res, 405, { error: 'Unsupported style proposal request.' });
      }
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Expected JSON.' });
      authorize(req);
      const input = await readOptions(req);
      if (!input.value) return send(res, input.status, { error: input.error });
      return send(res, 200, { proposal: await decide(input.value, action) });
    } catch (error) {
      if (error instanceof AnchorRequestError) return send(res, error.status, { error: error.message });
      if (error instanceof ProjectBusyError || error instanceof Violation || error.name === 'AbortError') {
        return send(res, 409, { error: error.message });
      }
      console.warn('Shared style review failed:', error.message);
      return send(res, 500, { error: 'The style review could not finish.' });
    }
  }
  return { handle, busy: () => Boolean(active), cancel: () => active?.abort() };
}

module.exports = { matches, createSharedRoutes };
