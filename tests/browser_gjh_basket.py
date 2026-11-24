"""Exercise the standalone Mini Street basket in real Chromium and WebKit."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
DEMO = "/demos/corporate/gjh/mini-street/"
STORAGE_KEY = "gjh-mini-street:basket:v1"
FIXTURE = """<!doctype html>
<html lang="en" data-gjh-design="mini-street">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="assets/theme.css">
  <link rel="stylesheet" href="style.css">
  <link rel="stylesheet" href="basket.css">
  <script type="module">
    import { createShopBasket } from "./basket.js";
    window.basket = createShopBasket();
  </script>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <div class="identity"><span class="monogram">GJH</span><span>Virtual Mall</span></div>
      <span class="concept">Unofficial concept</span>
    </div>
  </header>
  <button id="opener">Basket shortcut</button>
  <dialog id="product-modal"><button>Product</button></dialog>
</body>
</html>
"""


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path != DEMO + "basket-fixture":
            return super().do_GET()
        body = FIXTURE.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


def launcher(page, count):
    unit = "item" if count == 1 else "items"
    return page.get_by_role("button", name=f"Basket, {count} {unit}", exact=True)


def check_interaction(browser, url, mobile):
    width, height = (320, 568) if mobile else (1440, 900)
    context = browser.new_context(
        viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile
    )
    errors = []
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)

    expect(launcher(page, 0)).to_be_visible()
    if mobile:
        launcher(page, 0).tap()
    else:
        launcher(page, 0).press("Enter")
    panel = page.get_by_role("dialog", name="Virtual basket")
    expect(panel.get_by_text("Your basket is empty.")).to_be_visible()
    expect(panel.get_by_role("heading")).to_be_focused()
    page.keyboard.press("Shift+Tab")
    expect(panel.get_by_role("button", name="Continue shopping")).to_be_focused()
    page.keyboard.press("Tab")
    expect(panel.get_by_role("button", name="Close basket")).to_be_focused()
    page.keyboard.press("Escape")
    expect(panel).to_be_hidden()
    expect(launcher(page, 0)).to_be_focused()

    outcome = page.evaluate("""() => {
      const picked = {};
      const counts = [];
      const unsubscribe = basket.subscribe(value => counts.push(value));
      const results = [
        basket.add("unknown", {}),
        basket.add("au-425g", picked),
        basket.add("au-425g", picked),
        basket.add("au-425g", {}),
      ];
      unsubscribe();
      return {counts, results};
    }""")
    assert outcome == {"counts": [0, 1, 2], "results": [False, True, False, True]}, outcome
    expect(launcher(page, 2)).to_be_visible()
    expect(page.locator(".mini-basket-notice")).to_contain_text("Added New Moon Australia Abalone")
    page.reload()
    expect(launcher(page, 2)).to_be_visible()

    page.evaluate("document.querySelector('#product-modal').showModal()")
    assert page.evaluate("basket.open()") is False
    page.evaluate("document.querySelector('#product-modal').close()")
    assert page.evaluate("basket.open(document.querySelector('#opener'))") is True
    expect(panel.get_by_text("425 g", exact=True)).to_be_visible()
    page.wait_for_function("document.querySelector('.mini-basket-photo').naturalWidth > 0")
    assert page.evaluate("""() => {
      const panel = document.querySelector('.mini-basket');
      return document.documentElement.scrollWidth <= innerWidth
        && panel.scrollWidth === panel.clientWidth
        && Array.from(panel.querySelectorAll('button')).every(button => button.offsetHeight >= 44);
    }""")

    second = context.new_page()
    second.goto(url)
    expect(launcher(second, 2)).to_be_visible()
    panel.get_by_role("button", name="Increase quantity").click()
    expect(launcher(second, 3)).to_be_visible()
    panel.get_by_role("button", name="Decrease quantity").click()
    expect(launcher(second, 2)).to_be_visible()
    remove = panel.get_by_role("button", name="Remove New Moon Australia Abalone")
    remove.focus()
    remove.press("Enter")
    expect(panel.get_by_text("Your basket is empty.")).to_be_visible()
    expect(launcher(second, 0)).to_be_visible()
    continuation = panel.get_by_role("button", name="Continue shopping")
    expect(continuation).to_be_focused()
    continuation.press("Enter")
    expect(page.get_by_role("button", name="Basket shortcut")).to_be_focused()

    results = page.evaluate("""() => [
      basket.add("au-425g"), basket.add("au-425g")
    ]""")
    assert results == [True, False], results
    launcher(page, 1).click()
    panel.get_by_role("button", name="Decrease quantity").click()
    expect(panel.get_by_text("Your basket is empty.")).to_be_visible()
    page.evaluate("basket.cleanup()")
    assert not page.locator(".mini-basket, .mini-basket-launcher").count()
    assert page.evaluate("basket.add('au-425g')") is False

    second.evaluate("key => localStorage.setItem(key, 'malformed data')", STORAGE_KEY)
    second.reload()
    expect(launcher(second, 0)).to_be_visible()
    assert second.evaluate("basket.add('au-425g', {})") is True
    second.reload()
    expect(launcher(second, 1)).to_be_visible()
    assert not errors, errors
    context.close()


def check_storage_fallback(browser, url, storage_script):
    context = browser.new_context()
    context.add_init_script(storage_script)
    page = context.new_page()
    page.goto(url)
    expect(launcher(page, 0)).to_be_visible()
    assert page.evaluate("basket.add('au-425g', {})") is True
    expect(launcher(page, 1)).to_be_visible()
    expect(page.locator(".mini-basket-notice")).to_contain_text("Browser saving is unavailable")
    launcher(page, 1).click()
    panel = page.get_by_role("dialog", name="Virtual basket")
    expect(panel.get_by_text("Browser saving is unavailable", exact=False)).to_be_visible()
    page.reload()
    expect(launcher(page, 0)).to_be_visible()
    context.close()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=ROOT))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}{DEMO}basket-fixture"
    try:
        with sync_playwright() as playwright:
            for engine, mobile in ((playwright.chromium, False), (playwright.webkit, True)):
                with engine.launch() as browser:
                    check_interaction(browser, url, mobile)
                    check_storage_fallback(browser, url, """Object.defineProperty(window, 'localStorage', {
                      get() { throw new DOMException('Blocked', 'SecurityError'); }
                    });""")
                    check_storage_fallback(browser, url, """Storage.prototype.setItem = function () {
                      throw new DOMException('Full', 'QuotaExceededError');
                    };""")
                print(f"Mini Street basket {engine.name}: PASS", flush=True)
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    main()
