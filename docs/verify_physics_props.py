"""Exercise the physical can transfer and atrium props through player controls."""
import json
import math
import re

from mall_browser_probe import assert_teleport
from verify_interactions import PROGRAMME, await_actions, enter_shop
from verify_mall_support import capture, face, options, press, require, run, walk


def props(page):
    return page.evaluate("() => __mall.testProps()")


def horizontal_distance(a, b):
    return math.hypot(a["x"] - b["x"], a["z"] - b["z"])


def wait_held(page, sku):
    page.wait_for_function("""sku => {
      const {id,held} = __mall.state.character.physicalProduct;
      return held && id === sku;
    }""", arg=sku)


def nearby_prompt(page):
    return page.evaluate("""() => {
      const {nearby, interaction} = __mall.state;
      return {
        id: nearby,
        distance: interaction?.distance ?? null,
        context: document.querySelector('#hud-context-text').innerText,
        name: document.querySelector('#nearby-name').innerText,
        verb: document.querySelector('#inspect-verb').innerText,
        button: document.querySelector('#inspect').getAttribute('aria-label'),
      };
    }""")


def select_drawer(page, drawer):
    nearest = nearby_prompt(page)
    candidates = {}
    prompt = nearest
    while prompt["id"] and prompt["id"] not in candidates:
        candidates[prompt["id"]] = prompt
        if not press(page, "next"):
            break
        prompt = nearby_prompt(page)
    print(json.dumps({"nearest": nearest, "candidates": list(candidates.values())}), flush=True)
    require(drawer["id"] in candidates, "New Moon drawer unavailable")
    for _ in candidates:
        if prompt["id"] == drawer["id"]:
            return
        require(press(page, "next"), "Could not cycle to New Moon drawer")
        prompt = nearby_prompt(page)
    raise AssertionError(f"Lost New Moon drawer selection: {prompt}")


def push_prop(page, args, name, x):
    walk(page, x, 27.4)
    page.wait_for_function("name => __mall.testProps()[name]?.sleeping", arg=name)
    before = props(page)[name]
    require(horizontal_distance(before, {"x": x, "z": 26}) < .12, f"{name}: wrong spawn {before}")
    walk(page, x, 25.8, speed=1.5)
    after = props(page)
    require(horizontal_distance(before, after[name]) > .1, f"{name} stayed at {before}")
    face(page, after[name]["x"], after[name]["z"])
    capture(page, args.out, name)
    return {"before": before, "after": after[name],
            "activeBodies": after["activeBodies"], "bodyStepMs": after["bodyStepMs"]}


def verify(page, args):
    new_moon = json.loads(PROGRAMME.read_text(encoding="utf-8"))["stores"][0]
    enter_shop(page, new_moon, "newmoon")
    drawer = next(item for item in await_actions(page) if item["item"] == "S01-shelves2")
    sku = drawer["productId"]
    shelf = page.evaluate("id => __mall.state.shelves.find(shelf => shelf.id === id).pickup", sku)
    walk(page, drawer["standing"]["x"], drawer["standing"]["z"])
    select_drawer(page, drawer)
    require(press(page, "interact"), "Could not open the drawer")
    page.wait_for_function("id => __mall.testShopState(id)?.phase === 'done'", arg=drawer["id"])
    prompt = nearby_prompt(page)
    print(json.dumps({"drawerOpen": prompt}), flush=True)
    require(prompt["id"] == drawer["id"] and prompt["verb"] == "Pick up",
            f"Missing drawer pickup prompt: {prompt}")
    page.get_by_role("button", name=re.compile(r"^Pick up: ")).click()
    wait_held(page, sku)
    walk(page, shelf["x"], shelf["z"] + 1.25, speed=1.5)
    face(page, shelf["x"], shelf["z"] + 3)
    capture(page, args.out, "can-held")

    # Read immediately in the dispatch task, before the first falling tick.
    initial = page.evaluate("""() => {
      if (!__mall.testPress('drop')) throw Error('Drop unavailable');
      return __mall.testProps().can;
    }""")
    require(initial and initial["id"] == sku and not initial["sleeping"], f"Missing dynamic can: {initial}")
    falling = page.wait_for_function("""y => {
      const sample = __mall.testProps();
      return sample.can?.y < y - .12 && sample.activeBodies > 0 && sample.bodyStepMs > 0 && sample;
    }""", arg=initial["y"]).json_value()
    page.wait_for_function("() => __mall.testProps().can?.sleeping", timeout=12000)
    settled = props(page)
    can = settled["can"]
    require(abs(can["y"] - can["floor"]) < can["halfHeight"] + .06,
            f"Can settled above/below the shop floor: {can}")
    # The last sleeping tick can round down to zero on the browser timer.
    require(settled["activeBodies"] == 0 and settled["bodyStepMs"] >= 0, f"Invalid solver counters: {settled}")
    capture(page, args.out, "can-sleeping")

    page.wait_for_function("() => __mall.state.nearby === 'physics-floor-can'")
    require(page.locator("#inspect-verb").inner_text() == "Pick up", "Missing floor pickup prompt")
    require(press(page, "interact"), "Floor pickup failed")
    wait_held(page, sku)
    require(props(page)["can"] is None, "The floor body survived pickup")
    walk(page, shelf["x"], shelf["z"], speed=1.5)
    page.locator("#held-product-return").click()
    page.wait_for_function("() => __mall.state.character.physicalProduct.phase === 'empty'")
    require(not page.locator("#held-product-return").is_visible(), "Return HUD still active")
    capture(page, args.out, "can-returned")

    assert_teleport(page, "entry")
    walk(page, 10, 39)
    ball = push_prop(page, args, "ball", 11.4)
    basket = push_prop(page, args, "basket", 13)
    result = {"initialCan": initial, "falling": falling, "settled": settled, "ball": ball, "basket": basket,
              "interiors": page.evaluate("""() => {
                const {activeBodies, bodyStepMs} = __mall.performanceReport().interiors;
                return {activeBodies, bodyStepMs};
              }""")}
    (args.out / "physics.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run(options("verify-physics-props", __doc__).parse_args(), verify, npcs="off")
