# GJH V11 upper-deck escalator

Visitors can board an ascending escalator in the expanded courtyard, ride while standing still, and step onto the existing upper deck between two sittable benches. The two-way passenger lift serves the same levels and provides the step-free return. Open Map and find **E** at the ground landing. Walk on with the keyboard or activate **Ride up** on touch. **Skip ride** is available in transit. A visitor with an active cart or a held product receives a message at the lower landing.

## Geometry and reference

The flight connects the courtyard at (18.5, 0, 9) to (3.0, 7.2, 9). Its inclined section spans 13.30 m horizontally and approximately 15.12 m along the slope. The tread width is 1.34 m inside the 1.60 m assembly. A continuous physical slope supports the visitor above the individual visible treads. The east deck guard opens only at this joint.

The owner's Blender ID004 provided the silhouette, glazed sides and fixed-comb reference. Its editable 3.0 m mechanism uses a 30° incline, a hidden return and rigid moving steps. The mall generates its own 7.2 m flight. Fifty visual instances repeat over one 310 mm pitch. A narrow gold band on the downhill edge of each tread makes it visible from the deck. The installed assembly adds one instanced draw, 1,848 triangles and 12 static collision shapes. The upper-only startup pack and the candidate pack both contain 2,544,984 bytes. The local escalator module is 3,595 bytes. [Blender reference and licence](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/4e38f215eeaf4fca1bfd12b639fff1dd15b8a90e/models/escalator) · [Mall implementation](../demos/corporate/gjh/v11/assets/escalator.js)

## Visitor route and rendering

The full route ran in Chrome on macOS Metal with an ordinary visitor and separate touch and keyboard profiles. Touch selected **Ride up** at 390 and 768 px. The desktop visitor boarded with the keyboard. All three runs checked pausing, standing on the moving flight, both benches, return by lift, ground passage under the upper span, the accessible restroom entrance, held-item and cart refusal, and reduced motion. The walks to prescribed poses used the real collision controller through the test harness. The four-heading storefront scans used test relocation. The Map itself was opened to verify marker E in English, Simplified Chinese and Malay.

| Viewport | Courtyard entrance draws | Ground approach draws | Ascent draws | Upper landing draws | Highest of 68 storefront headings | Gold bands in the former unbroken dark span |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 390 px | 62 | 39 | 51 | 44 | 71 | 0 → 21 |
| 768 px | 83 | 33 | 65 | 43 | 83 | 0 → 37 |
| 1440 px | 100 | 60 | 98 | 65 | 112 | 0 → 36 |

The upper-only entrance comparisons measured 62, 83 and 100 draws at the same widths. The band counts come from the same screen-centre interval in each old/revised pair. They count distinct light bands at native resolution. At 390 px the distant bands merge sooner. All 204 storefront samples stayed within the 200-draw budget. These measurements cover Chrome viewports on a Mac. Physical phone frame times remain open.

On the initial ascent the ground-floor store hint stayed visible beneath **Skip ride**. A second three-width replay on the final build verified the ground hint before boarding, its disappearance while the escalator carried the visitor, the upper-floor indicator on exit, and the original ground guidance on returning by lift. The mini-map names the active ride, then returns to its ground-floor label after the lift arrives.

Five independent reviews covered composition, lighting, mobile render cost, provenance and spatial flow. At the close phone approach, the avatar and action card cover part of the lower comb. The downward desktop view crops most of the avatar. Square handrail ends, simple tread faces and flat comb plates remain visible differences from ID004. The current model represents the first navigable connection. The detailed mechanism and finish remain open.

[Visitor views](evidence/gjh-v11-escalator/route.webp) · [Old and revised tread edges](evidence/gjh-v11-escalator/treads.webp) · [In-transit HUD](evidence/gjh-v11-escalator/guidance.webp) · [Routes and source digests](evidence/gjh-v11-escalator/routes.json)
