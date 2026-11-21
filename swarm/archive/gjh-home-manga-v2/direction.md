# GJH home — whole-page redesign (#1230)

## Concept and feeling
A coherent manga-inspired Singapore brand journey: bold ink outlines, screentone, dramatic panel gutters, speech-bubble captions and selective speed lines, with forest green and gold expressed through SDS semantic roles. Use English page copy and verified facts only. The owner’s explicit manga override in brief.md supersedes the earlier cinematic and anime direction; the general redo request does not revoke it.

## Shared visual system
- Alternate semantic light surfaces with deep inverse chapters; use SDS theme and brand roles so light, dark and auto remain legible. Use action and accent roles selectively; never hard-code colours, sizes or durations.
- Use SDS display type for the hero and brand names, heading tokens for section titles, body tokens for descriptions and caption tokens for image credits. Maintain one h1, in the hero.
- Use SDS container, spacing and component tokens for consistent gutters and vertical rhythm; keep copy concise, touch targets at least `var(--sds-tap)`, and fixed-action clearance on mobile.
- Give each chapter a clear focal scene, manga panel treatment and distinct brand personality; multiple panels are allowed while preserving reading order. Use responsive library images, visible AI captions, meaningful alt text, explicit dimensions and lazy loading below the hero. Official logos and packshots remain uncropped and unaltered.
- Use `.sds-*` components, `var(--sds-*)` tokens, `data-i18n` and `data-reveal`; ensure readable fallback, keyboard focus and reduced motion. No scripts in fragments.

## Section order and neighboring handoffs
01 Header — clear navigation, native mobile menu and persistent enquiry/shop actions.
HANDOFF 01 → 02: Reserve header and mobile action-bar space; hero title and brand links remain unobscured.
02 Hero — New Moon 001/002, manga treatment, sole h1, two actions and docked brand strip.
HANDOFF 02 → 03: Brand strip and primary action lead to #03-newmoon; manga opening resolves into warm food imagery.
03 New Moon — warm dining, exact verified product name and both brand/enquiry actions.
HANDOFF 03 → 04: Align content edges; transition from warm dining to fresh pantry green.
04 MILI / GOGO — distinct pantry and tropical refreshment chapters sharing typography and rhythm.
HANDOFF 04 → 05: Settle tropical energy into calm wellness; verify images are visible at both viewport sizes.
05 Borsch Med / Sony — serene wellness and precise technology, using only verified distributor wording.
HANDOFF 05 → 06: Carry the shared gutter into a clear, accessible portfolio rail.
06 More Brands — unequal lead and horizontal snap rail for all eleven verified brands.
HANDOFF 06 → 07: End the rail clearly before the warm heritage story.
07 About — Rochor Road origin, Since 1940 and complete official history composite.
HANDOFF 07 → 08: Move from verified history to an explicitly independent future concept.
08 Virtual Mall — atmospheric mall concept with AI label and existing demo link.
HANDOFF 08 → 09: Transition to a calm enquiry surface with clear text contrast.
09 Enquiry — native brand choices, buyer checklist and official contact paths; no submission illusion.
HANDOFF 09 → 10: Share content edges and reserve safe-area clearance; footer owns the closing boundary.
10 Footer — verified address, official links and both exact disclosures.

## Risks and acceptance
- Reports identify missing desktop images in 04 and 05 and insufficient contrast in 04 and 05: reproduce, fix and verify rather than assume resolved.
- Validate assembled output at 320px, 393×844 and desktop; check section anchors, image loading, theme and language switching, contrast, focus, overflow, reduced motion and fixed controls.
- Preserve official destinations, exact disclosures and verified copy; report browser, device and release checks without evidence as unverified.
