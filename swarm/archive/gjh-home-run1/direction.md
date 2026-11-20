# GJH home art direction

## Concept
A quiet, cinematic tour of Goh Joo Hin's brands. Lead with the food, move through the portfolio, then give buyers a clear route to enquire. Set every scene around one subject and one idea. Design at 393 × 844 first, preserve the full reading path at 320px, then open up the composition on desktop.

## Shared visual system
- Use #0f1115 for the hero and chapter base, #171a21 for the directory and enquiry bands, and #0f1115 for the footer. Fade photo edges into the adjoining band where needed to avoid light seams. Set copy in #f4efe4. Keep project colors in scoped custom properties.
- Use the system stack and bold, tight display type for the hero and lead brands. Start display sizing at --dc-text-2xl or --dc-text-display as space permits and scale up with clamp(). Use --dc-text-xl to --dc-text-2xl for service and editorial headings, --dc-text-base for body copy, and --dc-text-sm for eyebrows, captions and supporting labels.
- Align content to --dc-container. Use --dc-space-4 for mobile gutters and --dc-space-8 on wide screens. Stack labels, headings and copy in --dc-space-2 to --dc-space-4 steps. Reserve --dc-space-6 before actions and use --dc-space-12 between major blocks on solid bands.
- Use GJH red #d9261c with hover #b81f16 for the primary action family. Use ivory links or outline buttons for secondary actions. Keep --dc-focus visible, use --dc-tap for action targets and verify AA against the actual scrim or button fill.
- Give each image-led screen one dominant library scene with a focal crop and a local dark scrim behind text. Use portrait and wide sources via picture where paired, descriptive alt, explicit dimensions and lazy loading below the hero. Place the visible “AI concept illustration” caption on every AI scene and use the approved official assets for logos and the history composite.
- Keep section styles scoped and links on the contract's root IDs. Use CSS interactions with keyboard access, a fully visible reduced-motion experience, and room for the fixed actions at the bottom.

## Section order and ownership
01 Header — Translucent navigation and mobile disclosure, with the persistent Sales Enquiry and Shop Online actions.
HANDOFF 01 → 02 — Agree on header height and fixed-action footprint, including safe-area insets, so hero copy and the docked strip stay clear.
02 Hero — Use New Moon 001 on desktop and 002 on mobile for the opening scene, with the sole h1 and the brand navigation strip.
HANDOFF 02 → 03 — Land Explore Our Brands at the first chapter and switch to a distinct New Moon scene and closer framing.
03 New Moon — Feature the named abalone product and one verified brand sentence, with View Brand and Enquire.
HANDOFF 03 → 04 — Carry the eyebrow, headline and action alignment from warm New Moon into a fresh MILI palette.
04 MILI and GOGO — Give MILI a fresh pantry scene and GOGO a bright chilled scene, with the same type hierarchy.
HANDOFF within 04 — Shift from pantry produce to chilled refreshment through the library photography, holding the text placement steady.
HANDOFF 04 → 05 — Let GOGO's color give way to quieter Borsch Med photography while keeping the chapter rhythm.
05 Borsch Med and Sony — Move from health and personal care to electronics with restrained copy and verified distributor wording.
HANDOFF within 05 — Use a clean visual cut from wellness to electronics and keep the typography and spacing aligned.
HANDOFF 05 → 06 — End Sony on a dark edge that opens into the tonal directory band. Keep Sony in its own chapter.
06 More Brands — Use a lead image and a horizontal snap rail of the remaining verified brands, with a link to the official directory.
HANDOFF 06 → 07 — Close the rail with its directory link, then shift from the portfolio breadth to the Rochor Road story.
07 About — Tell the Rochor Road provision store origin and use “Since 1940” with the official history composite where it fits.
HANDOFF 07 → 08 — Keep the heritage story grounded in the official image, then label the mall concept at its entry.
08 Virtual Mall Concept — Use one full-bleed mall scene, a visible independent-concept label and the link to ../v11/.
HANDOFF 08 → 09 — Fade the scene into the enquiry band. Keep the demo link inside the mall and sales guidance in enquiry.
09 Sales Enquiry — Use radio chips, the buyer checklist and clear links to official contact and corporate sales.
HANDOFF 09 → 10 — Align content edges and keep the checklist above the footer's address, links and disclosures. Confirm clearance for fixed actions.
10 Footer — End with the verified address, official links and both required disclosures, with a quiet hierarchy.

## Top risks
- Mobile overlay collisions between header, hero strip and fixed actions, especially at 320px or with safe-area insets.
- Lost subjects or weak text contrast after portrait crops. Check each scene and its caption at 393px and desktop.
- Repeated opening and New Moon imagery, or generic tiles that flatten the page rhythm.
- Unverified claims and confusion between AI illustrations and official assets. Use brief.md as the factual source.
