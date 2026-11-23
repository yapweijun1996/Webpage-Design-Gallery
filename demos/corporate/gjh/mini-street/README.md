# GJH Mini Street

## Deliverable and scope

An independent, unofficial 3D street outside the existing GJH Virtual Mall concept. The visitor can look around a rainy SG/MY-inspired shophouse street, browse New Moon packshots, try a fictional capsule and follow the mall entrance to v11. The street uses original procedural geometry and artwork, real camera movement, and a day/night lighting toggle.

## Gallery registration and local preview

The [Goh Joo Hin collection](../../../../companies/gjh/index.html) lists [GJH Mini Street](../../../../designs/index.html?company=gjh&design=mini-street) under the design ID `gjh-mini-street`. Its curated order is `85`, directly after v11. The live route is `demos/corporate/gjh/mini-street/`. The detail page uses browser captures of the working prototype, and the collection thumbnail comes from the desktop capture. The Mini Street theme in [the design system registry](../../../../design-system/themes.json) owns its palette and type.

From the repository root, build and serve a local static export with Python 3.13, as used by the Pages workflow.

```sh
preview_dir=$(mktemp -d)
python3 scripts/build_gallery.py --output "$preview_dir/Webpage-Design-Gallery"
python3 -m http.server 8000 --directory "$preview_dir"
```

Open `http://localhost:8000/Webpage-Design-Gallery/` for the Gallery or append `demos/corporate/gjh/mini-street/` for the direct route. The generator includes `script.js`, `scene.js`, `world.js`, the three screenshots, the thumbnail and the referenced v11 files. For development, serving the repository root with `python3 -m http.server 8000` also exposes the direct route at `/demos/corporate/gjh/mini-street/`.

## Offline and fallback behavior

The Gallery shell can show the collection and Mini Street thumbnail after its cache is installed. The full-size screenshots and live demo files need a reachable static host. Mini Street has no scoped service worker or install manifest. Its WebGL fallback runs after the page loads and still uses the locally served HTML, JavaScript and packshot files. A local HTTP server can serve all of those files without an internet connection.

## Reuse audit

- Three.js r170 is imported from [v11's vendored module](../v11/vendor/three.module.min.js) under its [MIT license](../v11/vendor/three.LICENSE). The route needs no external runtime services or installation.
- The shop loads the four local v11 768 px WebP derivatives for New Zealand, Australia, South Africa and Mexico. The [v11 source receipts](../v11/assets/sources.json) identify the official JPEG packshots and capture context. The display uses the pack origins and weights recorded in v11 and keeps the images in the product panel.
- The mall entrance navigates to [v11](../v11/). The street and v11 keep their own presentation and state.
- The supplied anchor guides composition, palette and lighting. The architecture, street signage, window props, capsule designs and umbrella visitor are original concept scenery.
- The [Blender asset audit](ASSET-AUDIT.md) records reuse candidates. The scene uses procedural geometry throughout. The Style Atlas primary reference uses an AI-generated concept image from the owner session; Gallery previews are captures of the implemented prototype, not that concept image.

## Known limits

WebGL 2 is required for 3D. The HTML stops and shop images remain available during a WebGL failure. Reload the page to retry 3D after a lost context. With JavaScript disabled, the stop links jump to details on the page and capsule selection is unavailable. Reduced motion disables animated rain. The camera covers a bounded street view, and the mobile starting view frames the shop and vending machine. The scene is stylized, with decorative interiors and a stationary visitor. The capsule interaction is virtual and transient. The v11 receipts describe the packaging at capture time. Current packaging, real-device performance and WebKit rendering remain unverified.

## Registration verification

The collection entry answers what visitors can explore before entering the mall. The New Moon street stop opens a panel with four packshots and their labeled weights. The vending stop reveals a fictional keepsake, and Enter Mall opens v11's arrivals page.

Headless Chromium 159.0.8154.6 loaded the generated artifact at the `/Webpage-Design-Gallery/` prefix through Playwright request interception. The gallery root, company card, design details and live entry opened successfully. The three scripts and the shared Three.js module returned 200. The day control changed the rendered scene, the shop decoded all four 768 px WebP images, Escape restored keyboard focus, the vending result appeared and the mall link opened v11. The 1440 × 900, 768 × 1024 and 390 × 844 first screens matched the saved night captures with reduced motion enabled. A WebGL-disabled phone viewport retained the shop and capsule interaction. With JavaScript disabled, the shop link opened the inline packshots.

The sandbox denied localhost binding. The intercepted run covered loading and interaction with service workers blocked. HTTP hosting, browser service-worker lifecycle and offline reconnect behavior still need a hosted browser check.

## Manual acceptance

1. Open the route at desktop, tablet and phone widths. Confirm the rainy evening scene, readable street stops and visible camera and lighting controls.
2. Drag the canvas or use the directional buttons, then reset. Tap or click the storefront and vending machine in the scene. Use Tab and Enter to open each labeled stop, then check focus returns after Back, Close and Escape.
3. Check the shop's four packshots and displayed weights. In vending, select each capsule and check its fictional result.
4. Switch Day on and return to Night. Check the sky, window glow, road reflections and rain. Repeat with reduced motion enabled.
5. Open the mall entrance and use browser Back to return. Repeat under a nested URL prefix. Disable WebGL and repeat the HTML stop flows, then disable JavaScript and check the inline shop and vending details.
