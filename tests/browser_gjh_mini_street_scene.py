"""Verify the Mini Street entrance, camera inputs, and scene lighting."""
from http.server import ThreadingHTTPServer
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_shop import Handler, ROUTE


def observe_scene(route):
    response = route.fetch()
    source = response.text()
    camera = "getCameraState: () => ({ ...view }),"
    lighting = "street.setNight(night);"
    assert source.count(camera) == source.count(lighting) == 1
    source = source.replace(camera,
                            "getCameraState: window.miniStreetCamera = () => ({ ...view }),")
    source = source.replace(lighting, lighting + "\n      window.miniStreetNight = night;")
    route.fulfill(response=response, body=source)


def exercise_desktop(browser, url):
    page = browser.new_page(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
    page.route("**/mini-street/scene.js", observe_scene)
    page.goto(url, wait_until="domcontentloaded")
    stage = page.locator("#stage")
    canvas = page.locator("#view")
    expect(stage).to_have_attribute("data-webgl", "", timeout=15000)
    help_button = page.locator(".scene-camera-help summary")
    help_button.press("Enter")
    expect(page.get_by_text("Touch: drag to look around. Pinch to zoom.")).to_be_visible()
    help_button.press("Escape")
    expect(page.locator(".scene-camera-help")).not_to_have_attribute("open", "")
    expect(help_button).to_be_focused()

    zoom = page.get_by_role("button", name="Zoom in", exact=True)
    zoom.press("Enter")
    page.wait_for_function("miniStreetCamera().zoom > 1")
    canvas.press("ArrowRight")
    page.wait_for_function("miniStreetCamera().azimuth > 0")
    canvas.press("ArrowUp")
    page.wait_for_function("miniStreetCamera().elevation > 0")
    canvas.press("Home")
    page.wait_for_function("miniStreetCamera().zoom === 1 && miniStreetCamera().azimuth === 0")
    canvas.hover(position={"x": 200, "y": 160})
    page.keyboard.down("Shift")
    page.mouse.wheel(0, -100)
    page.keyboard.up("Shift")
    page.wait_for_function("miniStreetCamera().zoom > 1")
    canvas.press("Home")
    canvas.press("+")
    page.wait_for_function("miniStreetCamera().zoom > 1")
    canvas.press("-")
    page.wait_for_function("Math.abs(miniStreetCamera().zoom - 1) < 0.01")

    page.evaluate("localStorage.setItem('gjh-mini-street-site-theme', 'light')")
    day = page.get_by_role("button", name="Day", exact=True)
    night = page.get_by_role("button", name="Night", exact=True)
    day.press("Enter")
    expect(day).to_have_attribute("aria-pressed", "true")
    expect(night).to_have_attribute("aria-pressed", "false")
    expect(page.locator("#weather")).to_have_text("After the rain")
    page.wait_for_function("window.miniStreetNight === false")
    assert page.evaluate("localStorage.getItem('gjh-mini-street-site-theme')") == "light"
    page.reload(wait_until="domcontentloaded")
    expect(day).to_have_attribute("aria-pressed", "true")
    page.wait_for_function("window.miniStreetNight === false")
    night.press("Enter")
    expect(night).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#weather")).to_have_text("Rainy evening")
    page.wait_for_function("window.miniStreetNight === true")

    entry = page.get_by_role("link", name="Enter New Moon Shop")
    entry.press("Enter")
    expect(page).to_have_url(url + "#shop-interior")
    expect(stage).to_have_attribute("data-interior", "", timeout=15000)
    expect(entry).to_be_hidden()
    expect(help_button).to_be_hidden()
    page.get_by_role("button", name="Exit shop").press("Enter")
    expect(page).to_have_url(url)
    expect(entry).to_be_focused()
    page.go_forward()
    expect(stage).to_have_attribute("data-interior", "", timeout=15000)
    page.go_back()
    expect(entry).to_be_focused()
    page.close()


def exercise_mobile(browser, url):
    page = browser.new_page(viewport={"width": 320, "height": 568}, has_touch=True,
                            is_mobile=True, reduced_motion="reduce")
    page.route("**/mini-street/scene.js", observe_scene)
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#stage")).to_have_attribute("data-webgl", "", timeout=15000)
    entry = page.get_by_role("link", name="Enter New Moon Shop")
    help_button = page.locator(".scene-camera-help summary")
    zoom_in = page.get_by_role("button", name="Zoom in", exact=True)
    zoom_out = page.get_by_role("button", name="Zoom out", exact=True)
    for element in (entry, help_button, zoom_in, zoom_out, *page.locator("[data-stop]").all()):
        bounds = element.bounding_box()
        assert bounds and bounds["height"] >= 44, bounds
        assert bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= 320, bounds
    assert page.evaluate("document.documentElement.scrollWidth") == 320
    zoom_in.tap()
    page.wait_for_function("miniStreetCamera().zoom > 1")
    zoom_out.tap()
    page.wait_for_function("Math.abs(miniStreetCamera().zoom - 1) < 0.01")

    canvas = page.locator("#view")
    canvas.scroll_into_view_if_needed()
    bounds = canvas.bounding_box()
    x = int(bounds["x"] + bounds["width"] / 2)
    y = int(bounds["y"] + bounds["height"] / 2)
    session = page.context.new_cdp_session(page)
    session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [
        {"id": 1, "x": x - 20, "y": y}, {"id": 2, "x": x + 20, "y": y},
    ]})
    session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [
        {"id": 1, "x": x - 50, "y": y}, {"id": 2, "x": x + 50, "y": y},
    ]})
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_function("miniStreetCamera().zoom > 1.2")
    session.detach()

    help_button.tap()
    expect(page.get_by_text("Touch: drag to look around. Pinch to zoom.")).to_be_visible()
    help_button.tap()
    entry.tap()
    expect(page.locator("#stage")).to_have_attribute("data-interior", "", timeout=15000)
    page.close()


def exercise_fallback(browser, url):
    page = browser.new_page()
    page.route("**/mini-street/scene.js", lambda route: route.abort())
    page.goto(url + "#shop-interior", wait_until="domcontentloaded")
    expect(page).to_have_url(url + "#shop")
    expect(page.get_by_role("link", name="Enter New Moon Shop")).to_be_hidden()
    expect(page.locator("#toolbar")).to_be_hidden()
    expect(page.locator("#shop .pack-list li")).to_have_count(4)
    page.close()


def main():
    with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}{ROUTE}"
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path="/usr/bin/google-chrome",
                args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            )
            try:
                exercise_desktop(browser, url)
                exercise_mobile(browser, url)
                exercise_fallback(browser, url)
            finally:
                browser.close()
        print("Mini Street entry/history, camera inputs/help, scene lighting and fallback: PASS")


if __name__ == "__main__":
    main()
