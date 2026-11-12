# GJH V11 Blender furniture integration

Application 1.1.1; DS 1.0.0. Date: 2026-11-12. This patch reuses original artwork from the owner's Blender gallery in the existing virtual mall without changing product data, routes, store interactions or older creative directions.

## Source and ownership

The upstream collection is proposed in [Blender-3D-Gallery PR #4](https://github.com/yapweijun1996/Blender-3D-Gallery/pull/4), commit `46ca13c07a497b2d1514cf681101eab8fd25365f`. The PR is open; it has not been merged or deployed to the model library. Its existing workflow does not run on PRs. [Upstream verification](https://github.com/yapweijun1996/Blender-3D-Gallery/blob/46ca13c07a497b2d1514cf681101eab8fd25365f/models/gjh-mall-furniture/verification.md) records 90 unit tests, all 56 catalog GLBs passing Khronos validation, 9 focused furniture browser cases and 9 existing library cases.

Editable Blender files, the deterministic generator, material definitions, lightweight previews, measured metadata and validation reports remain upstream. [Local receipts](../demos/corporate/gjh/v11/assets/furnishings-sources.json) pin exact commit, source paths, dimensions, triangle counts and SHA-256. Local GLBs are byte-identical to those exports. No other model library assets are downloaded at runtime. Existing NASA/vehicle/billiards works retain their own provenance and are not relabeled or automatically loaded into an unrelated business scene.

| Original asset | Local placements | GLB bytes | Triangles per source | Material primitives |
| --- | ---: | ---: | ---: | ---: |
| GJH Lounge Bench | 8 | 234,288 | 5,640 | 5 |
| GJH Areca Planter | 11 | 119,760 | 5,160 | 6 |

Both sources reopened in Blender 5.2.3 LTS with editable parts, metre units and floor-centred origins. Public redistribution terms remain unspecified; the owner authorized reuse in their projects. These are original decorative concepts, not official GJH products. There are no new third-party textures, fonts or geometry.

## Implementation and visual review

`assets/furnishings.js` loads each local GLB once with an eight-second deadline and uses one instanced mesh per material primitive across placements. Failures are independent: the original procedural furniture remains for the unavailable asset. The mall retains collisions, contact shadows, existing lighting, bench facing, store entrances and list-view access. No compressed-mesh decoder or new runtime dependency is introduced.

The existing PWA network-only policy for live demos remains unchanged. Furniture is excluded from the installation precache; model bytes are fetched only when the V11 scene loads. `ds.md` now describes upstream artwork ownership separately from the existing semantic CSS token registry.

Actual 1440, 768 and 390px screenshots were inspected. The walnut/brass bench, sand upholstery and fluted jade planter match the current scene palette. The planter is intentionally stylized. Browser screenshots of the model library showed full model framing, working rotated views and visible controls; an independent scoped review scored 88/100. That score does not establish field usability or whole-library design quality.

The final mall review covered all three arrival widths, all three desktop entrances and every store interior on desktop/mobile. No new furniture-specific entrance obstruction or missing-material issue was visible. Narrow camera views naturally crop side furniture. Existing composition limits remain: the central ring dominates the MILI entrance view, and existing table plants can obscure part of the avatar in MILI/GOGO interiors. These screenshots do not prove every camera position is unobstructed.

## Verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Static SSOT enforcement | PASS | No new raw-style debt; semantic UI registry unchanged |
| Unit contracts | PASS | 32 tests, including binary GLB bounds/triangles/self-containment and exact source receipt hashes |
| Focused V11 furniture browser cases | PASS | [7 cases](evidence/gjh-furnishings-browser.json): 3 viewports plus individual missing/aborted models; one request per asset, frozen status, working list navigation and no page errors/external requests |
| Full V11 interactions and refreshed previews | PASS | [Three viewports](evidence/gjh-v11-furnishings-regression.json): walking/collision/doors/inspection, touch, focus/pause, reduced motion, context loss and WebGL/WASM/no-JavaScript fallbacks; maximum 107 draw calls |
| Gallery and legacy demo regressions | PASS | Gallery discovery/search/filter/compare/preview and 120-company fixture; 28 legacy viewport cases, four no-JavaScript journeys, asset integrity and zero tested axe violations; screenshot writers ran in an isolated copy |
| PWA lifecycle regression | PASS | [PWA evidence](evidence/pwa-browser.json): offline gallery, update consent, cache integrity, mixed-release rejection, activation and recovery |
| Generated-artifact consistency | PASS | Rebuilt after final V11 screenshots; `scripts/build_gallery.py --check` |

[Release gate results](evidence/gjh-furnishings-release-gates.json) record zero exit codes for the final application 1.1.1 build `3fef3cc3717ecd3b`. Screenshots are refreshed for V11 only. Deployment and online behavior require the corresponding commit's successful Pages workflow and a separate live check; local test success alone is not deployment evidence.

The focused run sampled 78–106 draw calls in normal arrival views and at most 106 across tested room views, below the existing 200-call budget. Failure cases also preserve that budget. This is not a frame-rate or Core Web Vitals claim. Physical iOS/Android GPU performance, touch hardware, Safari, screen readers and field performance remain unverified. The model library PR has no automatic Actions checks; its local evidence is recorded explicitly above.

Two initial full V11 runs hit a 30-second screenshot timeout in the desktop New Moon approach. [Render diagnostic evidence](evidence/gjh-furnishings-render-diagnostic.json) measured outstanding GPU work: the first fence drained 7.42 seconds of queued work; subsequent synchronized steps waited about 0.85–1.06 seconds each under SwiftShader, and the following screenshot completed in 0.13 seconds. The deterministic browser helper now waits for a WebGL2 completion fence after each submitted manual frame. This test-only change retains DPR 2, all movement steps, assertions and the 30-second deadline; it does not change production rendering or claim acceptable physical-device frame rate.

Rollback is a revert of this website patch followed by its normal Pages workflow. The upstream PR can remain unmerged without breaking the website because verified exports are vendored locally.
