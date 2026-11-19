# Demo module map (all demos except GJH v11)

Scope: `demos/corporate/gjh/{v1,v5..v10,v12..v23,shared,research,landing_checks.py}`, `demos/food-beverage/yeos/**`, `demos/heritage/thow-kwang/**`. Companion consumers (`companies/*/index.html`, `compare/`, `designs/`) are listed only as consumers. Every row was derived from the committed source; items that could not be confirmed from code are marked **NOT VERIFIED**. Metadata (id, displayTitle, summary, styles, order) is each demo's `metadata.json`. GJH v11 (Virtual Mall) is out of scope and has its own PWA worker.

## 1. Cross-cutting facts

| Topic | Fact (source) |
| --- | --- |
| Catalog row | Each version dir holds `metadata.json` (ids `gjh-vN`, `yeos-vN`, `thow-kwang-vN`; `order` = 10 x version position). Consumed by `scripts/build_gallery.py`, which generates `data/designs.json`, `companies/<slug>/index.html`, `version.json`, root `sw.js`. |
| Generated per demo | `manifest.webmanifest` and `sw.js` come from `scripts/build_demo_pwas.py` (skips `gjh-v11`). Never hand-edit. Template: `templates/gallery/demo-sw.js`. |
| Demo PWA identity | Manifest `id`/`scope` = `./`, `start_url` = `./index.html`, `display: standalone`, theme color read from the page's `<meta name="theme-color">`, gallery-owned icons. Cache = `wdg:demo:<path>:<build>`. |
| Worker behavior | Installs by fetching `version.json`, then every listed file with a SHA-256 check in batches of 6; any mismatch discards the candidate. Cache-first for listed files, navigations fall back to the network then to `index.html`. `SKIP_WAITING` message applies updates. |
| Worker file list | Always: `src/demo-pwa.js`, `assets/demo-pwa.css`, `assets/tokens.css`, gallery icons (180/192/512/maskable), the version dir (minus `thumbnail.webp` and `screenshots/`), and `<company>/shared/`. For yeos and thow-kwang also everything image/font under `<company>/v1/assets`. For gjh also `assets/gjh-themes.css`. |
| Install UI | `src/demo-pwa.js` (loaded `defer` by every demo) injects an "Install / offline" `<details>`, install, check-for-updates and "Update and reload" buttons, plus an "Update available" notice. It returns immediately when `window.top !== window.self` (comparison iframes) or when not a secure context. |
| Offline test depth | `tests/browser_company_pwas.py` checks manifest, icon, scope and identity for every catalog entry. It exercises real offline reload for only four samples: gjh v6, gjh v18, yeos v1, thow-kwang v1, plus a yeos v1 offline comparison permalink and a gjh v18 release update. Other demos rely on the shared generator: **NOT VERIFIED per demo**. |
| Consumers | `compare/index.html?company=<id>&left=vA&right=vB` frames two demos in iframes (`tests/browser_gallery.py`, and the iframe tests in `landing_checks.py`). `designs/index.html` and `companies/*/index.html` are generated pages; they link to demos but contain no demo logic. |
| Docs drift | `docs/company-demo-pwas.md` says release 1.2.0 holds "16 GJH designs / 45 standalone demos". The tree now has 20 GJH versions (v11 plus 19 standalone), so that count is stale (documentation only). |

## 2. Check-script inventory (what covers what)

