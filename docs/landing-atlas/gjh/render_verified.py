"""Render GJH atlas compositions that rely on the identity of a product, brand or historical image."""
import argparse
import functools
import html
import http.server
import io
import json
import os
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'style-atlas/images/gjh'
DIRECTIONS = {r['key']: r for r in json.loads((HERE / 'directions.json').read_text())}
KEYS = json.loads((HERE / 'verified-renders.json').read_text())
ORIGINS = [('New Zealand', 'nz', '425 g'), ('Australia', 'au', '425 g'),
           ('South Africa', 'sa', '425 g'), ('Mexico', 'mx', '454 g')]
BRANDS = [('New Moon', 'new-moon', 'Abalone, shellfish and soups for the shared table.'),
          ('MILI', 'mili', 'Canned vegetables and sauces for everyday cooking.'),
          ('GOGO', 'gogo', 'Drinks and potong ice cream for a cool break.')]
DATES = [('1940s', 'Rochor Road'), ('1959', 'New Moon'), ('1981', 'MILI'), ('2004', 'Borsch Med')]


def photo(version, name):
    path = f'demos/corporate/gjh/v{version}/assets/{name}'
    if not (ROOT / path).is_file():
        raise FileNotFoundError(path)
    return f'<img src="{path}" alt="">'


def pack(place):
    _, code, weight = place
    return photo(11, f"new-moon-{code}-{weight.replace(' ', '')}-front.jpg")


def mast(title, nav='Goh Joo Hin'):
    return f'<header><b>{nav}</b><span>{title}</span></header>'


def button(label):
    return f'<span class="cta">{label} <i>↗</i></span>'


def navrow(label, content, selected=False):
    return f"""<div class="navrow{' selected' if selected else ''}"><b>{label}</b><span>{content}</span><i>↗</i></div>"""


def origins():
    one, other = ORIGINS[-1], ORIGINS[0]
    figures = ''.join(f'<figure>{pack(p)}<figcaption><strong>{p[0]}</strong><span>{p[2]}</span></figcaption></figure>'
                      for p in (one, other))
    index = ''.join(f'<li>{p[0]}<b>{p[2]}</b></li>' for p in ORIGINS)
    return f"""{mast('New Moon / Origins')}<main><article><p class="kicker">New Moon</p>
    <h1>One brand.<br><em>Distinct origins.</em></h1><p class="lead">Start with the 454 g Mexico pack,
    then compare the other origins.</p>{button('Compare the origins')}</article>
    <section class="pair">{figures}</section></main><footer><b>Four origins</b><ul>{index}</ul></footer>"""


def chronicle():
    dates = ''.join(f'<li><b>{year}</b><span>{name}</span><i>↗</i></li>' for year,name in DATES)
    return f"""{mast('Company history')}<main><figure>{photo(8,'family-dining.webp')}
    <figcaption>Family dinner · Concept illustration</figcaption></figure>
    <article><p class="kicker">A Singapore story since the 1940s</p><h1>Generations<br>of <em>Goodness.</em></h1>
    <p class="lead">From a family business on Rochor Road to a portfolio of everyday brands.</p>
    {button('Choose a chapter')}</article></main><footer><ol>{dates}</ol></footer>"""


def receiver():
    presets = ''.join(f'<li class="{"active" if name=="Watch" else ""}"><span>{i:02d}</span><b>{name}</b></li>'
                      for i,name in enumerate(['Listen','Watch','Play','Connect'],1))
    return f"""{mast('Electronics / Channel guide')}<main><figure>{photo(18,'record-grooves.webp')}</figure>
    <article><p class="kicker">Electronics by Goh Joo Hin</p><h1>Everyday<br><em>Frequencies.</em></h1>
    <p class="lead">A favourite record, a late film, a familiar voice. Explore four ways electronics find a place in our homes.</p>
    {button('Tune in')}</article></main><footer><p class="kicker">Channel presets</p><ol>{presets}</ol></footer>"""


