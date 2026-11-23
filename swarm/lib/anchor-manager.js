'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { createFlow } = require('./anchorflow');
const anchors = require('./anchors');
const { validate } = require('./contract');
const { decodePng } = require('../tools/anchor-qa');

const BREAKPOINTS = Object.freeze({ desktop: 1440, tablet: 768, mobile: 393 });
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_HEIGHT = 2400;
const DESKTOP = 'anchor.desktop.png';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const record = value => value && typeof value === 'object' && !Array.isArray(value);

class AnchorRequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function text(value, limit) {
  return typeof value === 'string' && value.trim() && value.length <= limit;
}

function decodeFiles(files) {
  if (!record(files) || !Object.hasOwn(files, 'desktop')) throw new AnchorRequestError(400, 'Choose a desktop PNG.');
  const decoded = Object.fromEntries(Object.entries(files).map(([name, encoded]) => {
    if (!Object.hasOwn(BREAKPOINTS, name) || typeof encoded !== 'string' || encoded.length > 4 * Math.ceil(MAX_IMAGE / 3)
        || encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new AnchorRequestError(400, 'Use base64 PNG files of at most 4 MiB for desktop, tablet or mobile.');
    }
    const png = Buffer.from(encoded, 'base64');
    if (png.toString('base64') !== encoded) throw new AnchorRequestError(400, `The ${name} image is not valid base64.`);
    return [name, png];
  }));
  checkImages(decoded);
  return decoded;
}

function checkImages(files) {
  for (const [name, png] of Object.entries(files)) {
    if (!Object.hasOwn(BREAKPOINTS, name) || !Buffer.isBuffer(png) || png.length < 33 || png.length > MAX_IMAGE
        || png.readUInt32BE(16) !== BREAKPOINTS[name] || png.readUInt32BE(20) < 1 || png.readUInt32BE(20) > MAX_HEIGHT) {
      throw new AnchorRequestError(400, `The ${name} PNG must be ${BREAKPOINTS[name]} px wide and no taller than ${MAX_HEIGHT} px.`);
    }
    try { decodePng(png); }
    catch { throw new AnchorRequestError(400, `The ${name} image must be a valid 8-bit PNG.`); }
  }
}

function validateContract(input, anchor) {
  if (!record(input)) throw new AnchorRequestError(400, 'Supply the reviewed design contract as a JSON object.');
  const { rules, ...base } = input;
  const design = validate(base);
  if (!design.ok) throw new AnchorRequestError(400, `Invalid design contract: ${design.errors[0].message}`);
  const sizes = Object.keys(anchor.files).map(name => name.split('.')[1]);
  const scale = value => Array.isArray(value) && value.length > 0 && value.length <= 24
    && value.every(number => Number.isFinite(number) && number > 0 && number <= 4096);
  if (!record(rules) || Object.keys(rules).some(name => !Object.hasOwn(BREAKPOINTS, name)) || sizes.some(name => !Object.hasOwn(rules, name))) {
    throw new AnchorRequestError(400, 'Include contract rules for every supplied breakpoint.');
  }
  for (const rule of Object.values(rules)) {
    if (!record(rule) || !Number.isInteger(rule.columns) || rule.columns < 1 || rule.columns > 48
        || !scale(rule.typeScale) || !scale(rule.spacingScale) || !Array.isArray(rule.palette) || !rule.palette.length || rule.palette.length > 24
        || !rule.palette.every(color => text(color, 64)) || !text(rule.imagery, 600)) {
      throw new AnchorRequestError(400, 'Each breakpoint needs columns, typeScale, spacingScale, palette and imagery rules.');
    }
  }
  return input;
}

function writeLiveContract(projectDir, id, sha256) {
  const source = path.join(projectDir, 'anchors', id, 'contract.json');
  const destination = path.join(projectDir, 'contract.json');
  const bytes = fs.readFileSync(source, { flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW });
  if (sha256 !== hash(bytes)) throw new AnchorRequestError(409, 'The locked contract changed.');
  const previous = fs.lstatSync(destination, { throwIfNoEntry: false });
  if (previous && !previous.isFile()) throw new AnchorRequestError(409, 'The live contract is unavailable.');
  const temporary = path.join(projectDir, `.contract-${randomUUID()}`);
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temporary, destination);
  } finally { fs.rmSync(temporary, { force: true }); }
}

