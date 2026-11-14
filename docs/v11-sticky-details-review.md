# V11 product-detail close bar — 1.1.15

## Observed user problem
On live 1.1.14 at 390×844, open Mexico details, load its 3D preview and scroll to the official eShop link. Close leaves the viewport (top −122px, bottom −78px). The captured before screenshot confirms that a touch user must scroll back up to exit. Existing short-landscape CSS already kept this same header sticky.

## Advisor and decision
Read KB `agent:ask-advisor` 1.0.0 and `ui:ux-quality-auditor` 1.0.5. A separate read-only advisor inspected the actual before screenshot and CSS before implementation. It recommended extending the existing sticky header, rather than adding duplicate controls or redesigning the modal, and flagged keyboard focus obscuration as a counterexample to test.

Implemented only the shared sticky header with its existing opaque paper/z-index tokens, plus scroll padding for keyboard focus targets. No product text, imagery, models, events, layout structure, branding or links changed. After implementation the advisor independently viewed the 320/390/844 screenshots and diff: no blocking visual issue, original visual style retained. Advisor did not claim to rerun tests or use physical devices.

## Targeted verification
`tests/browser_gjh_sticky_details.py`: PASS 320×740, 390×844, 430×932, 768×1024, 844×390, 1440×900 in both packshot and loaded-3D states (12 cases). At the eShop scroll position Close remains in view, at least 44px and hit-testable. Real Tab/Shift+Tab paths remain unobscured below the header; touch close, Escape and return focus work; preview resources are released on close. Source diff, SSOT and generator checks pass. Release/PWA checks are recorded in the delivery evidence.

Screenshots and machine report are under `docs/screenshots/v11-sticky-details/` and `docs/evidence/v11-sticky-details.json`. This is Chromium ARM64/SwiftShader browser evidence, not physical Android/iOS or screen-reader verification. Previously verified unchanged flows were not repeatedly rerun.

Rollback: normal revert to prior main `bfe6f9f104e5167a982a4049331b086edad4c84f` with generated release files rebuilt; no shared-history rewrite.
