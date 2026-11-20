(function () {
  'use strict';

  const defaultColor = '#8b93a7';
  const builtIns = [
    { id: 'owner', name: 'Owner', color: '#8ab4ff' },
    { id: 'claude', name: 'Claude', color: '#d97757' },
    { id: 'system', name: 'System', color: defaultColor }
  ];
  const everyone = { name: 'everyone', color: '#8ab4ff', aliases: ['everyone', 'all'] };
  const timeFormat = new Intl.DateTimeFormat([], {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const fullTimeFormat = new Intl.DateTimeFormat([], { dateStyle: 'full', timeStyle: 'long' });
  const filterKey = 'swarm.channel.filters';
  const filterNames = ['All', 'Talk', 'Key', 'Mine']; // Talk = agents speaking to each other (the discussion)
  const messageLimit = 800;
  const groupWindow = 120000;
  const batchSize = 150;
  const drafts = new WeakMap();
  let channel;
  let nextInstance = 0;

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = 'swarm-channel__' + className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function button(className, value) {
    const node = element('button', className, value);
    node.type = 'button';
    return node;
  }

  function icon(pathData) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
    return svg;
  }

  function tint(node, participant) {
    node.style.setProperty('--participant-color', participant.color);
    return node;
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function readFilters() {
    const filters = { mode: 'All', system: true, search: '' };
    try {
      const saved = JSON.parse(localStorage.getItem(filterKey));
      if (filterNames.includes(saved?.mode)) filters.mode = saved.mode;
      if (typeof saved?.system === 'boolean') filters.system = saved.system;
      if (typeof saved?.search === 'string') filters.search = saved.search;
    } catch {
      // The toolbar still works when storage is unavailable.
    }
    return filters;
  }

  function isLocal(id) {
    return id === 'owner' || id === 'claude';
  }

  function createChannel({ root, agents, send, onJump }) {
    const workers = Object.entries(agents || {}).map(([key, agent]) => {
      const id = String(agent.id === undefined ? key : agent.id);
      const name = agent.name || (id === '00' ? 'Manager' : 'Agent ' + Number(id));
      const section = agent.section || '';
      const aliases = [name, id, section];
      if (/^\d+$/.test(id)) {
        const number = Number(id);
        aliases.push(String(number));
        if (id === '00') aliases.push('manager');
        else aliases.push('agent' + number, 'agent ' + number);
      }
      return {
        id, name, section,
        color: CSS.supports('color', agent.color || '') ? agent.color : defaultColor,
        aliases: aliases.filter(Boolean).map(value => value.toLowerCase())
      };
    });
    workers.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const participants = new Map(builtIns.concat(workers).map(agent => [agent.id, agent]));
    const manager = participants.get('00') || {
      id: '00', name: 'Manager', color: defaultColor, aliases: ['manager']
    };
    const aliases = new Map();
    workers.concat(manager).forEach(agent => agent.aliases.forEach(alias => {
      if (!aliases.has(alias)) aliases.set(alias, agent);
    }));
    aliases.set('all', everyone);
    aliases.set('everyone', everyone);
    const aliasPattern = Array.from(aliases.keys()).sort((a, b) => b.length - a.length)
      .map(escapeRegex).join('|');
    const mentionPattern = new RegExp('(^|[^\\p{L}\\p{N}_@])@(' + aliasPattern + ')(?![\\p{L}\\p{N}_-])', 'giu');
    const instanceId = 'swarm-channel-' + (++nextInstance);
    const filters = readFilters();
    const statuses = new Map();
    const seen = new Set();
    const records = [];
    const recordsByRow = new WeakMap();
    const recordsByText = new WeakMap();
    const pendingNotices = new Map();
    const recent = new Map();
    let visible = [];
    let previous;
    let rendered = 0;
    let historySize = 0;
    let renderFrame = 0;
    let filterFrame = 0;
    let searchQuery = '';
    let searchPattern;
    let unread = 0;
    let following = true;
    let busy = false;
    let sending = false;
    let composing = false;
    let matchContext;
    let matches = [];
    let selectedIndex = 0;
    let quickNames = [];
    let measuredWidth = 0;

    function participant(id) {
      return participants.get(id) || { name: id, color: defaultColor };
    }

    function appendMarked(node, value, ranges, offset = 0) {
      let position = 0;
      for (const match of ranges) {
        const start = Math.max(0, match.index - offset);
        const end = Math.min(value.length, match.index + match[0].length - offset);
        if (end <= start) continue;
        node.append(value.slice(position, start), element('mark', 'highlight', value.slice(start, end)));
        position = end;
      }
      if (position < value.length) node.append(value.slice(position));
    }

    function appendText(node, text, withMentions = false) {
      if (searchPattern) searchPattern.lastIndex = 0;
      const ranges = searchPattern ? Array.from(text.matchAll(searchPattern)) : [];
      if (!withMentions) {
        appendMarked(node, text, ranges);
        return;
      }
      let position = 0;
      for (const match of text.matchAll(mentionPattern)) {
        const participant = aliases.get(match[2].toLowerCase());
        if (!participant) continue;
        const start = match.index + match[1].length;
        const label = '@' + match[2];
        const mention = tint(element('span', 'chip'), participant);
        appendMarked(node, text.slice(position, start), ranges, position);
        appendMarked(mention, label, ranges, start);
        node.append(mention);
        position = start + label.length;
      }
      appendMarked(node, text.slice(position), ranges, position);
    }

    const panel = element('section');
    panel.className = 'swarm-channel';
    panel.setAttribute('aria-label', 'Team channel');

    const toolbar = element('div', 'toolbar');
    const segment = element('div', 'segment');
    segment.setAttribute('role', 'group');
    segment.setAttribute('aria-label', 'Filter messages');
    const modeButtons = filterNames.map(mode => {
      const control = button('filter', mode);
      control.addEventListener('click', () => {
        filters.mode = mode;
        applyFilters();
      });
      segment.append(control);
      return control;
    });
    const noticesButton = button('notices', 'System');
    noticesButton.setAttribute('aria-label', 'System notices');
    noticesButton.setAttribute('role', 'switch');
    noticesButton.addEventListener('click', () => {
      filters.system = !filters.system;
      applyFilters();
    });
    const searchBox = element('label', 'search');
    searchBox.append(icon('m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z'));
    const search = element('input', 'search-input');
    search.type = 'search';
    search.placeholder = 'Search';
    search.maxLength = messageLimit;
    search.value = filters.search;
    search.setAttribute('aria-label', 'Search channel');
    searchBox.append(search);
    toolbar.append(segment, noticesButton, searchBox);

    const timeline = element('div', 'timeline');
    const messages = element('ol', 'messages');
    messages.tabIndex = 0;
    messages.setAttribute('role', 'list');
    messages.setAttribute('aria-label', 'Channel messages');
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions text');
    const empty = element('div', 'empty');
    empty.setAttribute('role', 'status');
    const latest = button('latest', 'Jump to latest');
    const unreadCount = element('span', 'unread');
    latest.append(unreadCount, icon('M12 4v15m-5-5 5 5 5-5'));
    latest.hidden = true;
    timeline.append(messages, empty, latest);

    const form = element('form', 'composer');
    const typing = element('div', 'typing');
    typing.setAttribute('role', 'status');
    typing.hidden = true;
    const dots = element('span', 'dots');
    dots.setAttribute('aria-hidden', 'true');
    dots.append(element('i'), element('i'), element('i'));
    const typingText = element('span');
    typing.append(dots, typingText);
    const error = element('div', 'error', 'Message could not be sent. Try again.');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const input = element('textarea', 'input');
    input.rows = 1;
    input.maxLength = messageLimit;
    input.value = drafts.get(root) || '';
    input.placeholder = 'Message the team…';
    input.setAttribute('aria-label', 'Message the team');
    input.setAttribute('aria-autocomplete', 'list');
    const suggestions = element('div', 'suggestions');
    suggestions.id = instanceId + '-suggestions';
    suggestions.setAttribute('role', 'listbox');
    suggestions.setAttribute('aria-label', 'Mention a participant');
    suggestions.hidden = true;
    input.setAttribute('aria-controls', suggestions.id);
    const sendButton = element('button', 'send');
    sendButton.type = 'submit';
    sendButton.setAttribute('aria-label', 'Send');
    sendButton.append(icon('M22 2 9 15m13-13-8 20-5-7-7-5 20-8Z'));
    const field = element('div', 'field');
    field.append(input, sendButton);
    const meta = element('div', 'composer-meta');
    const hint = element('span', 'hint', 'Enter sends, Shift+Enter new line, @ mentions');
    hint.id = instanceId + '-hint';
    input.setAttribute('aria-describedby', hint.id);
    const counter = element('span', 'counter');
    counter.hidden = true;
    meta.append(hint, counter);
    const quick = element('div', 'quick');
    quick.setAttribute('role', 'group');
    quick.setAttribute('aria-label', 'Quick mentions');
    form.append(suggestions, typing, error, field, meta, quick);
    panel.append(toolbar, timeline, form);
    root.replaceChildren(panel);

    function nearBottom() {
      if (!messages.clientHeight) return following;
      return messages.scrollHeight - messages.clientHeight - messages.scrollTop <= 40;
    }

    function updateLatest() {
      latest.hidden = following;
      unreadCount.hidden = unread === 0;
      unreadCount.textContent = String(unread);
      latest.setAttribute('aria-label', 'Jump to latest' + (unread ? ' (' + unread + ' unread)' : ''));
    }

    function scrollToBottom() {
      following = true;
      unread = 0;
      if (messages.clientHeight) messages.scrollTop = messages.scrollHeight;
      updateLatest();
    }

    function showScrollState() {
      following = nearBottom();
      if (following) unread = 0;
      updateLatest();
    }

    function markActive(id) {
      if (id === '00' || !workers.some(agent => agent.id === id)) return;
      recent.delete(id);
      recent.set(id, participant(id));
      if (recent.size > 3) recent.delete(recent.keys().next().value);
    }

    function remember(msg) {
      const id = String(msg.id);
      if (seen.has(id)) return;
      seen.add(id);
      const from = String(msg.from);
      const author = participant(from);
      const text = String(msg.text || '');
      const isNotice = msg.kind === 'system' || from === 'system';
      if (isNotice && previous?.isNotice && previous.text === text) {
        const record = previous.record;
        record.notices.push(msg);
        return record;
      }

      const recipients = (msg.to || []).map(String);
      const assignees = msg.kind === 'assign' ? recipients.map(participant) : [];
      const task = msg.kind === 'assign' ? String(msg.task || '') : '';
      const followGroup = !isNotice && previous && !previous.isNotice && previous.from === from &&
        msg.ts >= previous.ts && msg.ts - previous.ts <= groupWindow;
      const record = {
        id, from, author, text, task, assignees, isNotice, notices: isNotice ? [msg] : null,
        kind: msg.kind, ts: msg.ts, index: records.length, pendingUnread: 0,
        group: followGroup ? previous.record.group : id,
        isMine: isLocal(from) || recipients.some(isLocal),
        isTalk: msg.kind === 'msg' && !isLocal(from) && from !== '00' && from !== 'system' && recipients.some(id => id !== from && id !== '00' && !isLocal(id)),
        isKey: isLocal(from) || from === '00' || ['assign', 'decision', 'done'].includes(msg.kind),
        canClamp: !isNotice && !isLocal(from),
        long: Array.from(text).length + (task === text ? 0 : Array.from(task).length) > 280
      };
      record.searchFields = [text, task, author.name].concat(assignees.map(agent => '@' + agent.name));
      previous = { isNotice, text, from, ts: msg.ts, record };
      records.push(record);
      if (!isNotice) markActive(from);
      return record;
    }

    function isVisible(record) {
      if (record.isNotice && !filters.system) return false;
      if (filters.mode === 'Talk' && !record.isTalk) return false;
      if (filters.mode === 'Key' && !record.isKey) return false;
      if (filters.mode === 'Mine' && !record.isMine) return false;
      return !searchPattern || record.searchFields.some(field => {
        searchPattern.lastIndex = 0;
        return searchPattern.test(field);
      });
    }

    function updateNotice(record) {
      const count = record.notices.length;
      record.badge.hidden = count === 1;
      record.badge.textContent = '×' + count;
      record.badge.setAttribute('aria-label', count + ' occurrences');
      record.row.title = count > 1 ? '#' + record.id + '–#' + record.notices[count - 1].id : '';
    }

    function makeRow(record) {
      const row = element('li', record.isNotice ? 'notice' : 'entry');
      row.tabIndex = -1;
      recordsByRow.set(row, record);
      record.row = row;
      record.messageId = element('span', 'message-id', '#' + record.id);
      if (record.isNotice) {
        record.textNode = element('span', 'notice-text');
        record.badge = element('span', 'notice-count');
        const label = element('span', 'notice-label');
        label.append(record.textNode, record.badge);
        row.append(label, record.messageId);
        updateNotice(record);
        return row;
      }

      tint(row, record.author);
      const header = element('div', 'header');
      const time = element('time', 'time');
      const date = new Date(record.ts);
      if (Number.isFinite(date.getTime())) {
        time.textContent = timeFormat.format(date);
        time.dateTime = date.toISOString();
        time.title = fullTimeFormat.format(date);
      }
      const author = onJump ? button('sender') : element('span', 'sender');
      if (onJump) author.addEventListener('click', () => onJump(record.from));
      const dot = element('span', 'sender-dot');
      dot.setAttribute('aria-hidden', 'true');
      record.name = element('span', 'sender-name');
      author.append(dot, record.name);
      header.append(time, author);
      record.header = header;
      const body = element('div', 'body');
      record.textNode = element('div', 'text');
      if (record.kind === 'decision') {
        body.classList.add('swarm-channel__decision');
        body.append(element('strong', 'decision-label', 'Decision'));
      }
      if (record.kind === 'done') body.classList.add('swarm-channel__done');
      body.append(record.textNode);
      if (record.canClamp) {
        record.toggle = button('expand', 'Show more');
        record.textNode.id = instanceId + '-message-' + record.index;
        record.toggle.setAttribute('aria-controls', record.textNode.id);
        record.toggle.hidden = true;
        record.toggle.addEventListener('click', () => {
          const open = record.toggle.getAttribute('aria-expanded') === 'true';
          record.expanded = !open;
          record.searchCollapsed = open ? searchPattern : undefined;
          updateClamp(record);
        });
        body.append(record.toggle);
        if (!record.long && textResize) {
          recordsByText.set(record.textNode, record);
          textResize.observe(record.textNode);
        }
      }
      const context = element('span', 'continuation-label', [time.textContent, record.author.name].filter(Boolean).join(' · '));
      row.append(header, context, body, record.messageId);
      return row;
    }

    function updateClamp(record) {
      const collapsible = record.long || record.overSixLines;
      const open = record.expanded || (record.highlighted && record.searchCollapsed !== searchPattern);
      record.toggle.hidden = !collapsible;
      record.toggle.setAttribute('aria-expanded', String(Boolean(open)));
      record.toggle.textContent = open ? 'Show less' : 'Show more';
      record.textNode.classList.toggle('swarm-channel__text--clamped', Boolean(collapsible && !open));
    }

    function paintText(record) {
      if (record.painted && record.pattern === searchPattern) return;
      record.painted = true;
      record.pattern = searchPattern;
      const node = record.textNode;
      node.replaceChildren();
      if (record.name) {
        record.name.replaceChildren();
        appendText(record.name, record.author.name);
      }
      if (record.kind === 'assign') {
        const arrow = element('span', 'assignment-arrow', '→ ');
        arrow.setAttribute('aria-hidden', 'true');
        node.append(arrow, element('span', 'sr-only', 'Assigned to '));
        record.assignees.forEach(agent => {
          const label = tint(element('span', 'chip'), agent);
          appendText(label, '@' + agent.name);
          node.append(label, ' ');
        });
      } else if (record.kind === 'done') {
        const check = element('span', 'check', '✓ ');
        check.setAttribute('aria-hidden', 'true');
        node.append(check, element('span', 'sr-only', 'Done: '));
      }
      appendText(node, record.task || record.text, true);
      if (record.task && record.task !== record.text && record.text) {
        const detail = element('span', 'task-detail', ' · ');
        appendText(detail, record.text, true);
        node.append(detail);
      }
      if (record.toggle) {
        record.highlighted = Boolean(searchPattern && node.querySelector('mark'));
        updateClamp(record);
      }
    }

    function updateRow(record, previousVisible) {
      record.row.hidden = !isVisible(record);
      if (record.row.hidden) return false;
      if (record.header) {
        record.row.classList.toggle('swarm-channel__entry--continued', previousVisible?.group === record.group);
      }
      paintText(record);
      return true;
    }

    function updateEmpty() {
      const label = historySize > rendered ? '' :
        (records.length ? 'No matching messages' : 'No messages yet');
      empty.hidden = Boolean(visible.length || !label);
      if (!empty.hidden && empty.textContent !== label) empty.textContent = label;
    }

    function renderBatch() {
      renderFrame = 0;
      if (!root.contains(panel)) return;
      const follow = nearBottom();
      const batch = document.createDocumentFragment();
      const end = Math.min(rendered + batchSize, records.length);
      for (const [record, count] of pendingNotices) {
        updateNotice(record);
        if (!follow && !record.row.hidden) unread += count;
      }
      pendingNotices.clear();
      while (rendered < end) {
        const record = records[rendered++];
        batch.append(makeRow(record));
        if (updateRow(record, visible[visible.length - 1])) {
          visible.push(record);
          if (!follow) unread += record.pendingUnread;
        }
        record.pendingUnread = 0;
      }
      messages.append(batch);
      if (rendered >= historySize) messages.removeAttribute('aria-busy');
      updateQuickMentions();
      updateEmpty();
      if (follow) scrollToBottom();
      else showScrollState();
      if (rendered < records.length) renderFrame = requestAnimationFrame(renderBatch);
    }

    function add(msg) {
      const record = remember(msg);
      if (!record) return;
      if (record.row) {
        pendingNotices.set(record, (pendingNotices.get(record) || 0) + 1);
      } else {
        record.pendingUnread += 1;
      }
      if (!renderFrame) renderFrame = requestAnimationFrame(renderBatch);
    }

    function setHistory(history) {
      cancelAnimationFrame(renderFrame);
      records.length = 0;
      rendered = 0;
      visible = [];
      previous = undefined;
      pendingNotices.clear();
      seen.clear();
      recent.clear();
      textResize?.disconnect();
      messages.setAttribute('aria-busy', 'true');
      messages.replaceChildren();
      history.forEach(remember);
      historySize = records.length;
      scrollToBottom();
      renderBatch();
    }

    function scrollAnchor(keep) {
      const viewport = messages.getBoundingClientRect();
      let low = 0;
      let high = visible.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (visible[middle].row.getBoundingClientRect().bottom <= viewport.top) low = middle + 1;
        else high = middle;
      }
      const first = visible[low];
      if (!first) return;
      const firstTop = first.row.getBoundingClientRect().top;
      if (!keep) return { record: first, top: firstTop };

      // Preserve a readable row when the filter removes content around the viewport edge.
      let fallback;
      for (let index = low; index < visible.length; index += 1) {
        const record = visible[index];
        if (!keep(record)) continue;
        const top = record.row.getBoundingClientRect().top;
        if (top >= viewport.bottom) return fallback || { record, top: firstTop };
        if (top >= viewport.top) return { record, top };
        fallback = { record, top };
      }
      return fallback;
    }

    function syncFilterControls() {
      modeButtons.forEach((control, index) => {
        control.setAttribute('aria-pressed', String(filterNames[index] === filters.mode));
      });
      noticesButton.setAttribute('aria-checked', String(filters.system));
      const query = filters.search.trim();
      if (query !== searchQuery) {
        searchQuery = query;
        searchPattern = query ? new RegExp(escapeRegex(query), 'giu') : undefined;
      }
    }

    function applyFilters() {
      cancelAnimationFrame(filterFrame);
      filters.search = search.value;
      syncFilterControls();
      try {
        localStorage.setItem(filterKey, JSON.stringify(filters));
      } catch {
        // Filtering does not depend on storage.
      }

      const follow = nearBottom();
      const anchor = follow ? undefined : scrollAnchor(isVisible);
      visible = [];
      for (let index = 0; index < rendered; index += 1) {
        const record = records[index];
        if (updateRow(record, visible[visible.length - 1])) visible.push(record);
      }
      updateEmpty();
      if (follow) scrollToBottom();
      else {
        if (anchor) messages.scrollTop += anchor.record.row.getBoundingClientRect().top - anchor.top;
        showScrollState();
      }
    }

    function closeSuggestions() {
      matchContext = undefined;
      matches = [];
      suggestions.hidden = true;
      suggestions.replaceChildren();
      input.removeAttribute('aria-activedescendant');
    }

    function selectSuggestion(index) {
      selectedIndex = index;
      Array.from(suggestions.children).forEach((option, i) => {
        option.setAttribute('aria-selected', String(i === index));
      });
      const option = suggestions.children[index];
      input.setAttribute('aria-activedescendant', option.id);
      const optionTop = option.offsetTop;
      if (optionTop < suggestions.scrollTop) suggestions.scrollTop = optionTop;
      if (optionTop + option.offsetHeight > suggestions.scrollTop + suggestions.clientHeight) {
        suggestions.scrollTop = optionTop + option.offsetHeight - suggestions.clientHeight;
      }
    }

    function insertMention(agent, start, end) {
      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      const prefix = /[\p{L}\p{N}_@]$/u.test(before) ? ' ' : '';
      const suffix = !after || /^[\p{L}\p{N}_@]/u.test(after) ? ' ' : '';
      const mention = prefix + '@' + agent.name;
      const available = messageLimit - before.length - after.length;
      if (mention.length <= available) {
        input.setRangeText(mention + suffix.slice(0, available - mention.length), start, end, 'end');
      }
      input.focus({ preventScroll: true });
      closeSuggestions();
      updateComposer();
    }

    function updateSuggestions() {
      if (input.selectionStart !== input.selectionEnd) {
        closeSuggestions();
        return;
      }
      const end = input.selectionEnd;
      const before = input.value.slice(0, end);
      const match = /(^|[^\p{L}\p{N}_@])@([\p{L}\p{N}_ -]*)$/u.exec(before);
      if (!match) {
        closeSuggestions();
        return;
      }
      const query = match[2].toLowerCase().replace(/\s+/g, ' ');
      const start = match.index + match[1].length;
      if (matchContext?.start === start && matchContext.end === end && matchContext.query === query) return;
      const choices = participants.has('00') ? workers.concat(everyone) : [manager].concat(workers, everyone);
      const nextMatches = choices.filter(agent =>
        agent.aliases.some(alias => alias.startsWith(query)));
      if (!nextMatches.length) {
        closeSuggestions();
        return;
      }
      matchContext = { start, end, query };
      matches = nextMatches;
      suggestions.replaceChildren();
      matches.forEach((agent, i) => {
        const option = tint(element('div', 'option'), agent);
        option.id = suggestions.id + '-' + i;
        option.setAttribute('role', 'option');
        option.append(element('span', 'option-name', '@' + agent.name));
        if (agent.section) option.append(element('span', 'option-section', agent.section));
        option.addEventListener('mousedown', event => event.preventDefault());
        option.addEventListener('click', () => insertMention(agent, start, end));
        suggestions.append(option);
      });
      suggestions.scrollTop = 0;
      suggestions.hidden = false;
      selectSuggestion(0);
    }

    function updateQuickMentions() {
      const recentAgents = Array.from(recent.values()).reverse();
      const names = recentAgents.map(agent => agent.id);
      if (quick.children.length && names.join(',') === quickNames.join(',')) return;
      const focused = quick.contains(document.activeElement) ? document.activeElement.dataset.mention : '';
      quickNames = names;
      quick.replaceChildren();
      [manager, everyone].concat(recentAgents).forEach(agent => {
        const label = '@' + (agent === manager ? 'Manager' : agent.name);
        const control = tint(button('quick-button'), agent);
        control.dataset.mention = label;
        control.title = label;
        control.append(element('span', 'quick-chip', label));
        control.addEventListener('mousedown', event => event.preventDefault());
        control.addEventListener('click', () => insertMention(
          agent === manager ? { name: 'Manager' } : agent, input.selectionStart, input.selectionEnd
        ));
        quick.append(control);
        if (focused === label) control.focus({ preventScroll: true });
      });
    }

    function fitInput() {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 2 + 'px';
    }

    function updateComposer() {
      const follow = nearBottom();
      if (root.contains(panel)) drafts.set(root, input.value);
      sendButton.disabled = busy || sending || composing || !input.value.trim();
      counter.hidden = input.value.length <= 700;
      if (!counter.hidden) counter.textContent = input.value.length + '/' + messageLimit;
      fitInput();
      if (follow) scrollToBottom();
    }

    function updateTyping() {
      const follow = nearBottom();
      typing.hidden = !busy;
      if (busy) {
        const working = workers.filter(agent => (statuses.get(agent.id) || '').startsWith('working'));
        const label = 'Team is working' + (working.length
          ? ' · ' + working.map(agent => agent.name).join(', ') : '');
        if (typingText.textContent !== label) typingText.textContent = label;
      }
      if (follow) scrollToBottom();
    }

    async function submit() {
      const draft = input.value;
      if (busy || sending || composing || !draft.trim()) return;
      const hadFocus = form.contains(document.activeElement);
      sending = true;
      error.hidden = true;
      closeSuggestions();
      updateComposer();
      try {
        const result = await send(draft.trim());
        if (result?.ok === false) throw new Error('Message rejected');
        if (input.value === draft) input.value = '';
      } catch {
        error.hidden = false;
      } finally {
        sending = false;
        updateComposer();
        if (hadFocus && document.activeElement === document.body) input.focus({ preventScroll: true });
      }
    }

    const textResize = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
      const lineHeight = parseFloat(getComputedStyle(messages).lineHeight);
      const changed = [];
      for (const { target, contentRect } of entries) {
        if (!contentRect.width) continue;
        const record = recordsByText.get(target);
        const overSixLines = target.scrollHeight > Math.ceil(6 * lineHeight);
        if (overSixLines !== Boolean(record.overSixLines)) changed.push({ record, overSixLines });
      }
      if (!changed.length) return;
      const follow = nearBottom();
      changed.forEach(({ record, overSixLines }) => {
        record.overSixLines = overSixLines;
        updateClamp(record);
      });
      if (follow) scrollToBottom();
    }) : null;

    if (typeof ResizeObserver === 'function') {
      const resize = new ResizeObserver(([entry]) => {
        if (!root.contains(panel)) {
          resize.disconnect();
          textResize.disconnect();
          return;
        }
        if (!entry.contentRect.width) return;
        if (measuredWidth !== entry.contentRect.width) {
          measuredWidth = entry.contentRect.width;
          fitInput();
        }
        if (following) scrollToBottom();
      });
      resize.observe(messages);
    }

    search.addEventListener('input', () => {
      cancelAnimationFrame(filterFrame);
      filterFrame = requestAnimationFrame(applyFilters);
    });
    messages.addEventListener('scroll', () => {
      if (messages.clientHeight) showScrollState();
    }, { passive: true });
    messages.addEventListener('keydown', event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key) || event.altKey || event.shiftKey ||
          event.ctrlKey || event.metaKey) return;
      if (event.target !== messages && !recordsByRow.has(event.target)) return;
      const current = recordsByRow.get(event.target) || scrollAnchor()?.record;
      const index = visible.indexOf(current);
      const offset = event.target === messages ? 0 : event.key === 'ArrowDown' ? 1 : -1;
      const target = visible[Math.max(0, index + offset)];
      if (!target) return;
      event.preventDefault();
      target.row.focus({ preventScroll: true });
      const bounds = target.row.getBoundingClientRect();
      const viewport = messages.getBoundingClientRect();
      if (bounds.top < viewport.top) messages.scrollTop += bounds.top - viewport.top;
      else if (bounds.bottom > viewport.bottom) messages.scrollTop += bounds.bottom - viewport.bottom;
    });
    latest.addEventListener('click', () => {
      scrollToBottom();
      messages.focus({ preventScroll: true });
    });
    input.addEventListener('input', event => {
      updateComposer();
      if (!event.isComposing) updateSuggestions();
    });
    input.addEventListener('click', updateSuggestions);
    input.addEventListener('blur', closeSuggestions);
    input.addEventListener('compositionstart', () => {
      composing = true;
      closeSuggestions();
      updateComposer();
    });
    input.addEventListener('compositionend', () => {
      composing = false;
      updateComposer();
      updateSuggestions();
    });
    input.addEventListener('keyup', event => {
      if (!event.isComposing && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        updateSuggestions();
      }
    });
    input.addEventListener('keydown', event => {
      if (event.isComposing || composing || event.keyCode === 229 || event.shiftKey) return;
      if (!suggestions.hidden) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          selectSuggestion((selectedIndex + direction + matches.length) % matches.length);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSuggestions();
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          insertMention(matches[selectedIndex], matchContext.start, matchContext.end);
          return;
        }
      }
      if (event.key === 'Enter' && !sendButton.disabled) {
        event.preventDefault();
        submit();
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      submit();
    });
    syncFilterControls();
    updateQuickMentions();
    updateComposer();
    updateEmpty();

    return {
      setHistory,
      add,
      setStatus(id, statusText) {
        const key = String(id);
        const status = String(statusText || '');
        if (statuses.get(key) !== status && status.startsWith('working')) {
          markActive(key);
          updateQuickMentions();
        }
        statuses.set(key, status);
        if (busy) updateTyping();
      },
      setBusy(value) {
        busy = Boolean(value);
        updateComposer();
        updateTyping();
      }
    };
  }

  window.SwarmChannel = {
    init(options) { channel = createChannel(options); },
    setHistory(messages) { if (channel) channel.setHistory(messages); },
    add(msg) { if (channel) channel.add(msg); },
    setStatus(id, statusText) { if (channel) channel.setStatus(id, statusText); },
    setBusy(value) { if (channel) channel.setBusy(value); }
  };
}());
