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
from time import sleep
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_multi_product import PRODUCTS, inspect_product, route_camera

ROUTE = "/demos/corporate/gjh/mini-street/"
SEL = "#mini-update"
STATUS = "#mini-update-status"
ACTION = f"{STATUS} [data-update-action]"
DISMISS = f"{STATUS} [data-update-dismiss]"
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
            sleep(server.release_delay)
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
    expect(badge).to_have_text(f"v{version} · {build[:8]}")
    expect(badge).to_have_attribute("title", f"v{version} · {build}")
    assert badge.evaluate("""el => {
      const button = el.closest('button').getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(el);
      return range.getClientRects().length === 1 && box.left >= button.left && box.right <= button.right;
    }"""), "The version and short build must fit on one line inside the button"


def expect_status(status, text):
    expect(status).to_be_visible()
    expect(status).to_be_in_viewport()
    expect(status.locator("[data-update-message]")).to_contain_text(text)
    assert status.bounding_box()["height"] >= 16

def layout(page):
    return page.evaluate("""() => Object.fromEntries(
        ['.masthead', '#mini-update', '#stage', '.scene-shop-entry', '.stops'].map(selector => {
            const {x, y, width, height} = document.querySelector(selector).getBoundingClientRect();
            return [selector, [x, y, width, height]];
        })
    )""")


def record(page, directory, name):
    if directory:
        page.screenshot(path=str(directory / f"{name}.png"), animations="disabled")


def permit_shop_camera_fixture(route):
    response = route.fetch()
    page = response.text()
    match = re.search(r'<script type="importmap">(.*?)</script>', page, re.S)
    assert match
    import_map = json.loads(match.group(1))
    # Only the fixture's camera-position module may have modified bytes.
    del import_map["integrity"][import_map["imports"]["./shop-interior.js"]]
    page = page[:match.start(1)] + json.dumps(import_map) + page[match.end(1):]
    route.fulfill(response=response, body=page)


def check_shop_priority(browser, base, server):
    page = browser.new_page(viewport={"width": 320, "height": 568},
                            reduced_motion="reduce", service_workers="block")
    url = base + "?source=shop-update-priority"
    page.route(url, permit_shop_camera_fixture)
    page.route("**/mini-street/shop-interior.js?build=*", route_camera)
    page.goto(url, wait_until="domcontentloaded")
    button = page.locator(SEL)
    status = page.locator(STATUS)
    live = page.locator("#mini-update-announcement")
    server.release_build = None
    button.press("Enter")
    expect_status(status, "could not be verified")
    expect(live).to_contain_text("could not be verified")
    page.locator(".scene-shop-entry").click(timeout=15000)
    expect(page.locator("#stage")).to_have_attribute("data-interior", "")
    # The compact shop masthead hides the update trigger, so exercise an
    # existing notice rather than trying to activate a non-visible control.
    expect(button).to_be_hidden()
    expect_status(status, "could not be verified")

    australia = PRODUCTS[0]
    product = inspect_product(page, australia)
    expect(status).to_be_hidden()
    expect(live).to_be_empty()
    expect(page.get_by_role("button", name="Check again", exact=True)).to_have_count(0)
    product.get_by_role("button", name="Add to basket", exact=True).click()
    expect(product).to_be_hidden()
    review = page.get_by_role("button", name="View basket", exact=True)
    expect(review).to_be_focused()
    expect(status).to_be_hidden()

    # This native click previously hit the overlapping update CTA.
    review.click()
    basket = page.get_by_role("dialog", name="Virtual basket", exact=True)
    expect(basket.get_by_text(australia.name, exact=True)).to_be_visible()
    expect(status).to_be_hidden()
    basket.get_by_role("button", name="Continue shopping", exact=True).click()
    expect_status(status, "could not be verified")
    expect(live).to_be_empty()  # The unchanged status has already been announced.

    product = inspect_product(page, australia)
    product.get_by_role("button", name="Add to basket", exact=True).click()
    expect(review).to_be_focused()
    expect(page.get_by_role("button", name="Basket, 2 items", exact=True)).to_be_visible()
    page.get_by_role("button", name="Exit shop").click()
    expect(page.locator("#stage")).not_to_have_attribute("data-interior", "")
    expect(button).to_be_visible()
    server.release_build = server.document_build
    button.click()
    expect(review).to_be_hidden()
    expect_status(status, "up to date")
    expect(live).to_contain_text("up to date")
    page.close()


