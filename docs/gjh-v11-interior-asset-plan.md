# GJH V11 interior asset plan

Updated: 15 November 2026 (Asia/Singapore). Status: **twelve selected IDs implemented and locally verified: the original eight-ID pilot plus four-ID P0 shell;188 candidates remain pending**.

## Source and ownership

The owner supplied `GJH_Virtual_Mall_200_Interior_3D_Models_Backlog.md`, titled *Interior 3D Asset Production Backlog v1.0*. An unchanged [reference copy](references/gjh-interior-200-assets-v1.md) preserves all 200 rows, original bilingual labels, contracts, proposed dimensions and G01–G12 definitions. Its SHA-256 is `5e8c9bb69679d731df6f0f52eadae132bc53b8bfb9b57d1a76f0abe2b0d61c42`.

The reference is the authoritative imported list of candidate IDs. This plan owns project reconciliation, prerequisites and delivery sequencing; [task.md](../task.md) tracks work status without duplicating the 200-row table. The [ten-advisor review](gjh-v11-interior-10-advisors.md) supplies the spatial, visual and HUD rationale. Instructions within the supplied document are proposed production requirements to review, not permission to generate 200 models, expand live stores, change the runtime or publish a release.

Count verification found 200 distinct IDs, each category numbered 001–020 without gaps. Source priorities are preserved:

| Category | Candidate scope | P0 | P1 | P2 | Total |
| --- | --- | ---: | ---: | ---: | ---: |
| ARC | Architecture and walls | 14 | 2 | 4 | 20 |
| COR | Corridors and circulation | 14 | 2 | 4 | 20 |
| CEI | Ceilings and roofs | 14 | 2 | 4 | 20 |
| LGT | Light fixtures | 6 | 10 | 4 | 20 |
| FLR | Floors and paving | 14 | 2 | 4 | 20 |
| STF | Storefronts and windows | 8 | 8 | 4 | 20 |
| DSP | Product displays and retail furniture | 0 | 16 | 4 | 20 |
| PUB | Public furniture and planting | 0 | 16 | 4 | 20 |
| FAC | Public facilities and safety-themed props | 4 | 12 | 4 | 20 |
| VER | Vertical circulation and atrium | 5 | 11 | 4 | 20 |
| **Total** | | **79** | **81** | **40** | **200** |

These are source classifications, not a commitment to build every P0 before improving the current scene. The documentation intake itself accepted no models. The subsequent explicit pilot request authorized the eight mappings in the [pilot review](gjh-v11-interior-pilot-review.md). That authorization is historical; the later15November2026 request authorizes autonomous completion of the four remaining interior tasks, with bounded per-task selection and evidence. The four-ID [D3 shell review](v11-interior-shell-review.md) records the next selected batch; other candidates retain proposed status. Existing delivered assets retain their own evidence and history.

## Reconcile before production

