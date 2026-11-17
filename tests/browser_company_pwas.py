"""Verify catalogue app identities and exercise real, independently scoped demo workers."""
import argparse
from collections import Counter
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import hashlib
import json
import os
from pathlib import Path
import posixpath
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.parse import urljoin, urlsplit

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "/Webpage-Design-Gallery/"
SAMPLES = (
    ("gjh", "v6", "../shared/navigation.js"),
    ("gjh", "v18", "../../../../assets/gjh-themes.css"),
    ("yeos", "v1", "../../../../assets/tokens.css"),
    ("thow-kwang", "v1", "../shared/guide.css"),
)


class Head(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.in_head = False
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        if tag == "head":
            self.in_head = True
        elif self.in_head:
            self.tags.append((tag, dict(attrs)))

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False

    def one(self, tag, key, value):
        found = [attrs for element, attrs in self.tags if element == tag and attrs.get(key) == value]
        assert len(found) == 1, (tag, key, value, found)
        return found[0]


def check_catalogue(root):
    catalogue = json.loads((root / "data/designs.json").read_text(encoding="utf-8"))
    companies = json.loads((root / "data/companies.json").read_text(encoding="utf-8"))
    counts = Counter(item["companyId"] for item in catalogue)
    assert set(counts) == {company["id"] for company in companies}
    assert all(total >= 15 for total in counts.values()), counts
    identities = set()
    scopes = set()
    for design in catalogue:
        path = design["demoPath"]
        head = Head((root / path).read_text(encoding="utf-8"))
        app_link = head.one("link", "rel", "manifest")["href"]
        app_path = urljoin(path, app_link)
        manifest = json.loads((root / app_path).read_text(encoding="utf-8"))
        scope = urljoin(app_path, manifest["scope"])
        identity = urljoin(app_path, manifest["id"])
        assert scope == posixpath.dirname(path) + "/", (path, scope)
        assert identity in {scope, path} and identity not in identities, (path, identity)
        assert scope not in scopes and urljoin(app_path, manifest["start_url"]) == path, (path, manifest)
        identities.add(identity)
        scopes.add(scope)
        assert manifest["display"] == "standalone" and manifest["name"] and manifest["short_name"], path
        assert "viewport-fit=cover" in head.one("meta", "name", "viewport")["content"], path
        assert head.one("meta", "name", "theme-color")["content"], path
        if design["id"] != "gjh-v11":
            for name in ("mobile-web-app-capable", "apple-mobile-web-app-capable"):
                assert head.one("meta", "name", name)["content"] == "yes", (path, name)
            assert (root / posixpath.dirname(path) / "sw.js").is_file(), path
        assert (root / urljoin(path, head.one("link", "rel", "apple-touch-icon")["href"])).is_file(), path
        sizes = set()
        for icon in manifest["icons"]:
            image_path = root / urljoin(app_path, icon["src"])
            with Image.open(image_path) as image:
                size = f"{image.width}x{image.height}"
                assert size in icon["sizes"].split(), (image_path, image.size)
                sizes.add(size)
        assert {"192x192", "512x512"} <= sizes, (path, sizes)
    print(f"Verified {len(identities)} app identities and manifests across {dict(counts)}", flush=True)
    return {(row["companyId"], row["version"]): row["demoPath"] for row in catalogue}


class QuietHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.server.disconnected:
            self.close_connection = True
            return
        path = urlsplit(self.path).path
        override = self.server.overrides.get(path)
        if override is None:
            super().do_GET()
            return
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(override)))
        self.end_headers()
        self.wfile.write(override)

    def log_message(self, *args):
        pass


