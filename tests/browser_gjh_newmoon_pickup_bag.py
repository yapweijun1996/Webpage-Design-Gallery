"""Follow New Moon's native shelf pickup, floor and inventory controls in Chrome."""

import argparse
from contextlib import suppress
import functools
import http.server
import json
import math
from pathlib import Path
import sys
import threading

from playwright.sync_api import sync_playwright

from browser_gjh_guide import Quiet

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "docs"))
import mall_browser_probe
from mall_browser_probe import enter, launch
from verify_mall_support import capture, face, probe_url, walk

# The viewer's opaque-origin decoder does not use mall preferences.
mall_browser_probe.INIT = (
    "if (window === window.top && /^https?:$/.test(location.protocol)) {"
    + mall_browser_probe.INIT + "}"
)

PRODUCTS = {
    "nz-425g": ("New Zealand", "425g"),
    "au-425g": ("Australia", "425g"),
    "sa-425g": ("South Africa", "425g"),
    "mx-454g": ("Mexico", "454g"),
}
ZONE = "newmoon"
BROWSE_Z = -8.3
APPROACH = ((-10, -2.65), (-10, -6.5), (-10, BROWSE_Z))


def pose(page):
    return page.evaluate("""() => {
      const {x,y,z,zone,capsuleEnabled,doors,nearby,character} = __mall.state;
      return {x,y,z,zone,capsuleEnabled,door:doors.newmoon,nearby,held:character.physicalProduct};
    }""")


def click(page, selector, touch):
    button = page.locator(selector)
    button.wait_for(state="visible")
    assert button.is_enabled(), (selector, pose(page))
    if touch:
        button.tap()
    else:
        button.click()


def inspect_product(page, touch):
    if not page.locator("#inspect").is_visible():
        click(page, "#hud-more-actions", touch)
    click(page, "#inspect", touch)


def close_modal(page, selector, button, touch, restore):
    if touch:
        click(page, button, True)
    else:
        page.keyboard.press("Escape")
    page.locator(selector).wait_for(state="hidden")
    page.wait_for_function("ids => ids.includes(document.activeElement?.id)", arg=list(restore))
    return page.evaluate("() => document.activeElement.id")


def wait_for_product(page, product_id):
    page.wait_for_function("""id => {
      const held = __mall.state.character.physicalProduct;
      return held?.phase === 'held' && held.id === id;
    }""", arg=product_id)
    return pose(page)["held"]


def empty_hands(page):
    page.wait_for_function("() => __mall.state.character.physicalProduct?.phase === 'empty'")


def floor_pose(page):
    state = pose(page)
    assert state["zone"] == ZONE and state["capsuleEnabled"] and abs(state["y"]) < .05, state
    return state


def bag_rows(page):
    return page.locator("#bag-items li").evaluate_all("""rows => rows.map(row => ({
      id: row.querySelector('[data-bag-focus]').dataset.bagFocus.slice(0,-2),
      name: row.querySelector('h3').textContent,
      image: row.querySelector('img').getAttribute('src'),
      quantity: Number(row.querySelector('output').textContent)
    }))""")


def bag_count(page, expected):
    page.wait_for_function("""count =>
      document.querySelector('#bag-open .hud-bag-count').textContent === String(count)
    """, arg=expected)


def visit_store(page, touch):
    click(page, "#header-map", touch)
    page.wait_for_function("() => document.querySelector('#mall-map').open")
    if page.locator('[data-teleport="newmoon"]').is_visible():
        click(page, '[data-teleport="newmoon"]', touch)
    else:
        page.locator("#map-destination").select_option(ZONE)
        click(page, "#map-visit", touch)
    page.wait_for_function("""() => !document.querySelector('#mall-map').open &&
      Math.hypot(__mall.state.x + 10, __mall.state.z - 2.4) < .07 &&
      document.activeElement?.id === 'scene'
    """)
    arrival = pose(page)
    assert arrival["zone"] == "atrium", arrival
    walk(page, -10, -.85, speed=1.9)
    page.wait_for_function("() => __mall.state.doors.newmoon > .98")
    entry = floor_pose(page)
    for x, z in APPROACH:
        walk(page, x, z, speed=1.9)
    return arrival, entry


def pickup(page, product_id, touch):
    button = page.get_by_role("button", name="Pick up product", exact=True)
    button.wait_for(state="visible")
    assert button.is_enabled(), (product_id, pose(page))
    if touch:
        button.tap()
    else:
        button.click()
    return wait_for_product(page, product_id)


def floor_pickup(page, product_id, touch):
    # Away from the cabinet prompt, exercise the same product as a dropped body.
    walk(page, -6.61, -6.5, speed=1.7)
    walk(page, -10, -6.5, speed=1.7)
    floor = floor_pose(page)["y"]
    click(page, "#held-product-drop", touch)
    empty_hands(page)
    page.wait_for_function("""id => {
      const can = __mall.testProps()?.can;
      return can?.id === id && __mall.state.nearby === 'physics-floor-can';
    }""", arg=product_id)
    drop = page.evaluate("() => __mall.testProps().can")
    assert abs(drop["floor"] - floor) < .015, drop
    inspect_product(page, touch)
    wait_for_product(page, product_id)
    assert page.evaluate("() => __mall.testProps()?.can === null")
    return drop


