"""Exercise the CSS virtual street, native product dialog and list fallback."""

import functools
import http.server
import importlib.util
import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass


def run():
    evidence = {"capturedAt": datetime.now(timezone.utc).isoformat(), "cases": [],
                "limitations": ["Local Chrome only; physical devices and screen readers not tested.",
                                "No automated axe bundle or field Core Web Vitals measurement."]}
    with tempfile.TemporaryDirectory(prefix="gjh-v9-browser-") as temporary:
        gallery.build(Path(temporary) / "Webpage-Design-Gallery")
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/demos/corporate/gjh/v9/"
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ.get("GALLERY_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), headless=True)
                evidence["browserVersion"] = browser.version
                for width, height in ((1440, 900), (768, 1024), (390, 844), (320, 720)):
                    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_function("document.documentElement.dataset.view === 'visual'")
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    viewport = page.locator('meta[name="viewport"]').get_attribute("content")
                    assert "user-scalable=no" not in viewport and "maximum-scale=1" not in viewport
                    page.keyboard.press("Tab")
                    assert page.locator(".skip-link").evaluate("el => el === document.activeElement")
                    first_door = page.locator('[data-room="newmoon"]')
                    first_door.focus()
                    page.keyboard.press("ArrowRight")
                    assert page.locator('[data-room="mili"]').evaluate("el => el === document.activeElement")
                    page.keyboard.press("Enter")
                    page.wait_for_function("document.querySelector('.scene-world').dataset.currentRoom === 'mili'")
                    assert page.locator('[data-room-panel="mili"] h2').evaluate("el => el === document.activeElement")
                    page.keyboard.press("Escape")
                    assert page.locator('.scene-world').get_attribute("data-current-room") == "lobby"
                    assert page.locator('[data-room="mili"]').evaluate("el => el === document.activeElement")
                    page.locator('[data-map-room="newmoon"]').click()
                    for product in ("sku-nz", "sku-au", "sku-sa", "sku-mx"):
                        trigger = page.locator(f'button[data-product="{product}"]')
                        trigger.focus()
                        page.keyboard.press("Enter")
                        dialog = page.locator("#product-dialog")
                        assert dialog.is_visible()
                        assert dialog.locator(f"#{product}").count() == 1
                        assert dialog.locator("a.eshop-link").get_attribute("href") == "https://www.gjheshop.com/"
                        for image in dialog.locator("img").all():
                            image.evaluate("image => image.decode()")
                        for _ in range(5):
                            page.keyboard.press("Tab")
                            assert dialog.evaluate("el => el.contains(document.activeElement)")
                        page.keyboard.press("Escape")
                        assert not dialog.is_visible()
                        assert trigger.evaluate("el => el === document.activeElement")
                        page.locator(f"#product-panels > #{product}").wait_for(state="attached")
                    # Switch views and follow a deep link; the native details panel
                    # must survive its temporary move into the dialog.
                    page.locator(".view-toggle").click()
                    assert page.locator("#store-list").is_visible()
                    assert page.locator(".view-toggle").get_attribute("aria-pressed") == "true"
                    page.locator('#store-list a[href="#sku-nz"]').click()
                    assert page.locator("#sku-nz").evaluate("el => el.open")
                    page.reload(wait_until="networkidle")
                    assert page.locator("html").get_attribute("data-view") == "list"
                    assert page.locator("#sku-nz").evaluate("el => el.open")
                    page.locator(".view-toggle").click()
                    assert page.locator(".visual-experience").is_visible()
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    assert not errors, errors
                    evidence["cases"].append({"width": width, "keyboardAndModal": "PASS", "listAndDeepLink": "PASS", "overflow": "PASS", "errors": errors})
                    print(f"V9 {width}px: keyboard, four product dialogs, list/deep-link recovery PASS", flush=True)
                    context.close()
                # No-JavaScript users retain real links, images and native details.
                context = browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
                page = context.new_page()
                page.goto(url, wait_until="networkidle")
                assert page.locator("#store-list").is_visible()
                assert page.locator(".view-toggle").is_hidden()
                page.locator("#sku-nz > summary").click()
                assert page.locator("#sku-nz").evaluate("el => el.open")
                assert page.locator("#sku-nz .eshop-link").is_visible()
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                evidence["noJavaScript"] = "PASS"
                context.close()
                browser.close()
        finally:
            server.shutdown()
    target = ROOT / "docs/evidence/gjh-v9-browser.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print("PASS: V9 four viewport journeys and no-JavaScript fallback")


if __name__ == "__main__":
    run()
