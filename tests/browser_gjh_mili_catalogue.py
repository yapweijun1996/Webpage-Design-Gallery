"""Exercise the three read-only MILI cookline choices through real keyboard and touch input."""
import argparse
from functools import partial
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urljoin
import sys
import threading

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "docs"))
from browser_gjh_newmoon_pickup_bag import click
from mall_browser_probe import enter, launch
from verify_mall_support import probe_url, walk


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


# Catalogue URLs are public references. This test checks the links without opening them.
PRODUCTS = [
    ("mili-oyster-sauce-510g", ("Oyster Sauce 510 g", "蚝油 510 克", "Sos Tiram 510 g")),
    ("mili-vegetarian-oyster-sauce-510g", ("Vegetarian Oyster Sauce 510 g", "素蚝油 510 克", "Sos Tiram Vegetarian 510 g")),
    ("mili-vegetarian-mock-duck-280g", ("Vegetarian Mock Duck 280 g", "素鸭 280 克", "Itik Tiruan Vegetarian 280 g")),
]
OVERVIEW = [
    "MILI · Two sauces at the cookline", "MILI · 比较两款调味酱", "MILI · Dua sos di ruang memasak",
]


def activate(page, control, touch):
    if touch:
        control.tap()
        return
    for _ in range(40):
        if control.evaluate("el => el === document.activeElement"):
            break
        page.keyboard.press("Tab")
    expect(control).to_be_focused()
    page.keyboard.press("Enter")


def language(page, code, touch):
    click(page, "#mall-tools", touch)
    click(page, '[data-menu-to="settings"]', touch)
    click(page, '[data-menu-to="language"]', touch)
    page.locator("#scene-language").select_option(code)
    expect(page.locator("html")).to_have_attribute("lang", code)
    click(page, "#menu-close", touch)


def choose(page, index, touch):
    menu = page.locator("#exhibit-samples")
    summary = menu.locator("summary")
    activate(page, summary, touch)
    options = menu.get_by_role("button")
    expect(options).to_have_count(4)
    option = options.nth(index)
    assert option.bounding_box()["height"] >= 44
    activate(page, option, touch)
    expect(summary).to_be_focused()
    expect(menu).not_to_have_attribute("open", "")
    expect(menu.locator("button").nth(index)).to_have_attribute("aria-pressed", "true")


def check_peer_languages(page, peer, *, brand=None, index=0):
    # Drive a second real arrival selector; the first page receives a native storage event.
    previous_focus = page.evaluate_handle("document.activeElement")
    descriptions = set()
    source = page.locator("#product-shop").get_attribute("href")
    for locale_index, locale in ((1, "zh-Hans"), (2, "ms"), (0, "en")):
        peer.locator("#arrival-language").select_option(locale)
        expect(page.locator("html")).to_have_attribute("lang", locale)
        expect(page.locator("#product-dialog")).to_be_visible()
        description = page.locator("#product-description")
        if brand:
            expected = page.locator(f'[data-brand-description="{brand}"]').text_content()
            expect(description).to_have_text(expected)
            expect(page.locator("#exhibit-samples")).to_be_hidden()
        else:
            expected = OVERVIEW[locale_index] if not index else "MILI · " + PRODUCTS[index - 1][1][locale_index]
            expect(page.locator("#product-title")).to_have_text(expected)
            expect(page.locator("#exhibit-samples button").nth(index)).to_have_attribute("aria-pressed", "true")
            if index:
                expect(description).to_contain_text(("unprinted", "未印刷", "tanpa cetakan")[locale_index])
        expect(page.locator("#product-shop")).to_have_attribute("href", source)
        descriptions.add(description.text_content())
    assert len(descriptions) == 3
    page.bring_to_front()
    assert page.evaluate("el => document.activeElement === el", previous_focus)
    previous_focus.dispose()


def visit(page, touch):
    click(page, "#header-map", touch)
    if page.locator('[data-teleport="mili"]').is_visible():
        click(page, '[data-teleport="mili"]', touch)
    else:
        page.locator("#map-destination").select_option("mili")
        click(page, "#map-visit", touch)
    page.wait_for_function("!document.querySelector('#mall-map').open && Math.hypot(__mall.state.x,__mall.state.z-2.4)<.08")
    walk(page, 0, -.85, speed=1.8)
    page.wait_for_function("__mall.state.doors.mili>.98 && __mall.state.zone==='mili'")
    walk(page, 0, -3.32, speed=1.8)
    for _ in range(12):
        if page.evaluate("__mall.state.nearby==='mili-sauce-story'"):
            return
        click(page, 'button[aria-label="Select next nearby action"]', touch)
    raise AssertionError("The sauce Story was unreachable from its standing point")


