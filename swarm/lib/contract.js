'use strict';

const { types } = require('node:util');

const MAX_CONTRACT_BYTES = 256 * 1024;
const MAX_PATCH_BYTES = 64 * 1024;
const MAX_OPS = 100;
const MAX_DEPTH = 32;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const INDEX = /^(0|[1-9]\d*)$/;

class ContractError extends Error {
  constructor(code, path, message) {
    super(`${path || '$'}: ${message}`);
    this.code = code;
  }
}

function invalid(path, message) {
  throw new ContractError('invalid', path, message);
}

function isRecord(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function pointer(parts) {
  return parts.map(part => '/' + part.replaceAll('~', '~0').replaceAll('/', '~1')).join('');
}

// Validate and detach JSON data before inspecting its schema or changing it.
function copyJson(value, limit) {
  let bytes = 0;

  function charge(count) {
    bytes += count;
    if (bytes > limit) invalid('', `JSON exceeds ${limit} bytes`);
  }

  function chargeString(string) {
    charge(string.length);
    charge(Buffer.byteLength(JSON.stringify(string)) - string.length);
  }

  function copy(item, parts) {
    if (parts.length > MAX_DEPTH) invalid(pointer(parts), `JSON exceeds depth ${MAX_DEPTH}`);
    if (typeof item === 'string') {
      chargeString(item);
      return item;
    }
    if (item === null || typeof item === 'boolean' || Number.isFinite(item)) {
      charge(String(item).length);
      return item;
    }
    const array = !types.isProxy(item) && Array.isArray(item);
    if (!array && !isRecord(item)) invalid(pointer(parts), 'expected JSON data');

    const keys = Reflect.ownKeys(item);
    const result = array ? [] : {};
    const count = keys.length - Number(array);
    charge(2 + Math.max(0, count - 1));
    if (array && count !== item.length) invalid(pointer(parts), 'expected a dense JSON array');

    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string') invalid(pointer(parts), 'expected string keys');
      if (FORBIDDEN_KEYS.has(key)) invalid(pointer([...parts, key]), 'forbidden key');
      if (array && (!INDEX.test(key) || Number(key) >= item.length)) {
        invalid(pointer([...parts, key]), 'invalid array index');
      }
      if (!array) {
        chargeString(key);
        charge(1);
      }
      const property = Object.getOwnPropertyDescriptor(item, key);
      if (!property.enumerable || !Object.hasOwn(property, 'value')) {
        invalid(pointer([...parts, key]), 'expected an enumerable data property');
      }
      result[key] = copy(property.value, [...parts, key]);
    }
    return result;
  }

  return copy(value, []);
}

function fields(record, required, optional, path) {
  if (!isRecord(record)) invalid(path, 'expected an object');
  for (const key of required) {
    if (!Object.hasOwn(record, key)) invalid(`${path}/${key}`, 'required field');
  }
  for (const key of Object.keys(record)) {
    if (!required.includes(key) && !optional.includes(key)) invalid(`${path}${pointer([key])}`, 'unknown field');
  }
}

function requiredString(value, path) {
  if (typeof value !== 'string' || !value.trim()) invalid(path, 'expected a non-empty string');
}

function versionNumber(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) invalid(path, 'expected a non-negative safe integer');
}

function patchPath(value, errorPath) {
  requiredString(value, errorPath);
  const isPointer = value.startsWith('/');
  if (isPointer && /~(?![01])/.test(value)) invalid(errorPath, 'invalid JSON Pointer escape');
  const parts = isPointer
    ? value.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    : value.split('.');
  if (parts.length > MAX_DEPTH || parts.some(part => !part || FORBIDDEN_KEYS.has(part))) {
    invalid(errorPath, 'invalid or forbidden path segment');
  }
  const [root, index, sectionField] = parts;
  if (root === 'tokens') return parts;
  if ((root === 'recipe' || root === 'brand') && parts.length === 1) return parts;
  if (root === 'sections' && (index === undefined || INDEX.test(index)) && (
    sectionField === undefined || sectionField === 'slots' ||
    (parts.length === 3 && (sectionField === 'id' || sectionField === 'block'))
  )) return parts;
  invalid(errorPath, 'path is outside the editable contract fields');
}

