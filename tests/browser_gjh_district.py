"""Walk the south street gate with a real keyboard or touch joystick and capture browser evidence."""
import argparse
from contextlib import contextmanager
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import subprocess
import sys
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "docs"))
from mall_browser_probe import enter, launch
from verify_mall_support import probe_url

DEMO = "demos/corporate/gjh/v11/"
SIZES = {390: (844, "low"), 768: (1024, "balanced"), 1440: (900, "detailed")}
MODEL = "assets/districts/singapore/angsana-tree.glb"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


@contextmanager
def serve(root):
    handler = partial(QuietHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}/{DEMO}"
        finally:
            server.shutdown()
            thread.join()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def worker_ranges(context, page, root):
    page.wait_for_function("navigator.serviceWorker.controller?.scriptURL.endsWith('/v11/pwa-sw.js')")
    original = (root / DEMO / MODEL).read_bytes()
    fetch_bytes = """async ([url, range]) => {
      const response = await fetch(url, {cache: 'no-store', headers: range ? {Range: range} : {}});
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return {status: response.status, range: response.headers.get('Content-Range'), size: bytes.byteLength,
        magic: new TextDecoder().decode(bytes.slice(0, 4)),
        hash: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')};
    }"""
    complete = page.evaluate(fetch_bytes, [MODEL, None])
    assert complete["status"] == 200 and complete["hash"] == hashlib.sha256(original).hexdigest(), complete
    context.set_offline(True)
    try:
        partial_file = page.evaluate(fetch_bytes, [MODEL, "bytes=0-3"])
        invalid = page.evaluate(fetch_bytes, [MODEL, f"bytes={len(original)}-"])
        assert (partial_file["status"], partial_file["magic"], partial_file["range"]) == (
            206, "glTF", f"bytes 0-3/{len(original)}"
        ), partial_file
        assert (invalid["status"], invalid["size"], invalid["range"]) == (416, 0, f"bytes */{len(original)}"), invalid
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("document.title.startsWith('Connection needed')")
        return {"complete": complete, "offlinePartial": partial_file, "offlineUnsatisfiable": invalid,
                "offlineNavigation": page.title()}
    finally:
        context.set_offline(False)


class Visitor:
    def __init__(self, context, page, width):
        self.page = page
        self.touch = width < 1000
        self.cdp = context.new_cdp_session(page)

    def finger(self, event, point=None):
        self.cdp.send("Input.dispatchTouchEvent", {"type": event, "touchPoints": [] if point is None else
                     [{"x": point[0], "y": point[1], "id": 1}]})

    def face(self, target):
        page = self.page
        width, height = page.viewport_size["width"], page.viewport_size["height"]
        for _ in range(12):
            yaw = page.evaluate("__mall.state.yaw")
            delta = math.atan2(math.sin(target - yaw), math.cos(target - yaw))
            if abs(delta) < .01:
                return
            dx = max(-width * .27, min(width * .27, -delta / .005))
            x, y = width * .51 - dx / 2, height * .46
            if self.touch:
                self.finger("touchStart", (x, y))
                for step in (.25, .6, 1):
                    self.finger("touchMove", (x + dx * step, y))
                self.finger("touchEnd")
            else:
                page.mouse.move(x, y)
                page.mouse.down()
                page.mouse.move(x + dx, y, steps=4)
                page.mouse.up()
            page.wait_for_timeout(65)
        raise AssertionError(f"Camera did not reach yaw {target}")

    def walk(self, until, backward=False):
        page = self.page
        key = "s" if backward else "w"
        if self.touch:
            pad = page.locator("#joystick").bounding_box()
            x, y = pad["x"] + pad["width"] / 2, pad["y"] + pad["height"] / 2
            self.finger("touchStart", (x, y))
            self.finger("touchMove", (x, y + (1 if backward else -1) * pad["height"] * .44))
        else:
            page.keyboard.down(key)
        try:
            page.wait_for_function(until, polling=50, timeout=60000)
        finally:
            if self.touch:
                self.finger("touchEnd")
            else:
                page.keyboard.up(key)
        page.wait_for_timeout(220)


