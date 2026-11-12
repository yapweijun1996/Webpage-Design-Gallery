# GJH V11 visitor — integration and acceptance

Application version: **1.1.2**. Design-system contract: **1.0.0**.

This is an implementation evidence record, not a deployment certificate. The user confirmed the green-polo mascot direction. Revision 3 geometry and animation are frozen and have local source and V11 evidence below. The source and byte-identical website receipt are pinned to `1a091b18e29b34ca468baf506968e1e65d815005` (pushed upstream; PR #5 is merged). The final post-continuity V11 and six focused character cases passed. All local release gates passed. Implementation commit `20611fde90d0d349c106991963c49427a284fdea` deployed successfully and passed live desktop/mobile verification. A subsequent provenance-only update records the now-merged upstream PR. No reference image is embedded or published with the website.

## Source and ownership

- Upstream authority: `Blender-3D-Gallery/models/gjh-mall-visitor/`, including the editable Blender source, authoring generator and exported GLB.
- Website export: `demos/corporate/gjh/v11/assets/gjh-mall-visitor.glb`.
- Provenance: [character-sources.json](../demos/corporate/gjh/v11/assets/character-sources.json). `source_commit` must be a verified full upstream commit; `sha256`, `triangles` and `dimensions` must describe the actual vendored bytes. Dimensions use exported glTF world axes, with +Y up.
- Rights: original owner-project artwork; reuse in the owner's projects is authorized. Public redistribution terms are unspecified. No public asset license or third-party character endorsement is implied.
- The original `shopper.glb`, `shopper-LICENSE.txt` and previous `sources.json` remain intact as historical assets. They are not loaded as an automatic fallback for the new visitor.

## Runtime contract

`assets/character.js` loads the local model at native scale, retains its authored materials and animation tracks, and blends `idle`, `walk` and `sprint` with phase continuity. The existing player's public animation states remain `idle`, `walk` and `run`. Read-only character telemetry identifies the model, native height, scale, clip mapping and effective action weights.

`assets/player.js` retains the capsule, movement speeds, gravity, collision response, input handling, camera obstruction and placement logic. No shader recoloring, named-head material cloning, shoulder scaling or rewritten leg/arm tracks remain. Reduced motion pauses idle motion; moving characters still convey their direction and pace. Loading failure reaches the established accessible directory fallback instead of substituting the old character.

Presentation bridges brief contact corrections for 60 ms only after recent actual horizontal movement with movement input still held. During that interval it uses the current requested walk/run pace. Released input clears the interval immediately; a held input against a wall from rest never fabricates walking. Sustained blockage resolves to idle on the fourth 60 Hz step (66.7 ms observation), after the 60 ms interval expires. Physics, capsule, speeds and corrected displacement remain unchanged.

The diagnostic replay compared all 90 baseline/current ticks before this presentation fix: positions, raw animation states and weights were identical. Zero-horizontal walk ticks 8, 19 and 33 were an existing controller behavior, not a new geometry or physics regression. Evidence: [90-tick diagnostic](evidence/gjh-character-motion-diagnostic.json). The actual-GLB module test then verified that presentation remains continuous across these gaps without weakening the >0.95 settled-weight requirement.

The asset contract is native height near 1.72 metres, floor at Y=0, front along +Z, self-contained glTF 2 GLB, and horizontally in-place authored animation. A design target of less than 2 MB and 15,000 triangles bounds the asset; the frozen revision measures 369,976 bytes and 10,356 triangles. A different visual proportion or outfit does not authorize changes to physics or camera constants.

## Verification record

Statuses describe the verified revision-3 export and final continuity implementation. Earlier release runs are not substitutes.

| Gate | Status | Evidence / acceptance |
|---|---|---|
| Runtime JavaScript syntax | PASS | `node --check` on `assets/player.js` and `assets/character.js` in the isolated runtime worktree |
| Final source commit and byte-identical receipt | PASS | Verified pushed source `1a091b18e29b34ca468baf506968e1e65d815005` and byte-identical website receipt; upstream PR #5 merged |
| Native bounds, self-contained buffers and animations | PASS | Character unit checks included in the passing 35-test release unit suite |
| glTF validator errors and warnings | PASS | Khronos validator 2.0.0-dev.3.10: zero errors and zero warnings, recorded in upstream `reports/assets.json` |
| Editable Blender source inspection | PASS | Blender 5.2.3 LTS reopened the source; 12 editable meshes and idle/walk/sprint tracks across 11 articulated nodes, recorded in `reports/sources.json` |
| Upstream repository tests and build | PASS | Release owner reports 90 npm tests, 57 build checks, three upstream browser cases and nine library cases passing; upstream PR #5 is merged |
| Actual mall visual review | PASS with limitations | Independent review of 18 mall screenshots accepts the avatar; existing scene/UI occlusion limitations are recorded below. Subjective staging score: 86/100, not a measured release threshold |
| Focused front / side / back and clip transitions | PASS | [Six focused character cases](evidence/gjh-character-browser.json) passed after the continuity fix |
| Actual mall at 1440 / 768 / 390 | PASS | Full V11 browser suite: sampled maximum draw calls 130 / 114 / 101, all below 200; no console errors |
| Actual GLB module continuity | PASS | Real module and GLB, no mocks: trace gaps, requested pace changes, release, held blockage, animated joint transforms, normalized weights and unchanged dominant-weight >0.95 checks |
| Final focused browser / reduced-motion suite | PASS | [Character browser evidence](evidence/gjh-character-browser.json) |
| Missing model and usable directory fallback | PASS | Final focused suite verified missing-asset recovery and usable directory/product interaction |
| Final V11 movement, collisions, doors and inspection | PASS | [Final V11 regression](evidence/gjh-v11-character-regression.json): all three widths, reduced motion, hidden pause, context loss, WebGL/WASM failure and no-JavaScript fallback |
| Build, generated freshness, SSOT and units | PASS | Release owner completed build, generated-output check, SSOT and 35 unit tests |
| Gallery browser regression | PASS | Final release driver completed the Gallery suite |
| Complete release gate report, including PWA | PASS | [Release gates](evidence/gjh-character-release-gates.json): Gallery, 28 legacy cases plus four no-JavaScript journeys, seven furniture cases and PWA update/offline/cache-integrity recovery passed |
| Remote commit, Actions and deployment | PASS | [Live evidence](evidence/gjh-character-live.json): implementation commit remotely verified, Actions 43166975701 succeeded; live version, exact model hash, 1440/390 layouts and all four product dialogs passed |

## Accepted asset measurements

| Property | Measured value |
|---|---|
| Upstream commit | `1a091b18e29b34ca468baf506968e1e65d815005`; PR #5 merged |
| Export SHA-256 | `43d08b67f4450b6aac478cfca4ca664044662cd79021ed15d55ef5612e312be2` |
| Bytes / triangles / primitives | 369,976 / 10,356 / 25 |
| Materials / textures | 8 / 0 |
| World-space dimensions (X, Y, Z metres) | 0.706950 × 1.720000 × 0.436895 |
| Animation clips and durations | idle 2.008333 s; walk 1.008333 s; sprint 0.741667 s; 33 tracks each |
| Horizontal drift / maximum sole-floor error | Zero drift in all clips; idle <0.000001 m, walk 0.000191 m, sprint 0.001261 m |
| Local browser / renderer | Headless Chrome / SwiftShader; full V11 suite completed |
| Application build | `4b182b2caf8c3a64`; original browser-tested implementation `f0a35c4fbc5533ac`, followed only by upstream merge receipt metadata; build, SSOT, 35 units and PWA passed again |

Evidence inputs: upstream `models/gjh-mall-visitor/reports/assets.json` and `reports/sources.json`; [motion diagnostic](evidence/gjh-character-motion-diagnostic.json), [final V11 regression](evidence/gjh-v11-character-regression.json), and [focused character browser results](evidence/gjh-character-browser.json), and [furniture regression](evidence/gjh-character-furnishings-regression.json). Screenshots referenced by these reports were inspected locally; temporary review directories are not published artifacts.

## Remaining limits

Independent mall review noted existing MILI/GOGO table-topiary occlusion, the mobile Inspect control covering the visitor’s legs, and a small map/Inspect corner overlap at 768px. Avatar acceptance does not certify these surrounding scene/UI details as flawless. The 86/100 staging assessment is subjective and does not establish an independent ≥88 score on every shot.


An original stylized model is not a photorealistic replica or a claim of exact reference matching. Physical-phone GPU performance, native installed iOS/Android behavior, screen-reader sessions and field Core Web Vitals require separate evidence. Local software-rendered screenshots and automated tests must be described as such. Live verification is recorded in [deployment evidence](evidence/gjh-character-live.json). The provenance-only completion retains identical application JavaScript, CSS and GLB bytes; its generated release identity is verified separately.
