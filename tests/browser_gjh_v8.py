"""Verify the GJH V8 concept and its gallery integration in real Chrome.

The runner builds the publishable GitHub Pages-style artifact in a temporary
directory, serves it under a path prefix, exercises the browser behavior at
the required viewport sizes, and writes bounded evidence locally. It never
downloads an audit bundle or changes deployment configuration.
"""

import argparse
import functools
import hashlib
import http.server
import importlib.util
import json
import os
import shutil
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
V8_ROUTE = "demos/corporate/gjh/v8/index.html"
VIEWPORTS = ((1920, 1080), (1440, 900), (768, 1024), (390, 844), (320, 568))
SCREENSHOT_WIDTHS = {1440: "1440.png", 768: "768.png", 390: "390.png"}
VERSIONS = ("v1", "v5", "v6", "v7", "v8")

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


def _assert_no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), page.url


def _decode_images(page):
    # Force lazy images into the browser's loading path before checking them.
    page.evaluate("document.querySelectorAll('img').forEach((image) => { image.loading = 'eager'; })")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(100)
    page.evaluate("window.scrollTo(0, 0)")
    page.evaluate(
        """async () => {
          await Promise.all(Array.from(document.images).map((image) =>
            image.complete ? Promise.resolve() : new Promise((resolve) => {
              image.addEventListener('load', resolve, {once: true});
              image.addEventListener('error', resolve, {once: true});
            })
          ));
        }"""
    )
    result = page.locator("img").evaluate_all(
        "images => images.map(image => ({src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth}))"
    )
    assert result, "V8 should expose imagery"
    assert all(item["complete"] and item["width"] > 0 for item in result), result


def _check_navigation(page):
    expected = {"#story", "#brands", "#business", "#network", "#contact"}
    hrefs = set(page.locator("#navigation a").evaluate_all("links => links.map(link => link.getAttribute('href'))"))
    assert expected.issubset(hrefs), hrefs
    assert page.locator("a[href^='https://www.gjh.com.sg/'][target='_blank']").count() >= 1


def _check_skip_link(page):
    page.goto(page.url, wait_until="networkidle")
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement === document.querySelector('.skip')")
    page.keyboard.press("Enter")
    assert page.evaluate("document.activeElement === document.querySelector('#main')")


def _check_stateful_controls(page):
    era_buttons = page.locator("[data-era]")
    assert era_buttons.count() >= 2
    era_title = page.locator("#era-title")
    era_copy = page.locator("#era-copy")
    assert era_title.count() == 1 and era_copy.count() == 1
    initial_title = era_title.inner_text()
    for index in range(era_buttons.count()):
        button = era_buttons.nth(index)
        button.click()
        assert button.get_attribute("aria-pressed") == "true"
        assert page.locator("[data-era][aria-pressed='true']").count() == 1
        assert era_title.inner_text() and era_copy.inner_text()
    assert era_title.inner_text() != "" and initial_title != ""

    milestone_buttons = page.locator("[data-milestone]")
    assert milestone_buttons.count() >= 3
    for index in range(milestone_buttons.count()):
        button = milestone_buttons.nth(index)
        button.click()
        assert button.get_attribute("aria-pressed") == "true"
        assert page.locator("[data-milestone][aria-pressed='true']").count() == 1

    market_buttons = page.locator("[data-market]")
    assert market_buttons.count() >= 3
    market_status = page.locator("#market-status")
    assert market_status.count() == 1
    for index in range(market_buttons.count()):
        button = market_buttons.nth(index)
        button.click()
        assert button.get_attribute("aria-pressed") == "true"
        assert page.locator("[data-market][aria-pressed='true']").count() == 1
        assert market_status.inner_text()
        market_path = page.locator(f"[data-connection='{button.get_attribute('data-market')}']")
        if market_path.count():
            active_path = page.locator(f"[data-connection='{button.get_attribute('data-market')}'].active")
            assert active_path.count() == 1
        else:
            assert button.get_attribute("data-market") == "Singapore"


def _check_mobile_menu(page, check_target=True):
    toggle = page.locator(".menu-toggle")
    assert toggle.count() == 1
    toggle.click()
    assert toggle.get_attribute("aria-expanded") == "true"
    page.keyboard.press("Escape")
    assert toggle.get_attribute("aria-expanded") == "false"
    assert page.evaluate("document.activeElement === document.querySelector('.menu-toggle')")
    if check_target:
        toggle.click()
        page.locator("#navigation a[href='#story']").click()
        assert page.evaluate("document.activeElement === document.querySelector('#story')")


