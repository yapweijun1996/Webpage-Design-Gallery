"""Walk stock Gigaset in desktop and touch Chrome and exercise its native sofa."""
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

from gjh_menu_test_helpers import close_menu, open_menu_page
from gjh_startup_test_helpers import wait_for_quality

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "docs"))
import mall_browser_probe
from mall_browser_probe import assert_teleport, enter, launch
from verify_interactions import select_action
from verify_mall_support import capture, face, probe_url, walk

ZONE = "planned-space-17"
SOFA = "gigaset-lounge-sofa"
BENCH = "gigaset-backless-bench"
BENCH_AISLE = ((38.9, 44), (38.9, 42.5))
HANDSET = "S17-handset"
STORY = "gigaset-phone-story"
SOFA_ASSET = "gallery-assets/lounge-sofa-bench.glb"

# The app tests its image decoder in an opaque-origin frame. Preferences apply
# to the mall page, and the decoder needs no local storage.
mall_browser_probe.INIT = (
    "if (window === window.top && /^https?:$/.test(location.protocol)) {"
    + mall_browser_probe.INIT + "}"
)


class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def pose(page):
    return page.evaluate("() => {const {x,y,z,zone,seatId,seatPhase,seated,nearby,doors} = __mall.state;"
                         "return {x,y,z,zone,seatId,seatPhase,seated,nearby,door:doors['planned-space-17'],"
                         "capsule:__mall.state.capsuleEnabled, seatWeight:__mall.state.character.seatWeight};}")


def activate(page, touch):
    inspect = page.locator("#inspect")
    inspect.wait_for(state="visible")
    assert inspect.is_enabled()
    if touch:
        inspect.tap()
    else:
        page.locator("#scene").focus()
        page.keyboard.press("f")


def selected(page, target, label=None):
    assert select_action(page, {"id": target}), (target, pose(page))
    if label:
        assert page.locator("#inspect-verb").inner_text() == label


def approach_handset(page):
    # The aisle turns around the central display to the right-facing fixture.
    for x, z in ((38.13, 44), (39.9, 45.75), (41.65, 45.75)):
        walk(page, x, z, speed=1.9)
    handset = page.evaluate("async id => (await __mall.testShopActions()).find(item => item.id === id)", HANDSET)
    assert handset and handset["zone"] == ZONE, handset
    walk(page, handset["standing"]["x"], handset["standing"]["z"], speed=1.8)
    face(page, handset["x"], handset["z"])
    return handset


def sofa_model(page, fallback):
    model = page.evaluate("asset => ({"
                          "status:__mall.state.modelPreload.models['./' + asset],"
                          "nodes:__mall.testSceneNames('^S17 (interior|gallery:.*lounge-sofa-bench)')})",
                          SOFA_ASSET)
    assert model["status"] == ("fallback" if fallback else "loaded"), model
    assert any(item["n"] == "S17 interior" and item["vis"] for item in model["nodes"]), model
    visible_gallery = [item for item in model["nodes"] if item["n"].startswith("S17 gallery")]
    assert [item["vis"] for item in visible_gallery] == ([] if fallback else [True]), model
    return model["status"]


def exercise_seat(page, out, label, touch, fallback, seat_id):
    seats = page.evaluate("id => __mall.state.seats.filter(seat => seat.id === id)", seat_id)
    assert len(seats) == 1, (seat_id, seats)
    seat = seats[0]
    walk(page, seat["exitX"], seat["exitZ"], speed=1.8)
    approach = pose(page)
    assert approach["capsule"] and abs(approach["y"] - seat["bounds"]["min"]["y"]) < .016, approach
    face(page, seat["x"], seat["z"])
    selected(page, seat_id, "Sit")
    asset_status = sofa_model(page, fallback)
    activate(page, touch)
    try:
        page.wait_for_function("id => __mall.state.seated && __mall.state.seatId === id"
                               " && __mall.state.seatPhase === 'seated'", arg=seat_id, timeout=7000)
    except Exception as error:
        raise AssertionError((seat_id, pose(page), page.locator("#nearby-name").inner_text(), seat)) from error
    seated = pose(page)
    assert not seated["capsule"] and seated["seatWeight"] == 1, seated
    assert math.dist((seated["x"], seated["z"]), (seat["x"], seat["z"])) < .10, (seated, seat)
    capture(page, out, f"{label}-seated")

    if touch:
        activate(page, True)
    else:
        page.locator("#scene").focus()
        page.keyboard.press("Escape")
    page.wait_for_function("() => !__mall.state.seated && __mall.state.seatPhase === 'idle'")
    standing = pose(page)
    assert standing["zone"] == ZONE and standing["seatId"] is None and standing["capsule"], standing
    assert math.dist((standing["x"], standing["z"]), (seat["exitX"], seat["exitZ"])) < .10, (standing, seat)
    capture(page, out, f"{label}-standing")
    return {"seatId":seat_id,"anchor":seat,"approach":approach,"seated":seated,"stood":standing,"sofaAsset":asset_status}


