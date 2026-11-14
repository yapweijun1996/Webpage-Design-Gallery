# GJH v11 shelf focus mode: one-page scope (research only, no code)

Status: proposal, 2026-11-14. Sources: v11 code (script.js, assets/world.js, assets/products.js), docs/v11-collection-review.md, docs/v11-demo-bag-review.md, owner decisions of 2026-11-14, and an external mockup board (generated concept art, not a spec).

## 1. What exists today
- Proximity model: each New Moon SKU has one interactable (`new-moon-<sku>-front`, z -8.3, radius 1.9). The nearest one in range is `nearby`; F or the touch Inspect button opens the product dialog.
- Four verified SKUs only: nz-425g, au-425g, sa-425g, mx-454g. Shelf signs read NEW ZEALAND, AUSTRALIA, SOUTH AFRICA, MEXICO.
- One shelf per SKU: four tiers by three cans, all the same SKU. Shelf cans are instances; stock is never removed.
- No shelf close-up, no highlight, no per-can selection. Demo bag exists (quantity only, max 9, no price, session storage).

## 2. What the mockup proposes
Shelf close-up camera, a highlighted can with a ring, a bottom sheet with thumbnail, Inspect and Add to Bag, and a product page with 3D/Official tabs.

## 3. Conflicts to resolve before building
| Mockup element | Rule or fact | Decision |
|---|---|---|
| Price S$28.90, quantity stepper | No prices; bag is quantity-only | Remove price. Keep quantity only inside the demo bag. |
| About 15 can varieties on shelves | Only 4 verified SKUs/assets | Show only the 4 verified SKUs. Never invent cans. |
| Per-can highlight | All cans on a shelf are the same SKU | Highlight the whole shelf (one target per SKU), not single cans. |
| Labels SOUTH AMERICA / OTHERS | Code and assets say SOUTH AFRICA / MEXICO | Code is the source of truth. |
| Permanent bottom five-item nav in Explore | Owner decision: not permanent | Not in Explore. Menu or shop mode only. |
| Add to Bag | Owner chose to keep it, labelled Demo | Demo bag, no price, stock or checkout. |

## 4. Proposed behaviour
1. Explore: walking near a shelf shows the compact nearby card (thumbnail, product name, one Inspect button). The shelf gets a subtle outline. Nothing else appears; no always-on Interact bar.
2. Inspect: enters Shelf state (see the mode state machine in task.md). Camera moves to a fixed close-up of that shelf. Joystick and Run hide. Back and Close are 44px targets.
3. In Shelf state: sheet shows name, one-line disclaimer, Inspect (opens product dialog) and Add to Bag (demo). Same SKU on every can, so tapping any can on the shelf selects that SKU.
4. Exit: Close, Escape, backdrop or Back restores the exact previous position, camera and focus. Opening a modal, switching to List, hiding or blur cancels cleanly.
5. Reduced motion: no camera animation; cut to the close-up.

## 5. Constraints
- No new geometry, textures or fetches beyond the loaded hash-verified assets; reuse instances.
- English text only, SVG icons from SVG-Icon-Studio, design tokens only (scripts/check_ssot.py must pass).
- Viewport stays locked at scale 1.
- HUD in Explore must not exceed about 12% of screen height at 390x844 and 320x568.

## 6. Acceptance (real screenshots, taste gate)
At 390x844, 320x568, 844x390, 667x375: shelf outline visible, nearby card and disclaimer do not overlap, Shelf state shows the full shelf plus sheet, no horizontal overflow, focus restored after exit, screenshots looked at before push. NOT RUN until built: physical iPhone/Android, real safe-area insets, WebGL context loss, device FPS.

## 7. Open items
Depends on the explicit mode state machine (Explore, Menu, Inspect, Seated, Cart, Shop, plus Shelf). Do not start before that exists. Real-device FPS check is required before any glossy lighting or reflections from the mockup are adopted.
