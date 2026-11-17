"""Render fact-sensitive Yeo's art studies from the working demo and its serving images."""

import io
import json
import os
from html import escape
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image
from playwright.sync_api import sync_playwright


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SITE = ROOT / "demos/food-beverage/yeos"
ASSETS = SITE / "v1/assets"
ART = ROOT / "style-atlas/images/yeos"


def catalogue(page):
    page.goto((SITE / "v1/index.html").as_uri())
    rows = page.locator("article.drink").evaluate_all("""cards => cards.map(card => ({
        id: card.id,
        name: card.querySelector('h3').textContent,
        note: card.querySelector('.drink-copy > h3 + p').textContent,
        src: card.querySelector('img').src,
        packs: Array.from(card.querySelectorAll('.pack-sizes li'), item => item.textContent.trim())
    }))""")
    return {row["id"]: row for row in rows}


def picture(product):
    return f'<img src="{escape(product["src"], quote=True)}" alt="">'


def labels(values):
    return ''.join(f'<span>{escape(value)}</span>' for value in values)


def header(section, marker):
    return f'<header><span class="brand">Yeo’s</span><span>{section}</span><b>{marker}</b></header>'


def soy(products):
    panels = []
    for key, ingredient in (("soy", "Whole soy beans"), ("black-soy", "Two-bean blend")):
        row = products[key]
        panels.append(f"""<article class="{key}"><div class="samplephoto">{picture(row)}</div>
            <div class="samplefacts"><small>{ingredient}</small><h2>{escape(row['name'])}</h2>
            <b>{len(row['packs'])} pack formats</b><div class="tags">{labels(row['packs'])}</div></div></article>""")
    return header("The Singapore drinks guide", "Product studies") + f"""<section class="soyhead">
        <div><small>Ingredient library / Soy</small><h1>The soy study.</h1></div>
        <div><p>A whole-bean drink beside a two-bean blend.</p><b class="button">Compare the soy packs ↗</b></div></section>
        <main class="specimens">{''.join(panels)}</main>"""


def matrix_data(page):
    page.goto((SITE / "v5/index.html").as_uri())
    page.locator("#pack").select_option("1")
    return page.locator('table').evaluate("""table => ({
        headings: Array.from(table.tHead.rows[0].cells).slice(1).map(cell => cell.textContent),
        rows: Array.from(table.tBodies[0].rows, row => [row.cells[0].textContent,
            ...Array.from(row.cells).slice(1).map(cell => cell.querySelector('span').ariaLabel === 'Available')]),
        reading: document.querySelector('#match-total').textContent,
        selected: document.querySelector('#pack').selectedOptions[0].textContent
    })""")


def pack(products, matrix):
    heads = ''.join(f'<th>{escape(label)}</th>' for label in matrix['headings'])
    rows = []
    for name, *availability in matrix['rows']:
        cells = ''.join('<td>●</td>' if listed else '<td>—</td>' for listed in availability)
        rows.append(f'<tr><th>{escape(name)}</th>{cells}</tr>')
    return header("Product inventory", "Singapore formats") + f"""<main class="inventory">
        <section class="inventory-intro"><small>Format selector</small><h1>Find a<br>pack.</h1>
        <p>Compare the listed containers across the six drinks in this guide.</p>
        <div class="active-format">{escape(matrix['selected'])} <b>⌄</b></div>
        <div class="inventory-photo">{picture(products['soy'])}<span>Soy Bean Milk</span></div></section>
        <section class="inventory-board"><div class="count"><strong>{escape(matrix['reading'])}</strong>
        <span>drinks offered in a<br><b>{escape(matrix['selected'])}</b></span></div>
        <table><thead><tr><th>Drink</th>{heads}</tr></thead><tbody>{''.join(rows)}</tbody></table>
        <p class="legend">● &nbsp; Listed &nbsp;&nbsp;&nbsp; — &nbsp; Not listed in the Singapore range</p></section></main>"""


def picnic(page, products):
    page.goto((SITE / "v10/index.html").as_uri())
    page.locator("#guests").fill("7")
    page.locator("#size").select_option("300")
    page.locator("#tally button").click()
    fields = [("Guests", page.locator("#guests").input_value()),
              ("Per guest", page.locator("#serve").input_value() + " mL"),
              ("Choose a pack", page.locator("#size option:checked").inner_text())]
    field_html = ''.join(f'<div><span>{label}</span><b>{escape(value)}</b></div>' for label, value in fields)
    quantity, unit, capacity, estimate = [page.locator(selector).inner_text() for selector in
                                           ("#pack-quantity", "#pack-unit", "#pack-capacity", "#estimate")]
    return header("Weekend picnic worksheet", "Packing slip") + f"""<main class="picnic">
        <section class="picnic-copy"><small>Portion planner</small><h1>Picnic<br><em>counter.</em></h1>
        <p>Plan a pour for every guest.</p><div class="fruit">{picture(products['lychee'])}</div></section>
        <section class="slip"><small>Yeo’s / Take to the picnic</small><h2>Your packing slip</h2>
        <div class="receipt-rows">{field_html}</div><div class="quantity"><strong>{quantity}</strong>
        <div><b>{unit}</b><span>{capacity}</span></div></div><p>{escape(estimate)}</p>
        <b class="button">Calculate packs ↗</b></section></main>"""