| Script | Covers | What it asserts |
| --- | --- | --- |
| `demos/corporate/gjh/landing_checks.py` | gjh v1, v5-v23 (default `VERSIONS`), `--versions`, `--capture` | At 1440/768/390/320 (plus 393x852 for v23): no horizontal overflow, no page errors (console errors too for v21-v23), then one journey per version (see section 3/4). Extras: v20/v21 and v22 with JavaScript disabled, v21/v22 iframe clipboard fallback via `compare/`, v22 sticky chapters and reduced-motion override. `--capture` rewrites `screenshots/<w>.png` and `assets/thumbnail.webp` (side effect). |
| `tests/browser_premium_landings.py` + `premium_landing_accessibility.py` | gjh v12-v19 | Entry action target and key, per-version task (flip, scenes, brief), text-spacing and clipped-text regressions, optional axe. |
| `tests/browser_gjh_demos.py` | gjh v1, v5, v6, v7 (+ v11 crowd, out of scope) | At 7 viewports: entry action targets, UTF-8 sanity, `assets/sources.json` SHA-256 equals official manifest hashes, concept-art receipts, font OFL file present. |
| `tests/browser_gjh_v8.py` | gjh v8 (smoke-loads v1/v5/v6/v7 too) | Builds a Pages-style artifact, serves under a prefix, checks nav anchors, skip link, `[data-era]`/`[data-milestone]`/`[data-market]` `aria-pressed` state, mobile menu Escape, breakpoint focus recovery, scroll motion, no-JS, optional axe, compare frames v7/v8. Writes v8 screenshots and thumbnail. |
| `tests/browser_gjh_v9.py` | gjh v9 | Four viewports: skip link, ArrowRight between doors, Enter enters MILI, Escape returns and refocuses door, four product dialogs (sku-nz/au/sa/mx) with Tab containment and focus return, list view, deep link `#sku-nz`, no-JS. Writes `docs/evidence/gjh-v9-browser.json` (side effect). |
| `tests/browser_gjh_v10.py` | gjh v10 | SwiftShader Chrome: draw calls < 150, DPR cap, keyboard travel, four product raycasts, modal focus and Escape, damped drag, idle rendering stops, reduced motion, context loss, forced WebGL denial, local-only requests, no-JS and file-origin list, 44 px targets. |
| `demos/food-beverage/yeos/landing_checks.py` | yeos v1-v15 | 390x844, reduced motion, SW blocked, optional axe (`--axe-script`), one journey per edition (section 5). |
| `tests/browser_yeos_drinks.py` | yeos v1 | Family filters map to product URLs, pair comparison and disabled duplicate options, featured slider, no-script details. `--capture` refreshes previews. |
| `tests/browser_yeos_editions.py` | yeos v2-v15 | Per-edition journey (pack matrix for v5, notebook persistence for v12, panel selectors v8/v14, container filter v11, calculator v10, anchors v9/v13/v15). `--capture` refreshes previews. |
| `demos/heritage/thow-kwang/browser_checks.py` | thow-kwang v1-v15 | Four widths (320/390/768/1440): no overflow, images decoded, no broken `#` fragments, HTTP status < 400, per-version keyboard journey at 390, no-script reading context with at least 2 external links. `--capture` refreshes screenshots and thumbnails. |
| `tests/browser_company_pwas.py`, `browser_pwa_demo_boundary.py` | catalog-wide manifests, four offline samples | See section 1. |
| `tests/test_gallery.py` | catalog / generator unit tests | Company membership, v8 metadata contract, collection links, escaping, deterministic builds. Not demo logic. |
| `tests/browser_style_atlas.py` | gjh v20-v22 (full-page study set) | Atlas capture; **NOT VERIFIED** beyond the `full_page_studies` set reference. |

## 3. GJH family (`demos/corporate/gjh`)

### 3.1 Shared files

| File | Role | Loaded by |
| --- | --- | --- |
| `shared/navigation.js` | Parser-blocking IIFE: adds `html.js`, wires `.menu-toggle` / `#navigation` (toggle `aria-expanded`, close on link click, focus-out, outside click, Escape returns focus, closes when the 900 px media query flips). | v1, v5, v6, v7, v8, v16, v19 |
| `shared/scene-loading.js` | Sets `data-scene-state=loading`, switches to `fallback` after 20 s or if `script.js` errors, writing text into `#scene-status`. | v10 only |
| `shared/interaction.css` | Per-design rules keyed on `html[data-gjh-design]` (focus ring, 44 px targets, dialog, v8/v9/v10/v11 header sizes, v10 scene loading frame). | v1, v5-v10 (and v11, out of scope) |
| `shared/landing.css` | First-screen "entry" layouts `.entry-N` (N = 1, 5, 6, 7, 12-18) and v8 epoch bands. | v1, v5-v10, v12-v19 |
| `../../../assets/gjh-themes.css` | Generated theme tokens (via `scripts/build_design_system.py` / `design-system/themes.json`). | v1, v5-v10, v12-v19 (+ v11) |
| `<vN>/assets/theme.css` | Generated per-version theme ("Generated by scripts/build_design_system.py"). Do not edit. | v20-v23 only |
| `../../../assets/tokens.css` | Gallery tokens. | v1, v5-v10, v19-v23 (not v12-v15, v17, v18, v16 per HTML) |
| `landing_checks.py` | See section 2. | n/a |
| `research/company-profile.md`, `research/source-assets/{README.md,manifest.json}` | Source research and official-asset manifest. Not loaded at runtime. Per-version `assets/sources.json` records provenance and hashes. | n/a |

