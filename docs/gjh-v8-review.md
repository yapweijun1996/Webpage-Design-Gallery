# GJH V8 — Local Candidate Review

Reviewed: 11 November 2026. Candidate branch: `feat/gjh-v8-generations`. Status: **OWNER-REVIEW CANDIDATE; COMMIT AND PUSH AUTHORIZED**. The user subsequently authorized committing and pushing V8 to `main` on 11 November 2026. Deployment remains unauthorized and no production deployment setting changed. Git history records the resulting commit; this review does not claim deployment.

## Outcome and scope

V8 adds seven responsive scenes at `demos/corporate/gjh/v8/index.html`: cinematic family hero, living heritage, a 2.5D brand universe, business cards, dated journey, schematic regional connections and an enquiry CTA/footer. The gallery discovers the fifth version through metadata. Existing V1/V5/V6/V7 source, routes, featured selection, shared gallery JavaScript, templates and deployment workflow are unchanged.

The work lives in a dedicated sibling worktree, `Webpage-Design-Gallery-v8`, created from HEAD `48f1947`. Uncommitted PWA changes in the original worktree were excluded and remain untouched. Bringing the candidate into that worktree later requires reconciliation with its newer generator/template changes; this validation does not cover the unfinished PWA integration.

## Evidence and checks

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Original baseline | PASS | Before adding V8: seven standard-library tests and generated-page check passed |
| Gallery contracts | PASS | Eight tests, including V8 metadata and retained versions; deterministic generator check produces one company/five designs |
| Required viewport matrix | PASS | Real local Chrome at 1920×1080, 1440×900, 768×1024, 390×844 and 320×568; overflow, images and controls in [browser evidence](evidence/gjh-v8-browser.json) |
| Keyboard, menus, enhancement and fallback | PASS | Skip navigation, Escape, section focus, breakpoint focus recovery, reduced motion, normal desktop/mobile motion and no-JavaScript fallback are asserted by `tests/browser_gjh_v8.py` |
| Gallery navigation / comparison | PASS | V8 collection entry, design details, V8/V7 iframe comparison, old-route smoke; full `browser_gallery.py` passes at 1440/768/390/375px including filters, viewport switching, scroll synchronization, screenshot mode, invalid URLs and no-JavaScript browsing. [Run output](evidence/gjh-v8-gallery-regression.txt) also records the synthetic 120-company/1,200-design pagination/search check |
| Legacy GJH regression | Functional checks pass; identical baseline accessibility failure retained | 28 V1/V5/V6/V7 cases in isolated candidate and `git archive HEAD` copies; both have the same eight `.identity` label mismatch cases, with no new candidate failure. [Legacy evidence](evidence/gjh-v8-legacy-regression.json) preserves both runs |
| Official asset library | PASS | Existing offline verifier checks 26 source assets; local V8 receipts additionally record new Sony/Borsch Med and generated-image assets |
| Official destinations | PASS at review time | All ten distinct outbound destinations returned HTTP 200 in the final [HEAD check](evidence/gjh-v8-links.json), including homepage/eShop. No form submitted |
| Lighthouse mobile | 100 / 100 / 100 | Accessibility / Best Practices / SEO; 53 audits passed, zero failed in [JSON](evidence/gjh-v8-lighthouse-mobile.json) and [HTML](evidence/gjh-v8-lighthouse-mobile.html) |
| Lighthouse desktop | 100 / 100 / 100 | Same three categories; 53 passed, zero failed in [JSON](evidence/gjh-v8-lighthouse-desktop.json) and [HTML](evidence/gjh-v8-lighthouse-desktop.html) |
| Performance observation | LCP 258ms, CLS 0.00 | Cold local Chrome trace, no network/CPU throttling; [measurement](evidence/gjh-v8-performance.json). Not a field result or Lighthouse Performance score |
| Lighthouse Performance 90+ target | UNVERIFIED | Available Lighthouse tool excludes that category. No package installed solely to obtain a score |
| Real devices, screen readers, full WCAG, conversion | UNVERIFIED | Emulated Chrome and automated audits do not prove these |

An initial Lighthouse run surfaced `label-content-name-mismatch` on the identity link. Removing the redundant accessible-name override fixed it; final mobile and desktop audits report zero failures. A visual review caught clipping of embedded brand artwork; original artwork is now displayed in full. Sony alt text correctly describes a brand tile. The visible New Moon SKU is New Zealand abalone, 425g.

## Reference fidelity and deliberate differences