def notebook(page, products):
    page.goto((SITE / "v12/index.html").as_uri() + "?drink=black-soy")
    page.locator("#drink").wait_for()
    drink = products[page.locator("#drink").input_value()]
    return header("Personal tasting journal", "On this device") + f"""<main class="desk">
        <section class="journal-left"><small>Selected entry</small><h1>Tasting<br><em>notebook.</em></h1>
        <figure>{picture(drink)}<figcaption>{escape(drink['name'])}</figcaption></figure></section>
        <section class="journal-right"><small>Tasting page</small><h2>{escape(drink['name'])}</h2>
        <p class="ingredient">{escape(drink['note'])}</p><div class="lines">
        <p>What do you notice?</p><em>Aroma</em><em>Texture</em><em>Finish</em></div>
        <b class="button">Save note on this device ↗</b></section></main>"""


def atlas(page, products):
    page.goto((SITE / "v15/index.html").as_uri())
    page.locator("#atlas-query").fill("rose essence")
    article = page.locator('.letter:not([hidden]) article:not([hidden])')
    assert article.count() == 1
    letter = page.locator('nav[aria-label="Alphabetical index"] a:not([hidden])').inner_text()
    product = next(row for row in products.values() if row['name'] == article.locator("h3").inner_text())
    return header("Alphabetical drinks reference", "Singapore") + f"""<main class="atlas">
        <div class="atlas-title"><small>Ingredient lookup</small><h1>Beverage atlas.</h1>
        <div class="search"><b>⌕</b><span>{escape(page.locator('#atlas-query').input_value())}</span><strong>Clear ×</strong></div></div>
        <section class="entry"><div class="initial">{escape(letter)}</div><div><small>{escape(page.locator('#atlas-count').inner_text())}</small>
        <h2>{escape(product['name'])}</h2><p>{escape(article.locator('p').first.inner_text())}</p>
        <div class="tags">{labels(product['packs'])}</div><b class="button">Read the drink profile ↗</b></div>
        <figure>{picture(product)}</figure></section></main>"""


def ruler(products, matrix):
    product = products['black-soy']
    selected = product['packs'][0]
    sizes = matrix['headings']
    bars = []
    for label in sizes:
        amount, unit, container = label.split()
        ml = float(amount) * (1000 if unit == 'L' else 1)
        active = ' active' if label == selected else ''
        bars.append(f'<div class="measure{active}"><label>{escape(label)}</label><i><b style="width:{ml / 15:.4f}%"></b></i></div>')
    return header("The measurement cabinet", "Volume reference") + f"""<main class="cabinet">
        <section class="scale"><small>Shared scale / 0–1,500 mL</small><h1>Measure the<br>pack range.</h1>
        <div class="measures">{''.join(bars)}</div><b class="button">Choose a pack ↗</b></section>
        <aside class="ruler-specimen"><div class="dial"><i></i><span>Selected capacity</span><strong>{escape(selected.rsplit(' ',1)[0])}</strong></div>
        <div class="specimen-slide">{picture(product)}<div><small>Featured matching drink</small><h2>{escape(product['name'])}</h2>
        <p>{' · '.join(escape(pack) for pack in product['packs'])}</p></div></div></aside></main>"""


def main():
    keys = json.loads((HERE / "verified-renders.json").read_text())
    css = (HERE / "verified-renders.css").read_text().replace("ASSET_PATH", ASSETS.as_uri())
    with sync_playwright() as pw, TemporaryDirectory() as temp:
        chrome = os.environ.get("GALLERY_CHROME")
        browser = pw.chromium.launch(executable_path=chrome, channel=None if chrome else "chrome")
        page = browser.new_page(viewport={"width": 1560, "height": 976}, service_workers="block")
        products = catalogue(page)
        matrix = matrix_data(page)
        studies = {"soy-study": soy(products), "pack-finder": pack(products, matrix),
                   "picnic-counter": picnic(page, products), "tasting-notebook": notebook(page, products),
                   "beverage-atlas": atlas(page, products), "capacity-ruler": ruler(products, matrix)}
        assert set(studies) == set(keys)
        for key in keys:
            document = Path(temp) / f"{key}.html"
            document.write_text(f'<!doctype html><meta charset="utf-8"><style>{css}</style><body class="{key}">{studies[key]}</body>')
            page.goto(document.as_uri())
            page.evaluate("document.fonts.ready")
            page.locator("img").evaluate_all("images => Promise.all(images.map(image => image.decode()))")
            assert page.evaluate("document.documentElement.scrollWidth <= 1560 && document.documentElement.scrollHeight <= 976"), key
            with Image.open(io.BytesIO(page.screenshot())) as shot:
                shot.save(ART / f"{key}.webp", "WEBP", quality=91, method=6)
            print(key)
        browser.close()


if __name__ == "__main__":
    main()
