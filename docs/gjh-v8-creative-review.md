# GJH V8 — Independent Creative Review

Reviewed: 11 November 2026. Scope: `demos/corporate/gjh/v8/index.html`, `style.css`, `script.js`, the 1440px and 390px captures in `screenshots/`, and the supplied `GJH_ Generations of Goodness.png` reference. This is an independent concept review, not a brand approval or user study.

## Overall assessment

The candidate has a coherent premium direction and preserves the reference image's major composition: forest-green hero, champagne-gold accents, warm ivory interludes, editorial serif headings, a heritage chapter, three portfolio brands, business pillars, a timeline, regional connections and a closing enquiry. The strongest decision is the explicit separation between verified/source-checked imagery and concept imagery. The weakest area is the product-universe fidelity: it is an attractive 2.5D layered presentation, but the supplied reference's product display is more direct, legible and presentation-ready.

No critical issue was found in this visual review. One medium issue remains: the desktop business cards mix a Sony logo tile and a Borsch Med lifestyle image with the FMCG photograph, so the visual treatment is less consistent than the rest of the page. This is an evidence and art-direction limitation rather than a fabricated-claim defect.

## Persona findings

### Creative Art Director — PASS WITH WARNINGS

**Findings:** The green / ivory rhythm, gold hairlines, large serif headlines and restrained orbit motif make the page recognisable as one system. The generated family dinner image gives the hero the requested emotional anchor while the left-side negative space supports copy. The heritage composite is disclosed as a website composite rather than presented as archival proof. The business and journey sections are calmer and allow the hero to remain the high point.

**Medium:** The supplied reference has a more literal editorial collage: a full-width hero family photograph, a strong horizontal historic street composition, clean product packshots, and an explicit five-stop journey. V8's page is more abstract in the brand and network sections, and its journey has four verified points. This is a deliberate evidence-led adaptation, but the visual comparison will read as less literal.

**Recommendation:** If the owner wants closer reference fidelity, add one approved, high-resolution product composition and one verified regional-network visual before changing the layout. Do not replace the current history disclaimer or add unsupported milestones.

**Verification:** Desktop capture shows a consistent palette and section alternation. Asset and fact boundaries are documented in `docs/gjh-v8-facts.md` and `v8/assets/sources.json`. Approval remains unverified.

### UI Designer — PASS WITH WARNINGS

**Findings:** Navigation, section anchors, rounded gold CTAs, card arrows, `aria-pressed` selectors and the accessible market list form a consistent control language. The responsive grid changes from three columns to one column at the mobile breakpoint instead of only shrinking the desktop layout. Focus-visible styling is present.

**Low:** The header identity is visually compact at mobile widths and the hero's small kicker / bottom metadata approach the minimum reading size. The reference's desktop navigation includes Sustainability; V8 intentionally omits it because no destination was supplied. That omission avoids a dead or invented route but leaves one reference affordance absent.

**Recommendation:** Obtain a verified Sustainability destination before adding the link. At a final mobile pass, increase the smallest supporting labels by 1px if screenshots or physical-device review show loss of legibility.

**Verification:** The 390px capture shows the menu trigger, stacked business cards and mobile timeline. Browser keyboard and menu checks are owned by the V8 QA report; this document does not treat the static screenshot as proof of those checks.

### UX Researcher — PASS WITH WARNINGS

**Findings:** The narrative sequence is understandable: emotional introduction → heritage → brands → business capabilities → journey → network → enquiry. Primary actions are visible in the hero and closing section. Verified-company language and the independent-concept notice reduce the chance that a visitor interprets the page as a live official site.

**Medium:** The hero copy says “a portfolio of everyday brands,” while the page then presents only three selected brands. The network chapter exposes named markets but no count, which is honest but gives a partner visitor less immediate scale than the supplied reference. The page does not establish whether a visitor should explore brands as a consumer or contact GJH as a business partner until the later CTA.

**Recommendation:** Add a short “For consumers / For partners” choice near the brands or businesses heading if owner research supports those separate paths. Keep current market wording unless verified totals become available. Treat this as a research hypothesis, not a proven conversion defect.

**Verification:** No user testing, analytics, conversion study or comprehension study was run. The recommendation is therefore unvalidated.

### Typography Specialist — PASS