Every GJH version loads `<vN>/script.js`, `../../../../src/demo-pwa.js`, local Manrope declared in `style.css` (v1, v5-v10, v12-v16, v18) or no `@font-face` in `style.css` (v17, v19-v23). Brand links go out to `gjh.com.sg`, `gjhglobal.com` or `gjheshop.com`; no demo fetches them at runtime.

### 3.2 Single-edition rows v1, v5-v10

| Ver / id / title | Direction (styles) | Entry files | JS behavior | Local data / assets | Shared used | Offline | Checks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **v1** `gjh-v1` Corporate Clarity (corporate) | Division-index hero (`entry-1`) and a partnership journey. | `index.html` (60 lines), `style.css`, `README.md` | `script.js` is a comment only. All behavior is `shared/navigation.js` (mobile menu). | 10 assets: family-lifestyle photo, GJH logo, three brand covers, Manrope, `sources.json`. | navigation.js, interaction.css, landing.css, gjh-themes.css, tokens.css | Generated sw + manifest | `landing_checks.py` (`.division-index a` -> `#business-food`), `browser_gjh_demos.py`, v8 smoke. |
| **v5** `gjh-v5` Heritage Editorial (heritage, editorial) | Journal style, hero covers (`entry-5`). | `index.html`, `style.css` | Comment-only script; navigation.js menu. | History composite, sunday-lunch art, three brand covers, logos. | same as v1 | same | `landing_checks.py` (hero cover link -> `gjh.com.sg/newmoon/`, route-fulfilled, not requested live), `browser_gjh_demos.py`. |
| **v6** `gjh-v6` Portfolio Modern (corporate, minimal) | Compares four New Moon origins; 454 g Mexico beside 425 g NZ (`entry-6`). | `index.html`, `style.css` | Comment-only script; navigation.js menu. | 17 assets: four New Moon tin fronts (NZ, AU, MX, SA), logos, covers. | same | same; one of four offline-tested samples | `landing_checks.py` (`.origin-plate` -> `#new-moon`), `browser_gjh_demos.py`, `browser_company_pwas.py`. |
| **v7** `gjh-v7` Signature Dark (heritage, editorial) | Dark editorial, partner path (`entry-7`). | `index.html`, `style.css` | Comment-only script; navigation.js menu. | 19 assets: partner gathering/service-desk/storefront art, concept lounge, covers, logos, history composite. | same | same | `landing_checks.py` (`.partner-path a` -> `#business`), `browser_gjh_demos.py`. |
| **v8** `gjh-v8` Generations of Goodness (heritage, editorial) | Green and gold, 2.5D scroll narrative. No WebGL, no render loop. | `index.html` (85), `style.css`, `script.js` (module, 102 lines), `README.md`, `logic.md` | `eras` table drives `#era-title/#era-copy/#era-image` via `[data-era]` buttons (1940s, 1959, 1981, 2004); `[data-milestone]` timeline with scroll-driven auto selection until a manual click (`#chapter-YYYY` hashes); `[data-market]` toggles `[data-connection]` map paths and `#market-status`; one rAF per scroll burst sets `--hero-y/--hero-scale/--depth-y/--journey-progress`; pointer tilt on `.brand-object` (fine pointer, no reduced motion); IntersectionObserver reveal using WAAPI. | 18 assets: family dining art, history composite, three covers/logos, Borsch Med quality, Sony brand tile, NZ 425 g front. | navigation.js, interaction.css (header rule), landing.css (epoch bands) | Generated sw | `landing_checks.py` (click `#chapter-2004`, state survives reload), `browser_gjh_v8.py`. |
| **v9** `gjh-v9` Virtual Stores (immersive, heritage) | CSS/HTML evening street, layered 2.5D, camera dolly (no WebGL). | `index.html` (82), `style.css` (1349 lines), `script.js` (IIFE), `README.md`, `logic.md` | State machine over rooms `lobby/newmoon/mili/gogo`. `navigate()` measures the facade (`facadePose`) and animates `.street-camera` with an 850 ms dolly at scale 2.6, with cancel/version guard; arrow keys move focus among doors or map buttons; Escape returns to lobby; fine-pointer look (max about 1.3 deg); product hotspot moves the original `<details>` into a native `<dialog>` and back on close; list/visual toggle (`data-view`), hash deep links to products reveal the list; reduced motion resolves travel instantly. | 25 assets: four New Moon SKU front/back/nutrition JPGs (`sku-nz/au/sa/mx`), covers, logos, storefront concept art. | none of the shared JS (page has no navigation.js); interaction.css, landing.css | Generated sw | `landing_checks.py` (`.entry-action` -> `data-current-room=mili`), `tests/browser_gjh_v9.py`. |
| **v10** `gjh-v10` Virtual Stores 3D (immersive, heritage) | Moonlit arcade, real WebGL 3D with HTML list fallback. | `index.html` (129), `style.css`, `script.js` (module, 712 lines), `README.md` | Dynamic `import('./vendor/three.module.min.js')` after a WebGL2 probe; one arcade, rooms `lobby/newmoon/mili/gogo`, `travel()` dolly with FOV pull; drag look with damping, parallax, Prev/Next, WASD and arrows, Escape to lobby; `THREE.Raycaster` product selection plus keyboard buttons opening `#product-dialog`; instanced architecture, desktop-only 1024 px PCF shadow map (needs width >= 1000, >= 4 cores, >= 4 GB), render stops when idle; exposes `window.__sceneReady/__sceneFailed/__sceneStats`; falls back to the list on WebGL failure/context loss. `assets/product-models.js` builds the can models. | `vendor/three.module.min.js` (Three.js 0.170.0, README), `assets/product-models.js`, four New Moon fronts, moonlit-arcade art, covers, logos. | scene-loading.js, interaction.css, landing.css | Generated sw; 3D needs HTTP serving (module imports) per README | `landing_checks.py` (waits `body[data-view=3d]` up to 90 s, `[data-arcade-room=newmoon]`), `tests/browser_gjh_v10.py`. |