The implementation retains the reference's green/gold/ivory rhythm, cinematic family composition, large serif typography, heritage narrative, brand hierarchy and regional business conclusion. It uses real semantic text and interactive controls rather than a flattened screenshot.

The original GJH logo replaces the reference's invented gold identity. The family hero is a newly generated, visibly disclosed fictional illustration. The history visual is an official-site composite with a caption, not an invented archival street scene. New Moon uses an exact official SKU packshot; MILI/GOGO use original brand photographs because matching approved packshots/models were unavailable. The brand display is explicitly 2.5D. Electronics uses the original Sony brand tile rather than fabricated product photography. The network is a labeled SVG schematic with a readable named-market list, without invented totals. Only four verified date chapters are used; no unverified “1960s launch” or sustainability claim is introduced.

Desktop and mobile full-page captures: [1440](screenshots/gjh-v8/1440.png), [768](screenshots/gjh-v8/768.png), [390](screenshots/gjh-v8/390.png). The same device captures feed the V8 gallery detail view.

## Independent 13-perspective review

Three independent reviewing agents supplied these perspectives; they were independent of the main page author. This is not thirteen separate human experts or a user study. Detailed evidence and recommendations are in the [creative review](gjh-v8-creative-review.md), [brand/B2B/SEO review](gjh-v8-brand-review.md), and [QA review](gjh-v8-qa-review.md).

| Perspective | Finding / severity | Evidence | Recommendation / verification |
| --- | --- | --- | --- |
| 1. Corporate Brand Director | Medium: concept can resemble approved campaign art | Hero/disclaimer, manifest | AI notice enlarged on mobile; formal brand endorsement remains explicitly absent |
| 2. Creative Art Director | Medium: source-backed imagery differs from reference collage | Desktop/mobile captures | Keep original assets; obtain approved packshots/history masters for closer fidelity |
| 3. UI Designer | Low: compact identity/support labels on mobile | 390px capture, CSS | Supporting disclosure text increased; physical-phone reading remains unverified |
| 4. UX Researcher | Medium hypothesis: consumer/partner intent can be more explicit | Narrative and enquiry path | Current official business CTA is clear; segment only after user research supports it |
| 5. Typography Specialist | Low: system serif varies across platforms | Font stack and screenshots | Manrope self-hosted; approve a display master before typographic brand certification |
| 6. Motion Designer | Medium: manual timeline choice pauses automatic selection | `manualMilestone` state | Deliberate selection precedence documented; possible follow-scroll control is optional future work |
| 7. 3D/WebGL Engineer | No high defect: 2.5D is honestly represented | CSS perspective, no model/canvas dependency | Retain lightweight fallback; use real 3D only with verified accurate models |
| 8. Mobile UX Specialist | Required emulated widths pass; physical device unknown | Browser matrix and mobile captures | Review on physical iOS/Android before claiming cross-device certification |
| 9. Accessibility Specialist | Automated/keyboard checks pass; full WCAG unknown | Axe and final Lighthouse reports | Manual screen-reader and image-overlay contrast review remains a release-quality follow-up |
| 10. Performance Engineer | Medium evidence gap: no throttled performance score | Local LCP/CLS trace | Measure representative mobile network and field performance before a 90+ claim |
| 11. SEO Specialist | Medium: canonical/social-image metadata absent | HTML head, Lighthouse SEO100 | Add against the approved final published URL when release is authorized; structured-data identity must remain truthful |
| 12. B2B Conversion Specialist | Medium hypothesis: one generic official enquiry destination | Contact links, HTTP check | Keep a working official path; qualify enquiry categories only if supported by the real contact channel |
| 13. QA Engineer | Functional matrix passes; legacy audit failure tracked | V8 and legacy evidence | Preserve baseline failures; do not describe a red legacy axe run as fully green |

No critical or high candidate defect was identified by the independent reviews. Persona ratings are heuristic engineering judgments, not measured conversion scores or professional certifications.

## Remaining issues and release readiness

The local candidate is suitable for owner review. Formal asset/packaging and company approval, matched electronics photography, accurate 3D product models, a formal brand manual, physical-device/screen-reader coverage and a scored mobile Performance run remain unavailable. The business-card imagery is intentionally less uniform than the reference to preserve source accuracy. System serif rendering varies across platforms. A schematic map cannot establish territory or distributor coverage.

The user explicitly authorized committing and pushing this candidate to `main` after local review. That authorization does not include running the deployment workflow. The existing manual Pages workflow is unchanged. Before a later deployment, reconcile the separate PWA work, regenerate/validate gallery output, review final screenshots and check public-use conditions and production URL metadata.
