# GJH v11 mobile HUD - redesign gap report and status

Date: 2026-11-14. Sources: two external design specifications (a mobile-first UI/UX gap report with 100 proposed E2E tests, and a 13-persona redesign review with HUD concept images) plus this repository's own checks. The specifications are design proposals; their counts and token values are suggestions, not audit results, and the concept images are not usability-tested.

## Design decisions (owner-approved direction)
1. Keep the existing 3D mall world. Redesign the HUD, interaction prompts, camera and navigation around it.
2. **The bottom five-item navigation (Home, Shops, Events, Rewards, Profile) must not be permanently visible in every game state.** In free exploration the joystick and the contextual interaction action keep priority; the full navigation appears only in menu or shop mode.
3. Game world, controls, HUD presentation, interaction state and commerce state stay separate modules, so Seat, Cart, Inspect, a restaurant mini-game or new scenes do not require a new UI.
4. Every mode (Explore, Menu, Inspect, Seated, Cart, Shop) defines enter, exit, cleanup and restore, so no camera, joystick or input state is left behind.

## Conflicts to resolve before building the shopping layer
- The proposed Shop mode, Rewards and real Checkout handoff remain separate, unresolved scope. The current demo already has a session-only Demo bag (1.1.20) and a pushable 3D cart (1.1.24); neither adds prices, stock reservation, real orders or payment. Product panels retain the external official eShop link, which is not a checkout for the demo bag.
- Events, Rewards and Profile have no backing features today; showing them would be mock UI and must be labelled as such.
- The proposed `src/` TypeScript layout does not apply: v11 is vanilla ES modules with no build step.

## P0 status (this repository, as of the last verification below)
| Gap | Status | Evidence / note |
|---|---|---|
| P0-01 Header too tall | Done on touch/narrow | Single slim row; 72px at 390x844, 61px landscape, 83px desktop (OMP Playwright run). |
| P0-02 Joystick footprint | Existing | Fixed and floating stick already present; not re-audited. |
| P0-03 Run control | Existing | Hold/toggle behaviour not re-audited; Run stays visible and 44px high. |
| P0-04 Contextual interaction | Partial | Compact one-row prompt chip; touch labels ("Tap ...") instead of "Press F". Target highlighting open. |
| P0-05 Camera | Existing | Read-only code audit: second finger drives the camera while the stick is held. |
| P0-06 Safe area | Partial | `env(safe-area-inset-*)` used for header, controls and prompts; real iPhone insets NOT verified. |
| P0-07 Touch conflicts | Existing | Audit: pointer capture, `touch-action: none`, cancel/blur/visibility reset present. |
| P0-08 Target identification | Open | No highlight or distance hint yet. |
| P0-09 Mode separation | Partial | Guide, dialogs, bag and the compact map pause input; no explicit mode state machine yet. |
| P0-10 Low-end tiers | Open | Draw-call budget tests exist; no quality tiers. |
| P0-11 Interruption recovery | Partial | Blur/visibility reset present; WebGL context loss NOT verified. |
| P0-12 Accessibility | Partial | HUD targets >= 44x44 CSS px; contrast and screen-reader behaviour NOT verified. |

P1 (12) and P2 (8) items from the specifications stay planned: onboarding, quest tracker, mini-map, bag persistence, character animation states, loading progress, analytics, control presets, photo mode, ambient NPCs, spatial audio, quality profiles, content configuration. They are not committed scope.

## Verification record (mobile HUD P0 round)
- Method: OMP (gpt-6-luna) Playwright mobile emulation with SwiftShader WebGL, repository root served so `assets/tokens.css` loads; screenshots were then reviewed by the manager. A first round with the wrong server root was discarded.
- `scrollWidth == innerWidth` at 320, 360, 390, 667, 844, 1024 and 1280 px.
- Smallest visible HUD button 44x44 px; Bag button width constant (82px portrait, 88px landscape) from count 0 to 99.
- Landscape disclaimer no longer covers Run: zero intersections with Run, joystick and prompt chip at 844x390, 667x375, 390x844 and 320x568.
- After merging main (cart push and bench sit), seated and cart states touched the disclaimer by 0.9 px in portrait; fixed by lifting the prompt (commit "lift portrait seated and cart prompt").
- `build_gallery.py --check` and `test_gallery.py` pass with Python 3.15 (system Python 3.9 cannot run the build script).
- NOT run: physical iPhone Safari / Android Chrome, real safe-area insets, WebGL context loss, the full repository browser suites, FPS on real devices.

## Next
Implement the explicit mode state machine and the contextual-navigation rule (decision 2) first; preserve the existing simulated bag/cart and defer any real-commerce layer until its scope is explicitly decided; keep the Diner Dash-style restaurant mini-game as a separate scoped item (`docs/gjh-v11-restaurant-minigame-scope.md`).

## Re-verification: portrait seated/cart prompt lift (commit 4857d53)

Verified 2026-11-14 with Playwright + SwiftShader WebGL (repo-root server, scene ready, real screenshots inspected). Prompt chip vs `.scene-disclaimer` intersection is 0 px² in seated and pushing states at 390x844, 320x568, 844x390 and 667x375; chip vs header is 0; `scrollWidth == innerWidth` at 390, 320, 844 and 667. Joystick/Run intersections reported in the raw metrics are on elements the CSS hides (`visibility:hidden`) while seated or pushing, and are not drawn in the screenshots. Not run: physical devices, real safe-area insets, WebGL context loss, device FPS.

## Commerce wording reconciliation — 2026-11-14

The original conflict paragraph said “no prices, stock or cart.” Its no-cart clause was stale relative to the already shipped [1.1.20 Demo bag](v11-demo-bag-review.md) and [1.1.24 pushable demo cart](v11-cart-review.md). The paragraph above now distinguishes those simulations from real commerce. Source checks: [`demo-bag.js`](../demos/corporate/gjh/v11/assets/demo-bag.js) describes a session-only selection store with no network writes; the cart release contract preserves that same selection state and explicitly excludes prices, orders, payments and stock claims. Historical verification records above are unchanged; this correction adds no runtime behavior, test result, mode implementation or commerce authorization.
