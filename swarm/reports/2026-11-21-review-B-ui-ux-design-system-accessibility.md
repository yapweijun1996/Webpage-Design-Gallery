# Astra review (B): ui-ux-design-system-accessibility

Reviewer: Codex gpt-6.2-astra (xhigh), read-only, 2026-11-21. Raw report, unedited.

## 1) Verdict

**Hold the Studio switchover and PWA release.** Both viewers accept generated HTML in the owner’s origin, and Studio can omit the squad CSS that determines what the owner is approving. The token build check and all 157 focused tests passed on the final run, but an in-memory export confirmed that the generated page starts neither translation nor offline caching.

## 2) Top 5 risks

1. **Generated content crosses into the owner interface.** Worker markup reaches a same-origin DOM, and the default viewer also interprets editable worker names and titles as HTML. See UI-01.
2. **Owners and agents can review different designs.** Studio omits squad layers, while the agent screenshot path omits the shared SDS stylesheets. See UI-02.
3. **Essential review tasks have access barriers.** Keyboard users cannot select ordinary headings or images with the picker. Saved sidebar state also overrides the mobile layout. See UI-05 and UI-06.
4. **Language selection can misidentify English content.** An export can declare Malay or Chinese to a screen reader while continuing to display English. See UI-03.
5. **Fresh PWA installs cannot establish offline support.** The worker is packaged, but the exported page never registers it. See UI-04.

## 3) Issues table

Evidence paths are relative to `swarm/`.

| ID | Sev | Area | Evidence (file:line) | Impact | Recommended fix |
|---|---|---|---|---|---|
| UI-01 | P0 | DOM injection | `ui/index.html:312`, `ui/index.html:359`, `lib/team.js:63`, `ui/studio.html:102`, `ui/studio.js:112`, `tools/export-page.js:178` | The default viewer parses roster text as HTML. Both viewers insert worker fragments into an owner-origin document. Export preserves section scripts and emits a warning. These are stored XSS risks. | Build roster fields with `textContent`. Isolate generated previews from owner controls and reject active content before preview and export. |
| UI-02 | P1 | Preview fidelity | `ui/studio.js:106`, `ui/index.html:354`, `tools/export-page.js:189`, `server.js:84`, `server.js:403`, `tools/export-page.js:362` | Studio fetches base CSS while the default viewer and exporter assemble layers. The agent screenshot export uses `--no-pwa`, which includes project and section CSS but omits SDS components and themes. | Use one assembled preview for Studio, Compare, and agent QA. Test a layer-only layout change and an SDS-styled button through all three. |
| UI-03 | P1 | Exported language | `tools/export-page.js:229`, `tools/export-page.js:249`, `design-system/runtime.js:64`, `design-system/runtime.js:91`, `server.js:648` | Export copies only SDS catalogs and loads only `runtime.js`. Selecting a language changes `<html lang>` while section text stays English. The live viewer merges project translations, masking the export defect. | Load `i18n.js`, merge project catalogs as the viewer does, and commit the document language after translation succeeds. |
| UI-04 | P1 | PWA startup | `tools/export-page.js:249`, `design-system/runtime.js:244`, `design-system/runtime.js:275`, `test/sds-pwa.test.js:340` | A fresh scope has no worker registration. Offline caching and update checks consequently never start there. The worker test dispatches lifecycle events directly. | Register `./sw.js` from the shell. Test first visit, worker control, offline reload, and a user-approved update. |
| UI-05 | P1 | Responsive layout | `ui/studio.css:192`, `ui/studio.css:648`, `ui/studio.css:666`, `ui/studio.js:455` | At 393 and 768 px, a saved collapsed sidebar makes the desktop Team/Review grid selector outrank the mobile rule. The hidden sidebar leaves the workspace in the first, 56 px track. | Scope desktop column rules to widths above 900 px. Test both widths after collapsing the sidebar on desktop. |
| UI-06 | P1 | Keyboard and focus | `ui/studio.js:886`, `ui/studio.js:907`, `ui/studio.js:1155`, `ui/index.html:313` | The picker handles clicks and binds Escape, but ordinary headings and images have no keyboard selection path. Closing the request hides the focused form without restoring focus. Legacy agent cards are clickable `div`s. | Provide a keyboard element chooser, restore focus on cancel, and make agent jumps native buttons. |
| UI-07 | P1 | Text resizing | `design-system/shell/index.html.tpl:5`, `design-system/runtime.js:298`, `design-system/STANDARD.md:32` | Every default PWA export requests a zoom lock and cancels `gesturestart`. The project standard records this owner decision as a WCAG 1.4.4 failure. | Revisit the shell requirement with the owner and verify 200% resizing on the exported page. |
| UI-08 | P2 | Settings contrast | `ui/studio.css:30`, `ui/studio.css:596`, `ui/settings.css:753`, `ui/settings.js:156`, `ui/settings.js:1259` | In Studio light mode, enabled **Save team** and **Save settings** use `#13161c` on `#1d4ed8`. The measured **2.70:1** falls below 4.5:1 for their text. | Use a paired SDS action background and foreground. Test the actual Settings buttons in both themes. |
| UI-09 | P2 | Settings parity | `ui/index.html:696`, `ui/studio.js:361`, `ui/settings.js:1234` | Studio supplies no image-settings adapter, so its shared Settings panel omits OpenAI key management available in the default viewer. | Share the adapter and verify the same key-management controls in both viewers. |
| UI-10 | P2 | Lint and release gates | `tools/check-sections.js:790`, `tools/check-sections.js:877`, `tools/export-page.js:359`, `test/export-page.test.js:288` | The archive baseline passed with **208 errors and 204 warnings**. Counts allow one same-rule regression to replace another. Export also succeeds with duplicate `h1`s and missing images. | Keep the debt ratchet, track exceptions by location, and fail release export on structural and required-asset errors. |
| UI-11 | P2 | Channel scale | `ui/studio.js:1034`, `ui/channel.js:490`, `ui/channel.js:519`, `ui/channel.js:589` | Opening Logs requests history from ID zero. Rendering is batched, but every row stays mounted and filtering revisits every rendered record. | Page older history and bound mounted rows while preserving search, scroll position, and keyboard focus. |

## 4) Improvements

**Quick wins (under 1 day each).** Switch Studio to the existing CSS bundle, fix the Settings color pair, scope the desktop grid rules, and render roster labels as text. Each change has a specific acceptance check in the table.

**Strategic.** Put preview and export behind one rendering path with an explicit isolation boundary. Exercise the generated artifact from a fresh browser profile, including language switching, offline reload, keyboard selection, landmarks, and persisted panel states at all four widths.

## 5) Verified vs UNVERIFIED

- **Verified.** The checkout changed during review. A transient brand mismatch disappeared before final verification. `node swarm/design-system/build.js --check` then passed, as did all 157 tests across the ten selected SDS, contrast, lint, composition, and export test files.
- **Verified.** The in-memory PWA build included `i18n.js` and `sw.js` as files. Its only external script was `runtime.js`, and its startup code contained no worker registration. The contrast ratio and archive ratchet counts above came from the repository’s own tools.
- **UNVERIFIED.** Actual rendering at 393, 768, 1100, and 1440 px, screen-reader announcements, device pinch behavior, installed-PWA lifecycle, and long-session latency. The mobile finding follows from CSS specificity and persisted state. I used local read-only inspection and focused tests, with no server, network access, or repository edits.