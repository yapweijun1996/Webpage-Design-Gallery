# Mall amenities advisor review

## Scope and evidence

Reviewed the service desk, two ceiling signs and glass showcase against actual 1440/768/390 screenshots and the shared component contracts. The independent `ui_advisor` inspected screenshots and source, returned findings without editing, then reviewed the implemented result. Baseline captures are in `ui/mall-amenities-advisor/before`; actual updated captures are in `ui/mall-amenities-advisor/after`.

Tasks: identify the three facilities; open their contextual actions; choose a store; select a showcased product and add it to the bag; dismiss and resume; complete the same actions in the directory and on a short screen.

## Findings and fixes

| Priority | Evidence and effect | Fix and acceptance |
| --- | --- | --- |
| P2, common, small | The first action became primary automatically, visually recommending New Moon or the first product without a product reason. | Shared action dialogs default to equal peer choices. Hosts explicitly opt into `primary`. All store/product choices have the same weight. |
| P2, mobile, small | The standalone Help button overlapped the existing How to explore disclosure. | The mall retains its existing disclosure/replay control and hides only the redundant standalone shared Help entry. Tutorial Help and the shared component's default behavior remain available. |
| P2, common, small | Three small direction lines on a native-size sign were hard to read from the atrium. | Keep physical scale and combine destinations into two larger direction groups, with left/right reversed on the rear. Nearby UI supplies complete destinations. Distant 3D text still has physical perspective limits. |
| P2, mobile, small | Full product SKU strings made four visually similar, multi-line buttons slow to scan. | Show existing official thumbnails, country and weight; retain complete product names as accessible names and in the existing detail inspector. |
| P3, common, small | Generic Inspect and implementation-oriented sign names did not explain the outcome. | Use Get help, Choose a store and View collection, with Store directions as the visible sign name. Accessible names and announcements use the same outcome. |
| P3, short screens, small | Reopen scroll position was not an explicit contract. | Reset dialog scrolling on open; verify internal scroll, sticky close at middle/bottom, visible dismissal, Escape and restored trigger focus. |

The after-review additionally caught a Chinese Label in Name mismatch; accessible names now contain both the localized visible title and complete SKU, supporting voice control without dropping product detail.

The action dialog remains a shared native dialog with theme/locale preferences, one focus trap, 44px controls, safe-area bounds and Reduced Motion. No facility animation loop or new runtime dependency is added. Existing unrelated furniture/interior work is preserved. The fixture walking route was adjusted to approach the signs around the current kiosk and showcase footprints rather than walking through their colliders.

## Verification

Results and limitations are recorded after verification below. These are browser task walkthroughs and automated semantics checks, not observations from recruited users or physical assistive devices.

Verified after the final accessible-name correction: amenity walkthroughs at 1440×900, 768×1024 and 390×844; short 320×480 light/English and 844×390 dark/Chinese panels; sticky Close at top/middle/bottom; Escape/visible close/focus return; reopen at scroll top; equal peer choices; four loaded thumbnails with complete accessible labels; no duplicate standalone Help in the mobile scene; sign navigation; bag integration; collisions and independent model/hash failures. Shared onboarding passed five viewport/input cases and six profiles. Full V11 movement/doors/inspection/fallback, Gallery browser journeys, 28 legacy demo browser cases, 11 Gallery unit tests and PWA lifecycle/installability checks passed. No page errors occurred in the amenity journeys.

The advisor approved the actual after screenshots and front/rear direction logic. The final Label in Name correction has explicit Chinese regression coverage. Tests use native Chrome ANGLE Metal and synthetic touch capability; physical controllers/touch devices, screen-reader sessions and Safari remain unverified. The 320px short-screen case is also a narrow-layout proxy, not a real browser zoom session. No public deployment was performed.
