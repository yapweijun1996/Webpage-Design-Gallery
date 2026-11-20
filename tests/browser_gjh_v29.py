"""Browser checks for GJH v29 (The Pantry Shelf): responsive layout, category disclosures, languages and HTML fallback."""
import argparse
import functools
import http.server
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def check_v29_pantry(browser, base):
    url = base + "demos/corporate/gjh/v29/"
    expected = [
        ("Food & Beverage", ["New Moon", "MILI", "GOGO", "Flying Wheel", "Gu Long",
                             "Skippy", "SPAM", "Hormel", "California Mexico"]),
        ("Health & Nutrition", ["Borsch Med", "Pien Tze Huang", "Zeria"]),
        ("Electronics & Lifestyle", ["Sony", "LG", "Casio", "GP Batteries", "Gigaset"]),
    ]
    for width, height in ((320, 700), (390, 844), (768, 1024), (1440, 900)):
        motion = "no-preference" if width == 390 else "reduce"
        context = browser.new_context(viewport={"width": width, "height": height}, locale="en-SG",
                                      is_mobile=width <= 390, has_touch=width < 1024,
                                      reduced_motion=motion, service_workers="block")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.goto(url)
        hero = page.locator(".scene img")
        hero.evaluate("image => image.decode()")
        assert hero.evaluate("image => image.currentSrc").endswith(
            "pantry-desktop.webp" if width == 1440 else "pantry-mobile.webp")
        assert page.evaluate("innerWidth === document.documentElement.scrollWidth")
        assert page.get_by_role("heading", level=1).count() == 1
        assert page.get_by_role("banner").get_by_text("Goh Joo Hin", exact=True).is_visible()
        action = page.get_by_role("link", name="Open shelf")
        rows = page.locator(".categories details")
        assert rows.count() == len(expected)
        assert rows.first.get_attribute("open") is None
        assert action.bounding_box()["height"] >= 44
        if width == 390:
            action.tap()
        else:
            action.press("Enter")
        page.wait_for_url("**/#shelf")
        page.wait_for_function("Math.abs(document.querySelector('#shelf').getBoundingClientRect().top) <= 1")
        assert page.evaluate("getComputedStyle(document.documentElement).scrollBehavior") == (
            "smooth" if motion == "no-preference" else "auto")
        assert rows.first.locator("ul").is_visible()
        for index, (name, brands) in enumerate(expected):
            row = rows.nth(index)
            summary = row.locator("summary")
            assert summary.locator(".category-name").inner_text() == name
            assert summary.locator(".category-count").inner_text() == f"{len(brands)} brands"
            assert summary.bounding_box()["height"] >= 44
            summary.locator("img").evaluate("image => { image.loading = 'eager'; return image.decode(); }")
            if index:
                summary.press("Space")
            assert row.locator("li").all_inner_texts() == brands and row.locator("ul").is_visible()
        assert page.evaluate("innerWidth === document.documentElement.scrollWidth")
        assert page.locator('a[href^="https:"]').evaluate_all("links => links.map(link => link.href)") == [
            "https://www.gjhglobal.com/"
        ]
        page.get_by_role("button", name="中文").click()
        assert page.locator("html").get_attribute("lang") == "zh-Hans"
        assert rows.first.locator(".category-name").inner_text() == "食品与饮料"
        assert rows.first.locator(".category-count").inner_text() == "9 个品牌"
        assert page.get_by_text("分类图片 · AI 概念插图", exact=True).is_visible()
        assert page.locator(".site-footer p").first.inner_text() == "本页为独立设计概念展示，与 Goh Joo Hin 无关。"
        assert page.locator(".demo-install summary").inner_text() == "安装与离线使用"
        assert page.evaluate("innerWidth === document.documentElement.scrollWidth")
        assert rows.first.locator("ul").is_visible()
        page.reload()
        assert page.get_by_role("button", name="中文").get_attribute("aria-pressed") == "true"
        page.get_by_role("button", name="English").click()
        assert page.locator("html").get_attribute("lang") == "en-SG"
        assert page.locator(".demo-install summary").inner_text() == "Install / offline"
        assert not errors, errors
        context.close()
    context = browser.new_context(viewport={"width": 390, "height": 844}, java_script_enabled=False)
    page = context.new_page()
    page.goto(url)
    page.get_by_role("link", name="Open shelf").click()
    page.wait_for_url("**/#shelf")
    page.locator(".categories summary").first.click()
    assert page.get_by_text("New Moon", exact=True).is_visible()
    context.close()
    print("v29: responsive pantry, category disclosures, language persistence and HTML fallback PASS", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.parse_args()
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/"
    chrome = os.environ.get("GALLERY_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=chrome, headless=True)
            check_v29_pantry(browser, base)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print("PASS: GJH v29 browser checks.")


if __name__ == "__main__":
    main()
