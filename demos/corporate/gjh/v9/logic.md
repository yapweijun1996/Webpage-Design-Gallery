# GJH V9 — Evening Street Interaction Contract

## Scene architecture

The visual experience is a progressive enhancement over the store list, native product `details` and brand stories. Without JavaScript those baseline sections remain visible and the scene is hidden. JavaScript adds `.js.visual-ready` to the root and selects `data-view="visual"` or `data-view="list"`. The List view button keeps its text and uses `aria-pressed` to announce list mode. Baseline anchor links, including product deep links, reveal the list before their native navigation.

The evening street is layered HTML/CSS, not WebGL or full 3D. A `.street-camera` translates and scales around its center; `.street-stage` carries bounded pointer rotation and CSS ambient motion. Storefronts are semantic buttons. The lobby panel represents the street, and only the active room panel is exposed. The mini-map and live room heading describe the panel actually displayed, not a destination still in transit.

## Navigation and camera

`script.js` owns the active room, pending destination, last entered storefront, travel timer and cancellation version. Entering starts at the neutral street camera, measures the selected facade button with camera/stage transforms temporarily neutralized, and computes its center relative to the scene bounds. Translation percentages compensate for a 2.6 scale with the CSS transform order `translate(...) scale(...)`. After the 850ms dolly, the selected room is revealed and its heading receives focus.

Returning first reveals the street at the previous facade's zoomed pose, then reverses to the neutral camera and returns focus to that entrance. A map journey between brand rooms exits to the street before entering the new facade. Repeated navigation cancels the old timer; its version guard prevents a stale callback from exposing a superseded room. Switching views cancels travel and keeps the actually active room. A live motion-preference change resolves any pending destination immediately when reduced motion is enabled.

Reduced motion does not select list view. Room changes are immediate, pointer animation frames are cancelled, and CSS disables transitions and ambient drift. Pointer look otherwise runs only for a fine, hovering mouse on the street, uses small degree-valued rotations and resets on pointer leave, navigation or view changes. No pointer animation frame is scheduled under reduced motion.

## Keyboard and product details

Arrow handling is attached only to the visual experience. On the street it moves focus between entrance buttons; on the map or inside a room it moves focus between map buttons. It never enters a room by itself. Native Enter/Space activation selects the focused button. Escape returns to the street unless a product dialog is open, in which case native dialog cancellation takes precedence.

A New Moon hotspot temporarily moves its original matching `details` element into the native modal dialog and opens it. No product content is duplicated. Native `showModal()` supplies modal focus containment and Escape behavior. Closing restores the detail element to its original sibling position and disclosure state, then returns focus to the originating hotspot. List links instead open the original disclosure in place. View changes close any dialog before hiding a region that could retain focus.

## Content and provenance boundaries

New Moon hotspots map individually to `sku-nz`, `sku-au`, `sku-sa` and `sku-mx`, retaining the exact source-listed SKU/pack size and available original image views. MILI and GOGO present official artwork and brand stories only; there are no invented products or replacement packshots. Official logo files are distinct from the unchanged cover artwork and product photography.

Local asset origins and icon catalog references are recorded in `assets/sources.json`. The official eShop link is an explicit outbound navigation, not a runtime fetch. Packaging editions are not confirmed as currently brand-approved. This unofficial concept presents no unsupported product prices, stock, promotions or certifications and is not endorsed by Goh Joo Hin Pte Ltd.
