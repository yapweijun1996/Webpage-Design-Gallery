# GJH v11 Shelf focus scope

Status: historical proposal reconciled with the current implementation, 2026-11-15. The active plan is `v11-shelf-focus-plan.md`; executed evidence and remaining release gates are in `v11-shelf-focus-review.md`. Sources: v11 code (script.js, assets/world.js, assets/products.js), docs/v11-collection-review.md, docs/v11-demo-bag-review.md, owner decisions of 2026-11-14, and an external mockup board (generated concept art, not a spec).

## 1. What exists today
- Proximity model: each New Moon SKU has one interactable (`new-moon-<sku>-front`, z -8.3, radius 1.9). The nearest one in range is `nearby`; F or the touch Inspect button now opens Shelf; Inspect details explicitly hands off to the existing product dialog.
- Four verified SKUs only: nz-425g, au-425g, sa-425g, mx-454g. Shelf signs read NEW ZEALAND, AUSTRALIA, SOUTH AFRICA, MEXICO.
- One M056 shelf per SKU: three tiers by three cans, nine per SKU and 36 configured placements. Visitor v2 physical pickup temporarily reserves and hides one can (35 visible while held), then restores it on return. Shelf Add changes demo quantity only; it never reserves stock.
- The initial proposal had no shelf close-up or highlight. The current implementation adds Shelf presentation and a whole-shelf target; it does not create per-can varieties. Demo bag remains (quantity only, max 9, no price, session storage).

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
1. Explore: walking near a shelf shows the compact nearby card (thumbnail, product name, one Inspect button). The shelf gets a subtle outline. The existing physical Pick up product / Return to shelf action and its accurate visible notice remain; both actions share a 44px row.
2. Inspect: enters Shelf state (see the mode state machine in task.md). A temporary presentation camera frames the full metadata-owned shelf bounds. Joystick and Run hide. Back and Close are 44px targets.
3. In Shelf state: sheet shows name, one-line disclaimer, Inspect (opens product dialog) and Add to Bag (demo). Same SKU on every can, so tapping any can on the shelf selects that SKU.
4. Exit: Close, Escape, backdrop or Back restores the exact previous position, camera and focus. Opening a modal, switching to List, hiding or blur cancels cleanly.
5. Reduced motion: no camera animation; cut to the close-up.

## 5. Constraints
- No new runtime artwork, geometry, textures or asset fetches; reuse loaded hash-verified instances. One local JavaScript presentation module is added.
- English text only, SVG icons from SVG-Icon-Studio, design tokens only (scripts/check_ssot.py must pass).
- Viewport stays locked at scale 1.
- The historical approximately 12% target applies advisorially to added card density, not the combined physical-action HUD. Published 1.1.38 full-prompt baseline is 120.59px at 320/390. Preserve approximately 121px, separate identity-row/full-prompt measurements, readable disclosure and full 44px controls.

## 6. Acceptance (real screenshots, taste gate)
At 390x844, 320x568, 844x390, 667x375: shelf outline visible, nearby card and disclaimer do not overlap, Shelf state shows the full shelf plus sheet, no horizontal overflow, focus restored after exit, screenshots looked at before push. See the current review for executed software viewport/inset and actual driver context-loss results. Physical iPhone/Android, real device safe areas and device FPS remain unverified.

## 7. Open items
Shelf now uses the existing canonical mode state machine (Explore, Menu, Inspect, Seated, Cart, Shop, plus Shelf). Independent visual acceptance and publication remain parent-owned gates. Real-device FPS check is required before any glossy lighting or reflections from the mockup are adopted.
