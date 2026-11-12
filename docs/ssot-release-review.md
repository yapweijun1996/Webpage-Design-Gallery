# SSOT and Gallery 1.1 — Release Review

## Scope and evidence

This change implements the repository's [design system](../ds.md), rather than a mockup. It covers both directory routes, the company collection, design details, comparison, offline utilities, and all eight catalogued GJH versions: V1, V5, V6, V7, V8, V9, V10 and V11. Existing routes, official assets, content, comparison validation and independent creative directions are preserved.

The application release is 1.1.0; the design-system contract is 1.0.0. These version numbers describe different artifacts. The application build digest includes generated design resources and shared demo modules.

## Implemented improvements

- Compact company-first home layout, aligned content rails, a useful single-company card composition, and a mobile entry that exposes the company and collection action earlier.
- Shared typography, colors, spacing, shapes, elevation, responsive values and icon registry. Canonical JSON generates CSS and the SVG sprite; pages consume those resources.
- Eight separately scoped GJH theme maps preserve each version's palette. Shared menu behavior and interaction CSS remove repeated ownership without flattening the designs.
- Company and style filter state survives URL navigation/reload. Comparison supports contextual selection, per-item removal and hidden-selected-item recovery. Preview defaults adapt to the device.
- Browser zoom is enabled. Detail images are keyboard-scrollable. Demo controls use shared target sizing, safe-area and reduced-motion rules; immersive shortcuts no longer intercept ordinary controls.
- The SSOT gate rejects stale artifacts, unknown references/icons/breakpoints, conflicting component ownership and new literal-style debt. Its active baseline is zero; 1,211 is the historical inventory, not an allowance to reintroduce removed declarations.

See the [GJH issue/fix register](gjh-ssot-review.md) for version-specific details. Artwork dimensions and unique scene geometry remain deliberately local; zero measured style debt does not mean every CSS number is a token or that every visual property is covered by the checker.

## Knowledge applied

Read-only KB-MCP guidance used during implementation: `kb-mcp:coding-skills`, `kb-mcp:ui-skills`, `agent:delegate-and-follow-up`, `ui:ux-quality-auditor`, `ui:ssot-component-library`, `ui:design-tokens-theming`, `coding:safe-impact-regression-gate`, `pwa:product-standard`, `ui:taste-gate-before-merge`, and `engineering:scmc-review`. Project-specific source and this task's instructions take precedence over examples from unrelated projects. No KB production records or Skill Registry entries were modified.

## Review perspectives

These are analytical perspectives applied by the implementation team and independent manager review, not thirteen independent human or model reviewers.

| Perspective | Review and resulting decision |
| --- | --- |
| Visual hierarchy | Company choice takes precedence over instructional chrome. |
| Layout and density | One normal content rail, a documented wide comparison workspace, compact narrow-screen layouts. |
| Typography | Semantic sizes and readable operational text; distinctive demo display faces remain local. |
| Color and branding | Gallery semantics and eight explicit theme scopes; original brand assets preserved. |
| Component consistency | Tokens and sprite generated once; scoped component owners checked automatically. |
| Discovery | Company-first navigation, real inventory counts, URL-backed filters and synthetic capacity test. |
| Interaction | Comparison removal, adaptive preview defaults, immersive keyboard boundaries. |
| Accessibility | Zoom, focus, keyboard scrolling, native control semantics, automated axe checks. |
| Responsive behavior | Desktop/tablet/mobile captures, narrow 320px journeys and overflow checks. |
| Reliability | Empty/error states, invalid URLs, no-JavaScript and graphics fallbacks. |
| PWA lifecycle | Explicit update consent, integrity, offline browsing and failure recovery preserved. |
| Performance | Local LCP/CLS observations and scene budgets; field CWV is a separate measurement. |
| Maintainability and business fidelity | Central registries, zero-debt regression gate, preserved disclosures and external destinations. |

## Verification evidence

