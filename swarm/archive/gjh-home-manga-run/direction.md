# GJH home art direction

## Concept
A manga cover opens a sequence of brand, heritage and buyer panels. Give the page the energy of a printed comic using bold silhouettes, black ink, ivory paper and decisive panel cuts. Build for 393 × 844 first and retain the reading order at 320px. The owner’s override in #234 governs composition.

## Shared visual system
- Alternate forest #101C16 and #192A20 bands, with ivory #F4EFE4 panels for narration. Use black ink outlines thick enough to read at phone size and a clear gutter between panels. Define colors in scoped properties.
- Use the system stack. Set the cover and lead brand names in bold display type with the display tokens and clamp() where needed. Use --dc-text-xl to --dc-text-2xl for section headings, --dc-text-base for reading copy and --dc-text-sm for captions.
- Align to --dc-container with --dc-space-4 mobile gutters and --dc-space-8 on wide screens. Use --dc-space-2 to --dc-space-4 between related elements and --dc-space-6 before chapter actions.
- Reserve gold #E0BD6A and hover #F0D487 for key actions and selected emphasis. Use forest text on gold. Keep text on solid or reliably scrimmed surfaces and keep the focus token visible.
- Use multi-panel layouts with visibly different panel sizes, including diagonal edges where they help direct the eye. Stack the panels on phones in DOM reading order. Use screentone on open surfaces, localized speed lines for GOGO and speech-bubble caption frames for existing copy. Keep effects away from text and interactive targets.
- Preserve official assets and packshots uncropped and in original colors. Keep AI concept captions visible. Use picture for the paired hero sources, descriptive alt text, explicit image dimensions and lazy loading below the hero.
- Use scoped CSS and preserve existing IDs, semantics, links and verified copy. Respect reduced motion, --dc-tap and the existing fixed-action footprint and safe-area clearances.

## Section order and ownership
01 Header — Translucent navigation and mobile disclosure, with the persistent Sales Enquiry and Shop Online actions.
HANDOFF 01 → 02 — Agree on header height and fixed-action footprint, including safe-area insets, so hero copy and the docked strip stay clear.
02 Hero — Use New Moon 001 on desktop and 002 on mobile for the opening scene, with the sole h1 and the brand navigation strip.
HANDOFF 02 → 03 — Land Explore Our Brands at the first chapter and switch to a distinct New Moon scene and closer framing.
03 New Moon — Feature the named abalone product and one verified brand sentence, with View Brand and Enquire.
HANDOFF 03 → 04 — Carry the eyebrow, headline and action alignment from warm New Moon into a fresh MILI palette.
04 MILI and GOGO — Give MILI a fresh pantry scene and GOGO a bright chilled scene, with the same type hierarchy.
HANDOFF within 04 — Shift from pantry produce to chilled refreshment through the library photography, holding the text placement steady.
HANDOFF 04 → 05 — Let GOGO's color give way to quieter Borsch Med photography while keeping the shared gutter.
05 Borsch Med and Sony — Move from health and personal care to electronics with restrained copy and verified distributor wording.
HANDOFF within 05 — Use a clean visual cut from wellness to electronics and keep the typography and spacing aligned.
HANDOFF 05 → 06 — End Sony’s panel at the #192A20 directory band. Keep Sony in its own chapter.
06 More Brands — Use a lead image and a horizontal snap rail of the remaining verified brands, with a link to the official directory.
HANDOFF 06 → 07 — Close the rail with its directory link, then shift from the portfolio breadth to the Rochor Road story.
07 About — Tell the Rochor Road provision store origin and use “Since 1940” with the official history composite where it fits.
HANDOFF 07 → 08 — Keep the heritage story grounded in the official image, then label the mall concept at its entry.
08 Virtual Mall Concept — Use one full-bleed mall scene, a visible independent-concept label and the link to ../v11/.
HANDOFF 08 → 09 — End the atrium panel at the #192A20 enquiry band. Keep the demo link inside the mall and sales guidance in enquiry.
09 Sales Enquiry — Use radio chips, the buyer checklist and clear links to official contact and corporate sales.
HANDOFF 09 → 10 — Align content edges and keep the checklist above the footer's address, links and disclosures. Confirm clearance for fixed actions.
10 Footer — End with the verified address, official links and both required disclosures, with a quiet hierarchy.

## Acceptance and risks
- At 393 × 844 the opening must read as a manga cover, and each section must show an identifiable composition change using its assigned visual device. Compare before and after at ordinary viewing size.
- Inspect 320px, desktop and both sides of 48rem for clipping, horizontal overflow, visible captions and fixed-action overlap. Confirm AA contrast and native keyboard operation where available.
- Watch for heavy frames obscuring focus, rough edges clipping official assets, and textures behind text. The assembled redesign stays open until manager review and owner confirmation.
