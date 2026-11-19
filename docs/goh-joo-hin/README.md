# Goh Joo Hin virtual mall

Goh Joo Hin Pte Ltd traces its origins to a provision store started by the Goh brothers on Singapore’s Rochor Road in the 1940s. It now describes a regional distribution business spanning FMCG, electronics, and health and nutrition. Its timeline records the introduction of New Moon in 1959, MILI in 1981, and GOGO and Flying Wheel in 1982. The timeline also documents later distribution relationships in food and electronics. [Goh Joo Hin corporate history](https://gjh.com.sg/about-us/)

The 17 shops here are the V11 game’s authored roster. Some represent house brands, some represent partner or distributor relationships, and some are category-led concepts. The layout is an independent, unofficial virtual mall. Inclusion does not establish current exclusivity, ownership, a physical tenancy, endorsement, or permission to redistribute product images. [Goh Joo Hin brand overview](https://www.gjhglobal.com/) · [V11 shop programme](../gjh-v11-interior-program.md)

[Production model checklist](production-model-checklist.md) tracks the next numbered modeling passes and their acceptance evidence.

## Shop research index

| Unit | Shop |
| --- | --- |
| S01 | [New Moon](01-new-moon/brand-research.md) · [Design and player walkthrough](01-new-moon/README.md) |
| S02 | [MILI](02-mili/brand-research.md) · [Cookline exhibit and concept](02-mili/README.md) |
| S03 | [GOGO](03-gogo/brand-research.md) · [Cart exhibit and concept](03-gogo/README.md) |
| S04 | [Borsch Med](04-borsch-med/brand-research.md) · [Patch folio exhibit and concept](04-borsch-med/README.md) |
| S05 | [Pien Tze Huang](05-pien-tze-huang/brand-research.md) · [Carton exhibit and concept](05-pien-tze-huang/README.md) |
| S06 | [Flying Wheel](06-flying-wheel/brand-research.md) · [Loom exhibit and concept](06-flying-wheel/README.md) |
| S07 | [Gu Long](07-gu-long/brand-research.md) · [Tin pyramid exhibit and concept](07-gu-long/README.md) |
| S08 | [SKIPPY](08-skippy/brand-research.md) · [Jar exhibit and concept](08-skippy/README.md) |
| S09 | [SPAM](09-spam/brand-research.md) · [Conveyor exhibit and concept](09-spam/README.md) |
| S10 | [California Mexico](10-california-mexico/brand-research.md) · [Abalone exhibit and concept](10-california-mexico/README.md) |
| S11 | [Hormel](11-hormel/brand-research.md) · [Packing bench exhibit and concept](11-hormel/README.md) |
| S12 | [Zeria](12-zeria/brand-research.md) · [Product library and concept](12-zeria/README.md) |
| S13 | [Sony](13-sony/brand-research.md) · [Personal audio exhibit and concept](13-sony/README.md) |
| S14 | [LG](14-lg/brand-research.md) · [OLED exhibit and concept](14-lg/README.md) |
| S15 | [Casio](15-casio/brand-research.md) · [Keyboard exhibit and concept](15-casio/README.md) |
| S16 | [GP Batteries](16-gp-batteries/brand-research.md) · [Power exhibit and concept](16-gp-batteries/README.md) |
| S17 | [Gigaset](17-gigaset/brand-research.md) · [Handset exhibit and concept](17-gigaset/README.md) |

## Evidence standard

- All current designs, model placements, loader views and acceptance runs use the default expanded 17-shop layout. Classic 3-store is retained as a legacy route.
- Corporate or brand owner pages establish history, portfolio and market context. Product pages establish exact display selections. Unconfirmed local availability and packaging are recorded separately.
- Measurements specify metres in each shop’s authored local frame. “Installed” indicates V11 runtime evidence. “Proposed” requires another acceptance pass. The shop anchor is its main visual fixture. Use points, sitting poses and stand exits are interaction anchors.
- Chrome captures show the player camera in the running mall. Phone viewport evidence is Chrome touch emulation. Concept illustrations and model reference images convey visual intent, while linked GLBs are runtime assets.
- The scope of a reference link is documentation. Generated styling and shape studies omit unsupported label art and product claims. Exact packaging reproduction requires suitable source views and rights.

## Player walkthrough baseline

The 17 interiors were entered in Chrome from the public map landing on revision `032e3885`. Desktop used keyboard movement. Touch emulation used Chrome’s dispatched touchscreen input through the installed joystick. The browser baseline shows the authored exhibits at comparable walking positions. Some separate focal captures use the in-app first-person camera to evaluate fixtures outside the default chase frame.

[Desktop baseline contact sheet](player-walkthrough-baseline.webp)

## Published showroom verification

Every numbered concept packet includes four separate viewpoints, a floor plan, a product-model reference and a model inventory. The runtime work was checked in stages using desktop Chrome and a 390 px touch-emulated viewport. The entrance, exhibit action and return were verified in each group. The individual shop pages identify approximations, linked catalogue photographs and remaining package-art work.

| Units | Verified published build |
| --- | --- |
| S01 New Moon | `a793a237cd50e587` desktop, `95e5ba13a1d96807` touch emulation |
| S02 MILI | `f161060cbd89bbc0` |
| S03 GOGO | `077553e3b1a6c526` |
| S04 Borsch Med | `8e4599e605ef0138` |
| S05 Pien Tze Huang | `c59b32c3eb100103` |
| S06–S08 | `46a37ab996fabb31` |
| S09–S11 | `45dfc89d1e194c56` |
| S12–S14 | `ba278cec19153b4e` |
| S15–S17 | `95e5ba13a1d96807` |

The New Moon retest also exercised both stories, all four can previews and pickup/return interactions, both tasting seats and the demo bag. The last stage was followed by [continuous ground-floor circulation checks](../gjh-v11-public-facilities.md#continuous-ground-floor-loop). [Latest tested Pages deployment](https://github.com/yapweijun1996/Webpage-Design-Gallery/actions/runs/44555819324)
