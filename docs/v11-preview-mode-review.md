# V11 preview mode guidance — 1.1.17

## Observed problem and advisor review
A fresh public 1.1.16 screenshot at 390×844 confirms that after loading a New Moon model and choosing Show official image, the static packshot is shown but its status still instructs visitors to drag/rotate/zoom the 3D model. A separate read-only advisor actually reproduced the flow and inspected the screenshot before recommending this bounded correction. This is misleading interaction guidance, not a geometry or rendering failure.

## Change
The existing mode switch updates guidance only when a model has loaded. Image mode now identifies the official packshot and explains how to return to the unofficial interactive demo; 3D mode retains its original drag/keyboard instructions. The initial-image, loading and error/retry messages remain separate. No layout, model, loader, camera, URL or product-data change.

## Necessary verification
`tests/browser_gjh_preview_mode.py` passes all four SKUs at 390×844 and 1440×900: two image/3D roundtrips each, correct visible surface/status/focus, default image wording on reopening, resource cleanup on close. Loading text, 404 fallback and retry into 3D pass at both viewports. SSOT and generated-release checks pass. Unchanged model/physics/PWA suites reuse prior evidence; CI runs its normal build checks. This is Chromium laboratory evidence, not physical-device or screen-reader certification.

Rollback: revert this release and rebuild generated files from prior main `d9b9c96e02db40c52744bf6458731c7a0fe3c364`; no history rewrite. A binary reversal check is prepared before pushing.

Independent after screenshot review: PASS. The advisor actually viewed the 390 full screenshot and the 1440 dialog region at native size, confirming correct mode instructions, normal wrapping and unobstructed controls/disclosures. Automated interaction evidence above belongs to the implementing worker, not the advisor.
