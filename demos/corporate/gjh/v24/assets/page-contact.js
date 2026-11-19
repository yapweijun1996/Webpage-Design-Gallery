(() => {
  const byId = id => document.getElementById(id);
  const form = byId('enquiry-form');
  const fieldset = form.querySelector('fieldset');
  const submit = form.querySelector('[type="submit"]');
  const buttonLabel = byId('enquiry-button-label');
  const reset = byId('enquiry-reset');
  const errorSummary = byId('enquiry-errors');
  const errorList = errorSummary.querySelector('ul');
  const result = byId('enquiry-result');
  const summary = byId('enquiry-summary');
  const progress = byId('enquiry-progress');
  const copy = byId('enquiry-copy');
  const copyFeedback = byId('enquiry-copy-feedback');
  const fields = ['name', 'email', 'organisation', 'topic', 'message', 'consent']
    .map(name => form.elements.namedItem(name));
  const [name, email, organisation, topic, message, consent] = fields;
  const draftKey = 'gjh-v24-contact-draft';
  let showErrors = false;

  function setTopic(value) {
    if (value && Array.from(topic.options).some(option => option.value === value)) {
      topic.value = value;
    }
  }

  function restoreDraft() {
    setTopic(new URLSearchParams(location.search).get('topic'));
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey));
      if (!draft) return;
      for (const field of fields) {
        const saved = draft[field.name];
        if (field === consent) field.checked = saved === true;
        else if (field === topic) {
          if (saved === '') topic.value = '';
          else if (typeof saved === 'string') setTopic(saved);
        } else if (typeof saved === 'string') field.value = saved;
      }
    } catch {
      // The form remains usable when browser storage is unavailable.
    }
  }

  function saveDraft() {
    const values = fields.map(field => [
      field.name, field === consent ? field.checked : field.value
    ]);
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(values)));
    } catch {
      // Draft persistence is optional.
    }
  }

  function messageLength() {
    return message.value.trim().length;
  }

  function updateCount() {
    const count = messageLength();
    byId('message-count').textContent = `${count} ${count === 1 ? 'character' : 'characters'}`;
  }

  function renderErrors(errors) {
    for (const field of fields) {
      const error = byId(`${field.id}-error`);
      if (!error) continue;
      const text = errors.get(field) || '';
      error.textContent = text;
      error.hidden = !text;
      if (text) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }

    // Keep the summary stable while typing unless its list changes.
    const links = Array.from(errorList.querySelectorAll('a'));
    const entries = Array.from(errors);
    if (links.length !== entries.length || entries.some(([field, text], index) =>
      links[index].hash !== `#${field.id}` || links[index].textContent !== text)) {
      errorList.replaceChildren(...entries.map(([field, text]) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${field.id}`;
        link.textContent = text;
        item.append(link);
        return item;
      }));
    }
    errorSummary.hidden = !errors.size;
  }

  function validate() {
    const errors = new Map();
    if (!name.value.trim()) errors.set(name, 'Enter your name.');
    if (!email.value.trim()) errors.set(email, 'Enter your email address.');
    else if (email.validity.typeMismatch) errors.set(email, 'Enter a valid email address.');
    if (!topic.value) errors.set(topic, 'Select an enquiry type.');
    if (messageLength() < message.minLength) {
      errors.set(message, `Enter a message of at least ${message.minLength} characters.`);
    }
    if (!consent.checked) errors.set(consent, 'Confirm that this concept site does not send messages.');
    renderErrors(errors);
    return !errors.size;
  }

  errorList.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    byId(link.hash.slice(1)).focus();
  });

  for (const eventName of ['input', 'change']) {
    form.addEventListener(eventName, () => {
      updateCount();
      saveDraft();
      if (showErrors) validate();
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (submit.disabled) return;
    saveDraft();
    showErrors = true;

    if (!validate()) {
      errorSummary.focus();
      return;
    }

    const lines = [
      `Name: ${name.value.trim()}`,
      `Email: ${email.value.trim()}`
    ];
    if (organisation.value.trim()) lines.push(`Organisation: ${organisation.value.trim()}`);
    lines.push(`Enquiry type: ${topic.selectedOptions[0].text}`, '', 'Message:', message.value.trim());
    summary.textContent = lines.join('\n');

    const preparing = 'Preparing your enquiry…';
    submit.disabled = true;
    fieldset.disabled = true;
    reset.disabled = true;
    form.setAttribute('aria-busy', 'true');
    buttonLabel.textContent = preparing;
    progress.textContent = preparing;

    setTimeout(() => {
      form.hidden = true;
      form.removeAttribute('aria-busy');
      submit.disabled = false;
      fieldset.disabled = false;
      reset.disabled = false;
      buttonLabel.textContent = 'Prepare enquiry';
      progress.textContent = '';
      copyFeedback.textContent = '';
      result.hidden = false;
      byId('enquiry-result-title').focus();
    }, 400);
  });

  function copyWithSelection() {
    const selection = window.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(summary);
    selection.removeAllRanges();
    selection.addRange(range);
    try {
      if (document.execCommand('copy')) {
        selection.removeAllRanges();
        return true;
      }
    } catch {
      // Leave the summary selected for manual copying.
    }
    return false;
  }

  copy.addEventListener('click', async () => {
    if (copy.getAttribute('aria-busy') === 'true') return;
    copy.setAttribute('aria-busy', 'true');
    copyFeedback.textContent = '';
    let copied = false;
    try {
      await navigator.clipboard.writeText(summary.textContent);
      copied = true;
    } catch {
      if (!result.hidden) copied = copyWithSelection();
    } finally {
      copy.removeAttribute('aria-busy');
    }
    if (!result.hidden) {
      copyFeedback.textContent = copied
        ? 'Enquiry copied to your clipboard.'
        : 'Copy the summary manually using your device’s copy command.';
    }
  });

  byId('enquiry-edit').addEventListener('click', () => {
    result.hidden = true;
    form.hidden = false;
    reset.hidden = false;
    byId('enquiry-title').focus();
  });

  reset.addEventListener('click', () => {
    form.reset();
    showErrors = false;
    renderErrors(new Map());
    summary.textContent = '';
    updateCount();
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // The fields are already cleared in this tab.
    }
    reset.hidden = true;
    name.focus();
  });

  restoreDraft();
  updateCount();
  form.hidden = false;
})();
