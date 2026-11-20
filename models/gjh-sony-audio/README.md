# S13 Sony audio specimens

These unbranded gallery models share the same painted geometry between the Blender editor and the room. Local source axes are +Y up and +Z front. The Blender mesh conversion maps these to +Z up and −Y front.

| Blender mesh | Slot-local base origin (m) | Aisle yaw |
| --- | --- | --- |
| `Sony NW-A306 Walkman` | `(-3.05, 1.004, 0.10)` on the existing 20 × 22 cm walnut stand | +90° |
| `Sony WH-1000XM6 Headphones` | `(-3.05, 0.9775, 0.48)` on the left Sony cabinet | +90° |

## References and dimensions

- **WH-1000XM6.** The supplied parts diagram establishes the slider, folding pivot and top-edge cup connection. The supplied product photo and Sony gallery guide the broad, tapered arch and Sand Pink palette. The cups have stepped convex outer shells and inset oval cushions. All headphone dimensions, including the roughly 190 × 215 mm display silhouette, are visual estimates. The low plinth is authored gallery furniture. [Sony Singapore product gallery](https://store.sony.com.sg/collections/all-products-except-ps5-1000x/products/wh-1000xm6-wireless-noise-cancelling-headphones-sand-pink), [Sony Singapore manuals and Help Guide](https://www.sony.com.sg/electronics/support/wireless-headphones-bluetooth-headphones/wh-1000xm6/manuals)
- **NW-A306.** Sony specifies approximately 56.5 × 98.4 × 11.8 mm overall and 55.7 × 98.2 × 11.8 mm excluding projections, ordered width × height × depth. The geometry uses those envelopes for the black chassis and its projections. The supplied Sony parts diagram guides the physical controls and openings. The right edge carries power, volume +, volume −, next, play, previous and hold from top to bottom. The bottom edge, read from the front, carries the headphone jack, strap loop opening, USB-C and microSD cover from left to right. [Sony Singapore dimensions and specifications](https://www.sony.com.sg/electronics/support/digital-music-players-nw-nwz-a-series/nw-a306/specifications), [Sony Singapore product gallery](https://www.sony.com.sg/walkman/products/nw-a306?locale=en_SG), [Sony Singapore manuals and Help Guide](https://www.sony.com.sg/electronics/support/digital-music-players-nw-nwz-a-series/nw-a306/manuals)

The Walkman uses dark inactive glass, recessed port and mic surfaces, and two shallow grooves to suggest the rear texture. Individual openings, chassis chamfers, button profiles, groove spacing and recess depths are display approximations. Fine markings, logos, connector internals, hidden mechanisms and headphone sensor or microphone perforations are omitted.

## Entry points

- [`generate.py`](generate.py) exposes `build()`, which links and returns the two mesh objects in table order. Named vertex groups select the shared geometry's individual parts.
- [`sony_audio_models.py`](../../scripts/gjh_interiors/sony_audio_models.py) exposes `add_sony_audio_models(room)`, which appends both cabinet specimens to the existing `CRAFT` / Enamel batch. The geometry adds 1076 triangles, including the plinth, with no extra material or instance. Room and JavaScript integration and the GLB export belong to the parent.

[Editable Blender source](sony-audio.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s13-listening-details.glb) · [QA receipt](receipt.json)
