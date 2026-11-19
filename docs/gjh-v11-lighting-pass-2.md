# GJH V11 lighting pass 2

The expanded mall uses an offline world-XZ atlas for architectural light and contact occlusion, a compact Detailed shadow, and a mood for each of the 17 shops.

## Baked floor and ceiling

Run `python scripts/bake_gjh_mall_lighting.py` with Node and Pillow installed. The bake reads the expanded shell bounds, shop frames, door openings, prop envelopes and oriented colliders from the current scene sources. It stamps soft wall and furniture occlusion into the floor tile and cove falloff into the ceiling tile. Re-run it when walls, shelving or fixtures move. The script supports `--check` for decoded-pixel comparisons across libwebp versions.

The assets are 1024² and 2048² lossless WebP atlases. They contain one floor tile and one ceiling tile with gutters. Low draws the 1024² atlas on the floor. Balanced and Detailed draw both layers at 2048² on desktops and tablets, and 1024² on phones. Each enabled layer adds one draw in the main pass. Planar UVs are derived from world XZ when the geometry is built. The layers follow the public slab, shop finishes and roof panels, with the lift shaft and open roof cut from the applicable planes. The current pass covers the ground floor and opaque ceilings.

Black alpha attenuates the existing surface colour. The geometry and material use the same instanced MeshBasic map path as the contact decals. The atlas is optional, mip-free, and uploaded through the shared model warm-up queue. Its decode and upload do not gate the loader or tier activation. Decoded RGBA texture storage is 4 MiB at 1024² and 16 MiB at 2048² before driver overhead. A desktop that switches between Low and a higher tier can retain both textures.

## Detailed shadow

The 1024² directional map spans 16 × 16 m in the light plane, or 1.5625 cm per texel. The centre follows the player, including lift travel. Both axes of the light plane snap to texels, and the key direction stays constant. Low and Balanced keep contact shading. Detailed retains the existing viewport gate for real-time shadows.

## Shop mood

Each shop's `ambient` block supplies 2700–4000 K colour temperature, a brand accent and an authored shop-local focus. The two existing point lights move to that focus and its fill position after the fade-out. The selected festival key continues to influence both colours. The three existing PMREMs still select the public or shop zone. Shop IBL intensity blends from the public-zone value over the first 1.6 m inside the bay to a value based on temperature and accent luminance. This blend updates a renderer uniform. The ground-floor two-point and landing zero-point warm-up variants remain the same.

## Acceptance

The Node smoke test starts the built world with Canvas, fetch, physics and renderer stubs, submits all three tiers and checks atlas selection, roof clearance and shadow placement. Other Node tests cover the startup fallback, all 17 focus positions and sub-texel shadow movement.

**UNVERIFIED in Chrome and on real devices.** Keep the pre-patch lighting captures as the baseline. Compare 390 px and 1440 px captures, inspect wall corners and shelves, and record the shop thresholds and lift to catch flicker or shadow crawl. Run the cold early-entry probe on all tiers and compare linked program counts and lap p95 timing against the baseline. Check 30 FPS on iOS and Android Low, 60 FPS on tablet and PC, dynamic resolution, and the Low 220k/70, Balanced 300k/90 and Detailed 420k/110 triangle and draw budgets. The [probe guide](gjh-v11-probes.md) lists the commands and their thresholds.
