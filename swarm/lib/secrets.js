'use strict';
// Private secret store for the Swarm server. The OpenAI API key lives only in this file (mode 0600, git-ignored .run/).
// It is never part of settings, never returned by an API, never put in a prompt, a channel message or a log.
const fs = require('node:fs');
const path = require('node:path');

const KEY_RE = /^sk-[A-Za-z0-9_\-]{20,200}$/;

function createSecrets(filePath) {
  function read() { try { const d = JSON.parse(fs.readFileSync(filePath, 'utf8')); return d && typeof d === 'object' ? d : {}; } catch (_) { return {}; } }
  function write(data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const tmp = filePath + '.tmp-' + process.pid;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try { fs.writeSync(fd, JSON.stringify(data)); fs.fchmodSync(fd, 0o600); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, filePath);
  }
  return {
    validKey: key => typeof key === 'string' && KEY_RE.test(key.trim()),
    setOpenAIKey(key) {
      if (!(typeof key === 'string' && KEY_RE.test(key.trim()))) return { ok: false, error: 'That does not look like an OpenAI API key (sk-...).' };
      const d = read(); d.openaiApiKey = key.trim(); write(d);
      return { ok: true, last4: key.trim().slice(-4) };
    },
    removeOpenAIKey() { const d = read(); delete d.openaiApiKey; write(d); return { ok: true }; },
    openAIKeyStatus() { const k = read().openaiApiKey; return k ? { set: true, last4: String(k).slice(-4) } : { set: false, last4: '' }; },
    getOpenAIKey() { const k = read().openaiApiKey; return typeof k === 'string' && KEY_RE.test(k) ? k : ''; } // server-side use only
  };
}

module.exports = { createSecrets, KEY_RE };
