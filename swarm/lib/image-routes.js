'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { ProjectBusyError, withProjectLock } = require('./project-init');

const TURN_HEADER = 'x-swarm-image-turn';
const IMAGE_NAME = /^\d\d-[a-z0-9][a-z0-9-]{1,40}$/;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_WORKSPACE_IMAGE_BYTES = 1024 * 1024;
const ONE_HOUR_MS = 60 * 60 * 1000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class ImageRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readBody(req) {
  const chunks = [];
  let bytes = 0;
  try {
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes <= MAX_BODY_BYTES) chunks.push(buffer);
    }
  } catch { throw new ImageRequestError(400, 'The image request did not finish.'); }
  if (bytes > MAX_BODY_BYTES) throw new ImageRequestError(413, 'The image request is too large.');
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch { /* Invalid JSON and non-object bodies share the same response. */ }
  throw new ImageRequestError(400, 'Expected a JSON object.');
}

function sameEntry(first, second) {
  return first.dev === second.dev && first.ino === second.ino;
}

function unsafeDestination() {
  return new ImageRequestError(409, 'The image destination is unavailable or unsafe.');
}

function checkedDirectory(dir, { create = false } = {}) {
  let stat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!stat && create) {
    fs.mkdirSync(dir);
    stat = fs.lstatSync(dir);
  }
  if (!stat?.isDirectory() || fs.realpathSync.native(dir) !== dir) throw unsafeDestination();
  return stat;
}

function imageDirectory(root, create = false) {
  const assets = path.join(root, 'assets');
  const generated = path.join(assets, 'generated');
  for (const dir of [assets, generated]) {
    if (create || fs.lstatSync(dir, { throwIfNoEntry: false })) checkedDirectory(dir, { create });
  }
  return generated;
}

function checkImageTarget(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat && (!stat.isFile() || stat.nlink !== 1)) throw unsafeDestination();
}

function loadImage(file, format) {
  const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
  let fd;
  try { fd = fs.openSync(file, O_RDONLY | O_NOFOLLOW | O_NONBLOCK); }
  catch { throw new ImageRequestError(502, 'The image provider returned an invalid image.'); }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 12 || stat.size > MAX_IMAGE_BYTES) {
      throw new ImageRequestError(502, 'The image provider returned an invalid image.');
    }
    const bytes = Buffer.alloc(stat.size);
    for (let offset = 0; offset < bytes.length;) {
      const count = fs.readSync(fd, bytes, offset, bytes.length - offset, null);
      if (!count) throw new ImageRequestError(502, 'The image provider returned an incomplete image.');
      offset += count;
    }
    const valid = format === 'png'
      ? bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) throw new ImageRequestError(502, 'The image provider returned an invalid image.');
    return bytes;
  } finally { fs.closeSync(fd); }
}

function publishImage(root, identity, name, bytes) {
  if (!sameEntry(identity, checkedDirectory(root))) throw unsafeDestination();
  const directory = imageDirectory(root, true);
  const destination = path.join(directory, name);
  checkImageTarget(destination);
  const before = checkedDirectory(directory);
  const temporary = path.join(directory, '.image-' + randomUUID());
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    try { fs.writeFileSync(fd, bytes); }
    finally { fs.closeSync(fd); }
    if (!sameEntry(before, checkedDirectory(directory))) throw unsafeDestination();
    checkImageTarget(destination);
    fs.renameSync(temporary, destination);
  } finally {
    if (sameEntry(before, checkedDirectory(directory))) fs.rmSync(temporary, { force: true });
  }
}

function createImageRoute({ projectDir, turns, busy, settings, generate, convert, key, startWrite }) {
  const project = path.resolve(projectDir);
  const workspaces = path.join(project, '.run', 'ws');
  const timestamps = [];
  return async function handle(req, res, send) {
    const respond = (status, value) => send(res, status, value);
    const hasToken = Object.hasOwn(req.headers, TURN_HEADER);
    const token = req.headers[TURN_HEADER];
    const turn = hasToken && typeof token === 'string' ? turns.get(token) : null;
    const root = turn ? turn.root : project;
    const base = turn?.base;
    const checkTurn = () => {
      if (hasToken && (!turn || !token || turns.get(token) !== turn || turn.root !== root || turn.base !== base)) {
        throw new ImageRequestError(403, 'The image turn is unavailable.');
      }
    };
    let scratch;
    let release;
    let result;
    try {
      checkTurn();
      const body = await readBody(req);
      checkTurn();
      if (!turn && busy()) throw new ImageRequestError(409, 'Wait for the current work to finish before generating an image.');
      const name = String(body.name || '').toLowerCase();
      if (!IMAGE_NAME.test(name)) throw new ImageRequestError(400, 'name must look like 02-hero-bg');
      if (turn && !name.startsWith(base + '-')) {
        throw new ImageRequestError(403, 'The image name must use the active section prefix.');
      }
      if (turn && (typeof root !== 'string' || path.resolve(root) !== root || path.dirname(root) !== workspaces)) {
        throw unsafeDestination();
      }
      const identity = checkedDirectory(root);
      const directory = imageDirectory(root);
      for (const extension of ['png', 'webp']) checkImageTarget(path.join(directory, name + '.' + extension));
      const cfg = settings();
      if (cfg.provider !== 'openai') {
        throw new ImageRequestError(409, 'Image provider is Codex; set it to OpenAI API in Settings to use this endpoint.');
      }
      const now = Date.now();
      while (timestamps.length && now - timestamps[0] > ONE_HOUR_MS) timestamps.shift();
      if (timestamps.length >= 30) throw new ImageRequestError(429, 'Image limit reached (30 per hour).');

      if (turn) {
        turn.pending += 1;
        release = () => { turn.pending -= 1; };
      } else release = startWrite();
      scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-image-'));
      const png = path.join(scratch, 'image.png');
      timestamps.push(now);
      const image = await generate({ apiKey: key(), prompt: String(body.prompt || ''), model: cfg.model,
        size: body.size || cfg.size, quality: cfg.quality, outFile: png });
      checkTurn();
      if (!image.ok) throw new ImageRequestError(502, image.error);

      let extension = 'png';
      let bytes = loadImage(png, extension);
      if (convert) {
        const webp = path.join(scratch, 'image.webp');
        try {
          if (await convert(png, webp)) {
            bytes = loadImage(webp, 'webp');
            extension = 'webp';
          }
        } catch { /* A valid PNG can still be published when conversion fails. */ }
        checkTurn();
      }
      if (turn && bytes.length > MAX_WORKSPACE_IMAGE_BYTES) {
        throw new ImageRequestError(422, 'Workspace images must be at most 1 MiB. Try a smaller image or WebP conversion.');
      }

      const filename = name + '.' + extension;
      withProjectLock(project, exists => {
        if (!exists) throw unsafeDestination();
        checkTurn();
        publishImage(root, identity, filename, bytes);
      });
      result = [200, { ok: true, path: 'assets/generated/' + filename, bytes: bytes.length, ms: image.ms }];
    } catch (error) {
      if (error instanceof ImageRequestError) result = [error.status, { ok: false, error: error.message }];
      else if (error instanceof ProjectBusyError) result = [409, { ok: false, error: error.message }];
      else result = [500, { ok: false, error: 'The image could not be saved.' }];
    } finally {
      try { if (scratch) fs.rmSync(scratch, { recursive: true, force: true }); }
      catch { console.warn('Could not remove a temporary image directory.'); }
      release?.();
    }
    return respond(...result);
  };
}

module.exports = { createImageRoute };
