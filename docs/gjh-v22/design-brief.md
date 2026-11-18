# GJH v22 "Brand Chapters" - design brief (manager, 2026-11-18)

## Why v20 and v21 failed (owner verdict: "both suck")
Both are card-grid templates with small tiles and a tiny packshot hero; v21 only borrowed Apple's chrome (pills, grey bands), not its impact. They ignored the repo's 98-image library (`assets/companies/gjh/landing-concepts`, 1664x936 desktop heroes, 1120x1400 mobile stories, square details, transparent cut-outs). Weak imagery, equal-weight cards, an awkward empty enquiry form.

## Research (measured 2026-11-18)
- apple.com/sg/airpods-pro: page ~28,300 px tall; hero is exactly one viewport (900 px): product centred on a soft gradient, tiny eyebrow, two-line headline anchored bottom-left (28 px/600 for the product name, huge claim below), sticky price+Buy pill bottom-right; sections thousands of px tall with 11 sticky elements = scroll-driven chapters; one idea per viewport.
- apple.com/sg/iphone: alternating white/#f5f5f7 bands, rounded tiles, pill actions, accent blue only for actions, staggered reveal (see apple-study.md).
- Lessons: (1) one idea per viewport, giant imagery, minimal copy; (2) a persistent action pill; (3) chapter rhythm with sticky/stacking transitions; (4) type is large, tight and calm; (5) colour comes from the photography.

## Concept
Full-bleed, one-brand-per-chapter story built from the repo's real image library. A visitor scrolls: Hero -> New Moon -> MILI -> GOGO -> Borsch Med -> Sony -> More brands -> About (Rochor Road, 1940s) -> Virtual Mall Concept -> Sales Enquiry -> Footer. Business requirements are in `planning-brief.md` (authority): primary CTA "Explore Our Brands", "Sales Enquiry" -> official contact, "Shop Online" -> E-Shop; browse -> view product -> enquire with brand/product carried over; mobile visitor finds the brand from the first screen.

## Layout and behaviour spec
- Desktop hero = 100svh full-bleed photo (library 001 New Moon desktop hero), dark-to-transparent scrim for text contrast, eyebrow + H1 "Explore Goh Joo Hin's Brands" (clamp 56-104 px, weight 600-700, tight tracking), one supporting sentence, two buttons (primary "Explore Our Brands", secondary "Sales Enquiry"), glass "brand strip" docked at the bottom of the hero (logo + name per brand, jumps to its chapter).
- Chapters (each >= 100svh; sticky stacking: each chapter pins and the next slides over it; progressive enhancement, plain stacked sections without JS/support): full-bleed library hero (desktop) / mobile story portrait (phone) via <picture>; giant brand name; one verified sentence; actions "View Brand" (official brand page) and "Enquire" (opens the enquiry sheet with brand prefilled); New Moon chapter also shows the real packshot with the exact product name (New Moon Premium Wild Caught New Zealand Abalone 425g) and "View Product" (E-Shop product URL). Slow image scale (1.06 -> 1) and text rise on enter (IntersectionObserver / CSS view timeline), disabled for prefers-reduced-motion; content fully visible without JS.
- Global chrome: 52-56 px translucent nav (Logo, Brands, About, Contact, Shop Online) with blur and solid fallback; persistent bottom-right action pill "Sales Enquiry | Shop Online" (bottom bar on phones, >= 44 px targets) like Apple's sticky buy pill.
- Category cue: small eyebrow on each chapter (Food & Beverage / Lifestyle / Healthcare).
- More brands: horizontal snap rail of the other verified brands in the repo (LG, Casio, GP Batteries, Gigaset where already verified in research/company-profile.md and official/manifest) with library detail images, plus the official brands directory link.
- About GJH: dark band, official history composite or library 074, copy from verified facts, link to official About.
- Virtual Mall Concept: one dark full-bleed band using an existing mall concept image from demos/corporate/gjh/v11/assets (concept-*.webp), label "Virtual Mall Concept", link `../v11/`, no 3D script loaded.
- Sales Enquiry: replace the empty form with an enquiry SHEET (dialog/bottom sheet) that opens from any "Enquire" or the pill: brand chips (select), product text field, requirements, live preview of the message, "Copy details" (clipboard with read-only textarea fallback), "Open official contact" (new tab). No submit button, no success message, no claim of prefilling the official form; plain note to paste into the Message field. Also a static Sales Enquiry section near the end with the same component. Works without JS via direct official links.
- Footer: address 8 Gul Avenue, Singapore 629652, links (official contact, corporate sales, E-Shop), "Independent design concept, not affiliated with Goh Joo Hin." and "Imagery: AI-generated concept scenes (OpenAI ImageGen); product packshots and logos are official GJH assets."

## Type, colour, assets
System-first font stack (-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, "Segoe UI", Roboto, sans-serif); no font downloads. Mostly photographic colour; UI is white/near-black with ONE accent drawn from GJH's red (#d9261c family, check contrast) for actions. Runtime images <= 200 KiB webp each (library files are ~130-160 KiB), responsive <picture>, only the hero preloaded, the rest lazy.

## Verified copy and URLs
Use only the facts in demos/corporate/gjh/research/company-profile.md and docs/gjh-v20/implementation-plan.md ("Verified copy"): New Moon abalone/shellfish/soups/sauces; MILI canned fruit, vegetables, meat, seafood and sauces; GOGO drinks and potong ice cream; Sony appointed distributor for specified Sony ranges; Borsch Med health supplements and personal care; about = Rochor Road provision store in the 1940s. Official URLs (all HTTP 200 on 2026-11-18): gjh.com.sg/newmoon|mili|gogo|borsch-med/, gjh.com.sg/about-us/, gjhglobal.com/explore-our-brand/, gjhglobal.com/contact-us/, gjhglobal.com/corporate-sales/, gjheshop.com/shop/ and the New Moon 425g product URL.

## Acceptance
Hero fills one viewport at 1440x900 and 390x844 with H1 + both buttons visible; brand strip visible on the first phone screen; every chapter is image-led with text contrast >= 4.5:1; Enquire from any chapter opens the sheet with Brand populated; no horizontal overflow 320-1440; targets >= 44 px on phones; one h1; alt text; no console errors; reduced-motion and no-JS fully usable; LCP-friendly (hero preloaded); total initial transfer sensible; check_ssot passes.