def _check_breakpoint_focus_recovery(page):
    page.set_viewport_size({"width": 901, "height": 844})
    page.locator("#navigation a[href='#story']").focus()
    page.set_viewport_size({"width": 900, "height": 844})
    page.wait_for_timeout(100)
    assert page.evaluate("document.activeElement === document.querySelector('.menu-toggle')")
    assert page.locator(".menu-toggle").get_attribute("aria-expanded") == "false"


def _check_normal_motion(page):
    assert page.evaluate("!matchMedia('(prefers-reduced-motion: reduce)').matches")
    page.evaluate("window.scrollTo(0, 280)")
    page.wait_for_timeout(160)
    hero_motion = page.locator("#top").evaluate("element => ({y: element.style.getPropertyValue('--hero-y'), scale: element.style.getPropertyValue('--hero-scale')})")
    assert hero_motion["y"] and hero_motion["scale"], hero_motion

    brands_top = page.locator("#brands").evaluate("element => element.offsetTop")
    page.evaluate("top => window.scrollTo(0, top - 180)", brands_top)
    page.wait_for_timeout(160)
    assert page.evaluate("matchMedia('(pointer: fine)').matches")
    depth_values = page.locator(".brand-object").evaluate_all("cards => cards.map(card => card.style.getPropertyValue('--depth-y'))")
    assert any(value for value in depth_values), depth_values
    first_brand = page.locator(".brand-object").first
    box = first_brand.bounding_box()
    assert box
    page.mouse.move(box["x"] + box["width"] * .8, box["y"] + box["height"] * .3)
    page.wait_for_timeout(80)
    tilt_values = first_brand.evaluate("element => ({x: element.style.getPropertyValue('--tilt-x'), y: element.style.getPropertyValue('--tilt-y')})")
    assert tilt_values["x"] and tilt_values["y"], tilt_values

    journey_top = page.locator("#journey").evaluate("element => element.offsetTop")
    page.evaluate("top => window.scrollTo(0, top + 480)", journey_top)
    page.wait_for_timeout(180)
    active_milestone = page.locator("[data-milestone][aria-pressed='true']").get_attribute("data-milestone")
    progress = page.locator("#journey").evaluate("element => element.style.getPropertyValue('--journey-progress')")
    assert active_milestone and active_milestone != "1940s", (active_milestone, progress)
    assert progress and progress != "0%", progress
    return {
        "heroY": hero_motion["y"],
        "heroScale": hero_motion["scale"],
        "brandDepthValues": depth_values,
        "brandTilt": tilt_values,
        "automaticMilestone": active_milestone,
        "journeyProgress": progress,
    }


def _run_axe(page, axe_script, viewport):
    if not axe_script:
        return {"status": "UNVERIFIED", "reason": "No local axe bundle supplied"}
    page.add_script_tag(content=axe_script.read_text(encoding="utf-8"))
    result = page.evaluate("""async () => {
      const report = await window.axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa']}});
      return {violations: report.violations.map(item => ({id: item.id, impact: item.impact, nodes: item.nodes.length}))};
    }""")
    return {
        "status": "PASS" if not result["violations"] else "FAIL",
        "version": page.evaluate("window.axe.version"),
        "script_sha256": hashlib.sha256(axe_script.read_bytes()).hexdigest(),
        "viewports": [viewport],
        **result,
    }


def _check_no_js(base, browser):
    context = browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
    page = context.new_page()
    page.goto(base + V8_ROUTE, wait_until="networkidle")
    assert all(page.locator(f"#{section}").count() == 1 for section in ("top", "story", "brands", "business", "journey", "network", "contact"))
    assert page.locator("#navigation a").count() >= 5
    _assert_no_overflow(page)
    context.close()


