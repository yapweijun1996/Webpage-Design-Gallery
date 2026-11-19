"""Shared entry, movement and evidence helpers for the headed GJH probes."""
import argparse
from contextlib import suppress
import io
import math
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from mall_browser_probe import URL, enter, launch


def probe_url(url, **flags):
    parts = urlsplit(url)
    params = dict(parse_qsl(parts.query, keep_blank_values=True))
    params.update(test="1", **flags)
    return urlunsplit(parts._replace(query=urlencode(params)))


def options(name, description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--url", default=URL)
    parser.add_argument("--tier", choices=("low", "balanced", "detailed"), default="balanced")
    parser.add_argument("--out", type=Path, default=Path("output") / name)
    return parser


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def run(args, scenario, **flags):
    from playwright.sync_api import sync_playwright

    args.out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright, launch(playwright) as browser:
        context = browser.new_context(viewport={"width": 1440, "height": 900},
                                      locale="en-SG", reduced_motion="no-preference",
                                      service_workers="block")
        page = enter(context, probe_url(args.url, **flags), args.tier)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            scenario(page, args)
            require(not errors, f"Uncaught page errors: {errors}")
        except Exception:
            with suppress(Exception):
                page.screenshot(path=str(args.out / "failure.png"), timeout=5000)
            raise


def walk(page, x, z, speed=2.5):
    pose = page.evaluate("""async ([x,z,speed]) => {
      const state = await __mall.testWalkTo(x,z,{speed});
      return {x:state.x,z:state.z,zone:state.zone};
    }""", [x, z, speed])
    require(math.hypot(pose["x"] - x, pose["z"] - z) <= .081,
            f"Missed ({x}, {z}): {pose}")
    return pose


def face(page, x, z):
    page.evaluate("async ([x,z]) => { await __mall.testFaceTo(x,z); }", [x, z])


def press(page, action):
    return page.evaluate("action => __mall.testPress(action)", action)


def paint(page):
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")


def capture(page, out, name):
    from PIL import Image, ImageStat

    paint(page)
    canvas = page.locator("#scene").bounding_box()
    path = out / f"{name}.png"
    image = page.screenshot(path=str(path))
    require(canvas is not None, f"Canvas hidden in {path}")
    x, y, width, height = (canvas[key] for key in ("x", "y", "width", "height"))
    # Sample the middle of the canvas away from the persistent HUD rails.
    area = Image.open(io.BytesIO(image)).convert("L").crop(
        tuple(map(round, (x + width * .25, y + height * .25, x + width * .75, y + height * .65)))
    )
    stats = ImageStat.Stat(area)
    require(stats.mean[0] > 12 or (stats.mean[0] > 3 and stats.stddev[0] > 2), f"Blank or uniform canvas in {path}")
    return path
