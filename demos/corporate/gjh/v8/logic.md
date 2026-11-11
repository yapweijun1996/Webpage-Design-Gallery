# GJH V8 — Page Logic and Motion Contract

## Architecture and integration

V8 is a self-contained static HTML/CSS/JavaScript demo. It uses the repository's company-first flow: company directory → GJH collection → design detail or direct demo → optional two-version comparison. The Python generator discovers `v8/metadata.json` and emits the existing gallery HTML and `data/designs.json`; no generator or deployment configuration change is required. Existing demo paths and featured-version selection remain unchanged.

Metadata owns catalog copy, stable IDs, style tags and explicit numeric order. HTML owns visible content and native navigation. CSS owns presentation, responsive composition and reduced-motion overrides. JavaScript owns only enhancement state. Asset receipts and official source references own provenance; they do not grant official approval.

## Scene contract

| Scene | Purpose | State and interaction | Baseline without animation |
| --- | --- | --- | --- |
| Hero `#top` | Family emotion and corporate introduction | CSS entrance; scroll-driven photograph scale/translation; story and brand anchors | Full heading, image and native anchors |
| Heritage `#story` | Rochor Road origin and verified chapters | Four `aria-pressed` buttons update text, image, caption and polite status | Original 1940s chapter plus all four milestones in Journey |
| Brands `#brands` | Separate New Moon, MILI and GOGO identities | Depth offset on desktop scroll; bounded pointer tilt; focus/hover emphasis | Full original images, brand copy and official destination links |
| Businesses `#business` | FMCG, electronics and health categories | Whole-card native links; lift and image scale | Three readable linked cards |
| Journey `#journey` | Four dated chapters | Gold progress; automatic selection from scroll until explicit manual choice; buttons announce manual choice | All four dates and descriptions remain visible |
| Network `#network` | Named regional connections | HTML buttons update selected SVG line and polite status | Readable list of all named markets; SVG is decorative |
| Contact `#contact` | Business enquiry conversion | Official contact links and local brand link | Native links; no form submission or backend |

Heritage is deliberately not a claim of original archival imagery. New Moon's 1959 establishment is distinct from GJH ownership history. Conflicting GOGO establishment dates are omitted. The regional visualization is a labeled schematic, not a precise map or evidence of product availability.

## Motion and state

The page uses native animation primitives instead of adding GSAP/Three.js to a dependency-free repository. There is no genuine product model to render. CSS perspective supplies explicitly labeled 2.5D depth. SVG supplies the connection visualization with equivalent HTML market controls. No sound, pinned scroll scene or scroll hijacking is used.

- Hero: staggered CSS entrances, then at most 55px image translation and 4.5% extra scale as the hero leaves the viewport.
- Heritage: progressive CSS view-timeline parallax where supported; normal static composition elsewhere. Chapter selection changes image and caption without hiding factual content.
- Brand depth: desktop/fine-pointer only; at most modest depth translation, pointer yaw bounded to ±3.5° and pitch to ±2.5°. Mouse leave resets tilt. Mobile has a dedicated paired-image/text composition.
- Reveals: one-shot IntersectionObserver/Web Animations API entrance. Elements stay visible if the observer or script fails.
- Journey: a bounded progress ratio maps to four milestones. Explicit choice takes precedence for the remainder of that page session. Scroll updates do not repeatedly announce live status; manual activation does.
- Network: selecting a named market highlights its schematic connection; Singapore resets the connection highlight. A restrained dashed-line animation runs only for the selected path.

One pending `requestAnimationFrame` services each scroll/resize burst. Offscreen hero/brand writes are skipped. There is no idle render loop, canvas, GPU model or external animation script. DOM references to individual era text/image elements are resolved only on explicit chapter selection.

`prefers-reduced-motion` disables CSS animations/transitions, smooth scrolling and transform effects. JavaScript also checks the live preference before scheduling a reveal or applying parallax. Updating the preference clears existing scroll offsets. State changes remain available without animated travel.

## Navigation, accessibility and resilience

The page uses semantic sections, one H1, visible focus, a skip link, descriptive alt text and `aria-pressed` selection controls. The mobile navigation is a disclosure, not a modal: it has no focus trap. Escape closes it and returns focus; local navigation closes it and moves focus to the target section. Breakpoint changes recover focus when a navigation item becomes hidden. Without JavaScript, navigation remains expanded and anchors work.

Every external brand/contact link opens an official destination in a separate tab with `noopener noreferrer`, preserving embedded gallery comparisons. No personal data, cookies, analytics or contact submission is introduced. A complete independent-concept disclaimer and AI-image disclosure remain visible.

## Loading and publication boundaries

The responsive hero image is eager and high priority. The self-hosted Manrope font is preloaded with `font-display: swap`; serif headings use a documented system fallback. Below-fold images are lazy; image/card frames reserve space. Original brand image bytes remain unchanged. The generated hero has optimized desktop/mobile WebP derivatives recorded in the manifest.

Screenshots are review/detail resources; the page does not load full-page gallery captures as its hero. Publishing uses the existing allowlisted artifact generator. After local validation, the user authorized committing and pushing this candidate to `main`. Deployment and production configuration changes remain outside that authorization.

## Verification boundaries

Functional browser checks cover the required five viewport sizes, normal/reduced motion, no-JavaScript browsing, all images, control state, menu keyboard behavior, URL-prefix routing and existing demo smoke paths. Exact execution results belong to `docs/evidence/gjh-v8-browser.json` and the candidate review. Lighthouse category scores, measured local timings and subjective persona findings are different forms of evidence and must remain separate. Headless Chrome does not establish physical-device behavior, full WCAG conformance, real user conversion or field Core Web Vitals.
