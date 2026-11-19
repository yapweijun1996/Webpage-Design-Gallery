# GJH v11 · Interior programme for 17 walkable shops

**Phase 1 decision.** Build eight signature fixtures and derive nine entrance anchors from the existing Blender library. Preserve the shared shell, glass doors, fascia system and lighting quality. Use a different silhouette, palette and floor composition in each room. The complete Low design allocates **35,996 triangles across all 17 shops**, even if all full fit-outs are counted together. The largest shop is New Moon at **2,928**. These are the original complete-room design allocations. The as-built incremental budget and live acceptance are below.

The [machine-readable programme](gjh-v11-interior-program.json) contains every placement, repeated transform, model source, licence record, active-scene measurement, clearance result and cost allocation. Room numbers and merchandise evidence follow the [brand kit](../demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json).

**Round two.** The installed Low fit-out uses 34,490 triangles across all 17 shops. Gu Long is the largest at 2,730. The final review includes staging images, updated per-shop measurements and browser verification limits. [Installed fit-out](#installed-fit-out) · [Per-shop detail and evidence](#how-to-verify)

## S0 and S1 layout contract

Edit the shop's `items` in the [programme](gjh-v11-interior-program.json). Each row is one placed instance. Its ID, support, local transform, outer dimensions, collision owner, tier representation, action list, accessible name, standing point and horizontal reach travel together. The GLB provenance manifest retains the hash of the original design used to author those assets. The projections used by the kit, four New Moon cabinets and MILI benches come from the current programme.

Run `python3 scripts/gjh_interiors/build_layout.py` before the four gallery generators. Node checks the [schema](gjh-v11-interior-program.schema.json), generated projections and measured kit budgets. Run `node scripts/gjh_interiors/sweep.mjs` for the slot-by-slot floor report. The offline grid tests a 0.28 m capsule and a 0.60 m aisle radius from the open doorway, checks a 0.75 m turning radius, and includes the 14 wing studios' original collision boxes. Horizontal reach is measured to the item envelope. Wall and suspended items use authored mounting surfaces. The three sample rooms also have an entrance sightline test. Final camera visibility, mesh contacts and input delivery require a browser walkthrough.

| Sample | Entrance focus | Side operation and return |
| --- | --- | --- |
| New Moon | Collector triptych above four cabinets | Read the orchid-side photo, pour at the tea island and follow the open centre to the four pickup positions. Each leaves 0.395 m beyond the capsule at the shelf face. |
| MILI | Copper hood over the sampling island | Both the procedural serving plate and the tasting plate in the unchanged detail GLB meet the 1.22 m counter. Use the front plate or side boiler. The revised bench positions keep a wide passage to the herbs at the rear. |
| GOGO | Potong cart on the left | Ring the bell, pick up a treat, pour at the right bar and return between the two seat exits. The S1 plan calls for open floor at the centre. |

**Integration pending.** The render lane's `world.js` still creates GOGO's coffee table, fallback geometry, pot and solid. The [render-lane patch](../scripts/gjh_interiors/gogo-world.patch) applies the programme's centre-fixture selection to the legacy builder. Until it lands, run the sweep with `--legacy-table` to include the installed obstruction. The historical Rapier replay in `tests/gjh_interiors_layout.test.mjs` stops at z = 1.63 m with the table. Individual action wiring follows in S2.

## Entrance views

| Slot | Store | Room and entrance anchor | Material palette, dominant first | Accent | Exclusive prop family |
|---|---|---|---|---:|---|
| S01 | New Moon | **Collector’s pantry**<br>Hinged walnut collector cabinet with brass photo recess | smoked walnut #513527<br>brushed brass #B59A68<br>pearl linen #F2EFE8<br>oxblood lacquer #833E36 | 2850 K | folding collector-cabinet leaves |
| S02 | MILI | **Open noodle kitchen**<br>Hammered-metal hood over the lacquer pass | red-brown lacquer #833D2D<br>moss tile #49634B<br>bone ceramic #F1E9D7<br>brushed copper #AA7151 | 3050 K | suspended cookline extraction hood |
| S03 | GOGO | **Potong garden bar**<br>Potong parasol cart on a citrus sunburst | citrus enamel #E7863B<br>lagoon tile #2E7C7A<br>coconut terrazzo #F5F0E5<br>leaf green #4F7047 | 3900 K | three-wheel potong parasol carts |
| S04 | Borsch Med | **Patch library**<br>Fan-fold patch folio counter | porcelain #F8F7F1<br>powder sage #63745D<br>plum felt #6B4A55<br>pale ash #CFBEA7 | 4200 K | fan-fold patch sample folios |
| S05 | Pien Tze Huang | **Herbal counting house**<br>Stepped drawer bank with open porcelain niche | ink-stained elm #352C28<br>warm parchment #E9DDBF<br>cinnabar #9E3F35<br>aged copper #A87249 | 2650 K | stepped specimen-drawer banks |
| S06 | Flying Wheel | **Air-drying workshop**<br>Slatted noodle-drying loom | pale beech #D7BB87<br>wheat #C6A66C<br>slate-blue casein #536777<br>rice paper #F0E9D9 | 3300 K | ban mee drying combs |
| S07 | Gu Long | **Banquet provision hall**<br>Jade drum and stepped banquet pyramid | oxblood lacquer #742E29<br>jade glaze #4F6E5A<br>rice silk #EFE4D0<br>patinated bronze #9A794D | 2750 K | banquet tin pyramids |
| S08 | Skippy | **Breakfast stand**<br>Jar stand in a striped breakfast booth | sky-blue enamel #70A9D4<br>navy canvas #1D3A64<br>peanut maple #E8D1A3<br>butter yellow #F4CB69 | 3650 K | peanut-jar breakfast stands |
| S09 | SPAM | **Canning-line grocer**<br>Diagonal tinning conveyor | blue-black steel #173B68<br>tinplate #B5C0C1<br>ochre enamel #E4B63F<br>rubber #303639 | 3450 K | tinning-line rollers |
| S10 | California Mexico | **Coastal gift market**<br>Standing oyster-shell gift cradle | shell limestone #F0EAE0<br>sea-glass teal #2C7776<br>coral ceramic #C65B46<br>oiled teak #956847 | 3550 K | open nacre shell cradles |
| S11 | Hormel | **Provision packing room**<br>Wrapping station with a high kraft-roll rail | kraft board #BE9062<br>burgundy steel #843E43<br>zinc #767976<br>cream paper #EEE7D9 | 3150 K | parcel-wrapping benches |
| S12 | Zeria | **Quiet dispensary**<br>Layered opal index-fin island | opal resin #F1F3F1<br>seafoam #B6D2C8<br>indigo slate #3C4A66<br>anodised teal #6F9690 | 4650 K | frosted dispensary index fins |
| S13 | Sony | **Listening studio**<br>Headphone listening rack against a ribbed acoustic baffle | charcoal felt #292B2D<br>black glass #14171C<br>bead-blasted silver #BFC3C5<br>ice blue #A6D7EB | 4100 K | suspended headphone hooks |
| S14 | LG | **Living picture gallery**<br>Two-scale screen wall with a gallery reveal | gallery white #F5F3EF<br>satin aluminium #BEC1C2<br>aubergine velvet #5B3F7A<br>blush limestone #DBBEB1 | 4000 K | staggered picture-window screens |
| S15 | Casio | **Chamber recital room**<br>Open baby grand and bench on recital oval | piano lacquer #202123<br>oiled walnut #76543D<br>key ivory #F1EDE2<br>oxblood wool #723F46 | 2900 K | raised baby-grand lids |
| S16 | GP | **Locator workshop**<br>Perforated eyelet demonstration rail | powder white #F4F5F2<br>anodised teal #3D8C8A<br>lime polymer #B7C94A<br>graphite rubber #363C3D | 4900 K | overscale locator eyelet rails |
| S17 | Gigaset | **Domestic telephone bureau**<br>Gabled private-call alcove with open front | graphite felt #4A4D50<br>satin nickel #B8BBBD<br>chalk #F5F4EF<br>apricot cork #D99E74 | 3200 K | gable-roof handset niches |

## What the baseline shows

The three supplied PNGs are 1,179 × 1,836 pixels, exactly three times the requested 393 × 612 frame in each dimension. In the New Moon capture, the painted circular blossom occupies roughly 104 CSS px across while four full shelf bays below read as narrow, almost continuous bands. In MILI the square food photograph and extractor line up over the island while the small loose bottle sits by itself in the foreground. GOGO reads through its rear photograph and repeated seating, with the bar partly cropped at screen right. All three have a substantial uninterrupted cream foreground. The new floor fields lead to actual objects. Retain the hospitality, artwork and functioning product/seat interactions in these rooms. Use the same entrance camera for the next comparison. [New Moon](evidence/interiors/lap_BASE_newmoon.png) · [MILI](evidence/interiors/lap_BASE_mili.png) · [GOGO](evidence/interiors/lap_BASE_gogo.png)

The [shop-lot brief](gjh-v11-shop-lot-design.md) describes an earlier closed-window stage. All 17 slots have active arrivals in the current expanded layout. S04–S17 already have distinct authored furniture, permanent scenery and sliding leaves. Their local scenes contribute **164,950** procedural triangles before GLBs, as measured by evaluating both studio builders with the vendored Three geometry constructors. Per-room counts appear below. The front fixture, atlas cards, shell outside those builders, shadows and loaded models are separate. Wing-level merging can submit hidden-neighbour geometry. Full-frame GPU submissions are **UNVERIFIED**. [Layout](../demos/corporate/gjh/v11/assets/expanded-layout.js) · [Studios and LOD](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [Window rooms](../demos/corporate/gjh/v11/assets/window-studios.js) · [Walkthrough](../tests/gjh_shop_walkthrough.mjs)

S01–S03 each have a 1,024 × 576 painted back wall. S01’s blossom roundel and the painted niches are flat. The glass displays, M056 cabinets and tasting island have depth. S02 and S03 have official cover images in front of the painted backing. The expanded floor uses a single pale slab. The bordered rug branch is for the classic layout. S04–S17 have a permanent wing studio and illustrated window/rear-name atlas, additional local geometry inside 17 m and at most one model-backed front hero inside 11 m on the ground level. The 17 logo/story plaques are on the **upper deck**, outside these shop inventories. [Original rooms](../demos/corporate/gjh/v11/assets/world.js) · [Original details](../demos/corporate/gjh/v11/assets/shop-anchor-details-first.js) · [Late-room details](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js) · [Upper wall](../demos/corporate/gjh/v11/assets/brand-wall.js)

### Art and merchandise

Use the supplied official shop logo mapped by slot, retain its aspect ratio and leave a quiet margin. New Moon has four sourced official front packshots, plus project-scoped approval for the existing four can candidates. Put the enlarged **photograph** in a cabinet pocket or reading stand, keep the physical can at its existing nominal 0.0775 m diameter × 0.124 m height and make the closer read approachable. Preserve the four shelf IDs, selection and pickup/return at all LODs. Treat any other identifiable package face as **UNVERIFIED** unless its own official file and project-use evidence are recorded. For those stores use plain shapes, empty holders and official logos on architecture. The brand-kit hero WEBPs are illustrative artwork. The signage sheet and architectural reference images are visual direction only. [Logo register](../demos/corporate/gjh/v11/assets/brands/logo-sources.json) · [Image sources](../demos/corporate/gjh/v11/assets/sources.json) · [Can approval](../demos/corporate/gjh/v11/assets/newmoon-demo-source.json) · [Brand research by slot](../demos/corporate/gjh/v11/assets/brand-kit/brand-kit-sources.md)

S03 supports drinks and frozen treats at category level. S05 and S11 have no verified GJH SKU in this brief. S10 is a canned-abalone listing, so it gets a coastal gift market. S13–S15 use generic audio, screen and piano forms. An over-ear display, generic TV and acoustic baby grand establish the room category without representing a specific listed model. S16’s personal tracker and a windscreen toll tag have different purposes. Use the eyelet as an architectural motif. Introduce no flavour, health, performance, price or distribution claims. [Shop-lot evidence](gjh-v11-shop-lot-design.md) · [Brand sources](../demos/corporate/gjh/v11/assets/brand-kit/brand-kit-sources.md)

### Coordinates, access and contact

All positions below use **slot-local metres**. Origin is the nominal expanded lot’s centre at world floor Y=0. +Y points up, +Z points through the door to the arcade, +X points to a visitor’s right when looking in. With yaw θ, world X = centreX + x cosθ + z sinθ and world Z = centreZ − x sinθ + z cosθ. The north, west and east yaws are 0°, +90° and −90°. North lots measure 10 × 12 m. S01–S03 occupy only 10 × 10.5 m of their lots. The actual rear wall is at local z=−4.5. Wing lots measure 8 × 10 m. For S04–S17 the studio back-wall centre is −depth/2 + 0.38, side-wall centres are ±(width/2 − 0.23) and the floor top is 0.081 m. [Slot frame](../demos/corporate/gjh/v11/assets/expanded-layout.js) · [Original zones](../demos/corporate/gjh/v11/assets/spatial.js) · [Studio](../demos/corporate/gjh/v11/assets/window-studios.js)

The arrival is 2.4 m outside each threshold. The original opening spans 4.7 m. The other 14 have a 2.48 m physical opening. Keep glazing, jambs, moving leaves and their travel free. Preserve the positive-X contact podium at x=3.0 m in S04/S05 or 2.55 m in the wings, z=front−1, with its 2.18 × 1.16 m footprint. Walk 3.45 m in, move laterally at that depth, then browse to 7.4 m in the late shops. Use x=+2.1 except S09 +1.7, S15 +2.8 and S16 0. Retrace to exit. In the originals preserve the rear pick/story approaches. GOGO keeps its original benches. MILI uses the S1 bench positions in the table below. Keep the lift at world (−3,10), public deck and all seat logic intact. [Physical doors](../demos/corporate/gjh/v11/assets/world.js) · [Contact assertions](../tests/gjh_shop_collisions.mjs) · [Seats](../demos/corporate/gjh/v11/assets/seat-placements.js) · [Lift](../demos/corporate/gjh/v11/assets/lift-layout.js)

The following static distances are from the planned route centreline to the nearest rotated furniture envelope below 2.10 m, including seat exit points, the retained contact podium and relevant retained islands. Subtract the 0.30 m walking capsule radius for the available margin. At S01 the limiting point is the existing pickup by the cabinet, leaving 0.04 m. Within the original M056 row keep native mesh and interaction bounds aligned. At S02 retain the two paths past the lacquer island. Static checks cover proposed solids on these routes. Dynamic camera, leaf, NPC, bench and cart interactions remain **UNVERIFIED**. Replace retired scenery and its decorative collider as a pair. Register the final proxy envelope before late GLBs can appear. [Player capsule](../demos/corporate/gjh/v11/assets/player.js) · [Shelf bounds](../demos/corporate/gjh/v11/assets/products.js)

## Store schedules

Each row gives a bottom-centred assembly position and local yaw in degrees. Repeated positions share that yaw. Envelopes and mount heights are in the JSON. Neutral fixtures may be resized or reworked to fit their sockets. Preserve product proportions and verified interaction geometry. For pendants, normalise the source ceiling pivot to the bottom of the allocated envelope. Light, floor, colour and temperature specifications are design targets.

### S01 · New Moon — Collector’s pantry

A walnut collector’s cabinet opens above four working seafood shelves like the leaves of a folding screen.

**Today.** Painted plum roundel with side niches. Gold-edged coffers and disc pendant. Four M056 cabinets with 204 native-size tins. Stone tea island, kettle, three cups, two stools, window shelving and a plant. Official New Moon cover on left wall. The back-wall vessels and blossom are painted architecture. Current GLB assignments in triangles per instance — gjh-m056-shelf-lod1 3,132, new-moon-can-nz-425g-lod1 3,044, new-moon-can-au-425g-lod1 3,044, new-moon-can-sa-425g-lod1 3,044, new-moon-can-mx-454g-lod1 3,044, kopitiam-kettle 2,888, kopitiam-saucer-and-cup 2,708, GJH_PUB_008 5,160, GJH_LGT_009 540. [world.js](../demos/corporate/gjh/v11/assets/world.js) · [shop-anchor-details-first.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-first.js) · [products.js](../demos/corporate/gjh/v11/assets/products.js) · [furnishings.js](../demos/corporate/gjh/v11/assets/furnishings.js)

**Placement.** North (10, 12) m lot, world centre (-10, 0, -6), door world (x,z) (-10, 0). Minimum cabinet-face clearance at the pickup positions is 0.675 m. Keep four shelf targets. Lift the focal image above the shelf line. Use the right tea island and left reading stand as secondary stops.

Fasten the upper triptych to the structural back wall on concealed spacers. The four original M056 centres span x ±3.63 m and reach x ±4.83 m at the outer trim. Those existing extremities intersect the wall lining. Preserve the four functional bounds and trim the new visual returns to the wall face.

**Floor and light.** A navy woven runner widens at the four shelf pickup points. Twin brass threads lead back to the door. Field (8.05, 6.35) m, centre (0, 0.0245, -0.1), yaw 0°. 2850 K. Rake light across the projecting leaf edges and leave the recesses dark.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Hinged walnut collector cabinet with brass photo recess** | NEW · `collector-triptych` | (0, 2.47, -3.46) | 0° |
| Four active collection cabinets | `gjh-m056-premium-wall-shelf-straight` | (-3.39, 0, -3.25) / (-1.13, 0, -3.25) / (1.13, 0, -3.25) / (3.39, 0, -3.25) | 0° |
| Tea kettle at stone island | `kopitiam-kettle` | (2.8, 1.185, 1.45) | -26° |
| Three tasting cups | `kopitiam-saucer-and-cup` | (2.3, 1.185, 2.54) / (2.8, 1.185, 2.73) / (2.36, 1.185, 1.95) | 0° |
| Two walnut tasting stools | `mall-bar-stool` | (1.49, 0.025, 2.71) / (1.49, 0.025, 1.42) | 0° |
| Amber globe over tea service | `mall-globe-pendant` | (2.65, 3.37, 2) | 0° |
| Orchid at the entry-side return | `orchid-planter` | (-3.6, 0.025, 3.7) | 0° |
| Brass reading sconce at the rear-left leaf | `mall-wall-sconce` | (-3.08, 3.32, -4.04) | 0° |
| Linen-framed official NZ front photograph | `mall-directory-standee` | (-2.64, 0.025, 2.32) | 12° |

### S02 · MILI — Open noodle kitchen

A low lacquer pass and a broad copper extraction hood frame the preparation of a bowl, with condiments within reach of the cook.

**Today.** Tiled island and extraction hood in front of framed food art. Left oak cabinet run and stocked lit shelves, two benches, plants, window pieces and a small neutral bottle by the entrance. Framed MILI cover at rear, painted cabinet wings and tiled side backsplash. Current GLB assignments in triangles per instance — GJH_PUB_002 5,640, GJH_PUB_008 5,160, GJH_LGT_009 540, condiment-bottle-jar-set 14,092. [world.js](../demos/corporate/gjh/v11/assets/world.js) · [shop-anchor-details-first.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-first.js) · [seat-placements.js](../demos/corporate/gjh/v11/assets/seat-placements.js) · [furnishings.js](../demos/corporate/gjh/v11/assets/furnishings.js)

**Placement.** North (10, 12) m lot, world centre (0, 0, -6), door world (x,z) (0, 0). Static minimum route clearance 0.430 m to the fixture. Re-skin the island within its collision box. Route around the island on either side to benches and the rear story point.

Carry the hood to the retained ceiling on a narrow copper duct at local (0,4.65,0.5), yaw 0°, in a 0.48 × 1.92 × 0.50 m envelope. Charge the duct to retained fixtures.

**Floor and light.** Cream quarry tile through the aisle, with a moss border turning around the island and terminating before both seat exits. Field (5.85, 5.45) m, centre (0, 0.0245, 0.5), yaw 0°. 3050 K. Warm the underside of the pass hood. Leave the side benches in softer light.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Hammered-metal hood over the lacquer pass** | `hawker-stall-exhaust-hood` | (0, 2.38, 0.5) | 0° |
| Lacquer island base with counter | `kitchen-cabinet` | (0, 0.025, 0.5) | 0° |
| Recessed noodle boiler | `noodle-boiler` | (0, 1.22, 0.3) | 0° |
| Condiments on oak pantry shelf | `condiment-bottle-jar-set` | (-4.43, 3.0425, 3.25) | 90° |
| Chopsticks on the opposite pass corner | `chopstick-holder` | (-0.53, 1.22, 1.31) | 0° |
| Serving plate on the counter | `mamak-stainless-steel-plate` | (0.45, 1.22, 0.98) | 0° |
| Two existing seat and stand points | `gjh-lounge-bench` | (-2.55, 0, -0.8) / (3.4, 0, -1.97) | 180° |
| Warm ceramic wall lights | `mall-wall-sconce` | (-3.08, 3.32, -4.04) / (3.08, 3.32, -4.04) | 0° |
| Rear kitchen herb-garden planter | `orchid-planter` | (-3.8, 0.025, -2.8) | 0° |

### S03 · GOGO — Potong garden bar

A scalloped parasol and compact ice-cream cart bring a street-side frozen-treat bar indoors.

**Today.** Rounded tea niches, slatted pergola and a timber garden wall. Right bar, coffee machine, three stools, central coffee table, two benches, rear pots, tiny generic can and frozen-treat form. Rear GOGO cover on a painted green arch. Garden shelves on the left. Current GLB assignments in triangles per instance — GJH_PUB_002 5,640, GJH_PUB_008 5,160, GJH_LGT_009 540, GJH_PUB_005 4,272, coffee-machine 2,944, gogo-bar-stool 5,544. [world.js](../demos/corporate/gjh/v11/assets/world.js) · [shop-anchor-details-first.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-first.js) · [seat-placements.js](../demos/corporate/gjh/v11/assets/seat-placements.js) · [furnishings.js](../demos/corporate/gjh/v11/assets/furnishings.js)

**Placement.** North (10, 12) m lot, world centre (10, 0, -6), door world (x,z) (10, 0). Static minimum route clearance 0.775 m to the fixture. Keep right bar and both seats. Replace coffee table and redundant front-left display with the left cart reading from the threshold.

**Floor and light.** Broad curved terrazzo bands sweep from the left wheel to the right bar. A coconut-coloured centre stays open. Field (7.35, 4.2) m, centre (0.18, 0.0245, 2.28), yaw 0°. 3900 K. Wash the underside of the citrus canopy in daylight white and bounce teal off the bar face.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Potong parasol cart on a citrus sunburst** | `ice-cream-cart-potong` | (-2.35, 0.025, 2.05) | 12° |
| Twin dispenser on the right bar | `drink-dispenser` | (2.87, 1.26, 3.53) | -90° |
| Lagoon-tiled bar carcass | `mall-coffee-counter` | (3.15, 0.025, 3.6) | -90° |
| Three stools facing the counter | `mall-bar-stool` | (1.93, 0.025, 2.6) / (1.93, 0.025, 3.6) / (1.93, 0.025, 4.6) | 90° |
| Twin lounge benches with existing sit actions | `gjh-lounge-bench` | (-3, 0, -0.8) / (3, 0, -0.8) | 180° |
| Coconut globe above the bar | `mall-globe-pendant` | (2.7, 3.4, 2.3) | 0° |
| White cold chest in the rear-left bay | `freezer-cabinet` | (-2.8, 0.025, -3.19) | 0° |
| Ferns in the rear planter bed | `tropical-fern-cluster` | (3.78, 0.025, -3.1) | 0° |
| Citrus tray at counter end | `food-tray` | (3.16, 1.26, 4.58) | -90° |

### S04 · Borsch Med — Patch library

A sage sample counter opens into an oversized folding folio whose white leaves hold plain patch cards.

**Today.** Dusty-rose fluted oval counter and shaded lamps. Rear pack shelves, blossoms, pendant and plant. Pharmacy service counter and patch display. Sage shelving frames the rear name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 9,032 triangles and register 12 boxes. Current GLB assignments in triangles per instance — pharmacy-counter 6,696, mosquito-patch-pack 9,680. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js)

**Placement.** North (10, 12) m lot, world centre (20, 0, -6), door world (x,z) (20, 0). Static minimum route clearance 1.331 m to the fixture. Replace the centre counter with the folio, keep a low service counter on the left.

Shape the inner folio leaf around a level 1.15 m sample socket. Keep the pale cards and vase silhouetted against the sage wing.

**Floor and light.** A pill-shaped sage terrazzo field surrounds the folio. A plum stitching line turns along its visitor side. Field (4.72, 3.32) m, centre (-0.48, 0.081, -0.63), yaw 7°. 4200 K. Graze the folded leaves from the side to separate their edges from the white wall.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Fan-fold patch folio counter** | NEW · `patch-folio` | (-0.48, 0.081, -0.63) | 7° |
| Unlabelled patch samples on folio shelf | `mosquito-patch-pack` | (-0.48, 1.15, -0.51) | 7° |
| Sage service counter in left rear bay | `pharmacy-counter` | (-3.97, 0.081, -1.8) | 90° |
| Shallow ivory wall cabinet | `medicine-cabinet` | (4.17, 1.88, -1.1) | -90° |
| Matte entrance-side dispenser | `hand-sanitizer-stand` | (-3.49, 0.081, 3.22) | 7° |
| Plum ceramic orchid pot | `orchid-planter` | (2.63, 0.081, -4.58) | 0° |
| Diffuse white counter light | `mall-linear-ceiling-light` | (-0.48, 3.3, -0.63) | 0° |
| Blank paper swatch easel | `mall-directory-standee` | (-4.01, 0.081, 0.4) | 80° |
| Wall washer over the samples | `mall-wall-sconce` | (4.17, 2.74, 0.3) | -90° |

### S05 · Pien Tze Huang — Herbal counting house

A bank of stepped dark-wood drawers opens around a single pale porcelain bowl in a quiet apothecary.

**Today.** Timber apothecary, circular porcelain niche and lanterns. Drawer wall, three rear shelves, central cabinet and blossom vase. Pharmacy counter and box stand. Circular niche on the side wall and rear name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 22,768 triangles and register 11 boxes. Current GLB assignments in triangles per instance — pharmacy-counter 6,696, medicine-health-box-set 9,624. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js)

