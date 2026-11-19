# GJH v24 — Luxury Digital Experience

Independent design concept for Goh Joo Hin Pte Ltd. It is not affiliated with or endorsed by GJH.

The [live demo](../../demos/corporate/gjh/v24/index.html) has six pages: Home, About, Brands, Business, Virtual World and Contact. The owner's approved mockups are the design anchors: the [home desktop mockup](mockups/approved-home-desktop.webp) and the [six-page board](mockups/approved-six-page-board.webp). The home mockup is also the edition's primary reference in the [style atlas](../../style-atlas/index.html#gjh-v24).

## Design system

| Area | Decision |
| --- | --- |
| Colour | Obsidian Black `#080808`, Champagne Gold `#D9B477` and Ivory White `#F5F0E8`, with raised and card obsidians, a deep gold and two muted ivories. All of them are `v24` tokens in `design-system/themes.json`, which generates `assets/theme.css`. Demo CSS uses `var()` only, so `scripts/check_ssot.py` reports no new debt. |
| Type | Instrument Serif headings with a gold gradient fill, and Manrope body text. Both fonts are local OFL files (no font CDN). |
| Icons | Local SVG sprite `assets/icons.svg` (32 symbols). The shapes follow Lucide (ISC); the VR headset is an original drawing. No icon font or emoji. |
| Motion | Cinematic reveal (fade, rise, de-blur), hero parallax, gold hover glow and lift on cards, and cross-document page transitions through `@view-transition`. `prefers-reduced-motion` turns off every animation and shows content immediately. |
| Layout | Full-bleed hero, a fixed transparent header that turns to glass on scroll, wide section spacing, gold-lined cards and the same footer on every page. Breakpoints are at 1180, 900 and 600 px. |

Shared components live in `style.css` and `script.js` (header, mobile menu, reveal, parallax). Each page adds only its own layout in `assets/page-*.css`, plus optional behaviour in `assets/page-*.js`.

## What changed from the mockups and why

The mockups contain content that the brief forbids: invented business claims, brands and contact details. The pages keep the composition and swap in sourced facts from the [company profile](../../demos/corporate/gjh/research/company-profile.md) and the [brand register](../gjh-multibrand-directory.md).

| Mockup content | v24 replacement |
| --- | --- |
| Brands "Pomelo STEM", "GJH Mall", "GJH Store", "GJH Tech", "GJH Lifestyle"; Education and Digital categories | Directory of the 17 names on GJH's corporate and eShop channels. They fall into three categories, and each name has a relationship label (house brand, managed and distributed, listed brand or distribution milestone) with a cited source. |
| "10+ Brands / 2 Countries / 100K+ Customers" | 1940s Rochor Road store, New Moon in 1959, 17 listed brands and 10 named markets on Home; 3 categories, 17 brands, 10 markets and 2 offices on Business. |
| `contact@gjh.com`, `+65 6123 4567`, business hours, four social icons | The verified 8 Gul Avenue address, the Senai (Johor) office, the official contact and corporate-sales pages, the eShop and LinkedIn. No phone, email or hours are shown. |
| Mission, vision and values | Shown with a visible note: "Proposed wording for GJH review — not an official statement". |
| "Send Message" form | "Prepare enquiry". There is no backend, so after validation the page explains that the enquiry has not been sent. It offers copy and a link to the official form, and never shows a fake "Message sent". |
| "GJH" lettering on the building, bag and globe | Generated images contain no lettering or logos. Only the official logo files from earlier editions are shown. |

## Imagery

Codex CLI's built-in image tool generated eight images: six page heroes, an illustrative 1940s provision store and the chibi visitor. Each hero ships as 1600 px wide, 960 px medium and 750×1000 portrait WebP files, 10–125 KB each. `assets/sources.json` records every file's hash, size, source and prompt. The brand mood photos, rails, logos and the mall concept are reused from v22, and their provenance records are copied with them. Every AI image on the page is labelled "Concept image · AI-generated" or "Concept art". The provision store is captioned as an illustration, not an archival photograph.

## Architecture and performance

- **Multi-page edition.** `scripts/build_gallery.py` now ships every top-level `*.html` file in a demo directory, so the five extra pages are published and precached by the edition's generated `sw.js`. Existing single-page demos are unaffected.
- **3D on request only.** No corporate page loads WebGL, GLB files or the mall bundle. Virtual World checks WebGL support with a throwaway context, then links to the existing [v11 mall](../../demos/corporate/gjh/v11/index.html). A browser test recorded no `/v11/` or model requests before entry.
- **Fast first paint.** Only the hero image and serif font are preloaded. All other images are lazy and async, with explicit dimensions.
- **Phone header.** `src/demo-pwa.js` turns the header into a phone reading header that hides on scroll. v24 keeps the header fixed and transparent over the hero and adopts only the hide-on-scroll behaviour.

## Acceptance checklist

| Criterion | Evidence |
| --- | --- |
| Six complete, consistent pages | One header, footer and token set on every page. Full-page captures at 1440 and 390 px were reviewed against the mockups. |
| Navigation, buttons, forms and filters work | Browser E2E checked:<br>- Brands: category filter (3 health, 9 food, all 17), `?category=` deep link, search, empty state and reset, the brand dialog with Escape and focus return, and `#brand-search` focus.<br>- Contact: `?topic=` preselection, 4 invalid fields with an alert summary, and a success state that does not claim delivery.<br>- Virtual World: the preview dialog opens and closes, and the entry link targets the v11 mall. |
| Brand data verified | Every brand fact and figure cites the research files above. |
| No overflow or clipping | `scrollWidth - innerWidth = 0` on all six pages at 1440 and 390 px. The mobile menu and hero were fixed during review. |
| No critical console errors | None on any page. Before generation, the only error was the missing `sw.js`. |
| Reduced motion and keyboard | Reduced-motion captures show all content. The first Tab reaches "Skip to content". Dialogs trap focus and restore it. The menu closes on Escape. |
| 3D does not slow corporate pages | No 3D requests before the user enters. |

## Remaining limitations

- No physical-device, screen-reader or field Core Web Vitals measurement has been made yet. The checks above use desktop Chrome with phone-width emulation.
- The Senai office street address, a phone number and an email address are not in the verified research, so the page links to the official contact page instead.
- Brand photographs are AI concept imagery from the shared library, not GJH photography. Logos come from low-resolution official files.
- The mission, vision and values wording is a proposal that needs GJH's approval.
