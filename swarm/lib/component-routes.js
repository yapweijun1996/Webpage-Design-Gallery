'use strict';

const integrator = require('./integrator');
const { approvedAnchor, canRestore } = require('./publication');
const { AnchorRequestError } = require('./anchor-manager');
const { ProjectBusyError, withProjectLock } = require('./project-init');
const { readOptions } = require('./version-routes');

const LIST = '/api/component-versions';
const RESTORE = '/api/component-rollback';
const BUSY = 'Wait until the current Swarm work finishes.';
const REVISION = /^[a-f\d]{64}$/;

const matches = pathname => pathname === LIST || pathname === RESTORE;

function createComponentRoutes({ projectDir, projectId, catalog, busy, authorize, publish, changed }) {
  let active;
  const isBusy = () => Boolean(active) || busy();
  function notify(result) {
    try { changed(result); }
    catch { console.warn('Component history changed, but the Studio notification could not finish.'); }
  }

  function list(sectionId) {
    const { sections, manifest } = catalog();
    const selected = sections.find(({ id }) => id === sectionId) ?? sections[0];
    return {
      projectId,
      busy: isBusy(),
      sections: sections.map(({ id, label }) => ({ id, label })),
      selectedSection: selected?.id ?? null,
      versions: selected ? integrator.componentHistory(projectDir, selected.id, selected.owner, manifest) : [],
    };
  }

  function prepare({ sectionId, snapshotId, expectedRevision }) {
    return withProjectLock(projectDir, exists => {
      if (!exists) throw new ProjectBusyError('The project no longer exists.');
      if (isBusy()) throw new ProjectBusyError(BUSY);
      const { sections, manifest } = catalog();
      const selected = sections.find(({ id }) => id === sectionId);
      if (!selected) throw new AnchorRequestError(409, 'The section changed. Reload its component history.');
      const version = integrator.componentHistory(projectDir, sectionId, selected.owner, manifest)
        .find(entry => entry.snapshotId === snapshotId);
      if (!version || version.expectedRevision !== expectedRevision) {
        throw new AnchorRequestError(409, 'The component changed. Reload its history and review the version again.');
      }
      let anchor;
      try {
        anchor = approvedAnchor(projectDir);
        const allowed = canRestore(projectDir, projectDir);
        if (allowed !== true) throw new Error(allowed);
      }
      catch (error) { throw new AnchorRequestError(409, error.message); }
      const workspace = integrator.open(projectDir, selected.owner, manifest);
      try {
        integrator.stageComponentRestore(workspace, sectionId, version);
        return { workspace, anchor, workerId: selected.owner };
      } catch (error) {
        integrator.close(workspace);
        if (error.detail?.code === 'stale') throw new AnchorRequestError(409, error.message);
        throw error;
      }
    });
  }

  async function restore(input) {
    const { workspace, anchor, workerId } = prepare(input);
    const controller = new AbortController();
    active = controller;
    try {
      notify();
      const { sectionId, snapshotId } = input;
      const result = await publish(workspace, {
        anchor, workerId, owner: sectionId, restore: { sectionId, snapshotId },
        cancelled: () => controller.signal.aborted,
        checkOutbox(outbox) {
          if (outbox !== '') throw new Error('A component restore must have an empty outbox.');
        },
      });
      if (!result.ok) throw new AnchorRequestError(409, result.rejected[0]?.message || 'The component restore did not pass review.');
      if (!result.snapshotId) throw new AnchorRequestError(409, 'The selected version is already current.');
      const restored = { snapshotId, undoId: result.snapshotId, restored: result.merged };
      notify(restored);
      return restored;
    } finally {
      try { integrator.close(workspace); }
      catch { console.warn('Could not close a component restore workspace.'); }
      active = undefined;
      notify();
    }
  }

  async function handle(req, res, url, send) {
    try {
      if (url.pathname === LIST && req.method === 'GET') {
        return send(res, 200, list(url.searchParams.get('sectionId')));
      }
      if (url.pathname !== RESTORE || req.method !== 'POST') {
        return send(res, 405, { error: 'Unsupported component version request.' });
      }
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
        return send(res, 415, { error: 'Expected application/json.' });
      }
      authorize(req);
      if (isBusy()) throw new ProjectBusyError(BUSY);
      const input = await readOptions(req);
      if (!input.value) return send(res, input.status, { error: input.error });
      const { projectId: target, sectionId, snapshotId, expectedRevision } = input.value;
      if (target !== projectId) throw new AnchorRequestError(409, 'The project changed. Reload component history.');
      if (typeof sectionId !== 'string' || typeof snapshotId !== 'string' ||
          typeof expectedRevision !== 'string' || !REVISION.test(expectedRevision)) {
        throw new AnchorRequestError(400, 'Choose a component version before restoring.');
      }
      return send(res, 200, await restore({ sectionId, snapshotId, expectedRevision }));
    } catch (error) {
      if (error instanceof ProjectBusyError) return send(res, 409, { error: error.message });
      if (error instanceof AnchorRequestError) return send(res, error.status, { error: error.message });
      console.warn('Component version request failed:', error.message);
      return send(res, 500, { error: 'The component version request could not be completed.' });
    }
  }

  return { handle, busy: () => Boolean(active), cancel: () => active?.abort() };
}

module.exports = { createComponentRoutes, matches };
