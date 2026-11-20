# Squad mode spec (binding): many specialists on ONE screen

Owner request 2026-11-21: instead of one agent per section, several specialists (by aspect, each with a job title) work in parallel on the SAME focused screen. Node 23, zero dependencies, CommonJS.

## Layered files (conflict-free parallel writes)
For a section `NN-name` the legacy files stay: `sections/NN-name.html` (structure + copy, ONE owner) and `sections/NN-name.css` (legacy base). Specialists write ONLY their own layer file:
`sections/NN-name.<layer>.css` with `<layer>` in this fixed order:
`layout, type, color, imagery, icons, motion, polish`.
Assembly order of the section CSS = legacy `NN-name.css`, then layers in the order above. Missing layers are skipped. A layer file may only style selectors under `.s-NN` / `#NN-name` (the linter warns otherwise).

## lib/layers.js (worker W-A)
```js
const L = require('./layers');
L.LAYERS                              // ['layout','type','color','imagery','icons','motion','polish']
L.layerFile(sectionBase, layer)       // 'NN-name.layer.css' ; throws on unknown layer or bad base
L.parseSectionFile(name)              // 'NN-name.html' -> {base,kind:'html'}; 'NN-name.css' -> {base,kind:'base'}; 'NN-name.type.css' -> {base,kind:'layer',layer:'type'}; anything else null
L.listLayers(sectionsDir, base)       // existing layer files for base, in assembly order -> [{layer,file}]
L.assembleCss(sectionsDir, base)      // concatenated CSS text: base css then layers, each preceded by a /* layer: x */ comment
```
Paths never escape `sectionsDir` (reject `..`, separators). Missing files are skipped, never thrown.

## Exporter and linter (worker W-A)
- `tools/export-page.js` must use `assembleCss` so layer files are included in the exported page (same minify/rewrite pipeline as today). Existing sections without layers export byte-identically.
- `tools/check-sections.js` must treat layer files as part of their section (same section CSS rules, same baseline accounting) and add one new rule: a layer file whose selectors are not scoped to its section is a warning (not counted in the ratchet baseline). Do not change existing rule behaviour.
- `ui` and `server.js` are owned by the manager: expose `L.parseSectionFile` for the watcher regex and a virtual bundle (`assembleCss`) the viewer can request.

## Roster (worker W-B): swarm/squad/roster.json + lib/squad.js
`roster.json`: array of specialists `{ id, title, layer, role, runner, mission, writes }`:
layout (Layout & Structure Engineer, owns HTML + layout layer, pi), type (Typography Designer, pi), color (Colour & Theme Designer, pi), imagery (Imagery Art Director: crops, overlays, filters; pi), image-gen (Image Generator: new PNG assets via codex image generation, writes `assets/generated/`), icons (Icon & SVG Designer, pi), copy (Copywriter: proposes text edits to the layout engineer through chat, never writes HTML), motion (Motion Designer, pi), qa (Responsive & Accessibility QA: reads, reports, may write only the `polish` layer), researcher (Brand Researcher, codex web search, writes `research.md` only).
`lib/squad.js`:
```js
const S = require('./squad');
S.roster()                                  // validated roster array
S.pickSquad(scope, request, roster)         // -> specialists for this request (always layout + qa; others by keywords/scope; max 8)
S.waves(squad)                              // -> [[researcher?],[parallel layer writers...],[layout integrate],[qa]]
S.ownedGlobs(spec, base)                    // globs a specialist may write for section base
S.promptFor(spec, { base, scopeLine })      // short role prompt block for the turn prompt
```
Validation: unique ids, one specialist per layer, layers valid, runner in {codex,pi}.

## Manager side (not delegated)
turns.js handleSquad, server wiring (virtual `/p/sections/NN-name.bundle.css`, watcher regex, ownedGlobs, role `image`), settings `roles.image`, viewer toggle, autopilot squad mode.

## Rules for workers
Own only your files, run `node --check`, write node:test tests, report exact counts, no git state changes, English, no em dashes.
