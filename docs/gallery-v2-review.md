# Gallery V2 — Implementation and Verification

## Scope and decisions

The original entry page opened individual designs directly. V2 implements company-first navigation: directory → company collection → design detail/live demo. Existing demo URLs and demo implementations remain unchanged.

Company/category/style records and each demo's metadata own catalog information. A dependency-free Python generator renders static directory/company pages and a normalized design index. The release workflow uses the same generator, replacing a manually maintained list of published versions. JavaScript enhances discovery and implements detail/compare views; company browsing and direct demo links still work without it.

Compare accepts two distinct designs from one company through query parameters. It validates these against the catalog before creating frames. Previews render at 1440, 768 or 390 CSS pixels and scale to fit the panel; changing the device changes the iframe viewport. Sync scroll is optional and uses relative page position because section heights differ. Official-site links in embedded demos open a separate tab. Screenshots are an alternate mode, and fullscreen depends on browser support.

## Evidence

- Seven standard-library tests cover the current version collection, company-first entry links, deterministic generation, safe resource paths, missing resources, duplicate IDs and HTML escaping.
- Real Chrome/Playwright browser checks run against the built artifact under `/Webpage-Design-Gallery/`, covering 1440, 768, 390 and 375px.
- Browser scenarios exercise company search, empty-state recovery, categories, design styles, comparison selection, disabled third selection, device viewport changes, independent and synchronized scrolling, screenshots, design details and opening the actual V6 demo.
- Invalid/missing compare selections and invalid design URLs have recovery links. Disabling JavaScript preserves company-to-demo browsing.
- A temporary synthetic fixture contains 120 companies and 1,200 design records to check 12-item pagination, category filtering and search. Synthetic records are never published. This is a functional capacity check, not a claim of 120 real companies or field performance.
- Captured screenshots are in `docs/screenshots/gallery-v2/`. Research assets are excluded from the published artifact.

## Limits

The real catalog contains one company and four concepts. No user conversion study, production Core Web Vitals, screen-reader audit or complete WCAG conformance review has been performed. Browser checks use desktop Chrome with emulated viewport sizes; real iOS/Safari and Android testing remain unverified. Very large catalogs still need measured performance work; pagination currently limits visible cards but the static directory includes all catalog entries in its DOM.

The first browser run passed but the temporary HTTP server logged canceled image-transfer connections when navigating away. The handler now suppresses only those expected transport disconnects; assertion failures and browser errors still fail the test.