### 3.3 Editions v12-v23 (one row per version)

| Ver / id / title | Direction (styles) | JS lines and behavior | Key local assets | Shared / generated used | Check coverage |
| --- | --- | --- | --- | --- | --- |
| **v12** `gjh-v12` The Shared Table (editorial, heritage) | Warm ivory and terracotta, `entry-12` table index. | 1 line, comment only (no JS). | family dining and watercolour art, history composite, NZ 425 g front, MILI cover (12 assets) | gjh-themes.css, landing.css | `landing_checks.py` (`.table-index a` -> `#at-table-newmoon`), `browser_premium_landings.py` |
| **v13** `gjh-v13` The Connection (corporate, editorial) | Electronics desk and business index (`entry-13` sector desk). | 1 line, comment only. | connected-lifestyle art, history composite, covers | same | `landing_checks.py` (`.sector-desk a` -> `gjh.com.sg/newmoon/`), `browser_premium_landings.py` (hero action -> `gjh.com.sg/sony/`, primary -> `gjhglobal.com/contact-us/`) |
| **v14** `gjh-v14` The Goodness Table (heritage, editorial) | Provision counter illustration vs archive composite. | 14 lines: sets radio `#archive-view` on `#archive-view` hash or entry-action click. The switch itself is CSS radios `#counter-view`/`#archive-view`. | provision-counter 640/1120, history composite, covers | same | `landing_checks.py` (ArrowRight/Left on radios), `browser_premium_landings.py` |
| **v15** `gjh-v15` Everyday, In Colour (corporate, editorial) | Field notes per brand (`.brand-row`, ticker). | 1 line, comment only; range notes are native `<details>` (3). | portfolio-study 640/1120, New Moon cover 438, covers | same | `landing_checks.py` (MILI range note opens), `browser_premium_landings.py` (ticker links) |
| **v16** `gjh-v16` The Everyday Collection (editorial, corporate) | Specimen: New Moon NZ 425 g tin. | 25 lines: replaces link `.pack-side` with a `<button>` that swaps `.hero-art img` between front (`srcset` kept) and `new-moon-nz-425g-back.jpg`, updating alt and label. | NZ front/back, front-480, Borsch Med quality, covers | navigation.js, gjh-themes.css, landing.css | `landing_checks.py` (flip, decode, external link to the eShop product), `browser_premium_landings.py` (Enter and Space) |
| **v17** `gjh-v17` Pantry Notes (editorial) | Occasion cards on an illustrated food journal. | 33 lines: stores the last opened occasion link in `sessionStorage` key `gjh-pantry-notes-last-occasion` and adds a "Last opened" marker on `pageshow`; wrapped in try/catch. | weeknight-supper, sunday-lunch, afternoon-break, watercolour, shared-table | gjh-themes.css, landing.css (no tokens.css) | `landing_checks.py` (`.menu-bookmarks a` -> `#supper`), `browser_premium_landings.py` (Back shows marker) |
| **v18** `gjh-v18` Everyday Frequencies (immersive, editorial) | Four electronics "channels": listen, watch, play, connect. | 23 lines: shows one `.scene` at a time via `hidden`, sets `aria-current` on `.channels a`/`.cover-presets a`, follows hash/hashchange. Landscape and portrait images per scene. | listen/watch/play/connect (+ portrait), record-grooves | gjh-themes.css, landing.css | `landing_checks.py` (`#play`, one visible scene), `browser_premium_landings.py` (four scenes, history), `browser_company_pwas.py` (offline sample + release update) |
| **v19** `gjh-v19` The Partner Desk (corporate, editorial) | Retail-buyer enquiry brief builder. | 36 lines: on submit composes brief text from category radio, optional `#retail-setting` and topic into `#brief-text`, focuses it; any change hides the stale result; `#select-brief` selects text; swaps `#brief-fallback` for `#brief-app` when JS runs. | partner-review art, GJH logo | navigation.js, tokens.css, gjh-themes.css, landing.css | `landing_checks.py` (online retail text, clears on reset), `browser_premium_landings.py` (electronics + availability, official contact link) |
| **v20** `gjh-v20` Brand Portfolio (corporate) | Three categories (food 3, lifestyle 1, healthcare 1 brand cards) plus featured product and enquiry. | 80 lines: category filter `#brand-filters` (`aria-pressed`, `hidden`); `[data-shortcut]` reveals hidden target; `[data-enquire]` copies brand/product into the enquiry form; Copy button uses `navigator.clipboard`, falls back to a readonly `#enquiry-draft` with auto-select. | S01 New Moon, S13 Sony, blue-studio, mall concept, NZ 425 g front | tokens.css, own `assets/theme.css`, interaction.css; links to `../v11/` | `landing_checks.py` (journey, enquiry, clipboard denial, no-JS, v20+v21 iframe) |
| **v21** `gjh-v21` Product Exhibition (corporate) | Same brief as v20, five brands (New Moon, MILI, GOGO, Borsch Med, Sony) and an exhibition shell. | 136 lines: as v20 plus `#brand-status` live count, history `pushState` fragment following with heading focus (`followFragment`), `copyAttempt` guard against stale clipboard results, mobile `<details id=mobile-menu>` with Escape focus return, reveal-on-scroll via IntersectionObserver unless reduced motion. | covers, logos, paper-stage, mall atrium, history composite | same as v20 | `landing_checks.py` (44 px targets at 390, menu Escape, no-JS menu, `compare/` iframe clipboard fallback) |
| **v22** `gjh-v22` Brand Chapters (corporate) | Five full-screen brand chapters; sheet-based enquiry. | 185 lines: native `<dialog id=enquiry-sheet>` opened via `showModal()` from `[data-enquire]` (falls back to the link if unsupported); radio brand, product autofill for New Moon, live `#enquiry-preview`, clipboard with readonly fallback; `visualViewport` resize fits the sheet above the keyboard; focus returns to the opener (or section heading if hidden); `ResizeObserver` toggles `.can-pin` so chapters stick only if they fit the viewport; IntersectionObserver entrance class unless reduced motion; hash links use `history.pushState` + `focusFragment`. | per-brand hero/medium/wide/story WebP, rail logos (Casio, Gigaset, GP, LG), NZ 425 g front, `sources.json` | tokens.css, own `assets/theme.css`, interaction.css; links to `../v11/` | `landing_checks.py` (chapters journey for all five brands, no-JS popup to `gjhglobal.com/contact-us/`, sticky vs reduced motion, iframe) |
| **v23** `gjh-v23` New Moon Product Wall (corporate, editorial) | Single-brand wall of four origin tins (MX, SA, NZ, AU) on two rotated shelves, then the brand chapters. | 190 lines: identical to v22 except one extra IntersectionObserver on `.hero` that toggles `body.past-cover` (`diff` confirms). The wall itself is pure CSS: `.wall` > `.shelf` > `<i class="tin mx|sa|nz|au">`, using the four official front JPGs as `background-image` (`style.css` lines 213-244); the persistent action dock is static until `past-cover` is set. | `new-moon-{au,mx,nz,sa}-425g/454g-front.jpg`, NZ webp, story art, `sources.json` | tokens.css, own `assets/theme.css`, interaction.css; links to `../v11/` | `landing_checks.py` (`product_wall_journey`: one hero link, two shelves, dock hidden until past cover, sheet fields, focus return; extra 393x852 viewport) |

