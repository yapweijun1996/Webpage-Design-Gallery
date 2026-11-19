"""Verify four standalone GJH concepts and the V11 crowd in the publishable artifact.

Requires Python Playwright and a local Chrome. Optional --axe-script accepts a
locally reviewed axe-core browser bundle; this runner never downloads code.
"""

import argparse
import functools
import hashlib
import http.server
import importlib.util
import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VERSIONS = ("v1", "v5", "v6", "v7")
VIEWPORTS = ((1440, 1000), (1024, 768), (768, 1024), (430, 932), (390, 844), (375, 812), (320, 720))
CAPTURE_WIDTHS = (1440, 768, 390, 375)
SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass


def check_concept_receipts(assets, sources, official_hashes):
    for asset in sources.get("conceptArtwork", []):
        image = assets / asset["file"]
        digest = hashlib.sha256(image.read_bytes()).hexdigest()
        assert asset["kind"] == "local-concept-illustration" and digest not in official_hashes, image
        assert digest == asset["sha256"], image
        receipt = assets / asset["sourceReceipt"]
        original = receipt.parent / asset["sourceFile"]
        source = json.loads(receipt.read_text())
        records = source.get("images", []) + source.get("assets", [])
        record = next((item for item in records if item["file"] == original.name), None)
        assert record and original.is_file(), original
        if "sha256" in record:
            assert hashlib.sha256(original.read_bytes()).hexdigest() == record["sha256"], original
        if image.name == original.name:
            assert image.read_bytes() == original.read_bytes(), (image, original)


def check_entry_action(page, version):
    action = page.locator(".entry .entry-action")
    target = {
        "v1": "#business-food", "v5": "https://www.gjh.com.sg/newmoon/",
        "v6": "#new-moon", "v7": "#partnership",
    }[version]
    assert action.is_visible() and action.get_attribute("href") == target, (version, target)
    if version == "v5":
        page.route(target, lambda route: route.fulfill(content_type="text/html", body="<title>Brand destination fixture</title>"))
        action.press("Enter")
        page.wait_for_url(target)
        page.go_back()
    else:
        action.press("Enter")
        page.wait_for_function("target => location.hash === target", arg=target)
        assert page.locator(target).is_visible(), (version, target)


def check_v11_arrival_tools(browser, base):
    """The visitor arrivals page offers the release version, three languages and a dark or light theme."""
    results = []
    for width, height in ((1440, 900), (393, 780)):
        context = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.goto(base + "demos/corporate/gjh/v11/", wait_until="domcontentloaded")
        theme, check = page.locator("#arrival-theme"), page.locator("#arrival-check-update")
        theme.wait_for()
        page.wait_for_function("document.querySelector('#arrival-check-update [data-mall-version]').textContent.startsWith('v')")
        assert page.evaluate("document.documentElement.dataset.colorScheme") == "dark"
        assert theme.get_attribute("aria-pressed") == "false" and "light" in theme.inner_text()
        theme.click()
        assert page.evaluate("document.documentElement.dataset.colorScheme") == "light"
        assert page.evaluate("localStorage.getItem('gjh-v11-color-scheme')") == "light"
        assert theme.get_attribute("aria-pressed") == "true" and "dark" in theme.inner_text()
        assert page.evaluate("getComputedStyle(document.querySelector('.arrivals')).backgroundColor") == "rgb(244, 241, 230)"
        for code, word in (("zh-Hans", "检查更新"), ("ms", "Semak kemas kini"), ("en", "Check for updates")):
            page.select_option("#arrival-language", code)
            assert word in check.inner_text(), (code, check.inner_text())
        page.reload(wait_until="domcontentloaded")
        assert page.evaluate("document.documentElement.dataset.colorScheme") == "light"
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        assert not errors, errors
        results.append({"width": width, "theme": "dark/light persisted", "languages": "en zh-Hans ms", "overflow": "none"})
        context.close()
    print("v11 arrivals: version label, language and theme controls PASS", flush=True)
    return results


def check_v11_crowd(browser, base):
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                  has_touch=True, service_workers="block", reduced_motion="no-preference")
    context.add_init_script("""localStorage.setItem('gjh-v11-tutorial-v1','dismissed');
                              localStorage.setItem('gjh-v11-graphics-quality-v1','balanced');""")
    page = context.new_page()
    errors, requested = [], set()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: requested.add(request.url))
    page.goto(base + "demos/corporate/gjh/v11/", wait_until="domcontentloaded")
    assert not any('/chibi-crowd/' in url for url in requested), requested
    page.locator("#arrival-walk").click()
    page.wait_for_function("window.__sceneReady || window.__sceneFailed", timeout=90000)
    assert page.evaluate("window.__sceneReady && __mall.ready"), page.locator("#loader-status").inner_text()
    page.locator("#app-loader").wait_for(state="hidden", timeout=90000)
    assert page.evaluate("__mall.teleport('atrium')")
    # The bare wardrobe has no clothing, so the dressed legacy visitors must stay in service.
    page.wait_for_function("window.__mall.state.npcs?.modular.status === 'unavailable'", timeout=45000)
    state = page.evaluate("__mall.state")
    npcs = state["npcs"]
    assert npcs["modular"]["active"] == [], npcs["modular"]
    page.wait_for_function("window.__mall.state.npcs.visible >= 1", timeout=45000)
    npcs = page.evaluate("__mall.state.npcs")
    assert 1 <= npcs["visible"] <= npcs["limit"], npcs
    assert page.evaluate("__mall.state.renderBudget.totalCalls") <= 200
    assert page.evaluate("innerWidth === 390 && document.documentElement.scrollWidth <= innerWidth")
    assert not errors, errors
    context.close()
    print(f"v11 / 390px: clothed legacy visitors stay in service until the wardrobe has clothing; "
          f"{npcs['visible']} visible, {state['renderBudget']['totalCalls']} total draws", flush=True)
    return {"width": 390, "npcCount": npcs["visible"], "drawCalls": state["renderBudget"]["totalCalls"],
            "modular": "unavailable until clothing exists", "layoutOverflow": "PASS", "consoleErrors": errors}


