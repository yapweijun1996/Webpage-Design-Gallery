"""Measure the expanded mall's physical escalator, the adjoining deck, and the lift return."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import hashlib
from pathlib import Path
import sys
import threading
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "docs"))
from browser_gjh_newmoon_pickup_bag import BROWSE_Z, empty_hands, pickup, visit_store
from browser_gjh_mili_catalogue import language
from mall_browser_probe import enter, launch
from verify_mall_support import face, paint, probe_url, walk


SCREENS = {390: (844, "low"), 768: (1024, "balanced"), 1440: (900, "detailed")}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def state(page):
    return page.evaluate("""() => {const s=__mall.state;
      const rect=document.getElementById("scene").getBoundingClientRect();
      return {x:s.x,y:s.y,z:s.z,zone:s.zone,canvas:[rect.x,rect.y,rect.width,rect.height],
      riding:!!s.escalatorTravel,nearby:s.nearby,seated:s.seated,camera:s.cameraObstruction,viewCamera:s.camera,
      draws:s.drawCalls,triangles:s.renderTriangles,mode:s.mode,quality:s.graphics.quality.tier,
      held:s.character.physicalProduct?.held ? s.character.physicalProduct.id : null,cart:s.pushing};}""")


def activate(page, selector, touch):
    control = page.locator(selector)
    if touch:
        control.tap()
    else:
        control.focus()
        page.keyboard.press("Enter")


def select_nearby(page, target, touch):
    for _ in range(15):
        if state(page)["nearby"] == target:
            return
        activate(page, 'button[aria-label="Select next nearby action"]', touch)
    raise AssertionError(f"Could not reach {target}: {state(page)}")


def check_map_marker(page, width, out):
    touch = width < 1000
    copy = {"en": "E Upper deck escalator", "zh-Hans": "E 前往上层的扶梯", "ms": "E Eskalator ke aras atas"}
    observed = {}
    for code, label in copy.items():
        if code != "en":
            language(page, code, touch)
        activate(page, "#header-map", touch)
        expect(page.locator("#mall-map")).to_have_attribute("open", "")
        marker = page.locator('[data-map-service="upper-escalator"] text')
        expect(marker).to_be_visible()
        expect(marker).to_have_text("E")
        legend = page.locator("#map-services-legend")
        expect(legend).to_contain_text(label)
        observed[code] = {"marker": marker.text_content(), "legend": legend.inner_text()}
        if code == "en":
            page.screenshot(path=str(out / f"{width}-map.png"))
        if page.locator("#map-close").is_visible():
            activate(page, "#map-close", touch)
        else:
            page.keyboard.press("Escape")
        page.wait_for_function("!document.querySelector('#mall-map').open")
    language(page, "en", touch)
    return observed


def check_wayfinding(page, phase, width, out):
    context = page.locator("#hud-context")
    map_label = page.locator(".mini-map-context")
    if phase in ("before", "after"):
        expect(context).to_be_visible()
        expect(context).to_have_attribute("data-context", "nearby")
        expect(map_label).to_have_text("Ground-floor plan · You are here")
    elif phase == "during":
        expect(context).to_be_hidden()
        expect(page.locator("#skip-lift-ride")).to_be_visible()
        expect(map_label).to_have_text("Ground-floor plan · Escalator in transit")
    else:
        expect(page.locator("#skip-lift-ride")).to_be_hidden()
        expect(map_label).to_have_text("Ground-floor plan · You are on Floor 02")
    receipt = {"contextVisible": context.is_visible(), "kind": context.get_attribute("data-context"),
               "hint": page.locator("#hud-context-text").text_content(), "map": map_label.text_content(),
               "skip": page.locator("#skip-lift-ride").is_visible(), "pose": state(page)}
    page.screenshot(path=str(out / f"{width}-hud-{phase}.png"))
    return receipt


def check_carries(page, touch, width, out):
    visit_store(page, touch)
    point = page.evaluate("""() => {const can=__mall.state.productAssets.cans['nz-425g'];
        return can.placements[can.reserveIndex];}""")
    walk(page, point["x"], BROWSE_Z)
    face(page, point["x"], point["z"])
    pickup(page, "new-moon-nz-425g-front", touch)
    for x,z in ((-10,-6.5),(-10,-2.65),(-10,3.0),(-10,5),(19.4,5),(19.4,9)):
        walk(page,x,z)
    def attempt():
        page.evaluate("""() => {__mall.setInput({forward:1,yaw:Math.PI/2});__mall.step(2000);__mall.setInput(null);}""")
        assert not state(page)["riding"] and state(page)["x"] >= 18.33 and state(page)["y"] < .15
    attempt()
    assert page.evaluate("__mall.state.character.physicalProduct.held")
    # The held bar owns compact touch actions while an SKU is carried.
    expect(page.locator("#held-product-status")).to_contain_text("New Zealand Abalone 425g")
    expect(page.locator("#held-product-add")).to_be_visible()
    held = state(page)
    page.screenshot(path=str(out / f"{width}-held.png"))
    print(width, "held SKU stopped at", held["x"], flush=True)
    activate(page, "#held-product-add", touch)
    empty_hands(page)
    walk(page, 20, 9)
    walk(page, 20, 4.7)
    activate(page, "#bag-open", touch)
    activate(page, "#cart-toggle", touch)
    page.wait_for_function("__mall.state.pushing")
    if page.locator("#bag-dialog").is_visible():
        activate(page, "#bag-close", touch)
    # The cart has its own wide capsule. Drive along the aisle, allowing its
    # normal lateral clearance from the restroom wall at X=21.
    reached = page.evaluate("""() => {
      for (let i=0;i<240;i++) {
        const error=9-__mall.state.z;
        if (Math.abs(error)<.06) break;
        __mall.setInput({forward:Math.sign(error),yaw:Math.PI});__mall.step(34);
      }
      __mall.setInput(null);return __mall.state.z;
    }""")
    assert abs(reached-9)<.10, state(page)
    attempt()
    assert page.evaluate("__mall.state.pushing")
    select_nearby(page, "atrium-escalator", touch)
    expect(page.locator("#nearby-name")).to_have_text("Stow the cart before boarding.")
    activate(page, "#inspect", touch)
    expect(page.locator("#mall-status")).to_have_text("Stow the cart before boarding.")
    cart = state(page)
    page.screenshot(path=str(out / f"{width}-cart.png"))
    print(width, "cart stopped at", cart["x"], flush=True)
    activate(page, "#bag-open", touch)
    activate(page, "#cart-toggle", touch)
    page.wait_for_function("!__mall.state.pushing")
    if page.locator("#bag-dialog").is_visible():
        activate(page, "#bag-close", touch)
    return {"held": held, "cart": cart}


def exercise(page, candidate, width, out, requests, scope):
    touch = width < 1000
    views = {}
    controls = []
    guidance = {}
    def record(label, image=False):
        paint(page)
        views[label] = state(page)
        print(width,label,views[label]["draws"],flush=True)
        if candidate and label in ("lower","ascent","deck_down"):
            assert views[label]["camera"]["avatarVisible"], views[label]
        if image:
            page.screenshot(path=str(out / f"{width}-{label}.png"))
    def turn(label):
        sample = []
        for index in range(8):
            sample.append(page.evaluate("""yaw=>{__mall.setInput({yaw,pitch:.12});const s=__mall.step(34);
              return s.drawCalls}""", index * 3.141592653589793 / 4))
        page.evaluate("__mall.setInput(null)")
        views[label] = sample

    record("entrance", True)
    turn("entrance-orbit")
    map_copy = check_map_marker(page, width, out) if candidate and scope=="full" else {}
    if scope == "entrance":
        assert max(views["entrance-orbit"]) <= 190
        return {"views": views, "controls": controls, "matchedRequests": sorted(requests)}
    walk(page, 10, 35)
    walk(page, 19.3, 31.5)
    walk(page, 19.3, 12)
    if scope == "hud":
        walk(page, 19.3, 5.1)
        guidance["before"] = check_wayfinding(page, "before", width, out)
    walk(page, 19.15, 9)
    face(page, 3, 9)
    record("lower", True)
    turn("lower-orbit")
    face(page, 3, 9)
    if candidate:
        select_nearby(page, "atrium-escalator", touch)
        expect(page.locator("#inspect")).to_have_accessible_name("Ride the escalator to the upper deck")
        if touch:
            activate(page, "#inspect", True)
        else:
            page.locator("#scene").focus()
            page.keyboard.down("w")
        try:
            page.wait_for_function("__mall.state.escalatorTravel", timeout=12000)
        finally:
            if not touch:
                page.keyboard.up("w")
        controls.append("touch Ride up" if touch else "keyboard walk-on")
        page.wait_for_function("__mall.state.y > 1.9 && __mall.state.y < 5.6")
        record("ascent", True)
        if scope == "hud":
            guidance["during"] = check_wayfinding(page, "during", width, out)
            assert not page.evaluate("__mall.teleport('atrium')")
            assert state(page)["riding"]
        activate(page, "#mall-tools", touch)
        page.locator("#keyboard-help").wait_for(state="visible")
        stopped = state(page)
        page.wait_for_timeout(420)
        now = state(page)
        assert all(abs(now[k]-stopped[k]) < .02 for k in ("x", "y", "z"))
        activate(page, "#menu-close", touch)
        page.wait_for_function("!__mall.state.escalatorTravel && __mall.state.zone==='upper'", timeout=45000)
        assert state(page)["x"] < 2.55
        controls.append("pause and standing ascent")
    else:
        walk(page, 11, 12)
        walk(page, -6.4, 12.7)
        walk(page, -6.4, 10)
        select_nearby(page, "visitor-elevator", touch)
        activate(page, "#inspect", touch)
        page.wait_for_function("__mall.state.zone==='upper' && !__mall.state.elevatorTravel")
        walk(page, -6.4, 7.4)
        walk(page, 1.32, 7.4)
    walk(page, 1.32, 9)
    face(page, 19, 9)
    record("deck_down", True)
    turn("deck-orbit")
    if scope == "views":
        assert max(views["deck-orbit"]) <= 190
        return {"views": views, "controls": controls, "matchedRequests": sorted(requests)}
    if scope == "hud":
        guidance["deck"] = check_wayfinding(page, "deck", width, out)
    for number, z in (() if scope == "hud" else ((1, 5.98), (2, 12))):
        walk(page, 1.32, z)
        seat_id = page.evaluate("n=>__mall.testUpperPoints().find(p=>p.name==='Upper deck bench '+n)?.id", number)
        select_nearby(page, seat_id, touch)
        activate(page, "#inspect", touch)
        page.wait_for_function("__mall.state.seated && __mall.state.seatPhase==='seated'")
        activate(page, "#inspect", touch)
        page.wait_for_function("!__mall.state.seated")
    if scope != "hud":
        controls.append("both adjoining benches")
    walk(page, 1.32, 7.4)
    walk(page, -6.4, 7.4)
    walk(page, -6.4, 10)
    select_nearby(page, "visitor-elevator", touch)
    activate(page, "#inspect", touch)
    if page.evaluate("__mall.state.elevator?.calling"):
        page.wait_for_function("!__mall.state.elevator.calling")
        activate(page, "#inspect", touch)
    page.wait_for_function("__mall.state.y<.15 && !__mall.state.elevatorTravel")
    controls.append("step-free lift return")
    walk(page, -6.4, 12.7)
    walk(page, 10, 12)
    if scope == "hud":
        walk(page, 10, 5.1)
        walk(page, 19.3, 5.1)
        guidance["after"] = check_wayfinding(page, "after", width, out)
        return {"views": views, "controls": controls, "guidance": guidance,
                "matchedRequests": sorted(requests)}
    walk(page, 10, 6)
    controls.append("ground crossing beneath higher span")
    record("crossing")
    for x,z in ((19.4,5.2),(31.4,5.2),(31.4,12.5),(30.0,12.5)):
        walk(page,x,z)
    page.wait_for_function("__mall.state.doors['restroom-accessible']>.97")
    walk(page,28.4,12.5,speed=1.4)
    assert state(page)["zone"] == "restroom-accessible"
    record("restroom")
    for x,z in ((31.4,12.5),(31.4,5.2),(19.4,5.2)):
        walk(page,x,z)
    controls.append("accessible restroom threshold and return")
    matched_requests=sorted(requests)
    carry_boundaries = {}
    if candidate:
        carry_boundaries = check_carries(page, touch, width, out)
        controls.append("real held SKU and active cart refused at lower comb")
        walk(page, 19.4, 5.3)
        walk(page, 19.15, 9)
        face(page, 3, 9)
        page.emulate_media(reduced_motion="reduce")
        select_nearby(page, "atrium-escalator", touch)
        activate(page, "#inspect", touch)
        page.wait_for_function("__mall.state.zone==='upper' && !__mall.state.escalatorTravel",timeout=4000)
        controls.append("reduced-motion landing")
    for label, view in views.items():
        peak = max(view) if isinstance(view,list) else view["draws"]
        limit = 190 if label.startswith(("entrance","deck")) else 200
        assert peak <= limit, (label, peak, limit, views)
    store_budget = {}
    if candidate:
        # The public Map owns the supported 17 arrivals. A four-direction
        # sample here supplements the physical route with the other storefronts.
        stores = page.locator("#map-destination option").evaluate_all(r"""options => options
          .filter(option => /^\d{2} · /.test(option.textContent)).map(option => option.value)""")
        assert len(set(stores)) == 17, stores
        for store in stores:
            samples = page.evaluate("""store => {
              if (!__mall.teleport(store)) return [];
              const calls = [];
              for (let heading=0;heading<4;heading++) {
                __mall.setInput({yaw:heading*Math.PI/2,pitch:.12});calls.push(__mall.step(68).drawCalls);
              }
              __mall.setInput(null);return calls;
            }""", store)
            assert len(samples)==4 and max(samples)<=200, (store,samples)
            store_budget[store] = samples
    return {"views": views, "controls":controls, "requests": sorted(requests),
            "matchedRequests":matched_requests, "storeArrivalDraws":store_budget, "carryBoundaries": carry_boundaries,
            "mapCopy": map_copy}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-root", type=Path, default=ROOT)
    parser.add_argument("--baseline", action="store_true")
    parser.add_argument("--width", type=int, choices=SCREENS, nargs="+", default=list(SCREENS))
    parser.add_argument("--scope", choices=("full", "views", "entrance", "hud"), default="full",
                        help="Measure a full route, matching landing views, or the settled entrance only.")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(exist_ok=True, parents=True)
    with ThreadingHTTPServer(("127.0.0.1",0), partial(Quiet, directory=str(args.site_root))) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as pw, launch(pw) as browser:
                for width in args.width:
                    touch = width < 1000
                    height, tier = SCREENS[width]
                    with browser.new_context(viewport={"width":width,"height":height},
                                             has_touch=touch,service_workers="block") as context:
                        errors, requests, responses = [], set(), {}
                        code_files = {"script.bundle.js","player.bundle.js","world.bundle.js","elevator-v2.js",
                                      "escalator.js","lift-layout.js","mall-language.js","style.bundle.css"}
                        def track(response):
                            path = urlsplit(response.url).path
                            if response.ok and Path(path).name in code_files:
                                responses[path] = response
                        context.on("response", track)
                        context.on("page",lambda p:p.on("pageerror",lambda e:errors.append(str(e))))
                        context.on("request",lambda req:requests.add(urlsplit(req.url).path))
                        page = enter(context,probe_url(f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/"),
                                     tier)
                        try:
                            result = exercise(page,not args.baseline,width,args.out,requests,args.scope)
                            assert not errors, errors
                        except Exception:
                            print(state(page),errors,flush=True)
                            page.screenshot(path=str(args.out/f"{width}-failure.png"),timeout=8000)
                            raise
                        digests = {}
                        for path,response in responses.items():
                            digest = hashlib.sha256(response.body()).hexdigest()
                            assert digest == hashlib.sha256((args.site_root/path.lstrip("/")).read_bytes()).hexdigest(), path
                            digests[path] = digest
                        assert any(path.endswith("/script.bundle.js") for path in digests)
                        assert any(path.endswith("/elevator-v2.js") for path in digests)
                        result.update(chrome=browser.version,width=width,height=height,quality=tier,scope=args.scope,errors=errors,servedSHA256=digests)
                        (args.out/f"{width}.json").write_text(json.dumps(result,indent=2)+"\n")
                        print(width,result["controls"],flush=True)
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