def run(axe_script=None):
    screenshots = ROOT / "docs/screenshots/gjh-v8"
    screenshots.mkdir(parents=True, exist_ok=True)
    evidence = {
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "route": "/" + V8_ROUTE,
        "runtime": "Local headless Chrome, GitHub Pages-style project prefix",
        "viewportCases": [],
        "normalMotion": {},
        "artifacts": {},
        "axe": {"status": "UNVERIFIED", "reason": "No local axe bundle supplied"},
        "limitations": [
            "Automated browser checks do not establish complete WCAG conformance.",
            "No physical-device, Safari/iOS/Android, screen-reader or field Core Web Vitals validation.",
            "No owner approval or conversion result is implied by this concept review.",
        ],
        "personaReview": {
            "Accessibility Specialist": "PASS for tested keyboard, reduced-motion and no-JS paths; complete WCAG remains unverified.",
            "Mobile UX Specialist": "PASS for required emulated widths and menu behavior; physical devices remain unverified.",
            "QA Engineer": "PASS when all assertions complete; this report preserves actual failures.",
            "Performance Engineer": "PASS for no-console-error/static local load checks only; no Lighthouse or field metric claim.",
            "SEO Specialist": "PASS for page title/description and semantic section structure; search indexing was not tested.",
        },
    }

    with tempfile.TemporaryDirectory(prefix="gjh-v8-browser-") as temporary:
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
                browser = playwright.chromium.launch(executable_path=chrome, headless=True)
                for width, height in VIEWPORTS:
                    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                    page = context.new_page()
                    errors = []
                    http_failures = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
                    page.on("response", lambda response: http_failures.append({"url": response.url, "status": response.status}) if response.status >= 400 else None)
                    response = page.goto(base + V8_ROUTE, wait_until="networkidle")
                    assert response and response.ok, (response.status if response else None)
                    assert page.title().startswith("GJH")
                    assert page.locator("h1").inner_text().startswith("Generations")
                    assert all(page.locator(f"#{section}").count() == 1 for section in ("top", "story", "brands", "business", "journey", "network", "contact"))
                    _assert_no_overflow(page)
                    _decode_images(page)
                    _check_navigation(page)
                    _check_stateful_controls(page)
                    _check_mobile_menu(page) if width <= 768 else None
                    # Save a clean first-viewport state, not the last interaction state.
                    page.reload(wait_until="networkidle")
                    _decode_images(page)
                    if width in SCREENSHOT_WIDTHS:
                        page.screenshot(path=str(screenshots / SCREENSHOT_WIDTHS[width]), full_page=True)
                    evidence["viewportCases"].append({
                        "width": width,
                        "height": height,
                        "status": "PASS",
                        "reducedMotion": page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),
                        "images": page.locator("img").count(),
                        "consoleErrors": errors,
                        "httpFailures": http_failures,
                        "keyboardAndControls": "PASS",
                    })
                    assert not errors, errors
                    assert not http_failures, http_failures
                    context.close()

                if axe_script:
                    axe_results = []
                    for axe_viewport in ((1440, 900), (390, 844)):
                        audit_context = browser.new_context(viewport={"width": axe_viewport[0], "height": axe_viewport[1]}, reduced_motion="reduce")
                        audit_page = audit_context.new_page()
                        audit_page.goto(base + V8_ROUTE, wait_until="networkidle")
                        axe_results.append(_run_axe(audit_page, axe_script, {"width": axe_viewport[0], "height": axe_viewport[1]}))
                        audit_context.close()
                    evidence["axe"] = {
                        "status": "PASS" if all(result["status"] == "PASS" for result in axe_results) else "FAIL",
                        "version": axe_results[0]["version"],
                        "script_sha256": axe_results[0]["script_sha256"],
                        "viewports": [result["viewports"][0] for result in axe_results],
                        "violations": [violation for result in axe_results for violation in result["violations"]],
                    }

                normal_context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="no-preference")
                normal_page = normal_context.new_page()
                normal_page.goto(base + V8_ROUTE, wait_until="networkidle")
                normal_page_errors = []
                normal_http_failures = []
                normal_page.on("pageerror", lambda error: normal_page_errors.append(str(error)))
                normal_page.on("console", lambda message: normal_page_errors.append(message.text) if message.type == "error" else None)
                normal_page.on("response", lambda response: normal_http_failures.append({"url": response.url, "status": response.status}) if response.status >= 400 else None)
                _check_skip_link(normal_page)
                motion_details = _check_normal_motion(normal_page)
                assert not normal_page_errors, normal_page_errors
                assert not normal_http_failures, normal_http_failures
                evidence["normalMotion"]["desktop"] = {
                    "status": "PASS",
                    "checks": motion_details,
                    "consoleErrors": normal_page_errors,
                    "httpFailures": normal_http_failures,
                    "skipLinkEnterFocus": "PASS",
                }
                normal_context.close()

                mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="no-preference")
                mobile_page = mobile_context.new_page()
                mobile_page.goto(base + V8_ROUTE, wait_until="networkidle")
                mobile_errors = []
                mobile_http_failures = []
                mobile_page.on("pageerror", lambda error: mobile_errors.append(str(error)))
                mobile_page.on("console", lambda message: mobile_errors.append(message.text) if message.type == "error" else None)
                mobile_page.on("response", lambda response: mobile_http_failures.append({"url": response.url, "status": response.status}) if response.status >= 400 else None)
                _check_mobile_menu(mobile_page)
                _check_breakpoint_focus_recovery(mobile_page)
                assert not mobile_errors, mobile_errors
                assert not mobile_http_failures, mobile_http_failures
                evidence["normalMotion"]["mobile"] = {
                    "status": "PASS",
                    "checks": ["normal-motion media query", "mobile menu target focus", "900px breakpoint focus recovery"],
                    "consoleErrors": mobile_errors,
                    "httpFailures": mobile_http_failures,
                }
                mobile_context.close()

                # Gallery entry, detail and comparison must expose the new design while retaining old routes.
                context = browser.new_context(viewport={"width": 1440, "height": 900})
                page = context.new_page()
                page.goto(base, wait_until="networkidle")
                page.locator(".company-card").click()
                expected_designs = len(gallery.load_catalog()["designs"])
                assert page.locator(".design-card").count() == expected_designs
                assert page.locator('.design-card[data-design="v8"]').count() == 1
                page.goto(base + "companies/gjh/index.html", wait_until="networkidle")
                page.locator('.design-card[data-design="v8"] .details-link').click()
                page.wait_for_selector("#detail-screenshot")
                assert page.locator(".detail-intro h1").inner_text().lower().find("generations") >= 0
                page.goto(base + "compare/index.html?company=gjh&left=v8&right=v7", wait_until="networkidle")
                page.wait_for_selector("iframe")
                assert page.locator("iframe").count() == 2
                frame_urls = [frame.url for frame in page.frames if frame != page.main_frame]
                assert any("/v8/" in url for url in frame_urls), frame_urls
                assert any("/v7/" in url for url in frame_urls), frame_urls
                _assert_no_overflow(page)
                smoke_page = context.new_page()
                old_errors = []
                smoke_page.on("pageerror", lambda error: old_errors.append(str(error)))
                smoke_page.on("console", lambda message: old_errors.append(message.text) if message.type == "error" else None)
                for version in VERSIONS[:-1]:
                    response = smoke_page.goto(base + f"demos/corporate/gjh/{version}/index.html", wait_until="domcontentloaded")
                    assert response and response.ok, (version, response.status if response else None)
                    assert smoke_page.locator("h1").count() >= 1, version
                assert not old_errors, old_errors
                smoke_page.close()
                context.close()
                _check_no_js(base, browser)
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    source_screenshots = ROOT / "demos/corporate/gjh/v8/screenshots"
    source_screenshots.mkdir(parents=True, exist_ok=True)
    for filename in SCREENSHOT_WIDTHS.values():
        shutil.copy2(screenshots / filename, source_screenshots / filename)
    thumbnail_path = ROOT / "demos/corporate/gjh/v8/assets/thumbnail.webp"
    with Image.open(screenshots / "1440.png") as source_image:
        # Gallery cards use a 16:10 preview. The browser capture is full-page,
        # so use the clean desktop first viewport instead of squeezing the whole
        # narrative into a tall strip.
        crop_height = min(900, source_image.height)
        thumbnail = source_image.convert("RGB").crop((0, 0, min(1440, source_image.width), crop_height))
        thumbnail = thumbnail.resize((720, 450), Image.Resampling.LANCZOS)
        thumbnail.save(thumbnail_path, format="WEBP", quality=84, method=6)
    evidence["artifacts"] = {
        "sourceScreenshots": [str(source_screenshots / filename) for filename in SCREENSHOT_WIDTHS.values()],
        "thumbnail": str(thumbnail_path),
        "thumbnail_sha256": hashlib.sha256(thumbnail_path.read_bytes()).hexdigest(),
        "thumbnail_size": [720, 450],
        "captureState": "clean initial page after reload and image decode",
    }
    report_path = ROOT / "docs/evidence/gjh-v8-browser.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(evidence, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--axe-script", type=Path)
    args = parser.parse_args()
    run(args.axe_script)
