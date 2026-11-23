'use strict';

const versions = require('./versions');
const { withProjectLock, ProjectBusyError } = require('./project-init');

const LIST = '/api/versions';
const RESTORE = '/api/rollback';
const MAX_BODY_BYTES = 2048;
const BUSY = 'Wait for the current work to finish before changing versions.';

function matches(route) {
  return route === LIST || route === RESTORE;
}

async function readOptions(req) {
  let bytes = 0;
  const chunks = [];
  try {
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes <= MAX_BODY_BYTES) chunks.push(buffer);
    }
  } catch { return { status: 400, error: 'The version request did not finish.' }; }
  if (bytes > MAX_BODY_BYTES) return { status: 413, error: 'The version request is too large.' };
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return { value };
  } catch { /* Invalid JSON is reported with the same message as a non-object body. */ }
  return { status: 400, error: 'Expected a JSON object.' };
}

function createVersionRoutes({ projectDir, projectId, busy, canRestore, changed }) {
  return async function handle(req, res, route, send) {
    const respond = (status, value) => send(res, status, value);
    if (route === LIST && req.method === 'GET') {
      try { return respond(200, { projectId, busy: busy(), versions: versions.list(projectDir) }); }
      catch { return respond(500, { error: 'The version history could not be read.' }); }
    }
    if (!matches(route) || req.method !== 'POST') return respond(405, { error: 'Unsupported version request.' });
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return respond(415, { error: 'Expected application/json.' });
    }
    if (busy()) return respond(409, { error: BUSY });

    const input = await readOptions(req);
    if (!input.value) return respond(input.status, { error: input.error });
    const { projectId: target, id, label = '' } = input.value;
    if (target !== projectId) return respond(409, { error: 'The project changed. Reload Versions before making changes.' });
    if (route === LIST && (typeof label !== 'string' || label.length > 80)) {
      return respond(400, { error: 'Use a version name of at most 80 characters.' });
    }
    if (route === RESTORE && !versions.isVersionId(id)) return respond(400, { error: 'Choose a saved version.' });

    let result;
    try {
      result = withProjectLock(projectDir, exists => {
        if (!exists) throw new ProjectBusyError('The project is unavailable. Reload Versions.');
        if (busy()) throw new ProjectBusyError(BUSY);
        if (route === LIST) return { id: versions.snapshot(projectDir, label.trim() || 'Saved version') };
        const undoId = versions.rollback(projectDir, id, { backupLabel: 'Before restore', canRestore });
        return { id, undoId };
      });
    } catch (error) {
      if (error instanceof ProjectBusyError || error instanceof versions.VersionRestoreBlockedError) {
        return respond(409, { error: error.message });
      }
      if (error instanceof versions.VersionNotFoundError) return respond(404, { error: 'That version is no longer available.' });
      return respond(500, { error: route === RESTORE ? 'The version could not be restored.' : 'The version could not be saved.' });
    }

    try { changed?.({ type: route === RESTORE ? 'rollback' : 'snapshot', ...result }); }
    catch { console.warn('Version changed, but the preview notification did not finish.'); }
    return respond(200, result);
  };
}

module.exports = { createVersionRoutes, matches };
