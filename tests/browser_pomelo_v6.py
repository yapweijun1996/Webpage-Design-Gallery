"""Browser checks for the V6 localized pages and non-transactional demos."""
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
PAGES = ("index", "solutions", "online-shopping", "whatsapp-orders",
         "ai-integration", "custom-systems", "showcase", "how-it-works", "about", "contact")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}/demos/corporate/pomelo-stem/v6/"
    try:
        with sync_playwright() as pw:
            chrome = os.environ.get("GALLERY_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
            browser = pw.chromium.launch(headless=True, executable_path=chrome)
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            for locale in ("", "zh/", "ms/"):
                for name in PAGES:
                    response = page.goto(base + locale + name + ".html", wait_until="load")
                    assert response.status == 200, (locale, name)
                    assert page.locator("h1").count() == 1, (locale, name)
                    assert page.locator(".loader").is_hidden(), (locale, name)
                    for image in page.locator("img:not(.loader img)").all():
                        image.scroll_into_view_if_needed()
                        image.evaluate("image => image.decode()")
                        assert image.evaluate("image => image.complete && image.naturalWidth > 0"), (locale, name)
                    for width in (1440, 768, 390, 320):
                        page.set_viewport_size({"width": width, "height": 900})
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (locale, name, width)
            page.set_viewport_size({"width": 1440, "height": 900})
            page.goto(base + "showcase.html")
            page.locator("[data-action=basket]").click()
            expect(page.locator("#demo-1 [data-status]")).to_contain_text("1 example")
            page.locator("#demo-1 [data-action=reset]").click()
            expect(page.locator("#demo-1 [data-status]")).to_contain_text("empty")
            page.locator("[data-panel=p2]").click()
            page.locator("[data-action=review]").click()
            expect(page.locator("#demo-2 [data-status]")).to_contain_text("Choose")
            assert page.locator("[data-action=confirm]").is_disabled()
            page.locator("[data-method]").select_option("pickup")
            page.locator("[data-action=review]").click()
            page.locator("[data-action=confirm]").click()
            expect(page.locator("#demo-2 [data-status]")).to_contain_text("Confirmed")
            page.locator("#demo-2 [data-action=reset]").click()
            assert page.locator("[data-action=confirm]").is_disabled()
            page.locator("[data-panel=p3]").click()
            page.locator("[data-action=draft]").click()
            page.locator("[data-action=check]").click()
            expect(page.locator("#demo-3 [data-status]")).to_contain_text("Reviewed")
            page.locator("[data-panel=p4]").click()
            page.locator("[data-action=team]").click()
            expect(page.locator("#demo-4 [data-status]")).to_contain_text("Ready to prepare")
            page.locator("#demo-4 [data-action=reset]").click()
            expect(page.locator("#demo-4 [data-status]")).to_contain_text("Awaiting")
            page.goto(base + "ai-integration.html")
            page.get_by_role("link", name="See the AI Example", exact=False).click()
            expect(page.locator("#demo-3")).to_be_visible()
            page.evaluate("localStorage.setItem('pomelo-showcase-theme', 'light')")
            page.reload()
            page.locator("[data-theme-toggle]").click()
            expect(page.locator("html")).to_have_attribute("data-theme", "dark")
            page.locator(".languages summary").click()
            page.locator('.languages-menu a[lang="zh-Hans"]').click()
            expect(page.locator("html")).to_have_attribute("data-theme", "dark")
            assert "/zh/showcase.html" in page.url
            assert not errors, errors
            context = browser.new_context(java_script_enabled=False)
            nojs = context.new_page()
            nojs.goto(base + "showcase.html")
            assert nojs.locator(".loader").is_hidden()
            assert nojs.locator("[data-preview-panel]:visible").count() == 4
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
    print("PASS: 30 localized pages, responsive layouts, four demos, deep links, theme and no-JS fallback")


if __name__ == "__main__":
    run()