### 3.4 Behavior common to v20-v23 (verified by reading and by `diff v22/script.js v23/script.js`)

- Enquiry model: Brand / Product / Requirements built into plain text and copied; if `navigator.clipboard.writeText` rejects, a readonly textarea is filled and selected. The check script forces that rejection.
- v22/v23 are byte-identical in scripts except the `past-cover` observer. v20 to v21 to v22 progressively replace "form on page" with "dialog sheet".
- All four are enhanced from baseline HTML that works without JS (v20, v21, v22 are checked with JS disabled; v23 no-JS **NOT VERIFIED**).
- None loads `shared/navigation.js`; v21-v23 use a native `<details>` mobile menu.
- All four link to `../v11/` (hyperlink only). `landing_checks.py` asserts no resource request into `/v11/`.

## 4. Yeo Hiap Seng family (`demos/food-beverage/yeos`)

### 4.1 Common behavior (from `shared/` and per-version diff)

| Item | Fact |
| --- | --- |
| `shared/editions.css` | Used by v2-v15 (not v1). Declares Manrope/Instrument Serif fonts from `../v1/assets/`, base layout, skip link, `.wrap`, `.bar`, focus ring, `[hidden]{display:none!important}`. |
| `shared/panel-selector.js` | Used by v8 and v14 only. Reveals `[data-controls]`, toggles `aria-pressed` and `[data-panel]` visibility from `[data-choice]` buttons. |
| `v1` as asset library | v2-v15 reference `../v1/assets/*.webp` (six drink photos, hero, fonts) and `../v1/index.html` (brand link). `build_demo_pwas.py` adds all of `yeos/v1/assets` to every yeos worker. |
| Progressive enhancement | Content ships in HTML (native `<details>`, anchors, tables). JS un-hides controls (`hidden` -> shown) so no-JS readers still see all drinks. Yeos v1 and v12 include `<noscript>` text. |
| Common head | All 15 load `tokens.css`, `src/demo-pwa.js`, a `style.css` of 20-191 lines. Brand outbound links go to `yeos.com.sg`. |
| Fonts | Local only. OFL licence texts live in `v1/assets`. |
| Checks | `yeos/landing_checks.py` (all 15, mobile), `tests/browser_yeos_drinks.py` (v1), `tests/browser_yeos_editions.py` (v2-v15). Offline sample: v1 only. |

