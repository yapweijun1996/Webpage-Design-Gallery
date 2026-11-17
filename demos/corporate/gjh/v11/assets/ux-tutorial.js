export const tutorialStorageKey = 'gjh-v11-tutorial-v1';
const actions = ['move', 'look', 'interact'];

/** Only confirmed actions for the current step advance this session. */
export function createTutorialState({storage = () => globalThis.localStorage} = {}) {
  let remembered = false, open = false, active = false, step = 0, previousPose = null;
  const listeners = new Set();
  try { remembered = ['dismissed', 'completed'].includes(storage()?.getItem(tutorialStorageKey)); } catch { /* Storage is optional. */ }
  const snapshot = () => ({open, active, step, action: actions[step], remembered});
  const publish = () => { for (const listener of listeners) listener(snapshot()); };
  function finish(value) {
    open = false; remembered = true; previousPose = null;
    try { storage()?.setItem(tutorialStorageKey, value); } catch { /* Keep the in-memory dismissal. */ }
    publish();
  }
  function advance() {
    if (step === actions.length - 1) finish('completed');
    else { step++; publish(); }
    return true;
  }
  function next() { return open && active ? advance() : false; }
  function report(action) {
    // Successful scene interactions may open a modal before dispatch returns.
    return open && (active || action === 'interact') && actions[step] === action ? advance() : false;
  }
  return {
    snapshot,
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
    setActive(value) {
      const nextActive = Boolean(value);
      if (active === nextActive) return;
      active = nextActive; previousPose = null; publish();
    },
    offer() { if (remembered || open) return false; open = true; step = 0; previousPose = null; publish(); return true; },
    reopen() { open = true; step = 0; previousPose = null; publish(); },
    dismiss() { finish('dismissed'); },
    next,
    back() { if (!open || !active || step === 0) return false; step--; publish(); return true; },
    report,
    reportPose(pose) {
      if (!open || !active || ![pose.x, pose.z, pose.yaw].every(Number.isFinite)) { previousPose = null; return false; }
      const previous = previousPose; previousPose = {x: pose.x, z: pose.z, yaw: pose.yaw};
      if (!previous) return false;
      // A single sample can complete only its current step, never two at once.
      if (actions[step] === 'move' && Math.hypot(pose.x - previous.x, pose.z - previous.z) > .02) return report('move');
      const turn = Math.atan2(Math.sin(pose.yaw - previous.yaw), Math.cos(pose.yaw - previous.yaw));
      if (actions[step] === 'look' && Math.abs(turn) > .01) return report('look');
      return false;
    },
  };
}

/** A nonmodal region: rendering never changes focus or the gameplay pause state. */
export function createTutorial({parent, onDismiss = () => {}, touch = false} = {}) {
  const state = createTutorialState();
  const card = document.createElement('section');
  card.id = 'guide-card'; card.className = 'ux-tutorial'; card.hidden = true;
  card.setAttribute('role', 'region'); card.setAttribute('aria-labelledby', 'guide-title');
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const button = (id, label, action) => {
    const node = element('button', 'ux-tutorial-button', label); node.id = id; node.type = 'button';
    node.addEventListener('click', action); return node;
  };
  const header = element('div', 'ux-tutorial-header');
  const title = element('h2', 'ux-tutorial-title', 'Getting Started'); title.id = 'guide-title';
  const count = element('span', 'ux-tutorial-count'); count.id = 'guide-count';
  const skip = button('guide-skip', 'Skip', () => { state.dismiss(); onDismiss(); });
  header.append(title, count, skip);
  const progress = element('div', 'ux-tutorial-progress'); progress.setAttribute('aria-hidden', 'true');
  const segments = actions.map(() => element('span', 'ux-tutorial-segment')); progress.append(...segments);
  const stepTitle = element('h3', 'ux-tutorial-step-title'); stepTitle.id = 'guide-step-title';
  const copy = element('p', 'ux-tutorial-copy'); copy.id = 'guide-step-copy';
  const announcement = element('p', 'sr-only ux-tutorial-announcement'); announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite'); announcement.setAttribute('aria-atomic', 'true');
  const controls = element('div', 'ux-tutorial-actions');
  const back = button('guide-back', 'Back', () => state.back());
  const next = button('guide-next', 'Next', () => { state.next(); if (!state.snapshot().open) onDismiss(); });
  controls.append(back, next); card.append(header, progress, stepTitle, copy, announcement, controls); parent.append(card);
  const steps = [
    ['Move around', touch ? 'Drag the right joystick to move around the courtyard.' : 'Use WASD or the arrow keys to walk around the courtyard.'],
    ['Look around', touch ? 'Drag the open scene to look around. When moving, use a second finger.' : 'Drag the scene to look around. On a controller, use the right stick.'],
    ['Try an interaction', touch ? 'Approach a door, bench or display, then tap its action.' : 'Approach a door, bench or display, then press F or select its action.'],
  ];
  let announcedStep = null;
  state.subscribe(({open, active, step}) => {
    card.hidden = !open || !active;
    count.textContent = `${step + 1}/3`; count.setAttribute('aria-label', `Step ${step + 1} of 3`);
    for (let index = 0; index < segments.length; index++) segments[index].dataset.state = index < step ? 'complete' : index === step ? 'current' : 'pending';
    stepTitle.textContent = steps[step][0]; copy.textContent = steps[step][1];
    back.disabled = step === 0; next.textContent = step === 2 ? 'Done' : 'Next';
    if (open && active && announcedStep !== step) announcement.textContent = `Getting Started. Step ${step + 1} of 3: ${steps[step][0]}.`;
    announcedStep = open && active ? step : null;
  });
  return {card, ...state};
}
