"""Verify Mini Street deep links, history and accessible fallbacks."""
from functools import partial
import base64
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ROUTE = "/demos/corporate/gjh/mini-street/"


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/slow-test.gif":
            time.sleep(2)
            image = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Content-Length", str(len(image)))
            self.end_headers()
            self.wfile.write(image)
            return
        super().do_GET()


def main():
    handler = partial(Quiet, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}{ROUTE}"
        with sync_playwright() as p:
            browser_name = os.environ.get("MINI_STREET_BROWSER", "chromium")
            if browser_name == "chromium":
                chrome = os.environ.get("GALLERY_CHROME")
                browser = p.chromium.launch(executable_path=chrome, channel=None if chrome else "chrome", headless=True)
            elif browser_name == "webkit":
                browser = p.webkit.launch(headless=True)
            else:
                raise ValueError(f"Unsupported browser: {browser_name}")
            try:
                context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                for fragment in ("shop", "vending"):
                    page.goto(base + "?source=test#" + fragment, wait_until="domcontentloaded")
                    expect(page.locator(f"dialog[open] #{fragment}")).to_be_visible()
                    expect(page.locator(f"#{fragment}-title")).to_be_focused()
                    if fragment == "vending":
                        page.locator("[data-vend=cloud]").click()
                        expect(page.locator(".vending-result")).to_contain_text("cloud charm")
                    page.locator("dialog[open] .close").click()
                    expect(page.locator("dialog")).not_to_have_attribute("open", "")
                    expect(page).to_have_url(base + "?source=test")
                    expect(page.locator(f"[data-stop={fragment}]")).to_be_focused()

                page.goto(base, wait_until="domcontentloaded")
                # Opening the link target in a separate tab exercises the same
                # navigation as a browser's open-in-new-tab command.
                href = page.locator("[data-stop=shop]").get_attribute("href")
                popup = context.new_page()
                popup.goto(base + href, wait_until="domcontentloaded")
                expect(popup.locator("dialog[open] #shop")).to_be_visible()
                assert popup.url.endswith("#shop"), popup.url
                popup.close()
                page.locator("[data-stop=shop]").click()
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                assert page.url.endswith("#shop"), page.url
                page.go_back(wait_until="domcontentloaded")
                expect(page.locator("dialog")).not_to_have_attribute("open", "")
                expect(page).to_have_url(base)
                page.go_forward(wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                page.evaluate("location.hash = '#vending'")
                expect(page.locator("dialog[open] #vending")).to_be_visible()
                page.keyboard.press("Escape")
                expect(page.locator("dialog")).not_to_have_attribute("open", "")
                expect(page).to_have_url(base)
                expect(page.locator("[data-stop=vending]")).to_be_focused()
                page.goto(base + "?before", wait_until="domcontentloaded")
                page.goto(base + "?history", wait_until="domcontentloaded")
                page.locator("[data-stop=shop]").click()
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                page.locator("dialog[open] .close").click()
                expect(page).to_have_url(base + "?history")
                page.go_back(wait_until="domcontentloaded")
                expect(page).to_have_url(base + "?before")
                page.goto(base + "#%73hop", wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                assert not errors, errors
                context.close()

                context = browser.new_context(service_workers="block")
                context.add_init_script("""document.addEventListener('DOMContentLoaded', () => {
                  const image = new Image(); image.src = '/slow-test.gif'; document.body.append(image);
                });""")
                page = context.new_page()
                page.goto(base + "#shop", wait_until="domcontentloaded")
                state = page.evaluate("""() => ({ready: document.readyState,
                  open: document.querySelector('dialog').open,
                  shopVisible: !document.querySelector('#shop').hidden})""")
                assert state == {"ready": "interactive", "open": True, "shopVisible": True}, state
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                page.wait_for_load_state("load")
                expect(page.locator("#shop-title")).to_be_focused()
                page.locator("dialog[open] .close").click()
                expect(page).to_have_url(base)
                page.goto(base, wait_until="domcontentloaded")
                page.locator("[data-stop=vending]").click()
                page.locator("[data-vend=cloud]").focus()
                page.locator("[data-vend=cloud]").press("Enter")
                expect(page.locator(".vending-result")).to_contain_text("cloud charm")
                page.wait_for_load_state("load")
                expect(page.locator(".vending-result")).to_contain_text("cloud charm")
                expect(page.locator("[data-vend=cloud]")).to_be_focused()
                context.close()

                context = browser.new_context(java_script_enabled=False, service_workers="block")
                page = context.new_page()
                for fragment in ("shop", "vending"):
                    page.goto(base + "#" + fragment, wait_until="domcontentloaded")
                    expect(page.locator("#" + fragment)).to_be_visible()
                context.close()

                context = browser.new_context(service_workers="block")
                context.add_init_script("""const original = HTMLCanvasElement.prototype.getContext;
                  HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
                    return kind === 'webgl' || kind === 'webgl2' ? null : original.call(this, kind, ...args);
                  };""")
                page = context.new_page()
                page.goto(base + "#shop", wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                expect(page.locator("#scene-status")).to_contain_text("unavailable")
                context.close()
                print("PASS: direct and encoded links, new tab, close/history/focus, slow load, no-JS and WebGL fallback")
            finally:
                browser.close()


if __name__ == "__main__":
    main()
