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
    <label><span data-i18n="sds.theme">Theme</span>
      <select data-sds-select="theme" class="sds-field">
        <option value="auto" data-i18n="sds.theme.auto">Auto</option>
        <option value="light" data-i18n="sds.theme.light">Light</option>
        <option value="dark" data-i18n="sds.theme.dark">Dark</option>
      </select>
    </label>
    <label><span data-i18n="sds.brand">Brand</span>
      <select data-sds-select="brand" class="sds-field">
        <option value="none">Default</option>
        <option value="forest-gold">Forest Gold</option>
        <option value="gjh-classic">GJH Classic</option>
        <option value="cny-red-gold">Chinese New Year</option>
      </select>
    </label>
    <label><span data-i18n="sds.language">Language</span>
      <select data-sds-select="lang" data-sds-export-languages class="sds-field">
        {{LANG_OPTIONS}}
      </select>
    </label>
    <p><span data-i18n="sds.version">Version</span> <span>{{VERSION}}</span></p>
    <button type="button" class="sds-btn sds-btn--secondary" data-sds-check-updates data-i18n="sds.update.check">Check updates</button>
    <span role="status" data-sds-update-status></span>
  </div>
  <div class="sds-toast" data-sds-update-toast hidden>
    <span data-i18n="sds.update.available">Update available</span>
    <button type="button" class="sds-btn sds-btn--primary" data-sds-apply-update data-i18n="sds.update.now">Update now</button>
  </div>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const sds = window.SDS;
      if (!sds) return;
      const status = document.querySelector('[data-sds-update-status]');
      const toast = document.querySelector('[data-sds-update-toast]');
      const check = document.querySelector('[data-sds-check-updates]');
      const apply = document.querySelector('[data-sds-apply-update]');

      if (window.isSecureContext && /^https?:$/.test(location.protocol) && window === window.top && 'serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {
          status.textContent = 'Offline access could not be enabled.';
        });
      }

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
