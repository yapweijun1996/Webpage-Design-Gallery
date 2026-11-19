"""Walk to each playable item, exercise the HUD action and record screenshots."""
from contextlib import suppress
import json
from pathlib import Path

from mall_browser_probe import assert_teleport
from verify_mall_support import capture, face, options, press, require, run, walk

PROGRAMME = Path(__file__).with_name("gjh-v11-interior-program.json")
NATIVE_SEATS = {"S01-stools11", "S01-stools12", "S03-stools31", "S03-stools32", "S03-stools33"}

# Intermediate aisle marks keep each segment clear of fixed furniture.
WAYPOINTS = {
    "S01-shelves4": [(-10, -3.9)],
    "S01-kettle": [(-10, -3.65)],
    "S02-rearLights1": [(1.25, -4.15), (1.25, -6.9), (1, -7.15)],
    "S02-rearLights2": [(1.25, -4.15), (1.25, -8.15)],
    "S02-plant2": [(1.25, -4.15), (1.25, -6.9), (0.75, -7.4)],
    "S03-pend3": [(10, -2.4)],
    "S03-cold": [(8.75, -7.4)],
    "S03-fern3": [(11.25, -7.4), (11.5, -7.65)],
    "S05-focal": [(28.25, -6.15), (28.25, -7.4)],
    "S06-onleft": [(-19.9, 6.25), (-21.4, 6.25)],
    "S07-onleft": [(-17.15, 12)],
    "S10-backright": [(-16.9, 35)],
    "S11-onleft": [(-17.15, 44)],
    "S12-backright": [(36.65, 4.75)],
    "S13-onleft": [(39.65, 13.5), (42.15, 13.75), (42.4, 13.5)],
    "S14-focal": [(40.4, 21.75), (41.4, 21.75)],
    "S14-backleft": [(40.4, 21.75), (41.4, 21.75)],
    "S15-pianoback": [(39.4, 30), (40.9, 30.5), (41.4, 30.5)],
    "S17-handset": [(39.9, 45.75), (41.65, 45.75)],
    "S17-onleft": [(39.65, 45.75)],
}


def expected_items(stores):
    return {
        (store["slot"], item["id"])
        for store in stores
        for item in store["items"]
        if item["a11y"].get("action") or item["id"] in NATIVE_SEATS
        or (store["slot"] in {"S01", "S02", "S03"} and item["action"] and "sit" not in item["action"])
    }


def shop_threshold(store):
    frame = store["frame"]
    x, _, z = frame["world_origin_m"]
    front = frame["lot_width_depth_m"][1] / 2 - .9
    yaw = frame["yaw_world_deg"]
    if yaw == 0:
        return x, z + front
    if yaw == 90:
        return x + front, z
    if yaw == -90 or yaw == 270:
        return x - front, z
    raise ValueError(f"Unexpected shop frame yaw {yaw}")


def enter_shop(page, store, zone):
    assert_teleport(page, zone)
    page.wait_for_function("zone => __mall.state.doors[zone] > .98", arg=zone)
    pose = walk(page, *shop_threshold(store))
    require(pose["zone"] == zone, f"Expected {zone} at entrance: {pose}")


def await_actions(page):
    page.wait_for_function("() => Boolean(__mall.testShopActions())")
    return page.evaluate("() => __mall.testShopActions()")


def select_action(page, item):
    for attempt in range(3):
        if page.evaluate("() => __mall.state.nearby") == item["id"]:
            return True
        if attempt == 2 or not press(page, "next"):
            break
    return False


