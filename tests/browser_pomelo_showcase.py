"""Exercise the actual Product Showcase routes with a real browser."""
import functools
import http.server
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = "/demos/corporate/pomelo-stem/v5/"


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_port}{BASE_PATH}"
    try:
        with sync_playwright() as pw:
            import os
            chrome = os.environ.get("GALLERY_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
            browser = pw.chromium.launch(headless=True, executable_path=chrome)
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            for locale in ("", "zh/", "ms/"):
                for name in ("index", "showcase", "story", "services", "contact"):
                    response = page.goto(base + locale + name + ".html", wait_until="load")
                    assert response.status == 200, (locale, name)
                    assert page.locator("h1").count() == 1, (locale, name)
                    assert page.locator(".loader").is_hidden(), (locale, name)
                    for image in page.locator("img:not(.loader img)").all():
                        image.scroll_into_view_if_needed()
                        assert image.evaluate("image => image.complete && image.naturalWidth > 0"), (locale, name)
                    for width in (1440, 768, 390, 320):
                        page.set_viewport_size({"width": width, "height": 900})
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (locale, name, width)
            page.set_viewport_size({"width": 1440, "height": 900})
            page.goto(base)
            page.evaluate("localStorage.setItem('pomelo-showcase-theme', 'light')")
            page.reload()
            page.locator("[data-theme-toggle]").click()
            assert page.locator("html").get_attribute("data-theme") == "dark"
            page.goto(base + "services.html")
            assert page.locator("html").get_attribute("data-theme") == "dark"
            page.locator(".languages summary").click()
            page.locator('.languages-menu a[lang="zh-Hans"]').click()
            assert page.url.endswith("/zh/services.html")
            assert page.locator("html").get_attribute("data-theme") == "dark"
            page.goto(base + "showcase.html")
            page.locator('[data-panel="p2"]').click()
            assert page.locator('[data-preview-panel="p2"]').is_visible()
            assert page.locator("[data-preview-panel]:visible").count() == 1
            page.goto(base + "story.html")
            assert page.locator("article.chapter").count() == 4
            page.locator('a[href="#chapter-4"]').click()
            assert page.url.endswith("#chapter-4")
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
    print("PASS: 15 localized routes, responsive layouts, theme persistence, showcase, story and no-JS fallback")


if __name__ == "__main__":
    run()
