# GJH V11 shop-lot design

Independent virtual-mall concept. Slot allocation and brand-kit/product evidence are supplied design inputs, not proof of current tenancy, distribution, authorization, stock, or real premises. Storefront signs use the supplied logo assets and brand names as requested; product displays stay within each row's evidence level. Do not add real prices or medical claims. Hero products use their listed physical package/equipment dimensions when verified; otherwise use a clearly generic category-scale stand-in, never a false branded replica. Each storefront is glazed, with a visible display but no walkable interior.

The expanded layout is default. North storefronts S01–S05 face south; west S06–S11 face east; east S12–S17 face west. Existing runtime geometry, scale and stable IDs stay unchanged. Nearby displays render, while distant stores retain the glazed facade and branded sign. Sign artwork uses one shared 1536×1904 atlas, with higher-resolution logo/text cells and a 0.9 m sign height for the 17 slot labels; it remains one mesh/draw call. Expanded S01–S03 doors stay shut; classic 3-store mode retains its original entry behavior. Keep the New Moon red flagship accent alongside the shared forest-green, ivory, champagne-gold, warm-wood and light-stone palette. Target <=200 draw calls in sampled states.

LOD covers existing S01–S03 interior props and product/shelf instances as well as the new S04–S17 generated displays. Slot-bound meshes use a 12 m radius, generated interiors use 17 m, and instanced display shelves use 18 m. At most the nearest model-backed display within 11 m is rendered in full; other visible shops retain procedural stand-ins. Far stores show the facade/sign only; no interior becomes walkable in the expanded layout.

| Slot | Brand | Hero product | Evidence | Design idea | Models used / planned | LOD |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | New Moon | Premium Wild Caught New Zealand Abalone 425g | DETAIL_PAGE_VERIFIED | Flagship deep-red accent, dark timber and brass; preserve the existing real-scale can presentation near the door. | Existing New Moon NZ can and validated GJH M056 shelf. | Near: compact can/shelf view; far: facade + sign. |
| S02 | MILI | Vegetarian Oyster Sauce 510g | DETAIL_PAGE_VERIFIED | Warm-wood pantry counter, forest-green back panel and one scale-aware bottle study. | Generic generated bottle; mall glass showcase if it fits without blocking the door. | Near: one bottle/counter; far: facade + sign. |
| S03 | GOGO | Canned drinks and potong ice cream | CORPORATE_CATEGORY_ONLY | Bright ivory/teal chilled counter with unbranded can and ice-treat silhouettes; no unverified flavour or branded packaging. | Generic primitives; existing shelf/showcase only if appropriate. | Near: category display; far: facade + sign. |
| S04 | Borsch Med | Mosquito Repellent Patch 18 patches | DETAIL_PAGE_VERIFIED | Calm ivory personal-care counter; no efficacy claims. | Generic pharmacy counter. | Near: counter; far: facade + sign. |
| S05 | Pien Tze Huang | No verified GJH hero product | NOT_VERIFIED | Neutral traditional-medicine category bay; no implied GJH relationship. | Generic pharmacy counter. | Near: counter; far: facade + sign. |
| S06 | Flying Wheel | Air-Dried Singapore Ban Mee Noodles 70g | DETAIL_PAGE_VERIFIED | Light timber pantry shelving and one neutral noodle-pack stand-in. | Validated GJH M056 shelf; generic generated pack. | Near: single compact shelf; far: facade + sign. |
| S07 | Gu Long | Pork Leg Mushroom 397g cans | DETAIL_PAGE_VERIFIED | Warm timber canned-food shelf with neutral can stand-ins; do not reproduce commercial packaging. | Validated GJH M056 shelf; generic generated cans. | Near: one shelf bay; far: facade + sign. |
| S08 | Skippy | 500g Creamy Peanut Butter | DETAIL_PAGE_VERIFIED | Ivory-and-blue pantry shelf with one true-scale jar silhouette; surrounding shelf remains generic. | Validated GJH M056 shelf; generic generated jar. | Near: one jar and shelf; far: facade + sign. |
| S09 | SPAM | Classic Luncheon Meat 340g | DETAIL_PAGE_VERIFIED | Ivory pantry shelving and a generic true-scale can silhouette; no copied SPAM pack artwork. | Validated GJH M056 shelf; generic generated can. | Near: one shelf bay; far: facade + sign. |
| S10 | California Mexico | Red California Mexico Abalone 454g | BRAND_LISTING_VERIFIED | Pearl-stone showcase with restrained teal/coral accents; generic can, no unverified origin/ingredients. | Validated GJH M056 shelf; generic generated can. | Near: one can/display; far: facade + sign. |
| S11 | Hormel | Generic canned-food shelf; no specific product | NOT_VERIFIED | Neutral canned-food shelf only. No SPAM or Skippy relationship/product claim; no branded can labels. | Validated GJH M056 shelf; generic unlabelled cans. | Near: one generic shelf bay; far: facade + sign. |
| S12 | Zeria | Chondro Support 150 Tablets | BRAND_LISTING_VERIFIED | Cool ivory showcase and a plain, unbranded box stand-in; no health-benefit copy. | Local mall glass showcase (PASS local QA); generic generated box. | Near: single box/showcase; far: facade + sign. |
| S13 | Sony | MDR-E9LP In-Ear Headphone White | BRAND_LISTING_VERIFIED | Charcoal acoustic panel and ivory plinth. | Generic speaker soundbar. | Near: soundbar; far: facade + sign. |
| S14 | LG | UHD UR75 43 inch 4K Smart TV | BRAND_LISTING_VERIFIED | Stone gallery wall with generic television displays. | TV demo table and floor stand. | Near: TVs; far: facade + sign. |
| S15 | Casio | Celviano Grand Hybrid GP-510 Piano | BRAND_LISTING_VERIFIED | Warm timber music gallery. | Generic electronic keyboard, not a GP-510 replica. | Near: instrument; far: facade + sign. |
| S16 | GP | eTag Smart Locator Tracker White | DETAIL_PAGE_VERIFIED | White modular electronics display. | Generic battery display rack. | Near: rack; far: facade + sign. |
| S17 | Gigaset | A270 Single Cordless Phone | DETAIL_PAGE_VERIFIED | Graphite/ivory plinth. | Generic cordless phone display. | Near: phone display; far: facade + sign. |

