# GJH V11 PWA profile and verification

## Scope

The V11 concept is an `IMMERSIVE_3D` PWA with a connected directory and a session-only demo bag. It does not accept payments, create orders, reserve inventory, store accounts, or synchronize user data. Production requires HTTPS. The manifest gives V11 its own identity, start URL, scope, name and icons; the parent Gallery remains a separate PWA.

The V11 worker has a narrower scope and a cache prefix containing its scope path. Its only cached resources are the offline reconnect page, manifest and two app icons. The offline budget for these four files is 256 KiB. The actual directory, product information, 3D assets and eShop remain network-dependent. A failed navigation shows the saved reconnect page after successful worker installation. The original page still has the existing no-JavaScript and WebGL-failure directory. The worker does not cache authenticated responses or introduce an IndexedDB schema or queued writes.

Every worker install checks the Gallery release identity and verifies SHA-256 for each offline resource. A failed candidate deletes only its own cache. A new worker waits for user action; update retains the existing tab's session storage, while other controlled tabs receive a reload notice and do not reload automatically. The update action is blocked while a modal is open or the connection is unavailable. First registration claims only matching V11 clients and never reloads them. Updates are checked at startup, on returning to a visible tab after the throttle, on reconnect, and on request; a 404 navigation requests a check. CDNs may take approximately ten minutes to converge after publication.

The installer provides a browser-driven prompt when available and manual iOS/iPadOS Share → Add to Home Screen guidance. Chrome's prompt and the fallback are not proof of actual OS installation. The app status explains the network requirement. Standalone safe-area adjustments and mobile text-input sizing are present; the existing cream brand theme remains light-only. Independent dark/system theme selection, translated content, and a smart hide-on-scroll header remain unimplemented and are not represented as available. Push notifications, background sync and transaction replay are not applicable to this demo.

## Acceptance and limits

- `python tests/browser_gjh_pwa.py` exercises a project-prefix deployment with real Chromium service workers: Gallery/V11 coexistence, manifest/installability, offline failure and reconnect, same-tab demo bag retention, mismatched identity, tampered offline assets, explicit one-reload update and no automatic reload in another tab.
- `python tests/browser_pwa_demo_boundary.py` checks the Gallery's cached theme and V11 network-fresh theme, the V11 offline fallback, and Gallery update/bag boundary.
- `python tests/browser_gjh_hybrid.py` checks the existing 2D/3D shopping flow at desktop and phone-sized viewports.
- `python scripts/build_gallery.py --check` and `python -m unittest discover -s tests -p test_gallery.py -v` check generated artifacts and the gallery contract.

Browser emulation is not a physical-device result. Physical iOS/iPadOS standalone, VoiceOver, Safari/macOS, Android installed mode, Edge, Firefox, OS installation dialogs, dark-mode UI, real-device GPU performance and field Core Web Vitals are **NOT RUN**. The house standard's complete release gates and 60-case catalog are not certified by these checks. Field LCP, INP and CLS have insufficient data. A production release needs the missing platform, accessibility and performance evidence and a rollback review.

Rollback by reverting the V11 PWA sources and regenerating gallery outputs. Existing registrations are browser-managed; a future retirement release must explicitly and safely migrate or unregister the child worker rather than deleting other applications' caches.
