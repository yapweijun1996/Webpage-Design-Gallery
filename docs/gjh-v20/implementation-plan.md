# GJH corporate landing (v20) - implementation plan

Decision (Manager + Advisor review, 2026-11-18): build **Direction B (Modern portfolio)**. `mockups/B-desktop-1440.png` and `mockups/B-mobile-390.png` are the only visual anchors. No A+B hybrid. Mockups are proposals with baked-in text; never crop runtime images from them.

## Scope
New standalone page `demos/corporate/gjh/v20/` (index.html, style.css, script.js, metadata.json, assets/, manifest/sw per the v19 pattern and `scripts/build_demo_pwas.py`). Title "Goh Joo Hin - Brand Portfolio" style `corporate`. Add 20 to `VERSIONS` and the journey maps in `demos/corporate/gjh/landing_checks.py`. Do not touch v11 or any other demo.

## Sections (order must match the anchor)
Header (logo, Brands, About, Contact, Shop Online) -> Hero (headline "Explore Goh Joo Hin's Brands", primary "Explore Our Brands", secondary "Sales Enquiry", real New Moon packshot + AI-labelled studio image) -> Find a brand chips -> Brands & Categories (filters All / Food & Beverage / Lifestyle / Healthcare; cards New Moon, MILI, GOGO, Sony, Borsch Med; directory card) -> Featured product (New Moon Premium Wild Caught New Zealand Abalone 425g) -> About GJH -> Virtual Mall Concept (optional, `../v11/`, lazy, no 3D script) -> Sales Enquiry -> Footer.

## Verified copy (use exactly; do not invent)
- Address: 8 Gul Avenue, Singapore 629652 (research/company-profile.md, ACRA-matched).
- About: began as a provision store on Rochor Road in the 1940s; distribution business covering food and beverage, lifestyle and healthcare.
- New Moon: abalone, shellfish, soups and sauces. MILI: canned fruit, vegetables, meat, seafood and sauces (NOT "canned fruit and vegetables" only). GOGO: drinks and potong ice cream. Sony: appointed distributor for specified Sony product ranges (do not claim territory or scope). Borsch Med: health supplements and personal care.
- URLs (all returned 200 on 2026-11-18): brand pages gjh.com.sg/newmoon|mili|gogo|borsch-med/, about gjh.com.sg/about-us/, directory gjhglobal.com/explore-our-brand/, contact gjhglobal.com/contact-us/, corporate sales gjhglobal.com/corporate-sales/, E-Shop gjheshop.com/shop/, product gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/. External links: target=_blank rel="noopener noreferrer".
- Images: only verified repo assets (check each `sources.json`) for logos, packshots, history and lifestyle photos; Sony logo only if an approved asset exists in the repo, otherwise a text wordmark. New decorative imagery is generated separately with ImageGen, webp <= 120 KiB, labelled "AI-generated concept".
- Keep the notice "Independent design concept, not affiliated with Goh Joo Hin."

## Enquiry behaviour (no fake submit)
Every brand card and chip has an "Enquire" action that prefills Brand and moves focus to the enquiry block; Product is a free-text field (prefilled for the featured product). "Copy Enquiry Details" uses the clipboard API with a fallback to a read-only textarea with select-all when clipboard access is denied (must work inside the gallery's iframe preview). "Open Official Contact" opens the official contact page. No submit button, no success message, no claim of prefilling the official form; show the plain note to paste brand, product and requirements into the Message field. Works without JavaScript (links still reach brand pages and the official contact).

## Acceptance (written before coding)
1. Section order and layout match the B anchors at 1440 and 390; palette/type follow `design-notes.md` values.
2. At 390x844 the "Find a brand" row starts above y=844; at 1440x900 the hero and both CTAs are in the first screen.
3. Mobile journey: from the first screen tap New Moon -> correct brand/product detail -> Enquire -> Brand and Product populated.
4. 320/390/768/1440: no horizontal overflow, targets >= 44px on phones, visible focus, one h1, alt text, no console errors, reduced motion respected, page weight comparable to v19.
5. `python3 scripts/build_gallery.py`, `--check`, `python3 scripts/check_ssot.py` (broke the deploy before), unit tests and `landing_checks.py` all pass; add metadata so the gallery lists v20.
6. Side-by-side anchor board (existing `scripts/render_anchor_audit.py` pattern) labelled "Mockup (proposal)" vs "Screenshot (real)".