## Source and model boundary

Hero names and evidence levels are from `~/omp-tasks/brand-products.tsv`; category, themes and source links are in `demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json`. Slot geometry comes from `demos/corporate/gjh/v11/assets/expanded-layout.js`, translated from the stage-1 spatial plan while preserving current shop placement. All 17 logo files are present under `demos/corporate/gjh/v11/assets/brands/` and mapped in `logo-sources.json`.

The upstream Blender checkout supplies the existing assets and optimized display models used in this scene. No Blender models were created or edited for this integration. Each new model's provenance and owner-project reuse terms accompany the vendored asset; public redistribution terms are unspecified.

## Product-model gaps and fallback record

The New Moon can variants remain the only verified slot-matched product GLBs; the NZ can is the S01 door-side hero at its existing measured scale. The validated `gjh-m056-premium-wall-shelf-straight` is instanced for S01 and food bays S06–S11. New display models are generic category representations, not replicas of specific listed products.

**NOT FOUND: matching verified hero-product models** for MILI sauce, GOGO category items, Borsch Med patch pack, any verified S05 GJH product, Flying Wheel noodles, Gu Long pork/mushroom cans, Skippy jar, SPAM can, California Mexico abalone, Hormel product, Zeria tablets, Sony earbuds, LG UR75 TV, Casio GP-510, GP eTag and Gigaset A270. Generic displays do not establish product availability or a brand relationship. S03, S05 and S11 remain generic category displays. The exact S05 product is intentionally absent because its GJH relationship is not verified; S11 has no supplied specific product.

**NOT FOUND:** an ice-cream cart or upright piano in the upstream model checkout. The watch-display-case has no matching watch shop, and aquarium-tank and koi-fish have no matching aquarium shop. The round-event-platform, arched-gateway-sign and skylight-roof-module have no matching product display in the supplied shop allocation; they are not used.

The displays sit near the glazing in the open bays, offset from the central visitor. Generic models are scaled up to 1.5× their exported metre scale and some use raised platforms; the phone remains a small tabletop object.

## Stage 5 performance evidence

On macOS Chrome ANGLE Metal, `tests/browser_gjh_v11.py` measured 139 draw calls in the default expanded view and a maximum of 200 in its sampled states. Walking, collision, doors, inspection, upper-deck access, reduced motion, context loss, failure fallback and no-JS browsing passed. These are single-run measurements, not a device-performance guarantee.
