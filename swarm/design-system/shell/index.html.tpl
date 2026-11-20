<!doctype html>
<html lang="{{LANG}}" data-viewport-lock data-default-brand="{{BRAND}}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="{{THEME_COLOR}}">
  <title>{{TITLE}}</title>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  {{SCRIPTS}}
  {{STYLES}}
  <style>
    html{touch-action:manipulation}
    [data-sds-first-paint] { display: none; }
    html[data-loading] [data-sds-first-paint] {
      display: grid;
      place-items: center;
      position: fixed;
      inset-block-start: calc(var(--sds-safe-top) + var(--sds-space-2));
      inset-inline-end: calc(var(--sds-safe-right) + var(--sds-space-2));
      inline-size: var(--sds-tap);
      block-size: var(--sds-tap);
      color: var(--sds-color-text);
      background: var(--sds-color-surface);
      border-radius: var(--sds-radius-pill);
      z-index: var(--sds-z-overlay);
      pointer-events: none;
    }
    [data-sds-update-toast][hidden] { display: none; }
  </style>
</head>
<body>
  <div data-sds-first-paint aria-hidden="true"><span class="sds-spinner"></span></div>
  <main>
{{BODY}}
  </main>
  <div class="sds-container sds-prefs" role="group" aria-label="Page preferences">
    <label>Theme
      <select data-sds-select="theme" class="sds-field">
        <option value="auto">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    <label>Brand
      <select data-sds-select="brand" class="sds-field">
        <option value="none">Default</option>
        <option value="forest-gold">Forest Gold</option>
        <option value="gjh-classic">GJH Classic</option>
      </select>
    </label>
    <label>Language
      <select data-sds-select="lang" class="sds-field">
        {{LANG_OPTIONS}}
      </select>
    </label>
    <p>Version <span>{{VERSION}}</span></p>
    <button type="button" class="sds-btn sds-btn--secondary" data-sds-check-updates>Check updates</button>
    <span role="status" data-sds-update-status></span>
  </div>
  <div class="sds-toast" data-sds-update-toast hidden>
    <span>Update available</span>
    <button type="button" class="sds-btn sds-btn--primary" data-sds-apply-update>Update now</button>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const sds = window.SDS;
      if (!sds) return;
      const status = document.querySelector('[data-sds-update-status]');
      const toast = document.querySelector('[data-sds-update-toast]');
      const check = document.querySelector('[data-sds-check-updates]');
      const apply = document.querySelector('[data-sds-apply-update]');

      sds.on('updateavailable', () => {
        toast.hidden = false;
        status.textContent = 'Update available';
      });
      check.addEventListener('click', async () => {
        check.disabled = true;
        status.textContent = 'Checking for updates';
        try {
          await sds.update.check();
          if (toast.hidden) status.textContent = '';
        } catch (error) {
          status.textContent = 'Could not check for updates. Try again.';
        } finally {
          check.disabled = false;
        }
      });
      apply.addEventListener('click', async () => {
        apply.disabled = true;
        try {
          await sds.update.apply();
        } catch (error) {
          status.textContent = 'Could not apply the update. Try again.';
        } finally {
          apply.disabled = false;
        }
      });
    });
  </script>
</body>
</html>
