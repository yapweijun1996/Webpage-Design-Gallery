'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { assembleCss } = require('./layers');
const { readCatalog } = require('./catalog');

const STAGE = '/studio-preview.html';
const EXPORT = '/p/dist/index.html';
const EXPORT_FRAME = '/p/dist/preview.html';
const SECTION_FILE = /^\/p\/sections\/(\d{2}-[\w-]+)\.(html|bundle\.css)$/;
const CATALOG = /^\/i18n\/(en|zh-Hans|ms)\.json$/;
const ASSET_TYPES = {
  '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};
const PROJECT_TYPES = { ...ASSET_TYPES, '.html': 'text/html', '.md': 'text/plain', '.txt': 'text/plain' };
const STAGE_SCRIPTS = ['/preview-bridge.js', '/studio-preview.js', '/ds/runtime.js', '/ds/i18n.js'];
const ASSET_PATHS = ['/p/sections/', '/p/dist/', '/p/assets/', '/assets/generated/', '/gjh/', '/gjh-v11/', '/p/v11/', '/v11/'];
const GENERATED_IMAGE = /(?<![\w/:.-])((?:(?:\/p)?\/|\.\.?\/)?assets\/generated\/)([\w][\w.-]*\.(?:svg|png|webp|gif|avif|jpe?g|ico))(?![\w./-])(\?)?/g;
const SECTION_ID = /^[\w-]{1,100}$/;
const INERT_DOCUMENT = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
const CAPTURE_HEAD = `<style>html:root{scroll-behavior:auto!important}</style>
<script>
(() => {
  const anchor = location.hash.slice(1);
  if (!/^[\\w-]{1,100}$/.test(anchor)) return;
  // Reapply after layout changes because the native jump can leave a stale scroll offset.
  const align = () => document.getElementById(anchor)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  addEventListener('load', align, { once: true });
  addEventListener('resize', align);
})();
</script>`;
const FILE_ERRORS = ['ENOENT', 'ENOTDIR', 'ELOOP', 'ENAMETOOLONG', 'EACCES', 'EPERM', 'ERR_INVALID_ARG_VALUE'];

function within(root, file) {
  const relative = path.relative(root, file);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

function locate(root, relative, project = root) {
  try {
    const projectRoot = fs.realpathSync(project);
    const scope = fs.realpathSync(root);
    const candidate = path.resolve(scope, relative);
    if (scope !== path.resolve(projectRoot, path.relative(project, root)) || !within(scope, candidate)) return;
    const target = fs.realpathSync(candidate);
    if (within(scope, target)) return target;
  } catch (error) {
    if (!FILE_ERRORS.includes(error.code)) throw error;
  }
}

function readFile(root, relative, project) {
  const file = locate(root, relative, project);
  if (!file) return;
  try {
    if (fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return fs.readFileSync(file);
  } catch (error) {
    if (!FILE_ERRORS.includes(error.code)) throw error;
  }
}

function isolatedPolicy(origin, stage) {
  const sources = paths => paths.map(src => origin + src).join(' ');
  const assets = sources(ASSET_PATHS);
  const scripts = stage ? sources(STAGE_SCRIPTS) : assets + ' ' + sources(['/ds/']) + " 'unsafe-inline'";
  return [
    "default-src 'none'", 'sandbox allow-scripts', 'frame-ancestors ' + origin,
    "base-uri 'none'", "form-action 'none'", "frame-src 'none'", "worker-src 'none'",
    'script-src ' + scripts,
    stage ? "script-src-attr 'unsafe-inline'" : '',
    "style-src 'unsafe-inline' " + sources(['/studio.css', '/tokens.css', '/ds/']) + ' ' + assets,
    "img-src data: blob: " + assets, "font-src data: " + assets, 'media-src blob: ' + assets,
    'connect-src ' + sources(['/p/sections/', '/i18n/', '/p/dist/', '/p/assets/', '/assets/generated/']),
  ].filter(Boolean).join('; ');
}

function framePolicy(origin, child) {
  return 'frame-src ' + origin + child + "; base-uri 'none'; object-src 'none'";
}

function send(res, status, content, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', ...headers
  });
  res.end(content);
}

function html(res, content, policy) {
  send(res, 200, content, 'text/html; charset=utf-8', { 'Content-Security-Policy': policy });
}

function dimension(value, fallback, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 200 && number <= max ? number : fallback;
}

function exportWrapper(width, height, anchor, standalone) {
  const target = EXPORT_FRAME + (anchor ? '?capture=1#' + encodeURIComponent(anchor) : '');
  return `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project export preview</title>
<style>body{margin:0;background:#0b0d11}iframe{display:block;border:0;width:${width};height:${height}}</style>
<iframe id="preview" title="Project export" sandbox="allow-scripts" referrerpolicy="no-referrer" src="${target}"></iframe>
${standalone ? `<script>
const preview = document.getElementById('preview');
function setSection() {
  const hash = location.hash.slice(1);
  preview.src = '${EXPORT_FRAME}' + (/^[\\w-]{1,100}$/.test(hash) ? '#' + hash : '');
}
if (location.hash) setSection();
addEventListener('hashchange', setSection);
</script>` : ''}</html>`;
}

function createPreview({ ui, project, designSystem, library, mall }) {
  const generated = path.join(project, 'assets', 'generated');
  const assets = [
    ['/p/sections/', path.join(project, 'sections'), project],
    ['/p/dist/', path.join(project, 'dist'), project],
    ['/p/assets/', path.join(project, 'assets'), project],
    ['/assets/generated/', generated, project],
    ['/gjh/', library],
    ...['/gjh-v11/', '/p/v11/', '/v11/'].map(prefix => [prefix, mall]),
  ];

  function reviseImages(content) {
    const revisions = new Map();
    return content.replace(GENERATED_IMAGE, (url, prefix, name, query) => {
      if (!revisions.has(name)) {
        const file = locate(generated, name, project);
        const stat = file && fs.statSync(file, { bigint: true, throwIfNoEntry: false });
        // Change the browser URL for both atomic replacements and in-place edits.
        const revision = stat?.isFile() ? `${stat.ino.toString(36)}-${stat.ctimeNs.toString(36)}` : '';
        revisions.set(name, revision);
      }
      const revision = revisions.get(name);
      return revision ? `${prefix}${name}?swarm_asset=${revision}${query ? '&' : ''}` : url;
    });
  }

  return function preview(req, res, origin) {
    if (!['GET', 'HEAD'].includes(req.method)) return false;
    const requestOrigin = req.headers.origin;
    const opaque = requestOrigin === 'null';
    if (requestOrigin && requestOrigin !== origin && !opaque) return false;
    const url = new URL(req.url, 'http://preview.invalid');
    let route;
    try { route = decodeURIComponent(url.pathname); } catch (_) { return false; }
    const cors = opaque ? { 'Access-Control-Allow-Origin': 'null' } : {};

    function file(root, relative, type, headers, owner) {
      const content = readFile(root, relative, owner);
      if (content === undefined) send(res, 404, 'not found');
      else send(res, 200, content, type, headers);
      return true;
    }

    if (!opaque && (route === '/studio' || route === '/studio.html')) {
      return file(ui, 'studio.html', 'text/html; charset=utf-8', { 'Content-Security-Policy': framePolicy(origin, STAGE) });
    }
    if (!opaque && route === STAGE) {
      return file(ui, 'studio-preview.html', 'text/html; charset=utf-8', { 'Content-Security-Policy': isolatedPolicy(origin, true) });
    }
    if (!opaque && (route === '/frame' || route === EXPORT || route === '/p/dist/' ||
        (route === EXPORT_FRAME && req.headers['sec-fetch-dest'] === 'document'))) {
      const shot = route === '/frame';
      const anchor = shot ? url.searchParams.get('at') || '' : '';
      if (shot && (url.searchParams.get('src') !== EXPORT || (anchor && !SECTION_ID.test(anchor)))) {
        send(res, 400, 'bad frame request');
        return true;
      }
      const width = shot ? dimension(url.searchParams.get('w'), 393, 3000) + 'px' : '100vw';
      const height = shot ? dimension(url.searchParams.get('h'), 844, 4000) + 'px' : '100dvh';
      html(res, exportWrapper(width, height, anchor, !shot), framePolicy(origin, EXPORT_FRAME));
      return true;
    }
    if (!opaque && route === EXPORT_FRAME) {
      const dist = path.join(project, 'dist');
      const policy = isolatedPolicy(origin, false);
      if (url.searchParams.get('capture') !== '1') {
        return file(dist, 'index.html', 'text/html; charset=utf-8', { 'Content-Security-Policy': policy }, project);
      }
      const content = readFile(dist, 'index.html', project);
      if (content === undefined) send(res, 404, 'not found');
      else html(res, content.toString('utf8').replace(/<head>/i, '$&' + CAPTURE_HEAD), policy);
      return true;
    }

    const section = SECTION_FILE.exec(route);
    if (section) {
      const [, name, ext] = section;
      const root = path.join(project, 'sections');
      if (ext === 'html') {
        if (!opaque) return file(root, name + '.html', 'text/plain; charset=utf-8', cors, project);
        const content = readFile(root, name + '.html', project);
        if (content === undefined) send(res, 404, 'not found');
        else send(res, 200, reviseImages(content.toString('utf8')), 'text/plain; charset=utf-8', cors);
        return true;
      }
      const css = locate(root, '.', project) ? assembleCss(root, name) : '';
      send(res, 200, opaque ? reviseImages(css) : css, 'text/css; charset=utf-8', cors);
      return true;
    }

    const catalog = CATALOG.exec(route);
    if (catalog) {
      const data = readCatalog(designSystem, project, catalog[1]);
      send(res, 200, JSON.stringify(data), 'application/json', cors);
      return true;
    }

    // Only render resources can be read by the opaque frame. Project documents remain ordinary Studio fetches.
    const asset = assets.find(([prefix]) => route.startsWith(prefix));
    if (asset) {
      const [prefix, root, owner] = asset;
      const relative = route.slice(prefix.length);
      const type = ASSET_TYPES[path.extname(relative).toLowerCase()];
      if (type) {
        const headers = { ...cors };
        if (type === 'image/svg+xml') headers['Content-Security-Policy'] = INERT_DOCUMENT;
        return file(root, relative, type, headers, owner);
      }
    }

    if (opaque) return false;
    if (route === '/tokens.css') return file(project, 'tokens.css', 'text/css; charset=utf-8');
    if (route.startsWith('/p/')) {
      const relative = route.slice(3);
      const type = PROJECT_TYPES[path.extname(relative).toLowerCase()];
      // Untrusted documents can also be opened directly from project links.
      const headers = { 'Content-Security-Policy': INERT_DOCUMENT };
      return file(project, relative, type || 'application/octet-stream', headers);
    }
    return false;
  };
}

module.exports = { createPreview, EXPORT };
