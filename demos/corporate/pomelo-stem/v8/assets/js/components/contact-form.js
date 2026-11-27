// Contact form: validates and never sends (demo). Native defaults track unsaved input.
import {toast, toastDuration} from '../core/toast.js';

export function init() {
  const form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('input', (event) => {
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
      toast({type: 'info', messageKey: 'toast.formNotSent.title', detailKey: 'toast.formNotSent.detail', duration: toastDuration('action')});
    });
    form.querySelector('[type="submit"]').disabled = false;
    form.querySelector('[data-form-fallback]').hidden = true;
  }
  const copy = document.querySelector('[data-copy]');
  if (copy) {
    copy.addEventListener('click', async () => {
      const source = document.querySelector('[data-copy-source]');
      try {
        await navigator.clipboard.writeText(source.textContent.trim());
        toast({type: 'success', messageKey: 'toast.copied.title', detailKey: 'toast.copied.detail'});
      } catch (error) {
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        toast({type: 'warning', messageKey: 'toast.copyFailed.title', detailKey: 'toast.copyFailed.detail'});
      }
    });
  }
}
