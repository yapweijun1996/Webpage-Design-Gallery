# V11 New Moon detail preview review — 1.1.14

## Scope and provenance
Adds an opt-in interactive preview inside the existing four New Moon product dialogs. Packshots remain the default; product text, eShop URL, image alternative, MILI/GOGO artwork-only details, generic original-tin viewer and mall geometry remain intact. The exact five source GLBs and receipts from 1.1.13 are unchanged. This is an owner-authorized unofficial demo, not verification of independent artwork rights, physical packaging, dimensions or brand endorsement. Mexico's 121-degree unprinted sector remains disclosed.

## Implementation
- Exact SKU IDs map to shared existing SHA-256 records, not product-name heuristics.
- Three.js/loader/config and the selected GLB load only on an explicit preview request. Eight-second deadline includes fetch, digest and parsing.
- Native dimensions and presence of label imagery checked; model centered and camera fitted to its bounding sphere, including narrow viewport/orientation changes.
- Mouse/real browser touch drag, keyboard four arrows, +/−, R, rotation/zoom/reset buttons and image/3D toggle. Targets at least 44px. No auto-rotation; render only after input, resize or visibility restoration.
- Abort + generation/session identity guard; late parsed resources disposed; unique geometry/material/texture disposal; fresh canvas after context loss. Hidden documents suspend rendering. Closed dialog owns no preview renderer/context.
- Existing dialog semantics, pause, Escape and focus restoration retained. Image remains usable on 404, hash mismatch, timeout, missing WebGL or lost context.

## Evidence
Chromium 158 on ARM64 Linux / SwiftShader; reduced motion enabled. Physical devices are not implied.
- `tests/browser_gjh_newmoon_detail.py`: PASS four actual SKU loads at 390×844, 844×390, 1440×900; finite default camera fit; keyboard, button, mouse and CDP touch input changes; reset; no idle render increments; toggles; eShop link; overflow; close/focus/resource cleanup; MILI/GOGO isolation.
- PASS 404/hash failures, close/reopen with stale pending fetch, actual WEBGL_lose_context and successful retry, same-page orientation resize, 8-second timeout with late-parse disposal (three geometry dispose events), unavailable WebGL/image fallback.
- `tests/browser_gjh_list.py`: PASS 320/390/768/1440, all four details and return focus, visible actions, directory order and no overflow.
- 43 unit tests PASS; SSOT zero new debt and generated build check PASS.
- PWA release checks PASS (offline gallery, identity/hash fail-closed, update/reload, owned-cache cleanup and activation timeout). This does not add offline 3D support.
- Rendered desktop, portrait and landscape screenshots inspected. Can/label renders, controls and disclosure are legible; short landscape dialogs scroll with a sticky Close header. Packshots remain distinct from the conceptual geometry. Screenshots in `docs/screenshots/v11-newmoon-preview/`; machine results `docs/evidence/v11-newmoon-preview.json`.
- Unchanged prior mall physics/shelf/source and unrelated historical gallery evidence reused rather than rerunning all older suites. Final deployment/live check is recorded in the delivery message.

## Status and limits
Technical feature: PASS in the stated browser environment. Packaging fidelity/independent rights: NEEDS REVIEW, not certified by permission to use a demo. Physical iOS/Android, Safari, screen readers, actual notched-device safe areas and native thumb reach: UNVERIFIED. No pricing/stock/purchase flow added. No full task.md or all-device completion claim.

## Rollback
Restore the prior release 69eaf3cd5c68eec36c371ddca9b1302867502924 with a normal reviewed revert (no shared-history rewrite), rebuild generated files and redeploy. Prior assets and source evidence are retained.
