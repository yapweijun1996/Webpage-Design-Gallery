"""An unavailable held model retains the selected packshot and basket SKU."""
import os
from http.server import ThreadingHTTPServer
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_multi_product import (
    Handler,
    PRODUCTS,
    ROUTE,
    basket_button,
    check_basket_rows,
    inspect_product,
    route_camera,
)


def check_selected_model_failure(browser, url):
    page = browser.new_page(
        viewport={"width": 1280, "height": 800},
        reduced_motion="reduce",
        service_workers="block",
    )
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("**/mini-street/shop-interior.js", route_camera)

    mexico = PRODUCTS[-1]
    model = "**/new-moon-can-mx-454g-lod1.glb"
    with page.expect_response(model) as shelf_response:
        page.goto(url + "#shop-interior", wait_until="domcontentloaded")
    assert shelf_response.value.ok
    page.route(model, lambda route: route.abort())
    with page.expect_request(model):
        dialog = inspect_product(page, mexico)

    expect(dialog).to_have_attribute("data-fallback", "")
    photo = dialog.get_by_role("img", name="Front of the New Moon Mexican abalone can", exact=True)
    expect(photo).to_be_visible()
    assert photo.get_attribute("src").endswith("/new-moon-mx-454g-front.webp")
    photo.evaluate("image => image.decode()")
    expect(dialog.get_by_role("button", name="Rotate right", exact=True)).to_be_hidden()
    dialog.get_by_role("button", name="Add to basket", exact=True).click()
    expect(dialog).to_be_hidden()
    expect(page.locator(".mini-basket-notice")).to_have_text(
        "Added New Moon Mexico Abalone. 1 item in basket."
    )
    review = page.get_by_role("button", name="View basket", exact=True)
    expect(review).to_be_focused()
    review.press("Enter")
    basket = page.get_by_role("dialog", name="Virtual basket", exact=True)
    check_basket_rows(basket, {mexico.sku: 1})
    expect(basket.get_by_role("button", name="Checkout")).to_have_count(0)
    basket.get_by_role("button", name="Continue shopping", exact=True).press("Enter")
    expect(basket).to_be_hidden()
    expect(basket_button(page, 1)).to_be_focused()
    assert not errors, errors
    page.close()


def run():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}{ROUTE}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=os.environ.get("GALLERY_CHROME", "/usr/bin/google-chrome"),
                headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            )
            expect.set_options(timeout=15000)
            check_selected_model_failure(browser, url)
            print("Mini Street selected model packshot fallback and basket SKU: PASS", flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    run()
