"""Verify that the real mobile vending viewer leaves the purchase flow within reach."""
from functools import partial
from http.server import ThreadingHTTPServer
from itertools import product
import os
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_links import Quiet, ROOT, ROUTE


PHONE_SIZES = [(320, 568), (375, 667), (390, 844)]
COPY = {
    "en": ("Vending machine", "Close", "A2 · Peach Tea", "Peach Tea ready in the tray", "Collected. Choose again."),
    "zh-Hans": ("自动售货机", "关闭", "A2 · 蜜桃茶", "蜜桃茶已送到取货槽", "已取走。请选择下一款饮料。"),
    "ms": ("Mesin layan diri", "Tutup", "A2 · Teh pic", "Teh pic sedia di ruang pengambilan", "Minuman diambil. Pilih lagi."),
}


def exercise_phone(browser, base, size, language, theme):
    width, height = size
    reduced_motion = "no-preference" if (width, language, theme) == (375, "en", "dark") else "reduce"
    context = browser.new_context(
        viewport={"width": width, "height": height},
        is_mobile=True, has_touch=True, service_workers="block", reduced_motion=reduced_motion,
    )
    context.add_init_script(f"""
        localStorage.setItem("wdg.language", "{language}");
        localStorage.setItem("gjh-mini-street-site-theme", "{theme}");
    """)
    # Give the actual vending renderer the GPU budget, independent of the street.
    context.route("**/mini-street/scene.js", lambda route: route.abort())
    page = context.new_page()
    page.goto(base + "#vending", wait_until="domcontentloaded")
    title_name, close_name, selected_text, ready_text, collected_text = COPY[language]
    dialog = page.get_by_role("dialog", name=title_name)
    title = dialog.get_by_role("heading", name=title_name)
    close = dialog.get_by_role("button", name=close_name, exact=True)
    orbit = dialog.locator(".vending-orbit")
    vend = dialog.locator(".vending-serve")
    tray = dialog.locator(".vending-tray")
    message = dialog.get_by_role("status")
    slot = dialog.locator("[data-slot=A2]")

    expect(page.locator("html")).to_have_attribute("lang", language)
    expect(page.locator("html")).to_have_attribute("data-site-theme", theme)
    expect(title).to_be_focused()
    expect(orbit.locator("canvas")).to_be_visible(timeout=15000)
    expect(vend).to_be_in_viewport(ratio=1)
    expect(tray).to_be_in_viewport(ratio=1)
    assert dialog.evaluate("dialog => dialog.clientWidth === dialog.scrollWidth"), (size, language, theme)
    for target in [close, vend, tray, *dialog.locator(".vending-slot, [data-orbit], .vending-sound").all()]:
        bounds = target.bounding_box()
        assert bounds and min(bounds["width"], bounds["height"]) >= 44, (size, language, theme, bounds)
    assert vend.evaluate("""button => {
      const range = document.createRange();
      range.selectNodeContents(button);
      const label = range.getBoundingClientRect();
      const bounds = button.getBoundingClientRect();
      return label.left > bounds.left && label.right < bounds.right;
    }"""), (size, language, theme)
    expect(vend).to_have_attribute("aria-disabled", "true")
    expect(tray).to_have_attribute("aria-disabled", "true")

    if reduced_motion == "no-preference":
        initial = orbit.screenshot()
        dialog.locator("[data-orbit=left]").tap()
        # The viewer draws on its next animation frame.
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        assert orbit.screenshot() != initial
        orbit.press("Home")

    slot.tap()
    expect(slot).to_have_attribute("aria-pressed", "true")
    expect(message).to_have_text(selected_text)
    expect(vend).to_have_attribute("aria-disabled", "false")
    vend.tap()
    if reduced_motion == "no-preference":
        expect(dialog.locator(".vending-machine")).to_have_attribute("data-phase", "dispensing")
        assert not dialog.locator(".vending-machine").evaluate("machine => machine.hasAttribute('data-local-vend')")
    expect(message).to_have_text(ready_text)
    expect(tray).to_have_attribute("aria-disabled", "false")
    expect(tray).to_be_in_viewport(ratio=1)
    tray.tap()
    expect(message).to_have_text(collected_text)
    expect(tray).to_have_attribute("aria-disabled", "true")

    # Force overflow even when the full form fits on a taller phone.
    if width == 390:
        page.set_viewport_size({"width": width, "height": 490})
    dialog.evaluate("dialog => { dialog.scrollTop = dialog.scrollHeight; }")
    if width in (320, 390):
        assert dialog.evaluate("dialog => dialog.scrollTop > 0")
    expect(title).to_be_in_viewport(ratio=1)
    expect(close).to_be_in_viewport(ratio=1)
    assert close.evaluate("""button => {
      const {left, top, width, height} = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(left + width / 2, top + height / 2));
    }"""), (size, language, theme)
    if theme == "light":
        page.keyboard.press("Escape")
    else:
        close.tap()
    expect(dialog).not_to_be_visible()
    expect(page.locator("[data-stop=vending]")).to_be_focused()
    context.close()


def main():
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}{ROUTE}"
        with sync_playwright() as playwright:
            if os.environ.get("MINI_STREET_BROWSER") == "webkit":
                browser = playwright.webkit.launch()
            else:
                chrome = os.environ.get("GALLERY_CHROME")
                browser = playwright.chromium.launch(
                    executable_path=chrome, channel=None if chrome else "chrome",
                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
                )
            try:
                for size, language, theme in product(PHONE_SIZES, COPY, ("dark", "light")):
                    exercise_phone(browser, base, size, language, theme)
                print(f"PASS: {browser.browser_type.name} mobile vending, 18 viewport/language/theme combinations")
            finally:
                browser.close()


if __name__ == "__main__":
    main()