def signs():
    signs = ''.join(navrow(a, b, a == 'MILI') for a,b in [('New Moon','Four packs'),('MILI','Pantry'),('GOGO','Refreshment')])
    return f"""{mast('Virtual stores')}<main><figure>{photo(11,'concept-storefront-food.webp')}
    <figcaption>Storefront concept illustration</figcaption></figure><article><p class="kicker">The street map</p>
    <h1>A little closer to <em>everyday goodness.</em></h1><section>{signs}</section>
    {button('Enter the pantry')}</article></main>"""


def arrivals():
    board = ''.join(f'<li>{pack(p)}<div><span>New Moon abalone</span><strong>{p[0]}</strong></div><b>{p[2]}</b></li>'
                    for p in ORIGINS)
    return f"""{mast('Virtual mall / Visitor arrivals')}<main><article><p class="kicker">Walking guide</p>
    <h1>Everyday,<br><em>explored.</em></h1><p class="lead">Go straight to four New Moon packs,
    or explore the mall on foot.</p>{button('Featured products')}
    <figure>{photo(11,'concept-wayfinding.webp')}<figcaption>Store wayfinding · Concept illustration</figcaption></figure></article>
    <section class="board"><p class="kicker">Featured products</p><h2>New Moon</h2><ul>{board}</ul></section></main>"""


def menu():
    return f"""{mast('Pantry Notes / At the table')}<main><figure>{photo(17,'sunday-lunch.webp')}
    <figcaption>Sunday lunch · Shared abalone platter</figcaption></figure><article>
    <p class="kicker">On the menu</p><h1>Sunday<br><em>lunch.</em></h1><p class="lead">Make room in the middle of the table.
    New Moon’s abalone, shellfish and soups lend themselves to sharing.</p>{button('Open Sunday lunch')}</article></main>
    <footer><span>Weeknight supper</span><b>Sunday lunch</b><span>Afternoon break</span></footer>"""


def worksheet():
    return f"""{mast('Retail enquiries')}<main><article><p class="kicker">Goh Joo Hin</p><h1>The Partner<br><em>Desk.</em></h1>
    <p class="lead">Choose a category and topic. Add your retail setting if you want a more specific enquiry.</p>
    <figure>{photo(19,'partner-review.webp')}<figcaption>Shelf materials review · Concept illustration</figcaption></figure></article>
    <section><p class="kicker">Retail enquiries</p><h2>Build your brief.</h2>
    <div class="field"><p>Product category</p><div class="choice"><b>◉ Food &amp; pantry</b> <span>○ Health &amp; wellness</span> <span>○ Consumer electronics</span></div></div>
    <div class="field"><p>Enquiry topic</p><div class="select">Range and assortment <b>⌄</b></div></div>
    <div class="field"><p>Where will you sell the range?</p><div class="select">Grocery retail <b>⌄</b></div></div>
    {button('Prepare brief')}</section></main>"""


def counter():
    return f"""{mast('The provision counter')}<main><article><p class="kicker">Exhibition catalogue</p>
    <h1>Good things<br><em>gather here.</em></h1><p class="lead">Switch between the illustrated counter
    and GJH’s historical composite.</p>{button('See the archive')}</article>
    <figure>{photo(14,'provision-counter-1120.webp')}<figcaption><strong>Counter illustration</strong>Illustrated provision counter · Design study</figcaption></figure></main>
    <footer><figure>{photo(14,'gjh-history-composite.jpg')}</figure><div><p class="kicker">Archive view</p>
    <h2>Rochor Road</h2><p>Historical composite published by Goh Joo Hin.</p></div><b>1940s</b></footer>"""


def field_guide():
    rows = ''.join(f'<div>{photo(15, "new-moon-brand-cover-438.webp" if slug=="new-moon" else slug+"-brand-cover.jpg")}<h2>{name}</h2><p>{copy}</p><i>↗</i></div>'
                   for name,slug,copy in BRANDS)
    return f"""{mast('Portfolio / Range notes')}<main><article><p class="kicker">Brand field guide</p>
    <h1>Life is better<br>in <em>good company.</em></h1>
    <p class="lead">Open a brand’s range note to see the kinds of products it carries.</p></article><figure>{photo(15,'portfolio-study-1120.webp')}</figure></main>
    <section class="brand-index">{rows}</section>"""


