"""Check Casio's storefront bench, neighboring seats and real asset failures."""

import argparse
import functools
import http.server
import json
from pathlib import Path
import struct
import threading

from playwright.sync_api import sync_playwright

from browser_gjh_showroom_seats import (
    ROOT, STOREFRONT_BENCH, VIEWPORTS, QuietServer, assert_teleport, enter,
    exercise, face, launch, pose, probe_url, walk,
)
from gjh_menu_test_helpers import close_menu, open_menu_page
from gjh_startup_test_helpers import wait_for_quality

STORE = "planned-space-15"
FILE = "gallery-assets/grand-piano.glb"
MODEL = "S15 gallery: " + FILE
NEIGHBORS = ("casio-grand-piano-bench", "casio-keyboard-bench", "S15-backleft")


def storefront_status(page):
    return page.evaluate("""model => ({
      seats: __mall.state.seats.filter(seat => ["casio-storefront-piano-bench", "casio-grand-piano-bench",
        "casio-keyboard-bench", "S15-backleft"].includes(seat.id)).map(seat => seat.id),
      asset: __mall.state.modelPreload.models["./gallery-assets/grand-piano.glb"],
      models: __mall.testSceneNames("^" + model + "$").map(({n,vis}) => ({n,vis}))
    })""", MODEL)


def switch_while_seated(page, out, width):
    before = pose(page)
    open_menu_page(page, "graphics")
    page.locator("#graphics-quality").select_option("low")
    wait_for_quality(page, "low")
    close_menu(page)
    after = pose(page)
    assert before["seatId"] == after["seatId"] == STOREFRONT_BENCH
    assert after["seatPhase"] == "seated" and after["weight"] == 1 and not after["capsuleEnabled"], after
    state = storefront_status(page)
    assert state["seats"].count(STOREFRONT_BENCH) == 1 and state["models"] == [{"n":MODEL,"vis":True}], state
    page.screenshot(path=out / f"{width}-storefront-switched-low.png")
    return after


def grand_without_bench():
    """Keep the actual piano and remove triangles of its separate bench."""
    filename = ROOT / "demos/corporate/gjh/v11/assets" / FILE
    glb = bytearray(filename.read_bytes())
    (length,) = struct.unpack_from("<I", glb, 12)
    doc = json.loads(glb[20:20 + length])
    start = 28 + length
    node = next(node for node in doc["nodes"] if node["name"] == "MESH_Black_lacquer")
    primitive, = doc["meshes"][node["mesh"]]["primitives"]

    def array_offset(accessor):
        view = doc["bufferViews"][accessor["bufferView"]]
        return start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0), view

    pos = doc["accessors"][primitive["attributes"]["POSITION"]]
    pos_start, pos_view = array_offset(pos)
    assert pos["componentType"] == 5126 and pos["type"] == "VEC3"
    stride = pos_view.get("byteStride", 12)
    indices = doc["accessors"][primitive["indices"]]
    index_start, _ = array_offset(indices)
    index_type = {5123:"H", 5125:"I"}[indices["componentType"]]
    index_stride = struct.calcsize("<" + index_type)
    triangle = "<" + index_type * 3
    def depth(index):
        return struct.unpack_from("<f", glb, pos_start + index * stride + 8)[0] + node["translation"][2]
    instrument_vertex = next(index for index in range(pos["count"]) if depth(index) < .7)

    changed = 0
    for i in range(0, indices["count"], 3):
        offset = index_start + i * index_stride
        ids = struct.unpack_from(triangle, glb, offset)
        if all(depth(index) > .7 for index in ids):
            struct.pack_into(triangle, glb, offset, *(instrument_vertex,) * 3)
            changed += 1
    assert changed
    return bytes(glb)


def missing_fixture(context, url, width, tier, touch, out):
    sent = []
    status = 404 if touch else 200
    body = b"Storefront grand unavailable" if touch else grand_without_bench()

    def send(route):
        sent.append(status)
        route.fulfill(status=status, content_type="model/gltf-binary", body=body)

    context.route("**/" + FILE, send)
    page = enter(context, url, tier)
    assert sent and set(sent) == {status}, sent
    assert_teleport(page, STORE)
    for x,z in ((35.9, 28), (36.7, 27.5), (36.65, 26.98)):
        walk(page, x, z, speed=1.8)
    face(page, 36.62922, 25.90143)
    state = storefront_status(page)
    assert set(state["seats"]) == set(NEIGHBORS), state
    assert state["asset"] == ("fallback" if touch else "loaded"), state
    assert state["models"] == ([] if touch else [{"n":MODEL,"vis":True}]), state
    assert page.evaluate("() => __mall.state.nearby") != STOREFRONT_BENCH
    assert pose(page)["capsuleEnabled"], pose(page)
    page.screenshot(path=out / f"{width}-storefront-absent.png")
    for x,z in ((36.7, 27.5), (35.9, 28), (31.4, 28)):
        walk(page, x, z, speed=1.8)
    page.wait_for_function("() => __mall.state.doors['planned-space-15'] < .1")
    assert pose(page)["zone"] == "atrium"
    return {"response":status, "observed":state, "exit":pose(page)}


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--width", type=int, choices=(390,1440))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietServer, directory=ROOT)) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        origin = f"http://127.0.0.1:{server.server_port}"
        url = probe_url(origin + "/demos/corporate/gjh/v11/")
        try:
            with sync_playwright() as playwright, launch(playwright) as browser:
                for width in ([args.width] if args.width else [390,1440]):
                    height,tier,touch = VIEWPORTS[width]
                    result = {"browser":browser.version, "viewport":[width,height], "tier":tier}
                    print(f"Starting {width} {tier}", flush=True)
                    for available in (True,False):
                        with browser.new_context(viewport={"width":width,"height":height}, has_touch=touch,
                                                 service_workers="block") as context:
                            errors = []
                            context.route("http*://**/*", lambda route: route.continue_()
                                          if route.request.url.startswith(origin + "/") else route.abort())
                            context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
                            if available:
                                page = enter(context, url, tier)
                                tier_state = {}
                                def checked_switch(page):
                                    tier_state.update(switch_while_seated(page, args.out, width))
                                result["neighbors"] = {}
                                for seat_id in NEIGHBORS:
                                    result["neighbors"][seat_id] = exercise(page, seat_id, touch, args.out)
                                print(f"Passed {width} neighboring seats", flush=True)
                                result["storefront"] = exercise(page, STOREFRONT_BENCH, touch, args.out,
                                                                 None if touch else checked_switch)
                                result["switchedWhileSeated"] = tier_state
                                (args.out / f"{width}-available.json").write_text(json.dumps(result,indent=2) + "\n")
                                print(f"Passed {width} storefront seat", flush=True)
                            else:
                                result["missing"] = missing_fixture(context,url,width,tier,touch,args.out)
                                print(f"Passed {width} unavailable or missing bench", flush=True)
                            assert not errors, errors
                    (args.out / f"{width}-result.json").write_text(json.dumps(result,indent=2) + "\n")
        finally:
            server.shutdown()


if __name__ == "__main__":
    run()
