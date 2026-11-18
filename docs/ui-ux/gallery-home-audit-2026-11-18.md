# Gallery home audit (2026-11-18)

Scope: `index.html` (Companies page) of Webpage Design Gallery v1.4.0, local build, headed Chrome, read-only.
Method: `tests/ui_audit.py` plus manual review of real screenshots at 390x844 and 1440x900 (see `docs/ui-ux/taste-engine-checklist.md`, sections 3 and 4).

## Passed (OBSERVED by script)
| Check | 320 | 390 | 430 | 768 | 1024 | 1440 |
|---|---|---|---|---|---|---|
| Horizontal overflow | no | no | no | no | no | no |
| Unnamed controls | 0 | 0 | 0 | 0 | 0 | 0 |
| Images without alt / broken | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| H1 count, heading jumps | 1, none | 1, none | 1, none | 1, none | 1, none | 1, none |
| Text below 12 px | 0 | 0 | 0 | 0 | 0 | 0 |
| Console or page errors | none | none | none | none | none | none |
| Controls under 44 px | 0 | 0 | 0 | 1 | 6 | 6 |

Keyboard: 14 tab stops checked at 1440, every one shows a 3 px solid focus outline; skip link is first. Title and `lang="en"` present.

## Findings (from real screenshots)
| ID | Viewport | Region | Type | Observation | Narrow fix | Acceptance |
|---|---|---|---|---|---|---|
| G-01 | 390 | Header nav | OBSERVED | The tab row ("Companies", "About the gallery") is indented and aligned to neither the logo edge nor the centre. | Left-align the tab row to the logo edge (or centre both rows). | Tab row left edge equals logo left edge at 320-430. |
| G-02 | 390, 1440 | Hero | OBSERVED | "Explore the style atlas" is plain text with no button or link affordance; the hero's only action is not discoverable. | Style it as the primary button (filled, arrow, 44 px). | Visible affordance at rest; 44 px target on touch. |
| G-03 | 390 | Search | OBSERVED | Placeholder is clipped ("...industries or locatio"). | Shorten the placeholder on narrow widths ("Search companies"). | Full placeholder visible at 320-430. |
| G-04 | 390 | Section header | OBSERVED | "Companies 3" is centred while everything else is left-aligned; "49 designs to explore" wraps into two lines. | Left-align the header block; keep the count on one line. | One alignment axis; no wrapped count. |
| G-05 | 1440 | Top bar | OBSERVED | A disabled "Checking..." button sits in the top bar with no explanation. | Show a clear state (icon + "Up to date" or hide until relevant) with an accessible description. | State is understandable without hovering. |
| G-06 | 1440 | Hero | OBSERVED | The description floats at the far right, off the headline baseline, leaving a large empty gap. | Align description to the headline's last line or stack under it. | Description shares a clear alignment with the headline. |
| G-07 | all | Company cards | RECOMMENDATION | Card preview thumbnails are small; page text inside them is unreadable. | Use hero crops of each design at a larger size. | Preview shows the design's hero idea at a glance. |
| G-08 | 1024, 1440 | Header and filters | TEST_CANDIDATE | Six controls are under 44 px (theme, language, filters). Fine for pointer, small for touch laptops. | Decide a pointer rule (>= 36 px) and document it; raise on touch. | Documented rule, enforced by `tests/ui_audit.py`. |

## Not verified
axe-core, screen-reader behaviour, 200 percent zoom, measured contrast, real-device Safari/iOS, loading/empty/error states.
