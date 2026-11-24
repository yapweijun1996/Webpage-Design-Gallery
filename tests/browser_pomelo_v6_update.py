"""Exercise V6 language controls, contact phone, and real update-state handling."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

def run():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}/demos/corporate/pomelo-stem/v6/"
    try:
        with sync_playwright() as pw:
            chrome = os.environ.get("GALLERY_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
            browser = pw.chromium.launch(headless=True, executable_path=chrome)
            page = browser.new_page(viewport={"width": 320, "height": 800}, reduced_motion="reduce")
            page.goto(base + "showcase.html")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            for selector in (".languages summary", ".theme-toggle", ".update-control summary", ".menu > summary"):
                assert page.locator(selector + " svg").count() >= 1, selector
                assert page.locator(selector).bounding_box()["height"] >= 44, selector
            page.locator(".languages summary").click()
            expect(page.locator(".languages-menu a[aria-current=true]")).to_have_text("English")
            page.keyboard.press("Escape")
            assert not page.locator(".languages").evaluate("(el) => el.open")
            page.locator(".languages summary").click()
            page.locator('.languages-menu a[lang="zh-Hans"]').click()
            assert "/zh/showcase.html" in page.url
            page.goto(base + "contact.html")
            assert page.locator('a[href="tel:+601139023123"]').count() == 1
            page.goto(base + "showcase.html")
            page.locator(".update-control summary").click()
            expect(page.locator("[data-update-status]")).to_have_text("Up to date.")
            assert page.locator(".update-control summary").inner_text() == "v6.1.0"
            page.locator(".update-control summary").click()
            page.route("**/release.json?*", lambda route: route.abort("failed"))
            page.locator(".update-control summary").click()
            expect(page.locator("[data-update-status]")).to_contain_text("Unable to check")
            expect(page.locator("[data-update-retry]")).to_be_visible()
            assert not page.locator(".update-control").evaluate("(el) => el.classList.contains('is-checking')")
            page.unroute("**/release.json?*")
            page.route("**/release.json?*", lambda route: route.fulfill(json={"version": "6.2.0"}))
            page.locator("[data-update-retry]").click()
            expect(page.locator("[data-update-status]")).to_contain_text("v6.2.0")
            page.once("dialog", lambda dialog: dialog.dismiss())
            page.locator("[data-update-apply]").click()
            assert page.locator("[data-update-apply]").is_visible()
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator("[data-update-apply]").click()
            page.wait_for_load_state("load")
            expect(page.locator("[data-update-status]")).to_have_text("Update could not be verified. Retry.")
            assert page.locator(".update-control summary").inner_text() == "v6.1.0"
            page.locator("[data-update-retry]").click()
            expect(page.locator("[data-update-status]")).to_contain_text("v6.2.0")
            def next_document(route):
                response = route.fetch()
                content = response.text().replace("6.1.0", "6.2.0")
                route.fulfill(response=response, body=content)
            page.route("**/showcase.html?*", next_document)
            page.once("dialog", lambda dialog: dialog.accept())
            page.locator("[data-update-apply]").click()
            page.wait_for_load_state("load")
            expect(page.locator("[data-update-status]")).to_have_text("Update applied.")
            assert page.locator(".update-control summary").inner_text() == "v6.2.0"
            page.unroute_all(behavior="wait")
            page.goto(base + "showcase.html")
            page.evaluate("sessionStorage.setItem('pomelo-v6-expected-update', '6.1.0')")
            page.route("**/assets/app.js?*", lambda route: route.fulfill(status=200, content_type="text/javascript", body="/* invalid bytes */"))
            page.reload()
            expect(page.locator("[data-update-status]")).to_have_text("Update could not be verified. Retry.")
            page.unroute_all(behavior="wait")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    print("PASS: responsive SVG controls, phone, locale, latest, offline, available, canceled, stale, integrity failure and verified update")

if __name__ == "__main__":
    run()
