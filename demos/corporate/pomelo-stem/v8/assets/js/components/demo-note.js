// The single "Demo data" label opens one explanation dialog.
import {t} from '../core/i18n.js';
import {open} from '../core/dialog.js';

export function init() {
  for (const button of document.querySelectorAll('[data-demo-note]')) {
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => {
      const text = document.createElement('p');
      text.textContent = t('demo.noteBody');
      open({title: t('demo.noteTitle'), content: text});
    });
  }
}
