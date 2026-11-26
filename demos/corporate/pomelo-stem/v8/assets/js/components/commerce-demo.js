// Commerce demo: products feed one order; Seller Studio prep feeds the pickup checklist.
import {t, formatPrice} from '../core/i18n.js';
import {toast} from '../core/toast.js';
import {addItem, setPrep, subscribe, count, total} from '../store/demo-store.js';

function renderOrder(root, state) {
  const lines = root.querySelector('[data-order-lines]');
  if (!lines) return;
  lines.replaceChildren();
  for (const line of Object.values(state.lines)) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${line.name} × ${line.qty}`;
    const amount = document.createElement('span');
    amount.textContent = formatPrice(line.qty * line.price);
    row.append(name, amount);
    lines.append(row);
  }
  const items = count();
  root.querySelector('[data-order-empty]').hidden = items > 0;
  root.querySelector('[data-order-total-row]').hidden = items === 0;
  root.querySelector('[data-order-total]').textContent = formatPrice(total());
  const badge = root.querySelector('[data-order-count]');
  badge.hidden = items === 0;
  badge.textContent = String(items);
  for (const step of root.querySelectorAll('[data-pickup-list] [data-step]')) {
    step.classList.toggle('is-done', Boolean(state.steps[step.dataset.step]));
  }
}

export function init() {
  const root = document.querySelector('[data-commerce-demo]');
  if (root) {
    for (const price of root.querySelectorAll('.product__price')) {
      price.textContent = formatPrice(Number(price.closest('[data-price]').dataset.price));
    }
    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add]');
      if (!button) return;
      const product = button.closest('[data-product]');
      const name = product.querySelector('.product__name').textContent;
      addItem(product.dataset.product, name, Number(product.dataset.price));
      toast({type: 'success', message: t('product.added', {item: name})});
    });
    subscribe((state) => renderOrder(root, state));
  }
  const studio = document.querySelector('[data-studio]');
  if (studio) {
    const boxes = [...studio.querySelectorAll('[data-prep]')];
    for (const box of boxes) setPrep(box.id, box.checked);
    studio.addEventListener('change', (event) => {
      if (!event.target.matches('[data-prep]')) return;
      setPrep(event.target.id, event.target.checked);
      if (boxes.every((box) => box.checked)) toast({type: 'success', message: t('studio.done')});
    });
  }
}
