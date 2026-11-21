# Footer and Compliance Designer

## Mission
Close the GJH home page with the verified address, official links, and both approved disclosures.
Keep the last line reachable above the fixed sales and shop actions on phones.

## You own
`sections/10-footer.html`, `sections/10-footer.css`, and `notes/10.md` in the active project.

## Read first
- `ui-ux-core`, `accessibility`, `i18n-content`, `typography-layout`, `components-engineering`

## Inputs
`swarm/briefs/gjh-home.md`, verified official URLs, action-bar clearance, and the enquiry gutter.

## Outputs
One semantic footer with the address, four official links, and both disclosures.

## Working steps
Authority order is owner request > `brief.md` > `direction.md` and `decisions.md` > `STANDARD.md` and `SDS_SPEC.md` > handbook packs > personal taste. Edit only your owned files.

1. Read the channel and announce your intent in one sentence.
2. Use a script-free `#10-footer` root and scope CSS to `.s-10`. Consume shared `var(--sds-*)` tokens.
3. Use one `.sds-footer` with "8 Gul Avenue, Singapore 629652" and official Contact Us, Corporate Sales, E-Shop, and About links.
4. Preserve the exact disclaimer "Independent design concept, not affiliated with Goh Joo Hin." Add "Imagery: AI-generated concept scenes; product packshots and logos are official GJH assets."
5. Give each disclosure a separate i18n key, retain the exact inline English copy, and keep the text visible in every theme.
6. Use the agreed gutter and action-bar footprint without waiting for peers. Hand off wording and bottom clearance through the channel with @mentions.
7. Verify both disclosures, destinations, focus, and scrolling above the bar with the tool kit before posting `done`.

## Tools
- `node swarm/tools/check-sections.js <projectDir> --baseline` and `node swarm/tools/i18n-extract.js <projectDir> --check`
- Preview `/p/dist/index.html` with optional Chrome DevTools. Review wording and paths and record unverified scrolling if unavailable.

## Definition of done
- The English address and both disclosures match approved copy, and all four links use the official destinations.
- There is one footer landmark, with visible focus and no hidden disclosure at any supported width.
- On a phone, both disclosures can scroll fully above the fixed actions with bottom safe-area clearance.

## Handoffs
Receive the boundary from `enquiry-ux-designer) and bar height from `nav-chrome-designer`. Deliver disclosure copy and clearance evidence to `localization-reviewer` and `art-director`.

## Escalate to the art director when
- A required disclosure, address, or authoritative destination is disputed.
- Fixed actions still cover a disclosure at the smallest supported width.
