# New Moon Option A — Image Generation Specification

Mode: built-in ImageGen, `ui-mockup`; no input/reference image. Output: `desktop-mobile-board.png`, 1024 × 1536 raster pixels. Status: **OWNER_REVIEW**. The 1440px and 390px annotations are intended design viewport widths, not the image's literal pixel dimensions or browser-tested layouts.

## Generation Prompt Specification

Create one high-fidelity Figma-style presentation board of a New Moon consumer-brand landing-page proposal. Place a 1440px desktop frame on the left and matching 390px mobile frame beside it, at approximately the same visual scale, with all five sections visible. Use generous outer margins, a warm neutral studio-board background, crisp fine annotation rules and readable English. This is a polished UI presentation rather than a wireframe or an implemented website.

Use only a plain serif **NEW MOON** placeholder wordmark and “Singapore heritage food” descriptor. Do not reproduce the actual crescent-face device, real trademark lettering, company logo or retail packaging. Label the board “NEW MOON / OPTION A — YELLOW & DEEP TEAL” and “Concept palette, not an official brand standard.” Add “Independent design concept · Placeholder wordmark · Illustrative products.” Use warm yellow `#F2B705`, deep teal `#0B3A41` and ivory `#FAF6EE`. Set dark teal text on yellow buttons, and ivory/yellow text on dark teal. Typography leads; texture and motion hints remain restrained. No photographs of people, fabricated reviews, certifications, discounts, delivery promises or achievements.

1. **Immersive hero:** full-bleed teal-black deep sea; one glowing crescent behind a close-up ceramic plate of braised abalone; expansive negative space; exact headline “Since 1959. Made with love.” with ivory first half and warm-gold second half. Supporting line “A little care. A meaningful gift.” Buttons “Gift finder” and “Order on WhatsApp”; “Scroll to discover” cue. Desktop navigation: Our story / Find a gift / Collections; mobile Menu. Recompose mobile vertically, keeping text off the food.
2. **Heritage:** ivory paper texture; “A story, shared across generations.” Horizontal cards: “1940s — GJH roots / A provision store on Rochor Road”; “1959 — New Moon begins / Abalone starts the brand story”; “1980s — A portfolio chapter / Details to be confirmed”; “Today — Food & nourishment / For everyday moments”. Archival-style shop/pantry/ephemera imagery without people, labelled “Archival concepts — replace with verified records”. GJH's 1940s roots are not New Moon's founding date. Mobile shows one card plus a visible next-card affordance.
3. **Gift finder:** “Who are you thinking of?”; For parents / For clients / For myself tabletop gifting cards; Your budget slider with Set a budget placeholder; Halal options only toggle OFF; delivery date picker reading Choose a date. Helper: “Confirm product certification and delivery at checkout”. CTA “Find a thoughtful gift”. Stack mobile controls; no certification claim or actual recommendation logic.
4. **Collection:** “Thoughtfully chosen. Beautifully given.” Three original minimalist teal/ivory gift-box concepts with warm-yellow ribbons and plain typesetting. Card rows: Grade: confirm; origin examples New Zealand / Australia / South Africa; Price on request; Add card message. Caption “Concept gift packaging · SKU details require confirmation”. No copied tins, real SKU packaging or sale badges. Mobile uses stacked cards or a clear carousel.
5. **Concierge:** quiet deep-teal strip reading “A thoughtful gift starts with a conversation.” Desktop WhatsApp concierge action. Mobile floating green WhatsApp concierge control in a sticky bottom bar, with safe-area space and a secondary Find a gift action. Do not cover product details or invent a phone number. Annotation: “WhatsApp service concept — contact and operations pending”.

## Review of the Generated Result

- PASS: coherent yellow/teal/ivory direction, plain placeholder wordmark, crescent/abalone hero and requested headline.
- PASS: desktop/mobile frames, five section annotations, gifting controls, concept packaging and mobile concierge bar are visible.
- PASS: no real people; archive/product disclaimers and unconfirmed timeline chapter remain visible.
- LIMIT: generated handwriting/paper details are decorative, not historical records. Do not transcribe them as facts.
- LIMIT: the raster is an illustration of UI; controls, budget logic, Halal filtering, dates, cart and WhatsApp do not operate.
- LIMIT: text geometry, full mobile product sequence, screen-reader order, over-image contrast and reduced-motion behavior require implementation and browser review. No WCAG or exact 1440/390 reflow claim is made from this board.

The original generated output is copied unchanged into this directory. It is not part of the official brand asset library or the published Gallery's runnable design catalog.
