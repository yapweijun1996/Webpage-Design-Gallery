"""Check early-entry cabinet visibility and 24 camera poses per GJH v11 shop."""
import argparse
import base64
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

from gjh_startup_test_helpers import mall_entry_url

ROOT = Path(__file__).resolve().parents[1]
V11 = ROOT / "demos/corporate/gjh/v11"
DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROBE_URL = "../../../../tests/gjh_interior_visibility.mjs"
WORLD_OBSERVER = """
const buildVisibilityWorld = createWorld;
createWorld = async (...args) => {
  const world = await buildVisibilityWorld(...args);
  window.__visibilityWorld = world;
  return world;
};
"""
PRODUCT_OBSERVER = """
const buildVisibilityProducts = addProducts;
addProducts = async (T, scene, ...args) => {
  const first = scene.children.length;
  const display = await buildVisibilityProducts(T, scene, ...args);
  window.__visibilityProducts = scene.children.slice(first);
  return display;
};
"""


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8831/demos/corporate/gjh/v11/")
    parser.add_argument("--output", type=Path, help="Directory for screenshots and the JSON report")
    args = parser.parse_args()
    executable = os.environ.get("GALLERY_CHROME", DEFAULT_CHROME)
    if executable == "Google Chrome":
        executable = DEFAULT_CHROME
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=executable, headless=False,
            args=["--use-angle=" + os.environ.get("GALLERY_WEBGL_BACKEND", "metal"), "--ignore-gpu-blocklist"],
        )
        page = browser.new_page(viewport={"width": 1920, "height": 900}, service_workers="block")
        page.add_init_script("localStorage.setItem('gjh-v11-graphics-quality-v1', 'balanced')")
        for filename, script in (("world.bundle.js", WORLD_OBSERVER), ("products.js", PRODUCT_OBSERVER)):
            source = (V11 / "assets" / filename).read_text() + "\n" + script
            page.route("**/assets/" + filename, lambda route, body=source:
                       route.fulfill(content_type="text/javascript", body=body))
        page.goto(mall_entry_url(args.url), wait_until="domcontentloaded")
        page.locator("#loader-enter-now").click(timeout=45000)
        page.locator("#app-loader").wait_for(state="hidden", timeout=45000)
        page.wait_for_function("window.__sceneReady && window.__mall?.ready", timeout=45000)
        if page.locator("#guide-card").is_visible():
            page.locator("#guide-skip").click()
        page.wait_for_function("__mall.mode === 'explore'")
        early = page.evaluate(
            "async ([url, screenshots]) => (await import(url)).checkNewMoonEarlyEntry(screenshots)",
            [PROBE_URL, bool(args.output)],
        )
        if args.output:
            args.output.mkdir(parents=True, exist_ok=True)
            for pose in early["poses"]:
                encoded = pose.pop("screenshot").split(",", 1)[1]
                (args.output / f"new-moon-{pose['name']}.png").write_bytes(base64.b64decode(encoded))
        print(json.dumps({"earlyEntry": early}), flush=True)

        page.wait_for_function("""() => {
          const report = __mall.performanceReport();
          return report.interiors.tier === 'balanced' && report.interiors.preinstalled.shops === 17 &&
            __mall.state.modelPreload?.settled === __mall.state.modelPreload?.total &&
            report.warm.background !== 'running';
        }""", timeout=120000)
        sweep = page.evaluate(
            "async url => (await import(url)).sweepInteriorVisibility()", PROBE_URL)
        report = {"earlyEntry": early, "sweep": sweep}
        print(json.dumps(sweep, indent=2))
        if args.output:
            (args.output / "visibility.json").write_text(json.dumps(report, indent=2) + "\n")
        assert early["tier"] == "balanced" and early["warm"]["reason"] == "enter-now", early
        assert early["warm"]["background"] == "running", early
        assert early["poses"][1]["position"][2] < -8, early
        assert all(pose["expected"] == 5 and not pose["misses"] for pose in early["poses"]), early
        assert len(sweep["stores"]) == 17 and all(shop["poses"] == 24 for shop in sweep["stores"]), sweep
        assert not sweep["misses"] and not sweep["badBounds"], sweep
        browser.close()


if __name__ == "__main__":
    run()
