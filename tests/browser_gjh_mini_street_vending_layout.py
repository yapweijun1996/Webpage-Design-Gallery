"""Check that a changing viewport or late 3D preview leaves vending usable."""
from functools import partial
from http.server import ThreadingHTTPServer
import os
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_links import Quiet, ROOT, ROUTE, pause_drop

VIEWER_STUB = """
export function createVendingViewer(preview) {
  window.viewerMounts = (window.viewerMounts || 0) + 1;
  const canvas = document.createElement("canvas");
  preview.querySelector(".vending-orbit").append(canvas);
  return { setState() {}, dispose() { canvas.remove(); } };
}
"""


def begin_drop(page):
    page.locator("[data-slot=A2]").click()
    vend = page.get_by_role("button", name="Vend", exact=True)
    vend.focus()
    pause_drop(vend)
    expect(page.locator(".vending-message")).to_have_text("Dispensing Peach Tea…")
    return page.locator(".vending-flight")


def expect_trajectory_to_end_in_tray(page, flight):
    flight.evaluate("""pack => {
      const animation = pack.getAnimations()[0];
      animation.currentTime = animation.effect.getTiming().duration - 1;
    }""")
    page.wait_for_function("""() => {
      const pack = document.querySelector(".vending-flight")?.getBoundingClientRect();
      const tray = document.querySelector(".vending-pocket").getBoundingClientRect();
      return pack && Math.abs(pack.x + pack.width / 2 - tray.x - tray.width / 2) < 2
        && Math.abs(pack.y + pack.height / 2 - tray.y - tray.height / 2) < 2;
    }""", timeout=1200)


def expect_ready(page):
    expect(page.locator(".vending-message")).to_have_text("Peach Tea ready in the tray")
    expect(page.locator(".vending-pocket .drink-art")).to_be_visible()
    expect(page.get_by_role("button", name="Collect drink", exact=True)).to_be_focused()


def exercise_resize(browser, url, can_retarget):
    context = browser.new_context(viewport={"width": 320, "height": 568}, service_workers="block")
    context.route("**/scene.js", lambda route: route.abort())
    context.route("**/vending-viewer.js", lambda route: route.abort())
    if not can_retarget:
        context.add_init_script("KeyframeEffect.prototype.setKeyframes = undefined;")
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded")
    flight = begin_drop(page)
    flight.evaluate("pack => { pack.getAnimations()[0].currentTime = 560; }")
    page.set_viewport_size({"width": 568, "height": 320})
    if can_retarget:
        assert flight.evaluate("pack => pack.getAnimations()[0].currentTime") == 560
        expect_trajectory_to_end_in_tray(page, flight)
        flight.evaluate("pack => pack.getAnimations()[0].finish()")
    expect_ready(page)
    expect(flight).to_have_count(0)
    context.close()


def exercise_late_viewer(browser, url, collect):
    context = browser.new_context(viewport={"width": 1000, "height": 800}, service_workers="block")
    context.route("**/scene.js", lambda route: route.abort())
    held = []
    context.route("**/vending-viewer.js", lambda route: held.append(route))
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded")
    flight = begin_drop(page)
    assert len(held) == 1, held
    held[0].fulfill(status=200, content_type="text/javascript", body=VIEWER_STUB)
    page.evaluate("async () => { await import('./vending-viewer.js'); }")
    viewer = page.locator(".vending-viewer")
    expect(viewer).to_be_hidden()
    assert page.evaluate("window.viewerMounts || 0") == 0
    expect_trajectory_to_end_in_tray(page, flight)

    if collect:
        flight.evaluate("pack => pack.getAnimations()[0].finish()")
        expect_ready(page)
        expect(viewer).to_be_hidden()
        page.get_by_role("button", name="Collect drink", exact=True).press("Enter")
        expect(page.locator(".vending-message")).to_have_text("Collected. Choose again.")
        expect(page.locator("[data-slot=A2]")).to_be_focused()
    else:
        page.get_by_role("button", name="Close", exact=True).click()
        expect(flight).to_have_count(0)
        assert page.evaluate("window.viewerMounts || 0") == 0
        page.locator("[data-stop=vending]").click()
        expect(page.locator(".vending-message")).to_have_text("Choose a drink")
        expect(page.locator(".vending-pocket .drink-art")).to_have_count(0)
    expect(viewer.locator("canvas")).to_be_visible()
    assert page.evaluate("window.viewerMounts") == 1
    context.close()


def exercise_failed_flight(browser, url):
    context = browser.new_context(viewport={"width": 320, "height": 568}, service_workers="block")
    context.route("**/scene.js", lambda route: route.abort())
    context.route("**/vending-viewer.js", lambda route: route.abort())
    context.add_init_script("""(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function(...args) {
        if (this.classList.contains("vending-flight")) throw new Error("Unable to create animation");
        return animate.apply(this, args);
      };
    })();""")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url, wait_until="domcontentloaded")
    page.locator("[data-slot=A2]").click()
    page.get_by_role("button", name="Vend", exact=True).press("Enter")
    expect_ready(page)
    expect(page.locator(".vending-flight")).to_have_count(0)
    page.get_by_role("button", name="Collect drink", exact=True).press("Enter")
    expect(page.locator(".vending-message")).to_have_text("Collected. Choose again.")
    assert not errors, errors
    context.close()


def main():
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}{ROUTE}#vending"
        with sync_playwright() as playwright:
            if os.environ.get("MINI_STREET_BROWSER") == "webkit":
                browser = playwright.webkit.launch(headless=True)
            else:
                chrome = os.environ.get("GALLERY_CHROME")
                browser = playwright.chromium.launch(executable_path=chrome, channel=None if chrome else "chrome")
            try:
                for can_retarget in (True, False):
                    exercise_resize(browser, url, can_retarget)
                for collect in (True, False):
                    exercise_late_viewer(browser, url, collect)
                exercise_failed_flight(browser, url)
                print("PASS: resize trajectory, fallbacks and deferred viewer on collect or close")
            finally:
                browser.close()


if __name__ == "__main__":
    main()
