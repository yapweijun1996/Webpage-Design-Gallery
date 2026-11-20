# S15 Casio instruments

| Model | Width × depth × height | Slot-local origin | Triangles |
| --- | --- | --- | ---: |
| CT-S1BK portable keyboard | 930 × 258 × 83 mm | `(1.10, 1.28, -.59)` | 324 |
| GP-510BP digital hybrid | 1434 × 489 × 963 mm | `(1.55, .081, -4.00)` | 96 |
| **Combined** | | | **420** |

Origins are in metres at center X, bottom Y and center Z. Both instruments face +Z with +Y up. The dimensions exclude music stands.

- The **CT-S1BK** uses the black support photo for the tapered end cheeks, continuous charcoal textile speaker deck, red keybed accent, and left-of-center knob and button strip. The C2–C7 keybed has 36 white keys and 25 black keys in five groups of two and three. Each key uses a top and a visible front. Thin gaps read against the dark bed.
- The **GP-510BP** uses the exact black product photo and stand assembly drawing for the stepped cabinet, two side panels, recessed rear panel, pedal crosspiece, slim front legs with brass-colored tips, and three projecting brass-colored pedals. The lid and keyboard cover are closed. Painted trim and panel tones suggest the polished-black finish within the shared material.

Bevels, controls and cabinet subdivisions are estimated from the references. The models depict the instruments alone, with unlabeled static surfaces and untextured speaker cloth.

## Entry points

- [casio_instruments.py](../../scripts/gjh_interiors/casio_instruments.py) exposes `add_ct_s1(room)` and `add_gp_510(room)`. Both append opaque faces to the existing Painted Room batch (`CRAFT` / Enamel), return named face starts, and accept an optional `origin` override.
- [generate.py](generate.py) exposes `build()`, which links and returns the two editable Blender mesh objects in CT-S1BK, GP-510BP order. Named vertex groups identify model parts. Blender coordinates are +Z up and −Y front.

The CT-S1BK rests on the teaching stand. The GP-510BP sits separately in the rear alcove with its own collision footprint. The stage grand is a separate recital fixture.

## Casio references

- CT-S1BK dimensions and supplied black-model support photograph. [Casio Singapore product page](https://www.casio.com/sg/electronic-musical-instruments/product.CT-S1BK/) · [Casio Singapore support](https://www.casio.com/sg/electronic-musical-instruments/support.CT-S1BK/)
- CT-S1 control strip and first and last keys, EN-4–5. The original model uses the manual's control grouping and approximate placements cross-checked against Casio's CT-S1BK AR reference. The caps use simple unmarked geometry. Exact cap shapes, LEDs, markings and measured spacing remain open. [Casio CT-S1 User’s Guide](https://www.casio.com/content/dam/casio/global/support/manuals/electronic-musical-instruments/pdf/008-en/c/CTS1_usersguide_EN.pdf#page=5) · [Casio AR references](https://www.casio.com/us/electronic-musical-instruments/web-ar/)
- GP-510BP dimensions, finish, pedal count and supplied exact-model product side photograph. [Casio Singapore product page](https://www.casio.com/sg/electronic-musical-instruments/product.GP-510BP/)
- Stand panels, rear and pedal crosspiece, EN-61. [Casio GP-510 User’s Guide](https://www.casio.com/content/dam/casio/global/support/manuals/electronic-musical-instruments/pdf/008-en/g/GP510_usersguide_A_EN.pdf#page=63)

[Editable Blender source](casio-instruments.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s15-recital-details.glb) · [QA receipt](receipt.json)
