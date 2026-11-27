// Accessible labels share selection with canvas picking; the panel stays below the scene.
import { t } from '../core/i18n.js';
import { icon } from '../icons.generated.js';

export function createModuleUI(stage, places, focus, signal) {
  const layer = document.createElement('div');
  layer.className = 'hero3d__labels';
  const panel = document.createElement('section');
  panel.className = 'hero3d__panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-labelledby', 'hero3d-title');
  const title = document.createElement('h2');
  title.id = 'hero3d-title';
  const text = document.createElement('p');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'hero3d__close';
  const buttons = new Map();
  const names = { shop: 'cart', warehouse: 'package', delivery: 'package', bags: 'shopping-bag', payment: 'shield-check', analytics: 'chart-bars', automation: 'cog' };
  let selected = null;
  let returnTo;
  function show() {
    title.textContent = t(selected ? `hero3d.module.${selected}.label` : 'hero3d.overview.title');
    text.textContent = t(selected ? `hero3d.module.${selected}.text` : 'hero3d.overview.text');
    close.textContent = t(selected ? 'hero3d.close' : 'hero3d.reset');
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', String(id === selected));
    stage.dataset.selected = selected || '';
  }
  function select(id) {
    selected = id;
    if (id) returnTo = buttons.get(id);
    panel.dataset.collapsed = 'false';
    close.setAttribute('aria-expanded', 'true');
    show();
    focus(id);
  }
  function reset() {
    const collapsed = panel.dataset.collapsed === 'true';
    const wasSelected = selected;
    select(null);
    panel.dataset.collapsed = String(wasSelected !== null || !collapsed);
    close.setAttribute('aria-expanded', String(panel.dataset.collapsed !== 'true'));
    returnTo?.focus({ preventScroll: true });
  }
  const order = ['shop', 'warehouse', 'delivery', 'bags', 'payment', 'analytics', 'automation'];
  for (const id of order.filter(id => places.some(place => place.id === id))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero3d__module';
    button.dataset.module = id;
    button.setAttribute('aria-label', t(`hero3d.module.${id}.label`));
    button.setAttribute('aria-controls', 'hero3d-title');
    const label = document.createElement('span');
    label.textContent = t(`hero3d.module.${id}.label`);
    button.append(icon(names[id]), label);
    button.addEventListener('click', () => select(id), { signal });
    buttons.set(id, button);
    layer.append(button);
  }
  close.addEventListener('click', reset, { signal });
  stage.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); reset(); }
  }, { signal });
  panel.append(title, text, close);
  stage.append(layer, panel);
  close.setAttribute('aria-expanded', 'true');
  show();
  return {
    panel, layer, select,
    placeLabels(anchors, camera, height) {
      const width = stage.clientWidth;
      const occupied = [];
      for (const [id, button] of buttons) {
        const point = anchors.get(id).pin.clone().project(camera);
        const w = button.offsetWidth, h = button.offsetHeight;
        const x = Math.max(0, Math.min(width - w, (point.x + 1) * width / 2 - w / 2));
        let y = Math.max(0, Math.min(height - h, (1 - point.y) * height / 2 - h));
        // Resolve neighbours without removing any module from the keyboard order.
        for (const box of occupied) {
          if (x < box.x + box.w && x + w > box.x && y < box.y + h && y + h > box.y) {
            y = box.y + h + 2;
          }
        }
        y = Math.min(height - h, y);
        button.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        occupied.push({ x, y, w });
      }
    },
    dispose() { layer.remove(); panel.remove(); },
  };
}