def verify_demo(context, path, asset):
    page = context.new_page()
    try:
        # Exercise installation guidance with a keyboard as on a browser without a native install prompt.
        page.add_init_script("addEventListener('beforeinstallprompt', event => event.stopImmediatePropagation())")
        response = page.goto(path)
        assert response and response.ok, path
        expected_scope = urljoin(path, "./")
        summary = page.locator("summary").filter(has_text="Install / offline")
        panel = summary.locator("..")
        expect(panel.locator("[role=status]")).to_contain_text("Available offline", timeout=60000)
        # A first installation can activate without taking control of the already-open page.
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("scope => navigator.serviceWorker.controller?.scriptURL === new URL('sw.js', scope).href", arg=expected_scope)
        registration = page.evaluate("async () => (await navigator.serviceWorker.getRegistration()).scope")
        assert registration == expected_scope, (path, registration)
        cdp = context.new_cdp_session(page)
        manifest = cdp.send("Page.getAppManifest")
        assert not manifest.get("errors"), (path, manifest.get("errors"))
        parsed = json.loads(manifest["data"])
        scope = urljoin(manifest["url"], parsed["scope"])
        assert scope == expected_scope and urljoin(manifest["url"], parsed["start_url"]) == path
        expect(summary).to_have_count(1)
        summary.focus()
        summary.press("Enter")
        status = panel.get_by_role("status")
        expect(status).to_contain_text("Available offline")
        install = panel.get_by_role("button", name="Install this demo")
        summary.press("Tab")
        expect(install).to_be_focused()
        install.press("Enter")
        expect(status).to_contain_text("Add to Home Screen")
        check = panel.get_by_role("button", name="Check for updates")
        install.press("Tab")
        expect(check).to_be_focused()
        check.press("Space")
        expect(status).to_contain_text("Available offline")
        expect(check).to_be_enabled()
        summary.focus()
        summary.press("Enter")
        expect(check).to_be_hidden()

        # Removing the ordinary HTTP cache ensures that the demo worker supplies the offline visit.
        cdp.send("Network.clearBrowserCache")
        context.set_offline(True)
        offline = page.reload(wait_until="domcontentloaded")
        assert offline and offline.ok and offline.from_service_worker, (path, "offline entry")
        expect(page.locator("h1").first).to_be_visible()
        page.evaluate("document.querySelectorAll('img').forEach(image => { image.loading = 'eager' })")
        page.wait_for_function(
            """() => [...document.images].every(image => !image.currentSrc ||
                    new URL(image.currentSrc).origin !== location.origin || (image.complete && image.naturalWidth > 0))"""
        )
        status = page.evaluate(
            """async asset => {
                const response = await fetch(asset, {cache: 'no-store'});
                return {status: response.status, type: response.headers.get('Content-Type'), bytes: (await response.arrayBuffer()).byteLength};
            }""",
            asset,
        )
        content_type = "javascript" if asset.endswith(".js") else "css"
        assert status["status"] == 200 and content_type in status["type"] and status["bytes"] > 0, (asset, status)
        return expected_scope
    finally:
        context.set_offline(False)
        page.close()


def verify_offline_pair(context, path, server):
    page = context.new_page()
    try:
        page.goto(path)
        assert page.evaluate("Boolean(navigator.serviceWorker.controller)"), path
        page.get_by_label("First drink").select_option("black-soy")
        page.get_by_label("Second drink").select_option("bandung")
        permalink = page.locator("#pair-link").get_attribute("href")
        assert urlsplit(permalink).fragment == "compare"
        context.new_cdp_session(page).send("Network.clearBrowserCache")
        context.set_offline(True)
        # Requests from the worker itself must also be unable to reach the origin.
        server.disconnected = True
        page.goto("about:blank")
        response = page.goto(permalink, wait_until="domcontentloaded")
        assert response and response.ok and response.from_service_worker and page.url == permalink
        expect(page.get_by_label("First drink")).to_have_value("black-soy")
        expect(page.get_by_label("Second drink")).to_have_value("bandung")
        expect(page.get_by_role("row", name="Can Not listed 300 mL")).to_be_visible()
        print("PASS offline comparison permalink preserves both selections and the fragment", flush=True)
    finally:
        server.disconnected = False
        context.set_offline(False)
        page.close()


