# New Moon merchandising density — 1.1.44

The New Moon display keeps the native source scale while making the shelf read as stocked. Three shelf levels carry 18 visible front facings across the inner cabinet bays, plus one rear depth row for replenishment. The four SKU records therefore expose 36 instances in total, nine per SKU; the visible count is intentionally lower than the physical stock count because the rear row is not a second front-facing display.

Measured source bounds are approximately 0.0775 m diameter × 0.12399 m height for each can and 2.4 m width × 2.4 m height × 0.55 m depth for the M056 shelf. These are estimated packaging/model dimensions, not verified manufacturing measurements. Existing GLB records, labels, and loader validation remain unchanged. The runtime reuses each loaded primitive through `THREE.InstancedMesh`; no additional product fetches or per-can draw-call classes were introduced.

The canonical reservation position is selected from placement metadata at runtime: a front-facing can on the middle shelf level. Pickup hides that exact instance, returns the original matrix, and restores the same stock position. Browser evidence covers 1440px and 390px Chromium views, native bounds, support/no-overlap checks, bag/return, direct 3D Inspect, and draw-call observations. It does not claim physical-device performance.