### 4.2 Version table

| Ver / id / title | Styles | Local script | Behavior | Own assets | Cross-edition links | Landing check (`landing_checks.py`) |
| --- | --- | --- | --- | --- | --- | --- |
| v1 `yeos-v1` The Drinks Index | editorial | `script.js` 102 lines | Family filter (`aria-pressed`, live count `#filter-status`); featured-drink slider (3 slides, prev/next); two-drink pair comparison table built from `data-format` spans, selects mutually disabled, permalink `?left=&right=#compare`; `hashchange` reveals filtered-out card. | 16 assets incl. fonts, six drinks, hero, pack-pair | owner of shared assets | pair permalink restores both selects and the "Can Not listed 300 mL" row |
| v2 Tea House | editorial | none | Two native `<details>` tea profiles. | 3 assets | `../v1` | `tea-diptych` anchor scrolls to `#chrysanthemum` |
| v3 The Soy Study | minimal | none | Soy ingredients and pack sizes (2 details). | thumbnail only | `../v1` | link prefills v1 pair picker (soy + black-soy) |
| v4 Kopitiam Board | heritage | `script.js` 11 lines | On `<details>` toggle, swaps `.board-print` photo (`data-image`) and caption. | `chalk-flower.webp` | `../v1` | last entry changes photo to lychee |
| v5 Pack Finder | corporate | `script.js` 22 lines | `#pack` select filters table columns, computes "n / 6" count and bar width. | none | `../v1` | "1 L carton" gives 2 / 6 |
| v6 Botanical Notes | editorial | `script.js` 10 lines | Opens the `details.spec` named by hash or by key links. | flower, leaf | `../v1` | `#spec-black-soy` in view, survives reload |
| v7 Lychee Season | immersive | none | Three details plus four `<meter>` elements (250, 300, 380, 1500 mL, max 1500). | fruit print, 4 pack images | `../v1` | meter values asserted |
| v8 Rose Milk Studio | editorial | `shared/panel-selector.js` | Choose rose / milk / bandung to swap caption and panel. | milk, rose | `../v1` | each choice shows one caption |
| v9 The Nanyang Archive | heritage | none | Anchor-driven timeline (`#era-1`, `#soy`). | river-and-streets | `../v1` | `.archive-product` scrolls to `#soy` |
| v10 Picnic Counter | minimal | `script.js` 17 lines | Form: guests x serving, pack size; `Math.ceil`, spare mL; en-SG formatting. | none | `../v1`, `../v5` | 7 guests, 300 mL gives 6 cans, "50 mL spare" |
| v11 Cooler Shelf | immersive | `script.js` 17 lines | Container filter (all/can/bottle/carton) hides tickets and items, live count. | cabinet | `../v1` | Cans: 5 tickets of "300 mL can"; All: 21 |
| v12 Tasting Notebook | editorial | `script.js` 42 lines | Per-drink note in `localStorage` key prefix `yeos-tasting-notebook:`; unsaved drafts held in memory; `?drink=` preselects; handles storage-unavailable errors. | none | `../v1` (portrait images) | choosing lychee updates title and portrait |
| v13 The Drink Dial | immersive | `script.js` 17 lines | Hover/focus on dial links previews drink image and name; default = hash or position 6. | none | `../v1` | focus "Rose milk" -> bandung image |
| v14 Tasting Flight | editorial | `shared/panel-selector.js` | Three flights (garden/beans/fruit); each pour links to v12 with `?drink=`. | 5 flight images | `../v1`, `../v12` | beans flight "Write a tasting note" opens v12 with black-soy |
| v15 Beverage Atlas | minimal | `script.js` 31 lines | Text search across entries, letter groups and sidebar hide, count and empty state, Clear returns focus. | none | `../v1` | "rose essence" shows only Bandung; "absent" shows the empty message |