def scenario(page, out, width, touch, fallback, switch_tier):
    assert_teleport(page, ZONE)
    start = pose(page)
    assert math.dist((start["x"], start["z"]), (32.6, 44)) < .12, start
    walk(page, 35.9, 44, speed=1.9)
    assert pose(page)["zone"] == ZONE and pose(page)["door"] > .9, pose(page)
    page.wait_for_function("() => Boolean(__mall.testShopActions())", timeout=20000)

    walk(page, 38.13, 44, speed=1.9)
    sofa = exercise_seat(page, out, width, touch, fallback, SOFA)
    walk(page, 38.13, 44, speed=1.8)
    for x, z in BENCH_AISLE:
        walk(page, x, z, speed=1.8)
    bench = exercise_seat(page, out, f"{width}-bench", touch, fallback, BENCH)

    switched_to = None
    if switch_tier and not touch:
        open_menu_page(page, "graphics")
        page.locator("#graphics-quality").select_option("low")
        wait_for_quality(page, "low")
        close_menu(page)
        face(page, bench["anchor"]["x"], bench["anchor"]["z"])
        selected(page, BENCH, "Sit")
        sofa_model(page, fallback)
        capture(page, out, f"{width}-bench-switched-low")
        switched_to = "low"

    for x, z in reversed(BENCH_AISLE):
        walk(page, x, z, speed=1.8)
    if switched_to:
        walk(page, 38.13, 44, speed=1.8)
        seat = sofa["anchor"]
        walk(page, seat["exitX"], seat["exitZ"], speed=1.8)
        face(page, seat["x"], seat["z"])
        selected(page, SOFA, "Sit")
        sofa_model(page, fallback)
        capture(page, out, f"{width}-switched-low")
    handset = approach_handset(page)
    selected(page, HANDSET, handset["label"])
    activate(page, touch)
    page.wait_for_function("id => __mall.testShopState(id)?.phase === 'done'", arg=HANDSET)
    assert page.locator("#nearby-name").inner_text() == handset["done"]
    handset_state = page.evaluate("id => __mall.testShopState(id)", HANDSET)
    capture(page, out, f"{width}-handset")

    walk(page, 42.6, 45.3, speed=1.8)
    face(page, 42.28, 43.45)
    selected(page, STORY)
    activate(page, touch)
    page.locator("#product-dialog").wait_for(state="visible")
    catalogue_title = page.locator("#product-title").inner_text()
    assert catalogue_title == "Gigaset · Handsets and their bases"
    assert all(model in page.locator("#product-description").inner_text()
               for model in ("A170", "COMFORT 550A"))
    capture(page, out, f"{width}-catalogue")
    page.locator("#product-close").click()
    page.locator("#product-dialog").wait_for(state="hidden")
    page.locator("#scene").focus()

    # Continue beyond the 3.25 m automatic-door sensor on the arcade side.
    for x, z in ((41.65, 45.75), (39.9, 45.75), (38.13, 44), (35.9, 44), (31.4, 44)):
        walk(page, x, z, speed=1.9)
    exited = pose(page)
    assert exited["zone"] != ZONE and not exited["seated"], exited
    page.wait_for_function("zone => __mall.state.doors[zone] < .1", arg=ZONE)
    capture(page, out, f"{width}-exited")
    return {**sofa, "bench":bench, "entrance":start, "exited":exited, "switchedTo":switched_to,
            "handset":handset_state, "catalogue":catalogue_title, "standInput":"touch" if touch else "Escape"}


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--truncate-sofa", action="store_true", help="Return a truncated sofa GLB")
    parser.add_argument("--switch-tier", action="store_true", help="Check a live Detailed to Low switch")
    parser.add_argument("--width", type=int, choices=[390, 1440])
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0),
                                         functools.partial(QuietServer, directory=str(ROOT))) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        default = f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/"
        results = []
        try:
            with sync_playwright() as playwright, launch(playwright) as browser:
                for width, height, tier in ((390, 844, "low"), (1440, 900, "detailed")):
                    if args.width and args.width != width:
                        continue
                    touch = width == 390
                    print(f"Starting {width} {tier}, truncated GLB={args.truncate_sofa}", flush=True)
                    context = browser.new_context(viewport={"width": width, "height": height},
                                                  has_touch=touch, service_workers="block")
                    truncated = []
                    if args.truncate_sofa:
                        fragment = (ROOT / "demos/corporate/gjh/v11/assets" / SOFA_ASSET).read_bytes()[:4096]
                        def truncate(route):
                            truncated.append(route.request.url)
                            route.fulfill(status=200, content_type="model/gltf-binary", body=fragment)
                        context.route(f"**/assets/{SOFA_ASSET}", truncate)
                    errors = []
                    context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
                    page = enter(context, probe_url(args.url or default), tier)
                    try:
                        result = scenario(page, args.out, width, touch, args.truncate_sofa, args.switch_tier)
                    except Exception:
                        with suppress(Exception):
                            page.screenshot(path=str(args.out / f"{width}-failure.png"), timeout=5000)
                        raise
                    assert not errors, errors
                    if args.truncate_sofa:
                        assert truncated, "Did not exercise partial sofa delivery"
                    result.update(viewport=[width, height], tier=tier, truncated=bool(truncated),
                                  input="touch" if touch else "keyboard")
                    results.append(result)
                    context.close()
                    print(f"Passed {width} {tier}", flush=True)
        finally:
            server.shutdown()
    (args.out / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    run()
