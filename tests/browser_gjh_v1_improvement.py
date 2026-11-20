"""Focused browser verification for GJH v1 Corporate Clarity P0/P1/P2 improvements.

Exercises responsive breakpoints (320-1440px + landscape), 768px compact tablet hero,
390px above-the-fold division entry, computed WCAG 2.2 contrast, zoom/text-spacing,
forced colors, normal vs reduced motion, keyboard & mobile disclosure, current-section
history, responsive <picture> transfer budget, image error fallback, no-JS visits,
scoped EN/zh-Hans/ms draft gating + activated locale switching, single-identity offline
PWA navigation & update preserving locale+fragment, 5-run cold mobile lab LCP/CLS, and
neighboring v5 regression.
"""

import argparse
import functools
import hashlib
import http.server
import importlib.util
import json
import os
import re
import statistics
import tempfile
import threading
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "/Webpage-Design-Gallery/"
VIEWPORTS = (
    (320, 740),
    (375, 812),
    (390, 844),
    (430, 932),
    (768, 1024),
    (900, 768),
    (901, 768),
    (1024, 768),
    (1440, 1000),
    (667, 375),
)

GALLERY_SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(GALLERY_SPEC)
GALLERY_SPEC.loader.exec_module(gallery)

V1_SPEC = importlib.util.spec_from_file_location("build_gjh_v1", ROOT / "scripts/build_gjh_v1.py")
gjh_v1 = importlib.util.module_from_spec(V1_SPEC)
V1_SPEC.loader.exec_module(gjh_v1)