- [Full-route SSOT browser results](evidence/ssot-browser.json): generated artifact, 1440/768/390 CSS px, reviewed local axe-core bundle, overflow, page errors and local LCP/CLS observations.
- [PWA results](evidence/pwa-browser.json): actual Chrome service-worker lifecycle, offline shell, explicit activation, multi-tab consent, integrity failure and timeout recovery.
- [V9 interaction results](evidence/gjh-v9-browser.json): store navigation, product dialogs, focus cycles, view state and no-JavaScript fallback.
- Existing Gallery and per-version browser suites cover detailed navigation, filters, screenshots, comparison, actual scene movement, collision and fallback behavior. Final executed outcomes are recorded below after acceptance.

The current Chrome/Playwright network-emulation API can block requests while leaving `navigator.onLine` true. The PWA fixture explicitly models both transport blocking and the OS connectivity signal, asserts both, and leaves production connectivity logic intact. This is not a physical-device connectivity test.

### Executed release checks

| Check | Outcome |
| --- | --- |
| Gallery generation / deterministic output | PASS |
| SSOT and Gallery unit contracts | PASS, 31 tests including deliberate failure fixtures |
| SSOT literal-style gate | PASS, zero remaining measured declarations; zero allowed debt |
| Gallery browser journeys | PASS, four viewport widths, filtering/URL history, selection removal/focus, detail scrolling, comparison, invalid input and no-JavaScript browsing |
| Synthetic company capacity | PASS, 120 companies / 1,200 designs; functional fixture only |
| V1/V5/V6/V7 | PASS, 28 viewport cases, four no-JavaScript journeys and original asset integrity, rerun after navigation bootstrap |
| V8 | PASS, five viewport widths plus motion, keyboard and no-JavaScript cases |
| V9 | PASS, four viewport widths, room selection, four product dialogs and view/fallback state |
| V10 | PASS, three viewport widths, keyboard and pointer product interactions, room travel, reduced motion, visibility pause, context loss and unavailable graphics/no-JavaScript fallback |
| V11 | PASS, three viewport widths, walking/collision/doors/inspection, touch, reduced motion, visibility pause, context loss and WebGL/WASM/no-JavaScript fallback |
| PWA | PASS, actual Chrome lifecycle and emulated network/OS connectivity; physical installed devices unverified |
| Final full-route audit | PASS, 42 route/viewport cases: zero axe violations, document overflow and page exceptions |

The final audited artifact is application **1.1.0**, build **3674a64035981f2c**. Its local unthrottled observations have maximum LCP **2,476 ms** and maximum CLS **0.013062** across these 42 initial-load samples. These are single laboratory observations, not field percentiles or an INP assessment. Prepaint navigation and V10 loading-space reservation remove the major initial jumps; detail/comparison reserve an appropriate asynchronous workspace. The evidence records its own generated release identity for reproduction.

Initial stress runs included a V11 software-rendered screenshot timeout and a V10 focus/highlight timeout. The full isolated reruns passed without removing or relaxing those assertions; request URL and focus diagnostics were added. This is bounded local evidence, not a claim that every browser timing/environment has been tested. [V10 evidence](evidence/ssot-v10.json), [V11 evidence](evidence/ssot-v11.json), and [Gallery evidence](evidence/ssot-gallery.json) preserve the scenario results.

## Visual acceptance

The manager inspected the 42 captured desktop/tablet/mobile views, including separate full-size home, collection, detail, comparison and immersive mobile samples. [Gallery contact sheets](screenshots/ssot-review/gallery-390.jpg) and [GJH contact sheets](screenshots/ssot-review/gjh-390.jpg) preserve the review set; sibling files contain desktop and tablet views. The review judged hierarchy 18/20, spacing/alignment 18/20, typography 13/15, color/contrast 13/15, consistency 13/15 and responsiveness 13/15: **88/100**, a subjective design review rather than an automated quality score. The distinctive corporate, editorial, dark, immersive and virtual-store directions remain visible. Final loading/focus corrections preserve these stable layouts.

## Verification limits

Automated axe results are not full WCAG certification. Physical installed iOS/Android behavior, VoiceOver/TalkBack, other browser engines, real-user INP and field Core Web Vitals remain unverified. Local LCP/CLS results have no mobile-network throttling and must not be presented as production percentiles. The catalog contains one company and eight designs; the 120-company/1,200-design fixture proves bounded interaction behavior, not real inventory or production capacity.

Production delivery must be checked separately from local tests: remote commit identity, Actions conclusion and public Pages build identity. A successful push alone is not deployment proof.