**Placement.** North (10, 12) m lot, world centre (30, 0, -6), door world (x,z) (30, 0). Static minimum route clearance 1.870 m to the fixture. Rotate the drawer story to the entrance sightline. Retire the duplicated pharmacy counter.

**Floor and light.** Inset a parchment-coloured woven reed field in dark boards with a narrow cinnabar seam at the drawer face. Field (6.95, 4.55) m, centre (0, 0.081, -2.6), yaw 0°. 2650 K. Light drawer pulls from above and pool amber light on the bowl.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Stepped drawer bank with open porcelain niche** | NEW · `specimen-drawers` | (0, 0.081, -4.38) | 0° |
| Single pale bowl and saucer in drawer niche | `kopitiam-saucer-and-cup` | (0, 1.36, -4.15) | 0° |
| Unmarked cartons on a parchment stand | `medicine-health-box-set` | (-3.49, 0.081, 3.22) | 7° |
| Dark-framed specimen vitrine | `mall-glass-showcase` | (-4.01, 0.081, 0.4) | 80° |
| Parchment lantern at the consultation end | `chinese-lantern` | (0, 3.3, -4.38) | 0° |
| Cinnabar planter | `orchid-planter` | (2.63, 0.081, -4.58) | 0° |
| Wooden receiving chest below side return | `storage-crate` | (-2.58, 0.081, -4.58) | 5° |
| Aged brass reading light | `mall-wall-sconce` | (4.17, 2.74, 0.3) | -90° |
| Closed sample cabinet on the right wall | `medicine-cabinet` | (4.17, 1.88, -1.1) | -90° |

