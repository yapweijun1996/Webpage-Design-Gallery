# GJH & New Moon — Brand Research Report

Review date: 11 November 2026. Scope: official company/brand/shop information, original visual assets, existing public demos and requirements for a future V3 design. This is an independent research report, not a GJH brand manual or approval certificate.

## Executive Finding

The GJH company, New Moon consumer brand and GJH eShop storefront need distinct identities and user journeys. The current green serif GJH lettering in the demos is concept typography, not the official logo. Premium presentation should preserve authentic marks and packaging, and use factual content to establish relevance.

## Evidence Model

| Evidence | What it supports | What it does not establish |
| --- | --- | --- |
| Official corporate/brand pages | How GJH describes its business, brands and history | Independent corporate-registry or transaction verification |
| Official eShop SKU pages | A specific listed product, pack size and associated image at capture | A final current packaging master approved for a new campaign |
| Original image files and SHA-256 | Exact source bytes and the local copy's integrity | Licensing terms, endorsement or current certification |
| Actual demo screenshots | The captured implementation and viewport | Official company photography or measured user preference |
| User permission in this conversation | Project-specific authorization asserted by the owner | An independently inspected licensing agreement or reusable public licence |

The library separates `sourceStatus`, `pageContextVerified` and `editionStatus`. Do not combine them into one ambiguous "verified" badge. In particular, a source-verified asset can still need a higher-resolution master or packaging-edition confirmation.

## Company Profile and Brand Architecture

GJH's official profile describes a business with Rochor Road provision-store roots in the 1940s, spanning FMCG, electronics and health/nutrition, supported by regional distribution. Its company page identifies New Moon as a house brand; the New Moon page describes management and distribution by GJH. [1][2]

| Entity | Correct role in a website | Source treatment |
| --- | --- | --- |
| Goh Joo Hin Pte Ltd | Company identity, business portfolio, capabilities and partnership contact | Use corporate information and the corporate logo |
| New Moon | Consumer food brand, product families, heritage and gifting | Use the New Moon mark and exact product imagery |
| MILI / GOGO / Borsch Med | Separate portfolio brands with their own visual marks | Attribute to their respective official brand pages; do not merge identities |
| GJH eShop | Shopping channel carrying multiple brands | Its commerce logo is not a replacement for the corporate or New Moon mark |

The official navigation also lists brands such as Sony, GP Batteries, Casio, LG, Gigaset, Skippy, SPAM, Hormel, Flying Wheel and Gu Long. A navigation listing alone does not establish ownership, exclusivity, territory or a current distribution contract. [1]

The [company research profile](../demos/corporate/gjh/research/company-profile.md) remains the detailed factual reference, including historical discrepancies. New Moon's official history establishes a 1959 brand origin and abalone as its initial product. Keep that distinct from GJH's business origins and any subsequent brand acquisition date. [3]

## Identity and Visual Findings

| Item | Source observation | Design implication |
| --- | --- | --- |
| GJH corporate logo | Original 167 × 73px PNG: red/yellow oval GJH mark, with embedded "Since 1940" text | Preserve the original; obtain a vector or larger raster master before large placements |
| New Moon logo | Original 690 × 144 SVG: crescent-face device and blue/yellow wordmark | Use the source SVG, preserve geometry, lettering and colors |
| eShop logo | A separate red/yellow commerce mark with New Moon device | Use only in shop/channel context |
| Abalone packs | Source packshots visibly differ across New Zealand, Australia, South Africa and Mexico SKUs | Preserve SKU-specific packaging; do not recolor all products red/gold |
| Range composite | Official 2000 × 350 product strip shows multiple pack formats and colors | Evidence of product diversity; not a current approved master for every item |
| History visual | 550 × 240 official composite with a large 1940 overlay | Label as an official-site historical composite, not an original archive scan |
| Capabilities graphic | Official diagram uses four business-service themes | Treat as GJH self-description, not a certification badge |

These are observations of the captured files, not formal color codes or a typography specification. No formal brand manual, approved font list, clear-space rules, minimum logo sizes, trademark usage guide or campaign packaging-master list was obtained from the reviewed sources. Neutral layout colors and spacing can be proposed separately, but must not be called official brand standards.

The original New Moon SVG contains `#2E3192`, `#FFF200` and `#FFFFFF`. These are verified artwork values, not an inferred full corporate palette or permission to recolor other brands. Lettering in a logo does not establish the font to use for body text.