def exercise(page, peer, width, out):
    touch = width == 390
    dialog = page.locator("#product-dialog")
    # Visit an eligible product first to catch stale Bag controls on an exhibit.
    click(page, "#view-toggle", touch)
    click(page, '[data-inspect="new-moon-nz-425g-front"]', touch)
    expect(page.locator("#product-add")).to_be_visible()
    expect(page.locator("#exhibit-samples")).to_be_hidden()
    click(page, "#product-close", touch)
    expect(page.locator('[data-inspect="new-moon-nz-425g-front"]')).to_be_focused()
    for brand in ("mili", "gogo"):
        click(page, f'[data-inspect="{brand}"]', touch)
        check_peer_languages(page, peer, brand=brand)
        click(page, "#product-close", touch)
        expect(page.locator(f'[data-inspect="{brand}"]')).to_be_focused()
    click(page, "#view-toggle", touch)
    visit(page, touch)
    results = []
    for locale_index, locale in enumerate(("en", "zh-Hans", "ms")):
        if locale_index:
            language(page, locale, touch)
        trigger = page.locator("#inspect")
        activate(page, trigger, touch)
        expect(dialog).to_be_visible()
        expect(page.locator("#product-close")).to_be_focused()
        expect(page.locator("#product-title")).to_have_text(OVERVIEW[locale_index])
        expect(page.locator("#product-shop")).to_have_attribute("href", "https://www.gjheshop.com/product-category/sauce/")
        expect(page.locator("#product-bag-actions")).to_be_hidden()
        menu = page.locator("#exhibit-samples")
        assert menu.locator("summary").bounding_box()["height"] >= 44
        if locale_index == 0:
            check_peer_languages(page, peer)
            if out:
                page.screenshot(path=str(out / f"{width}-overview.png"))
                activate(page, menu.locator("summary"), touch)
                page.screenshot(path=str(out / f"{width}-choices.png"))
                activate(page, menu.locator("summary"), touch)
        values = []
        for index, (slug, names) in enumerate(PRODUCTS, 1):
            choose(page, index, touch)
            title = "MILI · " + names[locale_index]
            expect(page.locator("#product-title")).to_have_text(title)
            source = "https://www.gjheshop.com/product/" + slug + "/"
            expect(page.locator("#product-shop")).to_have_attribute("href", source)
            expect(page.locator("#product-description")).to_contain_text(("unprinted", "未印刷", "tanpa cetakan")[locale_index])
            expect(page.locator("#product-image")).to_have_attribute("src", "assets/mili-brand-cover.jpg")
            expect(page.locator("#product-bag-actions")).to_be_hidden()
            expect(page.locator("#product-preview-canvas")).to_be_hidden()
            assert dialog.evaluate("el => el.scrollWidth <= el.clientWidth + 1")
            if locale_index == 0 and index == 2:
                check_peer_languages(page, peer, index=index)
                if out:
                    page.screenshot(path=str(out / f"{width}-vegetarian-sauce.png"))
            values.append({"title": title, "url": source})
        choose(page, 0, touch)
        expect(page.locator("#product-title")).to_have_text(OVERVIEW[locale_index])
        expect(page.locator("#product-shop")).to_have_attribute("href", "https://www.gjheshop.com/product-category/sauce/")
        if touch:
            page.locator("#product-close").tap()
        else:
            page.keyboard.press("Escape")
        expect(dialog).to_be_hidden()
        expect(trigger).to_be_focused()
        results.append({"locale": locale, "products": values})
    if not touch:
        scene = page.locator("#scene")
        scene.focus()
        page.keyboard.press("e")
        expect(dialog).to_be_visible()
        page.keyboard.press("Escape")
        expect(dialog).to_be_hidden()
        expect(scene).to_be_focused()
    walk(page, 0, -.85, speed=1.8)
    walk(page, 0, 5.6, speed=1.8)
    page.wait_for_function("__mall.state.zone==='atrium' && __mall.state.doors.mili<.02")
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, nargs="+", choices=(390, 1440), default=[390, 1440])
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.out:
        args.out.mkdir(exist_ok=True, parents=True)
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            url = probe_url(f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/")
            with sync_playwright() as pw, launch(pw) as browser:
                for width in args.width:
                    touch = width == 390
                    with browser.new_context(viewport={"width": width, "height": 844 if touch else 900},
                                             has_touch=touch, service_workers="block") as context:
                        errors = []
                        context.on("page", lambda pg: pg.on("pageerror", lambda e: errors.append(str(e))))
                        page = enter(context, url, "low" if touch else "detailed")
                        peer = context.new_page()
                        peer.goto(urljoin(url, "./"), wait_until="domcontentloaded")
                        page.bring_to_front()
                        try:
                            results = exercise(page, peer, width, args.out)
                        except Exception:
                            if args.out:
                                page.screenshot(path=str(args.out / f"{width}-failure.png"), timeout=6000)
                            raise
                        assert not errors, errors
                        receipt = {"chrome": browser.version, "width": width, "results": results, "errors": errors}
                        if args.out:
                            (args.out / f"{width}-result.json").write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n")
                        print(f"{width}: 3 cookline samples in each of 3 languages; overview, live cross-tab language, Bag isolation, focus and exit passed.", flush=True)
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
