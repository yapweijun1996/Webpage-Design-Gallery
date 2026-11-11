# GJH — Four-Concept Brand Rebuild

Reviewed: 11 November 2026. Design state: **OWNER_REVIEW**, not company-approved artwork or a measured conversion result. These are working corporate concepts; the Gallery remains company-first.

## What Changed

Four independent pages replace invented green corporate lettering and generic AI scenes with the original GJH mark, source-verified portfolio photography and factual company content. Original image bytes and SKU packaging remain unchanged. The Manrope font is self-hosted with its OFL licence. Existing V1/V5/V6/V7 routes and catalog IDs remain stable.

| Version | Direction | Structure and purpose |
| --- | --- | --- |
| V1 — Corporate Clarity | White, berry accents, yellow details | Split lifestyle hero; businesses first; portfolio and partnership pathways |
| V5 — Heritage Editorial | Ivory, deep berry, editorial serif | Three brand portraits; company heritage first; New Moon editorial feature |
| V6 — Portfolio Modern | Modular berry/yellow surfaces, Manrope | Company introduction; brand collection; four exact New Moon SKU cards |
| V7 — Signature Dark | Plum-charcoal, restrained yellow, editorial serif | Business-partner hero; original brand strip; capabilities and heritage |

The company is the parent identity. New Moon, MILI, GOGO and Borsch Med remain distinct portfolio brands; eShop remains a separate shopping channel. Missing facility photographs are represented through factual text, rather than invented premises or staff. Color/font evidence and its limits are owned by the [Brand Research Report](gjh-newmoon-brand-research.md).

## Browser Acceptance

Evidence: [28-case browser report](evidence/gjh-redesign-browser.json), [15 official link checks](evidence/gjh-redesign-links.json), [four-direction overview](screenshots/gjh-redesign-overview.jpg), per-demo `screenshots/`, and refreshed [Gallery captures](screenshots/gallery-v2/).

| Check | Status | Evidence and limits |
| --- | --- | --- |
| Desktop 1440px | PASS | All four real Chrome renders; images decoded, no document overflow |
| Tablet 768px | PASS | All four renders; collapsed navigation, responsive content |
| Mobile 390px and 375px | PASS | All four at both widths; readable stacked content and working menu |
| Additional 320/430/1024px | PASS | All four; 320 CSS-pixel reflow without horizontal scrolling |
| Navigation and keyboard | PASS | Skip link, Enter/Space, Escape, focus return, anchor targets, breakpoint focus transfer |
| No-JavaScript navigation | PASS | All four at 375px; navigation remains visible and functional |
| Reduced motion | PASS | Automatic scrolling and transitions disabled under the user preference |
| Images, font and authenticity | PASS | Decoded resources; loaded Manrope; hashes of original image copies and font checked |
| Official outbound links | PASS | All 15 distinct URLs returned HTTP 200 at capture; no enquiry/order submitted |
| Browser console/resources | PASS | No page/console errors or HTTP failures in the local artifact cases |
| Automated accessibility | PASS | axe-core 4.10.3 WCAG A/AA tags: zero reported violations across 28 cases |
| Complete WCAG conformance | UNVERIFIED | Automated tools do not cover all criteria; contrast over imagery/glyphs has manual-review candidates; no full screen-reader audit |
| Gallery regression | PASS | Company-first flow, style filters, two-design compare, device widths, scroll modes, screenshots and recovery states at four widths |
| Gallery contracts | PASS | Seven standard-library tests and deterministic build check |
| Real devices / other browsers | UNVERIFIED | Headless desktop Chrome with emulated dimensions; no Safari/iOS/Android device matrix |
| Core Web Vitals / conversion | UNVERIFIED | No field measurements or user study; no business-performance claim |

The browser suite serves the actual publishable artifact under `/Webpage-Design-Gallery/`; this checks relative links and assets under the project's deployment prefix. All original image copies are independent within each demo. Below-fold images use lazy loading, known dimensions reserve layout space, and the primary image loads eagerly. Full PNG screenshots are review/detail resources, not the landing pages' hero images.

## Findings and Resolutions

