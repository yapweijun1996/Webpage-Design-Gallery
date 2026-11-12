"""Verify original V11 furnishings, instance reuse and independent model fallbacks."""

import argparse
import collections
import functools
import http.server
import importlib.util
import json
import os
import re
import tempfile
import threading
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright
from browser_gjh_v11 import ARGS, QuietHandler, state, targets

ROOT = Path(__file__).resolve().parents[1]
MODELS = {"bench": "gjh-lounge-bench.glb", "planter": "gjh-areca-planter.glb"}
VIEWPORTS = ((1440, 900), (768, 1024), (390, 844))


def verify_case(browser, url, base, viewport, screenshots, failed_model=None, failure=None):
    width, height = viewport
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        has_touch=width < 1000,
        service_workers="block",
    )
    filename = MODELS.get(failed_model)
    if failure == "missing":
        context.route("**/assets/" + filename, lambda route: route.fulfill(status=404, body="Model unavailable"))
    elif failure == "aborted":
        context.route("**/assets/" + filename, lambda route: route.abort())
    try:
        page = context.new_page()
        errors, external = [], []
        requests = collections.Counter()
        page.on("pageerror", lambda error: errors.append(str(error)))

        def observe_request(request):
            name = Path(urlsplit(request.url).path).name
            if name in MODELS.values():
                requests[name] += 1
            if request.url.startswith("http") and not request.url.startswith(base + "/"):
                external.append(request.url)

        page.on("request", observe_request)
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_function("window.__mall?.ready && window.__sceneReady", timeout=60000)
        page.evaluate("__mall.setInput({}); __mall.step(17)")
        initial = state(page)
        furnishings = initial["furnishings"]
        assert set(furnishings) == set(MODELS), furnishings
        assert page.evaluate("Object.isFrozen(__mall.state.furnishings) && Object.values(__mall.state.furnishings).every(Object.isFrozen)")
        for key, model in MODELS.items():
            expected = "fallback" if key == failed_model else "loaded"
            assert furnishings[key]["status"] == expected, furnishings
            assert furnishings[key]["instances"] > 1, furnishings
            if expected == "loaded":
                assert furnishings[key]["primitives"] > 0, furnishings
                assert furnishings[key]["reason"] is None, furnishings
            else:
                assert furnishings[key]["reason"] == "unavailable", furnishings
            assert requests[model] == 1, requests
        calls = {"atrium": initial["drawCalls"]}
        assert 0 < initial["drawCalls"] <= 200, initial
        targets(page)
        label = f"{failure}-{failed_model}" if failure else "loaded"
        page.screenshot(path=str(screenshots / f"{label}-{width}.png"), scale="css")
        for room in ("newmoon", "mili", "gogo"):
            page.evaluate("room => { __mall.teleport(room); __mall.step(17); }", room)
            calls[room] = state(page)["drawCalls"]
        assert all(0 < count <= 200 for count in calls.values()), calls
        # Network failure is decorative degradation, never loss of the directory.
        page.locator("#view-toggle").click()
        assert page.locator("#store-list").is_visible()
        assert page.locator(".product-card").count() == 4
        directory_link = page.locator(".directory-nav a").last
        target = directory_link.get_attribute("href")
        assert target.startswith("#"), target
        directory_link.click()
        assert page.locator(target).is_visible()
        page.locator("#view-toggle").click()
        assert page.locator("#scene").is_visible()
        assert page.evaluate("__mall.ready")
        assert all(requests[model] == 1 for model in MODELS.values()), requests
        assert not errors, errors
        assert not external, external
        return {
            "width": width,
            "failure": failure,
            "failedModel": failed_model,
            "furnishings": furnishings,
            "modelRequests": dict(requests),
            "drawCallsByView": calls,
            "listNavigation": "PASS",
            "readyAfterFallback": "PASS" if failure else "N/A",
            "pageErrors": errors,
            "externalRequests": external,
        }
    finally:
        context.close()


def run(case):
    spec = importlib.util.spec_from_file_location("gallery", ROOT / "scripts/build_gallery.py")
    gallery = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gallery)
    screenshots = Path(tempfile.mkdtemp(prefix="gjh-furnishings-review-"))
    evidence = ROOT / "docs/evidence/gjh-furnishings-browser.json"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    results = []
    with tempfile.TemporaryDirectory(prefix="gjh-furnishings-artifact-") as temporary:
        artifact = Path(temporary) / "Webpage-Design-Gallery"
        gallery.build(artifact)
        release = json.loads((artifact / "version.json").read_text())
        worker = (artifact / "sw.js").read_text()
        precache = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", worker, re.S).group(1))
        cached = {entry["path"] for entry in precache}
        assert all("demos/corporate/gjh/v11/assets/" + name not in cached for name in MODELS.values())
        server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(QuietHandler, directory=temporary)
        )
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}"
        url = base + "/Webpage-Design-Gallery/demos/corporate/gjh/v11/"
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ["GALLERY_CHROME"], args=ARGS)
                try:
                    cases = [(viewport, None, None) for viewport in VIEWPORTS] if case in ("all", "loaded") else []
                    for failure in ("missing", "aborted"):
                        if case in ("all", failure):
                            cases.extend([((390, 844), key, failure) for key in MODELS])
                    for viewport, failed_model, failure in cases:
                        result = verify_case(browser, url, base, viewport, screenshots, failed_model, failure)
                        results.append(result)
                        evidence.write_text(json.dumps({
                            "release": release,
                            "browser": browser.version,
                            "case": case,
                            "environment": "Local Chrome/SwiftShader; physical mobile performance not measured",
                            "offlineModelsExcluded": "PASS",
                            "results": results,
                        }, indent=2) + "\n")
                        print(json.dumps(result), flush=True)
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
    print(f"Furnishings evidence: {evidence}")
    print(f"Review screenshots: {screenshots}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=("all", "loaded", "missing", "aborted"), default="all")
    run(parser.parse_args().case)
