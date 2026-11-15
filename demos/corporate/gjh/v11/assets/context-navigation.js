/** One DOM projection of the mall's canonical mode; no gameplay state is owned here. */
const ITEMS = Object.freeze([
  {id: 'home', label: 'Home'},
  {id: 'shops', label: 'Shops'},
  {id: 'events', label: 'Events', unavailable: true},
  {id: 'rewards', label: 'Rewards', unavailable: true},
  {id: 'profile', label: 'Profile', unavailable: true},
]);

export function createContextNavigation({globalHost, directory, onHome, onShops, recoverFocus}) {
  const nav = document.createElement('nav');
  nav.id = 'context-navigation';
  nav.className = 'context-navigation';
  nav.setAttribute('aria-label', 'Mall navigation');
  nav.hidden = true;
  const actions = document.createElement('div');
  actions.className = 'context-navigation-actions';
  const note = document.createElement('p');
  note.id = 'context-navigation-note';
  note.textContent = 'Events, Rewards and Profile are unavailable in this demo.';
  const homeNote = document.createElement('p');
  homeNote.id = 'context-home-note';
  homeNote.textContent = 'Home is unavailable while the 3D mall is not ready. Use Shops to browse the directory.';
  homeNote.hidden = true;
  let visible = false, ready = false;
  const buttons = new Map(ITEMS.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `context-${item.id}`;
    button.textContent = item.label;
    button.disabled = Boolean(item.unavailable);
    if (item.unavailable) button.setAttribute('aria-describedby', note.id);
    if (item.id === 'home') {
      button.addEventListener('click', () => { if (visible && ready) onHome(); });
    } else if (item.id === 'shops') {
      button.addEventListener('click', () => { if (visible) onShops(); });
    }
    actions.append(button);
    return [item.id, button];
  }));
  nav.append(actions, homeNote, note);
  globalHost.append(nav);
  let reservedHeight = -1, previous = null;
  let visibilityFrame = 0;
  function revealCurrentFocus() {
    if (visibilityFrame) return;
    visibilityFrame = requestAnimationFrame(() => {
      visibilityFrame = 0;
      const target = document.activeElement;
      // Native close handlers own focus. Only reveal their CURRENT directory
      // target after our footer has settled; never retain or refocus an opener.
      if (!(target instanceof HTMLElement) ||
          !target.isConnected || !visible || previous?.destination !== 'shops' ||
          nav.parentElement !== globalHost || globalHost.hidden || directory.hidden ||
          !directory.contains(target) || nav.contains(target) ||
          document.querySelector('dialog[open]') || !target.getClientRects().length) return;
      if (getComputedStyle(globalHost).position !== 'fixed') return;
      const rect = target.getBoundingClientRect(), footer = globalHost.getBoundingClientRect();
      const rootStyle = getComputedStyle(document.documentElement);
      const safeTop = parseFloat(rootStyle.scrollPaddingTop) || 0;
      const safeBottom = Math.min(footer.top,
        innerHeight - (parseFloat(rootStyle.scrollPaddingBottom) || 0));
      if (target === document.activeElement && (rect.top < safeTop || rect.bottom > safeBottom))
        target.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
    });
  }
  document.addEventListener('focusin', revealCurrentFocus);
  window.addEventListener('resize', revealCurrentFocus);
  function measure() {
    const height = visible && nav.parentElement === globalHost && getComputedStyle(globalHost).position === 'fixed' ? Math.ceil(globalHost.getBoundingClientRect().height) : 0;
    if (height === reservedHeight) return;
    reservedHeight = height;
    document.documentElement.style.setProperty('--context-navigation-height', `${height}px`);
    revealCurrentFocus();
  }
  new ResizeObserver(measure).observe(nav);
  const disclosure = document.querySelector('.scene-disclaimer');
  let disclosureHeight = -1;
  new ResizeObserver(() => {
    const height = Math.ceil(disclosure.getBoundingClientRect().height);
    if (height === disclosureHeight) return;
    disclosureHeight = height;
    document.documentElement.style.setProperty('--context-disclosure-height', `${height}px`);
  }).observe(disclosure);
  return {
    update({mode, available, destination, host = globalHost}) {
      if (previous?.mode === mode && previous.available === available && previous.host === host && previous.destination === destination) return;
      previous = {mode, available, host, destination};
      for (const [id, button] of buttons) {
        if ((id === 'home' || id === 'shops') && id === destination) {
          if (!button.hasAttribute('aria-current')) button.setAttribute('aria-current', 'page');
        } else if (button.hasAttribute('aria-current')) button.removeAttribute('aria-current');
      }
      const active = document.activeElement, ownedFocus = nav.contains(active);
      visible = mode === 'menu' || mode === 'shop';
      ready = available;
      const home = buttons.get('home');
      if (home.disabled === ready) {
        home.disabled = !ready;
        if (ready) home.removeAttribute('aria-describedby');
        else home.setAttribute('aria-describedby', homeNote.id);
      }
      if (homeNote.hidden === !ready) homeNote.hidden = ready;
      if (nav.hidden === visible) nav.hidden = !visible;
      if (globalHost.hidden === (visible && host === globalHost)) globalHost.hidden = !(visible && host === globalHost);
      if (nav.parentElement !== host) {
        host.append(nav);
        // Moving a focused node can blur it. Restore only our own surviving focus.
        if (ownedFocus && visible && !active.disabled) active.focus({preventScroll: true});
      }
      if (ownedFocus && visible && active === home && !ready) buttons.get('shops').focus({preventScroll: true});
      else if (ownedFocus && !visible) recoverFocus();
      measure();
      revealCurrentFocus();
    },
  };
}
