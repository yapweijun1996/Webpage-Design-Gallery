# Premium landing page study: five GJH concepts

These five independent concepts explore different ways to present the same Singapore company. They are design studies, not official Goh Joo Hin (GJH) websites, and do not imply affiliation or endorsement. The references below informed design principles, not copied layouts. The pages are intended for comparison and discussion, not as evidence of user preference or conversion performance.

## Reference study

| Reference | What to study | Application to these concepts |
| --- | --- | --- |
| [Aesop](https://www.aesop.com/) | The relationship between a restrained brand voice, deliberate product groupings, and clear paths into categories. Its homepage gives each collection a focused role instead of explaining everything at once. | Use generous space and a concise brand introduction before introducing the portfolio. V14 and V16 apply a slower editorial rhythm in different palettes. |
| [Apple AirPods Pro](https://www.apple.com/airpods-pro/) | Short, benefit-led headlines followed by focused sections that progressively explain a product. Observe how information hierarchy directs attention from the proposition to supporting detail. | Lead with one clear statement, then reveal story, brands and a next action. V13 applies this principle to a corporate relationship narrative rather than imitating a product page. |
| [The Modern House Journal](https://themodernhouse.com/journal) | Editorial content is organised into identifiable stories and categories. Photography, headings and brief summaries make a collection browsable. | Give imagery and typography different roles: V12 uses a magazine-like opening; V16 treats selected brands as a curated collection. |
| [Patagonia: Our Footprint](https://www.patagonia.com/our-footprint/) | A strong point of view is followed by distinct paths to supporting information. Specific claims have context instead of functioning as decoration. | V14 connects its heritage narrative to an official source. Avoid invented numbers or unsupported environmental claims when creating a premium brand story. |
| [GJH: About Us](https://gjhglobal.com/about-us/) and [New Moon](https://www.gjhglobal.com/newmoon/) | The company's own account describes its Rochor Road beginnings in the 1940s and New Moon's portfolio. | Ground company history and product references in the official sources while making clear that the concepts are independent. |

These observations concern structure and presentation; they do not establish that any reference layout performs better for GJH. Apply the principles with original compositions, accessible content, and assets approved for their intended use.

## Five directions

| Concept | Palette and composition | What to review |
| --- | --- | --- |
| [V12 — The Shared Table](../demos/corporate/gjh/v12/) | Warm ivory and terracotta, expressive serif type and an editorial story opening. | Does the shared-meal narrative feel inviting? Is the large hero image an appropriate introduction to the wider company? |
| [V13 — The Connection](../demos/corporate/gjh/v13/) | Deep navy and soft mint with a contemporary corporate and partnership emphasis. | Does the message make the business relationship and next action clear to a prospective partner? |
| [V14 — The Goodness Table](../demos/corporate/gjh/v14/) | Forest green and sand, a split hero, spacious serif typography and a heritage-led story. | Is the restrained pace suitable for the company? Does the food-led opening represent the wider portfolio well enough? |
| [V15 — Everyday, In Colour](../demos/corporate/gjh/v15/) | Cobalt, ochre and cream; a colourful mosaic opens into an indexed brand portfolio. | Does the bolder colour system improve recognition without competing with the brands' own marks? Compare its dense first impression with V14. |
| [V16 — The Everyday Collection](../demos/corporate/gjh/v16/) | Deep plum, blush and pale stone; a curated collection and contemporary editorial presentation. | Does the hierarchy make individual brands easy to scan? Compare its product emphasis with V12's shared-moment opening. |

## How to review

Serve the repository from its root with `python3 -m http.server 8000` and open `http://localhost:8000/`. Choose Goh Joo Hin, select two versions and open the comparison. The direct links in the table work when this document is viewed as part of the repository; the demo URLs can also be opened directly from the local server. Compare at desktop and phone widths, then follow the primary action and brand links. Test with keyboard navigation and reduced motion as well as a pointer.

Evaluate each direction against the same questions: Can a first-time visitor identify the company and its audience? Is the primary action clear? Can they understand the portfolio without relying on colour alone? Are typography, image placement and section rhythm comfortable at narrow widths? Which design conveys the desired tone without obscuring the facts? A preference is a starting hypothesis; validate it with intended visitors before treating it as a business result.

## Image and accessibility boundaries

V12's family-dining hero is an AI-created concept illustration, not a documentary photograph or evidence of a real GJH event. Official brand images and the historical composite come from GJH's website; the historical composite is not an original archive scan. The `assets/sources.json` files in each demo record asset provenance and applicable font licensing. Existing project use of official imagery was authorised for this study; production publication requires confirming current rights, asset quality and brand approval for that use.

Keep text and controls legible against their backgrounds, preserve focus indicators, avoid relying only on colour, and respect reduced-motion preferences. [W3C's contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) specifies 4.5:1 for normal text and 3:1 for large text at WCAG AA; [its motion guidance](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html) explains how to honour reduced-motion settings. These are design goals, not a claim that every combination or assistive technology has been certified.
