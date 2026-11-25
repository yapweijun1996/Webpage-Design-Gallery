"""Static contracts for the multilingual, fictional Pomelo V7 concept."""
import importlib.util
import json
import unittest
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demos/corporate/pomelo-stem/v7'
spec = importlib.util.spec_from_file_location('pomelo_v7', ROOT / 'scripts/build_pomelo_v7.py')
pomelo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pomelo)


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children, self.text = tag, dict(attrs), [], ''

    def find(self, **attrs):
        found = []
        for child in self.children:
            if all(key in child.attrs and child.attrs[key] == value for key, value in attrs.items()):
                found.append(child)
            found.extend(child.find(**attrs))
        return found

    def content(self):
        return self.text + ''.join(child.content() for child in self.children)


class Document(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1].text += data


class PomeloContracts(unittest.TestCase):
    def test_generated_pages_and_release_match_source(self):
        self.assertEqual(json.loads((DEMO / 'release.json').read_text())['version'], '7.9.0')
        for lang in pomelo.COPY:
            for page in pomelo.PAGES:
                path = DEMO / ('' if lang == 'en' else lang) / (page + '.html')
                rendered = pomelo.render(lang, page)
                self.assertEqual(path.read_text(), rendered, (lang, page))
                main, = Document(rendered).root.find(id='main')
                self.assertEqual(main.attrs.get('class'), 'home-page' if page == 'index' else None)
                if page == 'index':
                    self.assertIn(pomelo.COPY[lang]['brand_line'], main.content())
                    self.assertEqual(len(main.find(src='./assets/pomelo-compact.svg' if lang == 'en' else '../assets/pomelo-compact.svg')), 1)

    def test_sample_cards_and_scenes_are_complete_without_javascript(self):
        shapes = ('object-cup', 'object-bowl', 'object-basket')
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                root = Document(pomelo.render(lang, 'commerce')).root
                link, = root.find(href='#sample-collection')
                self.assertEqual(link.tag, 'a')
                self.assertEqual(len(root.find(id='sample-collection')), 1)
                hint, = root.find(**{'data-product-hint': None})
                self.assertIn('hidden', hint.attrs)
                self.assertIn(c['collection_nojs'], root.content())
                shop, = root.find(**{'data-scene-kind': '0'})
                studio, = root.find(**{'data-scene-kind': '1'})
                self.assertEqual(len(shop.find(**{'data-scene-buttons': ''})), 0)
                for i, shape in enumerate(shapes):
                    card, = root.find(**{'data-product-button': str(i)})
                    self.assertEqual(card.tag, 'button')
                    self.assertIn('disabled', card.attrs)
                    self.assertEqual(card.attrs['aria-pressed'], str(i == 0).lower())
                    self.assertEqual(card.attrs['aria-controls'], f'scene-0-{i}')
                    state, = card.find(**{'data-product-state': None})
                    self.assertIn('hidden', state.attrs)
                    self.assertEqual(card.attrs['data-selected-label'], c['selected_sample'])
                    self.assertEqual(card.attrs['data-view-label'], c['view_sample'])
                    detail, = shop.find(**{'data-scene-detail': str(i)})
                    for value in (c['store_items'][i], c['sample_prices'][i]):
                        self.assertIn(value, card.content())
                        self.assertIn(value, detail.content())
                    self.assertIn(c['scenes'][0][i][2], detail.content())
                    self.assertEqual(len(detail.find(**{'class': shape})), 1)
                    self.assertIn(c['materials'][i], detail.content())
                    self.assertIn(f'PH-00{i+1}', detail.content())
                    extra, = detail.find(**{'class': 'sample-product-details'})
                    self.assertIn('open', extra.attrs)
                    self.assertIn(c['listing_details'], extra.content())
                    self.assertNotIn('hidden', detail.attrs)
                    jump, = detail.find(**{'data-view-studio': str(i)})
                    self.assertEqual(jump.tag, 'button')
                    self.assertIn('hidden', jump.attrs)
                    self.assertIn(c['view_studio'], jump.content())
                product, = studio.find(**{'data-scene-detail': '0'})
                self.assertIn(c['scene_hint'], studio.content())
                live, = studio.find(**{'data-scene-status': None})
                self.assertEqual(live.attrs['role'], 'status')
                self.assertIn(c['product_status'], product.content())
                self.assertIn('PH-001', product.content())
                self.assertIn(c['materials'][0], product.content())
                for i in range(3):
                    listing, = product.find(**{'data-studio-product': str(i)})
                    self.assertNotIn('hidden', listing.attrs)
                    for expected in (c['store_items'][i], c['sample_prices'][i], c['materials'][i], f'PH-00{i+1}'):
                        self.assertIn(expected, listing.content())
                    self.assertEqual(len(listing.find(**{'class': shapes[i]})), 1)
                self.assertNotIn('#PS-0124', product.content())
                for i, status in ((1, c['order_status']), (2, c['order_preparing'])):
                    order, = studio.find(**{'data-scene-detail': str(i)})
                    for value in ('#PS-0124', 'PH-001', c['order_items'], 'RM 79.80', 'RM 8.00', 'RM 87.80', status):
                        self.assertIn(value, order.content())
                    self.assertNotIn('hidden', order.attrs)
                    self.assertIn(c['order_flow'], order.content())
                    self.assertIn(c['fulfilment'], order.content())
                    self.assertIn(c['delivery_method'], order.content())
                    self.assertIn(c['order_tasks'][i-1], order.content())
                    current, = order.find(**{'aria-current': 'step'})
                    self.assertEqual(current.content(), status)
                    control, = studio.find(**{'data-scene-button': str(i)})
                    self.assertEqual(control.attrs['aria-controls'], f'scene-1-{i}')
                self.assertEqual(Decimal('39.90') * 2 + Decimal('8.00'), Decimal('87.80'))
                self.assertEqual(len(root.find(**{'data-demo-form': ''})), 0)
                ai, = root.find(**{'data-scene-kind': '2'})
                third, = ai.find(**{'data-scene-detail': '2'})
                self.assertIn(c['ai_order'][1], third.content())
                self.assertIn(c['ai_order'][2], third.content())
                self.assertNotIn('hidden', third.attrs)
                self.assertIn(c['tour_note'], root.content())


if __name__ == '__main__':
    unittest.main()
