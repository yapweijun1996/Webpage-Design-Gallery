"""Real service-worker lifecycle tests against two releases under a project prefix."""

import functools
import http.server
import importlib.util
import json
import os
import shutil
import tempfile
import threading
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def translate_path(self, path):
        self.directory = str(self.server.release_directory)
        return super().translate_path(path)

    def do_GET(self):
        # Releases are switched within one second; SimpleHTTPServer's mtime-only
        # conditional response would otherwise falsely return 304 for changed bytes.
        if "If-Modified-Since" in self.headers:
            del self.headers["If-Modified-Since"]
        path = urlsplit(self.path).path.removeprefix("/Webpage-Design-Gallery/")
        if path in self.server.mixed_files:
            content = self.server.mixed_files[path]
            self.send_response(200)
            self.send_header("Content-Type", "application/json" if path.endswith(".json") else "text/html")
            self.end_headers()
            self.wfile.write(content)
        else:
            super().do_GET()

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass


def alternate_release(source, target, catalog, release, activation_delay=False, ignore_activation=False):
    shutil.copytree(source, target)
    pages = gallery.build_pages(catalog, release)
    pages.update(gallery.pwa_outputs(pages, catalog, release))
    if activation_delay:
        pages["sw.js"] = pages["sw.js"].replace("self.addEventListener('activate', (event) => {", "self.addEventListener('activate', (event) => {\n  event.waitUntil(new Promise(resolve => setTimeout(resolve, 1200)));")
        pages["sw.js"] = pages["sw.js"].replace("event.ports[0]?.postMessage({ version: VERSION, build: BUILD })", "setTimeout(() => event.ports[0]?.postMessage({ version: VERSION, build: BUILD }), 1000)")
    if ignore_activation:
        pages["sw.js"] = pages["sw.js"].replace("event.waitUntil(self.skipWaiting())", "void 0")
    for name, text in pages.items():
        (target / name).write_text(text, encoding="utf-8", newline="\n")


