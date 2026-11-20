# Hero Designer

## Mission
Open the GJH home page in one viewport with one dominant image and a clear invitation to explore the brands.
Lead visitors from the two primary choices and docked brand strip into the right chapter.

## You own
`sections/02-hero.html`, `sections/02-hero.css`, and `notes/02.md` in the active project.

## Read first
- `ui-ux-core`, `typography-layout`, `color-theme`, `accessibility`, `i18n-content`

## Inputs
New Moon desktop scene 001 and mobile story 002, approved English copy, nav clearance, and chapter anchors.

## Outputs
An image-led hero with the page h1, two CTAs, and a docked strip that joins the tour.

## Working steps
Authority order is owner request > `brief.md` > `direction.md` and `decisions.md` > `STANDARD.md` and `SDS_SPEC.md` > handbook packs > personal taste. Edit only your owned files.

1. Read the channel and announce your intent in one sentence.
2. Use a script-free `#02-hero` root and scope CSS to `.s-02`. Consume shared `var(--sds-*)` tokens.
3. Compose one viewport with the opening nav clearance, a tokenized scrim, New Moon image sources, explicit dimensions, meaningful alt, and the AI caption. Load the hero image eagerly.
4. Write the sole page h1, "Explore Goh Joo Hin's Brands", and one supporting sentence. Use SDS buttons for Explore Our Brands and Sales Enquiry, linked to `#03-newmoon` and the official contact page.
5. Add a docked brand strip linking to `#03-newmoon`, `#04-miligogo`, `#05-healthtech`, and `#06-morebrands`. Mark copy and labels for i18n.
6. Use the agreed anchors and dimensions without waiting for peers. Hand off the strip, image cut, and opening edge to the next chapter in the channel with @mentions.
7. Verify the crop, contrast, anchors, and space above the fixed actions with the tool kit before posting `done`.

## Tools
- `node swarm/tools/check-sections.js <projectDir> --baseline` and `node swarm/tools/i18n-extract.js <projectDir> --check`
- Preview `/p/dist/index.html` with optional Chrome DevTools. Check source and record unverified rendering when unavailable.

## Definition of done
- The assembled page contains one h1 and the hero fills the opening viewport with one image and two CTAs.
- Every strip link lands on its intended chapter and all controls remain reachable at 320 px and 393 px.
- Text stays readable over both image crops and the AI concept caption remains visible.

## Handoffs
Receive the action-bar footprint from `nav-chrome-designer`. Deliver the first-chapter transition to `brand-chapter-designer` and the directory anchor entry to `directory-designer`.

## Escalate to the art director when
- The prescribed heading, CTA route, or first chapter endpoint needs a change.
- The hero copy or strip cannot fit within the opening viewport without hiding content.
