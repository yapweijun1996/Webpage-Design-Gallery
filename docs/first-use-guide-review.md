# First-use guide review

Scope: a dismissible first-use dialog for V11 only, shown after the mall is ready. Keyboard and coarse-pointer instructions use the existing controls. Start, map and accessible-directory actions preserve store and product behavior. How to explore reopens the guide. Session storage is optional; storage failure retains an in-memory dismissal. No brand assets, store content, layouts or URLs are replaced.

## Evidence

- 39 unit tests and static SSOT contracts passed. Final browser SSOT passed all 42 route/viewport cases with zero axe violations and no horizontal overflow, using axe-core 4.10.3. Final application version 1.1.6 PWA checks passed.
- Guide browser checks passed at 320, 390, 768, 1440 and landscape 844 pixels: pause, map navigation, directory focus, Escape/reopen, session memory and storage failure. WASM and no-JavaScript directory fallbacks passed.
- Existing V11 walking, collision, character, furnishings, original-tin, gallery, legacy GJH and PWA suites passed.
- Mobile rendered guide inspected: readable content, three distinct actions, visible focus indicator, no overlap with the modal viewport.
- Full-suite log retains initial stale-generation failure and the separate optional browser-SSOT invocation error; neither is represented as a product test pass. Generated output was rebuilt using the repository generator.

## Limitations and rollback

Observed on Linux ARM64 headless Chromium with SwiftShader, not physical Android/iOS, Safari or a screen reader. The four branded New Moon GLBs remain unpublished and are not completed by this guide. Other unchecked task.md items remain pending.

Prior main: `45ffb2848da4e0f0393e043393c7e28af6c890df`. Rollback is a normal revert of this isolated guide commit followed by Pages; never force-push. Live deployment verification is separate from local evidence.
