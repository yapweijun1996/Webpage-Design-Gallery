"""Verify four real Mini Street shelf selections and basket migration in Chromium."""

import os
from dataclasses import dataclass
from http.server import ThreadingHTTPServer
from threading import Thread

from playwright.sync_api import expect, sync_playwright

from browser_gjh_mini_street_shop import Handler, ROUTE


@dataclass(frozen=True)
class Product:
    sku: str
    title: str
    origin: str
    size: str
    eye: tuple[float, float, float]
    target: tuple[float, float, float]

    @property
    def name(self):
        return f"New Moon {self.origin} Abalone"


# Eye poses in the aisles face the entry display, right shelves and rear shelf.
PRODUCTS = (
    Product("au-425g", "Australian abalone", "Australia", "425 g",
            (0.215, 1.64, 2.04), (0.24, 1.105, 1.29)),
    Product("nz-425g", "New Zealand abalone", "New Zealand", "425 g",
            (2.31, 1.64, 1.26), (3.01, 1.385, 1.26)),
    Product("sa-425g", "South African abalone", "South Africa", "425 g",
            (2.31, 1.64, -0.55), (3.01, 1.385, -0.55)),
    Product("mx-454g", "Mexican abalone", "Mexico", "454 g",
            (-1.75, 1.64, -2.98), (-1.75, 1.385, -3.71)),
)
LEGACY_KEY = "gjh-mini-street:basket:v1"
BASKET_KEY = "gjh-mini-street:basket:v2"


def route_camera(route):
    # Only place and aim the camera. Production raycasting, occlusion,
    # interactions, rendering and storage still run in the browser.
    source = route.fetch().text()
    marker = 'camera.rotation.order = "YXZ";'
    assert source.count(marker) == 1, "Update the test camera injection for the indoor camera"
    body = source.replace(marker, marker + """
    window.__miniStreetTestSetView = ({eye, target}) => {
      camera.position.set(...eye);
      camera.lookAt(...target);
    };
    """, 1)
    route.fulfill(content_type="text/javascript", body=body)


def basket_button(page, count):
    suffix = "item" if count == 1 else "items"
    return page.get_by_role("button", name=f"Basket, {count} {suffix}", exact=True)


def read_storage(page, key):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key))", key)


def inspect_product(page, product):
    page.evaluate("pose => window.__miniStreetTestSetView(pose)",
                  {"eye": product.eye, "target": product.target})
    inspect = page.get_by_role("button", name=f"Inspect {product.name}", exact=True)
    expect(inspect).to_be_enabled()
    inspect.click()
    dialog = page.get_by_role("dialog", name=product.title, exact=True)
    expect(dialog).to_have_attribute("data-phase", "inspecting")
    expect(dialog.locator(".shop-product-specs dd")).to_have_text([product.size, product.origin])
    return dialog


def check_basket_rows(basket, quantities):
    expect(basket.get_by_role("listitem")).to_have_count(len(quantities))
    for product in PRODUCTS:
        if product.sku not in quantities:
            continue
        row = basket.get_by_role("listitem").filter(has_text=product.name)
        expect(row.get_by_text(product.size, exact=True)).to_be_visible()
        quantity = row.get_by_role("group")
        expect(quantity.locator("span")).to_have_text(str(quantities[product.sku]))
        photo = row.locator("img")
        assert photo.get_attribute("src").endswith(f"/new-moon-{product.sku}-front.webp"), product.sku
        photo.evaluate("image => image.decode()")


