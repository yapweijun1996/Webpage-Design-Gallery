"""Exercise language preferences and live Mini Street copy in a browser."""
from functools import partial
from http.server import ThreadingHTTPServer
import os
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_links import Quiet, ROOT, ROUTE


def switch_language(page, code):
    trigger = page.locator("#mini-language")
    trigger.click()
    chooser = page.locator("#mini-language-choice")
    expect(chooser).to_be_focused()
    chooser.select_option(code)
    expect(page.locator("html")).to_have_attribute("lang", code)
    page.locator(".mini-language-done").click()
    expect(trigger).to_be_focused()


def exercise(browser, url):
    context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    context.route("**/scene.js", lambda route: route.abort())
    context.route("**/vending-viewer.js", lambda route: route.abort())
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url, wait_until="domcontentloaded")
    expect(page.locator("#mini-language")).to_have_accessible_name("Language · English")

    switch_language(page, "zh-Hans")
    expect(page.locator("#mini-language")).to_have_accessible_name("语言 · 简体中文")
    expect(page.locator("#street-title")).to_have_text("Mini Street")
    expect(page.locator("#view")).to_have_attribute("aria-label", "3D 街景")
    expect(page.locator('nav.mini-nav a[href="../v11/"]')).to_have_text("Virtual Mall")

    page.locator("[data-stop=shop]").click()
    expect(page.locator("#shop-title")).to_have_text("New Moon 商店")
    expect(page.locator("#shop .pack-list img").first).to_have_attribute("alt", "New Moon 新西兰鲍鱼包装正面")
    page.get_by_role("button", name="将澳大利亚鲍鱼加入购物篮").click()
    expect(page.locator("#shop").get_by_role("status")).to_have_text("已添加澳大利亚鲍鱼。关闭此展示即可查看购物篮。")
    page.locator("#stop-dialog .close").click()
    expect(page.locator(".mini-basket-launcher")).to_have_accessible_name("购物篮，1 件商品")

    # Exercise a locale change from the shared preference while a modal owns focus.
    settings = context.new_page()
    settings.goto(url, wait_until="domcontentloaded")
    expect(settings.locator("html")).to_have_attribute("lang", "zh-Hans")
    page.locator(".mini-basket-launcher").click()
    switch_language(settings, "ms")
    basket = page.locator("#mini-basket")
    expect(basket.get_by_role("heading")).to_have_text("Bakul maya")
    expect(basket.locator(".mini-basket-product strong").filter(has_text="Abalon New Moon dari Australia")).to_be_visible()
    basket.get_by_role("button", name="Tambah kuantiti untuk Abalon New Moon dari Australia").click()
    expect(basket.locator("[role=status]")).to_have_text("Kuantiti Abalon New Moon dari Australia ialah 2.")
    basket.get_by_role("button", name="Tutup bakul").click()
    expect(page.locator(".mini-basket-launcher")).to_have_accessible_name("Bakul, 2 item")

    page.locator("[data-stop=vending]").click()
    page.locator("[data-slot=A2]").click()
    message = page.locator(".vending-message")
    expect(message).to_have_text("A2 · Teh pic")
    switch_language(settings, "zh-Hans")
    expect(message).to_have_text("A2 · 蜜桃茶")
    page.get_by_role("button", name="出货", exact=True).press("Enter")
    expect(message).to_have_text("蜜桃茶已送到取货槽")
    switch_language(settings, "en")
    expect(message).to_have_text("Peach Tea ready in the tray")
    page.get_by_role("button", name="Collect drink").click()
    expect(message).to_have_text("Collected. Choose again.")
    page.locator("#stop-dialog .close").click()

    page.locator("#mini-language").click()
    page.keyboard.press("Escape")
    expect(page.locator("#mini-language")).to_be_focused()
    assert page.evaluate("localStorage.getItem('wdg.language')") == "en"
    assert not errors, errors
    context.close()


def main(root=ROOT):
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(root))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}{ROUTE}"
        with sync_playwright() as playwright:
            browser_name = os.environ.get("MINI_STREET_BROWSER", "chromium")
            browser = getattr(playwright, browser_name).launch()
            try:
                exercise(browser, url)
            finally:
                browser.close()
    print("PASS: Mini Street language picker, shared preference, basket and vending status")


if __name__ == "__main__":
    main()
