"""Browser verification for a built Mini Street release.

Pass the directory produced by `python scripts/build_gallery.py --output`.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

ROUTE = "/demos/corporate/gjh/mini-street/"
SEL = "#mini-update"
STATUS = "#mini-update-status"


class ReleaseHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        url = urlsplit(self.path)
        key = parse_qs(url.query).get("mini-street-update", [""])[0]
        server = self.server
        if url.path in (ROUTE, ROUTE + "index.html"):
            build = server.document_build
            if key.startswith(server.stale_navigation) and self.headers.get("Sec-Fetch-Mode") == "navigate":
                build = server.initial["build"]
            self.respond(server.index.replace(server.initial["build"], build), "text/html")
        elif url.path == ROUTE + "release.json":
            if server.release_build is None:
                self.send_error(503)
                return
            self.respond(json.dumps({**server.initial, "build": server.release_build}), "application/json")
        else:
            super().do_GET()

    def respond(self, text, mime_type):
        payload = text.encode()
        self.send_response(200)
        self.send_header("Content-Type", f"{mime_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "max-age=3600")
        self.end_headers()
        self.wfile.write(payload)


def run(site):
    app = site / ROUTE.strip("/")
    handler = partial(ReleaseHandler, directory=site)
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server, sync_playwright() as tools:
        server.index = (app / "index.html").read_text(encoding="utf-8")
        server.initial = json.loads((app / "release.json").read_text(encoding="utf-8"))
        initial = server.initial["build"]
        latest = "a" * 16 if initial != "a" * 16 else "b" * 16
        server.release_build = initial
        server.document_build = initial
        server.stale_navigation = "disabled"
        Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}{ROUTE}"
        chrome = os.environ.get("GALLERY_CHROME")
        browser = tools.chromium.launch(executable_path=chrome, channel=None if chrome else "chrome", headless=True,
                                        args=["--enable-unsafe-swiftshader"])
        context = browser.new_context(reduced_motion="reduce", service_workers="allow")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        site_url = base + "?source=update-test#street"
        page.goto(site_url, wait_until="domcontentloaded")
        button = page.locator(SEL)
        status = page.locator(STATUS)
        expect(button).to_be_enabled()
        expect(page.locator("#mini-version")).to_contain_text(initial[:8])
        expect(page.locator("#stage")).to_have_attribute("data-webgl", "", timeout=15000)
        nav_count = page.evaluate("performance.getEntriesByType('navigation').length")
        button.press("Enter")
        expect(status).to_contain_text("up to date")
        assert page.evaluate("performance.getEntriesByType('navigation').length") == nav_count

        server.release_build = latest
        button.click()
        expect(button).to_have_attribute("data-state", "error")
        expect(status).to_contain_text("could not be verified")
        expect(page.locator("#mini-version")).to_contain_text(initial[:8])

        context.set_offline(True)
        expect(button).to_have_attribute("data-state", "offline")
        button.click()
        expect(status).to_contain_text("offline")
        context.set_offline(False)

        server.document_build = latest
        button.click()
        expect(button).to_have_attribute("data-state", "available")
        expect(button).to_have_accessible_name("Apply update")
        expect(page.locator("#mini-version")).to_contain_text(initial[:8])
        assert page.url == site_url, page.url
        assert button.locator("svg").evaluate("(svg) => getComputedStyle(svg).animationName") == "none"
        # A restored document must ask the user to check again before applying.
        page.evaluate("dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}))")
        expect(button).to_have_attribute("data-state", "idle")
        button.click()
        expect(button).to_have_attribute("data-state", "available")

        page.evaluate("""() => localStorage.setItem(
          'gjh-mini-street:basket:v2', JSON.stringify({version: 2, items: {'nz-425g': 2}})
        )""")
        second = context.new_page()
        second.goto(site_url, wait_until="domcontentloaded")  # Existing cached tab remains on its own build.
        expect(second.locator("#mini-version")).to_contain_text(initial[:8])
        server.stale_navigation = latest + "."
        button.click()
        expect(status).to_contain_text("new build did not load")
        expect(page.locator("#mini-version")).to_contain_text(initial[:8])
        expect(page).to_have_url(site_url)

        server.stale_navigation = "disabled"
        button.click()
        expect(button).to_have_attribute("data-state", "available")
        button.click()
        expect(status).to_contain_text("Updated to")
        expect(page.locator("#mini-version")).to_contain_text(latest[:8])
        expect(page).to_have_url(site_url)
        assert page.evaluate("JSON.parse(localStorage.getItem('gjh-mini-street:basket:v2')).items['nz-425g']") == 2
        expect(second.locator("#mini-version")).to_contain_text(initial[:8])
        assert errors == [], errors

        private = browser.new_context(service_workers="allow")
        private.add_init_script("""Object.defineProperty(window, 'localStorage', {
          get: () => { throw new DOMException('Storage disabled', 'SecurityError'); },
        })""")
        private_page = private.new_page()
        private_page.goto(site_url, wait_until="domcontentloaded")
        expect(private_page.locator(SEL)).to_be_enabled()
        server.release_build = None
        private_page.locator(SEL).click()
        expect(private_page.locator(SEL)).to_have_attribute("data-state", "error")
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    run(parser.parse_args().site.resolve())
    print("Mini Street update browser checks passed")
