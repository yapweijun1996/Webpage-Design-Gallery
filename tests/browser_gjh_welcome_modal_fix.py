"""Bounded visual/DOM evidence for the V11 nonmodal welcome card layout."""
import argparse, functools, http.server, json, os, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/screenshots/v11-welcome-modal-fix"
VIEWPORTS = [(1440, 900, "desktop"), (390, 664, "mobile-390x664"),
             (320, 568, "mobile-320x568"), (844, 390, "landscape-844x390")]

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("before", "after"), default="before")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    rows = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get("GALLERY_CHROME", "/usr/bin/google-chrome"),
                                        args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            for width, height, label in VIEWPORTS:
                context = browser.new_context(viewport={"width": width, "height": height},
                                              has_touch=width <= 390, color_scheme="dark", reduced_motion="reduce")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/",
                          wait_until="domcontentloaded", timeout=60000)
                page.wait_for_function("window.__mall?.ready && window.__sceneReady", timeout=90000)
                if not page.locator("#guide-card").is_visible():
                    page.locator('#directory-enter-3d').click()
                if not page.locator("#guide-card").is_visible():
                    page.locator('#keyboard-help').evaluate('el=>el.open=true')
                    page.locator("#guide-reopen").click()
                dialog = page.locator("#guide-card")
                dialog.wait_for(state="visible")
                page.wait_for_timeout(300)
                data = page.locator('#guide-card').evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}}')
                assert data['x'] >= 0 and data['y'] >= 0 and data['bottom'] <= height, data
                assert page.locator('#guide-count').inner_text() == '1/3'
                page.screenshot(path=str(OUT / f"{args.phase}-{label}.png"))
                page.locator('#guide-skip').click()
                dialog.wait_for(state='hidden')
                page.locator('#rail-guide').click()
                dialog.wait_for(state='visible')
                page.locator('#guide-skip').click()
                dialog.wait_for(state='hidden')
                assert not errors, errors
                rows.append({"label": label, "phase": args.phase, "dom": data, "pageErrors": errors})
                context.close()
            browser.close()
    finally:
        server.shutdown()
    (OUT / f"{args.phase}-dom.json").write_text(json.dumps(rows, indent=2) + "\n")
    print(json.dumps(rows, indent=2))

if __name__ == "__main__":
    main()
