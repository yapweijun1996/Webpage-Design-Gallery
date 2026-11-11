# GJH & New Moon — Web Asset Ideas and Production Plan

Status: proposed production brief, based on source inspection and an independent AI advisor review. It is not an approved official brand guide. Source capture: 11 November 2026.

## Purpose

Create enough authentic, relevant material for a strong company page and a distinct New Moon brand experience before making V3 mockups. The objective is useful coverage and recognizable products, not an arbitrary number of images.

## Asset Backlog

P0 = required for an authentic first redesign. P1 = high-value expansion. P2 = optional after real use is validated. Quantities are proposed production targets, not existing asset counts.

| Priority | Asset idea | Purpose / location | Authenticity and source | Current position |
| --- | --- | --- | --- | --- |
| P0 | GJH corporate logo master | Company card, corporate navigation, footer | Original corporate mark; vector preferred | Small original PNG exists; larger master needed |
| P0 | New Moon logo master | Brand card, product collection, brand navigation | Original SVG, no redraw or recoloring | Available in source-verified library |
| P0 | Separate brand logo tiles | New Moon, MILI, GOGO and Borsch Med portfolio | Each brand's own mark; consistent tile canvas is a layout choice | Original tiles available; high-resolution masters needed for enlargement |
| P0 | Four abalone SKU image sets | Origin/product comparison and product details | Front, alternate/reverse and nutrition views matched to exact country, size and product page | Eleven originals available across four SKU sets |
| P0 | Product-family lead images | Bird's nest, chicken essence, rice, sauces and abalone category cards | One approved real product per category; no generated packaging | Abalone ready; current individual masters for other families remain to collect |
| P0 | Real implementation previews | V1, V5, V6, V7 design cards and Compare | Capture actual pages at desktop/tablet/mobile sizes | Existing screenshot collection available; recapture after any implementation change |
| P1 | GJH corporate hero photography | Corporate overview and business trust | Real GJH premises, operations or a verified portfolio composition | No approved high-resolution corporate scene identified in the curated library |
| P1 | Three division visuals | FMCG, electronics, health/nutrition | Actual product portfolio or authorized real operations; distinguish owned brands from distributed brands | Use text-led cards until suitable images are sourced |
| P1 | Two or three archive photographs | Corporate/New Moon history | Original scans with date, subject, rights and caption | Only a low-resolution website composite is available |
| P1 | Current gift-set photography | Festive shopping and corporate gifts | Exact real bundle and contents, with campaign/edition context | Collect from current approved eShop product/campaign pages |
| P1 | Brand-neutral regional network diagram | Corporate distribution story | Code-native vector using verified scope; no invented facilities or market counts | New design needed; distinguish brand registrations from actual distribution |
| P1 | Three food occasion photographs | Family meal, festive table and gifting | Authentic food/product relationship; real packaging added only from preserved originals | Commission or use appropriately licensed photography; AI atmosphere must be labelled illustrative |
| P2 | Short real product/operations video | Brand storytelling or partnership section | Authorized original footage with poster, captions and controls | Not part of the first curated image library |
| P2 | Decorative patterns and textures | Backgrounds and section transitions | Non-factual illustration; low contrast and restrained use | Safe candidate for AI exploration, separate from official assets |

## Three Concrete Creative Directions

- **GJH — Corporate Portfolio:** authentic corporate mark, neutral background, separate division/brand modules, factual regional narrative, direct business-contact CTA. A source-matched portfolio collage is preferable to a fictional warehouse photograph.
- **New Moon — Product and Origin:** original logo, exact pack colors, four origin-led abalone cards, detailed SKU evidence and a clear official-shop path. The product remains the main subject.
- **New Moon — Family and Celebration:** real gift sets and original product packshots within a warm editorial layout. Add occasion photography and recipe stories without inventing products, labels, benefits or historical scenes.

These are design ideas, not new mockups or claims of conversion improvement.

## AI Enhancement Brief

