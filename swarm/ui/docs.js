(function () {
  'use strict';

  const defaultFiles = ['direction.md', 'decisions.md', 'review1.md', 'review2.md'];
  const labels = {
    'direction.md': 'Direction',
    'decisions.md': 'Decisions',
    'review1.md': 'Review 1',
    'review2.md': 'Review 2'
  };
  const fence = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
  const heading = /^\s{0,3}(#{1,3})\s+(.+)$/;
  const rule = /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/;
  const listItem = /^\s{0,3}([-+*]|\d+[.)])\s+(.*)$/;
  const dateFormat = new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
  let documents = new Map();
  let baseURL = '';

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function appendInline(parent, text, depth = 0) {
    if (depth === 4 || text.length > 4096) {
      parent.append(text);
      return;
    }

    // Capture the label and destination separately, allowing one balanced pair
    // of parentheses in a destination.
    const tokens = /(`[^`]+\`)|\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|(\*\*|__)(.+?)\4|([*_])([^*_]+)\6/g;
    let offset = 0;
    for (const match of text.matchAll(tokens)) {
      const [source, code, label, destination, bold, strongText, italic, emphasisText] = match;
      if (match.index > offset) parent.append(text.slice(offset, match.index));
      if (code) {
        parent.append(element('code', '', code.slice(1, -1)));
      } else if (label) {
        const url = URL.canParse(destination) ? new URL(destination) : null;
        if (url && (url.protocol === 'https:' || url.protocol === 'http:')) {
          const link = element('a', '', label);
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener';
          parent.append(link);
        } else {
          parent.append(source);
        }
      } else {
        const emphasis = element(bold ? 'strong' : 'em');
        appendInline(emphasis, bold ? strongText : emphasisText, depth + 1);
        parent.append(emphasis);
      }
      offset = match.index + source.length;
    }
    if (offset < text.length) parent.append(text.slice(offset));
  }

  function tableCells(line) {
    return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
  }

  function startsTable(lines, index) {
    if (!lines[index]?.includes('|') || !lines[index + 1]) return false;
    const separator = tableCells(lines[index + 1]);
    return separator.length === tableCells(lines[index]).length
      && separator.every(cell => /^:?-{3,}:?$/.test(cell));
  }

  function scrollRegion(tag, label) {
    const node = element(tag, 'swarm-docs__scroll');
    node.tabIndex = 0;
    node.setAttribute('aria-label', label);
    return node;
  }

  function renderMarkdown(source) {
    const output = document.createDocumentFragment();
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    let index = 0;

    while (index < lines.length) {
      const line = lines[index++];
      if (!line.trim()) continue;
      const opening = line.match(fence);
      const title = line.match(heading);
      const item = line.match(listItem);

      if (opening) {
        const marker = opening[1];
        const closing = new RegExp('^ {0,3}' + marker[0] + '{' + marker.length + ',}\\s*$');
        const code = [];
        while (index < lines.length && !closing.test(lines[index])) code.push(lines[index++]);
        if (index < lines.length) index++;
        const pre = scrollRegion('pre', 'Code block');
        pre.append(element('code', '', code.join('\n')));
        output.append(pre);
      } else if (title) {
        const h = element('h' + title[1].length);
        appendInline(h, title[2].replace(/\s+#+\s*$/, '').trim());
        output.append(h);
      } else if (rule.test(line)) {
        output.append(element('hr'));
      } else if (startsTable(lines, index - 1)) {
        const wrap = scrollRegion('div', 'Table');
        wrap.setAttribute('role', 'region');
        const table = element('table');
        const columns = tableCells(line);
        const header = table.createTHead().insertRow();
        for (const column of columns) {
          const th = element('th');
          th.scope = 'col';
          appendInline(th, column);
          header.append(th);
        }
        index++;
        const body = table.createTBody();
        while (index < lines.length && lines[index].includes('|')) {
          const cells = tableCells(lines[index++]);
          const row = body.insertRow();
          columns.forEach((_, column) => appendInline(row.insertCell(), cells[column] ?? ''));
        }
        wrap.append(table);
        output.append(wrap);
      } else if (item) {
        const ordered = /^\d/.test(item[1]);
        const list = element(ordered ? 'ol' : 'ul');
        if (ordered) list.start = parseInt(item[1], 10);
        let current = item;
        do {
          const li = element('li');
          appendInline(li, current[2]);
          list.append(li);
          current = lines[index]?.match(listItem);
          if (!current || rule.test(lines[index]) || /^\d/.test(current[1]) !== ordered) break;
          index++;
        } while (current);
        output.append(list);
      } else {
        const paragraph = [line.trim()];
        while (index < lines.length && lines[index].trim() && !fence.test(lines[index])
          && !heading.test(lines[index]) && !rule.test(lines[index])
          && !listItem.test(lines[index]) && !startsTable(lines, index)) {
          paragraph.push(lines[index++].trim());
        }
        const p = element('p');
        appendInline(p, paragraph.join(' '));
        output.append(p);
      }
    }
    return output;
  }

  function replaceContent(doc, content) {
    const positions = new Map();
    const innerPositions = Array.from(doc.content.querySelectorAll('.swarm-docs__scroll'),
      node => [node.scrollLeft, node.scrollTop]);
    for (let node = doc.content; node; node = node.parentElement) {
      if (node.scrollTop || node.scrollLeft) positions.set(node, [node.scrollLeft, node.scrollTop]);
    }
    if (doc.content.contains(document.activeElement)) doc.summary.focus({ preventScroll: true });
    doc.content.replaceChildren(content);
    doc.content.querySelectorAll('.swarm-docs__scroll').forEach((node, index) => {
      const position = innerPositions[index];
      if (position) positions.set(node, position);
    });
    for (const [node, [left, top]] of positions) {
      if (node.isConnected) node.scrollTo({ left, top, behavior: 'instant' });
    }
  }

  function showChange(doc) {
    const unread = doc.text !== doc.seen;
    doc.badge.hidden = !unread;
    doc.notice.textContent = unread ? 'Updated since last opened' : '';
  }

  async function refresh(file) {
    const doc = documents.get(file);
    if (!doc) return;

    const request = ++doc.request;
    const isCurrent = () => documents.get(file) === doc && doc.request === request;
    let text;
    let modified;
    try {
      const response = await fetch(baseURL + file, { cache: 'no-store' });
      if (!response.ok && response.status !== 404) throw new Error('Document unavailable');
      text = response.ok ? await response.text() : '';
      modified = response.ok ? Date.parse(response.headers?.get('Last-Modified')) : NaN;
    } catch {
      if (isCurrent()) doc.status.textContent = 'Could not load document';
      return;
    }

    if (!isCurrent()) return;
    doc.status.textContent = '';
    const changed = text !== doc.text;
    const hasModified = Number.isFinite(modified);
    if (hasModified || (changed && (text.trim() || doc.time.dateTime))) {
      const updated = hasModified ? new Date(modified) : new Date();
      doc.time.dateTime = updated.toISOString();
      doc.time.title = updated.toLocaleString();
      const day = updated.toDateString() === new Date().toDateString() ? '' : dateFormat.format(updated) + ', ';
      doc.time.textContent = 'Updated ' + day + timeFormat.format(updated);
    }
    if (!changed) return;

    if (doc.text === undefined) doc.seen = text;
    doc.text = text;
    showChange(doc);
    replaceContent(doc, text.trim()
      ? renderMarkdown(text)
      : element('p', 'swarm-docs__muted', 'Not written yet'));
  }

  function init({ root, base = '', files = defaultFiles }) {
    documents = new Map();
    baseURL = base;
    root.classList.add('swarm-docs');
    root.replaceChildren(element('h2', 'swarm-docs__title', 'Meeting room'));

    for (const file of new Set(files)) {
      const details = element('details', 'swarm-docs__item');
      const summary = element('summary', 'swarm-docs__summary');
      const badge = element('span', 'swarm-docs__badge');
      badge.hidden = true;
      badge.setAttribute('aria-hidden', 'true');
      const notice = element('span', 'swarm-docs__visually-hidden');
      notice.setAttribute('aria-live', 'polite');
      const time = element('time', 'swarm-docs__time');
      const status = element('span', 'swarm-docs__status', 'Loading…');
      status.setAttribute('role', 'status');
      const content = element('div', 'swarm-docs__content');
      summary.append(element('span', 'swarm-docs__filename', Object.hasOwn(labels, file) ? labels[file] : file),
        badge, notice, time, status);
      details.append(summary, content);
      root.append(details);

      const doc = { summary, badge, notice, time, status, content, request: 0 };
      documents.set(file, doc);
      details.addEventListener('toggle', () => {
        if (details.open) {
          doc.seen = doc.text;
          showChange(doc);
        }
      });
    }

    return Promise.all(Array.from(documents.keys(), refresh));
  }

  window.SwarmDocs = { init, refresh };
})();
