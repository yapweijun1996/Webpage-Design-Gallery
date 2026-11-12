# V11 keyboard turning — application 1.1.3

Holding Q turns left and E turns right at 110 degrees per second. The camera and visitor turn together; turning alone leaves the capsule position unchanged. Movement and running can be combined with turning. F now inspects a nearby display, avoiding the previous E conflict. Help, canvas instructions, the inspect prompt and live announcements use the same mapping.

The change belongs to the existing player input boundary. It retains walking speeds, collision, dragging, touch controls, model assets and URLs. Released keys, opposing Q/E input, native controls, modifier shortcuts, blur and paused views are covered by real keyboard events. The inspection shortcut is limited to scene/body focus; native buttons retain normal keyboard behavior. The shared DS remains 1.0.0.

## Verification

- PASS: full V11 browser suite at 1440×900, 768×1024 and 390×844, including keyboard turning, F/Escape inspection, collision, doors, touch, focus, reduced motion, hidden tabs and failure fallbacks. Maximum sampled draw calls: 130 / 114 / 101; no runtime errors.
- PASS: 35 Python unit tests, JavaScript syntax, generated-artifact consistency and SSOT checks with no new raw-style debt.
- PASS: gallery browser suite, including navigation, filtering, previews and comparisons.
- PASS: 28 legacy GJH browser cases, four no-JavaScript journeys and asset integrity; PWA offline, installation and update checks. The [release evidence](evidence/gjh-keyboard-release.json) records all command exit codes.

The V11 run used Chrome 157 with native ANGLE Metal (Apple Paravirtual device), DPR 2 and the existing mobile renderer cap of 1.5. Reproduce with `GALLERY_WEBGL_BACKEND=metal python tests/browser_gjh_v11.py` and `GALLERY_CHROME` pointing to Chrome. The test retains SwiftShader as its default and waits for the first frame before capturing it.

The two initial SwiftShader attempts failed before the keyboard assertions: first at screenshot capture, then at the initial GPU-completion fence. The cause of that software-backend stall remains unverified. The native run retained all viewport sizes, quality settings, assertions and deadlines. Physical phones, Safari and screen-reader sessions were not tested.

[Detailed V11 evidence](evidence/gjh-keyboard-v11.json) records all three viewports. Deployment is checked after the verified release is pushed; the final delivery report and authorized project KB record that remote result.
