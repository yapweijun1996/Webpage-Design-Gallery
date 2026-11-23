"""Exercise the GJH V11 stylesheet update and recovery in a persistent WebKit profile."""
import argparse
import hashlib
import http.server
import json
import platform
import subprocess
import tempfile
import threading
from importlib.metadata import version
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

from browser_pwa import Handler, alternate_release, gallery


class FreshHttpHandler(Handler):
    # Browsers must reach the service worker or the selected release for each request.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


ACTIVE_BUILD = """() => {
    return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => {
            channel.port1.close();
            reject(new Error('The controlling worker did not identify its build'));
        }, 5000);
        channel.port1.onmessage = event => {
            clearTimeout(timer);
            channel.port1.close();
            resolve(event.data.build);
        };
        navigator.serviceWorker.controller.postMessage({type: 'GET_VERSION'}, [channel.port2]);
    });
}"""

CACHED_STYLESHEET = """async ([key, url]) => {
    const response = await (await caches.open(key)).match(url);
    if (!response) return null;
    const data = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    return {type: response.headers.get('content-type'),
            sha256: Array.from(new Uint8Array(data), v => v.toString(16).padStart(2, '0')).join('')};
}"""

STYLED = "getComputedStyle(document.querySelector('#app-loader')).position === 'fixed'"
BAG = "sessionStorage.getItem('gjh-v11-demo-bag-v1')"
MALL_PATH = "/Webpage-Design-Gallery/demos/corporate/gjh/v11/"
VIEWPORT = {"width": 390, "height": 844}


def check(context, server, next_directory, old, new, css_hash, evidence):
    page = context.new_page()
    recovery = page.locator("#mall-recovery")
    check_button = page.locator("#mall-check-update")
    notice = page.locator("#mall-update-notice")
    bag_count = page.locator("#bag-open .hud-bag-count")
    errors, failed, navigations = [], [], []
    phase = "install"
    page.on("pageerror", lambda error: errors.append({"phase": phase, "message": str(error)}))
    page.on("requestfailed", lambda req: failed.append({"phase": phase, "path": urlsplit(req.url).path}))
    url = f"http://127.0.0.1:{server.server_port}{MALL_PATH}"
    page.goto(url + "#store-list", wait_until="domcontentloaded")
    controlled = "navigator.serviceWorker.controller?.scriptURL === new URL('pwa-sw.js', location.href).href"
    page.wait_for_function(controlled, timeout=70000)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function(controlled)
    assert page.evaluate(ACTIVE_BUILD) == old["build"]
    # Wait for the initial version check on A before switching the fixture to B.
    current = page.locator('[data-mall-check-status]')
    expect(current).to_have_text("Up to date.", timeout=80000)
    expect(notice).to_be_hidden()
    page.locator(".product-card [data-add]").first.click()
    saved = page.evaluate(BAG)
    assert sum(json.loads(saved).values()) == 1

    phase = "explicit update"
    server.release_directory = next_directory
    page.locator(".mall-app-settings > summary").click()
    check_button.click()
    expect(notice).to_be_visible(timeout=45000)
    expect(page.locator("#mall-apply-update")).to_contain_text("Update now")
    assert page.evaluate(ACTIVE_BUILD) == old["build"]

    def record_navigation(request):
        if request.is_navigation_request() and request.frame == page.main_frame:
            navigations.append(urlsplit(request.url).path)

    page.on("request", record_navigation)
    with page.expect_navigation(wait_until="domcontentloaded", timeout=35000):
        page.locator("#mall-apply-update").click()
    page.wait_for_function(controlled)
    assert page.evaluate(ACTIVE_BUILD) == new["build"]
    expect(current).to_have_text("Up to date.", timeout=80000)
    page.remove_listener("request", record_navigation)
    assert navigations == [MALL_PATH], navigations
    assert page.evaluate(BAG) == saved
    expect(bag_count).to_have_text("1")
    page.wait_for_function(STYLED)
    expect(recovery).to_be_hidden()
    css_path = "demos/corporate/gjh/v11/style.bundle.css"
    css_url = url + "style.bundle.css"
    cache = f"gjh-v11:{MALL_PATH}:offline:{new['build']}"
    stored = page.evaluate(CACHED_STYLESHEET, [cache, css_url])
    assert stored and stored["sha256"] == css_hash and stored["type"].split(";")[0] == "text/css", stored

    phase = "cached fallback"
    server.mixed_files = {css_path: b"<html>Stylesheet temporarily unavailable</html>"}
    page.reload(wait_until="load")
    page.wait_for_function(STYLED)
    expect(recovery).to_be_hidden()
    phase = "missing stylesheet"
    assert page.evaluate("async ([name, url]) => (await caches.open(name)).delete(url)", [cache, css_url])
    page.reload(wait_until="load")
    expect(recovery).to_be_visible(timeout=25000)
    assert not page.evaluate(STYLED)
    message = recovery.inner_text()
    assert "Page did not load fully" in message
    if evidence:
        page.screenshot(path=evidence / "recovery.png", scale="css")

    phase = "restored network"
    server.mixed_files = {}
    with page.expect_navigation(wait_until="load", timeout=30000):
        recovery.get_by_role("button", name="Reload").click()
    page.wait_for_function(STYLED)
    expect(recovery).to_be_hidden()
    assert page.evaluate(BAG) == saved
    expect(bag_count).to_have_text("1")
    assert failed and all(item == {"phase": "missing stylesheet", "path": MALL_PATH + "style.bundle.css"}
                          for item in failed), failed
    resource_errors = {"Response served by service worker is an error", "Cannot load ."}
    assert all(item["phase"] == "missing stylesheet" and item["message"] in resource_errors
               for item in errors), errors
    return {
        "runtime": f"Playwright {version('playwright')} WebKit {context.browser.version} on {platform.system()}",
        "viewport": VIEWPORT, "baselineRelease": old, "syntheticRelease": new,
        "updateReloads": len(navigations), "cachedStylesheet": stored,
        "retainedItems": sum(json.loads(saved).values()), "cachedFallbackStyled": True,
        "recoveryMessage": message, "restoredStyleAndBag": True, "pageErrors": errors, "failedRequests": failed,
    }


