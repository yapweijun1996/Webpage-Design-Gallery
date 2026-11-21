# Page review — request #1230

## What works
- Direction and all nine neighboring handoffs are documented; the fragments form an ordered brand-to-enquiry journey.
- Source has one hero h1, native navigation and radio controls, eleven portfolio brands, image credits, verified history and both footer disclosures.
- Export assembled 10 sections with 15 copied images and no missing image references; SDS token build is synchronized.

## Page-level findings
- P1: Export includes legacy supplemental CSS for 01–05. SSOT reports 77 errors and 32 warnings, including raw colors, type, motion and stacking; theme consistency and image layering are at risk. The section owners cannot edit supplemental files under the ownership contract: coordinate an authorized integration owner rather than bypassing it.
- P1: i18n check fails on seven invalid 02 keys/bindings and one 08 binding; translated copy and alt text cannot be accepted until corrected and catalogs checked.
- P1: 08 reports `../v11/` resolves to `/p/v11/` and returns 404 in preview; preserve the required destination and resolve the deployment route with the integration owner.
- Accessibility lens: one h1 and native controls are present in source; keyboard operation, focus clearance, 320px reflow and target sizes remain unverified.
- Localization lens: key validation fails; language switching and long translations remain unverified.
- Motion/performance lens: reveal hooks and intrinsic image dimensions are present; reduced motion, loading stability and actual image requests remain unverified.
- Visual lens: source suggests manga panels and consistent gutters, but desktop/phone rendering, 04/05 media visibility and contrast, theme/brand matrix and fixed-bar clearance remain unverified.

## Ranked changes by owner
- 01: 1. Coordinate removal or SDS migration of legacy motion CSS. 2. Verify mobile bar and translated labels do not obscure focus or footer. 3. Verify native menu keyboard operation.
- 02: 1. Correct invalid i18n keys and bindings. 2. Coordinate legacy CSS removal or migration. 3. Verify 320px/393px hero, brand strip and fixed-bar clearance.
- 03: 1. Coordinate legacy CSS removal or migration. 2. Verify image and text contrast in both themes. 3. Check 02/04 transition and fixed-bar clearance.
- 04: 1. Coordinate legacy CSS removal or migration, including negative stacking. 2. Verify both desktop images render. 3. Measure text and button contrast in both themes.
- 05: 1. Coordinate legacy CSS removal or migration. 2. Verify desktop wellness and Sony images render. 3. Measure button and text contrast in both themes.
- 06: 1. Verify keyboard scrolling and exit from the rail at 320px. 2. Check lead-image crop and contrast. 3. Check transition to 07.
- 07: 1. Verify complete history composite at phone and desktop widths. 2. Check long translations and focus. 3. Check 06/08 transitions.
- 08: 1. Coordinate a working `../v11/` deployment route. 2. Correct the invalid image-alt binding. 3. Verify image crop and contrast at phone and desktop widths.
- 09: 1. Verify radio keyboard behavior and focus visibility. 2. Check fixed-bar clearance at 320px and with translations. 3. Verify official links and 08/10 transition in the assembled page.
- 10: 1. Verify both disclosures and focused links clear the mobile bar. 2. Check long translations at 320px. 3. Verify footer links in the assembled page.

## Checks and gaps
- `check-sections.js ... --ssot`: failed, 77 errors / 32 warnings; token build passed; i18n failed with 8 invalid bindings/keys.
- `build.js --check`: passed. `export-page.js ... --out /private/tmp/gjh-review-1230`: passed; 10 sections, 15 images, 0 missing references.
- UNVERIFIED: browser/device screenshots, actual contrast and loading, anchors and links in deployed routing, preference matrix, keyboard, overflow, reduced motion, offline/update, and real iPhone/Safari. No browser evidence was obtained in this review.

## Summary verification — request #1230

- Direction and all nine neighboring handoffs remain recorded in `direction.md` and `decisions.md`. All ten section owners report their rebuilds; that is not evidence of an accepted assembled page.
- `node ../../design-system/build.js --check`: PASS, token outputs in sync.
- `node ../../tools/export-page.js . --out /private/tmp/gjh-summary-1230`: PASS, 10 sections, 15 copied images, zero missing images and zero unresolved asset references. This does not verify the mall destination or rendered behavior.
- `node ../../tools/check-sections.js . --ssot`: FAIL. Legacy supplemental styles for sections 01–05 remain included, including raw duration, color, font size and stacking findings; section 02 also has a spacing warning. Integration owner must reconcile these files and recheck the actual export.
- `node ../../tools/i18n-extract.js . --check`: FAIL. `en.json`, `zh-Hans.json`, and `ms.json` catalogs are missing. The previously reported invalid 02/08 bindings were corrected according to their owners; catalog coverage and language switching remain unverified.
- 08 / integration owner: `../v11/` reportedly returns 404 from the preview route; preserve the brief's destination and fix its deployment mapping, then verify the actual link.
- Accessibility lens: source has one hero h1 and native controls; keyboard, focus clearance, 320px reflow, target dimensions and fixed-bar overlap remain unverified in the assembled page.
- Localization lens: missing catalogs block acceptance; test all supported languages, long labels and preferences after integration.
- Motion/performance lens: image copying is verified; reduced motion, loading stability, network requests and reveal behavior remain unverified. Agent 05 reports an isolated desktop Chrome check with both images decoded and forest-gold text/button contrast passing; the assembled page still needs retesting after integration.
- Visual and color review: no assembled browser screenshots were inspected in this summary. Verify 320px, 393×844 and desktop, image crops, both themes, fixed controls and neighboring handoffs. Offline/update behavior and real iPhone/Safari remain unverified.
- Release status: not ready for acceptance. The integration owner must resolve supplemental CSS, catalogs and mall routing, then rerun checks and the browser matrix. These files are outside the manager's permitted channel-turn editing lane.
