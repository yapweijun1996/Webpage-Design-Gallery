"""Exercise the fourteen Yeo's editions. Use --capture to refresh their gallery previews."""

import argparse
import functools
import http.server
import io
import os
import threading

from playwright.sync_api import expect, sync_playwright

from browser_yeos_drinks import QuietHandler, ROOT, VIEWPORTS

COMPANY = "demos/food-beverage/yeos"


def check_pack_matrix(page, formats_by_drink):
    picker = page.get_by_label("Show pack")
    for option in picker.locator("option").all()[1:]:
        label = option.inner_text()
        picker.select_option(option.get_attribute("value"))
        expect(page.locator("thead th:visible")).to_have_count(2)
        for row in page.locator("tbody tr").all():
            drink = row.locator("th").inner_text()
            marker = "●" if label in formats_by_drink[drink] else "—"
            expect(row.locator("td:visible")).to_have_text(marker)
    picker.select_option("all")
    expect(page.locator("thead th:visible")).to_have_count(6)


def check_notebook(page):
    entry = page.get_by_label("Your tasting note")
    entry.fill("Floral aroma and a light finish.")
    page.get_by_role("button", name="Save note on this device").click()
    page.reload()
    expect(entry).to_have_value("Floral aroma and a light finish.")
    page.get_by_label("Drink", exact=True).select_option("soy")
    expect(entry).to_have_value("")
    page.get_by_label("Drink", exact=True).select_option("chrysanthemum")
    entry.fill("")
    page.get_by_role("button", name="Save note on this device").click()
    expect(page.locator("#saved")).to_have_text("Note cleared.")


def check_journey(page, edition, formats_by_drink):
    if edition in (2, 3, 4, 6, 7):
        if edition in (2, 7):
            page.locator("main .pill").click()
        details = page.locator("main details").first
        details.locator("summary").press("Enter")
        assert details.evaluate("node => node.open")
        expect(details.locator("p").first).to_be_visible()
    elif edition == 5:
        check_pack_matrix(page, formats_by_drink)
    elif edition in (8, 14):
        target = "milk" if edition == 8 else "beans"
        page.locator(f'[data-choice="{target}"]').click()
        expect(page.locator("[data-panel]:visible")).to_have_count(1)
        expect(page.locator("[data-panel]:visible")).to_have_attribute("data-panel", target)
    elif edition in (9, 13, 15):
        anchor = {9: "era-1", 13: "profile-5", 15: "letter-S"}[edition]
        page.locator(f'main a[href="#{anchor}"]').press("Enter")
        assert page.url.endswith("#" + anchor)
        expect(page.locator("#" + anchor)).to_be_in_viewport()
    elif edition == 10:
        page.get_by_label("Number of guests").fill("7")
        page.get_by_label("Individual pack").select_option("300")
        page.get_by_role("button", name="Calculate packs").click()
        expect(page.locator("#estimate")).to_contain_text("6 packs of 300 mL · 50 mL spare.")
    elif edition == 11:
        for container in ("can", "bottle", "carton"):
            page.locator(f'[data-choice="{container}"]').click()
            labels = page.locator("[data-formats]:visible h2").all_inner_texts()
            expected = {name for name, packs in formats_by_drink.items()
                        if any(pack.endswith(" " + container) for pack in packs)}
            assert set(labels) == expected, (container, labels, expected)
    elif edition == 12:
        check_notebook(page)


def capture(page, edition, width):
    from PIL import Image

    directory = ROOT / COMPANY / f"v{edition}"
    image = page.screenshot(animations="disabled")
    (directory / "screenshots" / f"{width}.png").write_bytes(image)
    if width == 1440:
        with Image.open(io.BytesIO(image)) as desktop:
            desktop.convert("RGB").resize((720, 450), Image.Resampling.LANCZOS).save(
                directory / "assets/thumbnail.webp", quality=85
            )


def run(refresh):
    handler = functools.partial(QuietHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}/{COMPANY}"
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel="chrome", executable_path=os.getenv("GALLERY_CHROME"))
                page = browser.new_page(reduced_motion="reduce")
                fallback = browser.new_page(java_script_enabled=False, viewport={"width": 390, "height": 844})
                page.goto(base + "/v1/index.html")
                formats_by_drink = {
                    card.locator("h3").inner_text(): card.locator(".pack-sizes li").all_text_contents()
                    for card in page.locator("article.drink").all()
                }
                assert len(formats_by_drink) == 6
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                for edition in range(2, 16):
                    url = f"{base}/v{edition}/index.html"
                    for width, height in VIEWPORTS:
                        page.set_viewport_size({"width": width, "height": height})
                        page.goto(url)
                        page.evaluate("document.fonts.ready")
                        expect(page.locator("main h1")).to_be_visible()
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (edition, width)
                        assert page.evaluate("Array.from(document.images).every(img => img.naturalWidth > 0)")
                        if refresh and width in (1440, 768, 390):
                            capture(page, edition, width)
                        if width == 390:
                            check_journey(page, edition, formats_by_drink)
                    fallback.goto(url)
                    expect(fallback.locator("main h1")).to_be_visible()
                    expect(fallback.locator('header a[href="../v1/index.html#compare"]')).to_be_visible()
                    print(f"PASS Yeo’s v{edition}", flush=True)
                assert not errors, errors
                browser.close()
        finally:
            server.shutdown()
            thread.join()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="Refresh 42 screenshots and 14 thumbnails.")
    run(parser.parse_args().capture)
