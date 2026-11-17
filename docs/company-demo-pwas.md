# Company demo PWAs

Release 1.2.0 contains 16 Goh Joo Hin designs, 15 Yeo Hiap Seng designs and 15 Thow Kwang Pottery Jungle designs. The company collection pages belong to the gallery application. Each demo has its own install name, stable identity, start URL, scope, manifest and service worker under its version directory. Open a demo directly to prepare it for offline use. Gallery comparison frames leave installation to the standalone page.

## Offline behavior

| Application | After the first successful online visit | Requires a connection |
| --- | --- | --- |
| Gallery and three company collections | Directory, filters, translations, design metadata and thumbnails | Full gallery screenshots and first-time demo visits |
| 45 standalone demos | The selected edition, its styles, scripts, images and local fonts. Yeo’s pack comparison and Thow Kwang’s kiln diagram remain interactive. | Other editions until first saved, official product links, directions, workshop schedules and booking |
| GJH V11 virtual mall | Saved lightweight reconnect page managed by the mall’s existing worker | 3D scene, product catalogue and shop links. [Mall profile](gjh-v11-pwa.md) |

In a standalone demo, open **Install / offline** at the end of the page to see its saved release, request installation or check for updates. Supported browsers supply their installation prompt. On iOS the interface gives the Safari Share menu instructions. The gallery and V11 retain their existing settings controls. Browser storage quotas and eviction can require an online visit to rebuild local data.

## Publishing and updates

The generator reads demo metadata, the authored theme colour and the publication allowlist. It emits each manifest and worker beside the demo entry point. Common UI lives in `src/demo-pwa.js` and `assets/demo-pwa.css`. Version-specific resources, selected shared company assets and gallery-owned icons have recorded SHA-256 digests. The gallery and demo caches are independent. The V11 generator continues to publish its specialized worker.

A candidate worker fetches the release identity with a versioned URL, verifies each response and stores files in a scope-and-build-specific cache. A failed network request, identity mismatch, quota error or hash mismatch discards the candidate. The active worker continues serving the last verified edition. A waiting release offers **Update and reload**. Other open tabs retain their current document until their reader reloads. No form submissions or transactions are queued. Local tasting notes remain under the notebook’s own storage key.

To publish, run the gallery checks and rebuild from sources. The Pages workflow publishes the allowlisted artifact under the repository URL prefix. To roll back, revert the affected change in Git, regenerate, run the checks and push the resulting commit to main. Open the demo and check for updates once Pages has published the rollback.

## Verification

- `python scripts/build_gallery.py --check` verifies generated pages, release identity, manifests and workers.
- `python tests/browser_company_pwas.py` checks every catalogue identity and icon, then exercises keyboard access, scoped registration and offline reloads from each company in Chrome. The gallery and mall have separate suites.
- `python tests/browser_yeos_drinks.py` exercises two-drink selection, container volumes, unavailable formats, product disclosures and filtering. The [pottery visitor study](../demos/heritage/thow-kwang/README.md) documents equivalent visitor tasks and its browser check.
- The checks use the KB content and immersive PWA profiles as acceptance criteria. Physical iOS/Android installation, VoiceOver/TalkBack, platform-specific browser chrome and field Core Web Vitals require device or field evidence.

### Release verification on 17 November 2026

| Check | Observed result |
| --- | --- |
| Scoped offline startup in Chrome under a Pages-style subpath | After clearing the HTTP cache, all 46 entry points returned through their own workers across two candidate builds. 45 rendered their full content. V11 displayed its reconnect page. The sweep decoded 184 local image instances and parsed 180 stylesheets. |
| Icon and reconnect regression, build `00feade74a2a272c` | All 46 entries had a valid explicit tab icon. Fresh offline visits to GJH V11, Thow Kwang V14 and Yeo’s V2 completed without a failed network request or a page exception. |
| Update integrity | A mismatched asset rejected the candidate. The old page reloaded offline, a repaired update stayed waiting and the keyboard action opened the verified replacement. |
| Dragon kiln guide | Mobile and desktop Chrome and WebKit loaded the schematic and its local resources after disconnection. Keyboard selection of the firebox, firing chamber and chimney worked. |
| Layout and fallback | Each new pottery and drinks design was checked at 320, 390, 768 and 1440 pixels and with JavaScript disabled. Each catalogue entry includes captured desktop, tablet and mobile previews. |
| Preference payload | The two preference scripts and three published locale files total 64,056 uncompressed bytes against the 80,000-byte budget. |
