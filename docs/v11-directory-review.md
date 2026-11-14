# V11 directory redesign

A List-only presentation update preserves the cream/green editorial palette, three stores, four original New Moon records and official images/eShop links. No model, branded label, 3D HUD, physics, shared modal behavior or external framework changed.

Changes: compact heading and brand overview; explicit 3-store/4-product count; visible Closer look buttons below product copy rather than over the packshot; matching 01/02/03 store order; an independently labelled original-demo section after the stores. MILI/GOGO unavailable-SKU disclosures remain intact.

## PASS evidence

- 39 unit tests, generated-output check and SSOT contract check.
- Real Chromium 320/390/768/1440: 3D-guide-to-directory transition; all four products open correct details; Escape restores focus; Closer look buttons always visible with 44px minimum height; correct section order; no horizontal overflow.
- No-JavaScript and forced WASM-failure directory retained all four products. These fallback checks are not represented as 3D passes.
- Original real-GLB tin viewer controls, load failure, late close and cleanup passed, as did first-use guide and existing V11 walking/turning/F/collision/door/reduced-motion/context-loss tests.
- Browser SSOT: 42 route/viewport cases, zero axe violations and no overflow. PWA offline/update/cache tests passed at application 1.1.7.
- Rendered desktop overview and mobile overview/product views inspected. Product packshots remain unobstructed and controls visually distinct. Screenshots and structured list results are committed alongside this report.

Initial focused test had an ambiguous ancestor locator resolving both the store and card. The selector was corrected to the nearest article without removing assertions; the original failed log is retained locally.

## Limitations and release

Linux ARM64 headless Chromium/SwiftShader; physical Android/iOS, Safari and screen readers not tested. This is not completion of all task.md phases or permission to publish rights-unverified branded GLBs.

Prior main `6eefba7581b8e32d01f552b0ab12998f63fa34a3`; rollback is a normal revert followed by Pages. Live hashes and browser checks are verified separately after deployment.