def object_label():
    return f"""{mast('The everyday collection')}<main><figure>{photo(16,'new-moon-front-480.webp')}
    <figcaption><span>Front label</span><b>New Moon</b></figcaption></figure>
    <article><p class="kicker">The object collection</p><h1>A little goodness<br><em>goes a long way.</em></h1>
    <dl><div><dt>Specimen</dt><dd>New Moon abalone</dd></div><div><dt>Origin</dt><dd>New Zealand</dd></div>
    <div><dt>Net weight</dt><dd>425 g</dd></div></dl>{button('View back label')}<p class="source">Official product photograph</p></article></main>"""


def archive():
    dates = ''.join(f'<li><b>{year}</b><span>{name}</span></li>' for year,name in DATES)
    return f"""{mast('The company archive')}<main><article><p class="kicker">Chapter one · 1940s</p>
    <h1>A story that began<br>on <em>Rochor Road.</em></h1></article>
    <figure>{photo(8,'gjh-history-composite.jpg')}<figcaption>Rochor Road beginnings · Historical composite published by Goh Joo Hin</figcaption></figure>
    <aside><p class="kicker">Chapter index</p><ol>{dates}</ol>{button('Open the 1940s chapter')}</aside></main>"""


def proof():
    return f"""{mast('New Moon / Packaging proof')}<main><article><p class="kicker">New Zealand · 425 g</p>
    <h1>View<br><em>back label.</em></h1><p class="lead">Turn the specimen to compare the front and back.</p>
    {button('View front label')}</article><figure>{photo(16,'new-moon-nz-425g-back.jpg')}<figcaption><b>Back label</b><span>Official product photograph</span></figcaption></figure></main>
    <footer><b>New Moon</b><span>Premium wild caught New Zealand abalone</span><strong>425 g</strong></footer>"""


def drawers():
    cards = ''.join(f'<figure>{pack(p)}<figcaption><b>{p[0]}</b><span>{p[2]}</span></figcaption></figure>' for p in ORIGINS)
    return f"""{mast('Virtual mall / Store directory')}<main><h1>Featured products<br><em>from New Moon.</em></h1>
    <aside><p class="lead">Browse four New Moon packs in the mall directory.</p>{button('Explore featured products')}</aside></main>
    <section class="drawers">{cards}</section><footer><b>Store wayfinding</b><span>All four packs</span></footer>"""


LAYOUTS = {'pack-origins': origins, 'family-chronicle': chronicle, 'shopfront-signs': signs, 'mall-arrivals': arrivals,
           'record-receiver': receiver, 'sunday-menu-card': menu, 'buyers-working-desk': worksheet,
           'provision-archive': counter, 'brand-field-guide': field_guide, 'abalone-object-label': object_label,
           'rochor-photo-contact-sheet': archive, 'pack-label-proof': proof, 'newmoon-drawer': drawers}


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run(keys):
    css = (HERE / 'verified.css').read_text()
    with http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=ROOT)) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(channel='chrome', executable_path=os.environ.get('GALLERY_CHROME'))
                page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, reduced_motion='reduce')
                page.goto(f'http://127.0.0.1:{server.server_port}/docs/landing-atlas/gjh/directions.json')
                for key in keys:
                    title = html.escape(DIRECTIONS[key]['style'])
                    page.set_content(f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
                    <base href="http://127.0.0.1:{server.server_port}/"><title>{title}</title><style>{css}</style></head>
                    <body class="{key}">{LAYOUTS[key]()}</body></html>""", wait_until='networkidle')
                    page.evaluate('Promise.all([...document.images].map(image => image.decode()))')
                    page.evaluate('document.fonts.ready')
                    assert page.evaluate("document.fonts.check('20px Manrope')"), key
                    assert page.evaluate('document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight'), key
                    with Image.open(io.BytesIO(page.screenshot())) as shot:
                        tmp = OUT / (key + '.tmp')
                        shot.convert('RGB').save(tmp, 'WEBP', quality=91, method=6)
                        tmp.replace(OUT / (key + '.webp'))
                    print(key, flush=True)
                browser.close()
        finally:
            server.shutdown()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--keys', nargs='+', choices=KEYS, default=KEYS)
    args = parser.parse_args()
    if set(KEYS) != set(LAYOUTS):
        raise ValueError('Verified atlas labels and renderers must match.')
    run(args.keys)
