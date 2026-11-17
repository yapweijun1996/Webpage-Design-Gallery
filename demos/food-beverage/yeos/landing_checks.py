"""Check the fifteen Yeo's landing journeys and their cross-edition handoffs."""

import argparse
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[3]
COMPANY = "demos/food-beverage/yeos"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def verify(page, edition):
    if edition == 1:
        first = page.get_by_label("First drink")
        second = page.get_by_label("Second drink")
        first.select_option("black-soy")
        second.select_option("bandung")
        page.goto(page.locator("#pair-link").get_attribute("href"))
        expect(first).to_have_value("black-soy")
        expect(second).to_have_value("bandung")
        expect(page.get_by_role("row", name="Can Not listed 300 mL")).to_be_visible()
    elif edition == 2:
        page.locator('.tea-diptych a[href="#chrysanthemum"]').press("Enter")
        expect(page.locator("#chrysanthemum h2")).to_be_in_viewport()
    elif edition == 3:
        page.locator(".soy-comparison a").press("Enter")
        expect(page.get_by_label("First drink")).to_have_value("soy")
        expect(page.get_by_label("Second drink")).to_have_value("black-soy")
    elif edition == 4:
        page.locator(".menu details").last.locator("summary").press("Enter")
        expect(page.locator(".board-print figcaption")).to_have_text("Lychee Drink")
        expect(page.locator(".board-print img")).to_have_attribute("src", "../v1/assets/lychee.webp")
    elif edition == 5:
        page.get_by_label("Show pack").select_option(label="1 L carton")
        expect(page.locator("#match-total")).to_have_text("2 / 6")
        expect(page.locator("#match-label")).to_contain_text("1 L carton")
    elif edition == 6:
        page.locator('.specimen-key a[href="#spec-black-soy"]').press("Enter")
        expect(page.locator("#spec-black-soy h3")).to_be_in_viewport()
        page.reload()
        expect(page.locator("#spec-black-soy h3")).to_be_visible()
    elif edition == 7:
        meters = page.locator("#volumes meter")
        assert meters.evaluate_all("items => items.map(item => item.value)") == [250, 300, 380, 1500]
        assert meters.evaluate_all("items => items.every(item => item.max === 1500)")
    elif edition == 8:
        for ingredient in ("rose", "milk", "bandung"):
            page.locator(f'[data-choice="{ingredient}"]').press("Enter")
            expect(page.locator(".portrait figcaption span:visible")).to_have_count(1)
            expect(page.locator(".caption-" + ingredient)).to_be_visible()
    elif edition == 9:
        page.locator(".archive-feature a").press("Enter")
        expect(page.locator("#soy h3")).to_be_in_viewport()
    elif edition == 10:
        page.get_by_label("Number of guests").fill("7")
        page.get_by_label("Individual pack").select_option("300")
        page.get_by_role("button", name="Calculate packs").press("Enter")
        expect(page.locator("#pack-quantity")).to_have_text("6")
        expect(page.locator("#pack-unit")).to_have_text("cans")
        expect(page.locator("#estimate")).to_contain_text("50 mL spare")
    elif edition == 11:
        page.get_by_role("button", name="Cans", exact=True).press("Enter")
        expect(page.locator(".pack-tickets li:visible")).to_have_count(5)
        assert set(page.locator(".pack-tickets li:visible").all_text_contents()) == {"300 mL can"}
        page.get_by_role("button", name="All containers").press("Enter")
        expect(page.locator(".pack-tickets li:visible")).to_have_count(21)
    elif edition == 12:
        page.get_by_label("Drink", exact=True).select_option("lychee")
        expect(page.locator("#journal-drink")).to_have_text("Lychee Drink")
        expect(page.locator("#journal-portrait")).to_have_attribute("src", "../v1/assets/lychee.webp")
    elif edition == 13:
        link = page.get_by_role("link", name="Rose milk", exact=True)
        link.focus()
        expect(page.locator("#dial-name")).to_have_text("Bandung Rose Milk Drink")
        expect(page.locator(".dial img")).to_have_attribute("src", "../v1/assets/bandung.webp")
        link.press("Enter")
        expect(page.locator("#profile-5 h2")).to_be_in_viewport()
    elif edition == 14:
        page.locator('[data-choice="beans"]').press("Enter")
        page.locator('[data-panel="beans"] .journal-action').nth(1).press("Enter")
        expect(page.get_by_label("Drink", exact=True)).to_have_value("black-soy")
        expect(page.get_by_label("Your tasting note")).to_be_visible()
    elif edition == 15:
        search = page.get_by_label("Find a drink or ingredient")
        search.fill("rose essence")
        expect(page.locator(".letter article:visible h3")).to_have_text("Bandung Rose Milk Drink")
        expect(page.locator(".atlas aside nav a:visible")).to_have_count(1)
        search.fill("absent")
        expect(page.locator("#atlas-count")).to_contain_text("No matching drinks")
        page.get_by_role("button", name="Clear", exact=True).press("Enter")
        expect(search).to_be_focused()
        expect(page.locator(".letter article:visible")).to_have_count(6)


def run(axe):
    handler = functools.partial(QuietHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel="chrome", executable_path=os.getenv("GALLERY_CHROME"))
                context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce",
                                              service_workers="block")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                for edition in range(1, 16):
                    page.goto(f"http://127.0.0.1:{server.server_port}/{COMPANY}/v{edition}/")
                    page.evaluate("document.fonts.ready")
                    if axe:
                        page.add_script_tag(path=str(axe))
                        violations = page.evaluate("""async () => (await axe.run('main', {
                          runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}
                        })).violations.map(({id, nodes}) => [id, nodes.map(node => node.target)])""")
                        assert not violations, (edition, violations)
                    verify(page, edition)
                    assert not errors, (edition, errors)
                    print(f"PASS Yeo’s V{edition} landing journey", flush=True)
                browser.close()
        finally:
            server.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--axe-script", type=Path, help="Optional local axe-core browser script")
    run(parser.parse_args().axe_script)
