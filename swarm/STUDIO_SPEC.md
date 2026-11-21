# Swarm Design Studio UI spec (binding)

Owner request 2026-11-21 plus a high-fidelity mockup (treated as the approved design): turn the Swarm viewer into a professional, responsive AI Design Studio. Plain browser scripts, zero dependencies, no backend change. Staged: everything is built as NEW files `swarm/ui/studio.html`, `studio.css`, `studio.js`, `studio-activity.js/.css`, `studio-compare.js/.css`, served by the manager at `/studio`. The current `index.html` stays untouched until the owner approves the swap.

## Layout (from the mockup, dark first, light supported)
- Top bar (44-56px, one line, responsive): logo + "Swarm Design Studio", workspace tabs `Design | Team | Review`, status chip (Running / Idle with a live timer), theme toggle, existing icon buttons (screen focus, pick element, settings, appearance) kept.
- Left sidebar (collapsible, 220px, icon-only 56px when collapsed): Project card, nav (Overview, Task board, Agents, Versions, Assets, Settings), Quick actions. On phones it becomes a drawer.
- Centre = LIVE PREVIEW (primary): toolbar with Desktop/Tablet/Mobile segmented control (1440 / 768 / 393 wide), size readout, zoom - / % / +, fit, fullscreen, open in new tab. The page is shown at the chosen width, centred, scaled to fit. Versions strip under it (thumbnails optional, empty state allowed) with a Compare button. Prompt composer at the bottom (existing channel composer behaviour: send, @mentions, scope prefix).
- Right column (resizable 320-520px, collapsible): (1) Swarm Progress card: "Wave n / N", percent bar, step dots (Research, Design and Build, Review and Polish) derived from the channel's `Squad wave` notices and turn phases; (2) Agent Team card: one row per active agent with colour icon, job title, status pill (Done / Working / Pending / Error), elapsed seconds, expandable row showing last thought and files touched; (3) tabs Activity (compact cards, newest first, one line each, expand for detail), Logs (existing channel log, full), Artifacts (files changed, generated images, research.md, review).
- Workspace modes: Design = preview large + right column; Team = agent roster and team editor (reuse the existing Settings Team section) plus lane/title overview; Review = reference vs actual compare (see below) plus review.md and decisions.md.
- Remove floating overlays: no cursors, bubbles, name labels or link lines drawn on top of the page by default. A "Show agent cursors" toggle in the View menu may bring the existing overlay back. Activity is shown in the right column instead. The focus chip and element picker keep working.
- Panels: sidebar and right column collapsible; right column resizable by dragging a 6px handle (pointer events, keyboard arrows on the handle, min/max); sizes and collapsed state persisted in localStorage (try/catch).
- Reference vs actual (Review): the owner adds a reference image (file picker or paste, kept in memory and localStorage as data URL under a size cap of 2MB, else session only). Modes: side by side, overlay with opacity slider, swipe slider. The actual side is a same-origin iframe of `/frame` or the stage at the chosen device width. No server upload.

## Preserve
Every existing behaviour of `index.html` keeps working in studio.html: SSE state, cursors data (hidden but still computed), screen focus and scope, autopilot and squad switches, element picker and ask popover, channel, docs, settings dialog including Team, appearance (SDS theme/brand/language), tooltips, reduced motion. Do not change any API.

## Quality bar
SDS tokens and `.sds-*` components where they exist (`/ds/`), consistent 8px spacing, one type scale, SVG icons only (no emoji), 44px touch targets on touch, visible focus, aria roles (tablist, switch, dialog), light and dark themes, no horizontal overflow, no clipped or overlapping text at 393, 768, 1100 and 1440 widths. Mobile: single column, bottom nav or tabs switch Preview / Activity / Team, drawer for the sidebar.

## Ownership
S1 (shell): `swarm/ui/studio.html`, `studio.css`, `studio.js`. S2 (activity): `swarm/ui/studio-activity.js`, `studio-activity.css`. S3 (compare): `swarm/ui/studio-compare.js`, `studio-compare.css`. The manager owns server.js, cli.js, index.html.

## Module contracts
```js
// studio-activity.js: window.StudioActivity
StudioActivity.mount({ progress: el, team: el, activity: el, artifacts: el, onOpenAgent(id) })  // builds the three cards with safe DOM
StudioActivity.setState(state)        // the /api/state object (agents, phase, round, rounds)
StudioActivity.onEvent(ev)            // every SSE event object the viewer already receives (status, chat, edit, doc, phase, busy, state, autopilot)
// studio-compare.js: window.StudioCompare
StudioCompare.mount(el, { getActiveSrc: () => '/frame' })  // reference picker + three compare modes; no network
StudioCompare.destroy()
```
S1 loads both with `<script>` tags and calls them if present (typeof check), so each worker can be tested alone with a demo page: S2 `studio-activity-demo.html`, S3 `studio-compare-demo.html` (also owned by them).

## Verification each worker must do
`node --check`, then headless Chrome (private --user-data-dir, window width >= 500; see swarm/tools/shot.js) screenshots at 393, 768, 1100, 1440, light and dark; look at them and iterate; report exactly what was seen. No git state changes, no installs, English only.
