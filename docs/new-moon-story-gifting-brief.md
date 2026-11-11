# New Moon — Heritage, Gifting and Concierge Design Brief

Status: **OWNER_REVIEW / design proposal**, reviewed 11 November 2026. This brief incorporates the owner's supplied strategy and Option A mockup request. It is not a replacement for the [source-verified brand report](gjh-newmoon-brand-research.md), an official brand guideline, a live checkout or a conversion study.

## Product Direction

Connect the brand's company-attributed 1959 story with a practical gifting journey: recipient → budget → dietary/certification needs → desired delivery date → product choice → gift message → official checkout or concierge conversation. WhatsApp is a parallel assisted-sales option, rather than the only way to buy. Its commercial value remains a hypothesis to test.

GJH remains the parent company with a business/brand directory and partnership purpose. New Moon, MILI and GOGO retain separate consumer identities. The existing company-first Gallery and its four corporate demos remain separate from this proposed New Moon brand experience.

## Reconciliation of the Supplied Research

| Supplied statement | Evidence-backed treatment |
| --- | --- |
| Abalone as the first product could not be sourced | Corrected: [New Moon's official history](https://www.gjh.com.sg/newmoon-history/) explicitly dates establishment to 1959 and identifies abalone as its first product. This is company testimony, not independent historical verification. |
| GJH's website has no history and names only a family | Corrected: [About Us](https://www.gjh.com.sg/about-us/) contains milestones and identifies the Goh brothers; individual full names are not established by that page. |
| New Moon's 1959 date also establishes GJH ownership timing | Keep separate: brand establishment, GJH's 1940s roots, later portfolio/acquisition references and legal incorporation are different events. Exact acquisition and incorporation claims need authoritative records. |
| GOGO's exact beginning is settled | Unresolved: the company timeline and GOGO page give conflicting years. Use a broad portfolio chapter with an explicit confirmation note; avoid a definitive GOGO date. |
| New Moon's official identity is yellow; its hex is unknown | Incomplete: the preserved original SVG has blue `#2E3192`, yellow `#FFF200` and white. These artwork fills do not constitute a complete brand manual. |
| Option A uses official yellow `#F2B705` | Retain the requested color as a **proposed warm-yellow accent**. It is not the verified SVG yellow and must not be labelled an official specification. |
| Current newmoon.com.sg is a Shopify password page | Not established by this review: the web-fetch tool resolved the domain to the official eShop collection; a direct local TLS check failed. Routing may vary with time/environment. Do not publish the Shopify claim as a current verified fact. |
| All abalone is a 425g, six-piece, three-origin range | Do not generalize. The library has exact NZ/Australia/South Africa 425g and Mexico 454g SKUs; counts, origin, price and certification belong to each product. |
| A recall can be described without its date or batch | Corrected: the [National Archives copy of AVA's release](https://www.nas.gov.sg/archivesonline/data/pdfdoc/AVA20090116001.pdf) is dated **16 January 2009** and concerns a specific 400g Thailand concentrated-broth batch. It is not a current recall of every New Moon abalone product. |
| This work has no visual/browser evidence and is 10% complete | That describes neither current repository state nor this task's acceptance. Corporate demo screenshots/browser evidence already exist. The new New Moon board is a raster proposal, with no implemented brand-site interactions yet. No unsupported percentage is assigned. |

Read-back scope and domain limitations are recorded in [reconciliation evidence](evidence/new-moon-brief-reconciliation.json). The Edge testing-domain feature remains attributed secondary background; no production equivalent was established. Competitor gaps, acquisition dates, registry/UEN claims and audience positioning from the supplied text remain leads unless independently rechecked.

## Option A Visual Specification

Use deep teal `#0B3A41`, ivory `#FAF6EE` and warm yellow `#F2B705`. The current concept uses a simple serif **NEW MOON placeholder wordmark**, as requested; it deliberately does not reproduce the real logo. Packaging, archival cards and food imagery in the board are generated concepts, not approved retail SKU images or documentary photographs. Runtime product cards must return to the source-verified asset/SKU rules.

Use strong editorial headings, generous whitespace, restrained paper/grain texture and a dark sea hero with one luminous crescent behind a plate of braised abalone. English body text should start at 16px; primary touch targets should be at least 44px. Real implementation should use semantic HTML controls and reduced-motion alternatives rather than conveying meaning through animation alone.

The hero phrase **“Since 1959. Made with love.”** is proposed campaign copy. Its historical date is company-attributed; the complete phrase is not documented as an approved brand slogan. “Taste of Love,” celebrity-ambassador history and seasonal messaging require their own dated campaign evidence before reuse.

## Five-Section Presentation Board

| Section | Desktop direction | Mobile direction and factual boundary |
| --- | --- | --- |
| 1. Immersive hero | Full-bleed teal-black sea, crescent, abalone plate; ivory/gold serif headline; Gift finder and Order on WhatsApp | Recompose imagery and headline vertically; keep both actions readable and a quiet scroll cue |
| 2. Heritage | Horizontal paper-card timeline: 1940s GJH roots, 1959 New Moon, 1980s portfolio chapter, today | One card and a next-card cue; archival images are labelled concepts, with unconfirmed chapter detail visible |
| 3. Gift finder | For parents / For clients / For myself; budget slider, halal-options toggle, date picker | Stack controls; certification and delivery are requirements to validate, not promises or actual filtering logic in this image |
| 4. Collection | Clean concept gift-box grid; grade, origin, price placeholder, card-message chip | Adaptive cards; no fabricated live prices, stock, discounts or certification badges |
| 5. Concierge | A calm conversation CTA | Green concierge action in a bottom bar, with safe-area space and a secondary gift action; no invented contact number |

The [ImageGen board](mockups/new-moon/option-a-v1/desktop-mobile-board.png) labels **1440px desktop** and **390px mobile** as design targets. They are annotated visual frames inside one generated raster, not pixel-exact browser viewport captures. The [generation specification](mockups/new-moon/option-a-v1/prompt.md) records copy, invariants and review limits.

## Contrast and Motion Acceptance

Contrast ratios were recomputed using the WCAG relative-luminance formula: yellow/teal **6.81:1**, ivory/teal **11.49:1**, yellow/ivory **1.69:1**. These are project calculations, not source-provided brand specifications. Use dark teal on yellow controls and ivory/yellow on teal. Yellow on ivory is decorative, not normal text. A static mockup cannot certify text contrast over textured photography; implementation must measure the final composited background.

Scroll/parallax is optional enhancement. Preserve the full story when animation is disabled. A horizontal timeline needs keyboard access and an obvious scrolling affordance; mobile may use native horizontal scrolling or a vertical alternative. A floating chat action must not cover product details, cookie controls, update notices or the home indicator.

## Functional Boundaries and Open Inputs

- **Gift finder:** exact catalog schema, certification evidence, currency/budget rules, recommendation logic and unavailable-result recovery are not yet implemented.
- **Commerce:** prices, inventory, delivery cutoffs, gift wrapping, hidden-price slips, payment support, guest checkout and corporate quotation terms need owner/channel confirmation. Do not add guessed CNY dates, PayNow/FPX/DuitNow/BNPL claims or shipping thresholds.
- **WhatsApp:** verify the destination number, channel owner, service hours and order process. The visual buttons do not send messages. Store neither inferred phone numbers nor unapproved tracking identifiers.
- **Privacy and attribution:** Meta/Pixel/CAPI, CRM conversion feedback, marketing consent and Singapore/Malaysia legal obligations require a separate primary-source design and authorization. No tracker, broadcast list or marketing integration is introduced here.
- **Evidence:** validate real archival material, current packaging masters, SKU-specific Halal status, product claims and approved copy. Generated history/packaging must not migrate into the official asset library.
- **Testing:** competitor/agency statistics are directional leads, not New Moon benchmarks. Do not use the supplied 1.3–2.4% range, uplift estimates or proposal “+10%” figures as measured project KPIs. Establish a baseline and test recipient selection, delivery confidence and checkout/concierge paths with actual users.

The immediate deliverables are the corrected research interpretation, a versioned Option A concept board and an implementation-ready product brief. Owner design feedback precedes any claim of an approved New Moon identity or working commerce flow.
