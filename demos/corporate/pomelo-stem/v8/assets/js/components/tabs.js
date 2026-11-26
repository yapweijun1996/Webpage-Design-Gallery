// Tabs with roving tabindex. Panels share one grid cell, so switching never moves the page.
export function select(root, tab, {focus = false} = {}) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  for (const item of tabs) {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  }
  if (focus) tab.focus();
}

export function init() {
  for (const root of document.querySelectorAll('[data-tabs]')) {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    root.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) select(root, tab);
    });
    root.querySelector('[role="tablist"]').addEventListener('keydown', (event) => {
      const index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      const moves = {ArrowRight: 1, ArrowLeft: -1, Home: -index, End: tabs.length - 1 - index};
      if (!(event.key in moves)) return;
      event.preventDefault();
      select(root, tabs[(index + moves[event.key] + tabs.length) % tabs.length], {focus: true});
    });
  }
}
