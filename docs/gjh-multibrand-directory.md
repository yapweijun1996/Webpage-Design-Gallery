# GJH multi-brand directory and virtual mall plan

Reviewed: 14 November 2026. Status: documentation and proposed production scope, not an implemented multi-brand mall or a complete corporate brand register.

This is an independent, unofficial demo with no implied GJH or brand-owner endorsement. Public source availability is not an artwork licence. The owner's demo authorization is not independent proof of third-party rights. Existing demo models, source records, disclosures and verification evidence remain unchanged.

## Source scope and counting

The requested `gjh.com.sg` homepage timed out in this review. The official eShop links to `gjhglobal.com`; its corporate pages below were readable. Web retrieval on the review date includes indexed pages crawled from today to two months earlier, not a live contract audit.

- [Corporate brand navigation][directory]: **16 unique names**, after removing the repeated navigation copy: New Moon, Mili, Borsch Med, Flying Wheel, Gu Long, Gogo, Sony, GP Batteries, Casio, LG, Gigaset, Skippy, The SPAM, California Mexico, Hormel, Pien Tze Huang.
- [eShop Browse By Brand][shop]: **14 names**: New Moon, Borsch Med, Flying Wheel, Mili, GuLong, Skippy, Spam, Zeria, California Mexico, Casio, LG, Sony, Gigaset, GP.
- These are overlapping channel lists, not counts to add together. GP/GP Batteries, GuLong/Gu Long and Spam/The SPAM are normalized aliases for this research, not extra brands.
- The **22 requested names** below are a research scope including historical and unresolved candidates, not a verified total of active brands.

## Evidence-backed relationship register

`Listed` means only that an official channel names the brand. `Historical` means a dated corporate statement, not proof that its contract remains active. No row certifies legal ownership, territory, exclusivity today or reuse rights.

| Requested name | Evidence and bounded relationship | Planning category |
| --- | --- | --- |
| New Moon | Corporate history calls it a house brand. [History][history] | Food and beverage |
| MILI | Corporate history calls it the second house brand. [History][history] | Food and beverage |
| GoGo | GJH-managed/distributed product line. [Brand page][gogo] | Food and beverage |
| Hormel | Historical distribution, 2010 milestone. [History][history] | Food and beverage |
| Skippy | Listed; ownership/contract not established here. [Directory][directory] | Food and beverage |
| SPAM | Historical distribution, 2010 milestone. [History][history] | Food and beverage |
| GuLong | Listed; ownership/contract not established here. [Directory][directory] | Food and beverage |
| Flying Wheel | Listed; chronology unresolved below. [Brand page][flying] | Food and beverage |
| Dinty Moore | **NEEDS REVIEW**: supplied candidate, no corroboration in reviewed sources. | Food and beverage candidate |
| California Mexico | Historical distribution, 2010 milestone. [History][history] | Food and beverage |
| Shanghai Mailing | **NEEDS REVIEW**: supplied historical candidate, no corroboration in reviewed sources. | Food and beverage candidate |
| Borsch Med | Described as GJH's fifth brand, 2004. [History][history] | Health and nutrition |
| Pien Tze Huang | Listed; ownership/contract not established here. [Directory][directory] | Health and nutrition |
| Zeria | eShop-listed; corporate relationship unconfirmed. [Shop][shop] | Health and nutrition |
| Sony | Historical personal-entertainment distribution, 2011. [History][history] | Electronics and lifestyle |
| LG | Home-entertainment milestone, 2018. [History][history] | Electronics and lifestyle |
| Casio | Electronic-musical-instruments milestone, 2018. [History][history] | Electronics and lifestyle |
| GP Batteries | Historical distributorship, 2016. [History][history] | Electronics and lifestyle |
| Gigaset | Historical distributorship, 2006. [History][history] | Electronics and lifestyle |
| SteelSeries | Distribution partnership milestone, 2025. [History][history] | Gaming zone (proposed) |
| Philips | **NEEDS REVIEW**: supplied candidate, no corroboration in reviewed sources. | Electronics candidate |
| Aeries | Air-purifier introduction, 2021; ownership unconfirmed. [History][history] | Electronics and lifestyle |

