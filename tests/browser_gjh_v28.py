"""Browser checks for GJH v28 (The Distribution Desk): layout, behaviour, languages and accessibility."""
import argparse
import functools
import http.server
import os
import re
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PATH = "demos/corporate/gjh/v28/index.html"
VIEWPORTS = ((320, 700), (390, 844), (768, 1024), (1024, 768), (1440, 900))
MARKETS = ["Singapore", "Malaysia", "Indonesia", "China", "Hong Kong", "Thailand", "Brunei", "Vietnam", "Cambodia", "Philippines"]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def check_layout(browser, base, axe_script):
    for width, height in VIEWPORTS:
        context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
        page = context.new_page()
        errors, failed = [], []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("response", lambda r: failed.append((r.status, r.url)) if r.status >= 400 else None)
        page.goto(base + PATH, wait_until="networkidle")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, "horizontal overflow")
        page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager'; })")
        page.wait_for_function("[...document.images].every(i => i.complete && i.naturalWidth > 0)", timeout=15000)
        assert page.locator("h1").count() == 1
        assert not errors, (width, errors)
        assert not failed, (width, failed)
        if width == 390:
            fold = page.evaluate("""() => [...document.querySelectorAll('.sign-card')].map(c => c.getBoundingClientRect().bottom)""")
            assert len(fold) == 3 and max(fold) <= 844, ("three divisions above the fold", fold)
        if axe_script:
            page.add_script_tag(path=str(axe_script))
            result = page.evaluate("axe.run(document, {runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']})")
            assert not result["violations"], (width, [(v["id"], [n["target"] for n in v["nodes"]][:3]) for v in result["violations"]])
        print(f"v28 / {width}px: layout, assets, console{', axe' if axe_script else ''} PASS", flush=True)
        context.close()


def check_behaviour(browser, base):
    context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    page = context.new_page()
    page.goto(base + PATH, wait_until="networkidle")
    toggle = page.locator(".nav-toggle")
    assert toggle.is_visible() and toggle.get_attribute("aria-expanded") == "false"
    toggle.click()
    assert toggle.get_attribute("aria-expanded") == "true" and page.locator("#site-nav").is_visible()
    page.keyboard.press("Escape")
    assert toggle.get_attribute("aria-expanded") == "false"
    assert page.evaluate("document.activeElement.classList.contains('nav-toggle')"), "Escape returns focus"
    # A division plaque filters the brand shelf.
    page.locator('.sign-card[data-division="health"]').click()
    assert page.locator('.chip[data-filter="health"]').get_attribute("aria-pressed") == "true"
    assert page.locator(".brand-card:visible").count() == 1
    page.locator('.chip[data-filter="all"]').click()
    assert page.locator(".brand-card:visible").count() == page.locator(".brand-card").count() == 5
    # The enquiry brief stores and sends nothing.
    assert [t.strip() for t in page.locator(".market-list li").all_inner_texts()] == MARKETS
    page.fill("#brief-company", "Example Retail Pte Ltd")
    page.select_option("#brief-market", index=1)
    page.select_option("#brief-category", index=1)
    page.locator("form.brief button[type=submit]").click()
    text = page.locator(".brief-output").inner_text()
    assert "Example Retail Pte Ltd" in text, text
    # Languages: every key translated, html lang follows, brand names stay.
    english = page.locator("h1").inner_text()
    if toggle.get_attribute("aria-expanded") == "false":
        toggle.click()  # the language group sits inside the phone menu
    for code in ("zh-Hans", "ms"):
        page.locator(f'button[data-lang="{code}"]').click()
        assert page.evaluate("document.documentElement.lang") == code
        assert page.locator("h1").inner_text() != english
        assert page.locator(f'button[data-lang="{code}"]').get_attribute("aria-pressed") == "true"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), code
        assert "New Moon" in page.locator("#brands").inner_text()
    context.close()


def check_no_javascript(browser, base):
    context = browser.new_context(viewport={"width": 375, "height": 812}, java_script_enabled=False)
    page = context.new_page()
    page.goto(base + PATH, wait_until="networkidle")
    assert page.locator("#site-nav").is_visible(), "navigation reachable without JavaScript"
    assert page.locator(".brand-card:visible").count() == 5
    page.locator('#site-nav a[href="#partners"]').click()
    assert page.url.endswith("#partners")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    contact = page.locator('a[href="https://www.gjh.com.sg/contact-us/"]').first
    assert contact.get_attribute("rel") and "noopener" in contact.get_attribute("rel")
    html = (ROOT / PATH).read_text(encoding="utf-8")
    assert "not affiliated with or endorsed by Goh Joo Hin Pte Ltd" in html
    assert not re.search(r"\+65|@gjh\.com\.sg|\bSKU\b", html), "no invented contact details or SKU codes"
    context.close()


def run(axe_script):
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}/"
    try:
        with sync_playwright() as playwright:
            chrome = os.environ.get("GALLERY_CHROME")
            browser = playwright.chromium.launch(executable_path=chrome, headless=True) if chrome else playwright.chromium.launch(headless=True)
            check_layout(browser, base, axe_script)
            check_behaviour(browser, base)
            print("v28 behaviour: menu, Escape focus, filter, enquiry brief, three languages PASS")
            check_no_javascript(browser, base)
            print("v28 without JavaScript: navigation, brands, contact link, fact guardrails PASS")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("PASS: GJH v28 browser checks.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--axe-script", type=Path)
    run(parser.parse_args().axe_script)