def check_shop(browser, url):
    page = browser.new_page(
        viewport={"width": 1280, "height": 800},
        reduced_motion="reduce",
        service_workers="block",
    )
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("**/mini-street/shop-interior.js", route_camera)
    page.goto(url, wait_until="domcontentloaded")

    quantities = {"au-425g": 2}
    legacy = {"version": 1, "items": quantities.copy()}
    page.evaluate("([key, basket]) => localStorage.setItem(key, JSON.stringify(basket))",
                  [LEGACY_KEY, legacy])

    page.locator('a[data-stop="shop"]').click()
    page.get_by_role("button", name="Enter 3D shop", exact=True).click()
    expect(page.get_by_role("button", name="Walk closer and aim", exact=True)).to_be_disabled()

    basket = page.get_by_role("dialog", name="Virtual basket", exact=True)
    basket_button(page, 2).click()
    check_basket_rows(basket, quantities)
    basket.get_by_role("button", name="Continue shopping", exact=True).click()
    assert read_storage(page, BASKET_KEY) is None

    mexico = PRODUCTS[-1]
    dialog = inspect_product(page, mexico)
    dialog.get_by_role("button", name="Put back", exact=True).click()
    expect(dialog).to_be_hidden()
    expect(basket_button(page, 2)).to_be_visible()
    assert read_storage(page, BASKET_KEY) is None
    expect(page.get_by_role("button", name=f"Inspect {mexico.name}", exact=True)).to_be_enabled()

    # The first edit must retain the legacy AU quantity while adding a different SKU.
    for product in (mexico, *PRODUCTS[:-1]):
        dialog = inspect_product(page, product)
        dialog.get_by_role("button", name="Rotate right", exact=True).click()
        dialog.get_by_role("button", name="Reset rotation", exact=True).click()
        dialog.get_by_role("button", name="Add to basket", exact=True).click()
        expect(dialog).to_be_hidden()
        quantities[product.sku] = quantities.get(product.sku, 0) + 1
        expect(basket_button(page, sum(quantities.values()))).to_be_visible()
        assert read_storage(page, BASKET_KEY) == {"version": 2, "items": quantities}

    page.reload(wait_until="domcontentloaded")
    basket_button(page, sum(quantities.values())).click()
    check_basket_rows(basket, quantities)

    basket.get_by_role("button", name=f"Increase quantity for {mexico.name}", exact=True).click()
    quantities[mexico.sku] += 1
    australia = PRODUCTS[0]
    basket.get_by_role("button", name=f"Decrease quantity for {australia.name}", exact=True).click()
    quantities[australia.sku] -= 1
    check_basket_rows(basket, quantities)
    assert read_storage(page, BASKET_KEY) == {"version": 2, "items": quantities}

    for product in PRODUCTS:
        basket.get_by_role("button", name=f"Remove {product.name}", exact=True).click()
    expect(basket.get_by_text("Your basket is empty.", exact=True)).to_be_visible()
    assert read_storage(page, BASKET_KEY) == {"version": 2, "items": {}}
    assert read_storage(page, LEGACY_KEY) == legacy

    page.reload(wait_until="domcontentloaded")
    basket_button(page, 0).click()
    expect(basket.get_by_text("Your basket is empty.", exact=True)).to_be_visible()
    assert not errors, errors
    page.close()


def check_webgl_fallback(browser, url):
    page = browser.new_page(viewport={"width": 390, "height": 700}, service_workers="block")
    page.add_init_script("""(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return /webgl/.test(type) ? null : original.call(this, type, ...args);
      };
    })();""")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url + "#shop-interior", wait_until="domcontentloaded")
    page.wait_for_url("**/#shop")
    for product in PRODUCTS:
        page.get_by_role("button", name=f"Add {product.title} to basket", exact=True).click()
    page.get_by_role("dialog").get_by_role("button", name="Close", exact=True).click()
    basket_button(page, 4).click()
    basket = page.get_by_role("dialog", name="Virtual basket", exact=True)
    check_basket_rows(basket, {product.sku: 1 for product in PRODUCTS})
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
            check_shop(browser, url)
            print("Mini Street four-product picking and v1 basket migration: PASS", flush=True)
            check_webgl_fallback(browser, url)
            print("Mini Street four-product WebGL fallback: PASS", flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    run()
