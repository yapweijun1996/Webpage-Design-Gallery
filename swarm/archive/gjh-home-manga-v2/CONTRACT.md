# Swarm contract: ONE page (home), 10 agents, live

A viewer stacks 10 section fragments into ONE page and hot-swaps each one whenever its files change. A manager (Claude) is watching live and may leave you instructions. Read `brief.md` for the business. Design tokens and components come from the Swarm Design System (SDS, folder `design-system/`, rules in `design-system/STANDARD.md`, API in `design-system/SDS_SPEC.md`). Never hard-code colors, font sizes, spacing, radii, durations or easings.

## Ownership (strict)
- You own exactly: `sections/NN-name.html`, `sections/NN-name.css`, and `notes/NN.md`. Touch nothing else. Never edit another agent's files. You may READ everything, including `inbox/NN.md` (manager messages for you).
- `NN-name.html` is a FRAGMENT: one root `<section class="s-NN" id="NN-name">` (the header may use `<header>`). No html/head/body, no scripts, no external requests, no web fonts.
- All CSS must be scoped under `.s-NN`. Assume `*{box-sizing:border-box}` and page background `var(--dc-bg)` are already set. Sections are full width; center content with `max-width: var(--dc-container)`.
- Anchors: every section root has id `NN-section` (see `sections/` file names, e.g. `#02-hero`). Link to other sections only with those ids.
- Placeholder imagery: inline SVG or CSS shapes only. Mark all sample data as "sample".

## SDS rules (checked by `node swarm/tools/check-sections.js <projectDir>`)
- Style only with `var(--sds-*)` tokens and `.sds-*` components. Colours come from the active theme (light, dark, auto) and brand (`forest-gold`, `gjh-classic`); a section never defines a colour. Need a new token? Say so in the channel, do not invent a literal.
- Every visible text node carries `data-i18n="<section>.<element>"` (English text stays inline). Reveal-on-scroll uses `data-reveal="fade|rise|scale"`. No `<script>`, no `!important`, no text in CSS.
- Your position, playbook and skill packs: read `staff/playbooks/<your-position>.md` and the handbook packs listed in your prompt (`staff/handbook/*.md`). Tool kit: `staff/tools.md`.

## Quality
Semantic HTML, one h1 on the whole page (only in hero), then h2 per section, visible focus (`--dc-focus`), tap targets >= `--dc-tap`, AA contrast in light and dark, reduced motion respected, works at 320px (mobile first), no horizontal scroll.

## Live narration (important)
The manager sees your messages live as a thought bubble next to your cursor. Before each major step write ONE short sentence (max 20 words) stating your design intent or what you notice in a neighbour's section, e.g. "Hero text is dense, so I'll shorten the sub line and widen spacing." No long reports in between.

## Rounds
- Round 1 (build): design your section from the brief. Write `notes/NN.md` (max 6 lines): what you built, the visual rhythm you chose.
- Round 2 (improve together): READ every `sections/*.html`, `sections/*.css` and `notes/*.md`. Improve YOUR section so the whole page flows: consistent spacing rhythm, no repeated copy, wording that follows the section above and sets up the one below, no clashing styles. Then append to `notes/NN.md` under `## Round 2`: what you changed and up to 2 concrete suggestions for named other sections.
- Round 3 (apply suggestions): read the notes' suggestions addressed to your section and `inbox/NN.md`, apply what you agree with, and record accepted/declined under `## Round 3`.

Final message (max 60 words): files written and one risk.

## Lanes
01 header: 52-56px translucent top nav (GJH logo, Brands, About, Contact, Shop Online; CSS-only mobile menu with details/summary) AND the persistent fixed action pill 'Sales Enquiry | Shop Online' (bottom bar on phones).
02 hero: exactly one viewport, full-bleed concept image with a dark scrim, the ONLY h1 'Explore Goh Joo Hin's Brands', one supporting sentence, buttons 'Explore Our Brands' and 'Sales Enquiry', and a glass brand strip docked at the bottom linking to chapters. Hero image: New Moon desktop hero 001 plus its mobile story.
03 newmoon: full-bleed chapter for New Moon (food and beverage eyebrow), giant brand name, one verified sentence, the exact product name, actions 'View Brand' and 'Enquire'. Pick the best New Moon scene from the library.
04 miligogo: two stacked full-bleed chapters, MILI then GOGO, each with eyebrow, giant name, one verified sentence, 'View Brand'. The two must feel different from each other and from New Moon, yet share the same type rhythm.
05 healthtech: two chapters, Borsch Med (health and nutrition) and Sony (appointed distributor, electronics and lifestyle). Calm and precise; no medical claims, no invented product specs.
06 morebrands: a horizontal scroll-snap rail of the other verified brands (LG, Casio, GP Batteries, Gigaset, Skippy, SPAM, Flying Wheel, GuLong, California Mexico, Hormel, Pien Tze Huang) with a library detail image where one fits, plus a link to the official brands directory. Not a tile grid of equal cards: use a clear lead item.
07 about: heritage band, Rochor Road provision store in the 1940s ('Since 1940'), using the official history composite or a fitting library image, verified copy only, link to the official About page.
08 mall: 'Virtual Mall Concept' dark full-bleed band using a mall concept image from the library, honest label that it is an independent concept, link to ../v11/ (the existing virtual mall demo), no 3D.
09 enquiry: static Sales Enquiry section: brand chips as radio inputs, a short buyer checklist (brand, product, quantity, delivery), and clear links to the official contact and corporate sales pages. No form submit, no fake success state, no claim of prefilling the official form.
10 footer: address 8 Gul Avenue Singapore 629652, links (official contact, corporate sales, E-Shop, About), the disclaimer 'Independent design concept, not affiliated with Goh Joo Hin.' and 'Imagery: AI-generated concept scenes; product packshots and logos are official GJH assets.' Quiet and well organized.
