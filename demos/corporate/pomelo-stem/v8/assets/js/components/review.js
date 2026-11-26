// Only used by design/components.html to preview toast and dialog states.
import {toast} from '../core/toast.js';
import {open, confirm} from '../core/dialog.js';

export function init() {
  if (!document.querySelector('meta[name="pomelo-design-review"]')) return;
  document.addEventListener('click', (event) => {
    const toastButton = event.target.closest('[data-review-toast]');
    if (toastButton) toast({type: toastButton.dataset.reviewToast, message: `${toastButton.dataset.reviewToast} toast preview`});
    const dialogButton = event.target.closest('[data-review-dialog]');
    if (!dialogButton) return;
    if (dialogButton.dataset.reviewDialog === 'alert') {
      confirm({title: 'Alert dialog preview', body: 'Backdrop clicks do not close this variant.'});
    } else {
      const text = document.createElement('p');
      text.textContent = 'Modal preview. Escape, the close button or the backdrop closes it.';
      open({title: 'Modal preview', content: text});
    }
  });
}
