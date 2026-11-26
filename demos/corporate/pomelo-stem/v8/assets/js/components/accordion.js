// Accordion: buttons toggle their regions.
export function init() {
  for (const trigger of document.querySelectorAll('[data-accordion] .accordion__trigger')) {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
    });
  }
}