## 5. Thow Kwang Pottery Jungle family (`demos/heritage/thow-kwang`)

Operator-facing visitor guides; `README.md` documents sources and states they are not booking pages. A Pottery Jungle landing improvements note lives at `docs/thow-kwang-landing-improvements.md` (not re-read here).

### 5.1 Common behavior (shared files)

| Item | Fact |
| --- | --- |
| `shared/guide.css` (531 lines), `shared/folio.css` (119) | Loaded by all 15 versions together with `tokens.css` and the version `style.css`. `guide.css` declares the fonts from `../v1/assets/`. |
| `shared/guide.js` | Loaded by all 15, defines `window.thowKwangGuide` with `diagram()` (kiln pins and details sync), `filter()` (search over `[data-term]`, live status), `checklist()` (progress counter). Each version's `script.js` calls only what it needs. |
| Version scripts | 8 of 15 are comment-only ("native links and disclosures"): v2, v3, v5, v6, v7, v10, v12, v14. Real scripts: v1 `diagram()`, v4 `checklist()`, v8 clue-card cycler, v9 checklist plus party-size advice, v11 `filter()` plus index click clears filter and opens term, v13 plain-text note download, v15 intent filter. |
| CSS-only interaction | v7 `#glaze-close` checkbox (`:checked` loupe zoom), v12 `#show-contours` checkbox (shows contours and labels). |
| Asset sharing | `v1/assets` is the font and sketch-card library (v10 `paper.webp`, v13 `sketch-card.svg`, all fonts). Worker includes all of `thow-kwang/v1/assets`. |
| Cross links | v14 -> `../v1/index.html#structure` and `../v12/index.html#catalogue`. |
| Checks | `demos/heritage/thow-kwang/browser_checks.py` (all 15, four widths and no-script). Offline sample: v1 only. |

