# Brief: Goh Joo Hin (GJH) corporate home page

Independent design concept for Goh Joo Hin Pte Ltd (GJH), Singapore. Multi-brand distributor of food, health and electronics. It is NOT an official site: the footer must say "Independent design concept, not affiliated with Goh Joo Hin."

## Verified facts only (never invent)
- Origin: a provision store on Rochor Road in the 1940s (GJH prints "Since 1940"). No other dates, counts, awards, customers, testimonials or prices.
- House brands: New Moon (canned abalone, shellfish, soups, sauces; example product "New Moon Premium Wild Caught New Zealand Abalone 425g"), MILI (canned fruit, vegetables, meat, seafood, sauces), GOGO (drinks, potong ice cream), Borsch Med (health supplements, personal care).
- Appointed distributor: Sony (specified ranges). More brands: LG, Casio, GP Batteries, Gigaset, Skippy, SPAM, Flying Wheel, GuLong, California Mexico, Hormel, Pien Tze Huang.
- Address: 8 Gul Avenue, Singapore 629652.
- Official links (use as href): https://www.gjhglobal.com/explore-our-brand/ , https://www.gjhglobal.com/contact-us/ , https://www.gjhglobal.com/corporate-sales/ , https://www.gjheshop.com/shop/ , https://www.gjh.com.sg/about-us/ , https://www.gjh.com.sg/newmoon/ , https://www.gjh.com.sg/mili/ , https://www.gjh.com.sg/gogo/ , https://www.gjh.com.sg/borsch-med/
- Primary action "Explore Our Brands"; also "Sales Enquiry" (official contact page) and "Shop Online" (E-Shop).

## Direction (owner-approved bar)
Dark, cinematic, calm. ONE dominant full-bleed image per screen, huge tight type, minimal copy, one idea per viewport. Colour comes from the photography. Rejected: card-grid templates, collages of many small images, equal-weight tile grids. Mobile first: the owner tests on iPhone 393x844, so every section must be excellent at 393px, then scale up.

## Palette and type (this brief overrides the "no hard-coded colors" rule for brand colors only)
Near-black ink #0f1115 and #171a21 for dark bands, ivory text #f4efe4, ONE action accent GJH red #d9261c (hover #b81f16). Declare any color you need as a custom property at the top of your own `.s-NN` rule (for example `--gjh-red`). Spacing, radius, type scale and motion still come from `--dc-*` tokens. System font stack only (the tokens already provide it); large display type may use `clamp()`.

## Imagery (real library, read only)
Images are served at `/gjh/...`:
- Concept scenes (AI-generated editorial concepts): `/gjh/landing-concepts/images/NNN.webp` (98 files). Read `/Users/yapweijun/Documents/GitHub/Webpage-Design-Gallery/assets/companies/gjh/landing-concepts/manifest.json` for each id's group (New Moon, MILI, GOGO, ...), role (Desktop hero 1664x936, Mobile story 1120x1400, detail, cut-out) and brief. Pick the images that fit your section; use `<picture>` with a mobile story portrait and a desktop hero where both exist; lazy-load everything except the first screen.
- Official assets: `/gjh/official/gjh-logo.png`, `/gjh/official/gjh-history-composite.jpg`, `/gjh/official/gogo-brand-cover.jpg`, `/gjh/official/borsch-med-logo.jpg`. Do not invent logos for other brands: use plain wordmark text.
- Concept scenes need a small visible caption: "AI concept illustration".
- Always give images alt text and explicit width/height to avoid layout shift.

## Interaction limits
No JavaScript in fragments. CSS only: `scroll-snap`, `:hover/:focus-visible`, `details/summary`, `:target`, radio-input chips, `@supports (animation-timeline: view())` reveal with a fully visible fallback. The persistent bottom-right pill "Sales Enquiry | Shop Online" belongs to the header agent and stays fixed (position: fixed, bottom bar on phones, >= 44px targets).