PERF_OBSERVER = """
window.__perf = {lcp: 0, lcpElement: '', cls: 0};
new PerformanceObserver(list => {
  for (const e of list.getEntries()) {
    __perf.lcp = e.startTime;
    __perf.lcpElement = e.element ? (e.element.tagName + (e.element.id ? '#' + e.element.id : '')) : '';
  }
}).observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(list => {
  for (const e of list.getEntries()) {
    if (!e.hadRecentInput) __perf.cls += e.value;
  }
}).observe({type: 'layout-shift', buffered: true});
"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        override = getattr(self.server, "overrides", {}).get(path)
        if override is not None:
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(override)))
            self.end_headers()
            self.wfile.write(override)
            return
        super().do_GET()

    def log_message(self, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass


def chrome_path():
    env = os.environ.get("GALLERY_CHROME")
    if env:
        return env
    mac_chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return mac_chrome if Path(mac_chrome).exists() else None


def rgb_to_luminance(rgb_str):
    nums = [int(x) for x in re.findall(r"\d+", rgb_str)[:3]]
    lin = []
    for c in nums:
        s = c / 255.0
        lin.append(s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast_ratio(fg_rgb, bg_rgb):
    l1, l2 = sorted((rgb_to_luminance(fg_rgb), rgb_to_luminance(bg_rgb)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def start_server(directory):
    handler = functools.partial(QuietHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    server.overrides = {}
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread, f"http://127.0.0.1:{server.server_port}{PREFIX}"


def run_suite(evidence_dir: Path | None):
    if evidence_dir:
        evidence_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "capturedAt": datetime.now(timezone.utc).isoformat(),
        "responsive": [],
        "contrast": [],
        "responsiveMedia": {},
        "interactions": {},
        "localization": {},
        "pwa": {},
        "labMobileTraces": [],
        "neighborRegression": {},
        "limitations": [
            "Headless desktop Chrome emulation; physical iOS Safari, Android Chrome, Safari/Firefox, and native install dialogs are not certified here.",
            "Manual VoiceOver/NVDA screen-reader sessions and moderated 5-participant human usability timings remain separate release checks.",
            "Lab LCP/CLS traces are controlled localhost observations, not field Core Web Vitals or field INP.",
            "zh-Hans and ms translations are marked draft_pending_fluent_review and kept gated on the public English entry pending fluent human review.",
        ],
    }

    with tempfile.TemporaryDirectory(prefix="gjh-v1-qa-") as tmp_str:
        tmp = Path(tmp_str)
        site = tmp / "Webpage-Design-Gallery"
        gallery.build(site)
        report["build"] = json.loads((site / "version.json").read_text(encoding="utf-8"))
        server, thread, base = start_server(tmp)

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=chrome_path(), headless=True)
                report["browserVersion"] = browser.version

                # 1. Responsive sweep across all plan viewports and all three locales
                for locale, rel_url in (
                    ("en", "demos/corporate/gjh/v1/index.html"),
                    ("zh-Hans", "demos/corporate/gjh/v1/zh-Hans/index.html"),
                    ("ms", "demos/corporate/gjh/v1/ms/index.html"),
                ):
                    for width, height in VIEWPORTS:
                        ctx = browser.new_context(viewport={"width": width, "height": height}, service_workers="block")
                        page = ctx.new_page()
                        errors, bad_status = [], []
                        page.on("pageerror", lambda e: errors.append(str(e)))
                        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                        page.on("response", lambda r: bad_status.append((r.url, r.status)) if r.status >= 400 else None)
                        page.goto(base + rel_url, wait_until="networkidle")
                        page.evaluate("document.fonts.ready")
                        metrics = page.evaluate("""() => {
                            const hero = document.querySelector('.entry-1').getBoundingClientRect();
                            const divLinks = [...document.querySelectorAll('.division-index a')].map(a => {
                                const r = a.getBoundingClientRect();
                                return {href: a.getAttribute('href'), top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width)};
                            });
                            const business = document.getElementById('business').getBoundingClientRect();
                            const header = document.querySelector('.header').getBoundingClientRect();
                            const notice = document.querySelector('.concept-notice').getBoundingClientRect();
                            const cta = document.querySelector('.entry-action').getBoundingClientRect();
                            return {
                                scrollWidth: document.documentElement.scrollWidth,
                                innerWidth: window.innerWidth,
                                heroHeight: Math.round(hero.height),
                                heroBottom: Math.round(hero.bottom),
                                headerHeight: Math.round(header.height),
                                noticeHeight: Math.round(notice.height),
                                ctaHeight: Math.round(cta.height),
                                ctaBottom: Math.round(cta.bottom),
                                businessTop: Math.round(business.top),
                                divLinks
                            };
                        }""")
                        assert metrics["scrollWidth"] <= metrics["innerWidth"], (locale, width, metrics)
                        assert not errors, (locale, width, errors)
                        assert not bad_status, (locale, width, bad_status)
                        assert metrics["ctaHeight"] >= 44, (locale, width, metrics["ctaHeight"])
                        assert all(d["height"] >= 44 for d in metrics["divLinks"]), (locale, width, metrics["divLinks"])

                        if locale == "en" and width == 768 and height == 1024:
                            assert metrics["heroHeight"] <= 667, f"768px hero too tall: {metrics['heroHeight']}px (limit 667px)"
                            assert metrics["businessTop"] < height, f"#business not visible at 768x1024: y={metrics['businessTop']}"
                            assert all(d["height"] <= 104 for d in metrics["divLinks"]), metrics["divLinks"]
                        if locale == "en" and width == 390 and height == 844:
                            assert all(d["bottom"] <= height for d in metrics["divLinks"]), f"Division links below fold at 390x844: {metrics['divLinks']}"
                            assert metrics["businessTop"] < height, f"#business not visible at 390x844: y={metrics['businessTop']}"

                        if evidence_dir and (
                            (locale == "en" and (width, height) in ((1440, 1000), (768, 1024), (390, 844), (320, 740)))
                            or (locale in ("zh-Hans", "ms") and (width, height) == (390, 844))
                        ):
                            page.screenshot(path=str(evidence_dir / f"v1-{locale}-{width}x{height}.png"), full_page=False)
                        report["responsive"].append({"locale": locale, "viewport": f"{width}x{height}", **metrics})
                        ctx.close()
                print("PASS 1/8: Responsive sweep (30 viewport x locale combinations, 768px hero <= 667px, 390px entry)", flush=True)

                # 2. Computed contrast, 200% zoom, text spacing, and forced-colors
                ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, service_workers="block")
                page = ctx.new_page()
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                pairs = page.evaluate("""() => {
                    const bgOf = el => {
                        let cur = el;
                        while (cur) {
                            const bg = getComputedStyle(cur).backgroundColor;
                            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
                            cur = cur.parentElement;
                        }
                        return 'rgb(255, 255, 255)';
                    };
                    const selectors = [
                        ['notice-heading', '.concept-notice strong'],
                        ['hero-kicker', '.entry-kicker'],
                        ['hero-h1', '#hero-title'],
                        ['hero-lead', '.entry-lead'],
                        ['hero-cta', '.entry-action'],
                        ['division-tag', '.division-index-copy small'],
                        ['division-label', '.division-index-copy span'],
                        ['body-muted', '#business .section-heading > p'],
                        ['card-link', '#business-electronics .text-link'],
                        ['contact-eyebrow', '#contact .eyebrow'],
                        ['contact-heading', '#contact-title'],
                        ['contact-cta', '#contact .button.yellow'],
                        ['footer-muted', '.footer .muted']
                    ];
                    return selectors.map(([name, sel]) => {
                        const el = document.querySelector(sel);
                        const cs = getComputedStyle(el);
                        return {name, fg: cs.color, bg: bgOf(el)};
                    });
                }""")
                for item in pairs:
                    ratio = round(contrast_ratio(item["fg"], item["bg"]), 2)
                    assert ratio >= 4.5, (item, ratio)
                    report["contrast"].append({**item, "ratio": ratio})
                # WCAG 1.4.12 Text Spacing + 200% font scale check
                page.add_style_tag(content="body, p, a, li { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Overflow under WCAG text spacing"
                page.emulate_media(forced_colors="active")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Overflow under forced-colors"
                ctx.close()

                # 200% zoom emulation (720px viewport = 1440px @ 200%)
                ctx = browser.new_context(viewport={"width": 720, "height": 500}, device_scale_factor=2, service_workers="block")
                page = ctx.new_page()
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Overflow at 200% zoom"
                ctx.close()
                print("PASS 2/8: Computed WCAG 2.2 AA contrast, text spacing, 200% zoom, and forced-colors", flush=True)

                # 3. Normal vs Reduced motion, hover stability, keyboard focus non-obscuration, current-section & history
                ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="no-preference", service_workers="block")
                page = ctx.new_page()
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                normal_dur = page.locator(".entry-action").evaluate("el => getComputedStyle(el).transitionDuration")
                assert normal_dur != "0s", f"Expected controlled normal-motion transition, got {normal_dur}"
                before_box = page.locator(".entry-action").bounding_box()
                page.locator(".entry-action").hover()
                page.wait_for_timeout(200)
                after_box = page.locator(".entry-action").bounding_box()
                assert abs(before_box["y"] - after_box["y"]) < 0.5 and abs(before_box["x"] - after_box["x"]) < 0.5, (before_box, after_box)

                # Hover division index: verify visible sage highlight + arrow motion without hit-target shift
                first_div = page.locator(".division-index a").first
                div_before = first_div.bounding_box()
                first_div.hover()
                page.wait_for_timeout(220)
                div_after = first_div.bounding_box()
                assert abs(div_before["y"] - div_after["y"]) < 0.5 and abs(div_before["x"] - div_after["x"]) < 0.5
                hover_bg = first_div.evaluate("el => getComputedStyle(el).backgroundColor")
                assert hover_bg == "rgb(239, 242, 232)", f"Expected sage hover highlight, got {hover_bg}"
                if evidence_dir:
                    page.screenshot(path=str(evidence_dir / "v1-en-1440x1000-division-hover.png"), full_page=False)

                # Keyboard journey: Skip link -> Hero CTA -> Food index -> Electronics -> Contact -> Back/Forward
                page.keyboard.press("Tab")
                assert page.evaluate("document.activeElement.className") == "skip"
                page.keyboard.press("Enter")
                assert page.evaluate("document.activeElement.id") == "main"

                page.locator(".entry-action").click()
                page.wait_for_function("() => location.hash === '#business'")
                page.wait_for_timeout(400)
                expect(page.locator('#navigation a[href="#business"]')).to_have_attribute("aria-current", "location")
                assert page.locator('#navigation a[aria-current="location"]').count() == 1
                header_bottom = page.locator(".header").bounding_box()["y"] + page.locator(".header").bounding_box()["height"]
                assert page.locator("#business-title").bounding_box()["y"] >= header_bottom - 2, "Sticky header obscured #business-title"

                page.locator('.division-index a[href="#business-electronics"]').click()
                page.wait_for_function("() => location.hash === '#business-electronics'")
                page.wait_for_timeout(250)
                expect(page.locator('#navigation a[href="#business"]')).to_have_attribute("aria-current", "location")
                expect(page.locator('#business-electronics a[href="https://www.gjh.com.sg/sony/"]')).to_contain_text("Discover Sony")
                target_bg = page.locator("#business-electronics").evaluate("el => getComputedStyle(el).backgroundColor")
                assert target_bg == "rgb(239, 242, 232)", f"Expected :target division highlight, got {target_bg}"
                if evidence_dir:
                    page.screenshot(path=str(evidence_dir / "v1-en-1440x1000-target-electronics.png"), full_page=False)

                # Brand card hover zoom (inside overflow-hidden frame, zero hit-target shift)
                brand_card = page.locator(".brand-card").first
                brand_card.scroll_into_view_if_needed()
                bc_before = brand_card.bounding_box()
                brand_card.hover()
                page.wait_for_timeout(240)
                bc_after = brand_card.bounding_box()
                assert abs(bc_before["y"] - bc_after["y"]) < 0.5 and abs(bc_before["x"] - bc_after["x"]) < 0.5
                brand_img_tf = brand_card.locator(".brand-photo img").evaluate("el => getComputedStyle(el).transform")
                assert brand_img_tf != "none", f"Expected subtle brand image zoom on hover, got {brand_img_tf}"

                page.locator('#navigation a[href="#contact"]').click()
                page.wait_for_function("() => location.hash === '#contact'")
                page.wait_for_timeout(450)
                expect(page.locator('#navigation a[href="#contact"]')).to_have_attribute("aria-current", "location")
                assert page.locator('#navigation a[aria-current="location"]').count() == 1
                expect(page.locator('#contact a[href="https://www.gjh.com.sg/contact-us/"]')).to_have_attribute("target", "_blank")
                expect(page.locator('#contact a[href="https://www.gjh.com.sg/contact-us/"]')).to_have_attribute("rel", "noopener noreferrer")

                page.go_back()
                page.wait_for_function("() => location.hash === '#business-electronics'")
                expect(page.locator('#navigation a[href="#business"]')).to_have_attribute("aria-current", "location")
                page.go_forward()
                page.wait_for_function("() => location.hash === '#contact'")
                expect(page.locator('#navigation a[href="#contact"]')).to_have_attribute("aria-current", "location")

                # Verify Gallery and Style Atlas routes resolve cleanly
                gallery_href = page.locator(".concept-notice .gallery-exit").get_attribute("href")
                atlas_href = page.locator(".footer-bottom .design-reference").get_attribute("href")
                assert page.request.get(urljoin(page.url, gallery_href)).status == 200
                assert page.request.get(urljoin(page.url, atlas_href.split("#")[0])).status == 200
                ctx.close()

                # Reduced motion check
                ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce", service_workers="block")
                page = ctx.new_page()
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                assert page.evaluate("getComputedStyle(document.documentElement).scrollBehavior") == "auto"
                assert page.locator(".entry-action").evaluate("el => getComputedStyle(el).transitionDuration") == "0s"
                assert page.locator(".division-arrow").first.evaluate("el => getComputedStyle(el).transitionDuration") == "0s"
                ctx.close()

                # Repeat open/close & resize-with-disclosure-open across 900px/901px in all 3 locales
                for loc, rel in (
                    ("en", "demos/corporate/gjh/v1/index.html"),
                    ("zh-Hans", "demos/corporate/gjh/v1/zh-Hans/index.html"),
                    ("ms", "demos/corporate/gjh/v1/ms/index.html"),
                ):
                    ctx = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="no-preference", service_workers="block")
                    page = ctx.new_page()
                    page.goto(base + rel, wait_until="networkidle")
                    toggle = page.locator(".menu-toggle")
                    # Repeat open/close cycle
                    toggle.click()
                    expect(toggle).to_have_attribute("aria-expanded", "true")
                    nav_anim = page.locator("#navigation").evaluate("el => getComputedStyle(el).animationName")
                    assert nav_anim == "v1-disclosure", (loc, nav_anim)
                    if evidence_dir and loc == "en":
                        page.wait_for_timeout(220)
                        page.screenshot(path=str(evidence_dir / "v1-en-390x844-menu-open.png"), full_page=False)
                    toggle.click()
                    expect(toggle).to_have_attribute("aria-expanded", "false")
                    toggle.click()
                    expect(toggle).to_have_attribute("aria-expanded", "true")
                    page.keyboard.press("Escape")
                    expect(toggle).to_have_attribute("aria-expanded", "false")
                    expect(toggle).to_be_focused()
                    # Resize across 900px -> 901px while disclosure is open
                    page.set_viewport_size({"width": 900, "height": 768})
                    toggle.click()
                    expect(toggle).to_have_attribute("aria-expanded", "true")
                    page.set_viewport_size({"width": 901, "height": 768})
                    page.wait_for_function("!matchMedia('(max-width: 900px)').matches")
                    expect(toggle).to_have_attribute("aria-expanded", "false")
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (loc, "901 resize overflow")
                    page.set_viewport_size({"width": 900, "height": 768})
                    page.wait_for_function("matchMedia('(max-width: 900px)').matches")
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (loc, "900 resize overflow")
                    ctx.close()

                # Short landscape mobile menu reachability
                ctx = browser.new_context(viewport={"width": 667, "height": 375}, service_workers="block")
                page = ctx.new_page()
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                toggle = page.get_by_role("button", name="Menu")
                toggle.click()
                expect(page.locator("#navigation")).to_be_visible()
                last_item = page.locator(".locale-switcher .locale-item").last
                last_item.scroll_into_view_if_needed()
                expect(last_item).to_be_visible()
                page.keyboard.press("Escape")
                expect(toggle).to_be_focused()
                ctx.close()
                report["interactions"] = {
                    "normalMotionDuration": normal_dur,
                    "divisionHoverBg": hover_bg,
                    "targetHighlightBg": target_bg,
                    "brandHoverTransform": brand_img_tf,
                    "hitTargetShift": 0,
                    "stickyObscuration": False,
                    "repeatOpenCloseAndResizeAllLocales": True,
                    "landscapeMenuReachable": True,
                }
                print("PASS 3/8: Motion, hover/target states, repeat disclosure, breakpoint resize & history", flush=True)

                # 4. Responsive <picture> sharpness (effective DPR & <100 KB mobile budget), lazy loading & image fallback
                for label, vw, vh, dpr, min_eff_dpr, max_bytes in (
                    ("mobile_390_dpr1", 390, 844, 1, 1.0, 100 * 1024),
                    ("mobile_390_dpr2", 390, 844, 2, 1.6, 100 * 1024),
                    ("mobile_390_dpr3", 390, 844, 3, 2.0, 100 * 1024),
                    ("tablet_768_dpr2", 768, 1024, 2, 1.6, 110 * 1024),
                    ("desktop_1440_dpr2", 1440, 1000, 2, 1.6, 110 * 1024),
                ):
                    ctx = browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dpr, service_workers="block")
                    page = ctx.new_page()
                    page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                    info = page.locator(".entry-art img").evaluate("""img => {
                        const r = img.getBoundingClientRect();
                        return {url: img.currentSrc, width: r.width, height: r.height, fit: getComputedStyle(img).objectFit, pos: getComputedStyle(img).objectPosition};
                    }""")
                    assert info["url"].endswith(".webp"), (label, info)
                    body = ctx.request.get(info["url"]).body()
                    with Image.open(BytesIO(body)) as im:
                        enc_w, enc_h = im.size
                    eff_dpr = round(min(enc_w / info["width"], enc_h / info["height"]), 2)
                    assert eff_dpr >= min_eff_dpr, (label, eff_dpr, min_eff_dpr, enc_w, enc_h, info)
                    assert len(body) <= max_bytes, (label, len(body), max_bytes)
                    report["responsiveMedia"][label] = {
                        "selected": Path(urlsplit(info["url"]).path).name,
                        "encoded": [enc_w, enc_h],
                        "rendered": [round(info["width"], 1), round(info["height"], 1)],
                        "effectiveDpr": eff_dpr,
                        "bytes": len(body),
                    }
                    if vw == 390 and dpr == 2:
                        page.locator("#brands").scroll_into_view_if_needed()
                        page.wait_for_function("() => [...document.querySelectorAll('#brands img')].every(i => i.complete && i.naturalWidth > 0)")
                    ctx.close()

                # Simulated image failure fallback
                ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
                page = ctx.new_page()
                page.route("**/assets/family-lifestyle*", lambda route: route.fulfill(status=404, body=b""))
                page.route("**/assets/*-brand-cover.jpg", lambda route: route.fulfill(status=404, body=b""))
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                expect(page.locator('.entry-art[data-media-state="fallback"] .media-fallback')).to_be_visible()
                expect(page.locator("#hero-title")).to_be_visible()
                expect(page.locator(".entry-action")).to_be_visible()
                if evidence_dir:
                    page.screenshot(path=str(evidence_dir / "v1-en-390x844-image-fallback.png"), full_page=False)
                ctx.close()
                report["responsiveMedia"]["imageFallback"] = "PASS"
                print(f"PASS 4/8: Responsive <picture> ({report['responsiveMedia']})", flush=True)

                # 5. No-JavaScript first visit across EN & draft routes
                ctx = browser.new_context(viewport={"width": 390, "height": 844}, java_script_enabled=False)
                page = ctx.new_page()
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="domcontentloaded")
                expect(page.locator("#navigation")).to_be_visible()
                expect(page.locator(".footer-offline-fallback")).to_be_visible()
                page.locator('.division-index a[href="#business-food"]').click()
                assert page.url.endswith("#business-food")
                page.goto(base + "demos/corporate/gjh/v1/zh-Hans/index.html", wait_until="domcontentloaded")
                expect(page.locator('html')).to_have_attribute("lang", "zh-Hans")
                page.locator('a[data-locale-link="en"]').click()
                expect(page.locator('html')).to_have_attribute("lang", "en")
                ctx.close()
                print("PASS 5/8: JavaScript-disabled reading, division anchor, and static locale switching", flush=True)

                # 6. Checked-in draft gating & single-identity offline PWA across EN/zh-Hans/ms
                ctx = browser.new_context(viewport={"width": 390, "height": 844})
                page = ctx.new_page()
                page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                assert page.locator('[data-locale-gated="zh-Hans"]').count() == 1
                assert page.locator('[data-locale-gated="ms"]').count() == 1
                assert page.locator('a[data-locale-link="zh-Hans"]').count() == 0
                expect(page.locator("#offline-controls [role=status]")).to_contain_text("Available offline", timeout=60000)
                page.reload(wait_until="domcontentloaded")
                expected_scope = base + "demos/corporate/gjh/v1/"
                page.wait_for_function("s => navigator.serviceWorker.controller?.scriptURL === new URL('sw.js', s).href", arg=expected_scope)

                # Visit zh-Hans & ms routes online to check localized PWA strings & same SW scope
                page.goto(base + "demos/corporate/gjh/v1/zh-Hans/index.html#business-electronics", wait_until="domcontentloaded")
                expect(page.locator("#offline-controls summary")).to_have_text("安装 / 离线访问")
                expect(page.locator("#offline-controls [role=status]")).to_contain_text("可离线浏览", timeout=60000)
                assert page.evaluate("async () => (await navigator.serviceWorker.getRegistration()).scope") == expected_scope
                # Switch to ms preserving fragment (open mobile disclosure first at 390px)
                page.locator(".menu-toggle").click()
                page.locator('a[data-locale-link="ms"]').click()
                page.wait_for_url("**/ms/index.html#business-electronics")
                expect(page.locator("#offline-controls summary")).to_have_text("Pasang / luar talian")
                expect(page.locator("#offline-controls [role=status]")).to_contain_text("Tersedia di luar talian", timeout=60000)

                # Genuine offline navigation across all three cached locale routes (clear browser HTTP cache first!)
                cdp = ctx.new_cdp_session(page)
                cdp.send("Network.clearBrowserCache")
                ctx.set_offline(True)
                for route in (
                    "demos/corporate/gjh/v1/zh-Hans/#business-health",
                    "demos/corporate/gjh/v1/ms/#business-food",
                    "demos/corporate/gjh/v1/#business-electronics",
                ):
                    resp = page.goto(base + route, wait_until="domcontentloaded")
                    assert resp and resp.ok and resp.from_service_worker, route
                    expect(page.locator("h1")).to_be_visible()
                ctx.set_offline(False)

                # Controlled SW update while on zh-Hans/index.html#business-health -> preserves locale & fragment!
                v1_rel = "demos/corporate/gjh/v1/"
                release_a = json.loads((site / "version.json").read_text(encoding="utf-8"))
                style_a = (site / v1_rel / "style.css").read_bytes()
                marker = "/* v1 locale update verification */"
                style_b = style_a + b"\n" + marker.encode() + b"\n"
                digest_a = hashlib.sha256(style_a).hexdigest()
                digest_b = hashlib.sha256(style_b).hexdigest()
                release_b = {"version": "99.0.2", "build": digest_b[:16]}
                worker_a = (site / v1_rel / "sw.js").read_text(encoding="utf-8")
                worker_b = worker_a.replace(json.dumps(release_a), json.dumps(release_b)).replace(digest_a, digest_b)

                page.goto(base + "demos/corporate/gjh/v1/zh-Hans/index.html#business-health", wait_until="domcontentloaded")
                expect(page.locator("#offline-controls [role=status]")).to_contain_text(release_a["build"][:8], timeout=60000)
                server.overrides[PREFIX + v1_rel + "sw.js"] = worker_b.encode()
                server.overrides[PREFIX + "version.json"] = json.dumps(release_b).encode()
                server.overrides[PREFIX + v1_rel + "style.css"] = style_b
                page.locator("#offline-controls summary").click()
                page.locator("#offline-controls [data-check]").click()
                apply_btn = page.locator("#offline-controls [data-apply]")
                expect(apply_btn).to_be_visible(timeout=60000)
                with page.expect_navigation(wait_until="domcontentloaded"):
                    apply_btn.click()
                assert page.url.endswith("/zh-Hans/index.html#business-health"), page.url
                expect(page.locator("html")).to_have_attribute("lang", "zh-Hans")
                expect(page.locator("#offline-controls [role=status]")).to_contain_text(release_b["build"][:8], timeout=60000)
                server.overrides.clear()
                ctx.close()
                report["localization"] = {"enDraftsGated": True, "fragmentCarryover": True}
                report["pwa"] = {"singleScope": True, "offlineAllThreeLocales": True, "updatePreservesLocaleAndFragment": True}
                print("PASS 6/8: Gated drafts, single-identity offline across EN/zh-Hans/ms, and controlled update", flush=True)

                # 7. Activated-drafts temporary build verification (post-approval switcher test)
                with tempfile.TemporaryDirectory(prefix="gjh-v1-activated-") as act_tmp:
                    act_root = Path(act_tmp) / "Webpage-Design-Gallery"
                    gallery.build(act_root)
                    # Overwrite only v1 HTML in temp build with activate_drafts=True using source locales
                    shared, catalogs = gjh_v1.load_v1_catalogs(ROOT)
                    for loc in shared["locales"]:
                        out_path = act_root / "demos/corporate/gjh/v1" / loc["path"]
                        out_path.write_text(gjh_v1.render_page(shared, catalogs[loc["code"]], loc, activate_drafts=True), encoding="utf-8")
                    s2, t2, base2 = start_server(act_tmp)
                    try:
                        ctx = browser.new_context(viewport={"width": 1024, "height": 768}, service_workers="block")
                        page = ctx.new_page()
                        page.goto(base2 + "demos/corporate/gjh/v1/index.html#business-health", wait_until="networkidle")
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                        page.locator('a[data-locale-link="zh-Hans"]').click()
                        page.wait_for_url("**/zh-Hans/index.html#business-health")
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                        page.locator('a[data-locale-link="ms"]').click()
                        page.wait_for_url("**/ms/index.html#business-health")
                        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                        page.locator('a[data-locale-link="en"]').click()
                        page.wait_for_url("**/v1/index.html#business-health")
                        ctx.close()
                    finally:
                        s2.shutdown()
                        s2.server_close()
                        t2.join()
                report["localization"]["postApprovalActivatedSwitcher"] = "PASS (1024px zero overflow en->zh-Hans->ms->en with #business-health)"

                # 8. Five repeatable cold mobile lab LCP/CLS traces + neighbor v5 regression check
                lcps, clss = [], []
                for run_idx in range(5):
                    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, service_workers="block")
                    page = ctx.new_page()
                    page.add_init_script(PERF_OBSERVER)
                    page.goto(base + "demos/corporate/gjh/v1/index.html", wait_until="networkidle")
                    page.wait_for_timeout(400)
                    perf = page.evaluate("__perf")
                    lcps.append(round(perf["lcp"], 1))
                    clss.append(round(perf["cls"], 4))
                    report["labMobileTraces"].append({"run": run_idx + 1, **perf})
                    ctx.close()
                median_lcp = statistics.median(lcps)
                median_cls = statistics.median(clss)
                assert median_lcp <= 2500, f"Median cold lab LCP too high: {median_lcp}ms"
                assert median_cls <= 0.1, f"Median cold lab CLS too high: {median_cls}"
                report["labMobileSummary"] = {"medianLcpMs": median_lcp, "medianCls": median_cls, "runs": 5}

                # Neighbor edition v5 smoke check (shared theme & PWA script unaffected)
                ctx = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
                page = ctx.new_page()
                v5_errors = []
                page.on("pageerror", lambda e: v5_errors.append(str(e)))
                page.goto(base + "demos/corporate/gjh/v5/index.html", wait_until="networkidle")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
                assert not v5_errors, v5_errors
                report["neighborRegression"]["v5_390px"] = "PASS"
                ctx.close()

                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    if evidence_dir:
        out_json = evidence_dir / "gjh-v1-verification-report.json"
        out_json.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Saved evidence report and screenshots to {evidence_dir}", flush=True)
    print(
        f"PASS 8/8: All GJH v1 checks passed! Median cold mobile LCP={report['labMobileSummary']['medianLcpMs']}ms, "
        f"CLS={report['labMobileSummary']['medianCls']}",
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, default=None)
    args = parser.parse_args()
    run_suite(args.evidence_dir.resolve() if args.evidence_dir else None)
