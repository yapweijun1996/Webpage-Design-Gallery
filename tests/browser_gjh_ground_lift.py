"""Capture the west landing approach against a served baseline or candidate checkout."""
import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


def capture(origin, stage, output):
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ["GALLERY_CHROME"], headless=False)
        page = browser.new_page(viewport={"width": 393, "height": 700}, has_touch=True,
                                is_mobile=True, device_scale_factor=2, reduced_motion="no-preference", service_workers="block")
        page.add_init_script("""localStorage.setItem('gjh-v11-graphics-quality-v1','low');
                                localStorage.setItem('gjh-v11-tutorial-v1','dismissed');""")
        page.goto(origin.rstrip("/") + "/demos/corporate/gjh/v11/?test=1", wait_until="domcontentloaded")
        page.locator("#arrival-walk").tap()
        page.wait_for_function("window.__mall?.ready && window.__sceneReady && document.querySelector('#app-loader').hidden",
                               timeout=150000)
        page.locator("#scene").focus()
        assert page.evaluate('__mall.teleport("atrium")')
        rows = []
        for distance in (6, 3.2, 1.5):
            page.evaluate("x => __mall.testWalkTo(x,10)", -5.27-distance)
            page.evaluate("__mall.testFaceTo(-3,10)")
            state = page.evaluate("__mall.step(50)")
            assert state["graphics"]["quality"]["tier"] == "low"
            rows.append({key: state[key] for key in ("x", "z", "nearby", "drawCalls", "renderTriangles", "elevatorModel")})
            page.screenshot(path=output / f"chrome-{stage}-{distance}m.png")
            if stage == "after":
                assert state["elevatorModel"]["status"] == "loaded", rows[-1]
                assert 0 < state["drawCalls"] <= 70 and 0 < state["renderTriangles"] <= 220000, rows[-1]
        assert page.evaluate('__mall.teleport("newmoon")')
        page.evaluate("__mall.testWalkTo(-6.4,10)")
        state = page.evaluate("__mall.step(50)")
        assert state["nearby"] == "visitor-elevator"
        assert "Ride" in page.locator("#inspect").inner_text()
        page.locator("#inspect").click()
        state = page.evaluate("__mall.step(5000)")
        assert state["zone"] == "upper" and abs(state["y"]-7.2) < .1 and not state["elevatorTravel"]
        (output / f"chrome-{stage}.json").write_text(json.dumps(rows, indent=2) + "\n")
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("origin", help="Origin serving the checkout being measured")
    parser.add_argument("stage", choices=("before", "after"))
    args = parser.parse_args()
    capture(args.origin, args.stage, Path(__file__).resolve().parents[1] / "docs/evidence/gjh-v11-lift-fix")
