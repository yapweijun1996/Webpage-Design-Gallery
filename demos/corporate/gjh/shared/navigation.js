/** Parser-blocking disclosure bootstrap: reserve the compact layout before paint. */
(() => {
  document.documentElement.classList.add('js');
  function initNavigation() {
    const toggle = document.querySelector('.menu-toggle');
    const navigation = document.querySelector('#navigation');
    if (!toggle || !navigation) return;
    const mobile = matchMedia('(max-width: 900px)');
    let lastFocus = document.activeElement;

    function closeMenu(returnFocus = false) {
      navigation.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus({preventScroll: true});
    }

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      navigation.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    navigation.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link) return;
      closeMenu();
      if (mobile.matches && link.hash) {
        // Retain the reading position when collapsing the disclosure.
        document.getElementById(decodeURIComponent(link.hash.slice(1)))?.focus({preventScroll: true});
      }
    });
    document.addEventListener('focusin', event => { lastFocus = event.target; });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu(true);
      }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.header') && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu(navigation.contains(document.activeElement));
      }
    });
    mobile.addEventListener('change', () => {
      // CSS may blur a disappearing link before this event is delivered.
      closeMenu(mobile.matches && navigation.contains(lastFocus));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNavigation, {once: true});
  else initNavigation();
})();