### 5.2 Version table

| Ver / id / title | Styles | Script | Behavior and primary task | Own assets | Key check assertion (`browser_checks.py`) |
| --- | --- | --- | --- | --- | --- |
| v1 `thow-kwang-v1` Inside the Dragon Kiln | heritage | `diagram()` | Kiln cutaway SVG, pins `chamber/chimney/firebox` open the matching `<details>` and set caption and `aria-current`; four official outbound links. | 16 (kiln-section.svg, sketch-card.svg, fonts, photos) | Each pin Enter opens panel, `data-selected` matches, 4 `https:` links in `#visit` |
| v2 Plan Your Visit | minimal | none | Route comparison in 3 details. | 4 | Second summary mentions "15 participants" |
| v3 The Clay Studio | editorial | none | Wheel vs hand-building cards. | 4 | `#hand-building` link points at the workshop listing |
| v4 Teachers' Field Notes | minimal | `checklist()` | Class checklist, answer key detail. | 2 | "1 of N marked"; answer key opens |
| v5 At the Potter's Wheel | immersive | none | Four-step gesture sequence (4 details). | 5 | Third step text "raises the wall" |
| v6 Wood & Ember | immersive | none | Essay with fired-sample link to `#surface`. | 3 | Heading "Evidence" |
| v7 Glaze Library | editorial | none | Loupe checkbox. | 5 | Transform toggles on Space |
| v8 A Family Visit | immersive | clue cycler | Cycles three prompts into `[data-clue-card]`, `aria-live`. | 3 | Next-clue returns to first after three |
| v9 In Good Company | corporate | checklist + party check | `valueAsNumber` messages: below tour minimum, meets minimum, non-integer error. | 2 | 14, 15, 0, empty cases |
| v10 The Heritage Journal | heritage | none | Archive years with outbound references. | 2 | `#archive-2020` link contains `nhb.gov.sg` |
| v11 Kiln Lexicon | minimal | `filter()` | 8 terms, live count, index click clears filter and opens term. | 2 | 1 / 0 / 8 results; "glaze" opens |
| v12 The Vessel Cabinet | editorial | none | Three vessels, contours toggle. | 4 | 3 contours labelled Wide rim, Curved shoulder, Flared side |
| v13 Field Sketchbook | minimal | note save | Downloads `pottery-observation-sheet.svg` (static link) and builds `pottery-field-note.txt` Blob. | 5 | Both download names; save disabled when empty |
| v14 A Slow Afternoon | immersive | none | Three-stop itinerary with strip links. | 5 | `#stop-kiln` mini link to v1 `#structure` |
| v15 The Visitor Desk | corporate | intent filter | Filters six official destinations by make/read/visit/all, live count. | 2 | 6 for all, 2 for each intent |

## 6. Known gaps and findings

| Finding | Evidence |
| --- | --- |
| Many "editions" have no behavior of their own | GJH v1, v5, v6, v7, v12, v13, v15 have comment-only `script.js`; thow-kwang has 8 comment-only scripts; yeos v2, v3, v7, v9 have no script file. Behavior is HTML links, details and CSS. |
| `v23` is a delta of `v22` | Script diff is a single observer; the product wall is CSS-only. |
| Test scripts that write repo files | `browser_gjh_v9.py` writes `docs/evidence/gjh-v9-browser.json`; `landing_checks.py --capture`, `browser_checks.py --capture`, `browser_yeos_*.py --capture`, `browser_gjh_v8.py` rewrite screenshots and thumbnails. |
| Offline proof is sample-based | Only gjh v6/v18, yeos v1, thow-kwang v1 are exercised offline; v10's module-based 3D offline behavior is **NOT VERIFIED**. |
| Docs drift | `docs/company-demo-pwas.md` counts are stale (see section 1). |
| Not read | `style.css` internals beyond cited lines, `sources.json` content beyond samples, `tests/browser_style_atlas.py` demo coverage, mobile focus details of v1-v7 CSS: **NOT VERIFIED**. |
