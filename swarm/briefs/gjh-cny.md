# Brief: Goh Joo Hin (GJH) corporate home page, CHINESE NEW YEAR edition

Independent design concept for Goh Joo Hin Pte Ltd (GJH), Singapore. Multi-brand distributor of food, health and electronics. It is NOT an official site: the footer must say "Independent design concept, not affiliated with Goh Joo Hin."

## Verified facts only (never invent)
- Origin: a provision store on Rochor Road in the 1940s (GJH prints "Since 1940"). No other dates, counts, awards, customers, testimonials, prices, discounts, promotions, campaign dates or opening hours. The festive edition adds NO commercial claims: it is a seasonal look and greeting only.
- House brands: New Moon (canned abalone, shellfish, soups, sauces; example product "New Moon Premium Wild Caught New Zealand Abalone 425g"), MILI (canned fruit, vegetables, meat, seafood, sauces), GOGO (drinks, potong ice cream), Borsch Med (health supplements, personal care).
- Appointed distributor: Sony (specified ranges). More brands: LG, Casio, GP Batteries, Gigaset, Skippy, SPAM, Flying Wheel, GuLong, California Mexico, Hormel, Pien Tze Huang.
- Address: 8 Gul Avenue, Singapore 629652.
- Official links (use as href): https://www.gjhglobal.com/explore-our-brand/ , https://www.gjhglobal.com/contact-us/ , https://www.gjhglobal.com/corporate-sales/ , https://www.gjheshop.com/shop/ , https://www.gjh.com.sg/about-us/ , https://www.gjh.com.sg/newmoon/ , https://www.gjh.com.sg/mili/ , https://www.gjh.com.sg/gogo/ , https://www.gjh.com.sg/borsch-med/
- Primary action "Explore Our Brands"; also "Sales Enquiry" (official contact page) and "Shop Online" (E-Shop).

## Chinese New Year direction (this REPLACES the dark cinematic and manga directions)
A joyful, premium Chinese New Year look for a Singapore food and consumer brand family: the reunion table, abalone and mandarin oranges, red lanterns, gold, paper-cut and couplet (chun lian) motifs, warm festive light. Bright and celebratory but refined, not clip-art. One dominant image per screen, huge tight type, minimal copy, one idea per viewport. Greeting lines allowed in Chinese and English: 新年快乐 / Happy Chinese New Year, 恭喜发财 / Gong Xi Fa Cai, 阖家团圆 / Family reunion. Mobile first: the owner tests on iPhone 393x844, so every section must be excellent at 393px, then scale up. Must work in light and in dark theme.

## Palette and type (SDS)
New SDS brand theme `cny-red-gold` (agent 01 or the manager adds it to `design-system/tokens.json` through the SDS build, never a colour literal in a section): lucky red #c8102e family as the primary surface/accent, imperial gold #d4a017 / #f2c14e for actions and ornaments, warm ivory #fff7e6 text surfaces, deep maroon #4a0d14 for contrast bands. Contrast must pass WCAG AA (check with tools/contrast.js). Type: strong sans for headings, Chinese headings with a refined serif/Kai feel where a Chinese font stack is available (system font stacks only, no web font downloads), tight tracking.

## Imagery
Primary source: generate festive scenes with the OpenAI image API through `node swarm/tools/gen-image.js --name NN-section-slug --prompt "..."` (the server holds the key; never ask for or print any key). Use gpt-image-2.6-flare style quality: photographic, warm, no text, no logos, no real brand packaging invented; real brand names appear only as live text in the page. Each generated image must be saved as webp under 200 KB and 1600+ px wide for hero images (the tool compresses). Secondary source: the read-only GJH library at `/gjh/...` (concept scenes, official logo `/gjh/official/gjh-logo.png`; see `/Users/yapweijun/Documents/GitHub/Webpage-Design-Gallery/assets/companies/gjh/landing-concepts/manifest.json`). Concept and generated scenes need a small visible caption "AI concept illustration". Always give images alt text and explicit width/height.

## Interaction limits
No JavaScript in fragments. CSS only: `scroll-snap`, `:hover/:focus-visible`, `details/summary`, `:target`, radio-input chips, `@supports (animation-timeline: view())` reveal with a fully visible fallback. Festive motion (gently swaying lantern, gold shimmer) must respect `prefers-reduced-motion`. The persistent bottom pill "Sales Enquiry | Shop Online" belongs to the header agent and stays fixed (bottom bar on phones, >= 44px targets).