function createAnchorManager(projectDir) {
  const flow = createFlow(projectDir);
  const list = () => anchors.list(projectDir, { includeContract: false });
  const audit = (anchorId, reason) => ({ principal: 'studio-operator', ...(anchorId && { anchorId }), ...(reason && { reason }) });

  function transition(event, payload, dry = false) {
    const result = dry ? flow.preview(event, payload) : flow.dispatch(event, payload);
    if (!result.ok) throw new AnchorRequestError(409, result.error);
    return result.state;
  }

  function current(id) {
    if (typeof id !== 'string' || flow.state().anchorId !== id) throw new AnchorRequestError(409, 'The active anchor changed. Refresh Review.');
    const anchor = list().find(candidate => candidate.id === id);
    if (!anchor) throw new AnchorRequestError(409, 'The active anchor is missing.');
    return anchor;
  }

  function check(anchor, sha256 = anchor.files[DESKTOP]?.sha256) {
    if (!sha256 || anchor.files[DESKTOP]?.sha256 !== sha256 || !anchors.verify(projectDir, anchor.id).ok) {
      throw new AnchorRequestError(409, 'The reference changed or did not pass integrity verification.');
    }
  }

  function goals(input) {
    if (!Array.isArray(input.goals) || !input.goals.length || input.goals.length > 12 || !input.goals.every(goal => text(goal, 400))) {
      throw new AnchorRequestError(400, 'Enter 1 to 12 design goals of at most 400 characters each.');
    }
    transition('set_goals', { actor: 'manager', goals: input.goals.map(goal => goal.trim()), audit: audit() });
  }

  function draftGoals() {
    transition('anchor_ready', { actor: 'system' }, true);
    return flow.state().goals;
  }

  function saveDraft({ files, model, goals, details }) {
    const hashes = Object.entries(files).map(([size, bytes]) => [`anchor.${size}.png`, hash(bytes)]);
    // A retry can attach the same draft if it reached disk before the flow transition.
    const previous = list().at(-1);
    const reusable = previous?.status === 'draft' && previous.model === model && isDeepStrictEqual(previous.goals, goals)
      && Object.keys(previous.files).length === hashes.length && hashes.every(([file, sha256]) => previous.files[file]?.sha256 === sha256)
      && anchors.verify(projectDir, previous.id).ok;
    const { id } = reusable ? previous : anchors.create(projectDir, { files, goals, model });
    transition('anchor_ready', { actor: 'system', anchorId: id, audit: { ...audit(id), ...details } });
  }

  function importAnchor(input) {
    const goals = draftGoals();
    saveDraft({ files: decodeFiles(input.files), model: 'studio-import', goals });
  }

  function generatedDraft(observed, candidate) {
    const goals = draftGoals();
    if (!isDeepStrictEqual(goals, observed)) throw new AnchorRequestError(409, 'The design goals changed during image generation.');
    const { files, model } = candidate ?? {};
    if (!record(files) || Object.keys(files).length !== Object.keys(BREAKPOINTS).length
        || !Object.keys(BREAKPOINTS).every(name => Object.hasOwn(files, name)) || typeof model !== 'string' || !/^codex:[a-z0-9.-]+$/.test(model)) {
      throw new AnchorRequestError(502, 'The generator did not return three references and its model.');
    }
    try { checkImages(files); }
    catch (error) { throw new AnchorRequestError(502, error.message); }
    saveDraft({ files, model, goals, details: { model } });
  }

  function approve(input) {
    const anchor = current(input.anchorId);
    const payload = { actor: 'manager', anchorId: anchor.id, audit: audit(anchor.id) };
    transition('approve', payload, true);
    if (typeof input.sha256 !== 'string') throw new AnchorRequestError(400, 'A displayed desktop image digest is required.');
    check(anchor, input.sha256);
    if (anchor.status === 'draft') anchors.approve(projectDir, anchor.id, { by: 'owner' });
    else if (anchor.status !== 'approved') throw new AnchorRequestError(409, 'The anchor is unavailable for approval.');
    transition('approve', payload);
  }

  function lock(input) {
    const anchor = current(input.anchorId);
    const payload = { actor: 'manager', anchorId: anchor.id, audit: audit(anchor.id) };
    transition('lock', payload, true);
    if (typeof input.sha256 !== 'string') throw new AnchorRequestError(400, 'A displayed desktop image digest is required.');
    check(anchor, input.sha256);
    const contract = validateContract(input.contract, anchor);
    let stored;
    if (anchor.status === 'approved') stored = anchors.lock(projectDir, anchor.id, contract);
    else if (anchor.status === 'locked') {
      const { anchorId, anchorSha256, ...persisted } = anchors.get(projectDir, anchor.id).contract;
      if (!isDeepStrictEqual(contract, persisted)) throw new AnchorRequestError(409, 'Retry with the contract that was already locked.');
      stored = anchor;
    } else throw new AnchorRequestError(409, 'The anchor is unavailable for locking.');
    writeLiveContract(projectDir, anchor.id, stored.contractSha256);
    transition('lock', payload);
  }

  function revise(input, event) {
    const anchor = current(input.anchorId);
    if (!text(input.reason, 600)) throw new AnchorRequestError(400, 'Enter a reason of at most 600 characters.');
    const reason = input.reason.trim();
    const payload = { actor: 'manager', anchorId: anchor.id, reason, audit: audit(anchor.id, reason) };
    transition(event, payload, true);
    if (anchor.status !== 'superseded') anchors.supersede(projectDir, anchor.id, { by: 'owner', reason });
    else if (anchor.supersededReason !== reason) throw new AnchorRequestError(409, 'Retry with the revision reason already recorded.');
    transition(event, payload);
  }

  function reviewInput(id) {
    const anchor = current(id);
    if (flow.state().state !== 'advisor_review' || !['draft', 'superseded'].includes(anchor.status)) {
      throw new AnchorRequestError(409, 'The anchor is unavailable for advisor review.');
    }
    check(anchor);
    return anchor;
  }

  function review(id, observed, result) {
    const anchor = reviewInput(id);
    if (!isDeepStrictEqual(anchor.files, observed.files)) throw new AnchorRequestError(409, 'The reviewed reference changed.');
    if (!['pass', 'revise'].includes(result?.verdict) || !Number.isFinite(result.score) || result.score < 0 || result.score > 100
        || !Array.isArray(result.findings) || result.findings.length > 12 || !result.findings.every(item => text(item, 600))) {
      throw new AnchorRequestError(502, 'The advisor did not return a valid review.');
    }
    const event = result.verdict === 'pass' ? 'advisor_pass' : 'advisor_revise';
    const payload = { actor: 'advisor', anchorId: id, audit: { anchorId: id } };
    transition(event, payload, true);
    if (anchor.status === 'draft') {
      anchors.setAdvisor(projectDir, id, result);
      if (result.verdict === 'revise') anchors.supersede(projectDir, id, { by: 'manager', reason: 'Advisor requested a revision.' });
    } else if (!isDeepStrictEqual(anchor.advisor, result)) throw new AnchorRequestError(409, 'A prior advisor decision is pending.');
    transition(event, payload);
  }

  function image(id, size) {
    const anchor = list().find(candidate => candidate.id === id);
    const name = `anchor.${size}.png`;
    const details = anchor && Object.hasOwn(BREAKPOINTS, size) && anchor.files[name];
    if (!details) throw new AnchorRequestError(404, 'Reference image not found.');
    const file = path.join(projectDir, 'anchors', id, name);
    const entry = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!entry?.isFile() || entry.size !== details.bytes || entry.size > MAX_IMAGE || (entry.mode & 0o7777) !== 0o444) {
      throw new AnchorRequestError(409, 'Reference image failed integrity verification.');
    }
    const bytes = fs.readFileSync(file, { flag: fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW });
    if (hash(bytes) !== details.sha256) throw new AnchorRequestError(409, 'Reference image failed integrity verification.');
    return bytes;
  }

  return { flow, list, current, check, transition, goals, importAnchor, draftGoals, generatedDraft, approve, lock, revise, reviewInput, review, image };
}

module.exports = { createAnchorManager, AnchorRequestError, decodeFiles, MAX_IMAGE };
