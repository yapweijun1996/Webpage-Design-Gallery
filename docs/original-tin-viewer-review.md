# Original demo tin viewer review

Status: verified local release candidate, not the branded New Moon SKU viewer.

## Scope and source

A separate accessible directory entry and dialog for original generic DEMO artwork. The four existing New Moon product images, text, detail dialogs and eShop links remain unchanged. The mall world and controls are unchanged. No rights-unverified New Moon or shelf GLB is included.

Source: `yapweijun1996/Blender-3D-Gallery`, `models/demo-food-tin/exports/demo-food-tin.glb`, SHA-256 `4b265f78a711d95a80b730ebeaae3906f42c93fbd28f0b8c6e64c8c003eee0ee`, 186,016 bytes. Original owner-project model and artwork, authorized for the owner's public demo. No general third-party redistribution license is granted. DejaVu/Bitstream permission text is retained with the asset.

## Observed verification

- 39 unit tests passed; source generation and contract checks passed.
- Real-GLB browser tests at 320, 390, 768 and 1440 pixels: orbit, zoom, reset, exclusive clips, projected geometry framing, focus containment/restore, close/dispose and reopen passed.
- Lazy fetch, failed load recovery and close-during-download passed. Rendering is on demand, including reduced-motion configuration.
- Existing V11 walking/doors/collision/details, mobile controls, reduced motion, hidden pause, context loss, WebGL/WASM failure and no-JavaScript tests passed at 1440/768/390.
- Gallery and PWA suites passed. Legacy GJH suite passed 28 responsive cases and four no-JavaScript journeys.
- Desktop exploded and mobile open-lid screenshots were inspected; the model is visible and independently labelled. See `screenshots/original-tin/`.

A clean-main baseline reproduced a pre-existing intermittent legacy-menu test failure: immediately after Enter, Chromium had not yet committed the fragment URL. The test now awaits the same #business destination with a three-second deadline and retains URL, focus and closed-menu assertions. Original failures and before/after observations are preserved in local evidence, not silently removed.

## Limitations and rollback

Physical Android/iOS, Safari and assistive-technology sessions have not been run. This is an illustrative removable-lid/assembly demo, not physically accurate tearing, food-safety or fabrication validation. Brand-label fidelity and all remaining task.md phases are not claimed complete.

Rollback uses a normal revert of this isolated release commit, followed by the existing Pages workflow. The prior remote main is `3a095738b1a082c0ddcacb5812710b5c323ca1b7`; do not force-push or overwrite intervening commits. Deployment success must be checked separately from these local results.
