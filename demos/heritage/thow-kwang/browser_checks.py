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
            assert await page.locator("[data-kiln-caption] strong").inner_text() == await page.locator(f"#{part} summary").inner_text()
            assert await page.locator(".kiln-drawing").evaluate("el => el.getBoundingClientRect().bottom > 0")
        assert await page.locator('#visit a[href^="https:"]').count() == 4
    elif version == 2:
        await page.locator("#routes summary").nth(1).press("Enter")
        assert "15 participants" in await page.locator("#routes details[open]").inner_text()
    elif version == 3:
        await page.locator(".technique-pair a").nth(1).press("Enter")
        assert page.url.endswith("#hand-building")
        assert await page.locator("#hand-building a").get_attribute("href") == "https://www.potteryjungle.com/pottery-workshop"
    elif version in (4, 9):
        await page.locator(".checks input").first.check()
        assert (await page.locator("[data-progress]").inner_text()).startswith("1 of")
        if version == 4:
            await page.locator(".answer-key summary").press("Enter")
            assert "another source" in await page.locator(".answer-key[open] div").inner_text()
        else:
            for number, text in (("14", "self-guided"), ("15", "meets the tour minimum"), ("0", "whole number"), ("", "")):
                await page.locator("#party-size").fill(number)
                message = await page.locator("output").inner_text()
                assert (text in message) if text else (message == "")
    elif version == 5:
        await page.locator(".gesture-sequence summary").nth(2).press("Enter")
        assert "raises the wall" in await page.locator("#sequence details[open] div").inner_text()
    elif version == 6:
        await page.locator(".fired-sample").press("Enter")
        assert page.url.endswith("#surface")
        assert await page.locator("#surface h3").inner_text() == "Evidence"
    elif version == 7:
        await page.locator("#glaze-close").press("Space")
        assert await page.locator(".sample-window img").evaluate("el => getComputedStyle(el).transform !== 'none'")
        await page.locator("#glaze-close").press("Space")
        assert await page.locator(".sample-window img").evaluate("el => getComputedStyle(el).transform === 'none'")
    elif version == 8:
        first = await page.locator("[data-clue-title]").inner_text()
        for title in ("Something with a shadow", "Something made for a job", first):
            await page.locator("[data-next-clue]").press("Enter")
            assert await page.locator("[data-clue-title]").inner_text() == title
    elif version == 10:
        await page.locator(".archive-years a").nth(2).press("Enter")
        assert page.url.endswith("#archive-2020")
        assert "nhb.gov.sg" in await page.locator("#archive-2020 a").get_attribute("href")
    elif version == 11:
        search = page.locator("input[type=search]")
        for query, expected in (("chimney", 1), ("qwerty", 0), ("", 8)):
            await search.fill(query)
            assert await page.locator("[data-term]:visible").count() == expected
        await search.fill("no match")
        await page.locator('.letter-index [href="#term-glaze"]').press("Enter")
        assert await search.input_value() == ""
        assert await page.locator("#term-glaze").get_attribute("open") is not None
    elif version == 12:
        await page.locator("#show-contours").press("Space")
        assert await page.locator(".contour:visible").count() == 3
        assert await page.locator(".contour-label:visible").all_inner_texts() == ["Wide rim", "Curved shoulder", "Flared side"]
    elif version == 13:
        async with page.expect_download() as download:
            await page.get_by_text("Download sketch sheet").click()
        assert (await download.value).suggested_filename == "pottery-observation-sheet.svg"
        await page.locator(".note-paper summary").press("Enter")
        assert await page.locator("[data-save-note]").is_disabled()
        await page.locator("#field-note").fill("A flared rim above a narrow foot.")
        async with page.expect_download() as note:
            await page.locator("[data-save-note]").press("Enter")
        result = await note.value
        assert result.suggested_filename == "pottery-field-note.txt"
        assert "A flared rim above a narrow foot." in (await result.path()).read_text()
    elif version == 14:
        await page.locator('.walk-strip [href="#stop-kiln"]').press("Enter")
        assert page.url.endswith("#stop-kiln")
        assert await page.locator("#stop-kiln .mini").get_attribute("href") == "../v1/index.html#structure"
    elif version == 15:
        for intent in ("make", "read", "visit", "all"):
            await page.locator(f'[data-intent="{intent}"]').press("Enter")
            visible = page.locator(".department:visible")
            assert await visible.count() == (6 if intent == "all" else 2)
            if intent != "all":
                assert await visible.evaluate_all("(items) => items.map(i => i.dataset.topic)") == [intent, intent]


async def verify(base, capture):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", executable_path=os.environ.get("GALLERY_CHROME"))
        context = await browser.new_context(service_workers="block", reduced_motion="reduce")
        no_script = await browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
        plain = await no_script.new_page()
        errors = []
        for version in range(1, 16):
            folder = ROOT / COMPANY / f"v{version}"
            url = f"{base}/{COMPANY.as_posix()}/v{version}/"
            for width, height in SIZES:
                # Navigate at the final size so Chrome composes the sticky header
                # for this viewport before capturing its initial paint.
                page = await context.new_page()
                await page.set_viewport_size({"width": width, "height": height})
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("response", lambda response: errors.append(
                    f"{response.status} {response.url}") if response.status >= 400 else None)
                await page.goto(url)
                await page.evaluate("document.fonts.ready")
                await page.wait_for_function("scrollY === 0")
                issues = await page.evaluate("""() => ({
                    overflow: document.documentElement.scrollWidth > innerWidth,
                    missingImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
                    brokenFragments: [...document.querySelectorAll('a[href^="#"]')].filter(a =>
                        !document.getElementById(a.hash.slice(1))).map(a => a.hash)
                })""")
                assert not any(issues.values()), (version, width, issues)
                if capture and width != 320:
                    await page.screenshot(path=folder / "screenshots" / f"{width}.png")
                if width == 390:
                    await check_actions(page, version)
                await page.close()
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
            print(f"v{version}: responsive layout, primary keyboard journey and no-script reading passed.", flush=True)
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
            print("PASS: 15 guides at four widths, 15 keyboard journeys and 15 no-script reading checks.")
        finally:
            server.shutdown()