The last column is an editorial mall-planning taxonomy, not a claim that GJH officially operates four divisions. Searches for the three unresolved candidates on the corporate domain yielded no results; absence from these pages is not proof of no relationship.

### Preserve unresolved history

The corporate timeline groups GoGo and Flying Wheel under 1982. The [GoGo page][gogo] says 1986; the [Flying Wheel page][flying] says 2004. Keep these disagreements visible rather than selecting an unsupported single founding year. The latter pages also contain generic placeholder sections, so those sections are not reliable brand guidance. Existing [company-profile historical caveats](../demos/corporate/gjh/research/company-profile.md) remain applicable, including New Moon's brand origin versus later portfolio acquisition.

## Multi-brand mall proposal, not implementation

Use a common accessible navigation and shopping shell with distinct brand storefronts. Do not recolour every brand into the New Moon identity or mistake the eShop logo for the corporate identity.

1. **Directory first:** maintain stable brand IDs and aliases; show evidence status and official links. Keep unsupported candidates in the research backlog, not in a live authoritative brand directory.
2. **Food hall:** extend the current food-led demo incrementally; retain current routes and products. Proposed independent stores can include New Moon, MILI and GoGo, then other source-backed brands once their product details are documented.
3. **Health zone:** separate product browsing from health claims. No invented efficacy, certification or treatment advice; verified SKU descriptions only.
4. **Lifestyle and gaming zones:** separate electronics from food displays. Gaming is a proposed navigation grouping, not a new official GJH division. No new floor/elevator behavior is delivered by this document.
5. **Per-brand production brief:** source-backed wordmark, palette evidence, SKU links, product dimensions, pack photographs, model provenance and demo disclosure. If a logo or pack master lacks usable rights evidence, record that gap rather than generate a counterfeit official asset.
6. **Shopping behavior:** reuse existing bag/cart state, mobile input and accessible List View. Each brand needs its own catalog association; 3D objects must not become a second price/inventory source. Real stock, payments and real checkout remain outside the demo.

### Proposed data contract

This is a planning contract only. No runtime schema, catalog or store count changes in this update.

| Field | Requirement |
| --- | --- |
| `brand_id`, `name`, `aliases` | Stable ID, display name, normalized aliases without duplicate registrations. |
| `relationship` | Separate `house_brand_reported`, `managed_distributed_reported`, `historical_distribution`, `channel_listed`, `unverified`; attach dated evidence, territory and scope where known. |
| `category` | Explicit editorial grouping, not inferred corporate organization. |
| `official_logo_url` | Null until the exact official source is checked; never infer a URL or licence. |
| `brand_page_url`, `source_urls` | Observed source links; null when unavailable. |
| `brand_owner` | Null unless ownership is supported; a distributor is not automatically the owner. |
| `authorization_status` | Separate owner project permission, third-party rights review and official endorsement. Unknown remains unknown. |
| `last_verified_at`, `verification_scope` | Date and exact claim checked. A page retrieval is not contract verification. |
| `implementation_status` | Planned, in progress or implemented, with separate evidence references. |

## Next bounded work and acceptance

- [x] Review supplied 22-name scope against official channel/history evidence.
- [x] Preserve historical disagreements and unverified candidates.
- [x] Document multi-brand structure and data-field proposal.
- [ ] Resolve unknown ownership/current distribution scope only when needed for a concrete publication claim.
- [ ] Prepare one brand storefront/SKU brief at a time, without replacing existing demo assets.
- [ ] Implement approved runtime changes separately; retain fallback shopping and independent-demo disclosures.

Documentation checks: all 22 supplied names included once in the relationship table; local Markdown links resolve; whitespace/diff reviewed. No runtime, browser, device, performance or packaging-certification result is claimed by this change. Existing test evidence remains intact. The current V11 runtime remains the source of truth for what users can actually do.

[history]: https://gjhglobal.com/about-us/
[directory]: https://www.gjhglobal.com/explore-our-brand/
[shop]: https://www.gjheshop.com/shop/
[gogo]: https://gjhglobal.com/gogo/
[flying]: https://gjhglobal.com/flying-wheel/
