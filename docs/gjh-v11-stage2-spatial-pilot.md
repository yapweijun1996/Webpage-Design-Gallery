# GJH V11 stage 2: current-store spatial data pilot

Date: 15 November 2026 (Asia/Singapore)  
Status: **implemented and tested for the existing three-store scene**. This is a compatibility pilot, not the 17-store expansion. The [stage 1 plan](gjh-v11-stage1-spatial-plan.md) and its [planning coordinates](references/gjh-mall-spatial-plan.json) remain proposals and are not loaded as current runtime geometry.

## Shared data and consumers

[assets/spatial.js](../demos/corporate/gjh/v11/assets/spatial.js) owns the current scene's ordered store IDs, display numbers, labels, floor, availability, nominal bounds, arrival anchors and directory title references. The pilot intentionally retains the current fixed three-room shape; it rejects incompatible room dimensions/front-back positions instead of suggesting the still-hard-coded architecture automatically supports an expanded shell. The present records are:

| ID | Display | Nominal x / z bounds (m) | Entrance arrival (x, z) m | Directory title |
| --- | --- | --- | --- | --- |
| `newmoon` | 01 New Moon | −15…−5 / −10.5…0 | (−10, 2.4) | `newmoon-title` |
| `mili` | 02 MILI | −5…5 / −10.5…0 | (0, 2.4) | `mili-title` |
| `gogo` | 03 GOGO | 5…15 / −10.5…0 | (10, 2.4) | `gogo-title` |

These bounds describe nominal store modules rather than precise collision meshes. The validator checks unique identities/numbers/content references, finite floor and geometry, compatible room shape/order, arrival in the nominal floor and in front of the opening, and boolean availability. It freezes exported data and returns no arrival for unknown or unavailable IDs. The actual collision clearance of each current arrival and doorway was additionally checked in the browser; the nominal validator is not a Rapier collision query.

- **3D world:** storefront center x, sign number and label come from the store records. Existing room construction, collision bodies, products, seats and visual assets retain their current owners and dimensions.
- **Movement and location:** the player uses the record's arrival anchor; the ground-zone lookup uses record boundaries while preserving the previous `z < 0.1` and ±5 m edge behavior. The current upper-floor detection remains separate. The courtyard's existing `(−2,12)` arrival is also centralized. Legacy `newmoon`, `mili` and `gogo` IDs and `window.__mall.teleport` remain supported.
- **Map:** each store rectangle and button is positioned from its record's center and the existing world-to-map projection. The player dot uses the same projection. The existing 72 × 110 pixel stylized store shapes remain schematic and the map still says **Not to scale**. Button number, name, accessible label and availability use the shared record.
- **Directory:** on JavaScript startup, existing static store headings, numbers, filter labels, brand names and count are synchronized to those records. The existing product/content records remain independently owned; no products, rights or pricing are inferred from spatial data. Static HTML retains its original three readable stores and product/official links if JavaScript or 3D is unavailable. Browser checks compare this static fallback against the same expected IDs and labels; it is deliberately retained fallback markup, not a build-generated copy.
- **Navigation outcome:** a store action announces arrival only if the player accepted the travel request. An unknown/unavailable destination or an active elevator journey cannot silently claim successful arrival. The header shows the current 3D location when entering the scene and the directory label in list view.

## Evidence and testing

All screenshot-writing browser suites ran from an isolated copy with local Chrome, requested ANGLE Metal, and the project's Python/Playwright environment. The final V11 runtime and assets (excluding the subsequently updated README), shared onboarding sources and selected tests were compared with the worktree after capture; see the [source manifest](evidence/gjh-stage2-20261115/source-manifest.json). This is an uncommitted working-tree snapshot, not a claim about a clean commit. Results cover:

- `node --test tests/gjh_spatial.test.mjs`: four checks for identities/order, boundaries/projection, invalid and duplicate data, nominal arrival constraints, immutability and unavailable destinations.
- `tests/browser_gjh_spatial.py`: real map-button navigation to all three doors, 3D movement and zone/number/directory parity at 1440 and 390px in default V2, and 390px with `?visitor=v1`; four product cards and each store's details; rejection of an unknown ID and a real in-progress elevator request; no-JavaScript and failed-physics directory fallbacks. [Log](evidence/gjh-stage2-20261115/spatial-browser.log).
- `tests/browser_gjh_modes.py`: complete V2 lifecycle at 390×844, 768×1024 and 1440×900, including all eight seats at 390px. [Results](evidence/gjh-stage2-20261115/modes-results.json), [log](evidence/gjh-stage2-20261115/modes.log).
- `tests/browser_gjh_guide.py`, `browser_gjh_onboarding.py`, and `browser_gjh_hybrid.py`: first-use guidance, synthetic controller, and directory/product/Bag journeys. The guide test previously expected the close button before the existing Appearance button and selectors removed by the shared onboarding UI; the same actual focus order was reproduced on the pre-stage-2 source. The test now checks both focus steps and expands/validates the actual touch or keyboard control list rather than weakening those checks. [Guide log](evidence/gjh-stage2-20261115/guide.log).
- `tests/browser_gjh_v11.py` passed on the legacy `?visitor=v1` path; its result must not be represented as full V2 coverage. The V2 result is the separate modes and spatial checks above. [Legacy log](evidence/gjh-stage2-20261115/v11-legacy.log).
- Repository generator check, 11 gallery unit tests, `browser_gallery.py`, `browser_gjh_demos.py`, and `browser_pwa.py` passed from the final isolated build. The legacy demo runner did not have an axe bundle supplied, so its printed zero axe violations do not establish an axe audit. [Gallery](evidence/gjh-stage2-20261115/browser_gallery.log), [legacy demos](evidence/gjh-stage2-20261115/browser_gjh_demos.log), [PWA](evidence/gjh-stage2-20261115/browser_pwa.log).

Actual views: [mobile map](evidence/gjh-stage2-20261115/screens/map-390.png), [desktop map](evidence/gjh-stage2-20261115/screens/map-1440.png), [mobile directory](evidence/gjh-stage2-20261115/screens/directory-390.png), [desktop directory](evidence/gjh-stage2-20261115/screens/directory-1440.png). These are screenshots of the existing mall, not renders of the future 17-store design.

## Limits and next phase

This pilot centralizes the existing three stores only. It does not add or relocate 17 stores, create new storefronts, remove the central ring, implement seasonal themes, or prove a future 70 × 60 m layout walkable. The current world still contains decorative/architectural geometry and room-specific content with explicit dimensions; expanding it requires a deliberate later migration, compatibility and collision review rather than simply editing the three records. Planned-store availability is validated at the data boundary but no planned storefront is presented in the current UI.

Physical phones, tablets, controllers, Safari and screen readers were not tested. Browser emulation and local GPU results do not establish field performance or physical accessibility. Future work must independently test actual cart paths, map/directory parity, both lift landings, collision and graphics recovery in the expanded shell.
