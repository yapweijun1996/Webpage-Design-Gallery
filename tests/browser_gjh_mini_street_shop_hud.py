"""Check the localized indoor HUD and real touch input on narrow screens."""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
from itertools import combinations
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_language import switch_language
from browser_gjh_mini_street_links import Quiet, ROOT, ROUTE

CASES = {
    "ms": ("Kedai New Moon", "Gunakan kayu bedik untuk berjalan dan seret untuk melihat", "‹ Keluar dari kedai"),
    "en": ("New Moon Shop", "Use the stick to walk and drag to look", "‹ Exit shop"),
    "zh-Hans": ("New Moon 商店", "用摇杆行走，拖动查看四周", "‹ 离开商店"),
}
VIEWPORTS = [(320, 568), (375, 667), (390, 844)]
CONTROLS = (
    ".shop-interior-title", ".shop-interior-exit", ".mini-basket-launcher",
    ".shop-interior-stick", ".shop-interior-inspect",
)


def check_layout(stage, label):
    bounds = stage.bounding_box()
    boxes = {}
    for selector in CONTROLS:
        control = stage.locator(selector)
        expect(control).to_be_visible()
        box = control.bounding_box()
        for start, size in (("x", "width"), ("y", "height")):
            assert bounds[start] <= box[start] < box[start] + box[size] <= bounds[start] + bounds[size], (
                label, selector, box, bounds,
            )
        if selector != ".shop-interior-title":
            assert min(box["width"], box["height"]) >= 44, (label, selector, box)
        boxes[selector] = box

    for (first, a), (second, b) in combinations(boxes.items(), 2):
        overlap_x = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
        overlap_y = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
        assert overlap_x <= 0 or overlap_y <= 0, (label, first, second, overlap_x, overlap_y)


def observe_camera(route):
    response = route.fetch()
    marker = 'camera.rotation.order = "YXZ";'
    source = response.text()
    assert source.count(marker) == 1
    probe = """
window.__shopHudTestPose = () => [camera.position.x, camera.position.z, camera.rotation.y];
window.__shopHudTestAspect = () => camera.aspect;
"""
    route.fulfill(response=response, body=source.replace(marker, marker + probe, 1))


def check_insets_and_text_size(page, stage, evidence):
    session = page.context.new_cdp_session(page)
    insets = {"top": 28, "right": 14, "bottom": 32, "left": 12}
    session.send("Emulation.setSafeAreaInsetsOverride", {"insets": insets})
    enlarged = page.add_style_tag(content=":root { font-size: 200%; }")
    try:
        pad = stage.locator(".shop-interior-controls").evaluate("""element => {
          const css = getComputedStyle(element);
          return {top: parseFloat(css.paddingTop), right: parseFloat(css.paddingRight),
                  bottom: parseFloat(css.paddingBottom), left: parseFloat(css.paddingLeft)};
        }""")
        assert pad == insets, pad
        for lang in CASES:
            switch_language(page, lang)
            check_layout(stage, f"{lang} 200% text size with safe insets")
        if evidence:
            stage.screenshot(path=evidence / "shop-hud-320x568-safe-insets-200pct-text.png", animations="disabled")
    finally:
        enlarged.evaluate("style => style.remove()")
        session.send("Emulation.setSafeAreaInsetsOverride", {"insets": dict.fromkeys(insets, 0)})
        session.detach()


def check_touch_input(page, stage):
    session = page.context.new_cdp_session(page)
    stick = stage.locator(".shop-interior-stick")
    stick.scroll_into_view_if_needed()
    box = stick.bounding_box()
    center = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
    forward = {**center, "y": center["y"] - box["height"] * 0.35}
    pose = page.evaluate("window.__shopHudTestPose()")
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [center]})
    session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [forward]})
    page.wait_for_function("""([x, z]) => {
      const [nextX, nextZ] = window.__shopHudTestPose();
      return Math.hypot(nextX - x, nextZ - z) > 0.12;
    }""", arg=pose)
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    assert stick.locator("span").evaluate("thumb => thumb.style.transform") == ""
    stopped = page.evaluate("window.__shopHudTestPose()")
    page.evaluate("""async () => {
      for (let frame = 0; frame < 4; frame++) await new Promise(requestAnimationFrame);
    }""")
    assert page.evaluate("window.__shopHudTestPose()") == stopped, "The joystick must stop moving on release"

    canvas = stage.locator("#view")
    box = canvas.bounding_box()
    center = {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2}
    assert canvas.evaluate("(canvas, {x, y}) => document.elementFromPoint(x, y) === canvas", center)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [center]})
    session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{**center, "x": center["x"] + 65}]})
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    assert abs(page.evaluate("window.__shopHudTestPose()[2]") - stopped[2]) > 0.1, "Canvas drag must change camera yaw"


