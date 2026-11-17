"""Exercise the Yeo's drinks explorer. Use --capture to refresh gallery previews."""

import argparse
import functools
import http.server
import io
import os
import re
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO_PATH = "demos/food-beverage/yeos/v1"
VIEWPORTS = ((1440, 900), (768, 1024), (390, 844), (320, 720))
PRODUCT_LINK = 'a[href^="https://yeos.com.sg/product/"]'
FAMILY_PRODUCTS = {
    "Soy": {"soy-bean-milk", "black-soy-milk-2"},
    "Tea": {"chrysanthemum-tea", "jasmine-green-tea"},
    "Asian drinks": {"lychee-drink", "bandung-rose-syrup-milk-drink"},
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def check_filters(page):
    visible = page.locator("#drinks article[data-family]:visible")
    expect(visible).to_have_count(6)
    for label, expected_products in FAMILY_PRODUCTS.items():
        page.get_by_role("button", name=label, exact=True).press("Enter")
        expect(visible).to_have_count(2)
        products = {link.get_attribute("href").rstrip("/").rsplit("/", 1)[-1]
                    for link in visible.locator(PRODUCT_LINK).all()}
        assert products == expected_products, (label, products)
    page.get_by_role("button", name="All drinks", exact=True).click()
    expect(visible).to_have_count(6)


def check_featured_drinks(page):
    link = page.locator("#featured-link")
    image = page.locator("#featured-image")
    previous = page.get_by_role("button", name="Previous featured drink")
    next_drink = page.get_by_role("button", name="Next featured drink")
    initial_image = image.get_attribute("src")
    expect(link).to_have_js_property("hash", "#chrysanthemum")
    previous.click()
    expect(link).to_have_js_property("hash", "#lychee")
    expect(link).to_have_text(page.locator("#lychee h3").inner_text())
    expect(image).to_have_attribute("src", page.locator("#lychee img").get_attribute("src"))
    next_drink.click()
    expect(link).to_have_js_property("hash", "#chrysanthemum")
    expect(image).to_have_attribute("src", initial_image)
    next_drink.press("Enter")
    expect(link).to_have_js_property("hash", "#soy")
    expect(link).to_have_text(page.locator("#soy h3").inner_text())
    expect(image).to_have_attribute("src", page.locator("#soy img").get_attribute("src"))
    page.get_by_role("button", name="Tea", exact=True).click()
    expect(page.locator("#soy")).to_be_hidden()
    link.click()
    expect(page).to_have_url(re.compile(r"#soy$"))
    expect(page.locator("#soy")).to_be_in_viewport()
    expect(page.locator("#drinks article[data-family]:visible")).to_have_count(6)
    expect(page.get_by_role("button", name="All drinks")).to_have_attribute("aria-pressed", "true")


def check_without_script(page):
    cards = page.locator("#drinks article[data-family]:visible")
    expect(cards).to_have_count(6)
    urls = set()
    for card in cards.all():
        details = card.locator("details")
        if details.get_attribute("open") is None:
            details.locator("summary").press("Enter")
        link = details.locator(PRODUCT_LINK)
        expect(link).to_be_visible()
        expect(details).to_contain_text(re.compile(r"\d+(?:\.\d+)?\s*(?:ml|l)\b", re.I))
        urls.add(link.get_attribute("href"))
    assert len(urls) == 6, urls


def save_previews(frames):
    from PIL import Image

    demo = ROOT / DEMO_PATH
    screenshots = demo / "screenshots"
    screenshots.mkdir(exist_ok=True)
    for width, frame in frames.items():
        (screenshots / f"{width}.png").write_bytes(frame)
    with Image.open(io.BytesIO(frames[1440])) as desktop:
        desktop.resize((720, 450), Image.Resampling.LANCZOS).save(
            demo / "assets/thumbnail.webp", quality=88
        )


def run(capture=False):
    frames = {}
    handler = functools.partial(QuietHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/{DEMO_PATH}/"
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    channel="chrome", executable_path=os.environ.get("GALLERY_CHROME")
                )
                for width, height in VIEWPORTS:
                    page = browser.new_page(
                        viewport={"width": width, "height": height}, reduced_motion="reduce"
                    )
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 else None)
                    response = page.goto(url, wait_until="networkidle")
                    assert response and response.ok, url
                    expect(page.locator("#story")).to_be_visible()
                    page.evaluate("document.fonts.ready")
                    if capture and width in (1440, 768, 390):
                        frames[width] = page.screenshot(animations="disabled")
                    check_filters(page)
                    check_featured_drinks(page)
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
                    assert not errors, (width, errors)
                    page.close()
                page = browser.new_page(viewport={"width": 390, "height": 844}, java_script_enabled=False)
                page.goto(url)
                check_without_script(page)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Expanded details"
                browser.close()
        finally:
            server.shutdown()
            thread.join()
    if capture:
        save_previews(frames)
    print("Yeo's drinks passed at four widths and across six JavaScript-disabled product journeys.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="Save desktop, tablet and mobile previews.")
    run(parser.parse_args().capture)
