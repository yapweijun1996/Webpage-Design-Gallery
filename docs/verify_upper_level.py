"""Verify manual and map lift travel in headed Chrome with a phone touch viewport."""
from contextlib import suppress
import json
import math
from pathlib import Path

from mall_browser_probe import INIT, launch
from verify_mall_support import capture, options, probe_url, require


ROUTE = Path(__file__).with_name("gjh-v11-upper-level-route.json")
LIFT = (-6.4, 10)
UPPER_Y = 7.2


def floor(page, zone, y):
    page.wait_for_function("""([zone,y]) => {
        const s = __mall.state;
        return s.zone === zone && Math.abs(s.y-y) < .08 && !s.elevatorTravel &&
            s.capsuleEnabled && s.elevator.docked === y;
    }""", arg=[zone, y], timeout=30000)


def walk(page, label, at, zone="upper", y=UPPER_Y):
    pose = page.evaluate("""async ([x,z]) => {
        const {x:px,y,z:pz,zone} = await __mall.testWalkTo(x,z,{speed:2.5});
        return {x:px,y,z:pz,zone};
    }""", at)
    require(pose["zone"] == zone and abs(pose["y"] - y) < .08 and
            math.hypot(pose["x"] - at[0], pose["z"] - at[1]) <= .081,
            f"{label}: missed {at} on {zone}: {pose}")


def select_floor(page, destination):
    page.locator("#header-map").tap()
    menu = page.locator("#map-destination")
    require(menu.locator("option").count() == 19, "Expected 17 stores and both floors")
    require(menu.locator('option[value="floor-upper"]').inner_text() == "Upper level", "Missing upper floor")
    require(menu.locator('option[value="floor-ground"]').inner_text() == "Ground floor", "Missing ground floor")
    menu.select_option(destination)
    ride = page.get_by_role("button", name="Ride lift", exact=True)
    ride.tap()


def verify(page, args):
    walk(page, "ground lift", LIFT, "atrium", 0)
    hint = page.locator("#hud-lift-hint")
    require(hint.is_visible(), "First-visit lift hint is hidden")
    require(hint.inner_text() == "Upper level: take the lift (Ride)", "Incorrect lift hint")
    capture(page, args.out, "ground-lift")
    ride = page.locator("#inspect")
    require(ride.is_visible() and ride.bounding_box()["height"] >= 44, "Ride touch target is too small")
    require(page.locator("#inspect-verb").inner_text() == "Ride", "Ride is missing at the lift")
    ride.tap()
    floor(page, "upper", UPPER_Y)
    page.wait_for_function("document.querySelector('[data-hud-progress=upper]').textContent === '1 / 1'")
    require(not hint.is_visible(), "First-visit hint remained visible")
    require(not page.locator("#hud-context-text").is_visible(), "Ground quest is visible upstairs")

    page.wait_for_function("__mall.testUpperPoints().length === 20", timeout=60000)
    targets = page.evaluate("__mall.testUpperPoints()")
    seats = {point["name"]: point for point in targets if point.get("name")}
    plaques = [point for point in targets if point["id"].startswith("brand-plaque-")]
    require(len(seats) == 3 and len(plaques) == 17, f"Incomplete upper POIs: {targets}")
    for stop in json.loads(ROUTE.read_text()):
        name = stop["id"]
        if name == "brand-wall":
            for point in plaques:
                walk(page, point["id"], [point["x"], point["z"]])
        else:
            point = seats[name] if "at" not in stop else None
            walk(page, name, stop.get("at") if point is None else [point["x"], point["z"]])
        if name in {"lightwell viewpoint", "directory"}:
            capture(page, args.out, name.replace(" ", "-"))

    ride.tap()
    floor(page, "atrium", 0)
    require(not hint.is_visible(), "Completed visit hint reappeared on return")
    # Start away from the lift and verify the map shortcut uses the cabin.
    walk(page, "ground map departure", (-8, 10), "atrium", 0)
    select_floor(page, "floor-upper")
    in_cabin = "() => { const s = __mall.state; return s.elevatorTravel && s.y > .2 && s.y < 7; }"
    page.wait_for_function(in_cabin, timeout=30000)
    floor(page, "upper", UPPER_Y)

    # Set up an undocked cabin by using the diagnostic ground-position shortcut.
    require(page.evaluate("__mall.teleport('atrium')"), "Could not set up the empty cabin call")
    require(page.evaluate("__mall.state.elevator.docked") == UPPER_Y, "Cabin should still be upstairs")
    select_floor(page, "floor-upper")
    page.wait_for_function("__mall.state.elevator.calling", timeout=30000)
    page.wait_for_function(in_cabin, timeout=30000)
    floor(page, "upper", UPPER_Y)

    walk(page, "upper map departure", (-8.18, 10))
    select_floor(page, "floor-ground")
    page.wait_for_function(in_cabin, timeout=30000)
    floor(page, "atrium", 0)
    print("PASS: manual and map lift round trips, objective and all 20 upper POIs")


def main():
    from playwright.sync_api import sync_playwright

    args = options("verify-upper-level", __doc__).parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright, launch(playwright) as browser:
        context = browser.new_context(viewport={"width":390, "height":844}, device_scale_factor=3,
                                      is_mobile=True, has_touch=True, locale="en-SG",
                                      reduced_motion="no-preference", service_workers="block")
        context.add_init_script(INIT % args.tier)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            page.goto(probe_url(args.url), wait_until="domcontentloaded")
            page.locator("#arrival-walk").tap()
            page.wait_for_function("""window.__mall?.ready && window.__sceneReady &&
                document.querySelector('#app-loader').hidden""", timeout=240000)
            verify(page, args)
            require(not errors, f"Uncaught page errors: {errors}")
        except Exception:
            with suppress(Exception):
                page.screenshot(path=str(args.out / "failure.png"), timeout=5000)
            raise


if __name__ == "__main__":
    main()
