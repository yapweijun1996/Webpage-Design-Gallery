# V11 pointer interruption recovery — 1.1.11

## Problem and bounded repair

At baseline `a13f98f`, the player listened to pointer-up and pointer-cancel but not lost capture. Real Chromium touch input followed by `releasePointerCapture` emitted a trusted `lostpointercapture` event, yet the avatar continued walking 0.424 metres during the next 250 ms. Evidence: `docs/evidence/v11-pointer-baseline.txt`.

The existing pointer-specific release handler now also handles lost capture. It recentres the affected joystick or ends the affected camera drag; it does not clear unrelated pointers or change running, keyboard mappings, movement speed, store navigation, UI layout or models.

## Verified results

`tests/browser_gjh_pointer.py` uses actual Chromium CDP touch input and Playwright mouse input, not synthetic DOM pointer events. Both 390×844 and 844×390 pass:

- Touch moves the character before capture is explicitly released.
- Trusted lost-capture events are observed; subsequent 250 ms movement is zero.
- Thumb recentres; a new touch works and touch cancellation stops movement.
- Mouse drag turns the camera, then capture loss prevents further hover movement from turning it.
- Arrow-key movement works afterwards; no page errors.

Evidence: `docs/evidence/v11-pointer.json`. This is Linux ARM64 Chromium 158/SwiftShader browser emulation, not physical Android/iOS or Safari testing. Capture release is deliberately induced to reproduce the interruption; it is not a claim about a specific mobile OS gesture.

Also PASS: generator check, SSOT check, 40 unit tests, full V11 movement/collision/turning/F/dialog/reduced-motion/hidden/context/WebGL/WASM/no-JS suite, five-size/orientation landscape controls, first-use guide, real and failed kiosk, gallery browsing, 28 legacy GJH browser cases plus four no-JS journeys, and real service-worker PWA lifecycle suite. Maximum observed V11 draw calls remain 137. No rendering/style changes or new assets are included, so no new visual-quality claim is made.

## Release and rollback

The original and branded models are unchanged; unpublished branded candidates remain excluded. Application version is bumped through `data/app.json` and generated files rebuilt. Before push, check the staged diff and reverse applicability; rollback is a normal revert of this release commit with a fresh application version/build and the same deployment checks, not a force-push. Public Pages deployment and live pointer flows must be verified after push; local tests alone do not prove deployment.
