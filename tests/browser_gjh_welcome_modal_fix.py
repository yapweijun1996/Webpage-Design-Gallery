"""Bounded visual/DOM evidence for the V11 welcome modal regression."""
import argparse, functools, http.server, json, os, threading, subprocess
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
                if args.phase == "before":
                    # The runtime now requests a generated stylesheet. Serve the
                    # historical sources in the same order for a real before view.
                    assets = ["assets/tokens.css", "assets/gjh-themes.css", "demos/corporate/gjh/v11/style.css",
                              "assets/onboarding/onboarding.tokens.css", "assets/onboarding/onboarding.css",
                              "demos/corporate/gjh/shared/interaction.css"]
                    parts = [subprocess.check_output(["git", "show", "2f70d69:" + asset], cwd=ROOT).decode() for asset in assets]
                    parts[4] = parts[4].replace("@import url('./onboarding.tokens.css');", "", 1)
                    original = "\n".join(parts)
                    page.route("**/style.bundle.css", lambda route: route.fulfill(body=original, content_type="text/css"))
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/",
                          wait_until="domcontentloaded", timeout=60000)
                page.wait_for_function("window.__mall?.ready && window.__sceneReady", timeout=90000)
                if not page.locator("#guide-dialog").is_visible():
                    page.locator('#directory-enter-3d').click()
                if not page.locator("#guide-dialog").is_visible():
                    page.locator('#keyboard-help').evaluate('el=>el.open=true')
                    page.locator("#guide-reopen").click()
                dialog = page.locator("#guide-dialog")
                dialog.wait_for(state="visible")
                page.wait_for_timeout(300)
                data = page.evaluate("""() => {
                  const rect = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom}; };
                  const d=document.querySelector('#guide-dialog'), c=d.querySelector('#guide-show-next');
                  const nav=document.querySelector('#context-navigation');
                  const style=getComputedStyle(d), cs=getComputedStyle(c.closest('label'));
                  return {viewport:[innerWidth,innerHeight], dialog:rect(d), dialogScroll:[d.scrollTop,d.scrollHeight,d.clientHeight],
                    checkbox:rect(c), preference:rect(c.closest('label')), start:rect(document.querySelector('#guide-start')),
                    close:rect(document.querySelector('#guide-close')), nav:nav?rect(nav):null, navParent:nav?.parentElement.id,
                    dialogBackground:style.backgroundColor, text:getComputedStyle(d).color, muted:getComputedStyle(d.querySelector('.ob-description')).color,
                    preferenceColor:cs.color, scrollPaddingBottom:style.scrollPaddingBottom, zIndex:style.zIndex,
                    checkboxReachable:c.getBoundingClientRect().bottom <= innerHeight && c.getClientRects().length > 0};
                }""")
                page.screenshot(path=str(OUT / f"{args.phase}-{label}.png"))
                page.screenshot(path=str(OUT / f"{args.phase}-{label}-full.png"), full_page=True)
                if args.phase == 'after':
                    assert data['nav']['top'] >= data['preference']['bottom'], data
                    assert data['dialog']['top'] >= 0 and data['dialog']['bottom'] <= height, data
                    checkbox = page.locator('#guide-show-next')
                    checkbox.scroll_into_view_if_needed()
                    checkbox.uncheck()
                    assert not checkbox.is_checked()
                    assert page.evaluate("""() => { const c=document.querySelector('#guide-show-next'), r=c.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===c; }""")
                    page.screenshot(path=str(OUT / f"after-{label}-scrolled.png"))
                    page.locator('#guide-close').click()
                    assert not dialog.is_visible()
                    page.locator('#keyboard-help').evaluate('el=>el.open=true')
                    page.locator('#guide-reopen').click()
                    assert dialog.is_visible() and not page.locator('#guide-show-next').is_checked()
                    page.locator('#guide-start').click()
                    assert not dialog.is_visible()
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