def run(evidence=None):
    if evidence:
        evidence.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="gjh-webkit-update-") as folder:
        root = Path(folder)
        a = root / "a/Webpage-Design-Gallery"
        b = root / "b/Webpage-Design-Gallery"
        gallery.build(a)
        old = json.loads((a / "version.json").read_text())
        major, minor, patch = old["version"].split(".")
        new = {"version": f"{major}.{minor}.{int(patch) + 1}", "build": "c" * 16}
        assert old["build"] != new["build"]
        alternate_release(a, b, gallery.load_catalog(), new)
        css_hash = hashlib.sha256((b / "demos/corporate/gjh/v11/style.bundle.css").read_bytes()).hexdigest()
        with http.server.ThreadingHTTPServer(("127.0.0.1", 0), FreshHttpHandler) as server:
            server.release_directory = a.parent
            server.mixed_files = {}
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                with sync_playwright() as playwright:
                    with playwright.webkit.launch_persistent_context(
                        str(root / "profile"), viewport=VIEWPORT,
                        has_touch=True, headless=True, reduced_motion="reduce", service_workers="allow",
                    ) as context:
                        result = check(context, server, b.parent, old, new, css_hash, evidence)
            finally:
                server.shutdown()
    if evidence:
        # The release identities identify the served bytes; HEAD identifies the source checkout.
        result["sourceHead"] = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=gallery.ROOT, text=True
        ).strip()
        (evidence / "receipt.json").write_text(json.dumps(result, indent=2) + "\n")
    print("WebKit verified one update reload, stylesheet fallback, recovery and Bag retention.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path)
    run(parser.parse_args().evidence)
