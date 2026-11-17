"""Exercise the complete visual reference library at a nested Pages URL."""
import argparse
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread
from urllib.parse import urljoin

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class RelatedLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "related" in attrs.get("rel", "").split():
            self.urls[tag] = attrs.get("href")


def check(browser, base):
    atlas = urljoin(base, "style-atlas/index.html")
    with browser.new_context(viewport={"width": 1440, "height": 900}) as context:
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(atlas)
        cards = page.locator("article[data-kind]")
        expect(cards).to_have_count(60)
        expect(page.locator("article[data-kind=primary]")).to_have_count(46)
        expect(page.locator("article[data-kind=alternate]")).to_have_count(14)
        for company in ("gjh", "yeos", "thow-kwang"):
            expect(page.locator(f"#{company} article")).to_have_count(20)
        sizes = page.locator(".art img").evaluate_all("""async imgs => {
          imgs.forEach(img => img.loading = 'eager');
          await Promise.all(imgs.map(img => img.decode()));
          return imgs.map(img=>[img.naturalWidth,img.naturalHeight]);
        }""")
        assert all(w >= 800 and h >= 500 and w > h for w, h in sizes), sizes
        expect(page.locator("article[data-kind=alternate] details a")).to_have_count(0)
        primary = page.locator("article[data-kind=primary]").evaluate_all("""articles => articles.map(article => [
          article.id, article.querySelector('.actions a').href, article.querySelector('details a')?.href
        ])""")
        for anchor, demo, audit in primary:
            company, version = anchor.rsplit("-", 1)
            evidence = Path("docs", "landing-atlas", company, "audit", version + ".webp")
            assert (ROOT / evidence).is_file(), evidence
            expected = "https://github.com/yapweijun1996/Webpage-Design-Gallery/blob/main/" + evidence.as_posix()
            assert audit == expected, (anchor, audit)
            response = context.request.get(demo)
            assert response.ok, (demo, response.status)
            related = RelatedLinks()
            related.feed(response.text())
            for tag in ("link", "a"):
                assert urljoin(demo, related.urls[tag]) == atlas + "#" + anchor, (tag, demo, related.urls)
        select = page.get_by_label("Show", exact=True)
        select.select_option("alternate")
        expect(page.locator("article:visible")).to_have_count(14)
        page.evaluate("location.hash='thow-kwang-v1'")
        expect(page.locator("#thow-kwang-v1")).to_be_visible()
        expect(page.locator("article:visible")).to_have_count(60)
        for width in (320, 390, 768, 1440):
            page.set_viewport_size({"width": width, "height": 900})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
        page.set_viewport_size({"width": 390, "height": 844})
        for anchor in ("gjh-v6", "yeos-v1", "thow-kwang-v1"):
            page.goto(atlas + "#" + anchor)
            card = page.locator("#" + anchor)
            card.locator("summary").press("Enter")
            expect(card.locator("figure img")).to_be_visible()
            card.locator("figure img").evaluate("img=>img.decode()")
            demo = card.locator(".actions a").first
            target = demo.evaluate("a=>a.href")
            demo.press("Enter")
            page.wait_for_url(target)
            page.locator("a.design-reference").press("Enter")
            page.wait_for_url(atlas + "#" + anchor)
        assert not errors, errors
    with browser.new_context(java_script_enabled=False) as context:
        page = context.new_page()
        page.goto(atlas + "#yeos-v1")
        expect(page.locator("article:visible")).to_have_count(60)
        page.locator("#yeos-v1 summary").press("Enter")
        expect(page.locator("#yeos-v1 figure")).to_be_visible()
    print("PASS: 60 full-size references, 46 bidirectional demo links and audit sheets, 14 alternates, filters, keyboard, no-script and four widths.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root", type=Path, default=ROOT)
    args = parser.parse_args()
    root = args.site_root.resolve()
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=root.parent)) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel="chrome", executable_path=os.environ.get("GALLERY_CHROME"))
                try:
                    check(browser, f"http://127.0.0.1:{server.server_port}/{root.name}/")
                finally:
                    browser.close()
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
