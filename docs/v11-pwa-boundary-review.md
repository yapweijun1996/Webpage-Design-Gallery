# V11 and Gallery PWA boundary review

## Contract and scope

Read KB `pwa:product-standard` 1.0.1 and `pwa:sw-install-integrity` 0.2.0-chrome-verified. The parent Gallery is the installable PWA: manifest identity/start URL are the Gallery, not V11. It has project-scoped versioned caches, build-identity and per-file SHA-256 installation checks, explicit waiting-worker notification and loader-backed user activation. It never automatically refreshes an active page. V11 is an independent online demo with no own manifest, registration or update UI. Its large 3D assets are deliberately outside precaching. A fresh direct V11 visit does not install the Gallery worker; a prior Gallery installation can control V11 under the shared scope.

## Confirmed issue, not speculation

The earlier `locationName` ReferenceError was a missing code binding, repaired in 1.1.29, not proven stale caching. A separate real Chromium service-worker reproduction demonstrated a cache boundary mismatch: after changing the network theme stylesheet, the live demo received the old `assets/gjh-themes.css` from the Gallery shell cache while its own files were network-only. This can mix current demo markup with old theme tokens. It does not prove that the owner's particular device had this cache state.

## 1.1.30 fix

For a non-navigation precached-resource request from a same-app `demos/` window client, the worker now uses network revalidation instead of its Gallery shell cache. Gallery pages retain their coherent cached release. Install hashes, scoped cache deletion, waiting/activation and storage are unchanged. No offline 3D promise, cache purge, automatic reload or bag migration is introduced. Requests without a resolvable client retain the existing path. This correction takes effect only after the new worker activates; an already running old worker cannot acquire the new policy without an update.

## Necessary evidence

`tests/browser_pwa_demo_boundary.py` uses a project subpath, real Chromium SW, two built releases and controlled server changes. PASS: Gallery retains its cached theme; V11 receives updated network theme bytes; failed network is not replaced with stale demo theme; offline demo navigation goes to the explicit connection-needed page; a waiting release offers Update without changing the loaded release; explicit Update shows a loader and performs one reload; a product added through the actual V11 UI remains in the same tab's session-only Demo bag after the update and return. The first test fixture used a string predicate rejected by the Gallery CSP; function predicates corrected the fixture without weakening CSP. No unrelated visual suite rerun. Read-only advisor reviewed the SW boundary; no visible UI changed.

## Coverage / limitations

- Manifest/install: source contract present for Gallery; V11 standalone installation is not implemented. Native install dialog and physical iOS NOT RUN.
- Offline: Gallery browsing contract retained; demos require network, verified fallback.
- Version/cache/update notification/loader: targeted browser PASS; per-file install integrity unchanged and source-reviewed, prior full evidence remains in `pwa-review.md`.
- Safe areas/system chrome: existing CSS and light-only Gallery retained; real notch/status bar and physical installed-device behavior NOT RUN.
- Smart top bar/scroll-to-top: existing Gallery implementation retained; no new visual/layout claims.
- Demo bag: session-only by design; same-tab update retention PASS, not cross-device or durable account persistence.
- Runtime stale scripts: no service-worker cache of V11 JS; ordinary HTTP caches or already-open documents can still retain loaded code. No evidence here attributes a specific owner incident to those possibilities.

Rollback: revert the release and regenerate Gallery artifacts; no storage schema change. Keep explicit user-controlled update acceptance.
