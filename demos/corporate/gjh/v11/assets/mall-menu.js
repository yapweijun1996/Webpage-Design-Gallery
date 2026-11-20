import {icon} from './icons.js';

const focusOptions = {preventScroll: true};

export function selectMenuRadio(buttons, selected) {
  for (const button of buttons) {
    const checked = button === selected;
    button.setAttribute('aria-checked', String(checked));
    button.tabIndex = checked ? 0 : -1;
  }
}

export function createMallMenu(dialog, {touch, canOpen, beforeOpen, onChange, fallbackFocus}) {
  const pages = new Map([...dialog.querySelectorAll('[data-menu-page]')].map(page => [page.dataset.menuPage, page]));
  const headerIcon = dialog.querySelector('#menu-heading-icon');
  const title = dialog.querySelector('#menu-title');
  const titleText = dialog.querySelector('#menu-heading-text');
  const subtitle = dialog.querySelector('#menu-subtitle');
  const backButton = dialog.querySelector('#menu-back');
  const closeButton = dialog.querySelector('#menu-close');
  const body = dialog.querySelector('.mall-tools-content');
  const sound = dialog.querySelector('#menu-sound-card');
  const performance = dialog.querySelector('#performance-panel');
  const minimap = dialog.querySelector('#menu-minimap-toggle');
  const preview = dialog.querySelector('#mini-map');
  const deviceOptions = [...dialog.querySelectorAll('[data-menu-device]')];
  const guides = [...dialog.querySelectorAll('[data-menu-guide]')];
  const openers = new Set();
  const history = [];
  let current, opener;

  function selectDevice(device) {
    selectMenuRadio(deviceOptions, deviceOptions.find(button => button.dataset.menuDevice === device));
    for (const guide of guides) guide.hidden = guide.dataset.menuGuide !== device;
  }
  function show(name) {
    if (current) current.hidden = true;
    current = pages.get(name);
    current.hidden = false;
    const [heading, description] = current.querySelector('template').content.children;
    titleText.textContent = heading.textContent;
    subtitle.textContent = description.textContent;
    headerIcon.replaceChildren(icon(current.dataset.menuIcon, {size: 24}));
    backButton.hidden = history.length === 0;
    current.querySelector('[data-menu-slot="sound"]')?.append(sound);
    current.querySelector('[data-menu-slot="performance"]')?.append(performance);
    body.scrollTop = 0;
    if (dialog.open) title.focus(focusOptions);
  }
  function go(name, trigger) {
    if (!pages.has(name) || current === pages.get(name)) return;
    history.push({name: current.dataset.menuPage, trigger, scroll: body.scrollTop});
    show(name);
  }
  function back() {
    const previous = history.pop();
    if (!previous) return;
    show(previous.name);
    body.scrollTop = previous.scroll;
    previous.trigger?.focus(focusOptions);
  }
  function open(name, trigger) {
    if (!pages.has(name)) return false;
    if (dialog.open) {
      go(name, trigger);
      return true;
    }
    if (!canOpen()) return false;
    beforeOpen();
    opener = trigger;
    history.length = 0;
    performance.open = false;
    selectDevice(touch ? 'touch' : 'keyboard');
    show('menu');
    if (name !== 'menu') go(name);
    dialog.showModal();
    for (const entry of openers) entry.setAttribute('aria-expanded', 'true');
    title.focus(focusOptions);
    onChange();
    return true;
  }
  function close({focus = true} = {}) {
    if (!dialog.open) return;
    dialog.close();
    for (const entry of openers) entry.setAttribute('aria-expanded', 'false');
    if (focus) {
      const target = opener?.getClientRects().length ? opener : fallbackFocus;
      target?.focus(focusOptions);
    }
    opener = null;
    onChange();
  }

  const routes = [...dialog.querySelectorAll('[data-menu-to]')];
  for (const button of routes) button.addEventListener('click', () => go(button.dataset.menuTo, button));
  for (const button of deviceOptions) button.addEventListener('click', () => selectDevice(button.dataset.menuDevice));
  minimap.addEventListener('change', () => { preview.hidden = !minimap.checked; });
  backButton.addEventListener('click', back);
  closeButton.addEventListener('click', () => close());
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('change', event => {
    if (event.target.matches('select') && event.target === dialog.ownerDocument.activeElement) {
      event.target.scrollIntoView({block: 'nearest', behavior: 'instant'});
    }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const group = event.target.closest('[role="radiogroup"]');
    if (group && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      const radios = [...group.querySelectorAll('[role="radio"]:not(:disabled)')];
      const index = radios.indexOf(event.target);
      const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      const next = event.key === 'Home' ? radios[0] : event.key === 'End' ? radios.at(-1)
        : radios[(index + step + radios.length) % radios.length];
      event.preventDefault();
      next?.click();
      next?.focus(focusOptions);
    }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, input, select, a[href], summary')]
      .filter(control => !control.disabled && control.getAttribute('tabindex') !== '-1' && control.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    const active = dialog.ownerDocument.activeElement;
    const wrap = event.shiftKey ? active === first || (active === title && backButton.hidden) : active === last;
    if (wrap) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus(focusOptions);
    }
  });
  return {
    open,
    close,
    addOpener(button, page) {
      openers.add(button);
      button.addEventListener('click', () => open(page, button));
    },
  };
}
