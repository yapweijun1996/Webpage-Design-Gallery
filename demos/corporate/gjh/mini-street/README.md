# GJH Mini Street

## Deliverable and scope

An independent, unofficial 3D street outside the existing GJH Virtual Mall concept. The visitor can look around a rainy SG/MY-inspired shophouse street, browse New Moon packshots, try a fictional capsule and follow the mall entrance to v11. The street uses real camera movement and a day/night lighting toggle. The closer, oblique camera frames the storefront and vending machine on phones, and reveals the covered walkway and Virtual Mall canopy on wider screens.

The shop has a recessed floor and ceiling, a glazed double door, staggered stock cases and back shelves lit by pendants. Carved window surrounds, turned shutters, patterned tiles, layered terracotta roofing and a scalloped canopy shape the facade. Plants, lamps, banners and a raised entrance mark the path along the five-foot way. The rainy evening uses warm light pools and a low-resolution planar reflection with irregular surface ripples. In daylight the warm fixtures dim and the paving retains a weaker reflection.

## Gallery registration and local preview

The [Goh Joo Hin collection](../../../../companies/gjh/index.html) lists [GJH Mini Street](../../../../designs/index.html?company=gjh&design=mini-street) under the design ID `gjh-mini-street`. Its curated order is `85`, directly after v11. The live route is `demos/corporate/gjh/mini-street/`. The detail page uses browser captures of the working prototype, and the collection thumbnail comes from the desktop capture. The Mini Street theme in [the design system registry](../../../../design-system/themes.json) owns its palette and type.

From the repository root, build and serve a local static export with Python 3.13, as used by the Pages workflow.

```sh
preview_dir=$(mktemp -d)
python3 scripts/build_gallery.py --output "$preview_dir/Webpage-Design-Gallery"
python3 -m http.server 8000 --directory "$preview_dir"
```

Open `http://localhost:8000/Webpage-Design-Gallery/` for the Gallery or append `demos/corporate/gjh/mini-street/` for the direct route. The generator includes `script.js`, `scene.js`, `world.js`, `surfaces.js`, the shelf label atlas, the three screenshots, the thumbnail and the referenced v11 files. For development, serving the repository root with `python3 -m http.server 8000` also exposes the direct route at `/demos/corporate/gjh/mini-street/`.

## Offline and fallback behavior

The Gallery shell can show the collection and Mini Street thumbnail after its cache is installed. The full-size screenshots and live demo files need a reachable static host. Mini Street has no scoped service worker or install manifest. Its WebGL fallback runs after the page loads and still uses the locally served HTML, JavaScript and packshot files. A local HTTP server can serve all of those files without an internet connection.

## Reuse audit

- Three.js r170 is imported from [v11's vendored module](../v11/vendor/three.module.min.js) under its [MIT license](../v11/vendor/three.LICENSE). The route needs no external runtime services or installation.
- The shop loads the four local v11 768 px WebP derivatives for New Zealand, Australia, South Africa and Mexico. The [v11 source receipts](../v11/assets/sources.json) identify the official JPEG packshots and capture context. The product panel shows the pack origins and weights recorded in v11. The shelves use a compact [label atlas](assets/new-moon-label-atlas.webp) derived from the same four documented packs. The sign uses plain serif lettering and a decorative rosette.
- The mall entrance navigates to [v11](../v11/). The street and v11 keep their own presentation and state.
- The primary Style Atlas reference remains the [AI concept image](assets/mini-street-anchor.webp) from the owner session. Gallery previews show the rendered prototype. All street geometry and decorative textures were authored for Mini Street.
- The [Blender asset audit](ASSET-AUDIT.md) records the candidates and the label atlas derivation. No candidate GLB is required to render the street. Repeated architectural parts, plants and stock use GPU instancing. The mirror is capped at 640 × 448 and refreshes on camera, viewport or lighting changes. Animated rain reuses the cached view of the street in the mirror.

## Known limits

WebGL 2 is required for 3D. The HTML stops and shop images remain available during a WebGL failure. Reload the page to retry 3D after a lost context. With JavaScript disabled, the stop links jump to details on the page and capsule selection is unavailable. Reduced motion renders stationary rain streaks in the night view. The camera covers a bounded street view, and the mobile starting view frames the shop and vending machine. The scene uses stylized architecture and a stationary visitor. The display models indicate the four packs and use approximate tin geometry. The dialog provides the full packshots. The capsule interaction is virtual and transient. The v11 receipts describe the packaging at capture time. Current packaging and physical-device performance remain unverified.

## Registration verification

The collection entry answers what visitors can explore before entering the mall. The New Moon street stop opens a panel with four packshots and their labeled weights. The vending stop reveals a fictional keepsake, and Enter Mall opens v11's arrivals page.

The captures use reduced motion for a reproducible first screen. Each was taken from the running WebGL prototype at 390 × 844, 768 × 1024 or 1440 × 900 CSS pixels. The 720 × 450 collection thumbnail is a downsample of the desktop capture. The baseline was rendered from commit `ebf37085a6cc124c8187ceb5aad9ff53445d7b96` at the same viewports.

Headless Chromium 159.0.8154.6 loaded build `06e505d627ee533b` at the `/Webpage-Design-Gallery/` prefix. The gallery collection and detail links opened the demo. All three saved screenshots matched the exported live renders pixel for pixel. A shorter 390 × 647 touch viewport also kept the shop, machine and controls in view. The run covered canvas raycasts, mouse and touch drag, camera reset, day/night, stationary and animated rain, keyboard focus, four decoded packshots, the three fictional capsules, direct hash links, browser Back and Forward, and the v11 mall navigation. With WebGL disabled or the context lost, the accessible stops stayed usable. With JavaScript disabled, the inline shop and vending details remained reachable.

Three.js renderer counters measured the geometry submitted for the first screen at device scale 1. The main pass in the detailed street submits more geometry. Shared arch profiles, half-barrel roof tiles and simplified flower meshes limit that cost. Each row shows the main pass and the separately cached mirror resolution.

| CSS viewport | Main calls, before → after | Main triangles, before → after | Mirror size, before → after |
| --- | ---: | ---: | --- |
| 390 × 844 | 85 → 117 | 110,952 → 182,080 | 200 × 392 → 186 × 364 |
| 1440 × 900 | 130 → 175 | 117,453 → 187,195 | 720 × 382 → 640 × 340 |

The gallery build and check, design-system check, SSOT gate and 16 Gallery contract tests passed.

The earlier `06e505d627ee533b` run served generated files by request interception because its sandbox denied localhost binding. For final build `8cfc46f0427f263b`, a separate real HTTP check at 390 × 844 loaded the 3D street and shelf atlas successfully in headless Chromium and WebKit. Chromium also exercised day mode, the shop and the vending deep link. A focused Chromium regression verified normal, missing and corrupt shelf textures with `roundRect` unavailable; the fallback remains visible. These browser checks do not establish physical iPhone performance.

## Manual acceptance

1. Open the route at desktop, tablet and phone widths. Confirm the rainy evening scene, readable street stops and visible camera and lighting controls.
2. Drag the canvas or use the directional buttons, then reset. Tap or click the storefront and vending machine in the scene. Use Tab and Enter to open each labeled stop, then check focus returns after Back, Close and Escape.
3. Check the shop's four packshots and displayed weights. In vending, select each capsule and check its fictional result.
4. Switch Day on and return to Night. Check the sky, window glow, road reflections and rain. Repeat with reduced motion enabled.
5. Open the mall entrance and use browser Back to return. Repeat under a nested URL prefix. Disable WebGL and repeat the HTML stop flows, then disable JavaScript and check the inline shop and vending details.