def visit(context, url, root, options, report):
    tier = SIZES[options.width][1]
    if options.worker_only:
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded")
        report["worker"] = worker_ranges(context, page, root)
        page.screenshot(path=str(options.evidence / "offline-navigation.png"))
        return
    page = enter(context, probe_url(url), tier, observe=True)
    visitor = Visitor(context, page, options.width)
    snapshots = report["views"] = {}

    def record(label):
        frame = page.evaluate("""() => {const s = __mall.state, diagnostic=__mall.performanceReport();
          return {x:s.x, y:s.y, z:s.z, zone:s.zone, frame:s.frames,
          studioPreload:{settled:s.modelPreload.settled,total:s.modelPreload.total},
          installedRooms:diagnostic.interiors.preinstalled.shops,
          capsule:s.capsuleEnabled, scene:s.graphics.sceneId, camera:s.graphics.cameraId, district:s.district,
          gpu:s.gpu, draws:s.renderBudget.totalCalls, doors:Object.keys(s.doors).length, seats:s.seats.length,
          arm:Math.hypot(s.x-s.camera.position[0], s.z-s.camera.position[2]), locale:document.documentElement.lang,
          bag:sessionStorage.getItem('gjh-v11-demo-bag-v1')};}""")
        assert frame["capsule"] and 0 < frame["draws"] <= 200, frame
        if label == "spawn" or label.endswith("restored"):
            assets = page.evaluate(r"""() => [...new Set(performance.getEntriesByType('resource')
              .map(item => new URL(item.name).pathname).filter(path => /\.(glb|webp|png|jpe?g|ktx2)$/i.test(path)))].sort()""")
            already_seen = set(report.get("observedAssets", []))
            frame["newlyObservedAssets"] = sorted(set(assets) - already_seen)
            report["observedAssets"] = sorted(already_seen | set(assets))
        snapshots[label] = frame
        page.screenshot(path=str(options.evidence / f"{label}.png"), scale="css")
        return frame

    initial = record("spawn")
    for cycle in range(1, options.cycles + 1):
        visitor.face(math.pi)
        if cycle > 1:
            visitor.walk("__mall.state.z > 44.7")
        page.wait_for_function("__mall.state.district.status === 'ready'", timeout=45000)
        visitor.walk("__mall.state.z > 50.4")
        threshold = record(f"{cycle}-threshold")
        visitor.walk("__mall.state.z > 65.2")
        outside = record(f"{cycle}-street")
        assert threshold["arm"] > 1.4 and outside["district"]["mall"]["studioModels"] == 0
        assert outside["district"]["mall"]["rooms"]["colliders"] == 0 and outside["district"]["street"]["colliders"] > 0
        for yaw, name in [(math.pi/2, "hdb"), (-math.pi/2, "shophouses")]:
            visitor.face(yaw)
            assert record(f"{cycle}-{name}")["arm"] > 1.4
        visitor.face(0)
        visitor.walk("__mall.state.z < 41.4")
        page.wait_for_function("""() => {const s=__mall.state;return s.district.status==='mall' &&
          s.district.mall.rooms.models===34 && s.modelPreload.settled===s.modelPreload.total &&
          __mall.performanceReport().interiors.preinstalled.shops===17}""", timeout=240000)
        restored = record(f"{cycle}-restored")
        assert restored["district"]["mall"] == initial["district"]["mall"] and restored["district"]["street"]["colliders"] == 0
        assert all(restored[k] == initial[k] for k in ["scene","camera","locale","bag","doors","seats"])
    report["worker"] = worker_ranges(context, page, root)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", required=True, type=Path, help="Directory for screenshots and receipt.json")
    parser.add_argument("--site-root", type=Path, default=ROOT, help="Optional locally built gallery to serve")
    parser.add_argument("--width", type=int, choices=SIZES, default=390)
    parser.add_argument("--cycles", type=int, choices=range(1, 4), default=1)
    parser.add_argument("--worker-only", action="store_true", help="Check warm 206 and 416 offline without starting WebGL")
    options = parser.parse_args()
    root = options.site_root.resolve()
    options.evidence.mkdir(parents=True, exist_ok=True)
    height, tier = SIZES[options.width]
    report = {"width": options.width, "height": height, "quality": tier,
              "build": json.loads((root / "version.json").read_text())["build"],
              "commit": subprocess.check_output(["git","rev-parse","HEAD"], cwd=root, text=True).strip()}
    try:
        with serve(root) as url, sync_playwright() as pw, launch(pw) as chrome:
            report["browser"] = chrome.version
            with chrome.new_context(viewport={"width":options.width,"height":height}, has_touch=options.width<1000,
                                    device_scale_factor=2 if options.width<1000 else 1) as context:
                context.add_init_script("""if (window===top && /^https?:$/.test(location.protocol) && !window.name) {
                  window.name='district-smoke';performance.setResourceTimingBufferSize(4000);sessionStorage.setItem('gjh-v11-demo-bag-v1','{"new-moon-nz-425g-front":2}');}""")
                visit(context, url, root, options, report)
        report["pass"] = True
    except Exception as error:
        report["error"] = str(error)
        raise
    finally:
        write_json(options.evidence / "receipt.json", report)


if __name__ == "__main__":
    main()
