#!/usr/bin/env node
'use strict';
// Ask the Swarm server to generate an image through the OpenAI API. Agents never see the API key: the server holds it.
// Usage: node swarm/tools/gen-image.js --name 02-hero-bg --prompt "warm Singapore market at dusk" [--size 1536x1024] [--port 8800]
const a = process.argv.slice(2), get = k => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : ''; };
const name = get('name'), prompt = get('prompt');
if (!name || !prompt) { console.error('usage: gen-image.js --name NN-section-name --prompt "..." [--size 1536x1024]'); process.exit(2); }
const port = get('port') || process.env.SWARM_PORT || '8800';
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('Swarm port must be an integer from 1 to 65535.');
  process.exit(2);
}
const headers = { 'content-type': 'application/json' };
if (process.env.SWARM_IMAGE_TURN) headers['x-swarm-image-turn'] = process.env.SWARM_IMAGE_TURN;
fetch('http://127.0.0.1:' + port + '/api/image', {
  method: 'POST', redirect: 'error', headers, body: JSON.stringify({ name, prompt, size: get('size') || undefined }),
})
  .then(async r => { const j = await r.json().catch(() => ({})); console.log(JSON.stringify(j)); process.exit(j.ok ? 0 : 1); })
  .catch(e => { console.error('server not reachable: ' + e.message); process.exit(1); });