function contractSchema(contract) {
  fields(contract, ['version', 'recipe', 'brand', 'tokens', 'sections', 'owners'], [], '');
  versionNumber(contract.version, '/version');
  requiredString(contract.recipe, '/recipe');
  requiredString(contract.brand, '/brand');
  if (!isRecord(contract.tokens)) invalid('/tokens', 'expected an object');
  if (!Array.isArray(contract.sections)) invalid('/sections', 'expected an array');
  const ids = new Set();
  for (const [index, section] of contract.sections.entries()) {
    const path = `/sections/${index}`;
    fields(section, ['id', 'block', 'slots'], [], path);
    requiredString(section.id, `${path}/id`);
    if (ids.has(section.id)) invalid(`${path}/id`, 'duplicate section id');
    ids.add(section.id);
    requiredString(section.block, `${path}/block`);
    if (!isRecord(section.slots)) invalid(`${path}/slots`, 'expected an object');
  }
  if (!isRecord(contract.owners)) invalid('/owners', 'expected an object');
  const owners = new Map();
  for (const [path, owner] of Object.entries(contract.owners)) {
    const location = pointer(['owners', path]);
    const canonical = pointer(patchPath(path, location));
    requiredString(owner, location);
    if (owners.has(canonical)) invalid(location, 'duplicate ownership path');
    owners.set(canonical, owner);
  }
  return owners;
}

function outcome(run) {
  try {
    return { ok: true, ...run(), errors: [] };
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    return { ok: false, errors: [{ code: error.code, message: error.message }] };
  }
}

function validate(contract) {
  return outcome(() => {
    contractSchema(copyJson(contract, MAX_CONTRACT_BYTES));
  });
}

function applyPatch(contract, patch) {
  return outcome(() => {
    const next = copyJson(contract, MAX_CONTRACT_BYTES);
    const owners = contractSchema(next);
    const update = copyJson(patch, MAX_PATCH_BYTES);
    fields(update, ['baseVersion', 'owner', 'ops'], [], '');
    versionNumber(update.baseVersion, '/baseVersion');
    if (update.baseVersion !== next.version) {
      throw new ContractError('stale', '/baseVersion', `expected ${next.version}, received ${update.baseVersion}`);
    }
    requiredString(update.owner, '/owner');
    if (!Array.isArray(update.ops) || !update.ops.length || update.ops.length > MAX_OPS) {
      invalid('/ops', `expected 1 to ${MAX_OPS} operations`);
    }
    if (next.version === Number.MAX_SAFE_INTEGER) invalid('/version', 'cannot increment version');

    const changed = {};
    for (const [index, op] of update.ops.entries()) {
      const location = `/ops/${index}`;
      fields(op, ['op', 'path'], ['value'], location);
      if (op.op !== 'set' && op.op !== 'remove') invalid(`${location}/op`, 'expected set or remove');
      if (op.op === 'set' && !Object.hasOwn(op, 'value')) invalid(`${location}/value`, 'required for set');
      const parts = patchPath(op.path, `${location}/path`);
      const path = pointer(parts);
      let parent = next;
      for (const part of parts.slice(0, -1)) {
        if (!parent || !Object.hasOwn(parent, part)) invalid(path, 'parent path does not exist');
        parent = parent[part];
      }
      const key = parts.at(-1);
      const array = Array.isArray(parent);
      if (!array && !isRecord(parent)) invalid(path, 'parent is not an object or array');
      if (array && (!INDEX.test(key) || Number(key) > parent.length)) invalid(path, 'invalid array index');
      const exists = Object.hasOwn(parent, key);
      if (op.op === 'remove' && !exists) invalid(path, 'path does not exist');

      // Changing array length can change which value an index identifies.
      const claim = array && (op.op === 'remove' || !exists) ? pointer(parts.slice(0, -1)) : path;
      for (const [ownedPath, owner] of owners) {
        if (owner !== update.owner && (claim === ownedPath || claim.startsWith(`${ownedPath}/`) ||
          ownedPath.startsWith(`${claim}/`))) {
          throw new ContractError('conflict', path, `overlaps ${ownedPath}, owned by ${owner} at version ${next.version}`);
        }
      }

      if (op.op === 'set') parent[key] = op.value;
      else if (array) parent.splice(Number(key), 1);
      else delete parent[key];
      changed[claim] = update.owner;
    }

    next.version += 1;
    // Ownership records the paths that produced this version.
    next.owners = changed;
    const result = copyJson(next, MAX_CONTRACT_BYTES);
    contractSchema(result);
    return { contract: result };
  });
}

module.exports = { validate, applyPatch };
