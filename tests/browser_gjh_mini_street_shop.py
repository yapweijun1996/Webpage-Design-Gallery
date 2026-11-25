"""End-to-end check for the Mini Street walk-in shop and virtual basket."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ROUTE = "/demos/corporate/gjh/mini-street/"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass


def run():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_port}{ROUTE}"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True, executable_path="/usr/bin/google-chrome",
                args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            )
            page = browser.new_page(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))

            def observe_camera(route):
                source = route.fetch().text()
                marker = 'camera.rotation.order = "YXZ";'
                assert source.count(marker) == 1
                body = source.replace(marker, marker + "\nwindow.__miniStreetSmokeCamera = camera;", 1)
                route.fulfill(content_type="text/javascript", body=body)

            page.route("**/mini-street/shop-interior.js", observe_camera)
            page.goto(url, wait_until="networkidle")
            page.locator('a[data-stop="shop"]').click()
            page.get_by_role("button", name="Enter 3D shop").click()
            page.wait_for_selector(".shop-interior-controls")
            inspect = page.locator(".shop-interior-inspect")
            assert not inspect.is_enabled(), "The product should be out of reach at the entrance"
            theme = page.locator("#mini-theme")
            theme.focus()
            assert theme.evaluate("button => document.activeElement === button")
            camera = "window.__miniStreetSmokeCamera"
            before = page.evaluate(f"{camera}.position.toArray()")
            for key in ("w", "ArrowUp"):
                page.keyboard.down(key)
                page.evaluate("""async () => {
                  for (let frame = 0; frame < 3; frame++) {
                    await new Promise(requestAnimationFrame);
                  }
                }""")
                page.keyboard.up(key)
            assert page.evaluate(f"{camera}.position.toArray()") == before, "Topbar focus should block shop movement"
            page.keyboard.press("Escape")
            assert page.url.endswith("#shop-interior"), "Topbar Escape should not leave the shop"
            page.locator(".shop-interior-controls").focus()
            # Wait for actual rendered movement, not a fixed wall-clock duration:
            # software rendering can run slowly while other browser tests execute.
            page.keyboard.down("w")
            page.wait_for_function("window.__miniStreetSmokeCamera.position.z <= 2.1", timeout=20000)
            page.keyboard.up("w")
            page.keyboard.down("PageDown")
            page.wait_for_function("window.__miniStreetSmokeCamera.rotation.x <= -0.48", timeout=10000)
            page.keyboard.up("PageDown")
            bounds = page.locator("#view").bounding_box()
            aim_x = aim_y = 0.5
            for y in (0.25, 0.35, 0.45, 0.55, 0.65):
                if inspect.is_enabled():
                    break
                for x in (0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6):
                    page.mouse.move(bounds["x"] + bounds["width"] * x,
                                    bounds["y"] + bounds["height"] * y)
                    page.wait_for_timeout(75)
                    if inspect.is_enabled():
                        aim_x, aim_y = x, y
                        break
            assert inspect.is_enabled(), "The product should be reachable from the aisle"
            inspect.click()
            page.wait_for_selector('.shop-product[data-phase="inspecting"]')
            page.get_by_role("button", name="Rotate right").click()
            page.get_by_role("button", name="Put back").click()
            page.locator(".shop-product").wait_for(state="hidden")
            page.wait_for_timeout(500)
            assert page.locator(".mini-basket-badge").inner_text() == "0"
            page.mouse.move(bounds["x"] + bounds["width"] * aim_x,
                            bounds["y"] + bounds["height"] * aim_y)
            page.wait_for_timeout(250)
            assert inspect.is_enabled()
            inspect.click()
            page.wait_for_selector('.shop-product[data-phase="inspecting"]')
            page.get_by_role("button", name="Add to basket").click()
            page.locator(".shop-product").wait_for(state="hidden")
            assert page.locator(".mini-basket-badge").inner_text() == "1"
            page.reload(wait_until="networkidle")
            page.wait_for_selector(".shop-interior-controls")
            assert page.locator(".mini-basket-badge").inner_text() == "1"
            page.get_by_role("button", name="Basket").click()
            assert page.get_by_role("dialog", name="Virtual basket").is_visible()
            assert page.locator(".mini-basket-item:not([hidden]) .mini-basket-quantity span").inner_text() == "1"
            page.keyboard.press("Escape")
            page.get_by_role("dialog", name="Virtual basket").wait_for(state="hidden")
            assert page.url.endswith("#shop-interior"), "Escape should close only the basket"
            page.get_by_role("button", name="Exit shop").click()
            page.wait_for_selector("#stop-dialog[open]")
            assert page.url.endswith("#shop")
            assert not errors, errors

            # A browser without WebGL retains the packshots and browser-local basket.
            fallback = browser.new_page(viewport={"width": 390, "height": 700})
            fallback.add_init_script("""(() => {
              const original = HTMLCanvasElement.prototype.getContext;
              HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                return /^webgl2?$|^experimental-webgl$/.test(type) ? null : original.call(this, type, ...args);
              };
            })();""")
            fallback.goto(url + "#shop-interior", wait_until="networkidle")
            fallback.wait_for_selector('#stop-dialog[open]')
            assert fallback.url.endswith("#shop")
            fallback.get_by_role("button", name="Add Australian abalone to basket").click()
            assert "added" in fallback.get_by_role("status").last.inner_text().lower()
            fallback.get_by_role("button", name="Close").click()
            fallback.get_by_role("button", name="Basket").click()
            assert fallback.get_by_role("dialog", name="Virtual basket").is_visible()
            assert fallback.locator(".mini-basket-item:not([hidden]) .mini-basket-quantity span").inner_text() == "1"
            browser.close()
            print("Mini Street integrated shop, basket persistence and WebGL fallback: PASS")
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
