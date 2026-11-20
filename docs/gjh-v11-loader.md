# GJH v11 startup loader

The full-screen startup surface is present in the HTML before JavaScript runs. It adapts the native progress element from the owner's MIT-licensed `Vanilla-HTML-Loader` project; the adapted implementation and licence are local. `assets/gjh-loader-mark.svg` is a two-colour vector trace of the existing verified corporate PNG recorded in `demos/corporate/gjh/v11/assets/sources.json`; it does not imply endorsement of this independent mall concept.

The loader reports actual initialization stages, not an estimated completion percentage. Individual optional models retain their existing stand-ins when loading fails. Startup errors offer retry and access to the existing store directory; JavaScript-disabled visitors retain the directory fallback. The overlay does not trap focus and respects reduced motion and safe-area insets. It is removed after a rendered frame, not merely after asynchronous initialization.

Startup failures log the original error and stack to the console and publish `window.__mallFailure` with `stage`, `message` and `stack`. The stage names the failed module import or the pending startup milestone. [The load probe](load_probe.py) includes these fields in its JSON output and exits with a failing status.

The mall service worker integrity-checks and precaches the loader resources alongside its offline fallback. This does not make the 3D mall available offline: uncached models and other runtime dependencies still require a connection. Offline navigation continues to show `offline.html`.

Verification: `node --test tests/gjh_*.test.mjs` passed (one unrelated Studio-checkout test skipped); build `--check`, the Python unittest suite and SSOT passed. A focused Chrome run captured stalled-startup frames at 1440 and 390, exercised three failed texture requests and retry, and measured 147 draw calls after recovery. The scoped PWA browser check verified cached loader resources and offline navigation. The single requested browser-suite log is `~/omp-tasks/out/loader-browser.log` (RC=1): its v11 and GJH demo scripts could not start because Pillow was missing in the test environment. Pillow was installed afterward for the focused loader scenario, not a suite rerun. Browser checks are software emulation; physical-device and screen-reader acceptance are not implied.

## Long model preparation

The existing teal and gold card has a small, soft glow behind its crown during the pending model stage. The fixed gradient changes opacity on a ten-second cycle. Progress, status text and model counts still come from actual startup events. The glow uses CSS and adds no resource request or JavaScript animation loop.

The 44 px Pause motion button sits with the loading actions and retains its setting for the tab session, including a Retry reload. Motion stays paused when the page is hidden and stops when the loader is dismissed or fails. Reduced-motion settings suppress the effect and its control. Repeated updates with the same stage and status leave the live region unchanged.

A 22-second Chrome recording at 390 × 844 held seven real model requests. The card remained at 3/5 through two glow cycles. A pixel comparison found no change on the horizontal top edge between the bright and dim frames. Chrome also exercised Pause and Resume, a failed script request and successful Retry, reduced motion and the transition to the rendered scene at desktop and mobile viewport sizes. The hidden-page event and mobile viewport were simulated.

In a separate capture-free comparison before the final gradient-edge adjustment, the 3.6-second animation windows had p95 frame intervals of 17.4 ms at 1440 px and 17.3 ms at 390 px, with no interval of 50 ms or more. Chrome traced a compositor opacity animation starting immediately after Resume, alongside main-thread style updates. This short sample covers startup at the held model stage.
