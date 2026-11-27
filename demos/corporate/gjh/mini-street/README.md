# GJH Mini Street

## Deliverable and scope

An independent, unofficial 3D street outside the existing GJH Virtual Mall concept. The visitor can look around a rainy SG/MY-inspired shophouse street, browse New Moon packshots, dispense a fictional drink and follow the mall entrance to v11. The street uses real camera movement and a day/night lighting toggle. On phones the camera opens on the storefront and vending machine. Drag left or press Look right three times to frame the full mall arch. At tablet and desktop widths the opening view includes the covered walkway and mall canopy.

The upstairs window openings pass through the facade and have deep jambs, fanlight bars, shutters, curtains and pendant shades. The shop has a recessed glazed doorway, staggered cases, a tea counter and back shelves under timber ceiling beams. Striped fabric hangs from a roller with visible ribs and braces. Potted plants, a teapot beside the bench, the gold crescent on the vending machine and the visitor's tote give the five-foot way a sense of scale. Drain grates and a curved curb lead past the mall into another row of shophouses. The rainy evening uses warm light pools and a low-resolution planar reflection with irregular pools and gutter runoff. In daylight the fixtures dim and the paving retains a weaker reflection.

The green cabinet has lit shelves with two rows of coded cans and bottles, a demo reader and a recessed pickup tray. Its close-up is a rotatable 3D model: drag horizontally on touch, drag or use arrow keys on desktop, or reset the view. The machine and its close-up share six fictional drinks and shelf codes. Choose a slot, press Vend, watch the dispensing mechanism and collect the drink to start another round. When the 3D view is outside the visible area, the control panel shows the drop instead. Sound is off until the visitor enables it; the locally synthesized button, motor, impact and pickup sounds can be muted. The simulation is free and resets when you leave the close-up.

The mall portal has a cream stone rim, illuminated brass fins and a two-line GJH Virtual Mall marquee. A stepped threshold leads into a recessed glazed vestibule with ceiling lights and a warm lobby behind it. The portal's silhouette accepts canvas clicks and taps. On wider screens the Enter Mall link sits near the foot of the steps, leaving the marquee and doors visible.

## Gallery registration and local preview

The [Goh Joo Hin collection](../../../../companies/gjh/index.html) lists [GJH Mini Street](../../../../designs/index.html?company=gjh&design=mini-street) under the design ID `gjh-mini-street`. Its curated order is `85`, directly after v11. The live route is `demos/corporate/gjh/mini-street/`. The detail page uses browser captures of the working prototype, and the collection thumbnail comes from the desktop capture. The Mini Street theme in [the design system registry](../../../../design-system/themes.json) owns its palette and type.

From the repository root, build and serve a local static export with Python 3.13, as used by the Pages workflow.

```sh
preview_dir=$(mktemp -d)
python3 scripts/build_gallery.py --output "$preview_dir/Webpage-Design-Gallery"
python3 -m http.server 8000 --directory "$preview_dir"
```

Open `http://localhost:8000/Webpage-Design-Gallery/` for the Gallery or append `demos/corporate/gjh/mini-street/` for the direct route. The generator includes `script.js`, `scene.js`, `world.js`, `surfaces.js`, `vending.js`, the vending 3D, audio and sequence modules, the shelf label atlas, the three screenshots, the thumbnail and the referenced v11 files. For development, serving the repository root with `python3 -m http.server 8000` also exposes the direct route at `/demos/corporate/gjh/mini-street/`.

## Offline and fallback behavior

The Gallery shell can show the collection and Mini Street thumbnail after its cache is installed. The full-size screenshots and live demo files need a reachable static host. Mini Street has no scoped service worker or install manifest. Its WebGL fallback runs after the page loads and still uses the locally served HTML, JavaScript and packshot files. A local HTTP server can serve all of those files without an internet connection.

## Reuse audit