def run(axe_script=None):
    evidence = {
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "runtime": "Local headless Chrome, GitHub Pages-style project prefix",
        "axe": {"status": "UNVERIFIED", "reason": "No local audit bundle supplied"},
        "cases": [],
        "limitations": [
            "Automated axe checks and keyboard checks do not establish complete WCAG conformance.",
            "No manual screen-reader, physical-device, cross-browser or field Core Web Vitals validation.",
            "No owner design approval or measured business conversion result is implied.",
        ],
    }
    if axe_script:
        evidence["axe"] = {"version": "4.10.3", "sha256": hashlib.sha256(axe_script.read_bytes()).hexdigest()}
    manifest = json.loads((ROOT / "assets/companies/gjh/official/manifest.json").read_text())
    official_hashes = {a["sha256"] for a in manifest["assets"]}
    documented_images = {}
    for version in VERSIONS:
        assets = ROOT / f"demos/corporate/gjh/{version}/assets"
        source = (assets.parent / "index.html").read_text(encoding="utf-8")
        assert not any(marker in source for marker in ("\u00c2", "\u00e2", "\ufffd")), (version, "Broken UTF-8 punctuation")
        sources = json.loads((assets / "sources.json").read_text())
        for asset in sources["assets"]:
            digest = hashlib.sha256((assets / asset["file"]).read_bytes()).hexdigest()
            assert digest == asset["sha256"] and digest in official_hashes, (version, asset["file"])
        check_concept_receipts(assets, sources, official_hashes)
        documented_images[version] = {
            "assets/" + asset["file"] for asset in sources["assets"] + sources.get("conceptArtwork", [])
        }
        font = sources["font"]
        assert hashlib.sha256((assets / font["file"]).read_bytes()).hexdigest() == font["sha256"]
        assert "SIL OPEN FONT LICENSE" in (assets / font["licenseFile"]).read_text(encoding="utf-8")
    evidence["unalteredOfficialAssetCopies"] = "PASS"
    with tempfile.TemporaryDirectory(prefix="gjh-browser-") as temporary:
        output = Path(temporary) / "Webpage-Design-Gallery"
        gallery.build(output)
        handler = functools.partial(QuietHandler, directory=temporary)
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/"
        try:
            with sync_playwright() as playwright:
                chrome = os.environ.get("GALLERY_CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
                browser = playwright.chromium.launch(executable_path=chrome, headless=True, args=[
                    "--use-angle=" + os.environ.get("GALLERY_WEBGL_BACKEND", "swiftshader"),
                    "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
                evidence["browserVersion"] = browser.version
                for version in VERSIONS:
                    for width, height in VIEWPORTS:
                        context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                        page = context.new_page()
                        errors, failed_responses = [], []
                        page.on("pageerror", lambda error: errors.append(str(error)))
                        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
                        page.on("response", lambda response: failed_responses.append(response.url) if response.status >= 400 else None)
                        page.goto(base + f"demos/corporate/gjh/{version}/", wait_until="networkidle")
                        page.evaluate("document.fonts.ready")
                        assert page.evaluate("[...document.fonts].some(f => f.family === 'Manrope' && f.status === 'loaded')")
                        for image in page.locator("img").all():
                            image.evaluate("image => image.loading = 'eager'")
                        page.evaluate("Promise.all(Array.from(document.images, image => image.decode()))")
                        image_paths = set(page.locator("img").evaluate_all("imgs => imgs.map(img => img.getAttribute('src'))"))
                        assert image_paths <= documented_images[version], (version, image_paths - documented_images[version])
                        assert page.locator("h1").count() == 1
                        assert page.locator("main").count() == 1
                        assert page.locator(".identity img").get_attribute("src") == "assets/gjh-logo.png"
                        assert "Independent design concept" in page.locator(".concept-notice").inner_text()
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (version, width, "overflow")
                        assert page.evaluate("Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)")
                        assert page.evaluate("getComputedStyle(document.documentElement).scrollBehavior") == "auto"
                        assert page.locator(".button").first.evaluate("b => getComputedStyle(b).transitionDuration") == "0s"
                        page.keyboard.press("Tab")
                        assert page.evaluate("document.activeElement.textContent") == "Skip to content"
                        assert page.locator(".skip").evaluate("a => getComputedStyle(a).outlineStyle") != "none"
                        page.keyboard.press("Enter")
                        assert page.evaluate("document.activeElement.id") == "main"
                        # Validate every in-document destination, not just the main navigation.
                        assert page.evaluate("""() => [...document.querySelectorAll('a[href^="#"]')]
                            .every(a => a.hash && document.getElementById(a.hash.slice(1)))""")
                        assert page.locator('a[href="https://www.gjh.com.sg/contact-us/"]').get_attribute("target") == "_blank"
                        if width <= 900:
                            toggle = page.get_by_role("button", name="Menu")
                            assert not page.locator("#navigation").is_visible()
                            toggle.focus()
                            page.keyboard.press("Enter")
                            assert toggle.get_attribute("aria-expanded") == "true"
                            page.keyboard.press("Tab")
                            assert page.evaluate("document.activeElement.getAttribute('href')") == "#business"
                            page.keyboard.press("Escape")
                            assert toggle.get_attribute("aria-expanded") == "false"
                            assert page.locator(".menu-toggle").evaluate("b => b === document.activeElement")
                            page.keyboard.press("Space")
                            page.keyboard.press("Tab")
                            page.keyboard.press("Enter")
                            # Fragment navigation commits asynchronously after activation in Chromium.
                            # Await the same destination; keep URL/menu/focus assertions unchanged.
                            page.wait_for_url("**/#business", timeout=3000)
                            assert page.url.endswith("#business")
                            assert toggle.get_attribute("aria-expanded") == "false"
                            assert page.evaluate("document.activeElement.id") == "business"
                            # Resizing an open menu must not leave hidden focused links.
                            page.set_viewport_size({"width": 1024, "height": 768})
                            page.wait_for_function("!matchMedia('(max-width: 900px)').matches")
                            page.locator('#navigation a[href="#brands"]').focus()
                            page.set_viewport_size({"width": width, "height": height})
                            page.wait_for_function("document.activeElement === document.querySelector('.menu-toggle')")
                        else:
                            page.locator('#navigation a[href="#business"]').click()
                            # Fragment navigation commits asynchronously after activation in Chromium.
                            # Await the same destination; keep URL/menu/focus assertions unchanged.
                            page.wait_for_url("**/#business", timeout=3000)
                            assert page.url.endswith("#business")
                        page.evaluate("window.scrollTo(0, 0)")
                        if width in CAPTURE_WIDTHS:
                            screenshot = ROOT / f"demos/corporate/gjh/{version}/screenshots/{width}.png"
                            page.screenshot(path=str(screenshot), full_page=True)
                            if width == 1440:
                                with Image.open(screenshot) as image:
                                    image.crop((0, 0, 1440, 900)).resize((720, 450)).save(screenshot.parents[1] / "assets/thumbnail.webp", quality=88)
                        violations, incomplete = [], []
                        if axe_script:
                            page.add_script_tag(path=str(axe_script))
                            result = page.evaluate("""async () => {
                                const result = await axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}});
                                return {violations: result.violations.map(v => ({id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target)})),
                                    incomplete: result.incomplete.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)}))};
                            }""")
                            violations, incomplete = result["violations"], result["incomplete"]
                        check_entry_action(page, version)
                        assert not failed_responses, failed_responses
                        assert not errors, errors
                        case = {"version": version, "width": width, "layoutOverflow": "PASS", "navigationAndKeyboard": "PASS", "images": "PASS", "reducedMotion": "PASS", "consoleErrors": errors, "failedResponses": failed_responses, "axeViolations": violations, "axeNeedsManualReview": incomplete}
                        evidence["cases"].append(case)
                        print(f"{version} / {width}px: layout, navigation, images, keyboard PASS; axe violations {len(violations)}", flush=True)
                        context.close()
                    context = browser.new_context(viewport={"width": 375, "height": 812}, java_script_enabled=False)
                    page = context.new_page()
                    page.goto(base + f"demos/corporate/gjh/{version}/", wait_until="networkidle")
                    assert page.locator("#navigation").is_visible()
                    page.locator('#navigation a[href="#business"]').click()
                    assert page.url.endswith("#business")
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                    context.close()
                evidence["v11Arrival"] = check_v11_arrival_tools(browser, base)
                evidence["v11Crowd"] = check_v11_crowd(browser, base)
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
    evidence["noJavaScriptNavigation"] = "PASS"
    if axe_script:
        evidence["axe"]["status"] = "PASS" if not any(c["axeViolations"] for c in evidence["cases"]) else "FAIL"
    path = ROOT / "docs/evidence/gjh-redesign-browser.json"
    path.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    assert not any(c["axeViolations"] for c in evidence["cases"]), f"See {path} for accessibility failures"
    print(f"PASS: {len(evidence['cases'])} browser cases; four no-JavaScript journeys; source asset integrity.")
    print("Gallery must be rebuilt after screenshot capture so design-detail dimensions stay current.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--axe-script", type=Path)
    arguments = parser.parse_args()
    run(arguments.axe_script)
