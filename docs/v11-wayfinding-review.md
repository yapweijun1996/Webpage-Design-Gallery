# V11 entrance store-name review

Baseline: main `77430d591502e8231e94e4f7300f7e680fa68a9a` / application 1.1.31.
Candidate: application 1.1.33 / build `617a877f99a0d569`.

## Problem and change

The three storefronts had original logos but their lower plaques said “THE
PROVISION ROOM”, “THE GATHERING ROOM” and “THE GARDEN ROOM”. Small type and
indirect names made identifying the visible store difficult, especially in the
portrait entrance view. The plaques now read “01 / NEW MOON”, “02 / MILI” and
“03 / GOGO”, matching the existing map's names and numbering.

The original green/gold palette, logos, camera, furniture, world geometry,
colliders and destinations remain intact. Plaques retain their original 3.9m
width. Their height changes from 0.32m to 0.48m and centre from 3.42m to 3.5m;
canvas lettering uses 80px rather than 42px. Other signs retain the 42px default.
No asset download, dependency or extra mesh is added. Existing projection/HUD
visibility logic remains responsible for hiding plaques under narrow-screen HUD.

Portrait still cannot display the three spatially separated stores at once.
Visitors use the existing Map or entrance kiosk for offscreen destinations.
This is improved store-name wayfinding, not a wider field of view or a claim that
every name is simultaneously visible at every position.

## Visual acceptance

Real 1440x900, 768x1024 and 390x844 entrance screenshots and the 768px New Moon
doorway were inspected by the author and a separate read-only reviewer. All
three entrance views and all nine doorway captures are retained under
`docs/screenshots/v11-wayfinding/`.

The independent reviewer accepted the final design with subjective scores:
hierarchy 17/20, spacing 18/20, typography 11/15, colour 14/15, consistency 14/15,
responsive usability 11/15: **85/100**. This is a bounded aesthetic judgement,
not measured task success, contrast certification or physical-device readability.
The visible mobile store is easier to identify; the original spatial composition
and logo hierarchy remain intact. Tablet side-store clipping remains an existing
camera constraint rather than a hidden regression.

Two earlier candidates were rejected by existing V11 assertions: raising the
plaque to 3.76m put it at 83.84px below an 83px header in a close interior view;
widening it to 4.5m produced bounds -34.32px to 802.31px at 768px. The final
position/width correct both failures. No regression assertion was relaxed.

## Verification

- `python scripts/build_gallery.py --check`: PASS after regeneration.
- `python scripts/check_ssot.py`: PASS, no new measured debt.
- `python -m unittest discover -s tests -p 'test_*.py' -v`: 46 tests PASS.
- `node --check demos/corporate/gjh/v11/assets/world.js`: PASS.
- Gallery browser suite: PASS.
- GJH legacy-demo suite: 28 browser cases and four no-JavaScript journeys PASS.
- Full V11 suite using `GALLERY_WEBGL_BACKEND=metal`: PASS with unchanged
  moving-camera, close-interior plaque, HUD, collision, focus and fallback checks.
- `tests/browser_gjh_wayfinding.py`: PASS at all three viewports. It verifies
  entrance plaque bounds, all nine real keyboard destination journeys, accessible
  destination names, map Escape/focus restoration, overflow and runtime errors.
- PWA update/offline/installability suite: final candidate PASS.

The focused harness initially assumed the desktop map was already open after
the welcome guide and read CSS-transformed button text. It now uses the real
entrance kiosk action to open the desktop map and checks accessible destination
names. This does not inject an open state or change navigation behavior.

Evidence: `docs/evidence/v11-wayfinding.json` and
`docs/evidence/v11-wayfinding-regression.json`. Environment: macOS ARM64,
Chromium 157.0.8103.51, native ANGLE Metal, reduced motion, local HTTP. Touch is
browser emulation. Physical iOS/Android, screen-reader sessions, real safe-area
insets and visual contrast certification remain unverified. The scene is a
non-scrolling canvas; input/composer and page-scroll states do not apply to the
changed plaques. Existing list, guide, map and dialog journeys retain their
separate regression coverage.

Independent visual/source review and author architecture, security, performance,
integration and release review found no confirmed task-related P0/P1 issue.
The optional font-size argument receives authored numeric constants only; no
user input, permissions, external links or product records change. Rollback is
a normal revert, regenerated output and release through the existing workflow.

Commit, remote and live acceptance are checked after publication; local checks
alone do not prove release delivery.


## Synchronization check

Before delivery, remote main advanced to `13e99a7d50c605ade4f5bab270f50e421e0e81a7`
with independent Gallery theme/collection updates. They were fast-forwarded into
this isolated branch without changing the validated V11 scene patch. The release
version was advanced to 1.1.33, generated output rebuilt, and generation/SSOT,
46 unit tests, Gallery and PWA browser suites rerun successfully. The added shared
tokens do not change existing V11 token values. No parallel work was overwritten.
