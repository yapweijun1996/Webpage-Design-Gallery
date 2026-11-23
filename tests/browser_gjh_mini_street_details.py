"""Verify the enhanced street and its shelf texture fallback."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/mini-street/"
        with sync_playwright() as playwright:
            chrome = os.environ.get("GALLERY_CHROME")
            browser = playwright.chromium.launch(executable_path=chrome, channel=None if chrome else "chrome", headless=True,
                                                  args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            try:
                for mode in ("normal", "missing", "corrupt"):
                    context = browser.new_context(viewport={"width": 390, "height": 844},
                                                  reduced_motion="reduce", service_workers="block")
                    context.add_init_script("CanvasRenderingContext2D.prototype.roundRect = undefined;")
                    if mode != "normal":
                        def respond(route):
                            if mode == "missing":
                                route.fulfill(status=404, body="missing")
                            else:
                                route.fulfill(status=200, content_type="image/webp", body="not an image")
                        context.route("**/new-moon-label-atlas.webp", respond)
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(url, wait_until="domcontentloaded")
                    expect(page.locator("#stage")).to_have_attribute("data-webgl", "", timeout=30000)
                    page.evaluate("""async () => {
                      const THREE = await import('../v11/vendor/three.module.min.js');
                      const {buildWorld} = await import('./world.js');
                      const scene = new THREE.Scene();
                      window.__detailInvalidations = 0;
                      buildWorld(scene, () => window.__detailInvalidations++);
                      scene.traverse(node => {
                        if (node.material && node.material.name === 'New Moon shelf labels') {
                          window.__shelfLabelMaterial = node.material;
                        }
                      });
                    }""")
                    if mode == "normal":
                        page.wait_for_function("window.__shelfLabelMaterial?.map?.image && window.__detailInvalidations > 0", timeout=15000)
                    else:
                        page.wait_for_timeout(500)
                        assert page.evaluate("window.__shelfLabelMaterial && !window.__shelfLabelMaterial.map && window.__shelfLabelMaterial.color.getHex() !== 0"), mode
                    expect(page.locator("#scene-status")).to_contain_text("3D street ready")
                    assert not errors, (mode, errors)
                    context.close()
                    print(mode, "PASS: 3D remains available without roundRect and shelf material is visible")
            finally:
                browser.close()


if __name__ == "__main__":
    main()