The logo's embedded date is part of the original artwork. Preserve it; retain the official profile's "1940s" wording for narrative history unless an exact founding date is separately confirmed. Do not infer an official Chinese brand name from the English translation "new moon"; use the supplied approved mark or English name until localization is evidenced.

## Product Verification

The library includes original product-page images for New Zealand 425g, Australia 425g, South Africa 4–5 pieces/425g and Mexico 454g abalone. Each asset is linked to its exact official SKU page, rather than matched by color alone. [4–7]

The official collection also lists bird's nest, chicken essence, rice, sauces and other food products. The two existing range photographs have 2022 upload paths; this is provenance information, not a production or expiry date. Obtain current approved individual packshots for new category pages. [8]

Do not extend a particular SKU's origin, nutritional information, allergen statement or Halal field to all New Moon products. The official brand page's cited best-selling claim concerns Nielsen research for 1999–2011; it does not demonstrate a 2026 ranking. Awards and certifications must retain their own dates and scope. [2]

## Current Demo Audit

A new read-only HTTP/HTML audit reproduced these image-element counts. It fetched every referenced image, rather than relying on the user-pasted claim about another tool or device.

| Demo | Image elements | Official marks / products in HTML | Result |
| --- | ---: | --- | --- |
| V1 | 1 | No official logo/product image references | All image responses 200 |
| V5 | 8 | No official logo/product image references | All image responses 200 |
| V6 | 11 | Three brand-logo references and one New Moon product-image reference | All image responses 200 |
| V7 | 11 | Same official-asset combination as V6 | All image responses 200 |

Evidence: [HTTP audit JSON](evidence/gjh-brand-http-audit.json). This establishes resource reachability and HTML references, not a new browser/accessibility audit. The corporate concept lettering still needs replacement in any future brand-authentic redesign. Existing design thumbnails are captured webpage previews, not official company pictures; retain that classification.

## V3 Content and Asset Rules

1. A company card represents GJH, using company facts and an authentic corporate mark or a neutral text treatment.
2. A design card shows an actual captured implementation and its version. It must not use a fictional mockup as evidence of a deployed page.
3. A brand card represents the named brand, using its own mark and, if useful, a source-matched product image.
4. Corporate scenes must be authentic, captioned and relevant. Missing facility/team imagery should use a text-led layout until real material exists.
5. AI may explore backgrounds, non-factual textures and generic illustrations. Product packaging, logo letters, certification marks and historical/documentary subjects must remain authentic. The earlier product-image enhancement was rejected because it altered packaging details.
6. A polished concept must not be labelled "official" or "brand approved" merely because some assets have official sources.

The [asset production plan](gjh-newmoon-asset-plan.md) defines the next deliverables and acceptance criteria. This research does not implement or approve a new mockup.

## Independent Advisor Review

One independent AI brand/ecommerce advisor reviewed the local library, contact sheet and official sources. This was an expert-style review, not a legal opinion, brand-owner approval or user study. Its main recommendations were accepted: separate source verification from current-master approval; prioritize a higher-resolution corporate mark and SKU-bound packshots; avoid fake facility/heritage imagery; preserve packaging pixels in any derivative; and keep actual implementation screenshots separate from brand assets.

The advisor's request to verify publishing/editing rights was reconciled with the user's existing confirmation authorizing project use and AI enhancement. This record preserves that authorization without claiming an independently inspected contract or asking the user to grant the same scope again. Missing packaging masters and a formal brand guide remain content-quality gaps, rather than an invented permission block.

## Primary Sources

1. [GJH — About Us](https://www.gjh.com.sg/about-us/)
2. [GJH — New Moon](https://www.gjh.com.sg/newmoon/)
3. [GJH — New Moon History](https://www.gjh.com.sg/newmoon-history/)
4. [Official eShop — New Zealand 425g](https://www.gjheshop.com/product/new-moon-premium-wild-caught-new-zealand-abalone-425g/)
5. [Official eShop — Australia 425g](https://www.gjheshop.com/product/new-moon-premium-wild-caught-australia-abalone-425g/)
6. [Official eShop — South Africa 425g](https://www.gjheshop.com/product/new-moon-premium-south-africa-abalone-4-5pcs-425g/)
7. [Official eShop — Mexico 454g](https://www.gjheshop.com/product/new-moon-premium-mexico-abalone-454g/)
8. [Official eShop — New Moon collection](https://www.gjheshop.com/brand/new-moon/)

Every visual source URL and referring page is separately recorded in the [asset manifest](../assets/companies/gjh/official/manifest.json).
