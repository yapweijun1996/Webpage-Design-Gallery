# Virtual Mall amenities

The mall reuses three owner-project GLBs from Blender-3D-Gallery at commit `9cc4c87b49ac7b5030b36944d80ccf8ddf09f7b1`. Exact source paths, SHA-256 values and byte counts are recorded in `demos/corporate/gjh/v11/assets/amenities-sources.json`. Imported files are unchanged; runtime placement and signage adaptation are mall-owned.

## Scene and interactions

- Guest services sits on the west side of the atrium, with a solid footprint and approachable guest side. Its shared action dialog offers navigation to the three stores, the directory and Help. It is a self-service guide, not a staffed service claim.
- Two ceiling-mounted signs retain the original housing and suspension. Source sample text/icons are replaced at runtime with directions to the actual New Moon, MILI and GOGO storefronts. Back faces reverse left/right directions. No invented floor or destination is displayed.
- The glass showcase sits near New Moon and contains four existing reviewed product-can models. Its shared action dialog opens the existing product inspector and bag flow. The source door animation is retained in the binary but the displayed door remains closed; opening animation is outside this change.

Approach an object and press F or the contextual Inspect button. The HTML directory also exposes all three interactions, including when 3D is unavailable. Store navigation in the directory focuses the actual store heading.

## Shared ownership

`createActionDialog` in `assets/onboarding/action-dialog.js` owns native dialog semantics, localized labels, semantic theme tokens, focus trapping, Escape and focus restoration. The mall supplies object copy and domain callbacks. Theme and locale come from existing onboarding preferences. The host derives pause state from `dialog.open`, avoiding duplicated modal lifecycle state. A selected callback runs after the native close event and focus restoration.

Models load independently with an eight-second deadline, exact-byte/hash verification and structural checks. Missing or rejected models receive lightweight local geometry; interactions remain available. Static geometry is baked and grouped by material, and repeated signs are instanced. The facilities add no animation loop. Physical desk/showcase footprints use the existing Rapier collider adapter; hanging signs do not obstruct walking.

## Verification

`tests/browser_gjh_amenities.py` checks 1440×900, 768×1024 and 390×844 layouts using native Chrome ANGLE Metal. It covers one fetch per GLB, source identity, two sign instances, four displayed products, F/touch inspection, keyboard focus wrapping, Escape, paused movement, Help, store navigation, product/bag integration, physical collisions, directory actions, three independent asset failures and corrupted-byte rejection. Evidence is copied to `docs/evidence/mall-amenities.json`; review screenshots are stored in the sibling `evidence/mall-amenities` directory.

Physical touch/controller devices and screen-reader sessions are not covered by these browser checks. Draw-call assertions bound the tested views to 200 calls; they are not a measured FPS guarantee.

Verification completed on 2026-11-15: amenity scenarios passed at all three sizes (initial view draw calls: 182 / 160 / 144); the full V11 movement/collision/inspection and fallback suite passed; Gallery generation check, 11 Gallery unit tests, Gallery browser journeys, 28 legacy demo browser cases, PWA lifecycle/installability checks, SSOT gate and diff whitespace checks passed. The shared onboarding suite also passed across five viewport/input cases and six profiles.

See [advisor refinement and verification](gjh-amenities-advisor-review.md) for the two-line signs, equal peer choices, visual product rows, outcome-specific prompts and short-screen accessibility checks.
