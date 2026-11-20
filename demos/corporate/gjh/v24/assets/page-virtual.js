(() => {
  const previewLink = document.getElementById('preview-trigger');
  const preview = document.getElementById('mall-preview');

  if (typeof preview.showModal === 'function') {
    previewLink.setAttribute('aria-haspopup', 'dialog');
    previewLink.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      preview.showModal();
    });
    preview.addEventListener('close', () => previewLink.focus({preventScroll: true}));
  }

  function hasWebGL() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    try {
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!context) return false;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch {
      return false;
    }
  }

  const status = document.getElementById('readiness-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function report(name, icon, message) {
    const row = status.querySelector(`[data-readiness="${name}"]`);
    row.dataset.result = icon;
    row.querySelector('use').setAttribute('href', `assets/icons.svg#${icon}`);
    row.querySelector('span').textContent = message;
  }

  function reportMotion() {
    report('motion', 'check', motion.matches ? 'Reduced motion preferred' : 'No reduced-motion preference detected');
  }

  status.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const available = hasWebGL();
    report('graphics', available ? 'check' : 'alert', available
      ? '3D graphics supported'
      : '3D graphics unavailable. Use the accessible directory.');
    reportMotion();
    motion.addEventListener('change', reportMotion);
  }));
})();
