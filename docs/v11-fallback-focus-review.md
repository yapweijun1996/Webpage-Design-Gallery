# V11 graphics-failure keyboard recovery — 1.1.12

## Reproduction and fix

At baseline `af4a118`, using the real `WEBGL_lose_context` extension while the scene had keyboard focus showed the directory but left focus at BODY. A keyboard user lost their location in the experience. The regression assertion expecting `list-title` failed.

Fallback now detects focus in the disappearing 3D experience, guide, scene product dialog or 3D/List toggle before closing/hiding it, and uses the existing view-transition focus mechanism to focus the directory heading. Focus on the unaffected header and a working directory product dialog is preserved. Initial loading failures do not steal unrelated focus. No assets, styles, URLs, content, movement behavior, product images or store records changed.

## Evidence and boundaries

`tests/browser_gjh_fallback_focus.py` induces actual context loss in Chromium/SwiftShader. At both 390×844 and 1440×900, six cases pass:

- Scene, first-use guide, in-scene product details, and map focus recover to the directory heading.
- Hidden 3D dialogs close, Tab reaches a visible control, and product details remain keyboard accessible.
- Existing directory product details stay open and restore their trigger on Escape.
- Unaffected header focus is not deliberately moved.

See `docs/evidence/v11-fallback-focus.json`. The test fixture walks through the entrance and around the existing table before inspecting a product, rather than bypassing collisions. No physical Android/iOS, Safari or screen-reader behavior is claimed.

Also PASS: generated-artifact check, SSOT, 40 unit tests, full V11 movement/collision/inspection/failure suite, four-width directory/product/focus checks, five-size guide checks, gallery, 28 legacy GJH browser cases and four no-JS journeys, and real service-worker PWA lifecycle tests. No layout/rendering change is included and no new visual quality claim is made.

## Release and rollback

Version 1.1.12 is generated from `data/app.json`. Review the staged diff and reverse applicability before pushing; after deployment verify the exact remote SHA, Pages result, live recovery cases and changed file hashes. Rollback is a normal revert with a new generated version/build and the same release checks, never a history rewrite. Local passes alone are not deployment evidence. Remaining branded-model rights, scene improvements and real-device gates remain open in `task.md`.