| Topic | Supplied proposal | Project decision or required review |
| --- | --- | --- |
| Units and axes | Blender Z-up, metric; bounding boxes W×D×H | Keep authoring metres and export conversion. Record Blender bounds as X/Y/Z = W/D/H and glTF bounds as X/Y/Z = W/H/D. Ground-centred props and architectural snap anchors are separate origin policies. |
| Identity | Hyphenated IDs; underscore filenames; root `extras.asset_id` | Preserve stable IDs. For example, ID `GJH-ARC-001` maps to `GJH_ARC_001.blend` / `.glb`. A future manifest must resolve identity; existing filenames must not be silently renamed or claimed as accepted candidates. |
| Dimensions | Proposed per-row bounding boxes; G02 tolerance ±1% | Approve a per-asset target before applying the tolerance. Repeated category dimensions need review: ARC-008/011/018, CEI-015/016, STF-008/016, PUB-005 and VER-008 are examples. Do not model a skirting board, detector or button panel at a generic wall/room size. Wide COR-003 also needs differentiation from COR-002. |
| Interactions | Category-wide `SIT`, `INSPECT`, `USE`, `PICKUP`, `TRAVEL` labels | Treat these as candidates only. Review tables, planters, partitions and fixtures individually; PUB-005/006 and PUB-007–011 do not automatically become seats. Passive decor defaults to no action unless a concrete journey is specified. Keep geometry separate from UI prompts, gameplay state and physics. |
| Materials | M01–M10, texture atlases, 1K/2K images and KTX2 | Current shared `assets/static-asset.js`, consumed by furnishings and shell, rejects images, external buffers, required extensions, animation and skins, and accepts at most 16 mesh primitives. Use a compatible static, texture-free pilot or separately design decoder/resource verification, lifecycle and fallback changes before textured assets. No loader checks are relaxed by documentation. |
| LOD | Three variants and proposed distance bands | Current furniture does not implement automatic distance switching. Audit existing reuse first; adopt LOD only after scene measurements. The supplied screen-space/distance thresholds and triangle ceilings remain targets. Confirm how the architectural ceiling maps to ARC/COR/CEI. Record simple-asset or instance-only exemptions rather than manufacturing three unnecessary copies. |
| Collision | Separate or non-renderable proxies and navigation metadata | Current physics uses app-owned colliders; it does not automatically consume imported collision GLBs. Keep collision/socket nodes out of visual exports until an importer explicitly supports them. Maintain one collision authority and validate camera, cart, doors and seat exits against visible geometry. |
| Stores and facilities | M1 mentions four storefronts; M2 adds facilities/vertical transport | Current mall planning retains three branded stores. A four-module test fixture is not a fourth live brand. Restrooms, safety props and transport labels describe visual/capability candidates, not operating services or physical-safety compliance. Existing locally developed elevator behavior requires its own evidence; this import does not certify or replace it. |
| Scale of delivery | 200 reusable assets | Reuse existing original bench, planter, kiosk, shelves and products where suitable. An instance, material variation or geometry family is not automatically another unique accepted asset. Validate candidate mapping and source rights first. |

## Selected pilot batch

This eight-ID sample exercises reuse, primitives, a new hero asset and the identity/export contract before any broad production run. The owner subsequently requested implementation of these eight IDs only. Source priorities are unchanged; measured dimensions, decisions and acceptance records are in the [pilot manifest](../models/gjh-interior-pilot/manifest.json). The table below retains the initial review questions; their implemented resolutions are in the pilot review.

| Candidate | Intended role | First action |
| --- | --- | --- |
| GJH-PUB-002 | Bench | Compare the existing original bench's measured dimensions, proportions and sit anchors; record reuse/adapt/new decision. |
| GJH-PUB-008 | Large planter | Compare the existing planter; preserve pot proportions and review placement/clearance. |
| GJH-PUB-017 | Digital directory | Assess the existing kiosk against the candidate; settle a readable map and move it out of the cart bottleneck. |
| GJH-DSP-001 | Single-sided shelf | Compare the current shelf and four supported SKU presentations; preserve product-to-detail associations. |
| GJH-STF-008 | Horizontal store sign | Correct the proposed dimensions and unify brand name/number across portal, map and directory. |
| GJH-LGT-009 | Wall light | Check whether an instanced primitive already meets the visual need; avoid another shadow-casting light. |
| GJH-PUB-005 | Coffee table | Define plausible dimensions and passive interaction; evaluate the proposed modular table kit. |
| GJH-VER-017 | Atrium sculpture plinth | Settle circulation, silhouette and final dimensions first, then scope a simpler beveled original model. |

Each sample needs a proposed target, source/reuse decision and open issues. Do not mark an existing asset as a new `GJH-*` delivery until provenance, mapping and applicable gates are actually recorded.

## Delivery phases