def run():
    screenshots = ROOT / "docs/screenshots/pwa"
    screenshots.mkdir(parents=True, exist_ok=True)
    evidence = {"runtime": "Real headless Chrome service workers under /Webpage-Design-Gallery/", "checks": {}, "limitations": ["Physical iOS/Safari installation and status-bar rendering NOT RUN", "Native OS install dialog NOT RUN; browser manifest/installability inspected", "Light-only gallery; dark-mode system chrome N/A"]}
    with tempfile.TemporaryDirectory(prefix="gallery-pwa-") as temporary:
        folder = Path(temporary)
        a = folder / "a/Webpage-Design-Gallery"
        gallery.build(a)
        catalog = gallery.load_catalog()
        release_a = json.loads((a / "version.json").read_text(encoding="utf-8"))
        major, minor, patch = map(int, release_a["version"].split("."))
        release_b = {"version": f"{major}.{minor}.{patch + 1}", "build": "b" * 16}
        release_c = {"version": f"{major}.{minor}.{patch + 2}", "build": "c" * 16}
        b = folder / "b/Webpage-Design-Gallery"
        c = folder / "c/Webpage-Design-Gallery"
        alternate_release(a, b, catalog, release_b, activation_delay=True)
        alternate_release(a, c, catalog, release_c, ignore_activation=True)
        handler = functools.partial(Handler, directory=str(folder / "a"))
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        server.release_directory = folder / "a"
        server.mixed_files = {}
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/"
        try:
            with sync_playwright() as playwright:
                context = playwright.chromium.launch_persistent_context(user_data_dir=str(folder / "chrome-profile"), executable_path=os.environ.get("GALLERY_CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe"), headless=True, viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
                browser = context.browser
                page = context.new_page()
                online_errors = []
                page.on("pageerror", lambda error: online_errors.append(str(error)))
                viewport = "width=device-width, initial-scale=1, viewport-fit=cover"
                for path in ("index.html", "companies/gjh/index.html", "designs/index.html", "compare/index.html", "offline.html"):
                    page.goto(base + path, wait_until="networkidle")
                    assert page.locator('meta[name="viewport"]').get_attribute("content") == viewport, path
                page.goto(base + "companies/gjh/index.html?review=keep", wait_until="networkidle")
                page.wait_for_function("() => navigator.serviceWorker.ready.then(r => r.active?.state === 'activated')")
                page.reload(wait_until="networkidle")
                page.wait_for_function("() => navigator.serviceWorker.controller !== null")
                assert page.locator('meta[name="app-build"]').get_attribute("content") == release_a["build"]
                assert page.locator("#check-update").is_visible()
                await_status = "() => document.querySelector('#app-status').textContent.includes('Up to date')"
                page.wait_for_function(await_status)
                client = context.new_cdp_session(page)
                manifest = client.send("Page.getAppManifest")
                assert not manifest.get("errors"), manifest
                parsed = json.loads(manifest["data"])
                assert parsed["scope"] == "./" and parsed["display"] == "standalone"
                installability = client.send("Page.getInstallabilityErrors")
                evidence["installability"] = installability
                assert not installability.get("installabilityErrors"), installability
                evidence["checks"]["manifestAndChromeInstallability"] = "PASS"
                for width, height in [(1440, 1000), (768, 1024), (390, 844), (375, 812)]:
                    page.set_viewport_size({"width": width, "height": height})
                    page.evaluate("document.activeElement.blur(); scrollTo(0, 0)")
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
                    assert page.locator("#check-update").bounding_box()["height"] >= 44
                    assert page.locator('meta[name="viewport"]').get_attribute("content") == viewport
                    assert page.evaluate("""() => {
                        const event = new Event('gesturestart', {cancelable: true});
                        document.dispatchEvent(event);
                        return !event.defaultPrevented;
                    }"""), "Gallery must not suppress browser zoom gestures"
                    assert page.locator('meta[name="theme-color"]').get_attribute("content") == "#ffffff"
                    assert page.locator(".app-chrome").evaluate("e => getComputedStyle(e).transitionDuration") == "0s"
                    page.screenshot(path=str(screenshots / f"company-{width}.png"), full_page=True)
                    page.evaluate("scrollTo(0, innerHeight + 200)")
                    page.wait_for_function("() => document.querySelector('.app-chrome').classList.contains('is-hidden')")
                    assert page.locator("#scroll-top").is_visible()
                    page.evaluate("scrollBy(0, -100)")
                    page.wait_for_function("() => !document.querySelector('.app-chrome').classList.contains('is-hidden')")
                    page.get_by_role("button", name="Back to top").click()
                    page.wait_for_function("() => scrollY === 0")
                assert not online_errors, online_errors
                evidence["checks"]["responsiveSafeAreaCSSReducedMotionSmartHeaderScrollTop"] = "PASS"
                context.set_offline(True)
                # Playwright's network block does not set navigator.onLine in this
                # Chrome build. Model the OS connectivity signal separately through
                # CDP, while retaining the actual failed-network assertion below.
                connectivity_session = context.new_cdp_session(page)
                connectivity_session.send("Network.overrideNetworkState", {
                    "offline": True, "latency": 0,
                    "downloadThroughput": -1, "uploadThroughput": -1,
                })
                assert page.evaluate("navigator.onLine") is False
                assert page.evaluate("fetch('network-probe').then(() => false).catch(() => true)")
                page.reload(wait_until="networkidle")
                assert page.locator(".design-card").count() == len(catalog["designs"])
                offline_signal = page.evaluate("""() => ({ online: navigator.onLine,
                    noticeHidden: document.querySelector('#connection-notice').hidden,
                    status: document.querySelector('#app-status').textContent,
                    controlled: Boolean(navigator.serviceWorker.controller) })""")
                print("Offline signal evidence:", json.dumps(offline_signal), flush=True)
                assert page.locator("#connection-notice").is_visible()
                page.select_option("#style-filter", "minimal")
                assert page.locator(".design-card:visible").count() == 1
                page.goto(base, wait_until="networkidle")
                page.locator("#company-search").fill("Goh")
                assert page.locator(".company-card:visible").count() == 1
                page.locator(".company-card").click()
                page.locator('.design-card[data-design="v1"] .card-action').click()
                page.wait_for_url("**/offline.html")
                assert page.get_by_role("heading", name="This preview needs a connection.").is_visible()
                evidence["checks"]["offlineLaunchSearchFiltersAndExplicitDemoFallback"] = "PASS"
                context.set_offline(False)
                connectivity_session.send("Network.overrideNetworkState", {
                    "offline": False, "latency": 0,
                    "downloadThroughput": -1, "uploadThroughput": -1,
                })
                assert page.evaluate("navigator.onLine") is True
                page.goto(base + "companies/gjh/index.html?review=keep", wait_until="networkidle")
                page.evaluate("caches.open('other-app-sentinel')")
                server.release_directory = folder / "b"
                server.mixed_files = {"version.json": (a / "version.json").read_bytes()}
                page.locator("#check-update").click()
                page.wait_for_function("() => !document.querySelector('#check-update').disabled")
                assert page.evaluate("navigator.serviceWorker.getRegistration().then(r => !r.waiting)")
                assert page.locator("#update-notice").is_hidden()
                server.mixed_files = {"index.html": (a / "index.html").read_bytes()}
                page.locator("#check-update").click()
                page.wait_for_function("() => !document.querySelector('#check-update').disabled")
                assert page.evaluate("navigator.serviceWorker.getRegistration().then(r => !r.waiting)")
                keys = page.evaluate("caches.keys()")
                assert any(release_a["build"] in key for key in keys)
                assert not any(release_b["build"] in key for key in keys)
                evidence["checks"]["identityMismatchAndMixedFileHashFailClosed"] = "PASS"
                server.mixed_files = {}
                page.locator("#check-update").click()
                try:
                    page.wait_for_function("() => !document.querySelector('#update-notice').hidden")
                except Exception:
                    print("Update diagnostic:", page.locator("#app-status").inner_text(), page.evaluate("navigator.serviceWorker.getRegistration().then(r=>({active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state}))"), page.evaluate("caches.keys()"), flush=True)
                    raise
                assert "v" + release_b["version"] in page.locator("#apply-update").inner_text()
                assert page.locator('meta[name="app-build"]').get_attribute("content") == release_a["build"]
                second = context.new_page()
                second.goto(base + "companies/gjh/index.html", wait_until="networkidle")
                second.wait_for_function("() => !document.querySelector('#update-notice').hidden")
                page.screenshot(path=str(screenshots / "update-available-375.png"), full_page=True)
                navigations = []
                page.on("framenavigated", lambda frame: navigations.append(frame.url) if frame == page.main_frame else None)
                page.locator("#apply-update").click()
                assert page.locator("#update-dialog").is_visible()
                assert page.locator("#apply-update").is_disabled()
                page.screenshot(path=str(screenshots / "updating-375.png"))
                page.wait_for_function("() => document.querySelector('meta[name=app-build]').content === 'bbbbbbbbbbbbbbbb'", timeout=30000)
                assert len(navigations) == 1, navigations
                assert "?review=keep" in page.url
                assert second.locator('meta[name="app-build"]').get_attribute("content") == release_a["build"]
                keys = page.evaluate("caches.keys()")
                assert "other-app-sentinel" in keys
                assert not any(release_a["build"] in key for key in keys)
                assert any(release_b["build"] in key for key in keys)
                evidence["checks"]["waitingVersionPromptLoaderSingleReloadAndOtherTabConsent"] = "PASS"
                evidence["checks"]["onlyOwnedOldCachesDeleted"] = "PASS"
                second.close()
                server.release_directory = folder / "c"
                page.locator("#check-update").click()
                page.wait_for_function("() => !document.querySelector('#update-notice').hidden")
                page.locator("#apply-update").click()
                page.wait_for_selector("#close-update:visible", timeout=25000)
                assert "could not finish" in page.locator("#update-progress").inner_text()
                page.locator("#close-update").click()
                assert page.locator("#update-dialog").is_hidden()
                assert page.locator("#apply-update").is_enabled()
                assert page.locator('meta[name="app-build"]').get_attribute("content") == release_b["build"]
                evidence["checks"]["activationTimeoutRecovery"] = "PASS"
                evidence["browserVersion"] = browser.version
                browser.close()
        finally:
            server.shutdown(); server.server_close(); thread.join()
    (ROOT / "docs/evidence/pwa-browser.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence, indent=2))


if __name__ == "__main__":
    run()
