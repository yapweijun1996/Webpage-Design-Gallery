(function () {
  'use strict';

  const defaultColor = '#8b93a7';
  const builtIns = [
    { id: 'owner', name: 'Owner', badge: 'O', color: '#8ab4ff' },
    { id: 'claude', name: 'Claude', badge: 'C', color: '#d97757' },
    { id: 'system', name: 'System', badge: 'S', color: defaultColor }
  ];
  const everyone = { name: 'Everyone', color: '#8ab4ff' };
  const timeFormat = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
  let channel;
  let nextPopupId = 0;

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = 'swarm-channel__' + className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function tint(node, participant) {
    node.style.setProperty('--participant-color', participant.color);
    return node;
  }

  function chip(participant, label) {
    return tint(element('span', 'chip', label), participant);
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
        badge: /^\d+$/.test(id) ? id : name.charAt(0),
        color: CSS.supports('color', agent.color || '') ? agent.color : defaultColor,
        aliases: aliases.filter(Boolean).map(value => value.toLowerCase())
      };
    });
    workers.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const participants = new Map(builtIns.concat(workers).map(agent => [agent.id, agent]));
    const statuses = new Map();
    const aliases = new Map();
    workers.forEach(agent => agent.aliases.forEach(alias => {
      if (!aliases.has(alias)) aliases.set(alias, agent);
    }));
    aliases.set('all', everyone);
    aliases.set('everyone', everyone);
    const aliasPattern = Array.from(aliases.keys())
      .sort((a, b) => b.length - a.length)
      .map(alias => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const mentionPattern = new RegExp('(^|[^\\p{L}\\p{N}_@])@(' + aliasPattern + ')(?![\\p{L}\\p{N}_-])', 'giu');

    function participant(id) {
      return participants.get(id) || { name: id, badge: id.charAt(0), color: defaultColor };
    }

    function appendText(node, value) {
      const text = String(value || '');
      let position = 0;
      mentionPattern.lastIndex = 0;
      let match;
      while ((match = mentionPattern.exec(text))) {
        const mentioned = aliases.get(match[2].toLowerCase());
        if (!mentioned) continue;
        const start = match.index + match[1].length;
        node.append(document.createTextNode(text.slice(position, start)));
        node.append(chip(mentioned, '@' + match[2]));
        position = match.index + match[0].length;
      }
      node.append(document.createTextNode(text.slice(position)));
    }

    const panel = element('section');
    panel.className = 'swarm-channel';
    panel.setAttribute('aria-label', 'Team channel');
    const timeline = element('div', 'timeline');
    const messages = element('ol', 'messages');
    messages.tabIndex = 0;
    messages.setAttribute('aria-label', 'Channel messages');
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions');

    const newMessages = element('button', 'new-messages');
    newMessages.type = 'button';
    newMessages.hidden = true;
    timeline.append(messages, newMessages);

    const form = element('form', 'composer');
    const typing = element('div', 'typing');
    typing.setAttribute('role', 'status');
    typing.hidden = true;
    const error = element('div', 'error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const input = element('textarea', 'input');
    input.rows = 2;
    input.maxLength = 800;
    input.placeholder = 'Message the team…';
    input.setAttribute('aria-label', 'Message the team');
    input.setAttribute('aria-autocomplete', 'list');
    const suggestions = element('div', 'suggestions');
    suggestions.id = 'swarm-channel-suggestions-' + (++nextPopupId);
    suggestions.setAttribute('role', 'listbox');
    suggestions.setAttribute('aria-label', 'Mention an agent');
    suggestions.hidden = true;
    input.setAttribute('aria-controls', suggestions.id);
    const sendButton = element('button', 'send', 'Send');
    sendButton.type = 'submit';
    const row = element('div', 'composer-row');
    row.append(input, sendButton);
    form.append(suggestions, typing, error, row);
    panel.append(timeline, form);
    root.textContent = '';
    root.append(panel);

    const seen = new Set();
    let group;
    let unread = 0;
    let following = true;
    let pendingBottom = false;
    let busy = false;
    let sending = false;
    let matchContext;
    let matches = [];
    let selectedIndex = 0;

    function nearBottom() {
      if (!messages.clientHeight) return following;
      return messages.scrollHeight - messages.clientHeight - messages.scrollTop <= 40;
    }

    function clearUnread() {
      unread = 0;
      newMessages.hidden = true;
    }

    function scrollToBottom() {
      following = true;
      pendingBottom = !messages.clientHeight;
      messages.scrollTop = messages.scrollHeight;
      clearUnread();
    }

    function renderMessage(msg) {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);

      if (msg.kind === 'system' || msg.from === 'system') {
        const notice = element('li', 'system');
        appendText(notice, msg.text);
        messages.append(notice);
        group = null;
        return true;
      }

      const from = String(msg.from);
      const author = participant(from);
      const newGroup = !group || group.from !== from;
      let groupItem;
      if (newGroup) {
        groupItem = tint(element('li', 'group'), author);
        const avatar = element('span', 'avatar', author.badge);
        avatar.setAttribute('aria-hidden', 'true');
        const body = element('div', 'group-body');
        const header = element('div', 'message-header');
        const name = element(onJump ? 'button' : 'span', 'sender', author.name);
        if (onJump) {
          name.type = 'button';
          name.addEventListener('click', () => onJump(from));
        }
        header.append(name);
        body.append(header);
        groupItem.append(avatar, body);
        group = { from, header, body };
      }

      const entry = element('div', 'message');
      const date = new Date(msg.ts);
      if (Number.isFinite(date.getTime())) {
        const time = element('time', newGroup ? 'time' : 'sr-only', timeFormat.format(date));
        time.dateTime = date.toISOString();
        (newGroup ? group.header : entry).append(time);
      }

      if (msg.kind === 'assign') {
        entry.classList.add('swarm-channel__assignment');
        const heading = element('div', 'assignment-header');
        heading.append(element('strong', '', 'Assignment'));
        (msg.to || []).forEach(id => {
          const assignee = participant(String(id));
          heading.append(chip(assignee, '@' + assignee.name));
        });
        entry.append(heading);
      } else if (msg.kind === 'decision') {
        entry.classList.add('swarm-channel__decision');
        entry.append(element('strong', 'decision-label', 'Decision'));
      } else if (msg.kind === 'done') {
        entry.classList.add('swarm-channel__done');
        const check = element('span', 'check', '✓');
        check.setAttribute('aria-hidden', 'true');
        entry.append(check, element('span', 'sr-only', 'Done: '));
      }

      const text = element('div', 'text');
      appendText(text, msg.text);
      entry.append(text);
      if (msg.kind === 'assign' && msg.task) {
        const task = element('div', 'task');
        appendText(task, msg.task);
        entry.append(task);
      }

      group.body.append(entry);
      if (newGroup) messages.append(groupItem);
      return true;
    }

    function add(msg) {
      const follow = nearBottom();
      if (!renderMessage(msg)) return;
      if (follow) {
        scrollToBottom();
      } else {
        following = false;
        unread += 1;
        newMessages.textContent = unread === 1 ? '1 new message ↓' : unread + ' new messages ↓';
        newMessages.hidden = false;
      }
    }

    function setHistory(history) {
      messages.textContent = '';
      seen.clear();
      group = null;
      history.forEach(renderMessage);
      scrollToBottom();
    }

    function closeSuggestions() {
      matchContext = null;
      matches = [];
      suggestions.hidden = true;
      suggestions.textContent = '';
      input.removeAttribute('aria-activedescendant');
    }

    function selectSuggestion(index) {
      selectedIndex = index;
      Array.from(suggestions.children).forEach((option, i) => {
        option.setAttribute('aria-selected', String(i === index));
      });
      const option = suggestions.children[index];
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }

    function applySuggestion(index) {
      const mention = '@' + matches[index].name;
      const suffix = input.value.slice(matchContext.end);
      const separator = !suffix || /^[\p{L}\p{N}_@]/u.test(suffix) ? ' ' : '';
      input.setRangeText(mention + separator, matchContext.start, matchContext.end, 'end');
      closeSuggestions();
      updateComposer();
    }

    function updateSuggestions() {
      if (input.disabled || input.selectionStart !== input.selectionEnd) {
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
      const nextMatches = workers.filter(agent => agent.aliases.some(alias => alias.startsWith(query)));
      const start = match.index + match[1].length;
      if (!nextMatches.length) {
        closeSuggestions();
        return;
      }
      if (matchContext && matchContext.start === start && matchContext.end === end &&
          matchContext.query === query) return;
      matchContext = { start, end, query };
      matches = nextMatches;
      suggestions.textContent = '';
      matches.forEach((agent, i) => {
        const option = tint(element('div', 'option'), agent);
        option.id = suggestions.id + '-' + i;
        option.setAttribute('role', 'option');
        option.append(element('span', 'option-name', agent.name));
        if (agent.section) option.append(element('span', 'option-section', agent.section));
        option.addEventListener('mousedown', event => event.preventDefault());
        option.addEventListener('click', () => applySuggestion(i));
        suggestions.append(option);
      });
      suggestions.scrollTop = 0;
      suggestions.hidden = false;
      selectSuggestion(0);
    }

    function updateComposer() {
      input.disabled = busy || sending;
      sendButton.disabled = input.disabled || !input.value.trim();
      if (input.disabled) closeSuggestions();
    }

    function updateTyping() {
      const follow = nearBottom();
      const wasVisible = !typing.hidden;
      typing.hidden = !busy;
      if (busy) {
        const working = workers.filter(agent => (statuses.get(agent.id) || '').startsWith('working'));
        const label = 'The team is working' + (working.length
          ? ' · ' + working.map(agent => agent.name).join(', ')
          : '…');
        if (typing.textContent !== label) typing.textContent = label;
      }
      if (follow && (busy || wasVisible)) scrollToBottom();
    }

    async function submit() {
      const draft = input.value;
      if (busy || sending || !draft.trim()) return;
      const hadFocus = form.contains(document.activeElement);
      sending = true;
      error.hidden = true;
      updateComposer();
      try {
        const result = await send(draft.trim());
        if (result && result.ok === false) throw new Error('Message rejected');
        input.value = '';
      } catch {
        const follow = nearBottom();
        error.textContent = 'Message could not be sent. Try again.';
        error.hidden = false;
        if (follow) scrollToBottom();
      } finally {
        sending = false;
        updateComposer();
        if (hadFocus && !input.disabled && document.activeElement === document.body) input.focus();
      }
    }

    messages.addEventListener('scroll', () => {
      if (!messages.clientHeight || pendingBottom) return;
      following = nearBottom();
      if (unread && following) clearUnread();
    });
    if (typeof ResizeObserver === 'function') {
      const resize = new ResizeObserver(() => {
        if (!panel.isConnected) resize.disconnect();
        else if (messages.clientHeight && (pendingBottom || following)) scrollToBottom();
      });
      resize.observe(messages);
    }
    newMessages.addEventListener('click', () => {
      scrollToBottom();
      messages.focus({ preventScroll: true });
    });
    input.addEventListener('input', event => {
      updateComposer();
      if (!event.isComposing) updateSuggestions();
    });
    input.addEventListener('click', updateSuggestions);
    input.addEventListener('blur', closeSuggestions);
    input.addEventListener('compositionend', updateSuggestions);
    input.addEventListener('keyup', event => {
      if (!event.isComposing && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        updateSuggestions();
      }
    });
    input.addEventListener('keydown', event => {
      if (event.isComposing || event.keyCode === 229 || event.shiftKey) return;
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
          applySuggestion(selectedIndex);
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
    updateComposer();

    return {
      setHistory,
      add,
      setStatus(id, statusText) {
        statuses.set(String(id), String(statusText || ''));
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
