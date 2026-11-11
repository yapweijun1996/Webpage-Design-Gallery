"""Exercise the actual static artifact at a GitHub Pages-style path prefix.

Requires the locally installed Playwright Python package and Chrome.
"""

import copy
import functools
import http.server
import importlib.util
import json
import os
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            # Browsers cancel in-flight screenshot transfers when navigating away.
            pass


def run():
    screenshots = ROOT / "docs/screenshots/gallery-v2"
    screenshots.mkdir(parents=True, exist_ok=True)
    evidence = []
    with tempfile.TemporaryDirectory(prefix="gallery-browser-") as temporary:
        output = Path(temporary) / "Webpage-Design-Gallery"
        gallery.build(output)
        assert not list(output.rglob("*research*"))
        assert not list(output.rglob("company-profile.md"))
        handler = functools.partial(QuietHandler, directory=temporary)
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/"
        try:
            with sync_playwright() as playwright:
                chrome = os.environ.get("GALLERY_CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
                browser = playwright.chromium.launch(executable_path=chrome, headless=True)
                for width, height in ((1440, 1000), (768, 1024), (390, 844), (375, 812)):
                    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
                    page.goto(base, wait_until="networkidle")
                    page.keyboard.press("Tab")
                    assert page.evaluate("document.activeElement.textContent") == "Skip to content"
                    assert page.locator(".company-card").count() == 1
                    assert page.locator(".design-card").count() == 0
                    assert page.locator(".company-card").get_attribute("href") == "companies/gjh/index.html"
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    page.screenshot(path=str(screenshots / f"home-{width}.png"), full_page=True)
                    page.locator("#company-search").fill("not-present")
                    assert page.locator(".empty-results").is_visible()
                    page.get_by_role("button", name="Clear filters").click()
                    page.locator("#category-filter").select_option("retail")
                    assert page.locator(".company-card:visible").count() == 0
                    page.get_by_role("button", name="Clear filters").click()
                    page.locator(".company-card").click()
                    assert page.url.endswith("companies/gjh/index.html")
                    assert page.locator(".design-card").count() == 4
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    page.screenshot(path=str(screenshots / f"company-{width}.png"), full_page=True)
                    page.select_option("#style-filter", "minimal")
                    assert page.locator(".design-card:visible").count() == 1
                    assert page.locator(".design-card:visible").get_attribute("data-design") == "v6"
                    page.select_option("#style-filter", "heritage")
                    assert page.locator(".design-card:visible").count() == 2
                    page.select_option("#style-filter", "")
                    assert page.locator("#compare-selected").get_attribute("aria-disabled") == "true"
                    page.locator('input[value="v5"]').focus()
                    page.keyboard.press("Space")
                    assert page.locator('input[value="v5"]').is_checked()
                    page.locator('input[value="v7"]').check()
                    assert page.locator('input[value="v1"]').is_disabled()
                    assert page.locator("#selection-count").inner_text() == "2 of 2 selected"
                    page.get_by_role("link", name="Compare selected").click()
                    page.wait_for_selector("iframe")
                    page.wait_for_load_state("networkidle")
                    assert page.locator("iframe").count() == 2
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    frames = [frame for frame in page.frames if frame != page.main_frame]
                    for frame in frames:
                        assert frame.locator('a[href="https://www.gjh.com.sg/contact-us/"]').first.get_attribute("target") == "_blank"
                    for device, target in (("tablet", 768), ("mobile", 390), ("desktop", 1440)):
                        page.get_by_role("button", name=device, exact=True).click()
                        assert all(frame.evaluate("innerWidth") == target for frame in frames)
                    page.screenshot(path=str(screenshots / f"compare-{width}.png"), full_page=True)
                    if width == 1440 and page.evaluate("document.fullscreenEnabled"):
                        page.locator('[data-fullscreen="0"]').click()
                        page.wait_for_function("document.fullscreenElement !== null")
                        page.evaluate("document.exitFullscreen()")
                        page.wait_for_function("document.fullscreenElement === null")
                    frames[0].evaluate("scrollTo(0, 800)")
                    page.wait_for_timeout(120)
                    assert frames[1].evaluate("scrollY") == 0
                    page.locator("#sync-scroll").check()
                    frames[0].evaluate("scrollTo(0, 1400)")
                    page.wait_for_timeout(250)
                    ratios = [frame.evaluate("scrollY / Math.max(1, document.documentElement.scrollHeight-innerHeight)") for frame in frames]
                    assert abs(ratios[0] - ratios[1]) < .025, ratios
                    page.select_option("#compare-mode", "screenshots")
                    assert page.locator(".frame-stage:visible").count() == 0
                    assert page.locator("#sync-scroll").is_disabled()
                    for image in page.locator(".screenshot-stage img").all():
                        image.evaluate("(image) => image.decode()")
                    page.goto(base + "companies/gjh/index.html", wait_until="networkidle")
                    page.locator('.design-card[data-design="v6"] .details-link').click()
                    page.wait_for_selector("#detail-screenshot")
                    page.get_by_role("button", name="mobile", exact=True).click()
                    image = page.locator("#detail-screenshot")
                    image.evaluate("(image) => image.decode()")
                    assert image.get_attribute("src").endswith("v6/screenshots/390.png")
                    page.get_by_role("link", name="Open live demo", exact=False).click()
                    assert "/demos/corporate/gjh/v6/" in page.url
                    assert page.locator("h1").inner_text().startswith("Everyday brands.")
                    assert page.locator(".identity img").get_attribute("src") == "assets/gjh-logo.png"
                    assert not errors, errors
                    evidence.append({"width": width, "companyFlow": "PASS", "filters": "PASS", "compare": "PASS", "deviceWidths": "PASS", "syncScroll": "PASS", "images": "PASS", "consoleErrors": errors})
                    context.close()
                context = browser.new_context(viewport={"width": 1440, "height": 1000})
                page = context.new_page()
                for query in ("company=gjh&left=v5&right=v5", "company=unknown&left=v1&right=v7", "company=gjh&left=v1"):
                    page.goto(base + "compare/index.html?" + query)
                    page.wait_for_selector(".error-state")
                    assert page.locator("iframe").count() == 0
                page.goto(base + "designs/index.html?company=gjh&design=missing")
                page.wait_for_selector(".error-state")
                page.route("**/data/designs.json", lambda route: route.abort())
                page.goto(base + "designs/index.html?company=gjh&design=v1")
                page.wait_for_selector(".error-state")
                assert page.get_by_role("link", name="Browse companies").is_visible()
                page.unroute("**/data/designs.json")
                # Browser-only synthetic capacity fixture: never written into the public catalog.
                synthetic = copy.deepcopy(gallery.load_catalog())
                company_template, design_template = synthetic["companies"][0], synthetic["designs"][0]
                synthetic["companies"], synthetic["designs"] = [], []
                for index in range(120):
                    company = dict(company_template, id=f"fixture-{index:03}", slug=f"fixture-{index:03}", name=f"Fixture Company {index:03}", categories=["retail" if index % 2 else "corporate"], featuredVersion="v0")
                    synthetic["companies"].append(company)
                    for version in range(10):
                        synthetic["designs"].append(dict(design_template, id=f"fixture-{index}-{version}", companyId=company["id"], version=f"v{version}", order=version))
                synthetic_home = gallery.build_pages(synthetic)["index.html"]
                page.route(base + "index.html", lambda route: route.fulfill(status=200, content_type="text/html", body=synthetic_home))
                page.goto(base + "index.html", wait_until="networkidle")
                assert page.locator(".company-card").count() == 120
                assert page.locator(".company-card:visible").count() == 12
                page.get_by_role("button", name="Next", exact=True).click()
                assert "Page 2 of 10" in page.locator(".pagination").inner_text()
                page.locator("#company-search").fill("Fixture Company 119")
                assert page.locator(".company-card:visible").count() == 1
                page.locator("#company-search").fill("")
                page.select_option("#category-filter", "retail")
                assert "60 matching companies" in page.locator(".results-status").inner_text()
                evidence.append({"syntheticCompanies": 120, "syntheticDesigns": 1200, "paginationAndSearch": "PASS", "limitation": "Synthetic catalog interaction check; not a real 100-company content or field-performance claim"})
                context.close()
                context = browser.new_context(java_script_enabled=False)
                page = context.new_page(); page.goto(base)
                page.locator(".company-card").click()
                assert page.locator(".design-card").count() == 4
                page.locator('.design-card[data-design="v7"] .card-action').click()
                assert "/demos/corporate/gjh/v7/" in page.url
                evidence.append({"noJavaScriptBrowseAndOpenDemo": "PASS", "invalidCompareAndDetail": "PASS"})
                context.close(); browser.close()
        finally:
            server.shutdown(); server.server_close(); thread.join()
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    run()
