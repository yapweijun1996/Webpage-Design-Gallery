"""Exercise the pinned visitor, real mall poses, animation blends and failure directory."""

import argparse
import functools
import hashlib
import http.server
import importlib.util
import json
import math
import os
import re
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright
from browser_gjh_v11 import ARGS, QuietHandler, drive, state, targets

ROOT = Path(__file__).resolve().parents[1]
MODEL = "gjh-mall-visitor.glb"
ASSET = "demos/corporate/gjh/v11/assets/" + MODEL
VIEWPORTS = ((1440, 900), (768, 1024), (390, 844))


def verify_module(browser, base):
    """Replay observed contact drops against the real module and loaded GLB.

    This isolates presentation from Rapier without mocking the asset or mixer;
    the full mall cases below retain their original end-to-end assertions.
    """
    context = browser.new_context(service_workers="block", reduced_motion="no-preference")
    try:
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base + "/Webpage-Design-Gallery/version.json")
        result = page.evaluate("""async base => {
          const T = await import(base + '/vendor/three.module.min.js');
          const {createCharacter} = await import(base + '/assets/character.js');
          const character = await createCharacter(T);
          const dt = 1 / 60;
          const records = [];
          function check(condition, message) { if (!condition) throw Error(message); }
          function sample(label) {
            const row = {label, animation: character.animation, weights: {...character.state.weights}};
            const values = Object.values(row.weights);
            check(values.every(v => Number.isFinite(v) && v >= 0 && v <= 1), label + ': invalid weights');
            check(Math.abs(values.reduce((a,b) => a+b,0) - 1) < .005, label + ': unnormalized weights');
            records.push(row);
            return row;
          }
          function pose() {
            const values = [];
            character.visual.traverse(object => values.push(...object.position.toArray(), ...object.quaternion.toArray()));
            return values;
          }
          function changed(before) {
            return pose().some((value, index) => Math.abs(value - before[index]) > 1e-5);
          }
          // Holding against an obstacle from rest must never invent locomotion.
          for (let tick=0; tick<10; tick++) character.update('idle', dt, 'walk');
          check(sample('held-at-rest').animation === 'idle', 'Blocked rest invented walking');
          const beforeWalk = pose();
          // Recorded baseline/current Rapier trace: ticks 8, 19 and 33 returned
          // zero corrected motion despite held input on the clear rear aisle.
          for (let tick=0; tick<36; tick++) {
            character.update([8,19,33].includes(tick) ? 'idle' : 'walk', dt, 'walk');
            check(character.animation === 'walk', 'Single contact drop interrupted walking at ' + tick);
            sample('walk-' + tick);
          }
          check(changed(beforeWalk), 'Real walk clip did not change any node transform');
          check(character.state.weights.walk > .95, 'Walk failed to settle under observed contact trace');
          // Requested pace still responds during a brief zero-motion tick.
          character.update('idle', dt, 'run');
          check(sample('pace-change-on-contact-drop').animation === 'run', 'Pace change was lost');
          check(character.state.weights.walk > .005 && character.state.weights.run > .005,
                'Walk-to-run snapped instead of blending');
          const beforeRun = pose();
          for (let tick=0; tick<24; tick++) character.update('run', dt, 'run');
          check(sample('running').weights.run > .95, 'Run failed to settle');
          check(changed(beforeRun), 'Real sprint clip did not change any node transform');
          // Release changes the target immediately; weights still cross-fade.
          character.update('idle', dt, 'idle');
          check(sample('released').animation === 'idle', 'Release retained locomotion target');
          for (let tick=0; tick<30; tick++) character.update('idle', dt, 'idle');
          check(sample('released-settled').weights.idle > .95, 'Released idle failed to settle');
          character.update('walk', dt, 'walk');
          for (let tick=1; tick<=4; tick++) {
            character.update('idle', dt, 'walk');
            const row = sample('sustained-block-' + tick);
            if (tick <= 3) check(row.animation === 'walk', 'Grace expired before 50ms');
            if (tick === 4) check(row.animation === 'idle', 'Block grace exceeded four fixed ticks');
          }
          for (let tick=0; tick<30; tick++) character.update('idle', dt, 'walk');
          check(sample('blocked-settled').weights.idle > .95, 'Held wall retained walk weights');
          character.visual.traverse(object => {
            object.geometry?.dispose();
            for (const material of (Array.isArray(object.material) ? object.material : [object.material])) material?.dispose();
          });
          return {case:'actual-character-module', passed:true, records,
                  actualWalkAndSprintTransformsChanged:true, model:character.state.model};
        }""", base + "/Webpage-Design-Gallery/demos/corporate/gjh/v11")
        assert not errors, errors
        return result
    finally:
        context.close()


