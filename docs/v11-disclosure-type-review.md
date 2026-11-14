# V11 disclosure readability — 1.1.16

## Before evidence and decision
Fresh live 1.1.15 screenshots at 390×844 and 1440×900 show the product-dialog independent-demo disclaimer considerably smaller than the product explanation. Computed size was 9px, line-height 17.1px. This is a readability recommendation, not a claim that WCAG defines a minimum font size; previously measured contrast remains 5.62:1.

A separate read-only advisor, using the already-read KB ask-advisor/UI-quality-auditor protocol, independently inspected both before screenshots and source before implementation. It recommended only replacing the wordmark-caption token with the existing 14px small-text token. Increasing scrolling was identified as the trade-off to check, not a reason to abbreviate or hide the disclaimer.

## Minimal change and verification
Exactly one runtime CSS token changed: `.dialog-copy .concept-note` now uses `--font-size-sm`. Complete wording, position, muted colour, line-height ratio, official eShop URL and all other typography/3D controls are unchanged.

Targeted `tests/browser_gjh_disclosure_type.py`: PASS 320×740, 390×844, 844×390 and 1440×900. Actual rendered size 14px, exact full disclaimer preserved, no horizontal overflow/cutoff, at least 18px separation from eShop, sticky Close hit-testable and touch close/focus restoration intact. Source/SSOT/generated-release checks pass. Screenshots and JSON evidence are retained. No unrelated model/physics or full historical suite was rerun for a single typography token; prior PWA runtime evidence is reused with freshly generated release hashes and CI checks.

Physical devices, screen readers and packaging authenticity are outside this bounded browser review. Rollback is a normal revert to prior release `e3fcdc52c692b6c9d17f8ec4fbea9d424f5c242f`, rebuilding generated release files without rewriting shared history.

Independent after review: advisor actually inspected 320/390/844/1440 screenshots, finding clearer disclosure while retaining secondary visual hierarchy, intact text and separation from eShop, with no blocking visual issue. Its screenshot review is distinct from the implementation worker's automated tests.
