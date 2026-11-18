# Goh Joo Hin v21 · Product exhibition

Design proposal for the independent English corporate landing page. The two anchors share one direction. The desktop image is 1440 × 4184 and the mobile image is 390 × 5254. The enquiry panel shows the state after a visitor selects **Enquire** on the featured product.

[Desktop mockup](mockups/desktop-1440.png) · [Mobile mockup](mockups/mobile-390.png) · [Planning brief](planning-brief.md) · [Verified copy, destinations and enquiry contract](v20-reference-plan.md)

## Visual system

The company title and a ruled strip of five brands lead into a product exhibition. The New Moon packshot sits on a white mount in front of sculpted paper. The actual packaging and brand marks carry the colour. Rounded tiles and alternating white and pale-grey bands give each part of the journey a distinct place in the scroll.

### Type

Local font stack: `Arial, "Segoe UI", Roboto, "Liberation Sans", sans-serif`. The anchors use locally installed Arial. Use regular 400 and bold 700 with no font requests. Values are size / line height in CSS pixels.

| Role | Desktop | Mobile | Weight and tracking |
| --- | --- | --- | --- |
| Page title | 75 / 79 | 44 / 47 | 700, −3.5 / −1.85 px |
| Hero title | 62 / 66 | 41 / 45 | 700, −2.7 / −1.55 px |
| Section heading | 50 / 54 | 33 / 37 | 700, −1.6 / −0.9 px |
| Featured product title | 43 / 47 | 24 / 26 | 700, −1.25 / −0.44 px |
| Brand title | 30 / 34 | 25 / 29 | 700, −0.47 px |
| Lead and section body | 18 / 26 | 16 / 22 | 400 |
| Card body | 16 / 21 | 15 / 19 | 400 |
| Nav, controls and fields | 14–16 / 20–24 | 13–15 / 18–20 | 700 for labels and actions, 400 for field values |
| Strip names, captions and footer | 11–14 / 16–20 | 11–13 / 16–18 | 700 for names and captions, 400 for footer copy |

### Colour

| Role | Hex |
| --- | --- |
| Paper, brand cards and controls | `#FFFFFF` |
| Alternating bands | `#F5F5F6` |
| Hero matte | `#EEEEF0` |
| Directory surface | `#FBFBFC` |
| Primary text | `#202024` |
| Body text | `#49484F` |
| Muted text | `#5C5B63` |
| Decorative rules and tile borders | `#D9D8DE` |
| Control outlines | `#85838E` |
| Sony and Mall charcoal | `#242328` |
| Dark image well | `#34333A` |
| Dark tile secondary text | `#DFDEE4` |
| **Single UI accent · ink plum** | `#623D78` |

Use ink plum for filled primary actions, outlined secondary actions, tertiary chevrons and text links on light surfaces. The active category pill is charcoal with white text. Dark tiles use inverse neutral controls. Hover and pressed states can change the border weight or underline. Use a 2 px plum focus ring with a 2 px offset on light surfaces and a white ring on dark surfaces.

### Spacing and shape

Use a 4 px baseline and the steps 4, 8, 12, 16, 20, 24, 32, 48, 64 and 96 px. At 1440 px, use a 1248 px content width, 96 px margins and a 24 px tile gap. At 390 px, use 20 px gutters and 12–16 px gaps between cards. Give sections roughly 64–96 px vertical breathing room on desktop and 40–48 px on mobile. At tablet sizes, use two brand columns while each card can support the full copy and its two actions. Use one column when it cannot. Keep 16 px edge gutters at 320 px.

Large tiles use 28 px corners on desktop and 24 px on mobile. Insets use 16–20 px, fields 12 px and pills a full radius. Centre the authentic brand marks in equal-width white cells with hairline dividers. Space logos and names so that each can be read at the mobile size without increasing the bar height. The fixed-height header is about 66 px on desktop and 64 px on mobile.

### Tile anatomy

