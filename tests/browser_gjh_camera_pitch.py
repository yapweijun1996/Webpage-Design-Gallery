"""Capture the third-person pitch limits in headed Chrome on the published scene."""
import functools
import http.server
import json
import math
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

from browser_gjh_amenities import ready
from browser_gjh_v11 import QuietHandler, drive, state, walk_to


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/playwright/gjh-camera-pitch"
URL = "http://127.0.0.1:8819/demos/corporate/gjh/v11/"


def drag_scene(page, touch, pitch):
    rect = page.locator("#scene").bounding_box()
    x = round(rect["x"] + rect["width"] * .44)
    top = round(rect["y"] + rect["height"] * .20)
    bottom = round(rect["y"] + rect["height"] * .81)
    start, end = (bottom, top) if pitch < 0 else (top, bottom)
    assert page.evaluate("([x,y]) => document.elementFromPoint(x,y)?.id", [x, start]) == "scene"
    points = [round(start + (end - start) * i / 16) for i in range(1, 17)]
    if touch:
        touch.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": start}]})
        for y in points:
            touch.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
        touch.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    else:
        page.mouse.move(x, start)
        page.mouse.down()
        for y in points:
            page.mouse.move(x, y)
        page.mouse.up()


def check_joystick(page, touch):
    pad = page.locator("#joystick").bounding_box()
    x, y = round(pad["x"] + pad["width"] / 2), round(pad["y"] + pad["height"] / 2)
    before = state(page)
    touch.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
    touch.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y - 22}]})
    try:
        assert page.locator("#joystick .joystick-thumb").evaluate("(thumb) => thumb.style.transform") != ""
        after = state(page)
        assert (after["pitch"], after["yaw"]) == (before["pitch"], before["yaw"])
    finally:
        touch.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def capture_limits(page, touch, width, height, zone):
    distance = state(page)["cameraDistance"]
    for label, angle in [("low", -30), ("high", 75)]:
        yaw = state(page)["yaw"]
        drag_scene(page, touch, angle)
        chased = drive(page, 1500)
        assert abs(math.degrees(chased["pitch"]) - angle) < .01, (zone, label, chased["pitch"])
        assert abs(chased["yaw"] - yaw) < 1e-6, (zone, label, chased["yaw"])
        assert chased["cameraDistance"] == distance, (zone, label, chased["cameraDistance"])
        floor = 7.2 if zone == "upper" else 0
        radius = chased["cameraObstruction"]["radius"]
        camera_y = chased["camera"]["position"][1]
        assert camera_y >= floor + radius, (zone, label, camera_y)
        if zone == "mili":
            assert camera_y < 5.69 - radius, (zone, label, camera_y)
        x, y, z, w = chased["camera"]["quaternion"]
        vertical = max(-1, min(1, 2 * (w * x - y * z)))
        look_pitch = -math.degrees(math.asin(vertical))
        assert (look_pitch < -10 if angle < 0 else look_pitch > 65), (zone, label, look_pitch)
        print(json.dumps({"viewport": [width, height], "zone": zone, "limit": label,
                          "pitch": angle, "lookPitch": look_pitch, "cameraY": camera_y}), flush=True)
        page.screenshot(path=str(OUT / f"{width}x{height}-{zone}-{label}.png"))
        if zone == "atrium" and angle < 0:
            moved = drive(page, 180, forward=1)
            assert math.hypot(moved["x"] - chased["x"], moved["z"] - chased["z"]) > .1
            assert moved["pitch"] == chased["pitch"]


def probe(browser, width, height):
    mobile = width < 600
    with browser.new_context(viewport={"width": width, "height": height}, has_touch=mobile,
                             is_mobile=mobile, device_scale_factor=1, service_workers="block") as context:
        page = context.new_page()
        touch = context.new_cdp_session(page) if mobile else None
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        ready(page, URL)
        if mobile:
            check_joystick(page, touch)
        else:
            page.keyboard.press("PageUp")
            assert state(page)["pitch"] < .1
            page.keyboard.press("PageDown")
            assert abs(state(page)["pitch"] - .1) < 1e-6
        assert page.evaluate('__mall.teleport("atrium")')
        capture_limits(page, touch, width, height, "atrium")

        assert page.evaluate('__mall.teleport("mili")')
        walk_to(page, 0, -2.7)
        assert state(page)["z"] < -2.5
        capture_limits(page, touch, width, height, "mili")

        assert page.evaluate('__mall.teleport("atrium")')
        for x, z in [(10, 5.5), (-6.4, 5.5), (-6.4, 10)]:
            walk_to(page, x, z)
        assert state(page)["nearby"] == "visitor-elevator"
        page.locator("#inspect").click()
        lifted = drive(page, 4000)
        assert abs(lifted["y"] - 7.2) < .1 and not lifted["elevatorTravel"]
        page.locator("#scene").focus()
        capture_limits(page, touch, width, height, "upper")
        assert not errors, errors


def run():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", 8819), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            OUT.mkdir(parents=True, exist_ok=True)
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=False, executable_path=os.environ["GALLERY_CHROME"],
                    args=["--use-angle=" + os.environ.get("GALLERY_WEBGL_BACKEND", "metal"), "--ignore-gpu-blocklist"],
                )
                for width, height in [(393, 700), (1440, 900)]:
                    probe(browser, width, height)
                browser.close()
        finally:
            server.shutdown()


if __name__ == "__main__":
    run()
