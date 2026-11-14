# V11 compact onboarding — 1.1.18

## Source of the change
The owner supplied an actual iPhone screenshot showing a near-full-height first-use guide and a separate ChatGPT concept mockup. Both images were inspected as pixels. The concept is not a screenshot of an implemented fix; its mall photo was not copied into the repository. Neither image can establish touch-event penetration or identify the floating edge control's DOM owner.

Fresh live 1.1.17 browser capture at 390×680 confirmed a 644.61px-tall guide, three equal stacked actions and no independent Close button. Existing source already had `100dvh` and internal scrolling, so this release does not claim those were entirely absent.

KB skills actually loaded for this work: `agent:ask-advisor` 1.0.0, `ui:ux-quality-auditor` 1.0.5, `ui:design-taste-engine` registry 1.0.1, `agent:auto-manager` 1.4.0. UI skills marked stale were used as review procedures, not proof of current behavior. A separate read-only advisor inspected both owner images and source before editing and the rendered candidate afterward.

## Bounded implementation
- Preserve cream/deep-green typography and actual scene; no unrelated images or new visual framework.
- Short heading and three compact input-specific instructions. Detailed Run/keyboard guidance remains in How to explore.
- A visible 44px Close action, one primary Start exploring button, and secondary store/directory actions.
- Sticky guide header and internal scrolling; dynamic viewport constraint with `vh` fallback and symmetric margins accommodating the larger safe-area inset. No fixed content height.
- Initial focus goes to the noninteractive heading rather than drawing an automatic action-button ring. Only that heading's outline is suppressed; keyboard focus rings on buttons remain intact and tested.
- Tab cycle includes Close. First-use Close/Escape returns to the scene without moving the visitor; when reopened from help, dismissal restores the visible help trigger. Start still enters the scene, Map opens existing wayfinding, Directory opens the accessible list.
- Native modal isolation and paused scene are retained. No speculative deletion of unknown floating controls.

## Verification and limits
`browser_gjh_compact_guide.py`: PASS at 320×480, 390×680, 390×844, 430×932, 768×1024, 844×390 and 1440×900. Guide remains in the viewport, all buttons meet 44px, keyboard ring and Tab cycle work, Close/Escape/reopen focus work, reducing height to 320px retains scrolling and Close access. Actual Chromium/CDP touch drags on backdrop and dialog plus keyboard input do not change visitor x/z/yaw while open.

At the matched 390×680 lab viewport, height falls from 644.61px to 439.23px, exposing scene context above and below. This measured comparison is not a physical-iPhone measurement.

Existing `browser_gjh_guide.py`: PASS across its five viewports, map and directory navigation, session-only dismissal, storage unavailable, WASM failure and no-JavaScript fallback. Expected first/return focus assertions were updated for the intentionally changed Close/help behavior, not removed. Guide-focused axe has zero violations and zero incomplete findings at 320×480; a deliberate 200% text-growth fixture remains horizontally contained with reachable Close. This is not native browser zoom, screen-reader or real-device certification.

SSOT/generated-release checks pass. Unchanged product geometry, packaging, physics and PWA implementations retain previous evidence rather than repeating unrelated suites. Before/after advisor screenshot review passes for 320, 390, 844 landscape and 1440; shortened instructions retain clarity and existing visual language. Short-landscape footnote scrolling is intentional; primary actions remain reachable.

Real iPhone Safari/in-app dynamic toolbar, hardware safe-area and assistive-technology behavior still need device confirmation. User screenshot is baseline evidence only, not proof the new build has run on that phone.

Rollback: revert to prior main `04fa16ba4e2b2ae07619a0291fb11a103349dc91` and rebuild generated release artifacts; no shared-history rewrite. A local backup branch and reverse-applicable binary patch are prepared before publishing.

### Live acceptance and floating-point measurement correction
Pages run 43584723742 deployed main a5bf503 successfully. First live acceptance passed open-modal touch isolation but failed exact position equality after dismissal. The original failure is retained as job 190f4489-e3a9-4dfa-a55b-059edce10734. Its changed value was not logged, so the original cause remains unproven; an unchanged diagnostic rerun passed. Four live runtime file hashes matched the released files.

A bounded five-session read-only observation found all paused x/z/yaw values exactly unchanged. After dismissal, asynchronous Rapier ticks resume; in three sessions z changed by 9.5367431640625e-7 metres after 250ms while idle with unchanged yaw. This supports correcting the measurement contract, not rewriting the original failure as a confirmed same-root-cause event. Independent source/evidence advisor review agreed: sample resumed state once, use absolute tolerance 1e-5 metres for x/z only, retain exact yaw and exact modal-open isolation assertions, and report before/resumed/deltas if failure occurs. This 10-micrometre tolerance is over 4,000 times smaller than one ordinary walking tick (~44mm). No runtime change, disabled check or frozen-input fixture was introduced. Raw observations are preserved in v11-guide-close-observations.json.

Corrected live targeted acceptance: PASS at 390×680, including Close/Escape/reopen, keyboard ring, background isolation and height reduction to 320px. Runtime version remains 1.1.18.