| ID | Observation | Resolution and verification |
| --- | --- | --- |
| BR-01 | Invented corporate mark and forest-green identity did not reflect captured GJH artwork | Original red/yellow mark restored; observed berry/yellow website palette informs concept tokens |
| BR-02 | Earlier generic imagery obscured actual portfolio identities | Official brand photography and SVG/logos used; V6 packshots matched to individual SKU pages |
| UX-01 | Desktop-to-mobile resize could blur a hidden focused navigation link | Track the last focused element; return focus to the disclosure button; regression exercised at every narrow width |
| QA-01 | A Windows default text-codec read corrupted arrows and punctuation during editing | Repair UTF-8 source, require explicit encoding, and reject known corruption markers before browser tests |
| REC-01 | The long mobile page reflects the requested full corporate narrative | Retain clear section navigation; future owner review may prioritize a shorter acquisition-focused variant |
| REC-02 | Small original corporate/brand raster masters remain visually limited | Keep marks small; obtain approved vector/high-resolution masters before larger campaign placements |

## Heuristic Design Review

The following is one agent's evidence-based self-review using ten perspectives, not ten independent reviewers or actual user testing. Scores are subjective proposal-selection aids. Each concept passes the skill's 85-point owner-review threshold; none is marked APPROVED.

| Dimension / maximum | V1 | V5 | V6 | V7 | Basis |
| --- | ---: | ---: | ---: | ---: | --- |
| User purpose / 15 | 14 | 13 | 14 | 14 | Business/brand discovery and official contact are explicit; V5 favors storytelling |
| Information architecture / 10 | 9 | 9 | 9 | 9 | Stable section navigation and separate corporate, brand and shop journeys |
| Visual hierarchy / 15 | 13 | 14 | 13 | 14 | Distinct hero treatments and clear sections in captured desktop/mobile renders |
| Layout and spacing / 10 | 9 | 9 | 9 | 9 | Consistent rhythm; different adaptive compositions without overflow |
| Typography and content / 10 | 9 | 9 | 9 | 8 | Readable body scale and restrained copy; V7 has more small photo metadata |
| Interaction and recovery / 10 | 9 | 9 | 9 | 9 | Functional menus, anchors, Escape and breakpoint focus recovery |
| Responsive quality / 10 | 9 | 9 | 9 | 9 | Seven viewport widths verified; physical-device evidence missing |
| Accessibility / 10 | 8 | 8 | 8 | 8 | Axe and keyboard checks pass; complete assistive-technology review missing |
| Trust and truth / 5 | 5 | 5 | 5 | 5 | Original marks, SKU-specific packaging, scoped history, visible concept disclaimer |
| Craft and restraint / 5 | 4 | 5 | 4 | 5 | Coherent identities; V5/V7 provide stronger editorial differentiation |
| **Total / 100** | **89** | **90** | **89** | **90** | Subjective heuristic scores, not conversion metrics |

V1 is the recommended business-information baseline. V5 is the stronger heritage-led alternative; V6 serves detailed brand/product exploration; V7 offers a distinctive dark presentation. Owner feedback should decide the preferred direction.

## Reproduce and Preview

```sh
python scripts/verify_gjh_asset_library.py
python tests/browser_gjh_demos.py --axe-script /path/to/reviewed/axe.min.js
python scripts/build_gallery.py
python scripts/build_gallery.py --check
python -m unittest discover -s tests -p test_gallery.py -v
python tests/browser_gallery.py
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000/companies/gjh/` to select concepts, or go directly to `/demos/corporate/gjh/v1/`, `v5/`, `v6/` or `v7/`. Omit `--axe-script` when the optional audit bundle is unavailable; that run must report automated accessibility as UNVERIFIED. The test runner never installs or downloads it. The bundle used for this review is identified by SHA-256 in the machine report.

Source PNG/JPG photographs remain unchanged and locally hosted. No new AI-generated packaging, logo art, documentary claims, company statistics or backend service was introduced. Formal brand guidelines, higher-resolution corporate masters, current packaging approval and full accessibility certification remain outside the available evidence.