def verify_release_update(context, root, base, path, overrides):
    """Serve a mixed publication, then its matching release, without editing the artifact."""
    directory = posixpath.dirname(path) + "/"
    style_path = directory + "style.css"
    worker_path = directory + "sw.js"
    release_a = json.loads((root / "version.json").read_text(encoding="utf-8"))
    style_a = (root / style_path).read_bytes()
    marker = "/* company offline release verification */"
    style_b = style_a + b"\n" + marker.encode() + b"\n"
    digest_a = hashlib.sha256(style_a).hexdigest()
    digest_b = hashlib.sha256(style_b).hexdigest()
    release_b = {"version": "99.0.1", "build": digest_b[:16]}
    worker_a = (root / worker_path).read_text(encoding="utf-8")
    assert json.dumps(release_a) in worker_a and digest_a in worker_a
    worker_b = worker_a.replace(json.dumps(release_a), json.dumps(release_b)).replace(digest_a, digest_b)

    page = context.new_page()
    try:
        page.goto(urljoin(base, path))
        summary = page.locator("summary").filter(has_text="Install / offline")
        summary.press("Enter")
        panel = summary.locator("..")
        status = panel.get_by_role("status")
        expect(status).to_contain_text(release_a["build"][:8])
        overrides[PREFIX + worker_path] = worker_b.encode()
        overrides[PREFIX + "version.json"] = json.dumps(release_b).encode()
        panel.get_by_role("button", name="Check for updates").press("Enter")
        expect(status).to_contain_text("could not be verified", timeout=60000)
        expect(panel.get_by_role("button", name="Update and reload")).to_be_hidden()
        context.set_offline(True)
        offline = page.reload(wait_until="domcontentloaded")
        assert offline and offline.ok and offline.from_service_worker
        expect(page.locator("summary").filter(has_text="Install / offline").locator("..").locator("[role=status]")).to_contain_text(release_a["build"][:8])
        assert marker not in page.evaluate("async () => (await fetch('style.css')).text()")
        context.set_offline(False)

        overrides[PREFIX + style_path] = style_b
        summary.press("Enter")
        panel.get_by_role("button", name="Check for updates").press("Enter")
        update = page.get_by_role("button", name="Update and reload")
        expect(update).to_be_visible(timeout=60000)
        assert marker not in page.evaluate("async () => (await fetch('style.css')).text()")
        with page.expect_navigation(wait_until="domcontentloaded"):
            update.press("Enter")
        expect(page.locator("summary").filter(has_text="Install / offline").locator("..").locator("[role=status]")).to_contain_text(release_b["build"][:8])
        context.set_offline(True)
        offline = page.reload(wait_until="domcontentloaded")
        assert offline and offline.from_service_worker and marker in page.evaluate("async () => (await fetch('style.css')).text()")
        print("PASS mixed demo release rejected; previous edition stayed offline until a verified update was applied", flush=True)
    finally:
        context.set_offline(False)
        overrides.clear()
        page.close()


def run(root):
    paths = check_catalogue(root)
    with TemporaryDirectory(prefix="gallery-company-pwas-") as directory:
        (Path(directory) / PREFIX.strip("/")).symlink_to(root, target_is_directory=True)
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=directory))
        server.overrides = {}
        server.disconnected = False
        Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}{PREFIX}"
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ.get("GALLERY_CHROME"))
                context = browser.new_context(viewport={"width": 390, "height": 844})
                try:
                    scopes = set()
                    for company, version, asset in SAMPLES:
                        path = paths[company, version]
                        scopes.add(verify_demo(context, urljoin(base, path), asset))
                        print(f"PASS {company} {version} keyboard, offline reload and shared asset", flush=True)
                    page = context.new_page()
                    page.goto(urljoin(base, paths[SAMPLES[0][:2]]))
                    registered = page.evaluate("async () => (await navigator.serviceWorker.getRegistrations()).map(worker => worker.scope)")
                    assert scopes <= set(registered), (scopes, registered)
                    print(f"Verified {len(scopes)} independently registered demo scopes", flush=True)
                    page.close()
                    verify_offline_pair(context, urljoin(base, paths["yeos", "v1"]), server)
                    verify_release_update(context, root, base, paths["gjh", "v18"], server.overrides)
                finally:
                    context.close()
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-root", type=Path, default=ROOT, help="Serve this source tree or a built Pages artifact")
    run(parser.parse_args().site_root.resolve())