def exercise(page, touch, out, width):
    arrival, entrance = visit_store(page, touch)
    capture(page, out, f"{width}-door-entered")
    stock = page.evaluate("() => __mall.state.productAssets.cans")
    assert set(stock) == set(PRODUCTS)
    assert all(item["status"] == "loaded" for item in stock.values())
    picks, expected, names = [], {}, {}
    bag_count(page, 0)

    for sku, (country, weight) in PRODUCTS.items():
        can = stock[sku]
        product_id = f"new-moon-{sku}-front"
        can_position = can["placements"][can["reserveIndex"]]
        walk(page, can_position["x"], BROWSE_Z, speed=1.8)
        face(page, can_position["x"], can_position["z"])
        page.wait_for_function("id => __mall.state.nearby === id", arg=product_id)
        before = floor_pose(page)
        inspect_product(page, touch)
        page.locator("#product-dialog").wait_for(state="visible")
        title = page.locator("#product-title").inner_text()
        assert country in title and weight in title, title
        assert sku in page.locator("#product-image").get_attribute("src")
        page.wait_for_function("""sku => {
          const view = window.__newMoonPreview?.state;
          return view?.sku === sku && view.loaded && view.mode === '3d';
        }""", arg=sku)
        names[product_id] = title
        focus = close_modal(page, "#product-dialog", "#product-close", touch, ("inspect", "scene"))
        after = floor_pose(page)
        assert math.dist([after[key] for key in "xyz"], [before[key] for key in "xyz"]) < .02
        bag_count(page, sum(expected.values()))

        held = pickup(page, product_id, touch)
        capture(page, out, f"{width}-{sku}-held")
        if sku == "nz-425g":
            click(page, "#held-product-return", touch)
            empty_hands(page)
            bag_count(page, 0)
            pickup(page, product_id, touch)

        dropped = floor_pickup(page, product_id, touch) if sku == "mx-454g" else None
        click(page, "#held-product-add", touch)
        empty_hands(page)
        expected[product_id] = 1
        bag_count(page, sum(expected.values()))

        if sku == "nz-425g":
            pickup(page, product_id, touch)
            click(page, "#held-product-add", touch)
            empty_hands(page)
            expected[product_id] += 1
            bag_count(page, sum(expected.values()))
        picks.append({"sku": sku, "title": title, "held": held, "floorY": before["y"],
                      "closeFocus": focus, "quantity": expected[product_id], "dropped": dropped})

    click(page, "#bag-open", touch)
    page.locator("#bag-dialog").wait_for(state="visible")
    inventory = bag_rows(page)
    assert len(inventory) == 4 and {row["id"]:row["quantity"] for row in inventory} == expected, inventory
    for row in inventory:
        assert row["name"] == names[row["id"]], row
        assert row["image"].endswith(f'{row["id"]}.jpg'), row
    page.screenshot(path=str(out / f"{width}-bag.png"))
    if touch:
        last_quantity = page.locator("#bag-items li").last.locator("output")
        last_quantity.scroll_into_view_if_needed()
        assert last_quantity.evaluate("""element => {
          const r = element.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width/2, r.y + r.height/2) === element;
        }""")
        page.screenshot(path=str(out / f"{width}-bag-scrolled.png"))
    close_modal(page, "#bag-dialog", "#bag-close", touch, ("bag-open",))
    # Return from the floor pickup along the central aisle and beyond S01's 5.2 m sensor.
    for x, z in ((-10, -2.65), (-10, -.85), (-10, 5.65)):
        walk(page, x, z, speed=1.9)
    page.wait_for_function("() => __mall.state.doors.newmoon < .1")
    exit_state = pose(page)
    assert exit_state["zone"] == "atrium" and exit_state["capsuleEnabled"], exit_state
    bag_count(page, sum(expected.values()))
    capture(page, out, f"{width}-door-closed")
    return {"arrival":arrival, "entrance":entrance, "picks":picks, "inventory":inventory,
            "exit":exit_state}


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--width", type=int, choices=(390, 1440))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(Quiet, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f"http://127.0.0.1:{server.server_port}"
        url = probe_url(origin + "/demos/corporate/gjh/v11/")
        try:
            with sync_playwright() as playwright, launch(playwright) as browser:
                for width, height, tier in ((390, 844, "low"), (1440, 900, "detailed")):
                    if args.width and width != args.width:
                        continue
                    touch = width == 390
                    print(f"Starting Chrome {browser.version}, {width} {tier}", flush=True)
                    with browser.new_context(viewport={"width":width,"height":height}, has_touch=touch,
                                             locale="en-SG", service_workers="block") as context:
                        errors = []
                        context.route("http*://**/*", lambda route: route.continue_()
                                      if route.request.url.startswith(origin + "/") else route.abort())
                        context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
                        page = enter(context, url, tier)
                        try:
                            result = exercise(page, touch, args.out, width)
                            assert not errors, errors
                        except Exception:
                            with suppress(Exception):
                                page.screenshot(path=str(args.out / f"{width}-failure.png"), timeout=5000)
                                (args.out / f"{width}-failure.json").write_text(json.dumps(pose(page), indent=2))
                            raise
                        result.update(viewport=[width,height], tier=tier, input="touch" if touch else "keyboard/mouse",
                                      browser=browser.version)
                        (args.out / f"{width}-result.json").write_text(json.dumps(result, indent=2) + "\n")
                        print(f"Passed {width} {tier}", flush=True)
        finally:
            server.shutdown()


if __name__ == "__main__":
    run()