def run(site, evidence=None):
    if evidence:
        evidence.mkdir(parents=True, exist_ok=True)
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
        server.release_delay = 0
        Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}{ROUTE}"
        chrome = os.environ.get("GALLERY_CHROME")
        browser = tools.chromium.launch(executable_path=chrome, channel=None if chrome else "chrome", headless=True,
                                        args=["--enable-unsafe-swiftshader"])
        context = browser.new_context(viewport={"width": 390, "height": 844},
                                      reduced_motion="reduce", service_workers="allow")
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
        page.evaluate("scrollTo(0, 0)")
        expect(page.locator(".scene-shop-entry")).to_be_visible()
        baseline = layout(page)
        live = page.locator("#mini-update-announcement")
        expect(live).to_have_attribute("role", "status")
        expect(live).to_have_attribute("aria-atomic", "true")
        expect(button).to_have_accessible_description(f"Installed build · v{version} · {initial}")
        expect(status).to_be_hidden()
        server.release_delay = 0.8
        button.press("Enter")
        expect_status(status, "Checking for updates")
        assert layout(page) == baseline
        expect(button).to_be_focused()
        expect_status(status, "up to date")
        expect(live).to_contain_text("up to date")
        assert layout(page) == baseline
        assert status.evaluate("(element) => getComputedStyle(element).position") == "fixed"
        record(page, evidence, "mini-street-update-up-to-date-390")
        expect(status).to_be_hidden(timeout=8000)
        assert layout(page) == baseline
        server.release_delay = 0
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
        assert layout(page) == baseline
        record(page, evidence, "mini-street-update-error-390")
        expect(page.locator(ACTION)).to_have_accessible_name("Check again")
        page.locator(DISMISS).press("Enter")
        expect(status).to_be_hidden()
        expect(button).to_be_focused()
        expect_version(page, version, initial)

        context.set_offline(True)
        expect(button).to_have_attribute("data-state", "offline")
        button.click()
        expect_status(status, "offline")
        context.set_offline(False)

        server.document_build = latest
        button.click()
        expect(button).to_have_attribute("data-state", "available")
        action = page.locator(ACTION)
        expect(button).to_have_accessible_name("Check for updates")
        expect(action).to_have_accessible_name("Apply update")
        expect(button.locator("[data-update-label]")).to_be_visible()
        expect_status(status, f"Update available · v{version} · {latest}")
        assert layout(page) == baseline
        toast = status.bounding_box()
        assert toast["x"] >= 12 and toast["x"] + toast["width"] <= 378
        _, shop_y, _, shop_height = baseline[".scene-shop-entry"]
        assert toast["y"] > shop_y + shop_height
        assert toast["y"] + toast["height"] < baseline[".stops"][1]
        page.locator("#mini-language").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(status).to_be_hidden()
        page.locator("#mini-language-choice").select_option("zh-Hans")
        page.get_by_role("dialog").locator("button[type=submit]").click()
        expect(action).to_have_accessible_name("应用更新")
        expect(live).to_contain_text("有可用更新")
        expect(status).to_be_visible()
        record(page, evidence, "mini-street-update-available-zh-390")
        page.locator("#mini-language").click()
        page.locator("#mini-language-choice").select_option("en")
        page.get_by_role("dialog").locator("button[type=submit]").click()
        record(page, evidence, "mini-street-update-available-390")
        assert action.bounding_box()["height"] >= 44
        assert page.locator(DISMISS).bounding_box()["height"] >= 44
        expect(status).to_be_visible()
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
        apply_update(page, action, latest)
        expect(button).to_have_attribute("data-state", "error")
        expect_status(status, "new build did not load")
        expect_version(page, version, initial)
        expect(page).to_have_url(site_url)

        server.stale_navigation = "disabled"
        button.click()
        expect(button).to_have_attribute("data-state", "available")
        apply_update(page, action, latest)
        expect(button).to_have_attribute("data-state", "current")
        expect_status(status, f"Updated to v{version} · {latest}.")
        expect_version(page, version, latest)
        expect(page).to_have_url(site_url)
        assert page.evaluate("JSON.parse(localStorage.getItem('gjh-mini-street:basket:v2')).items['nz-425g']") == 2
        expect_version(second, version, initial)
        assert errors == [], errors

        # The visible build must fit in the compact header in all supported languages.
        for language in ("en", "zh-Hans", "ms"):
            landscape = browser.new_context(viewport={"width": 568, "height": 320},
                                            has_touch=True, is_mobile=True, service_workers="block")
            landscape.add_init_script(f"localStorage.setItem('wdg.language', '{language}')")
            landscape_page = landscape.new_page()
            landscape_page.goto(site_url, wait_until="domcontentloaded")
            expect_version(landscape_page, version, latest)
            assert landscape_page.evaluate("document.documentElement.scrollWidth <= innerWidth"), language
            assert landscape_page.locator(SEL).bounding_box()["x"] + landscape_page.locator(SEL).bounding_box()["width"] <= 568, language
            landscape.close()

        private = browser.new_context(viewport={"width": 320, "height": 568}, service_workers="allow")
        private.add_init_script("""Object.defineProperty(window, 'localStorage', {
          get: () => { throw new DOMException('Storage disabled', 'SecurityError'); },
        });
        Object.defineProperty(navigator, 'onLine', {get: () => false});""")
        private_page = private.new_page()
        private_page.goto(site_url, wait_until="domcontentloaded")
        private_button = private_page.locator(SEL)
        private_status = private_page.locator(STATUS)
        expect(private_button).to_have_attribute("data-state", "idle")
        expect_version(private_page, version, latest)
        private_button.click()
        expect_status(private_status, "up to date")
        server.release_build = None
        private_button.click()
        expect(private_button).to_have_attribute("data-state", "error")
        expect_status(private_status, "could not be verified")
        assert private_page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        if private_page.locator(".scene-shop-entry").is_visible():
            narrow_shop = private_page.locator(".scene-shop-entry").bounding_box()
            assert private_status.bounding_box()["y"] > narrow_shop["y"] + narrow_shop["height"]
        record(private_page, evidence, "mini-street-update-error-320")
        private.close()
        second.close()
        page.close()
        check_shop_priority(browser, base, server)
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("site", type=Path)
    parser.add_argument("--evidence", type=Path)
    args = parser.parse_args()
    run(args.site.resolve(), args.evidence)
    print("Mini Street update browser checks passed")
