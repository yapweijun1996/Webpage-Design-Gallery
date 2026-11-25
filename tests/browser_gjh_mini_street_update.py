"""Browser verification for a built Mini Street release.

Pass the directory produced by `python scripts/build_gallery.py --output`.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
from threading import Thread
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

ROUTE = "/demos/corporate/gjh/mini-street/"
SEL = "#mini-update"
STATUS = "#mini-update-status"
APPLY_TIMEOUT = 20000


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


def apply_update(page, button, build):
    target = re.compile(rf"[?&]mini-street-update={build}\.[a-z0-9]+")
    with page.expect_navigation(url=target, wait_until="domcontentloaded", timeout=APPLY_TIMEOUT):
        button.click()


def expect_version(page, version, build):
    badge = page.locator("#mini-version")
    expect(badge).to_be_visible()
    expect(badge).to_have_text(f"v{version}")
    expect(badge).to_have_attribute("title", f"v{version} · {build}")


def expect_status(status, text):
    expect(status).to_be_visible()
    expect(status).to_be_in_viewport()
    expect(status.locator("[data-update-message]")).to_contain_text(text)
    assert status.bounding_box()["height"] >= 16

def run(site):
    app = site / ROUTE.strip("/")
    handler = partial(ReleaseHandler, directory=site)
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server, sync_playwright() as tools:
        server.index = (app / "index.html").read_text(encoding="utf-8")
        server.initial = json.loads((app / "release.json").read_text(encoding="utf-8"))
        version = server.initial["version"]
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
        expect_version(page, version, initial)
        expect(page.locator("#stage")).to_have_attribute("data-webgl", "", timeout=15000)
        nav_count = page.evaluate("performance.getEntriesByType('navigation').length")
        button.press("Enter")
        expect_status(status, "up to date")
        expect(status.locator("[data-installed-build]")).to_have_text(f"Installed build · v{version} · {initial}")
        assert page.evaluate("performance.getEntriesByType('navigation').length") == nav_count

        second = context.new_page()
        second.goto(base + "?source=second-tab", wait_until="domcontentloaded")
        expect_version(second, version, initial)

        server.release_build = latest
        button.click()
        expect(button).to_have_attribute("data-state", "error")
        expect_status(status, "could not be verified")
        expect_version(page, version, initial)

        context.set_offline(True)
        expect(button).to_have_attribute("data-state", "offline")
        button.click()
        expect_status(status, "offline")
        context.set_offline(False)

        server.document_build = latest
        button.click()
        expect(button).to_have_attribute("data-state", "available")
        expect(button).to_have_accessible_name("Apply update")
        expect(button.locator("[data-update-label]")).to_be_visible()
        expect_status(status, f"Update available · v{version} · {latest}")
        expect_version(page, version, initial)
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
        server.stale_navigation = latest + "."
        apply_update(page, button, latest)
        expect(button).to_have_attribute("data-state", "error")
        expect_status(status, "new build did not load")
        expect_version(page, version, initial)
        expect(page).to_have_url(site_url)

        server.stale_navigation = "disabled"
        button.click()
        expect(button).to_have_attribute("data-state", "available")
        apply_update(page, button, latest)
        expect(button).to_have_attribute("data-state", "current")
        expect_status(status, f"Updated to v{version} · {latest}.")
        expect_version(page, version, latest)
        expect(page).to_have_url(site_url)
        assert page.evaluate("JSON.parse(localStorage.getItem('gjh-mini-street:basket:v2')).items['nz-425g']") == 2
        expect_version(second, version, initial)
        assert errors == [], errors

        private = browser.new_context(service_workers="allow")
        private.add_init_script("""Object.defineProperty(window, 'localStorage', {
          get: () => { throw new DOMException('Storage disabled', 'SecurityError'); },
        });
        Object.defineProperty(navigator, 'onLine', {get: () => false});""")
        private_page = private.new_page()
        private_page.goto(site_url, wait_until="domcontentloaded")
        private_button = private_page.locator(SEL)
        private_status = private_page.locator(STATUS)
        expect(private_button).to_have_attribute("data-state", "idle")
        private_button.click()
        expect_status(private_status, "up to date")
        server.release_build = None
        private_button.click()
        expect(private_button).to_have_attribute("data-state", "error")
        expect_status(private_status, "could not be verified")
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    run(parser.parse_args().site.resolve())
    print("Mini Street update browser checks passed")
