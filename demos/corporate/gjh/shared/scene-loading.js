/** Reserve the arcade viewport before paint without hiding its HTML directory. */
(() => {
  const root = document.documentElement;
  root.dataset.sceneState = 'loading';
  function showDirectory() {
    if (root.dataset.sceneState !== 'loading') return;
    root.dataset.sceneState = 'fallback';
    const status = document.querySelector('#scene-status');
    if (status) status.textContent = 'The 3D scene is taking longer than expected. Browse the complete store directory below; 3D view remains available when ready.';
  }
  // A failed entry script must not leave an empty reserved viewport indefinitely.
  addEventListener('error', event => {
    if (event.target instanceof HTMLScriptElement && event.target.src.endsWith('/script.js')) showDirectory();
  }, true);
  setTimeout(showDirectory, 20000);
})();
