'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const team = require('./team');

class ProjectInputError extends Error {}
class ProjectBusyError extends Error {}

function projectPath(root, slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) {
    throw new ProjectInputError('SWARM_PROJECT must be a single project name of letters, digits, underscores or hyphens.');
  }
  return path.join(fs.realpathSync(root), 'projects', slug);
}

function projectIdentity(directory) {
  return createHash('sha256').update(directory).digest('hex');
}

function isInside(dir, file) {
  return file.startsWith(dir + path.sep);
}

function loadRoster(root, file) {
  const selected = file ? path.resolve(file) : path.join(root, 'template', 'agents.json');
  let roster;
  try {
    if (!isInside(root, selected)) throw new ProjectInputError('Agents file must be inside swarm/.');
    const canonical = fs.realpathSync(selected);
    if (!isInside(fs.realpathSync(root), canonical) || !fs.statSync(canonical).isFile()) {
      throw new ProjectInputError('Agents file must be a regular file inside swarm/.');
    }
    roster = JSON.parse(fs.readFileSync(canonical, 'utf8'));
  } catch (error) {
    if (error instanceof ProjectInputError) throw error;
    throw new ProjectInputError('Agents file must be readable JSON.');
  }

  // The built-in and legacy brief rosters omit titles. The team editor supplies those on display.
  const hasImplicitTitle = worker => worker && typeof worker === 'object' && !Array.isArray(worker) && !Object.hasOwn(worker, 'title');
  const candidates = Array.isArray(roster)
    ? roster.map(worker => hasImplicitTitle(worker) ? { ...worker, title: 'Worker' } : worker)
    : roster;
  const result = team.validate(candidates);
  if (!result.ok) {
    const { path: field, message } = result.errors[0];
    throw new ProjectInputError(`${field} ${message}`);
  }
  result.value.forEach((worker, i) => { if (hasImplicitTitle(roster[i])) delete worker.title; });
  return result.value;
}

function parsePreparation(root, json, expectedProject) {
  let input;
  try { input = JSON.parse(json || '{}'); }
  catch { throw new ProjectInputError('Expected valid JSON.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProjectInputError('Expected a project options object.');
  }
  const { project, projectId, brief = '', agents = '' } = input;
  if (expectedProject && (project !== expectedProject.project || projectId !== expectedProject.projectId)) {
    throw new ProjectInputError('Project initialization requires the project identity served on this port.');
  }
  if (typeof brief !== 'string') throw new ProjectInputError('Brief must be a string.');
  if (typeof agents !== 'string') throw new ProjectInputError('Agents file path must be a string.');
  return { brief, roster: loadRoster(root, agents) };
}

function directoryExists(dir) {
  const entry = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!entry) return false;
  if (!entry.isDirectory() || fs.realpathSync(dir) !== dir) {
    throw new ProjectInputError('Project paths must be regular directories inside swarm/projects/.');
  }
  return true;
}

function withProjectLock(project, operation) {
  const parent = path.dirname(project);
  try { fs.mkdirSync(parent); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (!directoryExists(parent)) throw new Error('Projects directory is unavailable.');

  // Creating the workspace also acquires the lock and keeps both renames on the same filesystem.
  const workspace = path.join(parent, `.${path.basename(project)}.init`);
  try { fs.mkdirSync(workspace); }
  catch (error) {
    if (error.code === 'EEXIST') throw new ProjectBusyError('Project initialization is locked.');
    throw error;
  }

  let keepWorkspace = false;
  try {
    const exists = directoryExists(project);
    return operation(exists, (stage, activate) => {
      const next = path.join(workspace, 'next');
      const previous = path.join(workspace, 'previous');
      fs.mkdirSync(next);
      stage(next);
      if (exists) fs.renameSync(project, previous);
      let promoted = false;
      try {
        fs.renameSync(next, project);
        promoted = true;
        return activate();
      } catch (error) {
        try {
          if (promoted) fs.renameSync(project, next);
          if (exists) fs.renameSync(previous, project);
        } catch (rollbackError) {
          keepWorkspace = true;
          throw new AggregateError([error, rollbackError], `Could not restore project. Recovery files are in ${workspace}.`);
        }
        throw error;
      }
    });
  } finally {
    if (!keepWorkspace) {
      try { fs.rmSync(workspace, { recursive: true }); }
      catch (error) { console.warn('Could not clean up project initialization workspace:', error.message); }
    }
  }
}

module.exports = { ProjectInputError, ProjectBusyError, projectPath, projectIdentity, parsePreparation, withProjectLock };
