# GJH V11 visitor — integration and acceptance

Application candidate: **1.1.2**. Design-system contract: **1.0.0**.

This is a candidate evidence record, not a deployment certificate. The user confirmed the green-polo mascot direction. Revision 3 geometry and animation are frozen and have local source and V11 evidence below. The final upstream commit, byte-identical receipt and remaining release checks are still pending. No reference image is embedded or published with the website.

## Source and ownership

- Upstream authority: `Blender-3D-Gallery/models/gjh-mall-visitor/`, including the editable Blender source, authoring generator and exported GLB.
- Website export: `demos/corporate/gjh/v11/assets/gjh-mall-visitor.glb`.
- Provenance: [character-sources.json](../demos/corporate/gjh/v11/assets/character-sources.json). `source_commit` must be a verified full upstream commit; `sha256`, `triangles` and `dimensions` must describe the actual vendored bytes. Dimensions use exported glTF world axes, with +Y up.
- Rights: original owner-project artwork; reuse in the owner's projects is authorized. Public redistribution terms are unspecified. No public asset license or third-party character endorsement is implied.
- The original `shopper.glb`, `shopper-LICENSE.txt` and previous `sources.json` remain intact as historical assets. They are not loaded as an automatic fallback for the new visitor.

## Runtime contract

`assets/character.js` loads the local model at native scale, retains its authored materials and animation tracks, and blends `idle`, `walk` and `sprint` with phase continuity. The existing player's public animation states remain `idle`, `walk` and `run`. Read-only character telemetry identifies the model, native height, scale, clip mapping and effective action weights.

`assets/player.js` retains the capsule, movement speeds, gravity, collision response, input handling, camera obstruction and placement logic. No shader recoloring, named-head material cloning, shoulder scaling or rewritten leg/arm tracks remain. Reduced motion pauses idle motion; moving characters still convey their direction and pace. Loading failure reaches the established accessible directory fallback instead of substituting the old character.

The asset contract is native height near 1.72 metres, floor at Y=0, front along +Z, self-contained glTF 2 GLB, and horizontally in-place authored animation. A design target of less than 2 MB and 15,000 triangles bounds the asset; the frozen revision measures 369,976 bytes and 10,356 triangles. A different visual proportion or outfit does not authorize changes to physics or camera constants.

## Verification record

Statuses apply only to this candidate. Update each row from executed evidence; earlier SSOT, furniture or V11 runs are not substitutes.

| Gate | Status | Evidence / acceptance |
|---|---|---|
| Runtime JavaScript syntax | PASS | `node --check` on `assets/player.js` and `assets/character.js` in the isolated runtime worktree |
| Final source commit and byte-identical receipt | UNVERIFIED | Frozen export measured; upstream source commit and final website receipt remain pending |
| Native bounds, self-contained buffers and animations | UNVERIFIED | Run `python -m unittest discover -s tests -p test_gjh_character.py -v` against the final asset |
| glTF validator errors and warnings | PASS | Khronos validator 2.0.0-dev.3.10: zero errors and zero warnings, recorded in upstream `reports/assets.json` |
| Editable Blender source inspection | PASS | Blender 5.2.3 LTS reopened the source; 12 editable meshes and idle/walk/sprint tracks across 11 articulated nodes, recorded in `reports/sources.json` |
| Upstream repository tests and build | PASS | Release owner reports 90 npm tests and 57 build checks passing; source PR/commit remains pending |
| Actual mall visual review | PASS with limitations | Independent review of 18 mall screenshots accepts the avatar; existing scene/UI occlusion limitations are recorded below. Subjective staging score: 86/100, not a measured release threshold |
| Focused front / side / back and clip transitions | UNVERIFIED | Focused character browser suite and its evidence remain pending |
| Actual mall at 1440 / 768 / 390 | PASS | Full V11 browser suite: sampled maximum draw calls 130 / 114 / 101, all below 200; no console errors |
| Blend continuity and reduced motion | UNVERIFIED | Verify effective weights and actual authored motion with the focused character suite |
| Missing model and usable directory fallback | UNVERIFIED | Verify the failing-asset scenario and keyboard/product interaction recovery |
| V11 movement, collisions, doors and inspection | PASS | `/tmp/gjh-character-full-v11.log`: all three widths passed; reduced motion, hidden pause, context loss, WebGL/WASM failure and no-JavaScript fallback passed |
| Gallery, PWA and SSOT regression | UNVERIFIED | Run applicable README checks after final regeneration |
| Remote commit, Actions and deployment | UNVERIFIED | Parent release owner records only after verified delivery |

## Accepted asset measurements

| Property | Measured value |
|---|---|
| Upstream commit | Pending |
| Export SHA-256 | `43d08b67f4450b6aac478cfca4ca664044662cd79021ed15d55ef5612e312be2` |
| Bytes / triangles / primitives | 369,976 / 10,356 / 25 |
| Materials / textures | 8 / 0 |
| World-space dimensions (X, Y, Z metres) | 0.706950 × 1.720000 × 0.436895 |
| Animation clips and durations | idle 2.008333 s; walk 1.008333 s; sprint 0.741667 s; 33 tracks each |
| Horizontal drift / maximum sole-floor error | Zero drift in all clips; idle <0.000001 m, walk 0.000191 m, sprint 0.001261 m |
| Local browser / renderer | Headless Chrome / SwiftShader; full V11 suite completed |
| Application build | Pending final generation |

Evidence inputs: upstream `models/gjh-mall-visitor/reports/assets.json` and `reports/sources.json`; local full V11 log `/tmp/gjh-character-full-v11.log`. Full V11 screenshots are in `/var/folders/p7/f_99nxmj7s16qrxbl0cbpz4r0000gn/T/gjh-v11-review-h9jb9jtq`. These temporary paths are review evidence locations, not published artifacts.

## Remaining limits

Independent mall review noted existing MILI/GOGO table-topiary occlusion, the mobile Inspect control covering the visitor’s legs, and a small map/Inspect corner overlap at 768px. Avatar acceptance does not certify these surrounding scene/UI details as flawless. The 86/100 staging assessment is subjective and does not establish an independent ≥88 score on every shot.


An original stylized model is not a photorealistic replica or a claim of exact reference matching. Physical-phone GPU performance, native installed iOS/Android behavior, screen-reader sessions and field Core Web Vitals require separate evidence. Local software-rendered screenshots and automated tests must be described as such. Do not publish this candidate while its source receipt or required release gates are incomplete.
