// Contact form: validates, marks itself dirty, and never sends (demo).
import {t} from '../core/i18n.js';
import {toast} from '../core/toast.js';

export function init() {
  const form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('input', (event) => {
      form.dataset.dirty = String([...form.elements].some((field) => field.value && field.value.trim()));
      const field = event.target;
      if (field.required && field.value.trim()) {
        field.removeAttribute('aria-invalid');
        const error = document.getElementById(field.getAttribute('aria-describedby'));
        if (error) error.hidden = true;
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      let firstInvalid = null;
      for (const field of form.querySelectorAll('[required]')) {
        const empty = !field.value.trim();
        field.toggleAttribute('aria-invalid', empty);
        if (empty) field.setAttribute('aria-invalid', 'true');
        const error = document.getElementById(field.getAttribute('aria-describedby'));
        if (error) error.hidden = !empty;
        if (empty && !firstInvalid) firstInvalid = field;
      }
      if (firstInvalid) { firstInvalid.focus(); return; }
      toast({type: 'info', message: t('form.notSent'), duration: 6000});
    });
  }
  const copy = document.querySelector('[data-copy]');
  if (copy) {
    copy.addEventListener('click', async () => {
      const source = document.querySelector('[data-copy-source]');
      try {
        await navigator.clipboard.writeText(source.textContent.trim());
        toast({type: 'success', message: t('contact.copied')});
      } catch (error) {
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        toast({type: 'warning', message: t('contact.copyFailed')});
      }
    });
  }
}
