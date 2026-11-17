# Blender gallery fixtures in the three open shops

The reference images show tea service at the New Moon tasting island, a stocked pantry at MILI, and beverage preparation at the GOGO counter. The following models sit on the existing counters and shelves at native metre scale. They are unbranded decorative fixtures. Product inspection, bag contents, collision and seated interactions remain with their existing owners.

| Shop | Source model | Width × height × depth (m) | Placement |
| --- | --- | --- | --- |
| S01 / New Moon | [Kopitiam Saucer and Cup](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/kopitiam-saucer-and-cup) | 0.156 × 0.088 × 0.156 | Three warm white porcelain cups and saucers with green rims set the stone tasting island for service. |
| S01 / New Moon | [Kopitiam Kettle](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/kopitiam-kettle) | 0.4041 × 0.36 × 0.27 | The brushed-aluminium kettle and its black handle sit behind the cups on the island. |
| S02 / MILI | [condiment-bottle-jar-set](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/condiment-bottle-jar-set) | 0.9 × 1.1 × 0.35 | Two racks of unlabelled amber bottles fill the pantry shelves shown in the reference. |
| S03 / GOGO | [Coffee Machine](https://github.com/yapweijun1996/Blender-3D-Gallery/tree/a87117622ed25efc5f804c9ee6ed0171e4946cf7/models/coffee-machine) | 0.48 × 0.5045 × 0.58 | A steel beverage machine on the cream worktop completes the service side of the fluted bar. |

The GLBs are byte-identical copies of their linked source exports at the pinned commit. Each source is original procedural Blender geometry and materials from the owner’s Blender-3D-Gallery. The asset licenses authorize reuse in the owner’s projects. No additional textures or dependencies are required. The furnishings registry verifies SHA-256, root identity and dimensions before placement. [GOGO’s three upholstered stools](gjh-gogo-bar-stool.md) use a separately documented static adaptation.

The four decorative assets (1,022,864 bytes total) load once when the visitor approaches their ground-floor shop. Their requests and mesh batching are deferred beyond entrance startup. The existing shelves and counters are visible during loading and on failure. Diagnostics keep a frozen record with live pending, loading, loaded or fallback status for each asset.

Runtime captures: [New Moon tea service](mall-design-anchors/runtime/S01-gallery-detail.webp), [MILI pantry shelves](mall-design-anchors/runtime/S02-gallery-detail.webp), [GOGO service counter](mall-design-anchors/runtime/S03-gallery-detail.webp). In the cold local browser check, the first playable entrance frame required zero of the four GLBs. At the three frontal arcade viewpoints the browser requested two, one and one additional GLBs respectively. All four loaded and revisiting each shop triggered no duplicate requests.