def exercise_item(page, args, store, item, row):
    enter_shop(page, store, item["zone"])
    for x, z in WAYPOINTS.get(item["item"], ()):
        walk(page, x, z)
    standing = item["standing"]
    walk(page, standing["x"], standing["z"], speed=1.8)
    face(page, item["x"], item["z"])
    selected = select_action(page, item)
    inspect = page.locator("#inspect")
    more = page.locator("#hud-more-actions")
    if selected and not inspect.is_visible() and more.is_visible():
        more.click()
    before = capture(page, args.out, f'{item["item"]}-before')
    row["screenshot"] = str(before)
    offered = page.locator("#inspect-verb").inner_text()
    row["reachable"] = selected and offered == item["label"] and inspect.is_visible() and inspect.is_enabled()
    require(row["reachable"],
            f'Expected {item["label"]}; nearby={page.evaluate("() => __mall.state.nearby")}, HUD={offered}')
    if item.get("seat"):
        require(press(page, "interact"), "Seat dispatch failed")
        page.wait_for_function("""id => __mall.state.seatId === id && __mall.state.seatPhase === 'seated'""",
                               arg=item["id"])
    else:
        dispatched = page.evaluate("""id => ({
          accepted:__mall.testPress('interact'), phase:__mall.testShopState(id)?.phase
        })""", item["id"])
        require(dispatched == {"accepted": True, "phase": "executing"}, f"Action did not start: {dispatched}")
        page.wait_for_function("id => __mall.testShopState(id)?.phase === 'done'", arg=item["id"])
        actual = page.evaluate("id => __mall.testShopState(id).message", item["id"])
        audio = item["done"] == 'Audio setting changed.' and actual in ('Demo audio muted.', 'Demo audio enabled.')
        require(actual == item["done"] or audio, f'Expected {item["done"]!r}; got {actual!r}')
        if actual:
            require(page.locator("#nearby-name").inner_text() == actual, "Missing completion message in HUD")
    row["triggered"] = True
    after = capture(page, args.out, f'{item["item"]}-after')
    row["screenshot"] = f"{before}, {after}"
    if item.get("seat"):
        page.locator("#inspect").click()
        page.wait_for_function("() => !__mall.state.seated")


def verify(page, args):
    # Reproduce the old manual scheduler pattern once, then exercise the live hooks.
    page.evaluate("""() => {
      __mall.setInput({forward:0,right:0});
      for (let i = 0; i < 12; i++) __mall.step(17);
    }""")
    try:
        capture(page, args.out, "manual-step-canvas")
    finally:
        page.evaluate("() => __mall.setInput(null)")
    stores = {s["slot"]: s for s in json.loads(PROGRAMME.read_text(encoding="utf-8"))["stores"]}
    enter_shop(page, stores["S01"], "newmoon")
    actions = await_actions(page)
    expected = expected_items(stores.values())
    actual = {(item["slot"], item["item"]) for item in actions}
    require(len(actual) == len(actions) and actual == expected,
            f"Action inventory mismatch. Missing {sorted(expected - actual)}; extra {sorted(actual - expected)}")
    rows = []
    for item in actions:
        if args.shop and item["slot"] not in args.shop:
            continue
        row = dict(shop=item["slot"], item=item["item"], label=item["label"],
                   reachable=False, triggered=False, screenshot="")
        rows.append(row)
        try:
            exercise_item(page, args, stores[item["slot"]], item, row)
        except Exception as error:
            row["error"] = str(error)
            if not row["screenshot"]:
                path = args.out / f'{item["item"]}-failure.png'
                with suppress(Exception):
                    page.screenshot(path=str(path), timeout=5000)
                    row["screenshot"] = str(path)
    columns = ("shop", "item", "label", "reachable", "triggered", "screenshot")
    print(" | ".join(columns))
    for row in rows:
        print(" | ".join(str(row[col]) for col in columns))
        if row.get("error"):
            print("  " + row["error"].splitlines()[0])
    (args.out / "interactions.json").write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    require(all(row["triggered"] and not row.get("error") for row in rows), "One or more shop actions failed")


if __name__ == "__main__":
    parser = options("verify-interactions", __doc__)
    parser.add_argument("--shop", action="append", choices=[f"S{i:02d}" for i in range(1, 18)])
    run(parser.parse_args(), verify, npcs="off")
