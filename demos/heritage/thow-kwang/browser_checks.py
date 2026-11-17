"""Check the pottery guides in Chrome. Run from the repository root after building."""
import argparse
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import threading

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[3]
COMPANY = Path("demos/heritage/thow-kwang")
SIZES = ((320, 800), (390, 844), (768, 1024), (1440, 900))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


async def check_actions(page, version):
    if version == 1:
        for part in ("chamber", "chimney", "firebox"):
            pin = page.locator(f'[data-zone="{part}"]')
            await pin.focus()
            await pin.press("Enter")
            await page.wait_for_function(
                """k => document.getElementById(k).open
                && document.querySelector('[data-kiln]').dataset.selected === k""",
                arg=part,
            )
        assert await page.locator('#visit a[href^="https:"]').count() == 4
    elif version in (4, 9):
        await page.locator(".checks input").first.check()
        assert (await page.locator("[data-progress]").inner_text()).startswith("1 of")
    elif version == 11:
        search = page.locator("input[type=search]")
        for query, expected in (("chimney", 1), ("qwerty", 0), ("", 8)):
            await search.fill(query)
            assert await page.locator("[data-term]:visible").count() == expected
    elif version == 13:
        async with page.expect_download() as download:
            await page.get_by_text("Download sketch sheet").click()
        assert (await download.value).suggested_filename == "pottery-observation-sheet.svg"


async def verify(base, capture):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", executable_path=os.environ.get("GALLERY_CHROME"))
        context = await browser.new_context(service_workers="block", reduced_motion="reduce")
        no_script = await browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
        page, plain = await context.new_page(), await no_script.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("response", lambda response: errors.append(f"{response.status} {response.url}") if response.status >= 400 else None)
        for version in range(1, 16):
            folder = ROOT / COMPANY / f"v{version}"
            url = f"{base}/{COMPANY.as_posix()}/v{version}/"
            await page.goto(url)
            await page.evaluate("document.fonts.ready")
            for width, height in SIZES:
                await page.set_viewport_size({"width": width, "height": height})
                await page.evaluate("window.scrollTo(0,0)")
                issues = await page.evaluate("""() => ({
                    overflow: document.documentElement.scrollWidth > innerWidth,
                    missingImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
                    brokenFragments: [...document.querySelectorAll('a[href^="#"]')].filter(a =>
                        !document.getElementById(a.hash.slice(1))).map(a => a.hash)
                })""")
                assert not any(issues.values()), (version, width, issues)
                if capture and width != 320:
                    await page.screenshot(path=folder / "screenshots" / f"{width}.png")
            await page.set_viewport_size({"width": 390, "height": 844})
            await check_actions(page, version)
            if capture:
                from PIL import Image
                with Image.open(folder / "screenshots/1440.png") as image:
                    preview = image.resize((720, 450), Image.Resampling.LANCZOS)
                    preview.convert("RGB").save(folder / "assets/thumbnail.webp", quality=87, method=5)
            await plain.goto(url)
            assert await plain.locator("h1").is_visible()
            assert await plain.locator('a[href^="https:"]:visible').count() >= 2
            if version == 1:
                for part in ("chamber", "chimney", "firebox"):
                    await plain.locator(f"#{part} summary").press("Enter")
                    assert await plain.locator(f"#{part}").get_attribute("open") is not None
            assert not errors, (version, errors)
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="Refresh viewport screenshots and thumbnails.")
    args = parser.parse_args()
    handler = partial(QuietHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(verify(f"http://127.0.0.1:{server.server_port}", args.capture))
            print("PASS: 15 guides at four widths; keyboard diagram, checklists, search, download and no-script reading.")
        finally:
            server.shutdown()