### S06 · Flying Wheel — Air-drying workshop

Golden noodle ribbons hang at different lengths from a freestanding timber loom, against a quiet slate wall.

**Today.** Hanging noodle strands over a timber counter under ceiling beams. Arched bowl niche, pantry shelves, generic front pack display and bag rack. Curved rear niche and name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 4,872 triangles and register 11 boxes. Current GLB assignments in triangles per instance — instant-noodle-pack-display 15,668. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js)

**Placement.** West (8, 10) m lot, world centre (-20, 0, 4), door world (x,z) (-15, 4). Static minimum route clearance 0.963 m to the fixture. Bring the drying comb down onto an open two-legged loom. Keep packs on the flanks.

**Floor and light.** Narrow beech strips run crosswise beneath the loom and turn into wide slate-grey aisle planks. Field (4.55, 4.15) m, centre (-0.65, 0.081, -0.83), yaw 3°. 3300 K. Rake across the hanging bands so light passes through the gaps.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Slatted noodle-drying loom** | NEW · `noodle-loom` | (-0.65, 0.081, -0.83) | 3° |
| Plain noodle bags on a hook rack | `instant-noodle-pack-display` | (-2.51, 0.081, 3.22) | 7° |
| Brushed preparation sideboard | `hawker-stall-stainless-counter` | (-2.99, 0.081, -1.8) | 90° |
| Pale wooden drying tray on sideboard | `food-tray` | (-2.99, 1.081, -1.52) | 83° |
| Utensil holder on sideboard | `chopstick-holder` | (-2.99, 1.081, -2.15) | 88° |
| Slatted flour crate | `storage-crate` | (-3.03, 0.081, 0.4) | 80° |
| Cylindrical work lamp | `mall-cylinder-pendant` | (-0.65, 3.3, -0.83) | 0° |
| Woven-colour basket by the rear wall | `shopping-basket` | (2.63, 0.081, -3.68) | 0° |
| Raking lamp above the comb | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |

### S07 · Gu Long — Banquet provision hall

A stepped pyramid of plain tins on a jade serving drum sits beneath one red lantern, like a banquet centrepiece.

**Today.** Lacquer tin pyramid under a two-tier beaded chandelier. Rear arched shelves, coffered ceiling, drum island, provision window and second pyramid. Arches and name band at rear. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 22,212 triangles and register 12 boxes. Current GLB assignments in triangles per instance — stacked-can-pyramid 17,896. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js)

**Placement.** West (8, 10) m lot, world centre (-20, 0, 12), door world (x,z) (-15, 12). Static minimum route clearance 0.963 m to the fixture. Use one high pyramid. Exchange bead clutter for one lantern and a jade drum.

**Floor and light.** An octagonal jade inset under the drum breaks into a border of brick-red tiles along the walk. Field (3.65, 3.65) m, centre (-0.55, 0.081, -0.85), yaw -8°. 2750 K. Spot the stepped tin shoulders through a red silk lantern diffuser.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Jade drum and stepped banquet pyramid** | `stacked-can-pyramid` | (-0.55, 0.48, -0.85) | -8° |
| Low jade serving drum under tin pyramid | `round-event-platform` | (-0.55, 0.081, -0.85) | -8° |
| Silk banquet lantern above the drum | `chinese-lantern` | (-0.55, 3.3, -0.85) | 0° |
| Lacquer provision shelf | `shelf-food-aisle` | (-2.99, 0.081, -1.8) | 90° |
| Stack of serving platters on shelf | `mamak-stainless-steel-plate` | (-2.99, 1.081, -1.52) | 83° |
| Bronze-coloured condiment tray | `kopitiam-condiment-tray` | (-2.99, 1.081, -2.15) | 88° |
| Hand basket in left window | `shopping-basket` | (-2.51, 0.081, 3.22) | 7° |
| Red-glazed corner planter | `orchid-planter` | (2.63, 0.081, -3.68) | 0° |
| Jade shelf washer | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |

### S08 · Skippy — Breakfast stand

A tall stand of plain peanut-butter jars fronts a striped breakfast booth with toast trays at serving height.

**Today.** Gold peanut in a blue arched niche. Chequered floor, fluted round island, three pendants, jar window and freestanding jar stand. Peanut relief sits between two rear arches. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 17,436 triangles and register 11 boxes. Current GLB assignments in triangles per instance — peanut-butter-jar-stand 16,404. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js)

**Placement.** West (8, 10) m lot, world centre (-20, 0, 20), door world (x,z) (-15, 20). Static minimum route clearance 0.963 m to the fixture. Move the jar silhouette to the booth and concentrate the sideboard on a toast still life.

Frame the jar stand with a shallow striped booth valance at local (−0.58,2.80,−0.76), yaw 0°, within 2.45 × 0.34 × 0.98 m. Include its two rear supports in the retained-fixture allowance. Bake the fabric stripes.

**Floor and light.** A navy-and-cream gingham field folds around the breakfast counter, with a plain band at the threshold. Field (4.48, 5.68) m, centre (-0.42, 0.081, -0.5), yaw 0°. 3650 K. A wide warm-white wash under the awning catches the jar shoulders.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Jar stand in a striped breakfast booth** | `peanut-butter-jar-stand` | (-0.58, 0.58, -0.76) | 0° |
| Blue enamel jar-stand base | `checkout-counter` | (-0.58, 0.081, -0.76) | 0° |
| Toast and timber service rack on sideboard | `kopitiam-toast-display` | (-2.99, 1.081, -1.52) | 83° |
| Maple breakfast sideboard | `kitchen-cabinet` | (-2.99, 0.081, -1.8) | 90° |
| Small second display at the window | `peanut-butter-jar-stand` | (-2.51, 0.081, 3.22) | 7° |
| Single sky-blue breakfast chair | `plastic-dining-chair` | (-3.03, 0.081, 0.4) | 80° |
| Butter-yellow breakfast light | `mall-globe-pendant` | (-0.58, 3.3, -0.76) | 0° |
| Picnic basket in the rear corner | `shopping-basket` | (2.63, 0.081, -3.68) | 0° |
| Cream breakfast tray on sideboard | `food-tray` | (-2.99, 1.081, -2.15) | 88° |

### S09 · SPAM — Canning-line grocer

A stopped tinning conveyor with a yellow return wheel leads the eye diagonally across a navy machine-room counter.

**Today.** Ochre recessed display and ribbed navy oval counter. Navy terrazzo, brass guide lines, stepped pendants, pack rows and a front food-aisle rack. Ochre niche with shelf rows and name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 11,368 triangles and register 10 boxes. Current GLB assignments in triangles per instance — shelf-food-aisle 16,320. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js)

**Placement.** West (8, 10) m lot, world centre (-20, 0, 28), door world (x,z) (-15, 28). Static minimum route clearance 1.018 m to the fixture. Replace the oval island with a diagonal stopped belt. Keep small tins in groups.

**Floor and light.** Two parallel steel inlays trace the belt ends in a charcoal rubber field. Keep the public path plain. Field (4.65, 3.24) m, centre (-0.72, 0.081, -1.1), yaw 12°. 3450 K. Use a narrow service light along the belt and a warm rim on the return wheel.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Diagonal tinning conveyor** | `conveyor-belt` | (-0.72, 0.081, -1.1) | 12° |
| Abstract tin stack at the belt intake | `stacked-can-pyramid` | (-2.58, 0.081, -3.68) | 5° |
| Tool station with folded-metal top | `factory-workbench` | (-2.99, 0.081, -1.8) | 90° |
| Scanner parked on the tool station | `barcode-scanner` | (-2.99, 1.081, -1.52) | 83° |
| Unmarked mechanical till on the tool station | `cash-register` | (-2.99, 1.081, -2.15) | 88° |
| Navy steel rack at left window | `warehouse-rack` | (-2.51, 0.081, 3.22) | 7° |
| Deep enamel task lamp | `mall-cylinder-pendant` | (-0.72, 3.3, -1.1) | 0° |
| Low ochre metal drawer unit | `tool-cabinet` | (2.63, 0.081, -3.68) | 0° |
| Light on the return wheel | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |

### S10 · California Mexico — Coastal gift market

A deep, open scallop shell cradles a generic seafood gift display against pale sand-coloured plaster.

**Today.** Pearl shell fans and tiered green-stone islands. Window plinths, ribbed side fans, hanging pearl cluster and countertop gift display. Layered coastal relief and rear name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 20,028 triangles and register 12 boxes. Current GLB assignments in triangles per instance — abalone-gift-box-display 18,992. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** West (8, 10) m lot, world centre (-20, 0, 36), door world (x,z) (-15, 36). Static minimum route clearance 0.963 m to the fixture. Bring one deep shell out of the wall and into the island. Retire the duplicate fans.

Leave a level 1.15 m ledge between the shell valves for the gift boxes. A chalk-painted underside and teal inner reveal make the depth readable in diffuse light.

**Floor and light.** Flow from a chalk-white sand field to a scalloped teal band around the gift display. Field (5.25, 4.25) m, centre (-0.45, 0.081, -1.4), yaw -7°. 3550 K. Light the shell tangentially so the lip and inner ribs cast visibly different bands.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Standing oyster-shell gift cradle** | NEW · `nacre-cradle` | (-0.45, 0.081, -1.4) | -7° |
| Neutral gift boxes on inner shell ledge | `abalone-gift-box-display` | (-0.45, 1.15, -1.28) | -7° |
| Sea-glass display cabinet | `mall-glass-showcase` | (-2.99, 0.081, -1.8) | 90° |
| Pearl-coloured serving dish inside cabinet | `mamak-stainless-steel-plate` | (-2.99, 1.081, -1.52) | 83° |
| Open gift basket in the left window | `shopping-basket` | (-2.51, 0.081, 3.22) | 7° |
| Coral glazed planter in the back corner | `orchid-planter` | (2.63, 0.081, -3.68) | 0° |
| Pearl pendant over the cradle | `mall-globe-pendant` | (-0.45, 3.3, -1.4) | 0° |
| Low teak shipping crate | `storage-crate` | (-3.03, 0.081, 0.4) | 80° |
| Teal shell-rib washer | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |

