"""Check language changes in the upper-deck brand plaques through the visitor controls."""
import argparse
from contextlib import suppress
import functools
import hashlib
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

from browser_gjh_guide import Quiet
from browser_gjh_mili_catalogue import activate, language
from browser_gjh_newmoon_pickup_bag import click
from mall_browser_probe import enter, launch
from verify_mall_support import face, probe_url, walk

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demos/corporate/gjh/v11"
SCREENS = {390: (844, "low"), 768: (1024, "balanced"), 1440: (900, "detailed")}
COPY_FILES = (
    "pwa.js", "assets/world.bundle.js", "assets/brand-wall.js", "assets/mall-language.js",
    "assets/brand-plaque-copy.js", "assets/brand-kit/brand-kit.json",
)
LEGAL = {
    "en": "Independent, unofficial concept.",
    "zh-Hans": "独立非官方设计",
    "ms": "Konsep bebas dan tidak rasmi.",
}


def choose_plaque(page, identifier):
    point = page.evaluate("id => __mall.testUpperPoints().find(point => point.id === id)", identifier)
    walk(page, point["x"], point["z"])
    face(page, point["x"], 15.78)
    for _ in range(16):
        if page.evaluate("__mall.state.nearby") == identifier:
            return
        page.locator("#scene").focus()
        page.keyboard.press("]")
    raise AssertionError(f"Could not select {identifier}")


def check_copy(page, record, code):
    expect(page.locator("html")).to_have_attribute("lang", code)
    english_title = record["brand"] + " · " + record["tagline"]
    title = page.locator("#product-title")
    body = page.locator("#product-description")
    kind = page.locator("#product-kind")
    logo = page.locator("#product-image")
    if code == "en":
        expect(title).to_have_text(english_title)
        expect(body).to_have_text(record["story"])
        expect(kind).to_have_text("Brand plaque · independent virtual mall concept")
        expect(logo).to_have_attribute("alt", record["brand"] + " logo")
    else:
        expect(title).not_to_have_text(english_title)
        expect(body).not_to_have_text(record["story"])
        expect(title).to_contain_text(record["brand"] + " · ")
        expect(kind).to_have_text("品牌铭牌 · 独立虚拟商场概念展示" if code == "zh-Hans"
                                  else "Plak jenama · konsep pusat beli-belah maya bebas")
        expect(logo).to_have_attribute("alt", record["brand"] + " 标志" if code == "zh-Hans"
                                      else "Logo " + record["brand"])
    if record["slot"] == "S13":
        expect(body).to_contain_text("MDR-E9LP")
        expect(body).to_contain_text("GJH")
    expect(page.locator("#product-dialog")).to_contain_text(LEGAL[code])
    expect(page.locator("#nearby-name")).to_have_text(title.inner_text())
    expect(page.locator(".brand-story-nearby")).to_have_text(body.inner_text())
    return {
        "title": title.inner_text(), "kind": kind.inner_text(),
        "story": body.inner_text(), "alt": logo.get_attribute("alt"),
        "action": page.locator("#inspect").get_attribute("aria-label"),
    }