def weights(snapshot, dominant=None, blended=False):
    values = snapshot["character"]["weights"]
    assert set(values) == {"idle", "walk", "run"}, values
    assert all(math.isfinite(v) and 0 <= v <= 1 for v in values.values()), values
    assert abs(sum(values.values()) - 1) < .005, values
    if dominant:
        assert values[dominant] > .95, values
    if blended:
        assert sum(.005 < value < .995 for value in values.values()) >= 2, values
    return values


def verify(browser, url, base, viewport, directory, missing=False, reduced=False):
    width, height = viewport
    context = browser.new_context(viewport={"width": width, "height": height},
                                  device_scale_factor=2, has_touch=width < 1000,
                                  reduced_motion="reduce" if reduced else "no-preference",
                                  service_workers="block")
    if missing:
        context.route("**/assets/" + MODEL, lambda route: route.fulfill(status=404, body="Model unavailable"))
    try:
        page = context.new_page()
        errors, external, requests = [], [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url) if request.url.endswith("/" + MODEL) else None)
        page.on("request", lambda request: external.append(request.url) if request.url.startswith("http") and not request.url.startswith(base + "/") else None)
        label = "missing" if missing else "reduced" if reduced else "loaded"
        result = {"width": width, "case": label, "poses": {}, "transitions": {}}
        with page.expect_response(lambda response: response.url.endswith("/" + MODEL)) as response_info:
            page.goto(url, wait_until="domcontentloaded")
        response = response_info.value
        if missing:
            assert response.status == 404
            page.locator("#fallback-message").wait_for(state="visible", timeout=60000)
            assert page.locator("#store-list").is_visible()
            assert not page.locator("#view-toggle").is_visible()
            assert page.locator(".product-card").count() == 4
            for link in page.locator(".directory-nav a").all():
                target = link.get_attribute("href")
                assert target.startswith("#"), target
                link.click()
                assert page.locator(target).is_visible()
            page.locator(".product-inspect").first.click()
            assert page.locator("#product-dialog").is_visible()
            page.keyboard.press("Escape")
            assert not page.locator("#product-dialog").is_visible()
            result["directoryAndProductFallback"] = "PASS"
            page.screenshot(path=str(directory / f"missing-{width}.png"), scale="css")
        else:
            assert response.ok, response.status
            raw = response.body()
            assert raw[:4] == b"glTF"
            assert hashlib.sha256(raw).hexdigest() == hashlib.sha256((ROOT / ASSET).read_bytes()).hexdigest()
            result["servedSha256"] = hashlib.sha256(raw).hexdigest()
            page.wait_for_function("window.__mall?.ready && window.__sceneReady", timeout=60000)
            # Complete the genuine first-use flow before existing walking/asset assertions.
            page.locator("#guide-dialog").wait_for(state="visible")
            page.locator("#guide-start").click()
            page.wait_for_function("!document.querySelector('#guide-dialog').open && document.activeElement.id === 'scene'")
            page.evaluate("__mall.setInput({}); __mall.teleport('atrium')")
            initial = drive(page, 400, yaw=0)
            character = initial["character"]
            assert character["model"] == "gjh-mall-visitor" and character["asset"] == "assets/" + MODEL
            assert 1.60 <= character["nativeHeight"] <= 1.85 and character["scale"] == 1, character
            assert character["clips"] == {"idle": "idle", "walk": "walk", "run": "sprint"}, character
            assert page.evaluate("Object.isFrozen(__mall.state.character) && Object.isFrozen(__mall.state.character.clips) && Object.isFrozen(__mall.state.character.weights)")
            weights(initial, "idle")
            targets(page)
            result["character"] = character
            for pose, yaw in (("idle-back", 0), ("idle-side", math.pi / 2), ("idle-front", math.pi)):
                shot = drive(page, 400, yaw=yaw)
                assert shot["animation"] == "idle", shot
                assert abs(shot["x"] - initial["x"]) < .02 and abs(shot["z"] - initial["z"]) < .02
                assert 0 < shot["drawCalls"] <= 200, shot
                page.screenshot(path=str(directory / f"{label}-{pose}-{width}.png"), scale="css")
                result["poses"][pose] = {"yaw": shot["yaw"], "drawCalls": shot["drawCalls"]}
            # Read weights after one fixed simulation step: transitions must
            # blend, not instantly snap to the requested action.
            page.evaluate("__mall.teleport('atrium')")
            drive(page, 400, yaw=0)
            # The rear aisle at x=-2, z=12..16 avoids the central court at
            # (0, 7.5), side seating at x=+/-7.8 and the terrace at x=-11.
            # Probe locomotion on a clear path rather than against furniture.
            entering = drive(page, 17, forward=-1, yaw=0)
            assert entering["animation"] == "walk", entering
            result["transitions"]["idleToWalk"] = weights(entering, blended=True)
            walked = drive(page, 400, forward=-1, yaw=0)
            assert walked["z"] > initial["z"] + .5, walked
            weights(walked, "walk")
            page.screenshot(path=str(directory / f"{label}-walk-{width}.png"), scale="css")
            entering_run = drive(page, 17, forward=-1, run=True, yaw=0)
            assert entering_run["animation"] == "run", entering_run
            result["transitions"]["walkToRun"] = weights(entering_run, blended=True)
            ran = drive(page, 400, forward=-1, run=True, yaw=0)
            assert ran["z"] - walked["z"] > walked["z"] - entering["z"], (walked, ran)
            weights(ran, "run")
            page.screenshot(path=str(directory / f"{label}-run-{width}.png"), scale="css")
            stopping = drive(page, 17)
            assert stopping["animation"] == "idle", stopping
            result["transitions"]["runToIdle"] = weights(stopping, blended=True)
            weights(drive(page, 500), "idle")
            result["motion"] = {"walkZ": walked["z"], "runZ": ran["z"]}
            page.locator("#view-toggle").click()
            assert page.locator("#store-list").is_visible()
            page.locator("#view-toggle").click()
            assert page.locator("#scene").is_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        assert len(requests) == 1, requests
        assert not errors, errors
        assert not external, external
        result.update({"pageErrors": errors, "externalRequests": external, "modelRequests": len(requests), "passed": True})
        return result
    finally:
        context.close()


