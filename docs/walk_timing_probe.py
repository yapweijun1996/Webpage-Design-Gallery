"""Measure real keyboard movement in headed Chrome on a locally served checkout.

The default 8 m route runs along the S04/S05 shop frontage, starting at the S04
arrival. Use --key w to test the S04 doorway and report where fixtures stop
forward travel. Run on the base revision and on the movement branch to compare.

Example: python3 docs/walk_timing_probe.py --tier low --output /tmp/walk.json
"""
import argparse
import json
import math
import os
from pathlib import Path
import sys

from mall_lap_probe import DEVICES, INIT, TIERS

SAMPLE = r"""({key, distance, timeout}) => {
  const mall = window.__mall;
  const read = () => {
    if (mall.movementSample) return mall.movementSample();
    const p = mall.state;
    return {x:p.x,z:p.z,frames:p.frames,cameraDistance:p.cameraObstruction?.distance,
      requestedCameraDistance:p.cameraDistance};
  };
  const yaw = mall.state.yaw;
  const forward = {w:1,s:-1}[key] ?? 0, right = {d:1,a:-1}[key] ?? 0;
  const dx = Math.cos(yaw)*right - Math.sin(yaw)*forward;
  const dz = -Math.sin(yaw)*right - Math.cos(yaw)*forward;
  const probe = window.walkTiming = {frames:[],crossingMs:null};
  const onKey = event => {
    if (event.repeat || event.code !== 'Key' + key.toUpperCase()) return;
    window.removeEventListener('keydown', onKey, true);
    const start = performance.now(), origin = read();
    let prior = {...origin, at:start, projected:0};
    function sample() {
      if (!document.hasFocus() || document.hidden) {
        probe.interrupted = probe.done = true;
        return;
      }
      const at = performance.now(), p = read();
      if (p.frames !== prior.frames) {
        const projected = (p.x-origin.x)*dx + (p.z-origin.z)*dz;
        const stepM = Math.hypot(p.x-prior.x, p.z-prior.z);
        const visualStepM = p.visualX === undefined || prior.visualX === undefined ? null
          : Math.hypot(p.visualX-prior.visualX, p.visualZ-prior.visualZ);
        const frameMs = at - prior.at;
        probe.frames.push({elapsedMs:at-start,frameMs,x:p.x,z:p.z,projectedM:projected,stepM,
          visualStepM,speedMps:stepM * 1000 / frameMs,cameraDistanceM:p.cameraDistance,
          requestedCameraDistanceM:p.requestedCameraDistance,collisionTicks:p.collisionTicks === undefined
            ? null : p.collisionTicks - origin.collisionTicks});
        if (projected >= distance) {
          probe.crossingMs = prior.at - start +
            frameMs * (distance-prior.projected) / (projected-prior.projected);
          probe.done = true;
          return;
        }
        prior = {...p, at, projected};
      }
      if (at - start >= timeout) { probe.done = true; return; }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  };
  window.addEventListener('keydown', onKey, true);
}"""


def percentile(values, fraction):
    ordered = sorted(values)
    return ordered[math.ceil(len(ordered) * fraction) - 1] if ordered else None


def summarize(probe, report, args):
    frames = probe["frames"]
    final = frames[-1] if frames else {}
    cruise = [f["speedMps"] for f in frames if f["elapsedMs"] >= 600]
    # On the base revision, the Rapier counter is unavailable. Flat forward
    # progress under held input can still reveal a sustained obstruction.
    stalled = 0
    for previous, current in zip(frames, frames[1:]):
        if current["elapsedMs"] >= 600 and current["projectedM"] - previous["projectedM"] < .001:
            stalled += 1
    camera = [f["cameraDistanceM"] for f in frames if f.get("cameraDistanceM") is not None]
    return {
        "zone": args.zone,
        "key": args.key,
        "run": args.run,
        "tier": report["graphics"]["tier"],
        "device": report.get("deviceClass"),
        "distanceM": args.distance,
        "coveredM": final.get("projectedM"),
        "crossingMs": probe["crossingMs"],
        "cruiseMedianMps": percentile(cruise, .5),
        "p95FrameDisplacementM": percentile([f["stepM"] for f in frames], .95),
        "p95VisualDisplacementM": percentile([f["visualStepM"] for f in frames if f["visualStepM"] is not None], .95),
        "collisionTicks": final.get("collisionTicks"),
        "stalledFrames": stalled,
        "minCameraDistanceM": min(camera, default=None),
        "p50CameraDistanceM": percentile(camera, .5),
        "slowFrames50Ms": sum(f["frameMs"] >= 50 for f in frames),
        "movementPerformance": report.get("movement"),
        "interrupted": probe.get("interrupted", False),
        "frames": frames,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8830/demos/corporate/gjh/v11/")
    parser.add_argument("--zone", default="planned-space-04")
    parser.add_argument("--key", choices="wasd", default="d")
    parser.add_argument("--run", action="store_true", help="Hold Shift together with the movement key")
    parser.add_argument("--tier", choices=[*TIERS, "auto"], default="low")
    parser.add_argument("--device", choices=DEVICES, default="desktop",
                        help="Viewport preset. Move using the keyboard in every preset.")
    parser.add_argument("--distance", type=float, default=8)
    parser.add_argument("--timeout", type=float, default=8, help="Maximum seconds to hold the key")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not all(math.isfinite(n) and n > 0 for n in (args.distance, args.timeout)):
        parser.error("--distance and --timeout must be finite and positive")

    from playwright.sync_api import sync_playwright

    width, height, *_ = DEVICES[args.device]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome" if not os.getenv("GALLERY_CHROME") else None,
                                             executable_path=os.getenv("GALLERY_CHROME"), headless=False,
                                             args=["--use-angle=metal"] if sys.platform == "darwin" else [])
        try:
            page = browser.new_page(viewport={"width": width, "height": height},
                                    has_touch=args.device != "desktop", is_mobile=args.device == "phone")
            page.add_init_script(INIT % args.tier)
            page.goto(args.url, wait_until="domcontentloaded")
            page.locator("#arrival-walk").click()
            page.wait_for_function("window.__sceneReady && __mall.ready && document.querySelector('#app-loader').hidden",
                                   timeout=90_000)
            if not page.evaluate("zone => __mall.teleport(zone)", args.zone):
                raise RuntimeError(f"Unknown arrival: {args.zone}")
            page.locator("#scene").focus()
            page.wait_for_timeout(400)
            page.evaluate(SAMPLE, {"key": args.key, "distance": args.distance, "timeout": args.timeout * 1000})
            if args.run:
                page.keyboard.down("Shift")
            try:
                page.keyboard.down(args.key)
                page.wait_for_function("window.walkTiming?.done", timeout=(args.timeout + 3) * 1000)
            finally:
                page.keyboard.up(args.key)
                if args.run:
                    page.keyboard.up("Shift")
            probe, report = page.evaluate("() => [window.walkTiming, __mall.performanceReport()]")
        finally:
            browser.close()
    result = summarize(probe, report, args)
    if args.output:
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({**result, "frames": len(result["frames"])}, indent=2))
    return 0 if result["crossingMs"] is not None and not result["interrupted"] else 1


if __name__ == "__main__":
    sys.exit(main())
