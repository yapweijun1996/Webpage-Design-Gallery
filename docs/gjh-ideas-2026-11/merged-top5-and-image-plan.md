# GJH webpage ideas — merged best 5 and image-generation plan

Sources: three Codex research workers (audience, art direction, interaction), 21 candidates in total. See `worker1-audience.md`, `worker2-art-direction.md` and `worker3-interaction.md`. Claims marked [assumption] in those files remain assumptions.

## Selection rule
Keep ideas that (1) give every screen ONE dominant image (the approved v22 bar), (2) serve a distinct visitor job, (3) rely on a signature interaction that is cheap on a 393 px phone, (4) avoid collage-style use of the shared 98-image library (rejected), and (5) separate generated scenery from real GJH packshots and archive photos.

## The best 5
| # | Option | Merged from | Visitor job | Signature interaction | Palette / type |
|---|---|---|---|---|---|
| 1 | **Rochor Threshold** | Five-Foot Way + Rochor Window + Evidence Panel | Heritage reader: "how is GJH's origin documented?" | Step from shophouse arcade into interior; each state opens a source caption | Charcoal #171A16, glaze green #426254, ivory #F1E6CC; Cormorant Garamond + Instrument Sans |
| 2 | **The Receiving Bay** | Receiving Bay + Prep for Service + Before the Shelf | Retail buyer / chef: "which enquiry route and how many cases?" | Pick a sector, get a buyer checklist; covers-to-cases calculator with visible arithmetic | Asphalt #171B1F, chalk #F4F1E8, amber #F1B84B; Archivo Narrow + Inter |
| 3 | **The Pantry Shelf** | Pull the Pantry Shelf + Read the Pack + Ink on Tin | Meal planner / shopper: "which brand and which exact pack?" | Drag a brass handle to pull a shelf forward; front/back pack views with EN/中文 transcript | Charcoal, warm ivory, amber, cinnabar #A53127 |
| 4 | **Tuning Bench** | Tuning Bench + Light Test | Electronics shopper: "which brand page for my device?" | Detented dial; one still per activity (Listen, Watch, Play, Connect) | Graphite #101219, phosphor amber, cobalt #718BFF; Space Grotesk + IBM Plex Mono |
| 5 | **Gouache Pantry** | Tropical Still Life + Glaze Study | Pantry shopper / name-recall visitor: "which brand carries this?" | Ingredient painting swap; type-ahead finder over a glaze-tile cover | Indigo #1F3350, pineapple #E4B74D, paper #F5ECD8; Fraunces + DM Sans |

Dropped: Find the Right Help, Gift Brief, Inside the Working Day (valid but narrow; keep as later sections), One Aisle Three Doors (L effort, WebGL risk; revisit), Pocket Trade Receipt (folds into option 2 as an optional offline save).

## Image-generation plan
Principles: single scene per image, portrait 2:3 (export 393x844 crop later), no text, no logos, no packaging, no people's faces, empty set where a real packshot will be composited later. Every image is a concept mockup and must carry a visible "AI concept illustration" caption in the final page.

Two images per option (state A = first screen, state B = interaction state), 10 total. Files go to `docs/gjh-ideas-2026-11/images/` named `optN-<slug>-a|b.png`.

| File | Prompt core |
|---|---|
| opt1-a | Singapore shophouse five-foot-way arcade at eye level, late afternoon, one bright doorway centred, green-glazed floor tiles, charcoal near wall with empty space for headline, cinematic, photoreal. |
| opt1-b | Interior of an empty 1940s provision store, wooden counter, brass scales, sacks, window light raking, same afternoon daylight, no text. |
| opt2-a | Tall loading-bay opening under hard morning light, asphalt floor, one wooden pallet silhouette, dark left jamb for headline, amber safety line. |
| opt2-b | Stainless prep pan in raking light on a steel pass, empty, charcoal background, amber accent, no food packaging. |
| opt3-a | Pull-out pantry shelf in a dark-wood cabinet, amber light, shelf half-open, brass handle at lower third, empty shelf surface for real packshots. |
| opt3-b | Macro of a plain unlettered enamel tin on a warm shelf, raking light revealing rim and seam, cinnabar and cream, no label text. |
| opt4-a | Oversized brushed-metal rotary dial macro, centred, graphite, phosphor-amber tick marks without numerals, cobalt rim light. |
| opt4-b | Empty cobalt-rim-lit studio plinth for an electronics device, black lower third, soft haze. |
| opt5-a | Single cut pineapple painted in opaque gouache on a tilted plane, indigo ground, paper margin upper left. |
| opt5-b | One enlarged celadon glazed tile corner with sharp reflection and shallow grout shadow, ivory below, no pattern text. |

Acceptance after generation: view each image, reject anything with visible text, logos, collage feel or distorted objects; regenerate once; then ask Wei Jun for a one-tap visual choice (not an open "what is wrong" question).
