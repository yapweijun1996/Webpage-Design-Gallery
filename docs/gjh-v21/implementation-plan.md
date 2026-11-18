# GJH v21 (Apple-inspired) - implementation plan

Decision (Manager review 2026-11-18): build the single direction in `mockups/desktop-1440.png` and `mockups/mobile-390.png` as the only visual anchors; `design-notes.md` has palette/type/tile specs; `apple-study.md` has the principles; `v20-reference-plan.md` has the verified copy, official URLs and enquiry rules (reuse exactly, plus v20's merged implementation as a behavioural reference at demos/corporate/gjh/v20).

## Corrections to the mockup (apply when coding)
1. Mobile brand strip: the mockup squeezes five logos plus a tiny "Enquire" label. Implement as a horizontally scrollable snap row (or 2-row wrap) with every target >= 44x44 px and text >= 12 px; the strip must still start above y=844 at 390x844 and New Moon's two main buttons must be reachable in the first screen.
2. Apple traits to implement (not just draw): sticky translucent global nav (44-56 px, backdrop blur, solid fallback), system font stack only (no webfont downloads), tight display type, staggered scroll reveal using IntersectionObserver (opacity/translate 400-600 ms, content fully visible without JS and under prefers-reduced-motion), subtle tile hover/active states, text links with chevrons.
3. Enquiry: every tile "Enquire" prefills Brand and moves focus to the enquiry block; Product free text (featured product prefilled); Copy Enquiry Details with read-only textarea select-all fallback; no submit button or success message; plain note to paste into the official Message field; works inside the gallery iframe preview and without JS (links still work).
4. Must remain distinct from v20 (different layout language, type, tiles) and keep the disclaimer "Independent design concept, not affiliated with Goh Joo Hin."
5. Images: runtime webp <= 120 KiB each from the verified official assets in the design-notes inventory and the standalone ImageGen originals; AI images labelled "AI-generated concept"; never crop from the mockups.

## Registration and checks
Follow the pattern of the v20 commit (git show 3b9c7fe --stat): demos/corporate/gjh/v21 (index.html, style.css, script.js, metadata.json id gjh-v21 order after v20, manifest, sw, assets with sources.json), landing_checks.py VERSIONS and journey maps, design-system theme/atlas registrations, locale strings, tests that count designs. Run python3 scripts/build_gallery.py, --check, scripts/check_ssot.py and the unit tests.

## Acceptance
Section order and look match the anchors at 1440 and 390; 320/390/768/1440 no horizontal overflow; one h1; alt text; focus visible; targets >= 44px on phones; no console errors; static weight comparable to v20 (~240 KiB); journeys: tap New Moon -> brand detail -> Enquire -> Brand/Product populated; direct URLs reach official brand pages and contact.
