# Walking from the mall to the Singapore street

In the expanded GJH mall, turn toward the south entrance by the tram. The glazed doors open when the street floor, buildings and collision surfaces are ready. Walk through, follow the pavement to the row of shophouses, or cross the road to the open HDB void deck. Go back through the same doors to return to the mall. If loading fails, the doors stay closed. Step back, reconnect and approach again to retry. [Street and return views](evidence/gjh-v11-singapore-street/street-route.webp)

This first block is an illustrative neighbourhood. Two apartment buildings, a separate void deck, five shophouses, four road segments and five Angsana trees use five original models totalling 1,825,448 bytes. The source manifest pins each GLB, Blender file and project-use licence at revision `3b87c372`. Street façades have no attributed tenants or products. The entrance sign is in English. The visitor's location control supports English, Simplified Chinese and Malay. On a narrow phone the longer Malay label is truncated visually and available in full through the accessible name. [Architecture views](evidence/gjh-v11-singapore-street/street-architecture.webp) · [Source manifest](../demos/corporate/gjh/v11/assets/districts/singapore/sources.json)

## Loading and returning

The new street module loads as the visitor approaches the south door. The existing renderer, camera, Rapier world, player, Bag and language session continue through the threshold. When the visitor is more than ten metres outside, the mall releases its detailed window studios, fitted rooms and their collision shapes. The structural shell, common furnishings, transport and visitor remain available. Approaching within four metres of the gate starts restoring the fitted mall. Walking more than six metres inside retires the street. Ground-floor Map travel away from the gate also retires the street.

Each detailed model is requested when needed and checked against the source manifest. In secure contexts the loader checks SHA-256 and byte length before parsing. The scoped service worker stores complete verified model responses on demand. With the model cached and the tablet offline, requesting the first four bytes returned HTTP 206 and `glTF`. A range past the end returned HTTP 416 and `bytes */78600`. Reloading the mall offline opened its reconnect page and preserved the Bag in the same tab. [Failure and recovery](evidence/gjh-v11-singapore-street/street-recovery.webp)

## Rendering and camera

The walks used normal touch gestures or mouse and keyboard in Chrome on macOS. The table counts sampled frames and the highest draw count observed. The last three columns show renderer geometries and textures at the start, on the street and after return.

| Viewport | Frames sampled | Peak draws | Mall start | Street | Mall restored |
| --- | ---: | ---: | ---: | ---: | ---: |
| 390 px | 3,945 | 86 | 277 / 110 | 141 / 75 | 277 / 110 |
| 768 px | 3,065 | 104 | 294 / 120 | 158 / 86 | 298 / 127 |
| 1440 px | 7,883 | 112 | 299 / 139 | 162 / 96 | 299 / 141 |

All three widths restored the 20 detailed studio models, 34 fitted-room model entries and 76 room collision shapes. Street-owned camera bounds and physics handles reached zero on return. The phone repeated the trip twice more. The desktop visitor also used the Map from the street and walked into Sony. Renderer geometry and texture totals can change with previously unseen content. The samples describe residency and draw counts on this Mac. Physical handset frame time and GPU memory in bytes remain unmeasured. On the final tablet run the overall renderer finished with four more geometries and seven more textures than at spawn. The exact owners of those extra bindings were not isolated.

Two faults became visible in the native screenshots. An empty upper-floor connector produced an infinite bounding box that collapsed the chase camera near compass headings. After that correction, the real transfer beam still lay across the visitor's head in the void deck. The street now keeps only finite non-empty camera bounds and includes the six individual transfer beams and slab sections. The camera lowers its pivot only beneath their footprints. At matched walking coordinates, actual camera-to-character rays cleared the original geometry at the feet, torso and head. [Void-deck comparisons](evidence/gjh-v11-singapore-street/void-deck.webp) · [Route and rendering measurements](evidence/gjh-v11-singapore-street/route.json)

The first block has a bounded walking area. Additional districts, transport connections and building interiors are still on the world roadmap. With Playwright and Chromium installed, this command runs the tablet route twice and saves the evidence.

```sh
python tests/browser_gjh_district.py --width 768 --cycles 2 --evidence /tmp/gjh-street-check
```