def run(output, case):
    spec = importlib.util.spec_from_file_location("gallery", ROOT / "scripts/build_gallery.py")
    gallery = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gallery)
    directory = Path(output) if output else Path(tempfile.mkdtemp(prefix="gjh-character-review-"))
    directory.mkdir(parents=True, exist_ok=True)
    results = []
    with tempfile.TemporaryDirectory(prefix="gjh-character-artifact-") as temporary:
        artifact = Path(temporary) / "Webpage-Design-Gallery"
        gallery.build(artifact)
        precache = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", (artifact / "sw.js").read_text(), re.S).group(1))
        assert ASSET not in {entry["path"] for entry in precache}
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=temporary))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ["GALLERY_CHROME"], args=ARGS)
                try:
                    if case in ("all", "module"):
                        result = verify_module(browser, base)
                        results.append(result)
                        (directory / "results.json").write_text(json.dumps({"browser": browser.version, "results": results}, indent=2) + "\n")
                        print(json.dumps(result), flush=True)
                    cases = [(viewport, False, False) for viewport in VIEWPORTS] if case in ("all", "loaded") else []
                    if case in ("all", "missing"):
                        cases.append(((390, 844), True, False))
                    if case in ("all", "reduced"):
                        cases.append(((390, 844), False, True))
                    for viewport, missing, reduced in cases:
                        result = verify(browser, base + "/Webpage-Design-Gallery/demos/corporate/gjh/v11/", base,
                                        viewport, directory, missing, reduced)
                        results.append(result)
                        (directory / "results.json").write_text(json.dumps({
                            "browser": browser.version, "environment": "Local Chrome/SwiftShader; manual-step GPU fence; DPR2",
                            "release": json.loads((artifact / "version.json").read_text()),
                            "limitations": "Screenshots require human reference review; not physical-device performance or all-camera coverage.",
                            "modelNotPrecached": True, "results": results,
                        }, indent=2) + "\n")
                        print(json.dumps(result), flush=True)
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
    print(f"Character evidence and screenshots: {directory}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="Evidence directory (defaults to a new temporary directory)")
    parser.add_argument("--case", choices=("all", "loaded", "missing", "reduced", "module"), default="all")
    options = parser.parse_args()
    run(options.output, options.case)
