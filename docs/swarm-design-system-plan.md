# Swarm Design System (SDS) v1: plan

Status: plan, written 2026-11-21 before any worker is assigned. Owner request: make the webpage design system follow UI/UX standards, UI/UX skills, PWA, i18n, theme, animation, loader, CSS tokens and a single source of truth (SSOT).

## 1. Problem (evidence)
- `swarm/` agents design page sections in parallel, but each section currently hard-codes colours, font sizes, durations and English text (the GJH brief even tells agents to declare hex values locally). Result: no theme switching, no translation, no shared animation or loader, and a colour change such as "green and gold" needs ten agents to edit ten files.
- The repo already has good conventions we should reuse, not reinvent: `design-system/tokens.json` -> `scripts/build_design_system.py` -> `assets/tokens.css`; `scripts/check_ssot.py` ratchet; `locales/{en,zh-Hans,ms}.json` plus `src/preferences.js` (Intl formatting, language and palette persistence); `design-system/themes.json`; `ds.md` (gallery SSOT spec); the PWA standard (scale-1 viewport, manifest, versioned service worker, update on click); skill `ui-ssot-component-library` (components, ratchet, icon SSOT).
- Gaps: nothing governs swarm-generated pages; no motion/loader vocabulary; export gives a plain HTML file, not an installable PWA.