### S11 · Hormel — Provision packing room

An open packing bench, kraft rolls and nested slatted crates make this a working stockroom for generic tinned goods.

**Today.** Pantry worktable with open produce crates. Burgundy tin shelving, pantry provisions, cabinet at window, dark floor diamonds, task pendants. Arched timber surround and name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 19,158 triangles and register 12 boxes. Current GLB assignments in triangles per instance — food-display-cabinet 2,344. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-west-shops.js](../demos/corporate/gjh/v11/assets/gallery-west-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** West (8, 10) m lot, world centre (-20, 0, 44), door world (x,z) (-15, 44). Static minimum route clearance 0.963 m to the fixture. Move the focal point up to the packing rail and open crates. Stock stays unlabelled.

**Floor and light.** Worn end-grain blocks form a rectangular loading mat with a burgundy perimeter and zinc doorway strip. Field (4.8, 3.72) m, centre (-0.56, 0.081, -1.05), yaw 0°. 3150 K. A broad work light illuminates the wrapping surface. Keep the crate openings shaded.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Wrapping station with a high kraft-roll rail** | `packing-station` | (-0.56, 0.081, -1.05) | 0° |
| Slatted receiving crate at working end | `storage-crate` | (-3.03, 0.081, 0.4) | 80° |
| Low pallet in the left window | `wooden-pallet` | (-2.51, 0.081, 3.22) | 7° |
| Burgundy dispatch shelving | `warehouse-rack` | (-2.99, 0.081, -1.8) | 90° |
| Blank packing tray on bench | `food-tray` | (-0.56, 1.15, -0.93) | 0° |
| Wire returns basket | `shopping-basket` | (2.63, 0.081, -3.68) | 0° |
| Long zinc task light above packing bench | `mall-linear-ceiling-light` | (-0.56, 3.3, -1.05) | 0° |
| Countertop packing scale on shelf | `local-wet-market-weighing-scale` | (-2.99, 1.081, -1.52) | 83° |
| Short pantry rack on rear return | `shelf-food-aisle` | (-2.58, 0.081, -3.68) | 5° |

### S12 · Zeria — Quiet dispensary

Offset frosted index fins rise behind a low white supplement display, casting blue-green shadows between the layers.

**Today.** Mint and white stepped island with a halo above. Two arched pack shelves, entry plants, carton stand, vase and botanical detail. Pale coastal relief and name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 7,308 triangles and register 12 boxes. Current GLB assignments in triangles per instance — medicine-health-box-set 9,624. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-east-shops.js](../demos/corporate/gjh/v11/assets/gallery-east-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** East (8, 10) m lot, world centre (40, 0, 4), door world (x,z) (35, 4). Static minimum route clearance 0.963 m to the fixture. Replace stacked drums with alternating opal fins. Keep one low sample station.

Provide a sample shelf at 1.15 m in the front fin. From the entrance at least two edge/face pairs should be visible.

**Floor and light.** Pale resin flooring carries three quiet indigo arcs around the sample station and a matte seafoam browsing zone. Field (4.93, 4.48) m, centre (-0.52, 0.081, -1.2), yaw -5°. 4650 K. Edge-light the alternating fins with a cool white strip and shade every second reveal.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Layered opal index-fin island** | NEW · `opal-index` | (-0.52, 0.081, -1.2) | -5° |
| Plain carton stand beside the glazing | `medicine-health-box-set` | (-2.51, 0.081, 3.22) | 7° |
| White drawer cabinet in the alcove | `medicine-cabinet` | (-2.99, 0.081, -1.8) | 90° |
| Opal sample tray on central ledge | `food-tray` | (-0.52, 1.15, -1.08) | -5° |
| Mint supply trolley parked off aisle | `medical-trolley` | (-3.03, 0.081, 0.4) | 80° |
| White stone orchid pot | `orchid-planter` | (2.63, 0.081, -3.68) | 0° |
| Cool inspection bar above fins | `mall-linear-ceiling-light` | (-0.52, 3.3, -1.2) | 0° |
| Side fin washer | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |
| Recessed blank material-sample easel | `mall-directory-standee` | (-2.58, 0.081, -3.68) | 5° |

### S13 · Sony — Listening studio

Backlit headphone silhouettes turn a charcoal felt listening bar into a dark, close-focus audio showroom.

**Today.** Timber slatted media wall with screen and towers. Two lounge sofas, small round table, side consoles, spot details, headphone stand and soundbar. TV graphic plus rear name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 5,144 triangles and register 14 boxes. Current GLB assignments in triangles per instance — speaker-soundbar 13,632, headphone-display-stand 18,084. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-east-shops.js](../demos/corporate/gjh/v11/assets/gallery-east-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** East (8, 10) m lot, world centre (40, 0, 12), door world (x,z) (35, 12). Static minimum route clearance 1.460 m to the fixture. Retire the TV wall and draw attention to headphones against felt, with one listening seat.

**Floor and light.** A charcoal felt ellipse interrupts the black rubber floor and points its long axis toward the listening bar. Field (4.08, 4.38) m, centre (-0.64, 0.081, -1.05), yaw 8°. 4100 K. Rim the headphone hooks with ice-blue emission over a neutral listening light.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Headphone listening rack against a ribbed acoustic baffle** | `headphone-display-stand` | (-0.64, 0.43, -1.05) | 8° |
| Oval dark plinth for headphone rack | `round-event-platform` | (-0.64, 0.081, -1.05) | 8° |
| Slim soundbar on the left console | `speaker-soundbar` | (-2.99, 1.081, -1.52) | 83° |
| Black listening console | `work-desk` | (-2.99, 0.081, -1.8) | 90° |
| Felt listening chair behind the console | `meeting-chair` | (-2.58, 0.081, -3.68) | 5° |
| Second short headphone stand at window | `headphone-display-stand` | (-2.51, 0.081, 3.22) | 7° |
| Small silver spotlight raking the hooks | `mall-track-spotlight` | (-0.64, 3.48, -1.05) | 0° |
| Ribbed felt acoustic baffle | `office-partition` | (-0.64, 0.081, -1.99) | 0° |
| Silver slit of light along the side wall | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |

### S14 · LG — Living picture gallery

Two offset picture planes frame an ivory upholstered living room like a bright domestic cinema.

**Today.** Twin picture walls flanked by satin appliances. Ivory sofa, table, ring light, washer fronts, refrigerator and two TV fixtures in the front window. Two scenic TV panels and rear name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 4,664 triangles and register 11 boxes. Current GLB assignments in triangles per instance — tv-demo-table 6,696, tv-floor-stand 11,844, refrigerator 1,672. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-east-shops.js](../demos/corporate/gjh/v11/assets/gallery-east-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** East (8, 10) m lot, world centre (40, 0, 20), door world (x,z) (35, 20). Static minimum route clearance 0.963 m to the fixture. Retain the domestic scale. Use staggered screen sizes with side seating.

Float the main plane on a concealed wall bracket. Include the mounting standoff in the trim allowance. The second floor screen is independent and turned toward the sofa. Keep its screen face above the console.

**Floor and light.** Use a large aubergine wool rectangle beneath the sofa and a pale polished perimeter for the gallery walk. Field (3.05, 3.95) m, centre (-2.02, 0.081, 0.29), yaw 0°. 4000 K. Backlight the outer screen edge and keep the adjacent ivory wall neutral.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Two-scale screen wall with a gallery reveal** | `tv-wall-mounted` | (-0.62, 1.03, -3.99) | 0° |
| Second smaller floor screen angled toward main screen | `tv-floor-stand` | (2.63, 0.081, -3.68) | 0° |
| Ivory sofa in left browsing alcove | `living-room-sofa` | (-3.03, 0.081, 0.4) | 80° |
| Low console below the screen | `tv-demo-table` | (-0.62, 0.081, -3.86) | 0° |
| Small velvet ottoman in left window | `lounge-sofa-bench` | (-2.51, 0.081, 3.22) | 7° |
| Satin domestic appliance at back left | `refrigerator` | (-2.96, 0.081, -3.58) | 0° |
| Grazing light across screen reveals | `mall-track-spotlight` | (-0.62, 3.3, -3.99) | 0° |
| Small domestic arrangement at sofa end | `orchid-planter` | (-2.99, 0.081, -1.8) | 90° |
| Soft gallery wall light | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |

### S15 · Casio — Chamber recital room

A raised piano lid cuts a diagonal against walnut concert slats, with a shallow ivory-lit stage under the instrument.

**Today.** Walnut wave fluting above a watch case and instrument gallery. Upright relief, keys, bench, pendant, procedural piano, electronic keyboard and GLB grand piano. Wave crest and name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 3,828 triangles and register 9 boxes. Current GLB assignments in triangles per instance — electronic-keyboard 15,928, grand-piano 15,180. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-east-shops.js](../demos/corporate/gjh/v11/assets/gallery-east-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** East (8, 10) m lot, world centre (40, 0, 28), door world (x,z) (35, 28). Static minimum route clearance 0.960 m to the fixture. Keep the raised-lid instrument as the only stage hero. Remove competing upright and watch merchandise.

**Floor and light.** An oval walnut marquetry field and an ivory stage outline gather the instrument and bench. Field (3.55, 4.05) m, centre (-1.05, 0.081, -1.02), yaw -22°. 2900 K. Concentrate a warm pool on the keybed and catch the lid edge against the dark rear wall.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Open baby grand and bench on recital oval** | `grand-piano` | (-1.05, 0.081, -1.02) | -22° |
| Practice keyboard at left window | `electronic-keyboard` | (-2.51, 0.081, 3.22) | 7° |
| Warm stage special above lid | `mall-track-spotlight` | (-1.05, 3.3, -1.02) | 0° |
| Walnut acoustic screen behind instrument | `office-partition` | (-0.64, 0.081, -3.76) | -2° |
| Small amber lamp over practice area | `mall-cylinder-pendant` | (-2.5, 3.15, 2.88) | 0° |
| Empty glass object case with ivory stage samples | `mall-glass-showcase` | (1.15, 0.081, -3.58) | 90° |
| Keybed side light | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |
| Small recital flower arrangement | `orchid-planter` | (2.63, 0.081, -3.68) | 0° |
| Single audience chair beside the rear wall | `meeting-chair` | (-1.7, 0.081, 4.2) | 5° |

### S16 · GP — Locator workshop

A perforated teal tool board holds a family of oversized empty eyelets above a small tracker demonstration bench.

**Today.** White modular product wall with lime base cabinets. Three battery bays, twin demo tables, side electronics shelves, battery rack, halo and planter. Backlit shelf borders and name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 10,420 triangles and register 12 boxes. Current GLB assignments in triangles per instance — battery-display-rack 20,580, shelf-electronics-display 19,072. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-east-shops.js](../demos/corporate/gjh/v11/assets/gallery-east-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** East (8, 10) m lot, world centre (40, 0, 36), door world (x,z) (35, 36). Static minimum route clearance 0.699 m to the fixture. Keep the centre passage between installations. Move the hero to the left-hand eyelet rail.

Set a neutral unmarked pocket-size sample into the bench below the three architectural eyelets. Use vertex colour for a lanyard, with its geometry charged to the eyelet master.

**Floor and light.** White anti-static tile with a teal service lane and three lime indexing marks points to the rail. Field (5.25, 6.15) m, centre (-0.25, 0.081, -0.12), yaw 0°. 4900 K. A linear inspection light throws the cutout shapes onto the white backboard.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Perforated eyelet demonstration rail** | NEW · `eyelet-rail` | (-1.56, 0.081, -1.28) | 5° |
| Cell display in left window | `battery-display-rack` | (-2.51, 0.081, 3.22) | 7° |
| White modular accessories shelving | `shelf-electronics-display` | (-2.99, 0.081, -1.8) | 90° |
| Neutral rear test desk | `work-desk` | (2.63, 0.081, -3.68) | 0° |
| Generic static display on rear desk | `desktop-monitor` | (2.63, 1.131, -3.68) | 0° |
| Lime polymer tool bin | `storage-crate` | (-3.03, 0.081, 0.4) | 80° |
| Bench inspection strip | `mall-linear-ceiling-light` | (-1.56, 3.3, -1.28) | 0° |
| Pegboard edge light | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |
| Handheld bench scanner on left shelf | `barcode-scanner` | (-2.99, 1.081, -1.52) | 83° |

### S17 · Gigaset — Domestic telephone bureau

A gabled felt telephone alcove frames a small real-scale cordless handset at the end of a warm domestic corridor.

**Today.** Nested signal arcs over a dark round phone island. Dock rows, illuminated side shelving, double rings, phone display, lounge bench and plant. Rear arc relief and name band. A shared atlas supplies the illustrated front card and rear name strip. The studio builders emit 6,712 triangles and register 12 boxes. Current GLB assignments in triangles per instance — cordless-phone-display 11,104, lounge-sofa-bench 12,972. [expanded-interiors.js](../demos/corporate/gjh/v11/assets/expanded-interiors.js) · [window-studios.js](../demos/corporate/gjh/v11/assets/window-studios.js) · [gallery-east-shops.js](../demos/corporate/gjh/v11/assets/gallery-east-shops.js) · [shop-anchor-details-last.js](../demos/corporate/gjh/v11/assets/shop-anchor-details-last.js)

**Placement.** East (8, 10) m lot, world centre (40, 0, 44), door world (x,z) (35, 44). Static minimum route clearance 0.963 m to the fixture. Exchange ring and island repetition for an open gabled alcove with a visible handset.

Set the open handset shelf at 1.09 m. Keep its front edge and the face of the generic device visible against dark felt.

**Floor and light.** A cork runner widens into a threshold-shaped wool inset beneath the phone alcove. Field (4.68, 6.72) m, centre (0, 0.081, -0.2), yaw 0°. 3200 K. Conceal a warm lamp inside the gable and graze the cork face at the handset.

| Element | Source or new geometry | Local (x, y, z) m | Yaw |
|---|---|---|---:|
| **Gabled private-call alcove with open front** | NEW · `telephone-alcove` | (-0.55, 0.081, -2.95) | -5° |
| Real-scale generic handset in the alcove | `cordless-phone-display` | (0.22, 1.09, -2.66) | -5° |
| Small domestic writing desk | `work-desk` | (1.42, 0.081, -3.9) | 0° |
| Second unbranded dock on writing desk | `cordless-phone-display` | (1.42, 1.081, -3.69) | 0° |
| Cork-coloured waiting seat in left window | `lounge-sofa-bench` | (-2.51, 0.081, 3.22) | 7° |
| Domestic pendant above desk | `mall-cylinder-pendant` | (-0.55, 3.3, -2.95) | 0° |
| Correspondence drawer cabinet | `filing-cabinet` | (3.15, 0.081, 2.7) | 80° |
| Gable reading lamp | `mall-wall-sconce` | (3.19, 2.74, 0.3) | -90° |
| Chalk planter at end of runner | `orchid-planter` | (2.63, 0.081, -3.68) | 0° |

## Procurement and build order

Library checkout `618b1051dde8`, app checkout `6fddb9ae3e17`. The read-only scan found **1,517 GLBs under models/ and 0 under public/** here. The brief’s figure of 2,378 is unconfirmed for this checkout and scope. The seven retail127, mall038, domestic011, office023 and health206* seed lists yield 82 distinct slugs. Searching 545 metadata sidecars by slug, name, tags, description and category returned 505 matching directories before fit and rights review. The shortlist keeps **72 assigned assets and 10 rejected alternatives**. See `scan`, `library_candidates` and `existing_glbs` in the [JSON register](gjh-v11-interior-program.json).

Every candidate row names the exact source GLB, slug, active scene triangles, bytes, materials, submitted primitives per asset instance, author or missing-author flag, source blend/metadata, rights statement, licence evidence, fit score and store assignments. The 0–5 fit score is a design judgement. Award 5 for a focal match, 4 for a selected supporting role, 0 for rejection. Each installed use also records a separate Low, Balanced and Detailed decision. Existing LOD paths have measured costs. ‘Reuse mesh as is’ describes topology. Transforms and palette matching are still required. Materials can have several primitives. A triangle count alone cannot establish draw calls. Inputs marked draft still need visual QA. The applicable licence scope for selected gallery props is use in the owner’s projects. General third-party redistribution is **UNVERIFIED**.

### Reused entrance anchors

| Store | Library slug | Source triangles | Bytes | Active materials | Low geometry target |
|---|---|---:|---:|---:|---:|
| S02 MILI | `hawker-stall-exhaust-hood` | 4,212 | 228,852 | 2 | 780 |
| S03 GOGO | `ice-cream-cart-potong` | 6,240 | 414,248 | 2 | 920 |
| S07 Gu Long | `stacked-can-pyramid` | 17,896 | 418,872 | 3 | 920 |
| S08 Skippy | `peanut-butter-jar-stand` | 16,404 | 514,704 | 3 | 780 |
| S09 SPAM | `conveyor-belt` | 1,456 | 81,556 | 4 | 920 |
| S11 Hormel | `packing-station` | 2,188 | 120,640 | 4 | 920 |
| S13 Sony | `headphone-display-stand` | 18,084 | 431,772 | 3 | 780 |
| S14 LG | `tv-wall-mounted` | 11,092 | 481,228 | 3 | 780 |
| S15 Casio | `grand-piano` | 15,180 | 523,560 | 3 | 920 |

The exact export, author, copied rights text and sidecar for each of these rows are in the JSON. The cart illustrates the counting convention because its default scene contributes 6,240 triangles. The metadata’s 6,252 also counts a 12-triangle collider in an inactive scene.

The floor-mitre candidate lacks an explicit project-use grant in its rights record. The Codex NZ can variant carries generated package art. Both are excluded. The S16-tagged vehicle E-Tag asset depicts windscreen toll hardware. A clothes rack, shoe/bag rack, fruit merchandiser, exam bed, loaded watch case, cendol cart and reference-modelled New Moon sign also fail these display briefs. The catalog entries retain the measured evidence for each exclusion. [Asset decision register](gjh-v11-interior-program.json)

**Palette and scale derivatives.** The checkout-counter carcass can feed the Borsch Med and Zeria islands. The work-desk frame can feed GP and Gigaset. Give each its own top profile, joinery and shadow line. Reuse the same bracket, stool, tray, sconce, opaque PBR and instancing methods where appropriate. Keep the distinctive part of each signature exclusive to its room. Build the first cabinet as the 393 px acceptance sample, then the light page-fold and open loom to validate two very different silhouettes before producing the remaining five.

| Order / new master | Store | Low / Balanced / Detailed triangle cap | Material classes | Required geometry and authoring |
|---|---|---:|---|---|
| 1. `collector-triptych` | S01 | 860 / 2,400 / 6,000 | stained timber, satin brass, linen | Hinge two side leaves toward the viewer. Give the inner leaf a recessed unbranded picture pocket. Bottom clears the working shelves. Bake carving into the Low colour atlas. Compare `gjh-m056-premium-wall-shelf-straight`. The existing straight stock cabinet has no projecting folding wings above the facings. |
| 2. `patch-folio` | S04 | 660 / 1,850 / 4,800 | powder enamel, matte paper, felt | Model three stiff page-shaped wings with visible turns and an integrated sample ledge. Bake perforations. Blank surfaces, no dosage graphics. Compare `mosquito-patch-pack`. The patch prop is a small counter display. It supplies the sample, not a walk-up folded backdrop. |
| 3. `noodle-loom` | S06 | 820 / 2,200 / 5,200 | pale beech, neutral food-colour bands, steel | Join the feet, comb and staggered solid ribbon fans as an open silhouette. Use wide flat ribbon clusters instead of individual noodles on Low. Compare `instant-noodle-pack-display`. The rack holds finished noodle bags. The suspended strips in the current scene lack feet, cross-bracing and deep banks of drying combs. |
| 4. `specimen-drawers` | S05 | 800 / 2,200 / 5,600 | stained elm, copper, porcelain | Step the cabinet halves down to a bowl niche. Keep three protruding drawers, bake the remaining grid and handles on Low. No herb names or prescription labels. Compare `medicine-cabinet`. The medicine cabinet lacks the stepped drawer silhouette and bowl recess. Borrow the authored side-wall drawer proportions. |
| 5. `nacre-cradle` | S10 | 880 / 2,500 / 6,000 | satin ceramic, mineral stone, brushed teal metal | Model a deep hinged two-valve cradle with a flat inner gift shelf. Use a faceted lip and baked rib shading. Solid rough PBR approximates nacre. Compare `abalone-gift-box-display`. The gift-box riser supplies product grouping. The existing decorative fan does not form a deep hinged cavity with a usable shelf. |
| 6. `opal-index` | S12 | 620 / 1,700 / 4,200 | matte opal resin, anodised aluminium, opaque emissive edge | Build four staggered stepped fins and a shelf in the base. Low uses opaque shaded faces, no overlapping alpha or transmission passes. Compare `medicine-health-box-set`. A carton stand stocks the aisle. It does not make the offset opal-fin silhouette. |
| 7. `eyelet-rail` | S16 | 640 / 1,900 / 4,600 | powder steel, anodised teal, lime elastomer | Model three distinct through-holes above a bench. Bake the fine pegboard perforations. Eyelets are architecture. No imitation tracker branding. Compare `vehicle-etag-display-stand`. Vehicle toll tags are a category mismatch. Reuse battery fixtures nearby and build only an architectural rail with through-holes. |
| 8. `telephone-alcove` | S17 | 750 / 2,100 / 5,000 | cork, graphite felt, satin nickel | Use an asymmetrical gable and a shallow floating handset ledge. Keep front accessible to view. No entering a dead-end booth. Bake felt seams. Compare `cordless-phone-display`. The handset GLB supplies the dock at tabletop scale. It lacks the architectural gable visible from the door. |

**Phase 2 handoff to Astra.** Build in Blender with metre-scale, glTF +Y up, local +Z display front and an explicit floor or mounting origin. Export closed, static glTF 2.0 GLBs with PBR metallic-roughness, shared swatches and named removable groups. Prefer one opaque palette material plus an emissive accent. Bake soft shadows, fabric, package rows and carving on Low. Instance repeats and charge all visible copies. Record per tier the source .blend, generator where applicable, author, rights, credits, true exported bytes, active-scene triangles, materials, bounds, textures and validation result. Follow the library’s `docs/assets.md`. Use its `models/<slug>/` layout, review the unbranded new geometry for the intended Blender-3D-Gallery main delivery, then copy only the reviewed runtime exports and provenance to GJH. Apply cleared logos and photos in GJH at runtime. Keep the separate asset rights with each derivative.

## Original design allocations

The budget covers each **complete proposed shop-specific representation** in a view, including retained fixture proxies, all repeated instances, both hero and supporting geometry, floor finishes, art, trim and stock. Keep the common mall shell, shared signage, visitor, lift and public architecture as the paired before/after baseline. Do not add these numbers on top of the existing heavy studios. Replace legacy shop-specific wing geometry and loaded full models on Low. The proposed simplification of existing stock and permanent wing scenery was outside the runtime fit-out. The installed kit keeps working shop fixtures and measures additions separately.

| Slot | Low tris / calls / MB | Balanced tris / calls / MB | Detailed tris / calls / MB |
|---|---:|---:|---:|
| S01 New Moon | 2,928 / 7 / 1.398 | 14,204 / 8 / 5.592 | 85,660 / 8 / 11.185 |
| S02 MILI | 2,166 / 7 / 0.350 | 11,268 / 8 / 1.398 | 43,256 / 8 / 11.185 |
| S03 GOGO | 2,618 / 7 / 0.350 | 13,212 / 8 / 1.398 | 57,372 / 8 / 11.185 |
| S04 Borsch Med | 1,946 / 5 / 0.350 | 10,474 / 8 / 1.398 | 37,340 / 8 / 11.185 |
| S05 Pien Tze Huang | 1,974 / 5 / 0.350 | 9,928 / 8 / 1.398 | 34,448 / 8 / 11.185 |
| S06 Flying Wheel | 1,968 / 5 / 0.350 | 10,060 / 8 / 1.398 | 30,752 / 8 / 11.185 |
| S07 Gu Long | 2,072 / 5 / 0.350 | 10,692 / 8 / 1.398 | 48,832 / 8 / 11.185 |
| S08 Skippy | 1,928 / 5 / 0.350 | 10,660 / 8 / 1.398 | 43,664 / 8 / 11.185 |
| S09 SPAM | 2,068 / 5 / 0.350 | 9,152 / 8 / 1.398 | 27,556 / 8 / 11.185 |
| S10 California Mexico | 2,166 / 5 / 0.350 | 11,124 / 8 / 1.398 | 35,424 / 8 / 11.185 |
| S11 Hormel | 2,206 / 5 / 0.350 | 10,572 / 8 / 1.398 | 31,828 / 8 / 11.185 |
| S12 Zeria | 1,906 / 5 / 0.350 | 10,084 / 8 / 1.398 | 33,900 / 8 / 11.185 |
| S13 Sony | 1,972 / 5 / 0.350 | 10,672 / 8 / 1.398 | 44,576 / 8 / 11.185 |
| S14 LG | 2,016 / 5 / 1.398 | 11,024 / 8 / 5.592 | 42,668 / 8 / 11.185 |
| S15 Casio | 2,132 / 5 / 0.350 | 10,832 / 8 / 1.398 | 42,588 / 8 / 11.185 |
| S16 GP | 1,876 / 5 / 0.350 | 9,960 / 8 / 1.398 | 29,520 / 8 / 11.185 |
| S17 Gigaset | 2,054 / 5 / 0.350 | 10,868 / 8 / 1.398 | 37,168 / 8 / 11.185 |

Triangles equal the sum of each placement’s per-instance cap × count plus the named allowances in JSON. S01 illustrates the need to change representation. Four native M056 × 3,132 plus 204 shelf cans × 3,044 = **633,504 triangles** before the extra hero and room. On Low, budget 408 triangles for 204 single-sided shelf fronts, 64 for the near can, 64 for a held can and 64 for the near-door sample/transition. Keep the selected/held index and all four existing pickup bounds. Reuse the official fronts in an atlas. Richer tiers reserve native detail for the nearest units. No credit is taken for backface or depth rejection. [Shelf layout and reservation](../demos/corporate/gjh/v11/assets/products.js) · [Visibility controller](../demos/corporate/gjh/v11/assets/product-display-lod.js) · [Measured GLBs and per-part ledger](gjh-v11-interior-program.json)

**Worst phone view.** The sum of all 17 full Low rooms is **35,996** with **14,004** triangles of headroom against 50,000. Every slot is below 3,000. For draw calls, use one focused room with at most 7 Low batches and globally merge the other windows into two far passes. Keep each distant silhouette at ≤144 triangles. The conservative one-focus-plus-sixteen-far limit is **2,928 + 16 × 144 = 5,232 triangles and 9 calls** in any Low view, including the deck looking back across all wings. No focus transition may draw both versions of a room. The analogous Balanced/Detailed targets are 16,508/87,964 triangles and 10 calls. Current per-wing meshes and 17 m groups do not implement this policy. Use the doorway being approached, then hysteresis on exit, to keep the entrance hero resolved. Merge static opaque surfaces by room and atlas, instance repeated geometry by shared material, bake Low lighting and charge any auxiliary pass to its tier.

**Texture accounting.** MB is decimal GPU payload under uncompressed RGBA8 with all mip levels. One 256² atlas costs 349,524 bytes, 512² costs 1,398,100 and 1,024² costs 5,592,404. Low uses a 256² page per room except S01/S14 at 512². Charge a separate shared 1,024² far atlas once, even if every shop page remains resident. All-resident texture bounds are **13.631 MB Low, 37.749 MB Balanced, 195.734 MB Detailed**. Detailed may stream near-room pages. These figures cover the programme’s atlases and any resampled photo surfaces, separate from the baseline shell textures and browser/driver overhead. Reuse vertex PBR parameters for roughness and metalness. Bytes-on-disk in the procurement register are a separate measurement.

## Installed fit-out

Each of the 17 shops uses its original entrance anchor, a set of batched finishes and one Blender-authored room detail GLB. All tiers share the same room detail file. Higher tiers retain their more detailed anchor and trim. The core fit-out preserves the 187 original studio collision boxes, the four New Moon pickup positions, the MILI and GOGO seats and the approved circulation routes. [Runtime configuration](../demos/corporate/gjh/v11/assets/interiors/config.js) · [Build procedure](../scripts/gjh_interiors/README.md) · [Asset manifest](../demos/corporate/gjh/v11/assets/interiors/manifest.json)

The peach rectangle visible next to several fascia signs came from the front face of the generic ceiling fixture. Its warm output matched the room temperature, including SPAM's 3,450 K salmon rectangle. Each shop now supplies a shaped ceiling treatment. MILI carries its hood trim across the lintel gap and puts the menu on the hood face. GOGO replaces the stepped timber overhead with a popsicle garland. SPAM's conveyor now carries a row of labelled tins.

Room details use metallic-roughness materials and a single shared 256 × 256 atlas. It contains the registered brand artwork, shelf tickets, illustrated food and screen content. Eleven shops use GPU-instanced product rows with colour variants. The retained shelves also use brand-specific colours. One shared animation update scrolls the Sony and LG texture views and varies emissive intensity for the pulsing fixtures. Each effect advances only while its shop is near and visible and motion is enabled. The room models add no real-time lights or shadow casters. Interactive concepts are recorded in the [interaction backlog](gjh-v11-interior-interactions-backlog.md).

The fifth loader stage queues all 17 rooms. It decodes the shared image once, then installs the finishes, anchor and room detail together through the sliced uploader, lighting compilation and GPU fence. A normal warm completion requires every room and the scene and signage sweep. On early entry or the existing foreground timeout, the same queue continues nearest-first. Tier changes keep the current sets visible until the requested rooms and signs can switch together. Detailed uses eight Detailed anchors and nine Balanced fallbacks. The full asset catalogue contains 42 anchors, 17 room details and the shared image. [Warm-stage coordinator](../demos/corporate/gjh/v11/assets/scene-warmup.js) · [Interior installer](../demos/corporate/gjh/v11/assets/interiors/warmup.js)

### As-built budget

The table uses the same scope as the prior 20,750-triangle Low baseline. It counts each complete installed kit, including repeated instances, actual merged procedural finishes, both New Moon photo planes and the MILI lintel correction. Retained permanent displays, playable stock, building shells and common signage stay in the baseline. Savings from removed scenery are excluded. The draw counts assume all rooms are submitted once in the main pass. [Budget test](../tests/gjh_interiors.test.mjs)

| Tier | Kit triangles across 17 shops | Largest shop | Main-pass draws across 17 / max per shop | Anchor triangles | Active-set GLB bytes |
|---|---:|---:|---:|---:|---:|
| Low | 34,490 | 2,730 (S07) | 104 / 7 | 8,272 | 1,502,628 |
| Balanced | 52,306 | 4,508 (S07) | 121 / 8 | 24,816 | 2,514,384 |
| Detailed | 60,894 | 7,232 (S10) | 152 / 10 | 32,132 | 2,775,216 |

Low has 10,510 triangles of headroom against 45,000. Gu Long has 70 against the 2,800 per-shop limit. Every shop adds at most four Low draw calls to its previous count. The shared PNG adds 47,721 download bytes to each set and 349,524 nominal RGBA8 bytes with a full mip chain. Nominal active-set texture bytes total 6,292,944. Actual driver memory depends on the browser.

`window.__mall.performanceReport().interiors` gives the effective tier, shops submitted in the last visible frame, draw calls, triangles, resident parsed models and source bytes. `preinstalled.shops` counts ready rooms and `preinstalled.ms` gives their installation time. Frame reports include visible post-processing submissions. Cached models from other tiers can raise resident bytes above the selected-set column.

## HOW-TO-VERIFY

Capture every listed entrance at **393 × 612 Low** and **1440 × 900 Detailed**. Repeat with Balanced for a tier comparison. Wait for both the anchor and the detail GLB to appear. Use the default third-person view and standard HUD with the map closed. Approach from the map arrival and face inward 0.75 m outside the door with both leaves open. Save the stems below with `-phone-low` or `-desktop-detailed` and record the effective tier, CSS viewport, DPR and build ID. The first three also need a closer shot matching the existing baseline composition.

| Capture stem | Entrance evidence | Low / Balanced / Detailed added triangles |
|---|---|---:|
| S01-entrance | Moon lanterns around the collector wall, crescent floor inlay | 1,176 / 2,024 / 2,856 |
| S02-entrance | Menu on the illuminated hood, stacked sauce bottles and tasting plate | 2,558 / 2,806 / 2,830 |
| S03-entrance | Ice-cream cart, popsicle garland, balloons and coloured floor rings | 2,306 / 3,908 / 3,932 |
| S04-entrance | Colour-coded apothecary bottles and a botanical floor motif | 2,622 / 3,394 / 4,206 |
| S05-entrance | Gold wall mark, red lanterns and gold cloud inlays | 2,310 / 3,670 / 4,230 |
| S06-entrance | Ship wheel, hanging noodle bundles, wheat sacks and warm timber flooring | 1,882 / 2,814 / 4,114 |
| S07-entrance | Neon dragon, lantern strings and the stepped banquet tin display | 2,730 / 4,508 / 4,568 |
| S08-entrance | Giant jar photo spot, peanut footsteps and an illustrated toast advertisement | 2,236 / 3,916 / 3,976 |
| S09-entrance | Large luminous SPAM wordmark, stacked can wall and stocked conveyor | 2,180 / 2,660 / 2,756 |
| S10-entrance | Clam and glowing pearl, shell wall and pearl pendants | 2,704 / 4,284 / 7,232 |
| S11-entrance | Deli counter, sliced meats, chequered floor and Hormel mark | 2,182 / 2,750 / 2,846 |
| S12-entrance | Red dispensary mark, planted herbs and shelf tickets | 1,786 / 2,474 / 2,986 |
| S13-entrance | Headphone listening wall, scrolling waveform and blue-white floor light strips | 1,690 / 3,478 / 3,538 |
| S14-entrance | Two emissive gradient screens and a red LG lightbox | 956 / 1,304 / 1,400 |
| S15-entrance | Luminous piano keys, watch cases and widely spaced overhead slats | 2,502 / 4,354 / 4,414 |
| S16-entrance | Large battery standee and illuminated lightning bolts | 1,352 / 2,056 / 2,600 |
| S17-entrance | Large desktop phone, signal arcs and telephone accessories | 1,318 / 1,906 / 2,410 |

1. Review copies with the HUD and names masked. Match each room by its anchor and floor zone. Check the approved 120 CSS px anchor target, the readable official photo in S01 and the unobstructed foreground. Use the baseline PNGs for S01–S03. [Taste checklist](ui-ux/taste-engine-checklist.md)
2. Run `python3 tests/browser_gjh_shop_walkthrough.py`. Walk the entrances, browse points and return routes. At each of the four New Moon pickup points, pick up a can and return it, then repeat the Add to bag flow with a held can. Check seat exits, the cart and the elevator. Match Low, Balanced and Detailed frames to the CPU budget and inspect the two wing diagonals, upper deck and tier transitions. [Collision probe](../tests/gjh_shop_collisions.mjs)
3. Serve the rebuilt root with `python3 -m http.server 8814 --bind 127.0.0.1`. With the manager's headed Chrome setup, set `GALLERY_CHROME` to the Google Chrome executable and run `python3 docs/interiors_probe.py --url http://127.0.0.1:8814/demos/corporate/gjh/v11/` for three cold Low walks through all 17 entrances. Check `interiorsAtLoaderHide.preinstalled.shops` for 17 and the warm reason for `complete`. Run three cold walks per tier with `docs/walk_probe.py` and its `--tier` option. Both probes require zero intervals ≥50 ms and a maximum below 40 ms. [Three-tier cold-run procedure](gjh-v11-late-asset-uploads.md)

## Evidence limits

The Low review used the delivered GLBs and common atlas in Cycles CPU. Reviewers inspected the 17 store interiors, three supplementary entrance/lintel views and eight shelf close-ups. The first three outer shells use measured approximations and fascia text uses stand-ins. The receipts bind the staged images, model files and atlas by hash. [Shops 01–06](evidence/interiors/round2/shops-01-06.jpg) · [Shops 07–12](evidence/interiors/round2/shops-07-12.jpg) · [Shops 13–17](evidence/interiors/round2/shops-13-17.jpg) · [Shelf close-ups](evidence/interiors/round2/shelf-inspection.jpg) · [Review receipts](evidence/interiors/round2/final-receipts.json)

All 59 GLBs passed the Khronos glTF validator. Node checks the loader lifecycle, shared atlas, material and instance counts, clearance envelopes and original collision boxes. Browser walkthroughs and the interior probe were attempted. Sandbox loopback binding and the Chrome launch both failed. **UNVERIFIED** items include in-game lighting and camera framing, blind brand recognition, pickups and seating in the revised scenes, renderer draw counts at matched poses, live screen scrolling, cold-walk hitch timing and physical-phone frame pacing.
