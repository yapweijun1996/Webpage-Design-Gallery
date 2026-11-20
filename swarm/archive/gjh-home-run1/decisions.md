# GJH Home — Build decisions

## Agreed handoffs and rulings
- 01 → 02: The translucent 56px nav stays in normal flow and counts toward the opening viewport. Use the phone layout below 48rem.
- Fixed actions: On phones, the bar occupies 60px plus the bottom safe-area inset (44px target and two 8px pads). Give the hero strip 8px above that footprint (68px + inset total). Use the agreed 16px gap for chapter actions, enquiry and footer (76px + inset total). Check the desktop pill at 48rem.
- Navigation: Logo → #02-hero, Brands → #03-newmoon, About → #07-about, Contact → #09-enquiry. Sales Enquiry and Enquire go to official Contact Us. Shop Online goes to the official E-Shop.
- 02 → 03: Explore Our Brands and New Moon both land at #03-newmoon. The other strip links are MILI & GOGO → #04-miligogo, Borsch Med & Sony → #05-healthtech, and More Brands → #06-morebrands. Cut from hero 001/002 on a dark edge to the tighter 003 crop.
- 03 → 04 → 05: Use the shared left gutter, left-aligned chapter labels and headlines, and --dc-space-6 before actions. Fade New Moon into MILI and GOGO into Borsch Med on #0f1115.
- 05 → 06 → 07: Fade Sony to solid #171a21 for the directory. Close the rail with the official directory link, then cut to #0f1115 for heritage with the same gutter.
- 07 → 08 → 09: Carry the heritage ink into the atrium opening with the concept label next to the title. Fade the mall to solid #171a21 for enquiry. Keep the mall link in 08 and sales guidance in 09.
- 09 → 10: Use --dc-container and matching --dc-space-4 gutters below 48rem / --dc-space-8 at and above 48rem. Lead the footer with the address, then four official links and both disclosures.

## Decision for #81
- 08 replaces the temporary embedded atrium image because the server now serves the V11 WebP. The 07 → 08 → 09 visual handoffs and the mall destination remain agreed.
- Active worker scope: 08 only. Agents 01–07 and 09–10 have no edits in this round.

## DO / DON'T by agent
- **01 Header** — Do use CSS disclosure, local nav anchors, official fixed links and 44px targets. Don't make the top nav fixed or sticky.
- **02 Hero** — Do use 001 desktop / 002 mobile, the sole prescribed h1, one support sentence, both CTAs and all four docked strip links. Don't reuse 003 or let the bar cover the links.
- **03 New Moon** — Do use 003 on both layouts, preserve the exact product name, and place View Brand before Enquire. Don't add product claims beyond the brief.
- **04 MILI and GOGO** — Do use 005/006 for MILI and 009/010 for GOGO, with matching type and CTA alignment. Don't combine the chapters into tiles.
- **05 Borsch Med and Sony** — Do use 013/014 for Borsch Med and 049/050 for Sony. Use the appointed-distributor wording for specified Sony ranges. Don't add medical claims or product specs.
- **06 More Brands** — Do lead with Hormel 043, include the remaining verified brands as text wordmarks, and add a visible scroll cue and focusable snap rail. Don't repeat Sony or use equal-weight cards.
- **07 About** — Do use “Since 1940,” the Rochor Road provision-store origin, the uncropped official history composite and official About link. Don't add a timeline or further dates.
- **08 Virtual Mall Concept** — Do use /gjh-v11/concept-atrium.webp in sections/08-mall.html. Preserve alt text, width, height, the independent concept label, the AI caption and the ../v11/ link. Confirm the image loads from that URL and check the crop at 393 × 844. Don't embed the scene or build 3D.
- **09 Sales Enquiry** — Do use keyboard-accessible radio chips, the brand/product/quantity/delivery checklist and official Contact Us and Corporate Sales links. Don't submit data or imply prefill.
- **10 Footer** — Do use the exact address and disclosures in the brief and verify both disclosures can scroll above the fixed actions. Don't repeat the buyer checklist.

Verify the assembled page at 393 × 844 first, then 320px and desktop, including the 48rem transition. Check subject crops, AI captions, focus, contrast, anchors, action clearance and horizontal overflow.