- **Hero.** A two-part tile with the brand name, one line of product-category copy and two pills beside a studio image. Stack the copy and pills above the image on mobile. An image caption identifies the generated backdrop.
- **Brand.** Shallow inset photograph or official logo mat, category label, brand name, category description and **View Brand** / **Enquire**. Give the content below the image enough height for a two-line description and independent button hit areas. Sony is the dark tile in the brand grid. The directory is a quiet standalone tile at the end.
- **Featured product.** White product mat, exact SKU heading and **View Product** / **Enquire**. Stack in image-first order on mobile. The inline **Featured product** section heading gives the SKU room to wrap.
- **About and Mall.** Two different sections with a shared image-led structure. About uses the sourced heritage composite on pale grey. The Mall uses charcoal with a labelled concept image and one local link.

### Motion

Use a one-time 480 ms reveal from 12 px down with an ease-out curve and opacity 0.85 → 1. The two desktop grid rows may stagger by 60 ms per tile, capped at 120 ms. The header, first-screen brand strip, hero and enquiry controls render immediately. Keep every section fully visible by default. Motion is an enhancement after intersection support is ready. A focus or anchor jump finishes the reveal immediately, including when opening a card through the brand strip. Under `prefers-reduced-motion: reduce`, show the final state immediately and use instant scrolling. Keep the header available during scroll with a solid white fallback for a translucent band. Account for its height when placing anchor targets.

## Section map and copy

| Order | Section | Content and action |
| --- | --- | --- |
| 1 | Global nav | Official GJH logo to the page top. **Brands**, **About** and **Contact** jump to their page sections. **Shop Online** opens GJH E-Shop. Mobile exposes Shop Online and a **Menu** that expands the other links. |
| 2 | Title and brand strip | **Explore Goh Joo Hin's Brands**. “Discover our food and beverage, lifestyle, and healthcare brands. Get in touch for product sourcing and business enquiries.” Show New Moon, MILI, GOGO, Sony and Borsch Med in that order, each with the verified mark, visible name and a separate **Enquire** action. The mark and name link to the matching brand tile. |
| 3 | New Moon | “Abalone, shellfish, soups and sauces.” **Explore Our Brands** jumps to the grid and **Sales Enquiry** jumps to the enquiry panel, which starts empty on first visit. |
| 4 | Brands & Categories | **All**, **Food & Beverage**, **Lifestyle**, **Healthcare**. Each card opens its official brand page and offers a brand-specific enquiry. **View Full Brand Directory** opens the official directory. |
| 5 | Featured product | **New Moon Premium Wild Caught New Zealand Abalone 425g**. **View Product** opens the GJH E-Shop listing. **Enquire** prepopulates the named brand and exact SKU. |
| 6 | About GJH | “Goh Joo Hin began as a provision store on Rochor Road in the 1940s. Its distribution business covers food and beverage, lifestyle and healthcare.” **About Us** opens the official About page. |
| 7 | Virtual Mall Concept | Static, labelled architectural preview. **Explore the Virtual Mall** opens `../v11/`. |
| 8 | Sales Enquiry | Visible **Brand**, **Product** and **Requirements** fields, **Copy Enquiry Details**, and **Open Official Contact**. “Paste the brand, product and requirements into the Message field on the official contact page.” |
| 9 | Footer | Goh Joo Hin Pte Ltd. 8 Gul Avenue, Singapore 629652. Links to Brands, About Us, Virtual Mall Concept, Official Contact, Corporate Sales and Shop Online. Exact notice: “Independent design concept, not affiliated with Goh Joo Hin.” |

