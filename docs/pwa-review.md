# Gallery PWA — Architecture and Acceptance

The application now follows the KB `pwa:product-standard` and `pwa:sw-install-integrity` workflows. Scope is the company-first Gallery under its own project URL prefix. Corporate demos remain independent, network-only documents; this does not add a cart, messaging channel or backend.

## Ownership and Lifecycle

- `data/app.json`: semantic version; `scripts/build_gallery.py`: deterministic build identity, normalized Windows/Linux text bytes, publication allowlist and generated shell/worker.
- `templates/gallery/base.html`, `src/pwa.js`, `assets/pwa.css`: manifest links, visible version and check/update controls, install help, loader, offline state, safe areas and scroll behavior.
- `templates/gallery/sw.js`: install integrity, build-scoped caches and explicit activation. `sw.js`, `version.json`, Gallery HTML and `offline.html` are generated outputs.
- `manifest.webmanifest`, `assets/icons/`: application identity and locally rendered code-native icons. GJH/New Moon trademarks are not used as the Gallery app icon.

Each runtime change produces a new build identity. A candidate fetches build identity and precache resources with cache-busting URLs and reload semantics, verifies every SHA-256 and commits only a complete matching shell. A mismatch rejects the candidate and removes only its cache. Activation cleans only older caches owned by this project prefix; other applications sharing the origin are preserved.

The active shell is cache-first to preserve one coherent release until acceptance. Visible-tab checks run on start, visible return and every ten minutes; reconnect and the explicit check bypass that throttle. A verified waiting worker exposes its version through a message channel. The user sees **Update to v…**, then a modal loader, activation, controller verification and one reload preserving the URL. Activation timeout has a closable error/retry state. Other tabs are prompted rather than silently reloaded.

## Offline Contract

After a successful initial install: discovery, local search, filters, company collections, design metadata and thumbnails are saved. Demos, full-resolution screenshots, external sites and commerce channels need a connection. Failed demo navigation redirects to a cached explanation; missing full screenshots receive a labelled placeholder. No sensitive/user-generated data is cached. Closing the browser does not guarantee background checks; checks resume when the Gallery is used.

The release has a light-only theme, opaque white system chrome, `viewport-fit=cover` and safe-area padding. A transform-based header hides/reveals with scrolling and remains visible for keyboard focus or update prompts. Back-to-top is contextual and safe-area aware. Both respect reduced motion. CSP permits only local scripts/connects/frames; inline styles remain allowed for the existing comparison sizing code.

## Verification

Run `python tests/browser_pwa.py`; it uses a temporary persistent Chrome profile and two controlled release fixtures under `/Webpage-Design-Gallery/`. Test fixture network responses avoid mtime-only 304s when releases change within a second. A delayed worker reply makes the loader observable; a non-activating fixture exercises actual timeout recovery. Neither fixture is published.

| Check | Status |
| --- | --- |
| Chrome manifest and installability inspection | PASS; no installability errors |
| 1440 / 768 / 390 / 375px, overflow and primary 44px controls | PASS |
| Opaque system chrome and safe-area CSS | PASS in emulated Chrome; physical iOS NOT RUN |
| Offline reload, company search, style filters and explicit demo fallback | PASS |
| Build mismatch and mixed-file integrity rejection | PASS |
| Visible new version, explicit update, modal loader, single reload | PASS |
| Other-tab consent and preservation of unrelated caches | PASS |
| Activation timeout and retry recovery | PASS |
| Smart header, back-to-top and reduced motion | PASS |
| Native OS install dialog / installed iPhone Safari | NOT RUN |
| Dark theme chrome | N/A; Gallery is light-only |
| Full screen-reader / WCAG conformance assessment | NOT RUN |

Raw results: [browser evidence](evidence/pwa-browser.json). Screenshots: [company](screenshots/pwa/company-390.png), [waiting release](screenshots/pwa/update-available-375.png), [updating](screenshots/pwa/updating-375.png). Functional Gallery checks use real service workers for the main flow and block them only for intentional network-error/synthetic fixtures; dedicated PWA tests own worker lifecycle coverage.

GitHub Pages/CDN propagation may temporarily expose inconsistent files. Integrity checks fail closed; users can retry **Check updates** after publication settles. The first PWA release reaches previously open, non-PWA pages only after a normal reload; those old documents have no update client installed yet. Subsequent releases provide the explicit update workflow.
