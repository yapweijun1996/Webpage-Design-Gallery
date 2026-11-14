# V11 final incremental laboratory audit

This is a bounded follow-up to application 1.1.14, not another full historical regression run. Runtime/source assets unchanged.

- 320×740: 8,736,242 ready-stage decoded resource bytes, 43 resources, maximum 121 scene draw calls.
- 768×1024: 8,757,176 bytes, 44 resources, maximum 137 scene draw calls.
- Relative to the matching 1.1.13 recorded payload samples: approximately +11,976 bytes and +1 resource, from the isolated preview module/UI/CSS. Limits remain 10 MiB / 45 resources / 200 calls.
- Five actual loaded preview open/close cycles per viewport return to zero app-tracked renderer resources/live contexts. Mall rendering remains paused under details. These are app-level and actual context teardown observations, not GPU-driver memory measurements.
- New preview 320/768 layouts have no horizontal dialog overflow, visible buttons at least 44px, keyboard focus loop and Escape. Rendered 320px screenshot inspected; larger preview screenshots and existing tested viewport evidence retained.
- axe-core 4.10.3 WCAG2A/2AA/2.1AA scoped scans: zero violations in image and 3D detail modes at both viewports, with color-contrast incomplete flags for symbol-only buttons and uncertain element backgrounds. A targeted follow-up checked all six flagged controls/text nodes: resolved computed contrast 5.62–14.73:1, with unobscured centre hit tests after scrolling. See `docs/evidence/v11-preview-contrast-review.json`. Automated analysis is not full accessibility certification.

Environment: Chromium 158.0.8127.18 / Linux ARM64 / SwiftShader, fresh contexts, local uncompressed HTTP, reduced motion. Decoded resources exclude document/deferred loads and are not compressed network traffic. Physical devices, Safari, screen readers, real packaging and independent rights remain unverified.

Evidence: `tests/browser_gjh_final_incremental.py`, `docs/evidence/v11-final-incremental.json`; pinned runtime release and item-by-item scope in `docs/v11-task-evidence-matrix.md`. No additional production behavior or version change is necessary for this evidence-only update. Rollback is a normal revert of this documentation/test commit.