| Brand | Filter | Card copy | Destination |
| --- | --- | --- | --- |
| New Moon | Food & Beverage | Abalone, shellfish, soups and sauces. | [Official brand page](https://www.gjh.com.sg/newmoon/) |
| MILI | Food & Beverage | Canned fruit, vegetables, meat, seafood and sauces. | [Official brand page](https://www.gjh.com.sg/mili/) |
| GOGO | Food & Beverage | Drinks and potong ice cream. | [Official brand page](https://www.gjh.com.sg/gogo/) |
| Sony | Lifestyle | Appointed distributor for specified Sony product ranges. | [Official brand page](https://www.gjhglobal.com/sony/) |
| Borsch Med | Healthcare | Health supplements and personal care. | [Official brand page](https://www.gjh.com.sg/borsch-med/) |

Official supporting destinations are [Brand Directory](https://www.gjhglobal.com/explore-our-brand/), [View Product](https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/), [About Us](https://www.gjh.com.sg/about-us/), [Official Contact](https://www.gjhglobal.com/contact-us/), [Corporate Sales](https://www.gjhglobal.com/corporate-sales/) and [Shop Online](https://www.gjheshop.com/shop/). External destinations open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`. Announce the new tab accessibly. The v8 Sony asset receipt and v18 brand-destination entry supply the Sony URL omitted from the v20 URL list. The official Sony page also appeared in the live search index. [Official Sony page, indexed host](https://gjhglobal.com/sony/)

## Mobile journey and enquiry states

1. At 390 × 844, all five brands and their Enquire actions fit above the hero. The strip spans y=314–427 in the anchor. The New Moon hero actions also fit in the first viewport. At narrower widths or larger text sizes, use a locally scrolling strip with proximity snap and focus-driven scrolling. Keep the same DOM order and expose the next item with a partial cell where possible.
2. **New Moon** focuses the matching card heading. **View Brand** opens the verified New Moon page. The visitor can also continue down to **View Product** to confirm the exact SKU. A brand tile or chip **Enquire** sets Brand and moves focus to the Sales Enquiry heading. A featured product **Enquire** sets both Brand and Product. A brand-only action clears a product previously set by an action for a different context. Keep requirements the visitor has already entered.
3. **Copy Enquiry Details** copies the Brand, Product and Requirements as plain text. If clipboard access fails, including inside the gallery iframe, present the same content in a read-only textarea with an explicit **Select All** control. Preserve entered data on copy failure.
4. **Open Official Contact** opens the official contact page and the visible note tells the visitor to paste into **Message**. The handoff ends at that link. The official operator receives an enquiry only after the visitor sends it there. Count the outbound click as a contact click. With JavaScript off, make all brand cards and official links reachable, expose the mobile navigation, and keep the official contact and manual copy instructions visible.

The filtered grid defaults to **All**. Use one pressed filter at a time, announce the result count politely and keep focus on the control. A strip link to a currently hidden card restores **All** before moving focus. View and Enquire remain separate targets, including on the strip. The Product field is editable free text and can grow to two lines on mobile so the 425g SKU stays readable.

## Accessibility and implementation acceptance

- Use one H1, ordered H2/H3 headings, landmarks, a skip link and native links and controls. Provide distinct accessible names such as **Enquire about New Moon** wherever the visible label repeats. Use persistent form labels. Restore the mobile menu trigger's focus on dismiss and keep sticky chrome clear of focused controls.
- Give interactive elements a 44 × 44 CSS px minimum target on mobile, including the strip, footer links and filter pills. Each strip cell at 390 px is 70 px wide, with a 69 px mark/name target and a separate 44 px Enquire target. Small captions and footer type can retain their visual scale; use the surrounding space for the target.
- Resolve document reflow at 320, 390, 768 and 1440 px with horizontal scrolling limited to the brand strip when needed. Plan for keyboard navigation and text zoom. Maintain an explicit focus indication and an underline or equivalent non-colour state cue.
- Calculated solid-colour contrast is 16.24:1 for ink on white, 8.30:1 for body on pale grey, 6.15:1 for muted text on pale grey, 8.54:1 for white on plum, 7.37:1 for plum on the hero matte, 11.67:1 for secondary text on charcoal and 3.42:1 for control borders on pale grey. Use 4.5:1 for ordinary text and 3:1 for large text and meaningful component boundaries. Place generated-image captions on solid surfaces.
- Use empty alt text for a brand mark with an adjacent matching name. Name the corporate logo link, identify the featured 425g pack, and describe the heritage visual as an official website composite. The visible **AI-generated concept** caption provides the attribution for each decorative scene. Use a decorative image alternative when the adjacent text and caption carry all the meaning.
- Verify the official destinations, direct brand entry from mobile, exact brand and product prefill, iframe clipboard fallback, the no-JavaScript links and reduced-motion behaviour in the eventual build. Compare real 1440 and 390 screenshots with these anchors, review 320/768 reflow, check keyboard and screen-reader states, confirm page weight comparable to v19 and run the repo gallery and demo checks after implementation. Load the Mall route only when a visitor follows the link.

## Asset inventory

Official entries were checked against repo receipts. Official provenance supports use in this independent design proposal. Current packaging and separate publication approval remain to be confirmed.

| Role | Repo path | Provenance |
| --- | --- | --- |
| GJH corporate mark | `assets/companies/gjh/official/gjh-logo.png` | Real official artwork, verified canonical hash and v6/v8 receipts. |
| New Moon mark | `demos/corporate/gjh/v11/assets/brands/S01-new-moon.webp` | Real repo raster derivative of the official New Moon SVG listed in v11 `logo-sources.json`. The source SVG is also at `assets/companies/gjh/official/new-moon-logo.svg`, recorded in v6/v8. |
| MILI mark | `assets/companies/gjh/official/mili-logo.jpg` | Real official GJH brand tile, verified canonical hash and v6/v8 receipts. |
| GOGO mark | `assets/companies/gjh/official/gogo-logo.jpg` | Real official GJH brand tile, verified canonical hash and v6/v8 receipts. |
| Sony mark | `demos/corporate/gjh/v8/assets/sony-brand.jpg` | Real official GJH Sony brand tile, verified v8 hash and project-use receipt. Used as a logo cue. |
| Borsch Med mark | `assets/companies/gjh/official/borsch-med-logo.jpg` | Real official GJH brand tile, verified canonical hash. Its source is corroborated by v11's S04 receipt. |
| Hero and featured 425g packshot | `assets/companies/gjh/official/new-moon-nz-425g-front.jpg` | Real official GJH E-Shop product image, verified canonical hash and v6/v8 receipts. Cropped to the authentic front pack within the page design. |
| New Moon, MILI and GOGO card imagery | `assets/companies/gjh/official/new-moon-brand-cover.jpg`, `assets/companies/gjh/official/mili-brand-cover.jpg`, `assets/companies/gjh/official/gogo-brand-cover.jpg` | Real GJH brand photography, verified canonical hashes and v6/v8 receipts. Shallow editorial crops. |
| Borsch Med card imagery | `demos/corporate/gjh/v8/assets/borsch-med-quality.png` | Real official lifestyle image, verified v8 hash. Used to illustrate the brand. |
| About visual | `assets/companies/gjh/official/gjh-history-composite.jpg` | Real official website composite with a baked-in year graphic, verified canonical hash and v8 receipt. Caption and alt text identify the composite. |
| Hero paper and plinth | Embedded in both `mockups/*.png`. Standalone ImageGen original `exec-9a977cfa-2379-4a5c-84e2-0c4e42f03749.png`. | AI-generated concept. Blank studio scene composited with the real packshot. |
| Virtual Mall atrium | Embedded in both `mockups/*.png`. Standalone ImageGen original `exec-d6e6a5cb-4aaa-4882-8589-5984599aef9d.png`. | AI-generated concept. Fictional architectural visualisation. |

Receipts: [canonical official manifest](../../assets/companies/gjh/official/manifest.json), [v6 sources](../../demos/corporate/gjh/v6/assets/sources.json), [v8 sources](../../demos/corporate/gjh/v8/assets/sources.json), [v11 logo sources](../../demos/corporate/gjh/v11/assets/brands/logo-sources.json) and [v18 destinations](../../demos/corporate/gjh/v18/assets/sources.json).

### ImageGen production

The built-in ImageGen tool produced independent desktop and mobile layout studies from the same brief. The production prompts specified a vertically scrolling portfolio with a title-first brand chooser, ink-plum pills, empty mats for official assets, a paper-plinth hero, a charcoal Mall tile and the official-contact handoff. Two separate ImageGen calls supplied the final decorative art: “unbranded studio still life, sharply art-directed pleated grey paper fan … shallow matte light grey circular stage or plinth” and “unbranded … curving two-level retail atrium … bold sweeping arcs … deep graphite shadows.” Both scenes are visibly labelled **AI-generated concept**. Final raster assembly set the type and dimensions and placed the original brand assets. The standalone art originals are in the ImageGen output directory identified by `01a1ed16-9144-7dc1-92aa-708f0584b577`. For implementation, export each standalone decorative image as WebP at no more than 120 KiB. The page mockups are the layout reference.

## Design distinction

**Apple study.** The measured reference contributed compact chrome, a chooser above the product feature, one subject per visual, a limited action palette, generous band rhythm and paired pills. v21 uses a left-aligned company heading, five commercially distinct identities, category filters, a synthetic paper display, an authentic grocery packshot, a Singapore history block and a buyer handoff. The GJH copy and official brand assets pair with original decorative imagery and locally installed Arial. [Measured study](apple-study.md)

**v20.** The verified plan describes a Modern Portfolio with a product-led hero followed by a **Find a brand** chip row. v21 puts the corporate heading and five dual-action logo cells first, then the New Moon exhibition tile. The two-size layout uses quiet ruled cells, neutral exhibition mats, a single plum action colour and one product as the visual anchor. The business content and enquiry contract come from the v20 plan. The visual comparison uses that plan as evidence because the original v20 visual anchors are absent in this checkout. [v20 reference plan](v20-reference-plan.md)

| Repo editions inspected | Distinction in v21 |
| --- | --- |
| v1 Corporate Clarity, v5 Heritage Editorial, v6 Portfolio Modern, v7 Signature Dark | v1 opens with business categories and lifestyle imagery, v5 with heritage-led editorial photography, v6 with a pale-sage multi-origin pack comparison and v7 with a dark partnership narrative. v21 opens with a white brand selector and a single mounted product. |
| v8 Generations of Goodness, v9 Virtual Stores, v10 Virtual Stores 3D, v11 Virtual Mall | These use a cinematic story, storefronts, an arcade or a visitor arrivals panel as their entry. v21 opens with brand and SKU browsing and gives the Mall one later destination. |
| v12 The Shared Table, v13 The Connection, v14 The Goodness Table, v15 Everyday, In Colour | These open as a family story, a broadsheet, a historical exhibit or a field guide. v21 starts with literal brand names and a continuous modular gallery. |
| v16 The Everyday Collection, v17 Pantry Notes, v18 Everyday Frequencies, v19 The Partner Desk | These lead with a luxury editorial feature, a culinary journal, a record-sleeve channel selector or a buyer brief. v21 keeps its first screen brand-led, and the enquiry workspace sits after browsing and the company sections. |

All 16 available editions were inspected through their repo thumbnails and metadata. The current tree and local Git refs contain no v2, v3 or v4 demo paths or v20 visual anchors, so those comparisons are unverified.

## Verification status

The two PNG dimensions, full section sequence, first-screen mobile brand access in the image, verified source assets and calculated token contrast were checked at design time. The single-column grid and its long brand descriptions were reviewed at 390 px. The existing gallery consistency check and all 14 gallery unit tests passed. The contact handoff, motion, hit areas, semantics, links in the implemented page, cross-device reflow, browser behaviour and brand approval remain unverified until implementation, testing or approval.
