# GJH v22 Brand Chapters

Design and implementation · 18 November 2026 · baseline `a8ecaefb`

[Design brief](design-brief.md) · [Planning brief](planning-brief.md) · [Apple study](apple-study.md) · [Company profile](../../demos/corporate/gjh/research/company-profile.md) · [Verified v20 copy](../gjh-v20/implementation-plan.md#verified-copy-use-exactly-do-not-invent)

## Review the mockups

| File | Review at |
| --- | --- |
| [Desktop full page](mockups/desktop-1440.png) | 1440 × 7869. The first 900 px form the hero. Each of the five brand chapters adds 900 px. |
| [Mobile full page](mockups/mobile-390.png) | 390 × 7214. The first 844 px contain the hero, both buttons, the brand strip and the bottom action bar. Each brand chapter adds 844 px. |
| [Desktop enquiry](mockups/enquiry-sheet-desktop.png) | 1440 × 900. Two-column dialog over the New Moon chapter. |
| [Mobile enquiry](mockups/enquiry-sheet-mobile.png) | 390 × 844. Bottom sheet showing the same enquiry and both final actions. |

The full-page PNGs show the fixed actions at their first-viewport position. The mobile brand strip and More brands rail show their unscrolled positions, with further items reachable horizontally in the implementation. The sheet shows a sample sourcing enquiry for 48 cans.

## Layout and type

- Desktop uses 12 columns, a 24 px gap and `clamp(24px, 5.28vw, 76px)` side gutters. At 1440 px the inner width is 1288 px. The brand strip is 912 px wide and shares the lower edge with a 352 px action pill, with 24 px of horizontal clearance. At 1280 px and below, the actions use a full-width bottom bar and the hero reserves space above it. Most copy sits over the photo on the left. Borsch Med uses the right.
- Phone uses four columns, a 12 px gap and `clamp(16px, 5.13vw, 20px)` side gutters. The fixed header is 56 px desktop and 54 px phone. The hero has a `100svh` minimum and can grow when enlarged text requires more room. The five chapters are at least `100svh`. The bottom bar reserves 64 px plus the safe-area inset. The document also reserves space below the footer and the dynamically added install panel.
- Use viewport-wide image planes throughout the hero, chapters and mall. The mobile hero image fades into the dark canvas within a media area up to `70svh`. Desktop alternates the vertical position of chapter copy to fit the source photograph. Phone anchors chapter copy near the bottom, raising it in New Moon to clear the featured product. Set the New Moon feature into the chapter as a single compact product proof point. Use neutral surfaces for the rail and sales band, and the dark canvas for About and the footer.
- Limit snapping and horizontal overflow to the two rails. The brand strip shows a partial next chip on mobile. Give the rails visible focus, scroll padding, a reachable last item, and keyboard scrolling. Keep the logo clear of word labels. Use a 56 px translucent nav with `backdrop-filter: blur(16px)` and an opaque dark fallback. Mobile Menu reveals Brands, About, Contact and Shop Online. Keep fixed overlays from covering anchored headings, focused controls or the footer.

| Type role | Size | Weight / line height / tracking |
| --- | --- | --- |
| Hero H1 | `clamp(56px, 7.22vw, 104px)` on desktop. Phone caps the size by both width and `6.7svh`, from 38 to 56 px at the default root size. | 660 / 0.92 / −0.04em. Allow normal wraps and grow the hero when the content needs more room. |
| Chapter heading | `clamp(64px, 8.75vw, 126px)` | 660 / 0.94 / −0.037em. Borsch Med uses `clamp(56px, 7.78vw, 112px)`. |
| Rail, About, sales and mall | `clamp(42px, 5.2vw, 76px)` | 650 / 1.00 / −0.035em. The mall can reach 84 px for its two-line heading. |
| Dialog heading | `clamp(38px, 3.47vw, 50px)` | 665 / 1.02 / −0.036em |
| Body | `clamp(16px, 1.46vw, 21px)` | 400 / 1.4 / normal |
| UI and fields | `clamp(14px, 1.11vw, 16px)` | 550–650 / 1.35 / normal. Editable fields are at least 16 px on phone. |
| Eyebrow and footer credits | `clamp(12px, 0.9vw, 13px)` | 650 and 450 respectively / 1.4 / 0.12em for eyebrows only |

Font stack uses `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, "Segoe UI", Roboto, sans-serif`. Use system fonts with no font requests. The page has one H1. Use H2s for chapters and main sections and H3 for the featured SKU.

## Palette and contrast

| Token | Value | Contrast |
| --- | --- | --- |
| Display text | `#FFFFFF` | 19.23:1 on the dark canvas |
| Light copy | `#F1EBE5` | 16.26:1 on the dark canvas |
| Dark canvas and photo scrim | `#110E0C` | At least 64% opacity under photo copy, with a continuous fade to transparent into the image |
| Ink | `#171514` | 17.03:1 on paper |
| Muted ink | `#5B5048` | 7.32:1 on paper, 6.77:1 on warm white |
| Paper / warm white | `#FAF7F2` / `#F2EEE8` | Sheet and rail / sales and preview surfaces |
| Action red | `#B91E17` | 6.44:1 with white text. Red text on paper is 6.03:1 and 5.57:1 on warm white. |
| Divider / input boundary | `#D5CBC0` / `#85766C` | Input boundary is 4.09:1 on paper. Use the lighter divider for non-interactive rules. |

On wide layouts, an elliptical gradient starts at the photo edge beside the copy and fades outward past the text. Borsch Med mirrors the gradient and places its copy and actions high on the right. On phones, a vertical gradient fades into the upper photo and darkens toward the copy. The nav uses a short translucent gradient and a solid fallback. GOGO uses opaque paper so the sunlit wall and garden remain visible. New Moon keeps its packshot card beneath the chapter actions. Sony places its copy lower on the page.

### Implemented contrast

The gradient geometry keeps the copy inside the 64% opacity stop. On wide layouts the farthest corner of the copy is at most 79% of the ellipse radius, and the 64% stop is at 80%. On phones the copy starts one-third of the way down the gradient, after the 64% stop at 33%. To measure a conservative contrast bound offline, decode every delivered WebP candidate with `dwebp`, composite each RGB pixel against the scrim at 64% opacity in sRGB, round each composited channel up, and calculate WCAG contrast from the brightest composited pixel. The bound covers the complete source images, including areas outside the browser crop. GOGO and About use their opaque surfaces.

| Block | Wide white / cream | Phone white / cream |
| --- | --- | --- |
| Hero | 5.80:1 / 4.90:1 | 5.79:1 / 4.90:1 |
| New Moon | 5.79:1 / 4.90:1 | 5.79:1 / 4.90:1 |
| MILI | 5.79:1 / 4.90:1 | 5.79:1 / 4.90:1 |
| GOGO | 17.03:1 ink / 7.32:1 muted ink | 17.03:1 ink / 7.32:1 muted ink |
| Borsch Med | 5.79:1 / 4.90:1 | 5.79:1 / 4.90:1 |
| Sony | 5.82:1 / 4.92:1 | 5.85:1 / 4.95:1 |
| About | 19.23:1 / 16.26:1 | 19.23:1 / 16.26:1 |
| Virtual Mall | 5.79:1 / 4.90:1 | 5.79:1 / 4.90:1 |

The New Moon product card uses the same opaque canvas as About. White text over the 88% dark glass has a **14.06:1** lower bound using pure white behind it. The action red and paper buttons are opaque. Photo controls use a white focus outline with a dark offset. Paper controls use a red outline with a paper offset.

## Section map and destinations

| Section | Copy and action |
| --- | --- |
| Nav and hero | Official GJH logo, Brands, About, Contact and Shop Online. H1 “Explore Goh Joo Hin’s Brands” and “Discover our food and beverage, lifestyle, and healthcare brands.” **Explore Our Brands** jumps to New Moon. **Sales Enquiry** opens the sheet. Each of the five logo/name chips jumps to its chapter. |
| New Moon · Food & Beverage | “Abalone, shellfish, soups and sauces.” **View Brand** opens the official brand page. **Enquire** seeds New Moon and the featured product. **View Product** opens the actual product listing for New Moon Premium Wild Caught New Zealand Abalone 425g. [Brand](https://www.gjh.com.sg/newmoon/) · [Product](https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/) |
| MILI · Food & Beverage | “Canned fruit, vegetables, meat, seafood and sauces.” **View Brand** goes to MILI. **Enquire** seeds MILI. [Brand](https://www.gjh.com.sg/mili/) |
| GOGO · Food & Beverage | “Drinks and potong ice cream.” **View Brand** goes to GOGO. **Enquire** seeds GOGO. [Brand](https://www.gjh.com.sg/gogo/) |
| Borsch Med · Healthcare | “Health supplements and personal care.” **View Brand** goes to Borsch Med. **Enquire** seeds Borsch Med. [Brand](https://www.gjh.com.sg/borsch-med/) |
| Sony · Lifestyle | “GJH is an appointed distributor for specified Sony product ranges.” **View Brand** goes to Sony. **Enquire** seeds Sony. [Brand](https://www.gjh.com.sg/sony/) |
| More brands | LG, Casio, GP Batteries and Gigaset. Snap rail with text wordmarks. Each entry opens the same official brands directory. [Official brands directory](https://www.gjhglobal.com/explore-our-brand/) |
| About GJH | “From Rochor Road” introduces the provision store in the 1940s and the scope of the distribution business. Pair it with GJH’s history composite and a source caption. [About](https://www.gjh.com.sg/about-us/) |
| Virtual Mall Concept | One full-bleed v11 atrium image and an **Explore the concept** link to `../v11/` from the eventual demo. The separate destination owns its 3D code and assets. |
| Sales Enquiry | The static band offers **Prepare an enquiry** and a direct **Official contact** link. Desktop places actions beside the heading and copy. Phone follows the copy with actions. [Official contact](https://www.gjhglobal.com/contact-us/) |
| Footer | 8 Gul Avenue, Singapore 629652. Include “Independent design concept, not affiliated with Goh Joo Hin.” and “Imagery: AI-generated concept scenes (OpenAI ImageGen); product packshots and logos are official GJH assets.” [Official contact](https://www.gjhglobal.com/contact-us/) · [Corporate sales](https://www.gjhglobal.com/corporate-sales/) · [E-Shop](https://www.gjheshop.com/shop/) |

The persistent actions are **Sales Enquiry** and **Shop Online**. The pill sits bottom-right on desktop and becomes two 44 px or larger side-by-side targets on phones. **Contact** in the nav anchors to the Sales Enquiry band. External links use an explicit new-tab cue when they open a new tab.

## Runtime image IDs

The numbered assets are editorial scenes from the [library manifest](../../assets/companies/gjh/landing-concepts/manifest.json). The desktop hero is normalized to a 1664 × 936 source crop before resizing. The phone hero uses a portrait crop of the same spread, with the bowl and hand in the upper image area. The chapter scenes use different IDs on wide and phone layouts. Rail images each come from their own brand's hero or story frame.

| Placement | Wide / phone image ID | Served WebP sizes in KiB |
| --- | --- | --- |
| Hero | 069 / 069, portrait crop | Wide 86.2 / 47.0, phone 74.7 / 36.7 |
| New Moon | 001 / 002 | Wide 88.8 / 49.4, phone 62.6 |
| New Moon product | 004 stage and official 425g packshot | 8.6 stage / 19.5 packshot |
| MILI | 005 / 006 | Wide 96.8 / 55.9, phone 122.7 |
| GOGO | 009 / 010 | Wide 81.0 / 49.6, phone 66.5 |
| Borsch Med | 013 / 014 | Wide 187.2 / 112.7, phone 67.2 |
| Sony | 049 / 050 | Wide 147.3 / 51.2, phone 69.3 |
| More brands · LG | 053 | 24.5 |
| More brands · Casio | 058 | 22.8 |
| More brands · GP Batteries | 061 | 30.3 |
| More brands · Gigaset | 066 | 29.6 |
| About | Official `gjh-history-composite` | 21.0 |
| Virtual Mall | v11 `concept-atrium.webp`, separate wide and portrait crops | Wide 162.2, phone 68.7 |

Runtime WebPs were cropped or resized offline with FFmpeg Lanczos and re-encoded with `cwebp`. The largest file is **187.2 KiB**. The hero preload selects the viewport's source and matches the picture's candidates. Wide chapters offer 960 and 1440 px candidates, and mobile chapters use story portraits. The chapters, rail, stage, packshot, history and mall load lazily. Dimensions, source paths, source and output hashes, and exact byte lengths are in the [runtime receipts](../../demos/corporate/gjh/v22/assets/sources.json).

### Asset inventory and provenance

- **Concept photography.** All numbered library scenes used or deferred above are OpenAI ImageGen editorial scenes recorded in the library manifest. The stage is illustrative, and the four rail images indicate categories. They make no claims about the make or model of anything pictured. Use descriptive alt text where an image conveys content, such as “A spoon serving abalone over a porcelain bowl”. Use empty alt text for decorative backdrops, redundant chip marks and rail textures when adjacent text covers the destination.
- **GJH and brand identity.** The navigation and brand strip use the official GJH, New Moon, MILI, GOGO, Borsch Med and Sony marks, re-encoded from v21's documented derivatives. The rail uses text wordmarks. [Official asset receipts](../../assets/companies/gjh/official/manifest.json) · [Sony directory mark receipt](../../demos/corporate/gjh/v11/assets/brands/logo-sources.json)
- **Official New Moon packshot.** The 425g can comes from the official front image with the connected white margin converted to transparency. It is shown over the separate 004 stage. The image's crop removes the outer white margin and preserves the can artwork. [Source receipt](../../assets/companies/gjh/official/manifest.json) · [Product listing](https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/)
- **Official history.** `gjh-history-composite.jpg` (550 × 240, 33.4 KiB). Use its full historical composite on the right of the desktop About band and below copy on phone. Its baked-in year belongs to the source art. Editorial copy follows the verified timeframe of the 1940s. [Source receipt](../../assets/companies/gjh/official/manifest.json)
- **Virtual Mall.** v11 `concept-atrium.webp` (1200 × 676, 143.6 KiB). Anchor the staircase and foliage on the right, with copy in a dark left or lower zone. The v11 receipt identifies it as AI-generated concept imagery. [Concept imagery receipt](../../demos/corporate/gjh/v11/assets/concept-imagery.json)

## Motion and interaction

Use plain stacked sections as the base. When sticky positioning is available and motion is allowed, wrap the five chapters in one stacking context and give later chapters increasing stacking order. Pin a fitting chapter from the top of the viewport, with copy below the fixed nav, until the next chapter slides up and covers it. Keep sections in source order. Stop pinning at More brands. Leave an over-height chapter in flow at high zoom, in short landscape viewports or when the text needs more height. Jump links scroll to and focus the target heading below the nav. Release pinning if a focused control would otherwise be covered by the next chapter.

Enhance entrances with a one-time 480–560 ms ease-out. Scale only the photograph from 1.06 to 1 and use a 12 px rise on the heading and buttons. Keep copy fully opaque throughout the reveal. Trigger near first intersection, and reveal immediately on focus, fragment navigation or a failed observer. Keep copy visible in default markup. With `prefers-reduced-motion: reduce`, remove sticky stacking, parallax, scale, reveal and smooth scrolling. Preserve jumps, rails and enquiry access. Without JavaScript, sections are naturally stacked, the mobile nav and fragment links remain usable, and enquiry controls link to the official contact page.

## Enquiry sheet

- Open from the hero, fixed action or static band with an optional brand. Open from a chapter with Brand selected. New Moon has its displayed 425g product seeded. Other chapter triggers open with Product available for free text. Use a labeled single-choice chip group, an editable Product field that wraps when needed, and a Requirements textarea. Show the selected mark and color together. Keep the draft in memory for the page session. Reopening from a different chapter updates the brand and its product context. Within the sheet, clear an untouched automatic product when the brand changes and preserve manually entered text.
- Compose the read-only preview locally as lines for Brand, Product and Requirements. Omit empty lines. Update on input and render as plain text. Expose the preview as a labeled region. Reserve polite announcements for actual clipboard feedback to avoid reading each keystroke.
- **Copy details** writes the preview through the Clipboard API in the click event. If unavailable or denied, including inside the gallery iframe, focus a read-only textarea containing the preview and select its text for manual copy. **Open official contact** is a separate link to the GJH contact page in a new tab. The visitor pastes into the official Message field and sends from that site. Put the paste instruction beside the actions. Use only a clipboard-specific status message and keep the page focused on message preparation. [Official contact](https://www.gjhglobal.com/contact-us/)
- Desktop centers a 930 px maximum-width dialog on a dimmed chapter, with input and message preview side by side. Phone uses a full-width bottom sheet with rounded top corners and a scrollable single-column body. Give the action footer its own sticky surface above the safe area. Constrain the sheet to the visual viewport when the software keyboard or text zoom reduces height. Keep the Close control reachable.
- Prefer a native modal dialog with an accessible name, focus containment and inert background. On open, focus the dialog heading or close control to preserve the starting scroll position. Escape and Close dismiss it and restore focus to the opener. If the opener is obscured, return focus to its chapter heading. Use real official contact hrefs as the no-JavaScript or unsupported-dialog path.

### Mobile journey

1. The hero starts at the top of the viewport even when the install script enhances the header. At 390 × 844, 375 × 667 and 320 × 568 the CSS reserves 8 px between the strip and the 64 px action bar. With zero safe-area inset, the planned strip bottom and bar top are 772 / 780 px, 595 / 603 px and 496 / 504 px, respectively. The snap strip and both hero CTAs have at least 44 px targets. At 320 px the hero actions can wrap onto two rows.
2. Tap the New Moon chip or **Explore Our Brands**. The chapter shows a service portrait, the brand’s product families, clear chapter actions, and the official 425g packshot.
3. Tap **View Brand** for the brand page, **View Product** for the SKU, or **Enquire** to open the sheet with brand and SKU seeded. Buyers can edit product and requirements, see the message, copy it, then open the official contact page.
4. Visitors continuing down the page reach all five brands, the horizontal rail, About, the mall link and the sales section. The fixed **Shop Online** action remains available throughout.

## Differences from v20 and v21

v20 opened with a blue studio packshot and used category filtering to browse collections of cards. v21 moved to a paper product stage, short utility chrome and a range-card exhibition. v22 leads with the 069 editorial table scene and gives each brand its own full-viewport image in both orientations. The logo strip is a direct jump list; the compact horizontal rail is reserved for additional brands. The New Moon product belongs to its chapter. The primary action stays available across the scroll, and the contextual sheet opens with an editable message preview.

## Risks and verification

| Risk | Design and acceptance check |
| --- | --- |
| Oversized images or duplicate preload | Compress the source candidates against the 200 KiB cap. Check requests at 390 and 1440, including the hero preload match and lazy-loaded chapters. |
| Portrait crops and scrim drift | At 320, 390, 768 and 1440 px, compare the photo focus, actual pixel contrast under every text line, overflow and 44 px targets. Include long headings, 200% zoom, high contrast and safe-area insets. |
| Sticky chapters cover focus or clip content | Test keyboard and direct fragment entry, reduced motion, shorter windows, and a no-JavaScript pass. Keep the natural stacked route available. |
| Clipboard can fail or the official form can change | Test permission denial in the gallery iframe and manual selection with VoiceOver or a keyboard. Recheck the official form's Message field and destination before publication. Count the contact click as an outbound action. |
| Provenance and source precision | Treat the concept artwork as illustrative. Keep packaging and marks unaltered apart from the documented crop, margin removal or resize. Confirm current rights and the Sony distributor wording before a public release. Preserve the design-concept and imagery credits. |

The four approved PNGs were visually inspected as proposals. **Browser acceptance UNVERIFIED for the layout revision.** Manager acceptance uses `python3 demos/corporate/gjh/landing_checks.py --versions 22 --capture` and compares the captures with the proposals. The browser runner checks desktop and phone hero fit, the keyboard and enquiry journeys, normal and reduced motion, no JavaScript, and iframe clipboard denial. Use additional viewport captures for 375 × 667, 320 × 568, 1280 px and 1024 px, and check the page end with the install panel present. The complete gallery build and freshness check run in an isolated copy because the generated release identity is embedded in every demo service worker.

## ImageGen direction

The built-in ImageGen tool used the selected repo contact sheets as inputs for four design references. The final PNGs reproduce the composition with the actual repository pixels, system type, official marks, accurate photo roles and exact viewport geometry. ImageGen's raw renders compressed the chapters and misassigned several mobile images. The final layout restores the full-height architecture, swaps in the precise source art, and typesets the exact UI and product information.

<details>
<summary>ImageGen prompt set</summary>

**Shared brief**

Use case: ui-mockup. Create a polished web design visual reference for Goh Joo Hin Brand Chapters, an independent concept. The supplied images are contact sheets of the approved photography. Preserve depicted scenes and original color. Every scene must be an exact crop of the corresponding source whenever possible. A later production pass will use the original photos and official logos as pixel-accurate overlays, so never improvise packaging or logo art. Use restrained monochrome UI, a single deep GJH red #B91E17 for primary buttons, tight system sans, thin white borders. Use real website proportions, with no device frame and no background outside the page.

**Desktop full page**

Desktop page composition, 1440 CSS px wide. Art-direct using the first columns of the first four rows of sheet 1 (001,005,009,013) and first row of sheet 2 (049). Make the first 900px feel like a film poster: 56px translucent black nav, warm 001 abalone platter filling the entire canvas on the right, strong left gradient scrim behind huge two-line headline “Explore Goh Joo Hin’s Brands”, “Explore Our Brands” and “Sales Enquiry” buttons, genuine brand marks space in a grounded glass horizontal strip. Full-width, single-photo brand chapters, no grid: New Moon, MILI, GOGO, Borsch Med, Sony. Each has a tiny category and broad display headline, single fact, “View Brand” and “Enquire”. Under the photo chapters place a lighter four-item More brands image rail, dark editorial About band, dark photographed Virtual Mall Concept band, warm-white Sales Enquiry section and dark footer. Bottom-right fixed action pill “Sales Enquiry | Shop Online”. Prioritize first viewport polish if the image aspect ratio limits full-page detail.

**Mobile full page**

Mobile 390x844 first viewport and long page art direction. Use exact mobile story portraits 002, 006, 010, 014 and 050 from the second columns of the contact sheets, with 002 as the hero creative. Show hand, spoon and porcelain bowl near the visual center with dark lower scrim. 54px utility nav, title exactly “Explore Goh Joo Hin’s Brands” in two/tight three lines, both 44px “Explore Our Brands” and “Sales Enquiry” buttons visible, then a scrollable row of logo and brand-name jump chips visibly above the fixed bottom actions “Sales Enquiry” and “Shop Online”. Below the fold one portrait per screen with its large name, short factual copy and two actions. Five chapters New Moon, MILI, GOGO, Borsch Med, Sony. Keep everything pointed and editorial with strong negative space; the screen feels like a portrait story, while buttons remain comfortably readable.

**Desktop enquiry sheet**

Show a precisely typeset desktop 1440x900 Sales Enquiry overlay over a dimmed New Moon chapter (first reference tile 001). Make a matte ivory, 820px wide dialog centered, with a 24px radius, hairline divider and unobtrusive close control. Header “Sales Enquiry”, subtitle “Prepare a message for GJH.”. Two balanced columns divided by whitespace. Left fields: “Brand”, rounded one-choice chips “New Moon” selected in red, “MILI”, “GOGO”, “Borsch Med”, “Sony”; “Product” with “New Moon Premium Wild Caught New Zealand Abalone 425g”; “Requirements” with “Please share bulk pricing and lead time for 48 cans.”. Right panel “Message preview” and a plain-message preview with those same details. Footer note “Paste the copied details into the Message field.”. Two pill actions “Copy details” and “Open official contact”. No submit, no success copy, no fake official form. Render only one state.

**Mobile enquiry sheet**

Show a precisely typeset full 390x844 mobile screen with the Sales Enquiry bottom sheet expanded. Preserve a slim, dimmed band of New Moon mobile story 002 (second tile of the first row) above the ivory sheet. The sheet has top rounded corners, a visible close button, a single-column layout with generous tap sizes and slightly compact inter-field spacing. Title “Sales Enquiry”, short subtitle “Prepare a message for GJH.”, “Brand” five wrapping chips “New Moon” selected in red, “MILI”, “GOGO”, “Borsch Med”, “Sony”; “Product” showing “New Moon Premium Wild Caught New Zealand Abalone 425g”; “Requirements” with “Please share bulk pricing and lead time for 48 cans.”. “Message preview” contains the same details, with the line “Paste the copied details into the Message field.”. At bottom show “Copy details” and red “Open official contact”, both visible. Real crisp accessible form design.

</details>