1. **D0 — Documentation intake (complete).** Preserve the source, verify IDs/counts, identify contract gaps and link the advisor review. The original imported backlog is unchanged.
2. **D1 — Pilot spatial/contract baseline (complete for asset scope).** Reuse mappings, reviewed dimensions, ground origins, collision ownership and static materials are recorded. Kiosk/cart/seat routes and mobile/desktop framing pass. The subsequent application1.1.47 [D1 HUD ownership review](v11-interior-hud-review.md) completes Help/Map consolidation outside that asset pilot.
3. **D2 — Eight-ID pilot (complete for local concept acceptance).** Editable sources, compatible static GLBs, registry, provenance, app-owned collision definitions and G01–G12 applicability/evidence are delivered. See the [pilot review](gjh-v11-interior-pilot-review.md). Reassess repetition before scaling up.
4. **D3 — Navigable shell (bounded classic acceptance complete).** Four original P0 families ARC-001/COR-001/CEI-001/STF-002 replace matching default/pilot shell regions with editable sources, native exports and G01–G12 proof. Actual corridor/three-portal walk/cart, wayfinding, collision and all16fallback combinations pass. The necessary cart draw batching repairs the inherited220-call failure while retaining200ceiling, wheels, materials and physics. This bounded D3 is not the full79P0/M1 milestone; no fourth live brand is added. See the [shell review](v11-interior-shell-review.md).
5. **D4 — Retail and furnishings (supported selection complete).** Reuse five accepted P1 display/seating/passive public furnishings; individually exclude12unsupported P1 FAC candidates, preserving their unimplemented status. Existing P2 kiosk/Map remains a dependency, not a P1 reclassification. No new asset IDs or runtime cost; current14pilot E2E and exact runtime bridge pass. See the [P1 selection review](v11-interior-p1-review.md).
6. **D5 — Optional polish (pending).** Evaluate selected P2 variants, lighting, streaming and measured LOD only where justified. Revisit scope instead of treating 200 completions as a release prerequisite.

## Acceptance and status recording

Retain G01–G12 from the reference: identity, transforms, geometry, UV, PBR, LOD, performance, collision, interaction, export, visual QA and automated QA. Applicability is recorded per asset; `not_applicable` needs a concrete reason and any required exception review. No gate is pre-passed because a candidate is static or because an older asset loaded successfully.

The delivered [pilot manifest](../models/gjh-interior-pilot/manifest.json) keeps the reviewed identity, targets, collision and gate evidence. For future batches, a manifest should keep the source example's ID/version, dimensions, priority, LODs, capabilities, collision and sockets, and add: `source_ref`, `source_sha256`, `source_priority`, `source_dimensions_m`, `approved_dimensions_m`, `reuse_decision`, `implementation_status`, `runtime_compatibility`, `gate_results`, `evidence_paths`, and provenance/usage-rights references. Unapproved targets and evidence fields remain null or pending. This is a proposed contract, not a new runtime schema or generated registry.

Status progression: proposed → specification reviewed → authored/adapted → export validated → integrated → accepted. Record blockers separately. Accepted requires the editable source, GLB, manifest, applicable collision definitions, actual visual captures and gate results, plus a successful real-runtime load. Interactive assets require the relevant keyboard/touch/focus/state/failure journeys. The later pilot implementation records technical acceptance with explicit applicability exceptions; this does not certify the remaining 192 rows.

For implementation, compare the same fixed route and device before/after: transferred resources, draw calls, triangles, geometry/texture counts, frame-time median/P95 and repeated entry/unload trends. Preserve instancing, map/list fallback, four existing product details, bag/cart, seating and independently verified transport behavior. Test failed or delayed assets. Capture mobile/desktop and relevant lighting/overlay states; do not label unsupported modes as tested. Existing scene tests and the advisor screenshots are baselines, not acceptance evidence for future assets.

## Documentation intake validation (historical)

Validated the imported file checksum, 200 unique stable IDs, ten complete 001–020 category sequences, per-category priority totals and local documentation links. No Blender generation, GLB validation, runtime integration, browser E2E, commit or publication was performed for this documentation-only update.

## Subsequent implementation

The owner explicitly requested the eight-asset pilot after documentation intake. [Pilot verification](gjh-v11-interior-pilot-review.md) records Blender authoring/reimport, validator, real-runtime E2E, failure/lifecycle tests, captures and performance observations. The historical intake statement above describes that earlier step only. The later commit/push request is reconciled in [release review](gjh-v11-interior-pilot-release.md); the original intake and implementation evidence remains historical.

## Four-ID shell follow-up

The later owner authorization covers autonomous completion of the four remaining interior tasks, superseding earlier eight-only scope statements for current work. The selected D3 adds four unique P0 IDs to the eight-ID pilot;188 candidates remain pending. Approved existing-world dimensions, canonical component/placement/proxy ownership, real artifacts and scoped evidence are in the [shell acceptance manifest](../models/gjh-interior-shell/manifest.json). Source inventory rows, priorities and SHA remain unchanged. D4 supported selection is recorded separately; D5 retains its pending status. Current application1.1.49 integration and independent acceptance are recorded separately from the immutable950 phase; main/CI/Pages publication remains the release gate. The opt-in expanded layout retains its own shell and bypasses these four GLBs.
