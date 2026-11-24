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
ANCHORS = {
    "au-425g": "entry-display",
    "nz-425g": "right-shelf-front",
    "sa-425g": "right-shelf-middle",
    "mx-454g": "back-shelf-left",
}


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
    window.__miniStreetTestCanRotation = () => scene.getObjectByName("Held can")?.quaternion.toArray();
    window.__miniStreetTestContactVisible = (anchorId) => {
      const contact = scene.getObjectByName(anchorId)?.getObjectByName("Shelf can contact");
      if (!contact) return null;
      for (let node = contact; node; node = node.parent) {
        if (!node.visible) return false;
      }
      return true;
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
    assert page.evaluate("id => window.__miniStreetTestContactVisible(id)", ANCHORS[product.sku]) is True
    inspect.click()
    dialog = page.get_by_role("dialog", name=product.title, exact=True)
    expect(dialog).to_have_attribute("data-phase", "inspecting")
    expect(dialog.locator(".shop-product-specs dd")).to_have_text([product.size, product.origin])
    # A failed held model leaves the original shelf can and its shadow visible.
    fallback = dialog.get_attribute("data-fallback") is not None
    assert page.evaluate("id => window.__miniStreetTestContactVisible(id)", ANCHORS[product.sku]) is fallback
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
    assert page.evaluate("id => window.__miniStreetTestContactVisible(id)", ANCHORS[mexico.sku]) is True
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
        assert page.evaluate("id => window.__miniStreetTestContactVisible(id)", ANCHORS[product.sku]) is True
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


def expect_can_rotation(page, front, back=False):
    # Unit quaternions are equivalent up to sign. Their absolute dot product
    # is 1 for the same orientation and 0 for a 180-degree turn.
    page.wait_for_function("""({front, back}) => {
      const rotation = window.__miniStreetTestCanRotation();
      if (!rotation) return false;
      const dot = Math.abs(rotation.reduce((sum, component, i) => sum + component * front[i], 0));
      return back ? dot < 0.06 : dot > 0.999;
    }""", arg={"front": front, "back": back})


def check_desktop_inspection_controls(browser, url):
    page = browser.new_page(viewport={"width": 1280, "height": 800}, service_workers="block")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("**/mini-street/shop-interior.js", route_camera)
    model = "**/new-moon-can-au-425g-lod1.glb"
    with page.expect_response(model) as shelf_response:
        page.goto(url + "#shop-interior", wait_until="domcontentloaded")
    assert shelf_response.value.ok

    australia = PRODUCTS[0]
    page.evaluate("pose => window.__miniStreetTestSetView(pose)",
                  {"eye": australia.eye, "target": australia.target})
    inspect = page.get_by_role("button", name=f"Inspect {australia.name}", exact=True)
    expect(inspect).to_be_enabled()
    pending = []
    page.route(model, lambda route: pending.append(route))
    with page.expect_request(model):
        inspect.press("Enter")
    dialog = page.get_by_role("dialog", name=australia.title, exact=True)
    expect(dialog).to_have_attribute("data-phase", "loading")
    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden()
    expect(page.locator(".shop-interior-controls")).to_be_focused()
    expect(basket_button(page, 0)).to_be_visible()
    assert page.evaluate("id => window.__miniStreetTestContactVisible(id)", ANCHORS[australia.sku])

    inspect.press("Enter")
    expect(dialog).to_have_attribute("data-phase", "loading")
    request = pending[0]
    request.fulfill(response=request.fetch())
    expect(dialog).to_have_attribute("data-phase", "inspecting")
    front = page.evaluate("window.__miniStreetTestCanRotation()")
    rotate = dialog.get_by_role("button", name="Rotate right", exact=True)
    rotate.press("Enter")
    rotate.evaluate("button => { for (let i = 0; i < 7; i++) button.click(); }")
    expect_can_rotation(page, front, back=True)
    dialog.get_by_role("button", name="Reset rotation", exact=True).press("Enter")
    expect_can_rotation(page, front)

    preview = dialog.locator(".shop-product-preview")
    bounds = preview.bounding_box()
    x = bounds["x"] + bounds["width"] * 0.25
    y = bounds["y"] + bounds["height"] * 0.5
    page.mouse.move(x, y)
    page.mouse.down()
    expect(preview).to_have_attribute("data-dragging", "")
    page.mouse.move(x + 196, y, steps=8)
    expect_can_rotation(page, front, back=True)
    page.keyboard.press("Escape")
    expect(preview).not_to_have_attribute("data-dragging", "")
    expect(dialog).to_be_hidden()
    page.mouse.move(x, y)
    page.mouse.up()
    page.mouse.move(1, 1)
    expect(basket_button(page, 0)).to_be_visible()

    expect(inspect).to_be_enabled()
    inspect.press("Enter")
    expect(dialog).to_have_attribute("data-phase", "inspecting")
    expect_can_rotation(page, front)
    # Deliver two add events and interrupt the stow before its next frame.
    dialog.get_by_role("button", name="Add to basket", exact=True).evaluate("""button => {
      button.click();
      button.click();
      document.activeElement.dispatchEvent(new KeyboardEvent("keydown",
        {key: "Escape", code: "Escape", bubbles: true, cancelable: true}));
    }""")
    expect(dialog).to_be_hidden()
    expect(basket_button(page, 1)).to_be_visible()
    assert page.evaluate("id => window.__miniStreetTestContactVisible(id)", ANCHORS[australia.sku])
    assert read_storage(page, BASKET_KEY) == {"version": 2, "items": {australia.sku: 1}}
    assert not errors, errors
    page.close()


def check_touch_inspection_controls(browser, url):
    page = browser.new_page(
        viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True,
        reduced_motion="reduce", service_workers="block",
    )
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("**/mini-street/shop-interior.js", route_camera)
    page.goto(url + "#shop-interior", wait_until="domcontentloaded")
    australia = PRODUCTS[0]
    expect(basket_button(page, 0)).to_be_visible()
    page.evaluate("pose => window.__miniStreetTestSetView(pose)",
                  {"eye": australia.eye, "target": australia.target})
    inspect = page.get_by_role("button", name=f"Inspect {australia.name}", exact=True)
    inspect.tap()
    dialog = page.get_by_role("dialog", name=australia.title, exact=True)
    expect(dialog).to_have_attribute("data-phase", "inspecting")
    front = page.evaluate("window.__miniStreetTestCanRotation()")
    preview = dialog.locator(".shop-product-preview")
    bounds = preview.bounding_box()
    x = round(bounds["x"] + bounds["width"] * 0.2)
    y = round(bounds["y"] + bounds["height"] * 0.55)
    session = page.context.new_cdp_session(page)

    def touch(kind, *points):
        session.send("Input.dispatchTouchEvent", {
            "type": kind,
            "touchPoints": [{"x": point_x, "y": point_y, "id": 0} for point_x, point_y in points],
        })

    # Make the document scrollable so a missing touch-action rule is observable.
    page.add_style_tag(content="body { min-height: 150vh; }")
    scroll_top = page.evaluate("document.scrollingElement.scrollTop")
    touch("touchStart", (x, y))
    touch("touchMove", (x + 48, y - 40))
    expect(preview).to_have_attribute("data-dragging", "")
    touch("touchCancel")
    expect(preview).not_to_have_attribute("data-dragging", "")
    reset = dialog.get_by_role("button", name="Reset rotation", exact=True)
    reset.tap()
    expect_can_rotation(page, front)
    touch("touchStart", (x, y))
    for dx, dy in [(48, -40), (96, -48), (147, -50), (196, -50)]:
        touch("touchMove", (x + dx, y + dy))
    touch("touchEnd")
    expect(preview).not_to_have_attribute("data-dragging", "")
    expect_can_rotation(page, front, back=True)
    assert page.evaluate("document.scrollingElement.scrollTop") == scroll_top

    reset.tap()
    expect_can_rotation(page, front)
    dialog.get_by_role("button", name="Put back", exact=True).tap()
    expect(dialog).to_be_hidden()
    expect(basket_button(page, 0)).to_be_visible()
    inspect.tap()
    expect(dialog).to_have_attribute("data-phase", "inspecting")
    dialog.get_by_role("button", name="Add to basket", exact=True).tap()
    expect(dialog).to_be_hidden()
    page.reload(wait_until="domcontentloaded")
    basket_button(page, 1).tap()
    check_basket_rows(page.get_by_role("dialog", name="Virtual basket"), {australia.sku: 1})
    assert not errors, errors
    page.close()


def expect_fallback_display(page):
    page.wait_for_url("**/#shop", timeout=15000)
    display = page.locator("#stop-dialog")
    expect(display).to_be_visible()
    expect(display.get_by_role("button", name="Enter 3D shop", exact=True)).to_be_hidden()
    for product in PRODUCTS:
        expect(display.get_by_role("button", name=f"Add {product.title} to basket", exact=True)).to_be_visible()
    return display


def lose_webgl_context(page):
    page.locator("#view").evaluate("""canvas => {
      const extension = canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("Missing WEBGL_lose_context extension");
      extension.loseContext();
    }""")


def check_runtime_context_loss(browser, url):
    page = browser.new_page(viewport={"width": 320, "height": 700}, service_workers="block",
                            reduced_motion="reduce")
    page.goto(url, wait_until="domcontentloaded")
    page.locator('a[data-stop="shop"]').click()
    page.get_by_role("button", name="Enter 3D shop", exact=True).click()
    expect(basket_button(page, 0)).to_be_visible()
    page.evaluate("history.pushState(history.state, '', '#shop-interior')")

    lose_webgl_context(page)
    expect_fallback_display(page)
    page.evaluate("""() => new Promise(resolve => {
      window.addEventListener("hashchange", resolve, {once: true});
      history.back();
    })""")
    display = expect_fallback_display(page)
    display.get_by_role("button", name="Add Mexican abalone to basket", exact=True).click()
    display.get_by_role("button", name="Close", exact=True).click()
    masthead = page.locator(".masthead-inner")
    assert masthead.evaluate("(node) => node.scrollWidth <= node.clientWidth")
    assert page.locator(".masthead-inner > .mini-basket-dock").count() == 1
    basket_button(page, 1).click()
    check_basket_rows(page.get_by_role("dialog", name="Virtual basket"), {"mx-454g": 1})
    expect(page.locator("#mini-basket")).to_have_count(1)
    page.get_by_role("button", name="Continue shopping", exact=True).click()
    page.locator('a[data-stop="shop"]').click()
    expect_fallback_display(page)
    page.close()


def check_pending_shop_context_loss(browser, url):
    page = browser.new_page(viewport={"width": 390, "height": 700}, service_workers="block")
    pending = []
    shop_module = "**/mini-street/shop-experience.js"
    page.route(shop_module, lambda route: pending.append(route))
    with page.expect_request(shop_module):
        page.goto(url + "#shop-interior", wait_until="domcontentloaded")

    lose_webgl_context(page)
    expect_fallback_display(page)
    response = pending[0].fetch()
    pending[0].fulfill(response=response, body=response.text() + "\nwindow.__shopModuleEvaluated = true;")
    page.wait_for_function("window.__shopModuleEvaluated")
    page.evaluate("() => new Promise(requestAnimationFrame)")
    expect(page.locator("#mini-basket")).to_have_count(1)
    expect(page.locator(".shop-experience")).to_have_count(0)
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
    expect_fallback_display(page)
    page.evaluate("location.hash = 'shop-interior'")
    display = expect_fallback_display(page)
    for product in PRODUCTS:
        display.get_by_role("button", name=f"Add {product.title} to basket", exact=True).click()
    display.get_by_role("button", name="Close", exact=True).click()
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
            check_desktop_inspection_controls(browser, url)
            print("Mini Street desktop backside rotation and inspection interruptions: PASS", flush=True)
            check_touch_inspection_controls(browser, url)
            print("Mini Street touch backside rotation and basket persistence: PASS", flush=True)
            check_webgl_fallback(browser, url)
            print("Mini Street four-product WebGL fallback: PASS", flush=True)
            check_runtime_context_loss(browser, url)
            check_pending_shop_context_loss(browser, url)
            print("Mini Street context loss, history and pending import: PASS", flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    run()
