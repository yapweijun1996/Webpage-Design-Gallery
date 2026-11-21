'use strict';
// OpenAI Images API client (image generation only). Zero dependencies; the HTTP call is injectable for tests.
const fs = require('node:fs');
const path = require('node:path');

const ENDPOINT = 'https://api.openai.com/v1/images/generations';
const MODELS_ENDPOINT = 'https://api.openai.com/v1/models';
const SIZES = new Set(['auto', '1024x1024', '1536x1024', '1024x1536']);
const QUALITIES = new Set(['auto', 'low', 'medium', 'high']);

function clean(message, key) { return String(message || '').split(key || '\u0000').join('[key]').replace(/sk-[A-Za-z0-9_\-]{8,}/g, '[key]').slice(0, 300); }

// Generate one image; resolves { ok, file, bytes, ms } or { ok:false, error } (never contains the key).
async function generate({ apiKey, prompt, model = 'gpt-image-1', size = '1536x1024', quality = 'high', outFile, fetchImpl = globalThis.fetch, timeoutMs = 150000 }) {
  if (!apiKey) return { ok: false, error: 'No OpenAI API key saved.' };
  if (typeof prompt !== 'string' || prompt.trim().length < 3 || prompt.length > 4000) return { ok: false, error: 'The prompt must be 3 to 4000 characters.' };
  if (!/^[a-z0-9][a-z0-9.\-]{1,40}$/.test(model)) return { ok: false, error: 'Invalid model name.' };
  if (!SIZES.has(size) || !QUALITIES.has(quality)) return { ok: false, error: 'Invalid size or quality.' };
  const t0 = Date.now(), ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model, prompt, size, quality, n: 1 })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: clean((data.error && data.error.message) || 'OpenAI returned HTTP ' + res.status, apiKey), status: res.status };
    const item = data.data && data.data[0];
    let buf;
    if (item && item.b64_json) buf = Buffer.from(item.b64_json, 'base64');
    else if (item && item.url) { const r = await fetchImpl(item.url, { signal: ctl.signal }); buf = Buffer.from(await r.arrayBuffer()); }
    if (!buf || buf.length < 100) return { ok: false, error: 'OpenAI returned no image.' };
    if (outFile) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, buf); }
    return { ok: true, file: outFile || '', bytes: buf.length, ms: Date.now() - t0, buffer: outFile ? undefined : buf };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'OpenAI timed out.' : clean(e && e.message, apiKey) };
  } finally { clearTimeout(timer); }
}

// Cheap key check: list models (no billing).
async function testKey({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  if (!apiKey) return { ok: false, message: 'No OpenAI API key saved.' };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(MODELS_ENDPOINT, { headers: { authorization: 'Bearer ' + apiKey }, signal: ctl.signal });
    if (res.ok) return { ok: true, message: 'The key works.' };
    const data = await res.json().catch(() => ({}));
    return { ok: false, message: clean((data.error && data.error.message) || 'OpenAI returned HTTP ' + res.status, apiKey) };
  } catch (e) { return { ok: false, message: e && e.name === 'AbortError' ? 'OpenAI timed out.' : clean(e && e.message, apiKey) }; }
  finally { clearTimeout(timer); }
}

module.exports = { generate, testKey, SIZES, QUALITIES };
