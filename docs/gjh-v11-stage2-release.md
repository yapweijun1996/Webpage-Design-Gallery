# GJH V11 stage 2: integration with current main

Date: 15 November 2026 (Asia/Singapore)
Status: **verified local release candidate**. GitHub’s `main` advanced beyond the earlier three-store pilot snapshot. The first integration started at `a24ec37b11c2af3c75ba6372cc36fff5d36580a7`; it was subsequently rebased onto `bb203e5f74fbe5da814a5abd1247543d06bad496`, preserving the later directory hierarchy and the visitor, camera, HUD and product-preview changes. Publication or deployment is not implied by this pre-push report.

## Integration

The existing three-store records in `assets/spatial.js` now drive current storefront centers/signs, player arrivals and zone lookup, schematic map positions/labels and live directory labels. Static directory HTML remains readable without JavaScript, and existing store/product IDs remain unchanged. Unknown, unavailable and in-progress-elevator travel requests cannot announce a false arrival; the header tracks the current 3D location and directory view. The [pilot report](gjh-v11-stage2-spatial-pilot.md) explains the model and the earlier snapshot; the proposed 17-store geometry remains a separate [stage 1 plan](gjh-v11-stage1-spatial-plan.md).

The newer base already uses the short **Stores** label at compact widths and has its own collision-safe route in the V2 mode test. The separate eight-seat suite uses the stage 0 alternative route. The gamepad test yields to neutral input and walks clear of the interaction HUD before completing the tutorial; no physical-controller claim is made. The first-use guide test was updated to follow the current Appearance/Close focus order and expanded touch/keyboard controls.

Two stale/pre-existing failures were independently reproduced on unchanged base `a24ec37`: the modes fixture approached the Australia shelf outside its newer pickup radius, and the compact Help target measured 36 × 44 px. The fixture now walks to the existing shelf's actual pickup approach; the Help summary has a 44 px minimum width. No product-reach or collision assertion was weakened. [Control modes failure](evidence/gjh-stage2-release/control-modes.log), [control Help failure](evidence/gjh-stage2-release/control-v11.log).

The stage 0 runtime archive was repacked for publication without macOS extended metadata. Its 142 manifest-listed file hashes were reverified; the original baseline source measurements and observations remain historical. User work in the original dirty checkout was not reset or replaced by this integration.

## Latest-base recheck

After the first integration was tested, main advanced with directory hierarchy changes. The candidate retained those changes and was retested against `bb203e5`: [three-store spatial browser](evidence/gjh-stage2-release/latest-browser_gjh_spatial.log), [five-width header](evidence/gjh-stage2-release/latest-browser_gjh_header_bounds.log), [hybrid directory](evidence/gjh-stage2-release/latest-browser_gjh_hybrid.log), [full V2 lifecycle](evidence/gjh-stage2-release/latest-modes.log) ([data](evidence/gjh-stage2-release/latest-modes.json)), [Node tests](evidence/gjh-stage2-release/latest-node.log), [gallery unit tests](evidence/gjh-stage2-release/latest-gallery-unit.log), [gallery browser](evidence/gjh-stage2-release/latest-browser_gallery.log), [28 older-demo cases](evidence/gjh-stage2-release/latest-browser_gjh_demos.log) and [PWA in a separate fresh copy](evidence/gjh-stage2-release/latest-clean-pwa.log). The [latest source manifest](evidence/gjh-stage2-release/latest-source-manifest.json) records the final V11 runtime and selected checks. The screenshots below were refreshed after that rebase. The following section preserves the earlier `a24ec37` integration evidence, with timing boundaries stated explicitly.

## Verification

The first integration used local Chrome 157 on macOS with requested ANGLE Metal unless the real-input suite selected Chrome's default GPU backend. Screenshot-writing tests ran in the isolated release worktree; their incidental gallery and older-demo screenshots were restored there, and generated gallery files were rebuilt from the intended source. The [first-integration source manifest](evidence/gjh-stage2-release/source-manifest.json) pins its 150 runtime and relevant test files.

- Spatial Node tests and mode tests: 17/17 passed; gallery unit tests: 11/11 passed; `scripts/build_gallery.py --check` passed.
- [Three-store browser parity](evidence/gjh-stage2-release/final-browser_gjh_spatial.log): 1440 and 390px V2, 390px v1, all store map/door/directory/detail paths, rejected in-flight lift/unknown destinations and no-JavaScript/failed-physics fallback.
- [Header bounds](evidence/gjh-stage2-release/final-browser_gjh_header_bounds.log): 320, 390, 639, 768 and 1440px including focus outline, labels, hit points and directory round trip.
- [V2 mode lifecycle](evidence/gjh-stage2-release/modes-final.log): 390×844, 768×1024 and 1440×900; [machine-readable results](evidence/gjh-stage2-release/modes-final.json). [Eight-seat animation/interruption suite](evidence/gjh-stage2-release/all-seats.log) also passed.
- [Real keyboard and CDP touch input](evidence/gjh-stage2-release/real-input.json): 15 checks passed with normal motion and no recorded page/console errors. After the Help-width change, the [320/768 scene-tool layout checks](evidence/gjh-stage2-release/layout-after.json) also passed. The full 15-check run preceded that CSS-only change.
- [Guide](evidence/gjh-stage2-release/browser_gjh_guide.log) and synthetic gamepad onboarding ([run 1](evidence/gjh-stage2-release/browser_gjh_onboarding.log), [2](evidence/gjh-stage2-release/onboarding-2.log), [3](evidence/gjh-stage2-release/onboarding-3.log)) passed. The guide/gamepad and seat runs preceded the Help-width-only CSS adjustment.
- [Legacy v1 mall browser suite](evidence/gjh-stage2-release/v11-final.log) passed after the Help-width fix. [Gallery](evidence/gjh-stage2-release/browser_gallery.log), [28 legacy-demo cases](evidence/gjh-stage2-release/browser_gjh_demos.log) and [PWA lifecycle](evidence/gjh-stage2-release/browser_pwa-final.log) passed; the PWA run was repeated after restoring test-created thumbnails. No axe bundle was supplied for the legacy-demo runner.

Integrated views: [390px map](evidence/gjh-stage2-release/screens/map-390.png), [1440px map](evidence/gjh-stage2-release/screens/map-1440.png), [390px directory](evidence/gjh-stage2-release/screens/directory-390.png), [1440px directory](evidence/gjh-stage2-release/screens/directory-1440.png). The actual scene remains the existing three-store mall.

Physical phones, controllers, Safari, screen readers and field performance were not tested. Stage 3 remains the separate expanded-shell implementation; this release does not add 17 storefronts or seasonal themes.
