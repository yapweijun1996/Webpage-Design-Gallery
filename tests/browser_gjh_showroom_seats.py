"""Walk to showroom seats and operate their native controls in Chrome."""

import argparse
import functools
import http.server
import math
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

from browser_gjh_gigaset_seat import ROOT, QuietServer, activate, selected
from mall_browser_probe import assert_teleport, enter, launch
from verify_mall_support import face, probe_url, walk

# These waypoints follow the clear aisles from the door to each seat's front.
# The final standing point and cushion come from the live registered seat.
ROUTES = {
    "S08-leftmid": ((-16, 20), (-18.45, 20), (-18.45, 21.45)),
    "S13-backleft": ((35.9, 12), (39.25, 13.85), (42.6, 13.85), (42.6, 11.15), (42.2, 10.85)),
    "S14-leftmid": ((35.9, 20), (39.8, 21.8), (41.5, 21.8), (41.75, 21.4), (41.75, 18.0)),
    "S14-leftfront": ((35.9, 20), (37.2, 19.1)),
    "lg-studio-sofa": ((35.9, 20), (37.4, 20), (38.55, 19.3)),
    "casio-keyboard-bench": ((35, 28), (37.1, 29)),
    "S15-backleft": ((35, 28), (37.1, 29), (40, 30.6), (41.7, 30.5), (42.9, 27.9),
                     (43.2, 26.4), (43.1, 25.9)),
}

VIEWPORTS = {390: (844, "low", True), 768: (1024, "balanced", True), 1440: (900, "detailed", False)}


def pose(page):
    return page.evaluate("""() => {
        const {x,y,z,zone,seated,seatId,seatPhase,facing,yaw,capsuleEnabled,character}=__mall.state;
        return {x,y,z,zone,seated,seatId,seatPhase,facing,yaw,capsuleEnabled,weight:character.seatWeight};
    }""")


def exercise(page, seat_id, touch, out=None):
    store = {"lg-studio-sofa": "14", "casio-keyboard-bench": "15"}.get(seat_id, seat_id[1:3])
    zone = f"planned-space-{store}"
    route = ROUTES[seat_id]
    assert_teleport(page, zone)
    arrival = pose(page)
    matches = page.evaluate("id => __mall.state.seats.filter(seat => seat.id === id)", seat_id)
    assert len(matches) == 1, (seat_id, matches)
    seat = matches[0]
    for x, z in route:
        walk(page, x, z, speed=1.8)
    front = (seat["exitX"], seat["exitZ"])
    walk(page, *front, speed=1.7)
    before = pose(page)
    assert before["zone"] == zone and before["capsuleEnabled"], before
    assert abs(before["y"] - seat["bounds"]["min"]["y"]) < .015, (before, seat)
    face(page, seat["x"], seat["z"])
    selected(page, seat_id, "Sit")
    activate(page, touch)
    page.wait_for_function("id => __mall.state.seatId === id && __mall.state.seatPhase === 'seated'",
                           arg=seat_id, timeout=7000)
    seated = pose(page)
    assert seated["seated"] and not seated["capsuleEnabled"] and seated["weight"] == 1, seated
    assert math.dist((seated["x"], seated["z"]), (seat["x"], seat["z"])) < .1, (seated, seat)
    if seat_id == "casio-keyboard-bench":
        assert abs(math.remainder(seated["facing"] + math.pi / 2, math.tau)) < .02, seated
    # These fixtures obscure the seated visitor in a straight-on view.
    offsets = {"S08-leftmid": -60, "S13-backleft": 75, "S15-backleft": -60, "casio-keyboard-bench": -60}
    camera_offset = math.radians(offsets.get(seat_id, 0))
    assert abs(math.remainder(seated["yaw"] - seated["facing"] - math.pi - camera_offset, math.tau)) < .03, seated
    if out:
        page.screenshot(path=out / f'{page.viewport_size["width"]}-{seat_id}-seated.png')

    if touch:
        assert page.locator("#inspect-verb").inner_text() == "Stand"
        activate(page, True)
    else:
        page.locator("#scene").focus()
        page.keyboard.press("Escape")
    page.wait_for_function("!__mall.state.seated && __mall.state.seatPhase === 'idle'", timeout=7000)
    stood = pose(page)
    assert stood["zone"] == zone and stood["seatId"] is None and stood["weight"] == 0, stood
    assert stood["capsuleEnabled"] and math.dist((stood["x"], stood["z"]), front) < .1, (stood, front)

    for x, z in reversed(route):
        walk(page, x, z, speed=1.8)
    if seat_id == "casio-keyboard-bench":
        keyboard = page.evaluate("""async () => (await __mall.testShopActions())
            .find(item => item.id === 'S15-leftfront')""")
        walk(page, keyboard["standing"]["x"], keyboard["standing"]["z"], speed=1.8)
        face(page, keyboard["x"], keyboard["z"])
        selected(page, keyboard["id"], keyboard["label"])
        activate(page, touch)
        page.wait_for_function("id => __mall.testShopState(id)?.phase === 'done'", arg=keyboard["id"])
        assert page.locator("#nearby-name").inner_text() == keyboard["done"]
        walk(page, *route[0], speed=1.8)
    page.wait_for_function("zone => __mall.state.doors[zone] > .9", arg=zone, timeout=7000)
    # The normal arrival point is inside the door sensor. Continue into the arcade.
    outside_x = arrival["x"] + math.copysign(1.2, arrival["x"] - route[0][0])
    walk(page, outside_x, arrival["z"], speed=1.8)
    page.wait_for_function("zone => __mall.state.doors[zone] < .1", arg=zone, timeout=7000)
    exited = pose(page)
    assert exited["zone"] == "atrium" and exited["seatId"] is None and exited["capsuleEnabled"], exited


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seat", nargs="+", choices=ROUTES, default=list(ROUTES))
    parser.add_argument("--width", nargs="+", type=int, choices=VIEWPORTS, default=(390, 1440))
    parser.add_argument("--out", type=Path, help="Save the default seated view for every route.")
    args = parser.parse_args()
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(QuietServer, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = probe_url(f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/")
        try:
            with sync_playwright() as playwright, launch(playwright) as browser:
                print(f"Chrome {browser.version}", flush=True)
                for width in args.width:
                    height, tier, touch = VIEWPORTS[width]
                    context = browser.new_context(viewport={"width": width, "height": height},
                                                  has_touch=touch, service_workers="block")
                    errors = []
                    context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
                    try:
                        page = enter(context, url, tier)
                        for seat_id in args.seat:
                            exercise(page, seat_id, touch, args.out)
                            assert not errors, errors
                            print(f"Passed {width} {tier} {seat_id}", flush=True)
                    finally:
                        context.close()
        finally:
            server.shutdown()


if __name__ == "__main__":
    run()
