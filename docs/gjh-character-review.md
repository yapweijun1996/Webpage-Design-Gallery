# GJH V11 visitor — integration and acceptance

Application candidate: **1.1.2**. Design-system contract: **1.0.0**.

This is a candidate evidence record, not a release certificate. The upstream authoring iteration is still in progress. The receipt's null pin, hash and measurements must be replaced from the final accepted source commit and byte-identical export before validation or release. No reference image is embedded or published with the website.

## Source and ownership

- Upstream authority: `Blender-3D-Gallery/models/gjh-mall-visitor/`, including the editable Blender source, authoring generator and exported GLB.
- Website export: `demos/corporate/gjh/v11/assets/gjh-mall-visitor.glb`.
- Provenance: [character-sources.json](../demos/corporate/gjh/v11/assets/character-sources.json). `source_commit` must be a verified full upstream commit; `sha256`, `triangles` and `dimensions` must describe the actual vendored bytes. Dimensions use exported glTF world axes, with +Y up.
- Rights: original owner-project artwork; reuse in the owner's projects is authorized. Public redistribution terms are unspecified. No public asset license or third-party character endorsement is implied.
- The original `shopper.glb`, `shopper-LICENSE.txt` and previous `sources.json` remain intact as historical assets. They are not loaded as an automatic fallback for the new visitor.

## Runtime contract

`assets/character.js` loads the local model at native scale, retains its authored materials and animation tracks, and blends `idle`, `walk` and `sprint` with phase continuity. The existing player's public animation states remain `idle`, `walk` and `run`. Read-only character telemetry identifies the model, native height, scale, clip mapping and effective action weights.

`assets/player.js` retains the capsule, movement speeds, gravity, collision response, input handling, camera obstruction and placement logic. No shader recoloring, named-head material cloning, shoulder scaling or rewritten leg/arm tracks remain. Reduced motion pauses idle motion; moving characters still convey their direction and pace. Loading failure reaches the established accessible directory fallback instead of substituting the old character.

The asset contract is native height near 1.72 metres, floor at Y=0, front along +Z, self-contained glTF 2 GLB, and horizontally in-place authored animation. A design target of less than 2 MB and 30,000 triangles bounds the asset; actual accepted measurements must be recorded below. A different visual proportion or outfit does not authorize changes to physics or camera constants.

## Verification record

Statuses apply only to this candidate. Update each row from executed evidence; earlier SSOT, furniture or V11 runs are not substitutes.

| Gate | Status | Evidence / acceptance |
|---|---|---|
| Runtime JavaScript syntax | PASS | `node --check` on `assets/player.js` and `assets/character.js` in the isolated runtime worktree |
| Final source commit and byte-identical receipt | UNVERIFIED | Awaiting accepted source commit and export; receipt currently contains explicit null fields |
| Native bounds, self-contained buffers and animations | UNVERIFIED | Run `python -m unittest discover -s tests -p test_gjh_character.py -v` against the final asset |
| glTF validator errors and warnings | UNVERIFIED | Record validator version and actual error/warning counts from final GLB |
| Front / side / back / walk / sprint visual review | UNVERIFIED | Inspect actual rendered poses; record defects and acceptance separately from technical test results |
| Actual mall at 1440 / 768 / 390 | UNVERIFIED | Run `python tests/browser_gjh_character.py`; inspect its screenshots and measured state |
| Blend continuity and reduced motion | UNVERIFIED | Verify effective weights and actual authored motion with the focused character suite |
| Missing model and usable directory fallback | UNVERIFIED | Verify the failing-asset scenario and keyboard/product interaction recovery |
| V11 movement, collisions, doors and inspection | UNVERIFIED | Run `python tests/browser_gjh_v11.py` on the final candidate |
| Gallery, PWA and SSOT regression | UNVERIFIED | Run applicable README checks after final regeneration |
| Remote commit, Actions and deployment | UNVERIFIED | Parent release owner records only after verified delivery |

## Accepted asset measurements

| Property | Measured value |
|---|---|
| Upstream commit | Pending |
| Export SHA-256 | Pending |
| Bytes / triangles / primitives | Pending final export |
| World-space dimensions (X, Y, Z metres) | Pending final export |
| Animation clips and durations | Pending final export |
| Local browser / renderer | Pending final browser run |
| Application build | Pending final generation |

## Remaining limits

An original stylized model is not a photorealistic replica or a claim of exact reference matching. Physical-phone GPU performance, native installed iOS/Android behavior, screen-reader sessions and field Core Web Vitals require separate evidence. Local software-rendered screenshots and automated tests must be described as such. Do not publish this candidate while its source receipt or required release gates are incomplete.
