'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createFlow } = require('./anchorflow');
const anchors = require('./anchors');
const integrator = require('./integrator');
const { impact } = require('../tools/impact-check');

function approvedAnchor(projectDir) {
  const root = path.join(projectDir, 'anchors');
  const directory = fs.lstatSync(root, { throwIfNoEntry: false });
  if (!directory) return null;
  if (!directory.isDirectory()) throw new Error('The project has an invalid anchor directory.');
  if (!fs.lstatSync(path.join(root, 'flow.json'), { throwIfNoEntry: false })) {
    if (!anchors.current(projectDir)) return null;
    throw new Error('The saved design anchor needs an active approval flow.');
  }
  const flow = createFlow(projectDir);
  const state = flow.state();
  if (!flow.canImplement() || state.approved !== true || !state.anchorId) {
    throw new Error('Lock the approved design anchor before publishing changes.');
  }
  const anchor = anchors.get(projectDir, state.anchorId);
  if (anchor?.status !== 'locked' || !anchors.verify(projectDir, state.anchorId).ok) {
    throw new Error('The locked design anchor or contract failed verification.');
  }
  return { id: anchor.id, contractHash: anchor.contractSha256, files: Object.keys(anchor.files) };
}

function canRestore(projectDir, source) {
  try {
    const anchor = approvedAnchor(projectDir);
    if (!anchor) return true;
    const contract = path.join(source, 'contract.json');
    const entry = fs.lstatSync(contract, { throwIfNoEntry: false });
    const digest = entry?.isFile() && createHash('sha256').update(fs.readFileSync(contract)).digest('hex');
    if (digest === anchor.contractHash) return true;
    return 'This version does not match the locked design contract.';
  } catch (error) {
    return error.message;
  }
}

const reject = (code, message, file = '') => ({ ok: false, rejected: [{ code, path: file, message }] });

function isBlankSection(before, owner) {
  const html = path.join(before, 'sections', owner + '.html');
  if (!fs.existsSync(html)) return false;
  return fs.readFileSync(html, 'utf8').trim() === `<section class="s-${owner.slice(0, 2)}" id="${owner}"></section>`;
}

function createPublication(projectDir, checkImpact = impact) {
  let tail = Promise.resolve();

  function audit(result, owner, anchor) {
    if (!result.snapshotId) return;
    const dir = path.join(projectDir, 'integration');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(dir).isDirectory()) throw new Error('Invalid integration directory.');
    const record = { at: new Date().toISOString(), owner, snapshotId: result.snapshotId,
      paths: result.merged, anchorId: anchor?.id ?? null, anchorContractSha256: anchor?.contractHash ?? null };
    const contract = path.join(projectDir, 'contract.json');
    if (fs.lstatSync(contract, { throwIfNoEntry: false })?.isFile()) {
      record.projectContractSha256 = createHash('sha256').update(fs.readFileSync(contract)).digest('hex');
    }
    fs.appendFileSync(path.join(dir, 'log.jsonl'), JSON.stringify(record) + '\n', {
      flag: fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW,
      mode: 0o600,
    });
  }

  function publish(ws, { anchor, workerId, owner, cancelled, checkOutbox }) {
    const operation = tail.then(async () => {
      if (cancelled()) return reject('cancelled', 'The turn was stopped.');
      const result = await integrator.publish(projectDir, ws, {
        anchorId: anchor?.id,
        async accept({ before, after, outbox }) {
          try { checkOutbox(outbox); }
          catch (error) { return reject('channel', error.message); }
          if (before && after) {
            let current;
            try { current = approvedAnchor(projectDir); }
            catch (error) { return reject('anchor', error.message); }
            if (current?.id !== anchor?.id || current?.contractHash !== anchor?.contractHash) {
              return reject('anchor', 'The design anchor changed during this turn.');
            }
            if (!owner) return reject('impact', 'Visual edits require a section owner.');
            let report;
            try { report = await checkImpact(before, after, { owner, firstBuild: isBlankSection(before, owner) }); }
            catch { return reject('impact', 'Chrome could not verify the candidate preview.'); }
            if (!report.ok) return reject('impact', `The candidate changes other sections: ${report.unexpected.join(', ')}.`);
            if (report.perWidth.some(sample => sample.horizontalOverflow.after > sample.horizontalOverflow.before || sample.consoleErrors.added.length)) {
              return reject('impact', 'The candidate introduces browser errors or horizontal overflow.');
            }
          }
          return cancelled() ? reject('cancelled', 'The turn was stopped.') : { ok: true };
        },
      });
      if (result.ok) {
        try { audit(result, workerId, anchor); }
        catch { console.warn('Worker changes published, but the integration log could not be written.'); }
      }
      return result;
    });
    tail = operation.catch(() => {});
    return operation;
  }

  return { publish };
}

module.exports = { approvedAnchor, canRestore, createPublication };
