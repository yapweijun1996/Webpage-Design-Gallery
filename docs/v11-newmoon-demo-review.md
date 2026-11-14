# V11 conceptual New Moon cans and shelves — 1.1.13

## Scope and permission

The owner explicitly approved public demo use of the four New Moon can candidates and shelf on 2026-11-14. This authorizes the requested integration and deployment; it is **not** independent confirmation of third-party artwork rights or a general redistribution license. Labels are photo-derived concepts, not verified packaging replicas or brand-approved editions. Physical dimensions, panel order and spacing remain estimates. Mexico retains a clearly disclosed **121-degree unprinted placeholder sector**. No invented back-panel artwork was added.

The integration starts from main `f4b3505755617e5bc808567edfde2ce2a9278ded`. Only selected assets and bounded integration logic from local candidate `e96f3d1` were transplanted. Old generated pages and the older complete world were not restored. Existing first-use guide, compact List, entrance kiosk, landscape controls, late furniture cleanup, pointer interruption recovery and failure-focus recovery remain intact.

Exact bytes and the recorded upstream pin are in `demos/corporate/gjh/v11/assets/newmoon-demo-source.json`. Upstream metadata is retained unchanged, including its historical rights/accuracy caveats; the new receipt records the subsequent owner demo approval. Editable Blender sources remain in the pinned upstream library, not duplicated in this web integration.

## Implementation

- Five local GLB files, one shared load per asset; no runtime model CDN.
- Four shelf instances at native 1.52 × 1.96 × 0.58 metre bounds, with four matching physical colliders. Legacy rack geometry/colliders removed instead of overlapping the new rack.
- Nine can instances per SKU, 36 total, at native GLB bounds approximately 0.0775 × 0.12399 × 0.0775 metres. Shelf support heights are 0.6825, 1.1925 and 1.7025 metres. These preserve the source model scale, not verified physical packaging measurements.
- Country labels and existing interaction IDs identify each group. F opens the matching existing packshot/name/eShop dialog; this release does **not** add a branded orbit/zoom viewer.
- Unofficial/estimated status is visible in the directory note and product descriptions; Mexico's gap is explicit in its dialog.
- SHA-256, embedded-resource GLB structure, supported features, dimensions and primitives are checked before use. Each asset has an independent eight-second load deadline and fallback.
- Parsed geometry, material and texture resources are disposed if validation fails or parsing arrives late. Shelf fallback retains the same physical bounds.

## Asset outcome

| Asset | Demo technical result | Packaging fidelity |
|---|---|---|
| New Zealand 425g LOD1 | PASS: bytes, scale, placement, rendering, correct details | NEEDS REVIEW against physical packaging/die-line |
| Australia 425g LOD1 | PASS: bytes, scale, placement, rendering, correct details | NEEDS REVIEW against physical packaging/die-line |
| South Africa 425g LOD1 | PASS: bytes, scale, placement, rendering, correct details | NEEDS REVIEW against physical packaging/die-line |
| Mexico 454g LOD1 | PASS as disclosed conceptual demo | NEEDS REVIEW; known 121-degree unprinted sector |
| Original display shelf | PASS: bytes, native placement, rendering, collider, 404 fallback | Original concept, not a real fixture specification |

## Verification and visual inspection

43 unit tests pass. Full V11 movement/doors/inspection/collision/reduced-motion/WebGL/WASM/no-JS regression passes on the integrated scene. Five-viewport budget and generic-viewer lifecycle checks pass without raising any existing limit: 8,724,266–8,745,200 ready-stage decoded bytes, 42–43 resource entries and max153 draw calls, compared with about7.98 MB/37–38/max137 before integration. Limits remain10 MiB/45/200. These are Linux ARM64 Chromium/SwiftShader laboratory measurements, not compressed production traffic or physical-device frame rates.

Focused new tests cover normal loads, 404, delayed body, hash mismatch, invalid dimensions, missing label texture and late parse. Missing label textures fail to the existing labelled fallback instead of silently accepting blank cans. Invalid/late New Zealand results dispose all three geometries, three materials and one embedded texture. A first test harness used the gallery offline page, whose CSP correctly blocks blob images; the isolated test now uses a dedicated test document, not a weakened production CSP. The real V11 render tests load and display the embedded labels.

At1440/768/390, all four SKU IDs open the correct packshot/name/link and close back to the scene; real and forced-404 shelves stop direct capsule approach near z=-8.635. The existing central route and other stores remain usable. Source screenshots at desktop/mobile interiors, mobile Mexico dialog, and exact-GLB front/back/side studio views were actually inspected. All four front labels render and remain distinguishable; metadata/visible copy explicitly retain uncertainty. Native-size shelf cans are intentionally small at walking distance; the existing closer-look packshot remains the readable detail route. The three studio renders are QA evidence, not a newly shipped viewer feature.

Evidence: `docs/evidence/v11-newmoon-demo.json`, `docs/evidence/v11-newmoon-budget.json`, and `docs/screenshots/v11-newmoon/`. No claim of official label fidelity, physical Android/iOS, Safari, screen-reader testing or complete offline 3D support is made.

## Release scope and rollback

Per the owner's latest direction, do not rerun unrelated legacy/homepage suites repeatedly. Reuse the preceding 1.1.12 baseline and run changed-scene/new-asset tests plus generator/SSOT/unit and necessary PWA/release integrity checks. Record actual deployment/live results separately; this report alone is not deployment proof.

Rollback: normal revert of this bounded release, new application version/build through the generator, and the same Pages checks. Pre-integration main is `f4b3505755617e5bc808567edfde2ce2a9278ded`; do not force-push. Remaining task: branded interactive product-detail preview, followed by its own loading/lifecycle/accessibility QA. Physical-device and packaging-reference verification remain separate.