| Treatment | Use |
| --- | --- |
| Resize, compress, create responsive image variants | Allowed with the original preserved and the derivative recorded |
| Background exploration without logos/products | Appropriate for AI-generated illustrative backgrounds |
| Background replacement around a product | Candidate only; preserve product pixels through controlled compositing or masking and compare against the master |
| Free regeneration of the full product image | Reject for live product cards; packaging details can drift even when instructed not to |
| Recreate logos, nutrition panels, Halal marks or small packaging text | Do not generate; use authentic source artwork |
| Invent GJH offices, staff or historical photographs | Do not present as company evidence; prefer text or verified imagery |

The existing New Moon enhancement attempt changed pack details, so the approved source photograph remained in use. Future AI-generated candidates need side-by-side inspection and an explicit pass/reject record. An attractive candidate does not become a factual product photograph.

## Suggested Output Specifications

These are project production recommendations, not official GJH/New Moon standards:

- Logo: preserve a vector master when available; no arbitrary recoloring, stretching or decorative effects.
- Product master: retain original resolution/bytes; aim for at least 1200px on the long edge when a better authorized original exists. Do not upscale a small file to imply new detail.
- Category card: responsive 4:3 derivative; keep packaging fully visible with `object-fit: contain` where needed.
- Hero: independently compose desktop and mobile crops; avoid placing essential text inside the bitmap.
- Design thumbnail: real 1440px rendered capture with a 720 × 450 thumbnail; keep version and capture context.
- Web derivatives: prefer WebP/AVIF where readable, with explicit dimensions, lazy loading below the fold and an eager primary hero. Start around 100–200 KB for a card and 200–350 KB for a hero, then measure actual quality and loading.
- Accessibility: meaningful product alt text, readable HTML headings, decorative images with empty alt text, and controls independent of image text.

## Acceptance for New Design Work

1. Every selected visual has an asset ID, original URL, referring official page, hash and source status.
2. Source provenance, project authorization and current packaging/brand approval are separate fields.
3. Company, brand, shop and individual product identities remain distinct.
4. Product view, origin and size match the exact source SKU. No blanket red/gold packaging treatment.
5. Missing corporate photographs and packaging masters remain visible backlog items rather than being replaced by fabricated evidence.
6. Company/design/brand cards use their correct evidence type: company facts and mark, actual page screenshot, or authentic brand/product asset.
7. Dates, sales leadership, certificates and geographic scope use the bounded language in the [research profile](../demos/corporate/gjh/research/company-profile.md).
8. New mockups are labelled proposals. Only implemented pages may be described as live demos.

## Deliverables and Ownership

- Original source files and machine-readable receipts: `assets/companies/gjh/official/`.
- Factual brand/research interpretation: [Brand Research Report](gjh-newmoon-brand-research.md).
- Visual inspection aid: [source contact sheet](screenshots/gjh-assets/source-contact-sheet.jpg).
- Existing implementation state: [read-only HTTP audit](evidence/gjh-brand-http-audit.json).
- Asset validation: `python scripts/verify_gjh_asset_library.py`.

The four corporate concepts now use selected original copies from the 26-asset library. Five official-site photographs were added: two lifestyle banners plus New Moon, MILI and GOGO covers. These fill lifestyle/brand presentation needs without claiming to depict GJH employees or facilities. V6 also uses four exact eShop SKU fronts. The remaining corporate-master, documentary-photo, gift-set and current-edition gaps above remain open. Additional assets should fill specific missing sections or product families, rather than expanding to 100 images without a clear role.

## Advisor Review Disposition

| Advisor recommendation | Decision for this project |
| --- | --- |
| Separate source provenance, project permission and brand-approved edition | Accepted; the manifest and report keep these states distinct |
| Obtain a better GJH corporate logo master and current individual product masters | Accepted as the highest-value acquisition backlog |
| Record SKU-specific origin, size and product-page context | Accepted; current packshots carry the exact source-page title and URL; avoid copying unrelated SKU facts |
| Preserve original packaging when improving visual presentation | Accepted; full-image regeneration that altered labels was rejected |
| Check publish/edit authorization | Existing user confirmation is recorded; independent contractual verification remains unknown, with no repeated permission request for the authorized scope |
| Add more assets only for a defined role | Accepted; prioritize authentic category, gift-set and corporate imagery over quantity |

Advisor role: one independent AI brand/ecommerce reviewer. The primary agent retained responsibility for source verification, file integrity, the final inventory and this production brief.
