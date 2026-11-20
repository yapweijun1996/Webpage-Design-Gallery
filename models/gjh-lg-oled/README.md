# S14 LG OLED55C5PSA

This stand-free television has a blank near-black glass face, a thin backing panel and a stepped lower electronics housing. Its exact outer envelope is **1222 × 703 × 45.1 mm** (width × height × depth), with four recessed mounting points on a **300 × 200 mm** VESA pattern.

## LG references

- The local product reference is the OLED55C5PSA.ATC. [LG Singapore product support](https://www.lg.com/sg/support/product-support/cs-OLED55C5PSA.ATC)
- The OLED55C5 family setup guide supplies the side profile, stand-free dimensions and VESA hole spacing. [LG C5 quick setup guide](https://gscs-b2c.lge.com/open/downloadFile?fileId=zc0wLoPBGgSSwvU0S7RCQ)
- The same-SKU rear and side photographs guide the lower housing outline, horizontal vent, mounting point placement and the two dark central rear reliefs. LG lists four HDMI inputs, three USB inputs, one Ethernet input, one optical output and one RF input. Socket order and orientation for the Singapore unit remain open. [LG Philippines product gallery and specifications](https://www.lg.com/ph/tv-soundbars/oled-evo/oled55c5psa/)

The thin panel is estimated at 6.5 mm. The housing spans about 80% of the panel width and 73% of its height. Case bevels, vent stripe spacing, mounting-row height, and relief sizes and depths are photo-based approximations. The vent uses painted stripes on a shallow inset floor. The two rectangular reliefs have plain inset floors. A flat unprinted patch represents the lighter rectangle visible beside the upper relief. Mount threads, individual sockets, marbled surface texture, labels, stand hardware and cables are omitted.

## Entry points

- [lg_oled_model.py](../../scripts/gjh_interiors/lg_oled_model.py) exposes `add_lg_oled(room)`. It appends 358 triangles to the existing Painted Room batch (`CRAFT` / Enamel). Its default slot-local center is `(2.34, 1.70, -3.928)` metres, with +Y up and +Z front.
- [generate.py](generate.py) exposes `build()`, which links and returns the editable `LG OLED55C5PSA` mesh at the same room position. Named vertex groups identify its parts. Blender coordinates are +Z up and −Y front.

For room integration, call `add_lg_oled(r)` in `living()` in place of the cabinet and glass placeholder boxes. The separate 3.43 × 1.92 m gallery display keeps its existing abstract artwork.

[Editable Blender source](lg-oled.blend) · [Installed room GLB](../../demos/corporate/gjh/v11/assets/interiors/s14-living-details.glb) · [QA receipt](receipt.json)