## 2. Scope and decisions (made, not asked)
- SDS governs pages produced by `swarm/`. The gallery's own `ds.md` system is untouched; SDS borrows its structure and checks. Independent demos keep their identity.
- Languages: English (source), Simplified Chinese (zh-Hans), Malay (ms), same codes as `locales/`. Non-English text is machine-drafted and flagged as such until a human reviews it.
- Themes: `light`, `dark`, `auto` (follows the system) plus a brand layer. First brand theme = `forest-gold` (the owner's stated preference), and `gjh-classic` (ink and GJH red) as the previous look. A theme is data in `tokens.json`; sections never contain a colour literal.
- PWA zoom lock follows the owner's standard (scale 1) in the PWA shell only; the WCAG 1.4.4 trade-off is stated once in the standard document.
- Section fragments stay script-free. Behaviour (theme, language, reveal, loader, service worker) lives in a shared runtime owned by the system, so agents cannot break it.

## 3. Architecture (one source, generated outputs)
```
swarm/design-system/
  tokens.json            SSOT: primitives, semantic roles, themes, motion, space, type, z, loader
  build.js               generates tokens.css + themes.css + docs/tokens.md  (zero deps)
  components.css         token-only base components (.sds-btn, .sds-chip, .sds-card, ...)
  runtime.js             theme, language, reveal, loader, viewport guard, SW registration/update
  i18n.js                data-i18n lookup, interpolation, plurals, Intl, html lang
  i18n/{en,zh-Hans,ms}.json   catalogs (keys generated from fragments)
  shell/                 index template, manifest.webmanifest, sw.js, offline.html, icons
  STANDARD.md            UI/UX rules and acceptance checklist
  components.html        living sheet: every component x state x theme x language
swarm/tools/
  check-sections.js      extended into the SSOT ratchet (see 5)
  i18n-extract.js        scans fragments for data-i18n, builds/diffs catalogs
  export-page.js         produces an installable PWA dist (shell + precache list)
```
Agent-facing contract (kept tiny): use `var(--sds-*)` tokens and `.sds-*` components, mark every user-visible string with `data-i18n="<key>"` (English text stays inline as the default), mark reveal targets with `data-reveal`, never write raw colours, px type sizes, durations or easings.

## 4. Standards the system must encode (STANDARD.md)
UI/UX: one h1, landmarks once, 44 px targets, visible focus, AA contrast in every theme (computed in tests), 393 px first and no horizontal scroll to 320 px, safe-area insets, loading/empty/error states for every data-like block, forms with labels and errors. Motion: only `transform` and `opacity`, duration and easing from tokens, `prefers-reduced-motion` honoured, no motion longer than 600 ms, reveal on scroll via `animation-timeline: view()` with a visible fallback. Loader: no layout shift, skeleton or progress for first paint, never blocks content longer than needed. PWA: manifest, versioned precache that equals the real file list, offline fallback, update only after the user clicks, version shown. i18n: no text in CSS, plural and number/date/currency through `Intl`, `lang` set on `<html>`, text expansion tolerance (+40 percent), CJK line-breaking.

## 5. Enforcement (ratchet, no silent drift)
`check-sections.js` gains rules with a baseline file (counts may only go down, final target 0): raw colour/rgb/hsl, raw font-size px, raw duration/easing, `!important`, user text without `data-i18n` (warn first), missing alt, inline data URIs over 20 KB, selectors outside `.s-NN`, redefined `.sds-*` bases. A sync check fails if `tokens.css`/`themes.css` differ from `tokens.json`. Tests compute contrast for every theme pair and fail under AA.

## 6. Work breakdown (parallel Codex workers, disjoint files, gpt-6.2-sol xhigh)
Phase 0 (manager, before assigning): `swarm/design-system/SDS_SPEC.md` fixes token names, component class API, runtime and i18n APIs, shell contract, lint rule ids. Everything below codes against that spec, so workers do not wait on each other.

| Worker | Owns | Done when |
|---|---|---|
| A tokens | `tokens.json`, `build.js`, generated css, `test/sds-tokens.test.js` | 3 themes build, contrast >= AA proven, output in sync |
| B components | `components.css`, `components.html` | every component x state renders in all themes, no raw literals |
| C runtime | `runtime.js`, `test/sds-runtime.test.js` | theme persist and system follow, reveal, loader hooks, reduced motion, viewport guard |
| D i18n | `i18n.js`, `tools/i18n-extract.js`, `i18n/*.json`, tests | switch language live, plural/Intl, catalogs generated from GJH home, ms/zh-Hans drafts flagged |
| E pwa | `shell/*`, `tools/export-page.js` upgrade, tests | exported dist installs, precache list equals files, offline works, update on click |
| F lint | `tools/check-sections.js` rules, baseline, tests | each rule proven by a planted violation |
| G docs | `STANDARD.md`, `README` section, `docs/` index | standard matches the tests |

Phase 2 (dogfood): the manager posts one channel request; the Manager agent and the ten section agents migrate the GJH home page to SDS (replace literals with tokens and components, add `data-i18n`, `data-reveal`), driven by the ratchet baseline going to 0. This also removes the hard-coded green and gold from the current run.

Phase 3 (verification by the manager, not workers): browser test at 390x844 and 1440x900: no console errors, no failed requests, no horizontal overflow; theme switch (light/dark/forest-gold) and language switch (en, zh-Hans, ms) change the page live; offline reload of the exported PWA works; reduced motion disables animation; loader visible then gone with no layout shift; screenshots of every theme and language viewed by me.

## 7. Risks and honest limits
- Real iPhone and Safari behaviour (gesture zoom lock, install prompt, service worker quirks) cannot be proven headlessly; stays UNVERIFIED until a device test.
- Machine-drafted translations need native review before publishing.
- The migration changes how the current GJH page is authored; the visual result should stay equal except for the new green-gold theme, so screenshots are compared before and after.
- Worker sandboxes cannot bind ports; browser and e2e verification is the manager's job.

## 8. Order of work
1. SDS_SPEC.md (manager). 2. Workers A-G in parallel; manager verifies each deliverable (syntax, tests, build output). 3. Integration: shell + runtime + components + catalogs wired into the viewer and exporter. 4. Phase 2 migration through the channel. 5. Phase 3 verification and the KB reflection.

## 9. Staffing, skills, tools and framework (added after owner feedback)
Every Codex worker is treated as a trained staff member so many can work in parallel without improvising:
- Position: a roster `swarm/staff/staff.json` defines positions with mission, skills, tools, owned files, reviewers, handoffs and definition of done. Build crew (this project): art director, design-token engineer, component engineer, runtime engineer, localization engineer, PWA engineer, quality-gate engineer, standards lead, knowledge librarian, staffing and operations. Page crew (the ten section agents): navigation and chrome, hero, brand chapters, directory, heritage, concept showcase, enquiry UX, footer and compliance; the Manager reviews through three lenses (accessibility, localization, motion and performance).
- Skill package: a handbook of ten packs under `swarm/staff/handbook/` (UI/UX core, typography and layout, colour and theme, accessibility, motion and loader, i18n and content, PWA and performance, tokens and SSOT, component engineering, QA and verification), plus one playbook per position.
- Tool kit: documented commands in `swarm/staff/tools.md` (token build, lint ratchet, i18n extract, export, staff validation, contrast checker, test runner, optional browser inspection).
- Framework: SDS (tokens, components, runtime, shell) plus the contract and the round protocol; order of authority is written into every playbook.
- Delivery: `lib/staff.js` builds a short position preamble that the manager injects into every agent prompt, and the server copies the staff and design-system files into each project so agents can read them in their sandbox.
Workers H, I (handbook packs) and J (roster, playbooks, tools.md, staff.js, contrast tool) are added to the parallel batch, so the first batch is ten workers: A tokens, B components, C runtime, D i18n, E PWA, F lint, G standard, H and I handbook, J staffing.