**Findings:** Manrope is self-hosted and preloaded, and the serif display face is intentionally used for headlines rather than body text. `clamp()` sizes, short line lengths and high-contrast ivory / green surfaces preserve a strong editorial voice. The reference's oversized “Generations of Goodness” hierarchy is reproduced without using image text.

**Low:** The display serif is a system fallback (`Georgia`, then Times) rather than a project-local branded typeface. Rendering will vary between Windows, macOS and Linux. The smallest metadata, asset notes and map caption use very small text and should be judged on a physical phone rather than only a scaled screenshot.

**Recommendation:** If typography is part of final brand approval, commission or select an approved display face and add a font receipt. Until then, keep the fallback explicit and do not claim official typography.

**Verification:** Source inspection confirms Manrope preload and the deliberate fallback stack. Cross-platform font rendering was not tested.

### Motion Designer — PASS WITH WARNINGS

**Findings:** The motion system is restrained: hero scale/parallax, scroll-triggered brand depth, pointer tilt, IntersectionObserver reveals, a timeline progress line and an animated network connection. `prefers-reduced-motion` removes transitions and scroll transforms, and content remains in the document flow. There is no audio or continuous WebGL render loop.

**Medium:** The journey's active milestone is inferred from scroll progress until a visitor manually selects a milestone; after manual selection, automatic milestone changes are intentionally paused for the remainder of the page session. That protects a visitor's selection, but it can make later scrolling look visually static. The network line animation is only decorative and is not an explanatory map.

**Recommendation:** On owner approval, reset `manualMilestone` when the visitor leaves and re-enters the journey, or provide a visible “follow scroll” state. Keep the schematic and its “not to scale” label unless verified geography is supplied.

**Verification:** Source inspection confirms reduced-motion branches and bounded `requestAnimationFrame` scheduling. Timing and frame-rate profiling were not run.

### 3D / WebGL Engineer — PASS

**Findings:** V8 does not claim to be a Three.js scene. The brand universe is an honest 2.5D composition using layered images, perspective transforms, pointer tilt and a CSS orbit. The regional graphic is inline SVG with an accessible HTML market list fallback. This satisfies the requirement to avoid calling a flat image “full 3D.” It also avoids a dependency, WebGL context and large model transfer.

**Low:** The New Moon packshot is a verified flat image and the MILI/GOGO objects are photographic crops, so depth is visual only. The network shape is schematic and not geographically authoritative.

**Recommendation:** Keep the current implementation for a static gallery concept. Use real models only if approved, accurate 3D files become available; do not add Three.js solely to increase spectacle.

**Verification:** `style.css` and `script.js` contain no Three.js, WebGL or fake canvas model code. Static fallback is the primary implementation, and the market list remains available outside the SVG.

## Reference comparison

| Area | Reference image | V8 result | Review decision |
| --- | --- | --- | --- |
| Hero | Family scene, deep green overlay, gold CTA | Concept family scene, left negative space, green overlay and gold CTA | Preserve; disclosure is required |
| Heritage | Warm archival street scene and paper collage | Official composite with caption and chapter selector | Preserve the disclaimer; approved higher-resolution history art could improve fidelity |
| Brands | Three clean product packshots | One verified packshot plus two official brand photographs in 2.5D cards | Keep until accurate packshots are approved |
| Businesses | Three photographic business cards | Three cards; Sony tile and Borsch Med image are source-backed but visually less matched | Medium art-direction follow-up |
| Journey | Five visual stops from 1940s to Today | Four evidence-backed milestones with active controls | Do not add unsupported stops |
| Network | Atmospheric globe and numeric scale claims | Schematic SVG globe, named-market buttons and no invented totals | Evidence-led and safer; not a literal match |
| CTA | Contact button in nav and final distribution action | Business enquiry and official contact links | PASS |

## Release recommendation

**Decision: PASS WITH WARNINGS for owner review.** The visual system and interaction premise are strong enough for a local gallery candidate. Before calling it production-ready, obtain owner approval for the generated hero, confirm the public-use status of all source imagery, review small mobile text on a physical device, and decide whether the mixed business-card imagery is acceptable. No visual review evidence supports a claim of WCAG conformance, Lighthouse score, conversion performance or official brand approval.
