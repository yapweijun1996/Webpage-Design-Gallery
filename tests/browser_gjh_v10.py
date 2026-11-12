"""Exercise the local v10 WebGL surface and accessible fallback in real Chrome."""

import argparse
import functools
import http.server
import json
import os
import tempfile
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demos/corporate/gjh/v10"
CHROME_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def settled(page, room):
    page.wait_for_function("room => window.__sceneStats?.room === room && !window.__sceneStats.moving && !window.__sceneStats.settling", arg=room)


def check_targets(page):
    small = page.locator("a,button,summary,[tabindex='0']").evaluate_all("""elements => elements.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && (r.width < 44 || r.height < 44);
    }).map(el => ({text: el.textContent.trim(), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height}))""")
    assert not small, small
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def run(capture=False):
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v10/"
    interiors = Path(tempfile.mkdtemp(prefix="gjh-v10-interiors-"))
    evidence = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ["GALLERY_CHROME"], headless=True, args=CHROME_ARGS)
            try:
                for width, height in ((1440, 900), (768, 1024), (390, 844)):
                    context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=3)
                    page = context.new_page()
                    errors, external = [], []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("console", lambda message: errors.append({"text": message.text, "location": message.location}) if message.type == "error" else None)
                    page.on("response", lambda response: errors.append({"status": response.status, "url": response.url}) if response.status >= 400 else None)
                    page.on("requestfailed", lambda request: errors.append({"request": request.url, "failure": request.failure}))
                    page.on("request", lambda request: external.append(request.url) if request.url.startswith("http") and not request.url.startswith(f"http://127.0.0.1:{server.server_port}/") else None)
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_function("window.__sceneReady === true")
                    settled(page, "lobby")
                    stats = page.evaluate("window.__sceneStats")
                    assert stats["drawCalls"] < 150, stats
                    assert stats["pixelRatio"] <= (1.5 if width < 600 else 2), stats
                    scene_height = page.locator("#scene").bounding_box()["height"]
                    assert scene_height >= height * (.72 if width < 600 else .8), (width, scene_height)
                    check_targets(page)
                    # Lobby breathing is active only in the visible motion-enabled view.
                    frame = page.evaluate("window.__sceneStats.frames")
                    page.wait_for_function("frame => window.__sceneStats.frames > frame", arg=frame)
                    assert page.evaluate("window.__sceneStats.breathing")
                    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
                    frame = page.evaluate("window.__sceneStats.frames")
                    page.wait_for_timeout(180)
                    assert page.evaluate("window.__sceneStats.frames") == frame
                    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
                    if capture:
                        (DEMO / "screenshots").mkdir(exist_ok=True)
                        page.screenshot(path=str(DEMO / f"screenshots/{width}.png"), scale="css")
                        if width == 1440:
                            with Image.open(DEMO / "screenshots/1440.png") as image:
                                image.resize((720, 450)).save(DEMO / "assets/thumbnail.webp", quality=88)
                    # Every store is reachable using only keyboard movement, including Escape.
                    page.locator("#scene").focus()
                    for key, room in (("ArrowRight", "newmoon"), ("w", "mili"), ("d", "gogo"), ("Escape", "lobby"), ("a", "gogo"), ("s", "mili"), ("ArrowLeft", "newmoon")):
                        page.keyboard.press(key)
                        settled(page, room)
                        assert page.locator(f'button[data-room="{room}"]').get_attribute("aria-current") == "location"
                    # A DOM product list provides the same panel as scene selection.
                    page.locator(".scene-products summary").click()
                    for product_index, button in enumerate(page.locator("#products button").all()):
                        name = button.get_attribute("data-product-name")
                        button.focus()
                        product_id = button.get_attribute("data-product")
                        try:
                            page.wait_for_function("id => window.__sceneStats.highlightedProduct === id", arg=product_id)
                        except Exception:
                            print({"width": width, "product": product_id, "focus": page.evaluate("document.activeElement.outerHTML"), "stats": page.evaluate("window.__sceneStats")}, flush=True)
                            raise
                        button.click()
                        # Native modal cycling must not escape to room navigation.
                        page.locator("#product-close").focus()
                        page.keyboard.press("Shift+Tab")
                        assert page.locator("#product-shop").evaluate("el => document.activeElement === el")
                        page.keyboard.press("Tab")
                        assert page.locator("#product-close").evaluate("el => document.activeElement === el")
                        if product_index == 0:
                            page.screenshot(path=str(interiors / f"panel-{width}.png"), scale="css")
                        assert page.locator("#product-dialog").is_visible()
                        assert page.locator("#product-title").inner_text() == name
                        assert page.locator("#product-dialog a").count() == 1
                        assert page.locator("#product-shop").get_attribute("href") == "https://www.gjheshop.com/"
                        check_targets(page)
                        page.keyboard.press("Escape")
                        assert button.evaluate("el => document.activeElement === el")
                    page.locator(".scene-products summary").click()
                    page.evaluate("scrollTo(0, 0)")
                    for room in ("newmoon", "mili", "gogo"):
                        page.locator(f'button[data-room="{room}"]').click()
                        settled(page, room)
                        page.evaluate("scrollTo(0, 0)")
                        check_targets(page)
                        assert page.evaluate("window.__sceneStats.drawCalls") < 150
                        page.screenshot(path=str(interiors / f"{room}-{width}.png"), scale="css")
                    page.locator('button[data-room="newmoon"]').click()
                    settled(page, "newmoon")
                    if width == 1440:
                        # Actual pointer raycasts on the four visible shelf packshots.
                        for x, y, country in ((560, 430, "New Zealand"), (875, 430, "Australia"), (560, 600, "South Africa"), (875, 600, "Mexico")):
                            page.mouse.move(x, y)
                            page.wait_for_function("window.__sceneStats.highlightedProduct !== null")
                            page.mouse.click(x, y)
                            page.wait_for_selector("#product-dialog[open]")
                            assert country in page.locator("#product-title").inner_text()
                            page.keyboard.press("Escape")
                        page.keyboard.press("Escape")
                        settled(page, "lobby")
                        page.mouse.click(700, 440)
                        settled(page, "mili")
                        # Dragging changes the rendered viewpoint without selecting a product.
                        before = page.locator("#scene").screenshot()
                        page.mouse.move(750, 450)
                        page.mouse.down(); page.mouse.move(880, 470, steps=8); page.mouse.up()
                        page.wait_for_function("!window.__sceneStats.settling")
                        assert page.locator("#scene").screenshot() != before
                        frame = page.evaluate("window.__sceneStats.frames")
                        page.wait_for_timeout(180)
                        assert page.evaluate("window.__sceneStats.frames") == frame, "Idle rendering did not stop"
                    page.locator("#view-toggle").click()
                    assert page.locator("#store-list").is_visible()
                    assert page.locator("#store-list .product-card").count() == 4
                    check_targets(page)
                    page.locator("#view-toggle").click()
                    assert page.locator("#scene").is_visible()
                    assert not errors, errors
                    assert not external, external
                    evidence.append({"width": width, "drawCalls": stats["drawCalls"], "quality": stats["quality"], "keyboard": "PASS", "products": "PASS", "targetsAndOverflow": "PASS", "consoleErrors": errors})
                    context.close()
                context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
                page = context.new_page(); page.goto(url)
                page.wait_for_function("window.__sceneReady === true")
                settled(page, "lobby")
                assert not page.evaluate("window.__sceneStats.breathing")
                frame = page.evaluate("window.__sceneStats.frames")
                page.wait_for_timeout(180)
                assert page.evaluate("window.__sceneStats.frames") == frame
                page.keyboard.press("ArrowRight")
                page.wait_for_function("window.__sceneStats.room === 'newmoon'")
                assert not page.evaluate("window.__sceneStats.moving")
                assert page.locator("#view-toggle").evaluate("el => getComputedStyle(el).transitionDuration") == "0s"
                frame = page.evaluate("window.__sceneStats.frames")
                page.wait_for_timeout(180)
                assert page.evaluate("window.__sceneStats.frames") == frame
                # Exercise the visibility handler while a trip is requested offscreen.
                page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
                page.keyboard.press("ArrowRight"); page.wait_for_timeout(80)
                assert page.evaluate("window.__sceneStats.frames") == frame
                page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
                settled(page, "mili")
                # A lost context immediately restores the entire accessible catalog.
                page.locator("#scene").evaluate("el => el.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
                page.wait_for_selector("#store-list", state="visible")
                assert page.locator("#store-list .product-card").count() == 4
                context.close()
                context = browser.new_context(viewport={"width": 390, "height": 844})
                context.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args)}")
                page = context.new_page(); page.goto(url)
                page.wait_for_function("window.__sceneFailed === true")
                assert page.locator("#store-list").is_visible()
                assert page.locator("#store-list .product-card").count() == 4
                check_targets(page)
                context.close()
                context = browser.new_context(java_script_enabled=False, viewport={"width":390,"height":844})
                page = context.new_page(); page.goto(url)
                assert page.locator("#store-list").is_visible()
                assert page.locator("#store-list .product-card").count() == 4
                assert page.locator("#mili-title").is_visible() and page.locator("#gogo-title").is_visible()
                check_targets(page)
                page.goto((DEMO / "index.html").as_uri())
                assert page.locator("#store-list").is_visible()
                assert page.locator("#store-list .product-card").count() == 4
                context.close()
                evidence.append({"reducedMotion": "PASS", "visibilityPause": "PASS (visibility override)", "contextLoss": "PASS", "forcedWebGLUnavailable": "PASS", "noJavaScriptAndFileList": "PASS", "interiorCaptures": str(interiors)})
            finally:
                browser.close()
    finally:
        server.shutdown(); server.server_close(); thread.join()
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="Update v10 lobby screenshots and thumbnail only")
    run(parser.parse_args().capture)