def run(base, width, out):
    height, tier = SCREENS[width]
    touch = width < 1000
    records = json.loads((DEMO / "assets/brand-kit/brand-kit.json").read_text())
    with sync_playwright() as playwright, launch(playwright) as browser:
        with browser.new_context(viewport={"width": width, "height": height}, has_touch=touch,
                                 device_scale_factor=2 if touch else 1,
                                 service_workers="block", locale="en-SG") as context:
            errors = []
            context.on("page", lambda p: p.on("pageerror", lambda err: errors.append(str(err))))
            responses = {}
            prefix = urlsplit(base).path

            def remember(response):
                path = urlsplit(response.url).path.removeprefix(prefix)
                if response.status == 200 and path in COPY_FILES:
                    responses[path] = response

            context.on("response", remember)
            mall = enter(context, probe_url(base), tier)
            preferences = context.new_page()
            preferences.goto(base + "#store-list", wait_until="domcontentloaded")
            preferences.locator(".mall-app-settings > summary").click()
            picker = preferences.locator("#directory-language")
            expect(picker).to_be_visible()
            try:
                mall.bring_to_front()
                requested_before_lift = "assets/brand-plaque-copy.js" in responses
                assert not requested_before_lift, "Upper-floor translations were requested on the ground floor"
                click(mall, "#header-map", touch)
                mall.locator("#map-destination").select_option("floor-upper")
                activate(mall, mall.get_by_role("button", name="Ride lift", exact=True), touch)
                mall.wait_for_function("""() => __mall.state.zone === 'upper' &&
                    !__mall.state.elevatorTravel && __mall.testUpperPoints().length === 20""", timeout=90000)
                walk(mall, -8.18, 10)
                walk(mall, -8.18, 14.67)
                seen = {}
                for slot in ("S13", "S04"):
                    record = records[slot]
                    choose_plaque(mall, "brand-plaque-" + slot)
                    if not seen:
                        language(mall, "zh-Hans", touch)
                    else:
                        previous = seen["S13"]["zh-Hans"]
                        expect(mall.locator("#nearby-name")).not_to_have_text(previous["title"])
                        expect(mall.locator(".brand-story-nearby")).not_to_have_text(previous["story"])
                    expect(mall.locator("#nearby-name")).to_contain_text(record["brand"] + " · ")
                    expect(mall.locator(".brand-story-nearby")).not_to_have_text(record["story"])
                    expect(mall.locator("#inspect")).to_have_attribute("aria-label", f"阅读 {record['brand']} 品牌故事")
                    click(mall, "#inspect", touch)
                    expect(mall.locator("#product-dialog")).to_be_visible()
                    seen[slot] = {"zh-Hans": check_copy(mall, record, "zh-Hans")}
                    for code in ("ms", "en", "zh-Hans"):
                        picker.select_option(code)
                        row = check_copy(mall, record, code)
                        if code in seen[slot]:
                            assert row == seen[slot][code]
                        seen[slot][code] = row
                        if out:
                            mall.screenshot(path=str(out / f"{slot}-{code}.png"), scale="css")
                    click(mall, "#product-close", touch)
                    expect(mall.locator("#product-dialog")).to_be_hidden()
                    expect(mall.locator("#nearby-name")).to_have_text(seen[slot]["zh-Hans"]["title"])
                    expect(mall.locator(".brand-story-nearby")).to_have_text(seen[slot]["zh-Hans"]["story"])
                language(mall, "en", touch)
                expect(mall.locator("#nearby-name")).to_have_text(seen["S04"]["en"]["title"])
                expect(mall.locator(".brand-story-nearby")).to_have_text(seen["S04"]["en"]["story"])
                assert not errors, errors
                hashes = {}
                for path in COPY_FILES:
                    expected = hashlib.sha256((DEMO / path).read_bytes()).hexdigest()
                    digest = hashlib.sha256(responses[path].body()).hexdigest()
                    assert digest == expected, path
                    hashes[path] = digest
                return {"browser": browser.version, "width": width, "height": height, "tier": tier,
                        "upperCopyRequestedBeforeLift": requested_before_lift, "servedSha256": hashes,
                        "records": seen, "pageErrors": errors}
            except Exception:
                if out:
                    with suppress(Exception):
                        mall.screenshot(path=str(out / "failure.png"), timeout=5000, scale="css")
                raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--width", type=int, choices=SCREENS, default=390)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
    with ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT))) as http:
        threading.Thread(target=http.serve_forever, daemon=True).start()
        try:
            result = run(f"http://127.0.0.1:{http.server_port}/demos/corporate/gjh/v11/", args.width, args.out)
        finally:
            http.shutdown()
    if args.out:
        (args.out / "receipt.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print("Upper brand plaques passed same-tab and cross-tab language changes.")
