"""Exercise an occupied Casio grand across a real 404 and a missing bench mesh."""
import functools
import http.server
import math
import threading

from playwright.sync_api import sync_playwright

from browser_gjh_showroom_seats import ROOT, ROUTES, QuietServer, activate, assert_teleport, enter, face, launch, pose, probe_url, selected, walk
from gjh_menu_test_helpers import close_menu, open_menu_page
from gjh_startup_test_helpers import wait_for_quality

BENCH = "casio-grand-piano-bench"
KEYBOARD = "casio-keyboard-bench"
ZONE = "planned-space-15"


def exercise_missing_bench(context, url, observe=None):
    file = ROOT / "demos/corporate/gjh/v11/assets/interiors/s15-grand-piano-balanced.glb"
    raw = file.read_bytes()
    # Node zero is the authored Bench. Remove it from the root's child list
    # while preserving the declared GLB length and all real piano geometry.
    assert raw.count(b'"children":[0,1,2,3]') == 1
    missing = raw.replace(b'"children":[0,1,2,3]', b'"children":[  1,2,3]')
    responses = []

    def respond(route):
        if not responses:
            responses.append(404)
            route.fulfill(status=404, body="Piano unavailable")
        else:
            responses.append(200)
            route.fulfill(status=200, content_type="model/gltf-binary", body=missing)

    context.route("**/" + file.name, respond)
    page = enter(context, url, "low")
    assert_teleport(page, ZONE)
    for x, z in ROUTES[BENCH]:
        walk(page, x, z, speed=1.8)
    seat = page.evaluate("id => __mall.state.seats.find(s => s.id === id)", BENCH)
    walk(page, seat["exitX"], seat["exitZ"], speed=1.7)
    face(page, seat["x"], seat["z"])
    selected(page, BENCH, "Sit")
    activate(page, True)
    page.wait_for_function("id => __mall.state.seatId === id && __mall.state.seatPhase === 'seated'", arg=BENCH)
    if observe:
        observe(page, "before")

    open_menu_page(page, "graphics")
    with page.expect_response(lambda response: response.url.endswith("/" + file.name), timeout=90000) as first:
        page.locator("#graphics-quality").select_option("balanced")
    assert first.value.status == 404
    pending = pose(page)
    assert pending["seatId"] == BENCH and pending["weight"] == 1 and not pending["capsuleEnabled"], pending
    if observe:
        observe(page, "pending")

    wait_for_quality(page, "balanced")
    close_menu(page)
    page.wait_for_function("id => __mall.state.seats.every(s => s.id !== id) && __mall.state.seatPhase === 'idle'", arg=BENCH)
    assert 200 in responses
    after = pose(page)
    assert after["capsuleEnabled"] and after["weight"] == 0 and after["zone"] == ZONE, after
    assert math.dist((after["x"], after["z"]), (seat["exitX"], seat["exitZ"])) < .12, after
    assert page.evaluate("id => __mall.state.seats.filter(s => s.id === id).length", KEYBOARD) == 1
    if observe:
        observe(page, "absent")

    open_menu_page(page, "graphics")
    page.locator("#graphics-quality").select_option("low")
    wait_for_quality(page, "low")
    close_menu(page)
    page.wait_for_function("id => __mall.state.seats.filter(s => s.id === id).length === 1", arg=BENCH)
    face(page, seat["x"], seat["z"])
    selected(page, BENCH, "Sit")
    if observe:
        observe(page, "restored")
    return responses


def run():
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietServer, directory=ROOT)) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = probe_url(f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/")
        try:
            with sync_playwright() as playwright, launch(playwright) as browser:
                context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, service_workers="block")
                errors = []
                context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
                try:
                    responses = exercise_missing_bench(context, url)
                    assert not errors, errors
                    print(f"Chrome {browser.version} passed occupied Low to missing Balanced to restored Low, HTTP {responses}")
                finally:
                    context.close()
        finally:
            server.shutdown()


if __name__ == "__main__":
    run()