- Three.js r170 is imported from [v11's vendored module](../v11/vendor/three.module.min.js) under its [MIT license](../v11/vendor/three.LICENSE). The route needs no external runtime services or installation.
- The shop loads the four local v11 768 px WebP derivatives for New Zealand, Australia, South Africa and Mexico. The [v11 source receipts](../v11/assets/sources.json) identify the official JPEG packshots and capture context. The product panel shows the pack origins and weights recorded in v11. The shelves use a compact [label atlas](assets/new-moon-label-atlas.webp) derived from the same four documented packs. The storefront sign, pavement board and vending badge use a crescent drawn in code.
- The mall entrance navigates to [v11](../v11/). The street and v11 keep their own presentation and state.
- The primary Style Atlas reference remains the [AI concept image](assets/mini-street-anchor.webp) from the owner session. Gallery previews show the rendered prototype. All street geometry and decorative textures were authored for Mini Street.
- The [Blender asset audit](ASSET-AUDIT.md) records the candidates and the label atlas derivation. No candidate GLB is required to render the street. Repeated architectural parts, plants and stock use GPU instancing. The mirror is capped at 640 × 448 and refreshes on camera, viewport or lighting changes. Animated rain reuses the cached view of the street in the mirror.

## Known limits

WebGL 2 is required for 3D. The HTML stops, shop images and working vending close-up remain available during a WebGL failure. Reload the page to retry 3D after a lost context. With JavaScript disabled, the stop links jump to the inline details, where the vending stop explains how to enable the simulation. Reduced motion renders stationary rain streaks and places the dispensed drink directly in the tray. The camera covers a bounded street view, and the mobile starting view frames the shop and vending machine. The mouse wheel over the street zooms; outside the scene it scrolls the page. Pinch and the zoom buttons remain available. The scene uses stylized architecture and a stationary visitor. The display models indicate the four packs and use approximate tin geometry. The dialog provides the full packshots. The v11 receipts describe the packaging at capture time. Current packaging and physical-device performance remain unverified.

## Registration verification

The collection entry answers what visitors can explore before entering the mall. The New Moon street stop shows a loading dialog and enters the 3D shop automatically. If 3D is unavailable, a fallback panel shows four packshots and their labeled weights. The vending stop opens the interactive drink machine, and Enter Mall opens v11's arrivals page.

The saved Gallery captures show the enhanced street recorded on 24 November 2026; the historical browser results below cover earlier builds. The captures use reduced motion for a reproducible first screen. Each was taken from the running WebGL prototype at 390 × 844, 768 × 1024 or 1440 × 900 CSS pixels. The 720 × 450 collection thumbnail is a downsample of the desktop capture.

### Vending machine pass

Real HTTP Chromium and WebKit checks of the vending implementation exercised the virtual drinks, tray collection, history and rapid reopening, reduced motion, WebGL fallback, and a stalled-animation fallback before integration onto main `6e8520a1`. Touch controls were checked at 320 × 568; no physical device testing was performed. The gallery export explicitly includes the shared vending module, and the existing v11 crowd regression remains a separately documented baseline limitation.

### Mall entrance pass

A real HTTP Chromium check of build `a71aa8c02f698adf` exercised actual canvas clicks or touch at 1440 × 900, 768 × 1024, 390 × 844, 390 × 647 and 320 × 568. Each opened v11 and restored the 3D street on Back; hits outside the arch were also checked. A narrow 320 × 568 viewport requires scrolling to reach the lighting controls. Physical phone performance remains unverified. The required GJH browser suite passed its standalone layout checks but timed out waiting for a v11 crowd member within 45 seconds. The same targeted check timed out at the same step on the unmodified `71901df6` baseline in the same headless environment.

### Facade and street detail pass

Playwright captured the `c1ef4ad` baseline and revised build `e4ff0e278a085c84` in Chromium 159.0.8154.6 with SwiftShader. The final captures matched fresh renders from the generated export at each viewport. The sandbox denied localhost binding, so Playwright fulfilled requests directly from the static files at the Pages-style `/Webpage-Design-Gallery/` prefix. Renderer counters describe submitted geometry for the opening view. They do not measure frame rate.

| CSS viewport | Main calls, before → after | Main triangles, before → after | Mirror size |
| --- | ---: | ---: | ---: |
| 390 × 844 | 117 → 141 | 182,080 → 197,866 | 186 × 364 |
| 1440 × 900 | 175 → 203 | 187,195 → 203,793 | 640 × 340 |

### Original registration

The historical comparison used commit `ebf37085a6cc124c8187ceb5aad9ff53445d7b96` as its baseline.

Headless Chromium 159.0.8154.6 loaded build `06e505d627ee533b` at the `/Webpage-Design-Gallery/` prefix. The gallery collection and detail links opened the demo. All three saved screenshots matched the exported live renders pixel for pixel. A shorter 390 × 647 touch viewport also kept the shop, machine and controls in view. The run covered canvas raycasts, mouse and touch drag, camera reset, day/night, stationary and animated rain, keyboard focus, four decoded packshots, the three fictional capsules, direct hash links, browser Back and Forward, and the v11 mall navigation. With WebGL disabled or the context lost, the accessible stops stayed usable. With JavaScript disabled, the inline shop and vending details remained reachable.

Three.js renderer counters measured the geometry submitted for the first screen at device scale 1. The main pass in the detailed street submits more geometry. Shared arch profiles, half-barrel roof tiles and simplified flower meshes limit that cost. Each row shows the main pass and the separately cached mirror resolution.

| CSS viewport | Main calls, before → after | Main triangles, before → after | Mirror size, before → after |
| --- | ---: | ---: | --- |
| 390 × 844 | 85 → 117 | 110,952 → 182,080 | 200 × 392 → 186 × 364 |
| 1440 × 900 | 130 → 175 | 117,453 → 187,195 | 720 × 382 → 640 × 340 |

The gallery build and check, design-system check, SSOT gate and 16 Gallery contract tests passed.

The earlier `06e505d627ee533b` run served generated files by request interception because its sandbox denied localhost binding. For that earlier build `8cfc46f0427f263b`, a separate real HTTP check at 390 × 844 loaded the 3D street and shelf atlas successfully in headless Chromium and WebKit. Chromium also exercised day mode, the shop and the vending deep link. A focused Chromium regression verified normal, missing and corrupt shelf textures with `roundRect` unavailable; the fallback remains visible. For build `e4ff0e278a085c84`, separate real HTTP checks exercised 3D canvas interaction, camera controls, day/night, and the mall route at 1440 × 900, 768 × 1024, 390 × 844 and 390 × 647 in Chromium; WebKit loaded the 3D scene at 390 × 844. The shelf texture fallback and WebKit deep links also passed. Gallery and PWA browser checks passed. The unrelated long-running v11 demo suite was interrupted under high test-machine load and is not reported as passed. These browser checks do not establish physical iPhone performance.

## Manual acceptance

1. Open the route at desktop, tablet and phone widths. Confirm the rainy evening scene, readable street stops and visible camera and lighting controls.
2. Drag the canvas or use the directional buttons, then reset. Tap or click the storefront and vending machine in the scene. Use Tab and Enter to open each labeled stop, then check focus returns after Back, Close and Escape.
3. Open the shop once and verify the loading dialog enters automatically; inspect its four products and virtual basket. With WebGL unavailable, check the fallback packshots and weights. In vending, select a can and then a bottle. Check the selection, press Vend, watch the drink settle in the tray, and collect it. Start again, close during the drop and reopen with the same link. Repeat with the keyboard and with reduced motion enabled.
4. Switch Day on and return to Night. Check the sky, window glow, road reflections and rain. Repeat with reduced motion enabled.
5. On a phone, turn right until the full mall arch is in view. Tap or click the 3D doorway to open v11, then use browser Back to return. Repeat with the Enter Mall link using Tab and Enter and under a nested URL prefix. Disable WebGL and repeat the HTML stop flows, then disable JavaScript and check the inline shop and vending details and the Enter Mall link.

## Experimental visitor candidate

The optional `?visitorCandidate=1` preview loads the V18 static Girl visitor with a raincoat, umbrella and shopping bag. V18 adjusts the umbrella canopy and straight shaft alignment and refines the right-hand grip. The normal route retains the original visitor. If the candidate cannot load, the original visitor is restored. [Source and provenance](../../../../models/mini-street/README.md) describe the experimental asset and its limitations; it is not a motion-ready character.

### Visitor framing on short screens

The visitor candidate preview uses a compact street layout on landscape viewports up to 480 CSS pixels high, with the stage and primary camera and lighting controls visible together. The Visitor focus uses a landscape-specific distance to fit the complete static model; portrait opening view is slightly closer to the visitor while preserving the rightward mall framing. Camera help remains available below the primary controls. The focused short-landscape view visually hides scene hotspot labels; keyboard focus reveals them, and reset restores their normal presentation.

Chromium candidate checks at 568 × 320, 844 × 390, 320 × 568, 375 × 667 and 390 × 844 verified the projected candidate mesh fits in the stage, the Visitor tap does not scroll the page, controls are at least 44 px and no hotspot overlaps the model. Zoom bounds, day/night and reset were exercised. Existing Chromium and WebKit controls tests covered English, Chinese and Malay, and the scene regression covered touch pinch, mouse wheel, keyboard, shop entry, history, lighting and fallback. These browser simulations do not establish physical-device performance.
