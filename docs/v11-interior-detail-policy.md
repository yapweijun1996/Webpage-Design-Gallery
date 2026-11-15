# V11 D5 optional detail policy

D5 completes the measured P2, reflection/texture, streaming and LOD evaluation. Retain the supported existing presentation; introduce no new variant, decoder, render pass or distance-switching state. The [machine-readable policy](evidence/interior-detail-policy.json) owns the decisions, exact source/measurement hashes, browser compatibility results and limitations. This is a completed evaluation, not implementation of all40P2 candidates or a deferred mandatory feature.

## Measured basis

The runtime is byte-identical to deployed application1.1.49/build34862f97d6fe1c65. All148source hashes match D3's pinned8768 comparison and D4 release9c2066f. The following data comes from that current-source render-loop report, not the older950 or application1.1.31 results. Each state contains120distinct advancing rendered frames after30warmup frames; the paired baseline/current report contains960frames.

| Current state | Calls | Renderer triangles | Geometries / textures |
| --- | ---: | ---: | ---: |
| 390 Auto, inactive cart | 159 | 831,506 | 105 /19 |
| 390 Auto, active cart | 162 | 842,154 | 108 /19 |
| 1440 Detailed + shadows, inactive cart | 197 | 834,518 | 114 /29 |
| 1440 Detailed + shadows, active cart | 200 | 845,166 | 117 /29 |

The measured Detailed active-cart state has zero headroom under the200-call ceiling. Median loop interval is16.7ms and P9516.7–16.8ms in this vsync-capped Chrome157/Metal lab. These are instrumented render-loop intervals and renderer counters, not GPU timer queries, throughput, GPU-memory bytes, physical-phone FPS or a global hardware-capacity claim. The historical220-call baseline failure remains preserved.

## Selected decisions

| Area | Decision and reason |
| --- | --- |
| P2 variants | Retain accepted PUB-017 directory USE → canonical DOM Map and passive VER-017 plinth. Select no additional variant without a supported journey and measured benefit. These existing two IDs remain P2 and are not new acceptances. Expanded retains its neutral directory and skips the classic plinth. |
| Reflection | Keep current opaque PBR and glass/material presentation. Add no reflection pass or environment-map resource: no measured visual/task benefit and GPU cost evidence justifies extra work within the current ceiling. No hypothetical milliseconds or reflection benchmark is reported. |
| Texture/decoder support | Keep the shared furniture/shell loader texture-free. Existing product photo-labels, scene images and dedicated model pipelines remain unchanged. Do not add KTX2/other decoders or weaken static validation. |
| Streaming | Keep shared one-fetch prototypes, the fixed classic shell batch and existing lazy product previews. Four shell GLBs total40,892bytes; there is no measured latency or memory benefit justifying new cancellation, unload/reentry or collision-lifetime states. |
| LOD | Keep reviewed static/instancing exceptions and existing shared LOD1 products. Do not fabricate LOD0/2 files or split the batch for distance switching without measured benefit. Four shell natives contain132/220/220/176triangles,748total and10primitives. Sixty classic placements bake11,220triangles into one opaque mesh; each native is already below its reviewed500/700far ceiling. Expanded bypasses this kit. |

The [earlier product LOD evaluation](v11-lod-evaluation.md) remains historical. Its application1.1.31 budget pass is not relabelled as current. More geometry cannot repair estimated label artwork or Mexico's missing sector; current verified packshot/detail information remains the readable route.

## Actual compatibility check

A fresh real-browser test calls the production `loadStaticAsset` with SHA-valid private GLB fixtures. The positive control parses once and loads all three expected primitives. Five isolated variants—image/texture, required extension, external buffer, animation and skin—return `fallback/invalid`, zero primitives and zero GLTF parse calls. Captured requests confirm no dependent image/decoder/external-buffer request. The actual response SHA is verified before each negative conclusion; production definitions, source and files are untouched. This proves the static family boundary, not a global inability to use images in the app.

Two failed harness attempts remain pinned: an incorrect vendored module filename, then a Playwright route callback whose default payload occupied the Request argument. The latter hung fixture was stopped by its exact owned Python PID; no product assertion was relaxed. Corrected explicit route/request/payload parameters pass all six cases. Prevention: inspect actual vendored filenames and reserve callback arguments before captured defaults; retain a successful positive control and response hash in negative tests.

## Preservation and completion boundary

This policy adds zero runtime files, model bytes, downloads, textures, colliders or draw calls. D4's fresh14pilot E2E checks, D3's eight browser integration groups,55Python/19Node checks, actual66collider comparison, four continuous journeys and five public flows remain applicable through exact current-source hashes. D4 main/CI/Pages acceptance verifies35normal public resource hashes, including all five selected P1 GLBs. New evidence here is the bounded compatibility test and explicit policy decision; unchanged browser suites are not claimed as rerun for D5.

The source inventory still has12implemented selected IDs and188pending candidates. No fullM1, additional FAC production, expanded performance, physical phone/Safari/AT, real safe-area, packaging fidelity or CPU prototype-collection certification follows. Historical45-request/10MiB failures remain explicit. Subsequent materials, utility, theme and seasonal work in the separate expanded-mall checklist retains its own scope and status.

This closes the four requested interior follow-ups through separate task releases: D1 `950634f` (Pages43684550130), D3 `e7581e6` (Pages43699502215), D4 `9c2066f` (Pages43700288223), followed by this D5 policy release. D5 requires its own independent acceptance, focused main push and successful CI/Pages/public-source verification; local evidence alone is not publication proof.
