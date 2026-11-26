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
    def test_merchant_identity_and_native_exploration_are_localized_and_consistent(self):
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                home = Document(pomelo.render(lang, 'index')).root
                identity, = home.find(**{'class': 'merchant-identity'})
                for value in (c['identity_tag'], c['identity_title'], c['identity_text'], *c['identity_words']):
                    self.assertIn(value, identity.content())
                commerce = Document(pomelo.render(lang, 'commerce')).root
                for i in range(3):
                    detail, = commerce.find(**{'data-product-context': str(i)})
                    self.assertEqual(detail.tag, 'details')
                    self.assertNotIn('open', detail.attrs)
                    self.assertEqual(detail.children[0].tag, 'summary')
                    for value in (c['customer_context'], c['seller_context'], c['store_items'][i], c['sample_prices'][i], f'PH-00{i+1}', c['materials'][i], c['sizes'][i], c['cares'][i], c['product_link_note']):
                        self.assertIn(value, detail.content())
                for key, text in (('delivery', c['delivery_explain']), ('pickup', c['pickup_explain'])):
                    detail, = commerce.find(**{'data-order-context': key})
                    self.assertEqual(detail.tag, 'details')
                    self.assertNotIn('open', detail.attrs)
                    self.assertEqual(detail.children[0].tag, 'summary')
                    self.assertIn(text, detail.content())
                    self.assertIn(c['order_context_note'], detail.content())
                self.assertEqual(Decimal('39.90') * 2 + Decimal('8.00'), Decimal('87.80'))
                self.assertEqual(pomelo.SECOND_ORDER['unit'] * pomelo.SECOND_ORDER['quantity'] + pomelo.SECOND_ORDER['delivery'], Decimal('96.00'))

    def test_commerce_chapter_links_reach_unique_keyboard_targets(self):
        targets = ('product-preview', 'sample-comparison', 'sample-estimate', 'sample-orders')
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                root = Document(pomelo.render(lang, 'commerce')).root
                guide, = root.find(**{'class': 'commerce-guide'})
                self.assertEqual(guide.tag, 'nav')
                self.assertEqual(guide.attrs['aria-label'], c['guide_title'])
                for target, label in zip(targets, c['guide_links']):
                    link, = guide.find(href='#' + target)
                    self.assertEqual(link.tag, 'a')
                    self.assertIn(label, link.content())
                    destination, = root.find(id=target)
                    self.assertEqual(destination.attrs['tabindex'], '-1')
                    self.assertNotIn('hidden', destination.attrs)
                    heading, = destination.find(id=destination.attrs['aria-labelledby'])
                    self.assertEqual(heading.tag, 'h2')
                ids = []
                def collect(node):
                    if 'id' in node.attrs:
                        ids.append(node.attrs['id'])
                    for child in node.children:
                        collect(child)
                collect(root)
                self.assertEqual(len(ids), len(set(ids)))

    def test_commerce_hero_connects_labelled_illustrative_views(self):
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                root = Document(pomelo.render(lang, 'commerce')).root
                visual, = root.find(**{'class': 'page-visual page-visual-commerce'})
                image, = visual.find(**{'class': 'commerce-hero-image'})
                self.assertTrue(image.attrs['src'].endswith('/assets/merchant-desktop.webp'))
                self.assertEqual(image.attrs['alt'], '')
                for label in (c['store_brand'], c['store_title'], c['dashboard'],
                              c['band'][2], c['dash_note'], c['sample_label']):
                    self.assertIn(label, visual.content())
                self.assertEqual(len(visual.find(**{'class': 'commerce-workspace-rows'})), 1)

    def test_comparison_and_order_index_use_existing_sample_data(self):
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                root = Document(pomelo.render(lang, 'commerce')).root
                comparison, = root.find(**{'data-comparison': None})
                for selector in ('data-compare-first', 'data-compare-second'):
                    control, = comparison.find(**{selector: None})
                    self.assertIn('disabled', control.attrs)
                    self.assertEqual([option.attrs['value'] for option in control.children], ['0', '1', '2'])
                for i in range(3):
                    card, = comparison.find(**{'data-compare-card': str(i)})
                    self.assertNotIn('hidden', card.attrs)
                    for value in (c['store_items'][i], c['sample_prices'][i], f'PH-00{i+1}', c['materials'][i], c['sizes'][i], c['cares'][i]):
                        self.assertIn(value, card.content())
                same, = comparison.find(**{'data-compare-same': None})
                self.assertEqual(same.content(), c['compare_same'])
                self.assertIn('hidden', same.attrs)
                for i in range(3):
                    card, = comparison.find(**{'data-compare-card': str(i)})
                    self.assertEqual(card.attrs['aria-labelledby'], f'compare-name-{i}')
                    position, = card.find(**{'data-compare-position': None})
                    self.assertIn('hidden', position.attrs)
                    self.assertEqual(position.attrs['id'], f'compare-position-{i}')
                target, = root.find(id='scene-1-1')
                self.assertEqual(target.attrs['tabindex'], '-1')
                self.assertEqual(target.attrs['role'], 'region')
                self.assertIn(c['order_title'], target.attrs['aria-label'])
                self.assertIn('PS-0124', target.attrs['aria-label'])
                index_status, = root.find(**{'data-index-pickup-status': None})
                self.assertEqual(index_status.content(), c['order_preparing'])
                self.assertEqual(len(root.find(href='#scene-1-1')), 1)
                self.assertEqual(len(root.find(href='#sample-pickup')), 1)
                self.assertEqual(len(root.find(id='sample-pickup')), 1)

    def test_generated_pages_and_release_match_source(self):
        self.assertEqual(json.loads((DEMO / 'release.json').read_text())['version'], '7.18.4')
        for lang in pomelo.COPY:
            for page in pomelo.PAGES:
                path = DEMO / ('' if lang == 'en' else lang) / (page + '.html')
                rendered = pomelo.render(lang, page)
                self.assertEqual(path.read_text(), rendered, (lang, page))
                main, = Document(rendered).root.find(id='main')
                self.assertEqual(main.attrs.get('class'), 'home-page' if page == 'index' else None)
                if page == 'index':
                    self.assertIn(pomelo.COPY[lang]['brand_line'], main.content())
                    caption, = main.find(**{'class': 'hero-art-caption'})
                    self.assertIn(pomelo.COPY[lang]['story_steps'][0], caption.content())
                    store, = main.find(**{'class': 'hero-store'})
                    self.assertIn(pomelo.COPY[lang]['store_brand'], store.content())
                    self.assertIn(pomelo.COPY[lang]['sample_label'], store.content())
                    studio, = main.find(**{'class': 'floating-card'})
                    self.assertIn(pomelo.COPY[lang]['dashboard'], studio.content())
                    self.assertIn(pomelo.COPY[lang]['examples'], studio.content())
                    self.assertEqual(len(main.find(src='./assets/pomelo-compact.svg' if lang == 'en' else '../assets/pomelo-compact.svg')), 1)

    def test_editorial_story_and_second_order_agree(self):
        order = pomelo.SECOND_ORDER
        self.assertEqual(order['unit'] * order['quantity'] + order['delivery'], Decimal('96.00'))
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                home = Document(pomelo.render(lang, 'index')).root
                editorial, = home.find(**{'class': 'story-editorial'})
                self.assertEqual(len(editorial.find(loading='lazy')), 1)
                self.assertIn(c['story_image_label'], editorial.content())
                commerce = Document(pomelo.render(lang, 'commerce')).root
                card, = commerce.find(**{'data-product-button': str(order['product'])})
                self.assertIn(c['sample_prices'][order['product']], card.content())
                self.assertEqual(c['sample_prices'][order['product']], f"RM {order['unit']:.2f}")
                for role in ('customer', 'seller'):
                    view, = commerce.find(**{'data-order-view': role})
                    for value in (order['id'], order['sku'], c['store_items'][order['product']], str(order['quantity']), 'RM 32.00', 'RM 96.00', 'RM 0.00', c['order_preparing'], c['pickup'], c['pickup_note']):
                        self.assertIn(value, view.content())
                    self.assertNotIn('hidden', view.attrs)
                seller, = commerce.find(**{'data-order-view': 'seller'})
                self.assertIn(c['seller_task'], seller.content())
                self.assertIn(c['order_disclaimer'], commerce.content())

    def test_home_value_entries_link_to_labelled_examples(self):
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                home = Document(pomelo.render(lang, 'index')).root
                band, = home.find(**{'class': 'feature-band'})
                self.assertEqual(band.attrs['aria-labelledby'], 'home-values-title')
                entries = band.find(**{'class': 'value-card'})
                self.assertEqual([entry.attrs['href'] for entry in entries],
                                 ['./commerce.html#product-preview', '#home-studio', '#home-ai'])
                for entry, title, desc in zip(entries, c['band'], c['band_desc']):
                    self.assertEqual(entry.tag, 'a')
                    for value in (title, desc, c['examples']):
                        self.assertIn(value, entry.content())
                self.assertIn(c['feature_note'], band.content())
                self.assertEqual(len(home.find(id='home-studio')), 1)
                self.assertEqual(len(home.find(id='home-ai')), 1)
                commerce = Document(pomelo.render(lang, 'commerce')).root
                self.assertEqual(len(commerce.find(id='product-preview')), 1)

    def test_pickup_practice_has_static_context_and_accessible_controls(self):
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                home = Document(pomelo.render(lang, 'index')).root
                bridge, = home.find(**{'class': 'story-bridge'})
                self.assertIn(c['story_bridge'], bridge.content())
                self.assertEqual(bridge.find(href='./commerce.html')[0].tag, 'a')
                root = Document(pomelo.render(lang, 'commerce')).root
                example, = root.find(**{'data-pickup-example': None})
                self.assertEqual(example.attrs['data-ready'], c['prep_ready'])
                self.assertEqual(example.attrs['data-preparing'], c['order_preparing'])
                self.assertEqual(len(example.find(**{'data-pickup-status': None})), 2)
                checks = example.find(**{'data-prep-check': None})
                self.assertEqual(len(checks), 2)
                for check in checks:
                    self.assertEqual(check.tag, 'input')
                    self.assertEqual(check.attrs['type'], 'checkbox')
                    self.assertIn('disabled', check.attrs)
                seller, = example.find(**{'data-order-view': 'seller'})
                for text in (*c['prep_checks'], c['prep_note'], c['prep_nojs'], c['seller_task']):
                    self.assertIn(text, seller.content())
                reset, = seller.find(**{'data-pickup-reset': None})
                self.assertEqual(reset.tag, 'button')
                self.assertEqual(reset.attrs['type'], 'button')
                self.assertIn('disabled', reset.attrs)
                self.assertEqual(reset.content(), c['prep_reset'])
                self.assertEqual(example.attrs['data-reset-done'], c['prep_reset_done'])
                announcement, = example.find(**{'data-pickup-announcement': None})
                self.assertEqual(announcement.attrs['role'], 'status')

    def test_estimator_and_collection_have_accessible_fallbacks(self):
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                root = Document(pomelo.render(lang, 'commerce')).root
                estimate, = root.find(**{'data-estimator': None})
                product, = estimate.find(**{'data-estimate-product': None})
                quantity, = estimate.find(**{'data-estimate-quantity': None})
                self.assertIn('disabled', product.attrs)
                self.assertIn('disabled', quantity.attrs)
                self.assertEqual([x.attrs['value'] for x in product.children], ['3990', '3200', '4800'])
                self.assertEqual([x.attrs['value'] for x in quantity.children], [str(i) for i in range(1, 7)])
                result, = estimate.find(**{'data-estimate-total': None})
                self.assertEqual(result.content(), 'RM 39.90')
                self.assertEqual(result.attrs['aria-live'], 'polite')
                for text in (c['estimate_note'], c['estimate_nojs']):
                    self.assertIn(text, estimate.content())
                example, = root.find(**{'data-pickup-example': None})
                self.assertEqual(example.attrs['data-collected'], c['collected_status'])
                collected, = example.find(**{'data-pickup-collected': None})
                self.assertEqual(collected.attrs['type'], 'checkbox')
                self.assertIn('disabled', collected.attrs)
                self.assertIn(c['collected_hint'], example.content())
                self.assertIn(c['collected'], example.content())
                home = Document(pomelo.render(lang, 'index')).root
                for audience in c['aud_names']:
                    self.assertIn(audience, home.content())
                self.assertIn(c['future_text'], root.content())

    def test_estimate_links_and_pickup_progress_are_consistent(self):
        for lang, c in pomelo.COPY.items():
            with self.subTest(lang=lang):
                root = Document(pomelo.render(lang, 'commerce')).root
                estimate, = root.find(**{'data-estimator': None})
                breakdown, = estimate.find(**{'data-estimate-breakdown': None})
                self.assertEqual(breakdown.content(), 'RM 39.90 × 1')
                self.assertIn(c['estimate_breakdown'], estimate.content())
                for i, price in enumerate(c['sample_prices']):
                    detail, = root.find(id=f'scene-0-{i}')
                    choice, = detail.find(**{'data-estimate-choice': str(i)})
                    self.assertIn('hidden', choice.attrs)
                    self.assertIn(c['store_items'][i], choice.content())
                    option = estimate.find(**{'data-estimate-product': None})[0].children[i]
                    self.assertEqual(Decimal(option.attrs['value']) / 100, Decimal(price.removeprefix('RM ')))
                order, = root.find(**{'data-pickup-example': None})
                self.assertEqual([x.content() for x in order.find(**{'data-prep-progress': None})], ['0 / 2', '0 / 2'])
                for role in ('customer', 'seller'):
                    view, = order.find(**{'data-order-view': role})
                    self.assertIn(c['prep_progress'], view.content())

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
                    self.assertIn(c['sizes'][i], detail.content())
                    self.assertIn(c['cares'][i], detail.content())
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
                    for expected in (c['store_items'][i], c['sample_prices'][i], c['materials'][i], c['sizes'][i], c['cares'][i], f'PH-00{i+1}'):
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
                    handoff, = order.find(**{'class': 'sample-handoff'})
                    self.assertEqual(handoff.tag, 'details')
                    self.assertNotIn('hidden', handoff.attrs)
                    self.assertEqual(handoff.children[0].tag, 'summary')
                    for value in (c['handoff'], c['handoff_intro'], *c['handoff_steps'], c['handoff_note']):
                        self.assertIn(value, handoff.content())
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