def check_resize_fallback(context, url):
    page = context.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded")
        entry = page.locator(".scene-shop-entry")
        expect(entry).to_be_visible(timeout=15000)
        # The street is already initialized. Exercise the shop observer fallback only.
        page.evaluate("window.ResizeObserver = undefined")
        entry.tap()
        expect(page.locator(".shop-interior-controls")).to_be_focused(timeout=15000)
        previous = page.evaluate("window.__shopHudTestAspect()")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_function("""previous => {
          const stage = document.querySelector("#stage").getBoundingClientRect();
          const next = window.__shopHudTestAspect();
          return next !== previous && Math.abs(next - stage.width / stage.height) < 0.001;
        }""", arg=previous)
    finally:
        page.close()


def exercise(browser, url, evidence):
    context = browser.new_context(is_mobile=True, has_touch=True, reduced_motion="reduce",
                                  viewport={"width": VIEWPORTS[0][0], "height": VIEWPORTS[0][1]})
    try:
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        context.route("**/mini-street/shop-interior.js", observe_camera)
        page.goto(url, wait_until="domcontentloaded")
        entry = page.locator(".scene-shop-entry")
        entry.tap(timeout=15000)
        stage = page.locator("#stage")
        hud = stage.locator(".shop-interior-controls")
        expect(hud).to_be_focused(timeout=15000)
        theme_button = page.locator("#mini-theme")
        for width, height in VIEWPORTS:
            page.set_viewport_size({"width": width, "height": height})
            for lang, (title, hint, exit_name) in CASES.items():
                switch_language(page, lang)
                expect(hud.locator(".shop-interior-title")).to_contain_text(title)
                expect(hud.locator(".shop-interior-touch-hint")).to_have_text(hint)
                expect(hud.locator(".shop-interior-keyboard-hint")).to_be_hidden()
                expect(hud.locator(".shop-interior-exit")).to_have_accessible_name(exit_name)
                for theme in ("dark", "light"):
                    html = page.locator("html")
                    if html.get_attribute("data-site-theme") != theme:
                        theme_button.tap()
                    expect(html).to_have_attribute("data-site-theme", theme)
                    label = f"{width}x{height}-{lang}-{theme}"
                    check_layout(stage, label)
                    if evidence:
                        stage.screenshot(path=evidence / f"shop-hud-{label}.png", animations="disabled")

        page.set_viewport_size({"width": 320, "height": 568})
        check_insets_and_text_size(page, stage, evidence)
        switch_language(page, "ms")
        check_touch_input(page, stage)
        basket = stage.locator(".mini-basket-launcher")
        basket.tap()
        expect(page.locator("#mini-basket")).to_be_visible()
        expect(hud).to_be_hidden()
        page.keyboard.press("Escape")
        expect(page.locator("#mini-basket")).to_be_hidden()
        expect(basket).to_be_focused()
        expect(hud).to_be_visible()
        hud.focus()
        page.keyboard.press("Tab")
        exit_button = hud.locator(".shop-interior-exit")
        expect(exit_button).to_be_focused()
        assert exit_button.evaluate("exit => getComputedStyle(exit).outlineStyle") == "solid"
        page.keyboard.press("Escape")
        expect(hud).to_be_hidden()
        expect(entry).to_be_focused()

        entry.tap()
        expect(hud).to_be_visible()
        exit_button.tap()
        expect(hud).to_be_hidden()
        expect(entry).to_be_focused()
        assert not errors, errors
        check_resize_fallback(context, url)
    finally:
        context.close()


def main(evidence=None):
    if evidence:
        evidence.mkdir(parents=True, exist_ok=True)
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}{ROUTE}"
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            )
            try:
                exercise(browser, url, evidence)
            finally:
                browser.close()
    print("PASS: Shop HUD at 320/375/390 px, all locales and both themes, safe areas, enlarged text, real touch and focus")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path)
    main(parser.parse_args().evidence)
