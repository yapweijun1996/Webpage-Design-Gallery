"""Verify Mini Street deep links, drink vending, history and accessible fallbacks."""
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


def pause_drop(serve):
    serve.evaluate("""button => {
      button.click();
      button.click();
      document.querySelector('.vending-flight').getAnimations()[0].pause();
    }""")


def exercise_vending(page):
    machine = page.locator(".vending-machine")
    message = machine.get_by_role("status")
    lime = machine.locator("[data-slot=A1]")
    peach = machine.locator("[data-slot=A2]")
    serve = machine.get_by_role("button", name="Vend", exact=True)
    tray = machine.get_by_role("button", name="Collect drink", exact=True)
    expect(machine.locator(".vending-slot")).to_have_count(6)
    expect(serve).to_be_disabled()
    expect(tray).to_be_disabled()

    lime.press("Enter")
    expect(lime).to_have_attribute("aria-pressed", "true")
    peach.press("Enter")
    expect(lime).to_have_attribute("aria-pressed", "false")
    expect(peach).to_have_attribute("aria-pressed", "true")
    expect(message).to_have_text("A2 · Peach Tea")
    serve.focus()
    pause_drop(serve)
    expect(machine).to_have_attribute("data-phase", "dispensing")
    expect(machine.locator(".vending-flight[data-shape=bottle]")).to_have_count(1)
    expect(tray).to_be_disabled()
    expect(serve).to_be_disabled()
    expect(lime).to_be_disabled()
    machine.locator(".vending-flight").evaluate("drink => drink.getAnimations()[0].finish()")
    expect(message).to_have_text("Peach Tea ready in the tray")
    expect(machine.locator(".vending-pocket .drink-art[data-shape=bottle]")).to_be_visible()
    expect(tray).to_be_focused()
    tray.press("Enter")
    expect(message).to_have_text("Collected. Choose again.")
    expect(machine.locator(".vending-pocket .drink-art")).to_have_count(0)
    expect(peach).to_be_focused()

    lime.click()
    serve.press("Enter")
    expect(message).to_have_text("Lime Soda ready in the tray")
    expect(machine.locator(".vending-pocket .drink-art[data-shape=can]")).to_be_visible()
    tray.click()
    lime.click()
    pause_drop(serve)


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
                # Exercise the original HTML animation and history with the optional viewer unavailable.
                context.route("**/vending-viewer.js", lambda route: route.abort())
                context.route("**/mini-street/scene.js", lambda route: route.abort())
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                for fragment in ("shop", "vending"):
                    page.goto(base + "?source=test#" + fragment, wait_until="domcontentloaded")
                    expect(page.locator(f"dialog[open] #{fragment}")).to_be_visible()
                    expect(page.locator(f"#{fragment}-title")).to_be_focused()
                    if fragment == "vending":
                        exercise_vending(page)
                    page.locator("dialog[open] .close").click()
                    expect(page.locator("#stop-dialog")).not_to_have_attribute("open", "")
                    expect(page).to_have_url(base + "?source=test")
                    expect(page.locator(f"[data-stop={fragment}]")).to_be_focused()
                    if fragment == "vending":
                        page.locator("[data-stop=vending]").click()
                        expect(page.locator(".vending-message")).to_have_text("Choose a drink")
                        expect(page.locator(".vending-flight")).to_have_count(0)
                        expect(page.locator(".vending-slot[aria-pressed=true]")).to_have_count(0)
                        page.locator("[data-slot=B2]").click()
                        pause_drop(page.get_by_role("button", name="Vend", exact=True))
                        page.go_back(wait_until="domcontentloaded")
                        expect(page.locator("#stop-dialog")).not_to_have_attribute("open", "")
                        page.go_forward(wait_until="domcontentloaded")
                        expect(page.locator("dialog[open] #vending")).to_be_visible()
                        expect(page.locator(".vending-message")).to_have_text("Choose a drink")
                        expect(page.locator(".vending-flight")).to_have_count(0)

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
                expect(page.locator("#stop-dialog")).not_to_have_attribute("open", "")
                expect(page).to_have_url(base)
                page.go_forward(wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                page.evaluate("location.hash = '#vending'")
                expect(page.locator("dialog[open] #vending")).to_be_visible()
                page.locator("[data-slot=B3]").click()
                pause_drop(page.get_by_role("button", name="Vend", exact=True))
                page.go_back(wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                expect(page.locator(".vending-flight")).to_have_count(0)
                page.go_forward(wait_until="domcontentloaded")
                expect(page.locator(".vending-message")).to_have_text("Choose a drink")
                page.keyboard.press("Escape")
                expect(page.locator("#stop-dialog")).not_to_have_attribute("open", "")
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
                page.goto(base + "?reopen", wait_until="domcontentloaded")
                page.locator("[data-stop=vending]").click()
                page.locator("[data-slot=A1]").click()
                page.evaluate("""() => {
                  window.addEventListener("hashchange", () => window.reopenBackFinished = true, {once: true});
                  document.querySelector("dialog[open] .close").click();
                  document.querySelector("[data-stop=vending]").click();
                }""")
                page.wait_for_function("window.reopenBackFinished === true")
                expect(page).to_have_url(base + "?reopen#vending")
                expect(page.locator("dialog[open] #vending")).to_be_visible()
                expect(page.locator("#vending-title")).to_be_focused()
                expect(page.locator(".vending-message")).to_have_text("Choose a drink")
                page.go_back(wait_until="domcontentloaded")
                expect(page).to_have_url(base + "?reopen")
                expect(page.locator("#stop-dialog")).not_to_have_attribute("open", "")
                page.go_forward(wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #vending")).to_be_visible()

                page.goto(base + "#%73hop", wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                assert not errors, errors
                context.close()

                context = browser.new_context(service_workers="block")
                context.route("**/mini-street/scene.js", lambda route: route.abort())
                context.add_init_script("""document.addEventListener('DOMContentLoaded', () => {
                  const image = new Image(); image.src = '/slow-test.gif'; document.body.append(image);
                });""")
                page = context.new_page()
                page.goto(base + "#shop", wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                state = page.evaluate("""() => ({ready: document.readyState,
                  open: document.querySelector('#stop-dialog').open,
                  shopVisible: !document.querySelector('#shop').hidden})""")
                assert state == {"ready": "interactive", "open": True, "shopVisible": True}, state
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                page.wait_for_load_state("load")
                expect(page.locator("#shop-title")).to_be_focused()
                page.locator("dialog[open] .close").click()
                expect(page).to_have_url(base)
                page.goto(base, wait_until="domcontentloaded")
                page.locator("[data-stop=vending]").click()
                lime = page.locator("[data-slot=A1]")
                lime.press("Enter")
                expect(page.locator(".vending-message")).to_have_text("A1 · Lime Soda")
                page.wait_for_load_state("load")
                expect(page.locator(".vending-message")).to_have_text("A1 · Lime Soda")
                expect(lime).to_be_focused()
                context.close()

                context = browser.new_context(java_script_enabled=False, service_workers="block")
                page = context.new_page()
                for fragment in ("shop", "vending"):
                    page.goto(base + "#" + fragment, wait_until="domcontentloaded")
                    expect(page.locator("#" + fragment)).to_be_visible()
                expect(page.locator("#vending-note")).to_contain_text("requires JavaScript")
                expect(page.locator(".vending-machine")).to_be_hidden()
                context.close()

                context = browser.new_context(viewport={"width": 320, "height": 568}, reduced_motion="reduce",
                                              service_workers="block")
                context.add_init_script("""const original = HTMLCanvasElement.prototype.getContext;
                  HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
                    return kind === 'webgl' || kind === 'webgl2' ? null : original.call(this, kind, ...args);
                  };""")
                page = context.new_page()
                page.goto(base + "#shop", wait_until="domcontentloaded")
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                expect(page.locator("#scene-status")).to_contain_text("unavailable")
                page.evaluate("location.hash = '#vending'")
                page.locator("[data-slot=B2]").click()
                phase = page.get_by_role("button", name="Vend", exact=True).evaluate("""button => {
                  button.click();
                  return button.closest('.vending-machine').dataset.phase;
                }""")
                assert phase == "ready", phase
                expect(page.locator(".vending-flight")).to_have_count(0)
                expect(page.locator(".vending-message")).to_have_text("Still Water ready in the tray")
                page.get_by_role("button", name="Collect drink", exact=True).click()
                expect(page.locator(".vending-message")).to_have_text("Collected. Choose again.")
                context.close()
                # A stalled browser animation still completes; closing cancels the fallback.
                context = browser.new_context(reduced_motion="no-preference", service_workers="block")
                context.route("**/vending-viewer.js", lambda route: route.abort())
                context.add_init_script("""Element.prototype.animate = function() {
                  return {finished: new Promise(() => {}), cancel() {}};
                };""")
                page = context.new_page()
                page.goto(base + "#vending", wait_until="domcontentloaded")
                page.locator("[data-slot=A1]").click()
                page.get_by_role("button", name="Vend", exact=True).click()
                expect(page.locator(".vending-message")).to_have_text("Lime Soda ready in the tray", timeout=5000)
                page.get_by_role("button", name="Collect drink", exact=True).click()
                page.locator("[data-slot=A2]").click()
                page.get_by_role("button", name="Vend", exact=True).click()
                page.locator("dialog[open] .close").click()
                expect(page).to_have_url(base)
                page.wait_for_timeout(1800)
                page.locator("[data-stop=vending]").click()
                expect(page.locator(".vending-message")).to_have_text("Choose a drink")
                expect(page.locator(".vending-pocket .drink-art")).to_have_count(0)
                context.close()

                # A missing optional vending module must not break the shop or mall links.
                context = browser.new_context(service_workers="block")
                context.route("**/vending.js", lambda route: route.fulfill(status=404, body="missing"))
                page = context.new_page()
                page.goto(base, wait_until="domcontentloaded")
                page.locator("[data-stop=shop]").click()
                expect(page.locator("dialog[open] #shop")).to_be_visible()
                page.locator("dialog[open] .close").click()
                expect(page).to_have_url(base)
                page.locator("[data-stop=vending]").click()
                expect(page.locator("#vending-note")).to_contain_text("could not load")
                expect(page.locator(".vending-machine")).to_be_hidden()
                assert page.locator("[data-stop=mall]").get_attribute("href") == "../v11/"
                context.close()
                print("PASS: drink vending, direct links, new tab, close/history/focus, slow load, reduced motion and fallbacks")
            finally:
                browser.close()


if __name__ == "__main__":
    main()
