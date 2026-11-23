'use strict';

const skills = require('./skills');
const staff = require('./staff');

const CATALOG = '/api/skills';
const ASSIGNMENTS = '/api/skill-assignments';
const MAX_BODY_BYTES = 64 * 1024;

function matches(path) {
  return path === CATALOG || path === ASSIGNMENTS || path.startsWith(`${CATALOG}/`);
}

async function readOptions(req) {
  let bytes = 0;
  const chunks = [];
  // Drain the request while retaining at most the configured number of bytes.
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes <= MAX_BODY_BYTES) chunks.push(chunk);
    }
  } catch { return { status: 400, error: 'The skill request did not finish.' }; }
  if (bytes > MAX_BODY_BYTES) return { status: 413, error: 'Skill request is too large.' };
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return { value };
  } catch { /* The same response covers invalid JSON and non-object input. */ }
  return { status: 400, error: 'Expected a JSON object.' };
}

function createSkillRoutes({ projectDir, projectId, workers, busy }) {
  const project = { projectDir };
  return async function handle(req, res, path, send) {
    const respond = (status, value) => send(res, status, value);
    if (path === CATALOG && req.method === 'GET') {
      const positions = staff.load().positions.map(({ id, title }) => ({ id, title }));
      return respond(200, { projectId, positions, workers: workers(), skills: skills.list(project), assignments: skills.assignments(project), busy: busy() });
    }

    const id = /^\/api\/skills\/([a-z0-9-]{2,40})$/.exec(path)?.[1];
    if (id && req.method === 'GET') {
      const skill = skills.get(id, project);
      return skill ? respond(200, skill) : respond(404, { error: 'Skill not found.' });
    }
    const assign = path === ASSIGNMENTS && req.method === 'PUT';
    if (!assign && !(id && ['PUT', 'PATCH', 'DELETE'].includes(req.method))) {
      return respond(404, { error: 'Skill route not found.' });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
      return respond(415, { error: 'Expected application/json.' });
    }
    if (busy()) return respond(409, { error: 'Wait for the current work to finish before editing skills.' });
    const input = await readOptions(req);
    if (!input.value) return respond(input.status, { error: input.error });
    if (input.value.projectId !== projectId) return respond(409, { error: 'The project changed. Reload Skills before editing.' });
    if (busy()) return respond(409, { error: 'Wait for the current work to finish before editing skills.' });

    const { body, description, roles, enabled, ids, target } = input.value;
    let result;
    if (assign) {
      if (target?.worker !== undefined && !workers().some(worker => worker.id === target.worker)) {
        return respond(400, { error: 'Choose a worker in this project.' });
      }
      result = skills.assign({ ...project, target, ids });
    } else if (req.method === 'PUT') {
      result = skills.save({ ...project, id, body, description, roles, enabled });
    } else if (req.method === 'PATCH') {
      result = skills.setEnabled({ ...project, id, enabled });
    } else {
      result = skills.remove({ ...project, id });
    }
    return respond(result.ok ? 200 : 400, result);
  };
}

module.exports = { createSkillRoutes, matches };
