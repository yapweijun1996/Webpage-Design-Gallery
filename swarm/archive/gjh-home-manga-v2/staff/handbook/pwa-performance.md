# PWA and Performance

## Purpose

Keep exported SDS pages installable and usable offline with a predictable update flow.\
Protect first render time and layout stability on small screens.

## Rules

1. Use the PWA shell to link `manifest.webmanifest`. Check `name`, `short_name`, relative `start_url` and `scope` of `./`, `display: standalone`, theme and background colors, and icons in 192, 512, and maskable 512 sizes.
2. Check that the shell contains exactly the viewport meta element below, sets `data-viewport-lock` on `<html>`, and applies `touch-action: manipulation` to it. Keep viewport policy in the shell.
3. Keep controls clear of cutouts and home indicators. Use `--sds-safe-top`, `--sds-safe-right`, `--sds-safe-bottom`, and `--sds-safe-left` in the relevant layout. Verify content clears the fixed `.sds-actionbar` and its `--sds-bar-h`.
4. Verify that the versioned `sds-<VERSION>-<hash of the file list>` precache matches the files actually exported to `dist/`. Check that `__PRECACHE__` is replaced and that old caches are deleted on activation.
5. Confirm cache-first loading with network fallback for precached assets and `offline.html` for an offline navigation with no cached page. Visit the export online and let its service worker take control before testing offline reload.
6. Keep update activation behind the shell's `.sds-toast` action. `SDS.update.check()` checks for an update and the “Update now” click calls `SDS.update.apply()`. The worker calls `skipWaiting` only on `SKIP_WAITING`. Check the displayed version before and after acceptance.
7. Keep every runtime image at or below 200 KiB. Use responsive `<picture>` with correctly sized sources and declare `width` and `height` on `<img>`. Lazy-load images below the first screen. Load first-screen images eagerly.
8. For LCP, put the main image in the initial HTML and give the expected LCP image priority. For CLS, reserve the actual image aspect ratio and the loader footprint. Compare their positions before and after loading.
9. Keep inline data URIs at or below 20 KB. Move larger resources into exported assets and check `inline-large-data-uri`.
10. Use the system stack through `--sds-font-sans` and `--sds-font-mono`. Check that a first load needs no web font request.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

## Do / Don't

Reserve the image footprint in the component. Avoid an image with no intrinsic dimensions in the markup.

```html
<!-- Do -->
<img class="sds-chapter__media" src="assets/hero.webp" alt=""
     width="1280" height="720">
<!-- Don't -->
<img class="sds-chapter__media" src="assets/hero.webp" alt="">
```

Use the SDS sans stack for body copy. Reserve the mono stack for content that needs aligned characters.

```css
/* Do */
font-family: var(--sds-font-sans);
/* Don't */
font-family: var(--sds-font-mono);
```

## Patterns

### Responsive first-screen image

Choose sources with the same aspect ratio as the fallback.

```html
<picture>
  <source media="(max-width: 48rem)" srcset="assets/hero-640.webp">
  <img class="sds-chapter__media" src="assets/hero-1280.webp" alt=""
       width="1280" height="720" loading="eager" fetchpriority="high">
</picture>
```

### Lazy image below the first screen

```html
<img src="assets/location.webp" alt="Main entrance"
     data-i18n-attr="alt:directory.entrance"
     width="640" height="480" loading="lazy">
```

### Clear the bottom action bar

Replace `.s-NN` with the numbered section scope. Apply the clearance where the phone action bar overlays content and count the safe-area inset once.

```css
.s-NN {
  padding-bottom: calc(var(--sds-bar-h) + var(--sds-safe-bottom));
}
```

## Self-check

1. Does the exported shell have the required viewport, manifest, and relative icon paths?
2. Does the precache equal the exported file list and serve an offline navigation fallback?
3. Does the waiting worker stay waiting until “Update now” is clicked?
4. Are assets within their budgets and are image dimensions, priority, and lazy loading set appropriately?
5. Do the system fonts, loader footprint, and safe-area layout preserve a stable first screen?

## Tools

- Run `node swarm/tools/export-page.js "$projectDir" --out "$outDir"` with a path for the exported PWA.
- Run `node swarm/tools/check-sections.js "$projectDir" --baseline` to check section findings including `inline-large-data-uri`.
- Run `node --test swarm/test/*.test.js` to check export and precache behavior.
- In Chrome DevTools, inspect `/p/dist/index.html` for requests, LCP, CLS, offline reload, and update activation. If the browser is unavailable, record these observations as UNVERIFIED.

## Sources

- Web App Manifest
- Service Workers
- web.dev Core Web Vitals
- Apple Human Interface Guidelines
