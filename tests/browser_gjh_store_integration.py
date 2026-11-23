"""Three-store 3D/directory, detail and bag parity in the expanded shell."""
from gjh_startup_test_helpers import mall_entry_url
import argparse
import functools
import http.server
import os
import threading
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from browser_gjh_expanded_shell import Quiet
from browser_gjh_newmoon_pickup_bag import APPROACH, BROWSE_Z, bag_count, click, inspect_product
from verify_mall_support import face, probe_url, walk

ROOT=Path(__file__).resolve().parents[1]
STORES=[('newmoon','New Moon',-10),('mili','MILI',0),('gogo','GOGO',10)]
SKUS=['nz-425g','au-425g','sa-425g','mx-454g']


BRAND_COPY = {
    'en': {
        'mili': ('official brand cover artwork', 'unprinted', 'Oyster Sauce (510 g)',
                 'Vegetarian Oyster Sauce (510 g)', 'Vegetarian Mock Duck (280 g)'),
        'gogo': ('official drinks cover artwork', 'unwrapped potong ice cream', 'Assorted Real Fruit',
                 'Red Bean', 'Health Promotion Board', '2016'),
    },
    'zh-Hans': {
        'mili': ('官方品牌封面图', '无印刷', '蚝油（510 克）', '素食蚝油（510 克）', '素鸭（280 克）'),
        'gogo': ('官方饮料封面图', '无包装的 potong 冰淇淋', '什锦水果', '红豆', '新加坡保健促进局', '2016'),
    },
    'ms': {
        'mili': ('ilustrasi kulit hadapan rasmi', 'tanpa cetakan', 'Sos Tiram MILI (510 g)',
                 'Sos Tiram Vegetarian (510 g)', 'Itik Tiruan Vegetarian (280 g)'),
        'gogo': ('ilustrasi kulit hadapan rasmi untuk minuman', 'ais krim potong tanpa pembalut',
                 'Aneka Buah Asli', 'Kacang Merah', 'Lembaga Penggalakan Kesihatan Singapura', '2016'),
    },
}


def brand_description(page, ident):
    return page.locator(f'[data-brand="{ident}"] .store-story h2 + p')


def assert_brand_copy(description, locale, ident):
    for phrase in BRAND_COPY[locale][ident]:
        expect(description).to_contain_text(phrase)
    if ident == 'mili':
        weight = '510 克' if locale == 'zh-Hans' else '510 g'
        assert description.inner_text().count(weight) == 2


def check_brand_artwork(browser, base):
    journeys = [('en', 'zh-Hans', 'ms', 'en'), ('zh-Hans', 'en'), ('ms', 'en')]
    for starting_locale, *changes in journeys:
        context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
        context.add_init_script(f"if (!localStorage.getItem('wdg.language')) localStorage.setItem('wdg.language', '{starting_locale}')")
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '#store-list')
        selector = page.locator('#directory-language')
        selector.locator('xpath=ancestor::details').locator('summary').click()
        for index, locale in enumerate((starting_locale, *changes)):
            if index:
                selector.select_option(locale)
            expect(page.locator('html')).to_have_attribute('lang', locale)
            for ident, label, _ in STORES[1:]:
                description = brand_description(page, ident)
                assert_brand_copy(description, locale, ident)
                artwork = page.locator(f'[data-inspect="{ident}"]')
                artwork.click()
                dialog = page.locator('#product-dialog')
                expect(dialog).to_be_visible()
                expect(dialog.locator('#product-title')).to_have_text(label)
                expect(dialog.locator('#product-image')).to_have_attribute('src', f'assets/{ident}-brand-cover.jpg')
                expect(dialog.locator('#product-shop')).to_have_attribute('href', 'https://www.gjheshop.com/')
                expect(dialog.locator('#product-bag-actions')).to_be_hidden()
                expect(dialog.locator('#product-description')).to_have_text(description.inner_text())
                dialog.locator('#product-close').click()
                expect(dialog).to_be_hidden()
                expect(artwork).to_be_focused()
        if starting_locale == 'en':
            page.locator('[data-inspect="mili"]').click()
            modal_copy = page.locator('#product-dialog #product-description')
            assert_brand_copy(modal_copy, 'en', 'mili')
            other_tab = context.new_page()
            other_tab.goto(base + '#store-list')
            other_tab.locator('.mall-app-settings summary').click()
            other_tab.locator('#directory-language').select_option('ms')
            assert_brand_copy(modal_copy, 'ms', 'mili')
            expect(modal_copy).to_have_text(brand_description(page, 'mili').text_content())
            other_tab.close()
        assert not errors, errors
        context.close()
        print(f'PASS brand artwork directory and dialog, starting in {starting_locale}', flush=True)
    context = browser.new_context(java_script_enabled=False, service_workers='block')
    page = context.new_page()
    page.goto(base + '#store-list')
    for ident, _, _ in STORES[1:]:
        description = brand_description(page, ident)
        expect(description).to_be_visible()
        assert_brand_copy(description, 'en', ident)
        expect(page.locator(f'[data-inspect="{ident}"]')).to_be_hidden()
    context.close()
    print('PASS no-JS English brand directory', flush=True)


def state(page):
    return page.evaluate('''()=>{let s=__mall.state;return {x:s.x,z:s.z,zone:s.zone,nearby:s.nearby,doors:s.doors,drawCalls:s.drawCalls,renderTriangles:s.renderTriangles,camera:s.cameraObstruction}}''')

def run():
    parser=argparse.ArgumentParser();parser.add_argument('--screens',type=Path)
    parser.add_argument('--brand-artwork-only', action='store_true', help='Check localized directory artwork without starting 3D')
    args=parser.parse_args()
    if args.screens:args.screens.mkdir(parents=True,exist_ok=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
    try:
      with sync_playwright() as p:
        graphics_flags = ['--disable-webgl'] if args.brand_artwork_only else [
          '--use-angle='+os.environ.get('GALLERY_WEBGL_BACKEND','swiftshader'),
          '--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
        browser=p.chromium.launch(executable_path=os.environ['GALLERY_CHROME'], args=graphics_flags)
        print('Browser:',browser.version,flush=True)
        check_brand_artwork(browser, base)
        if args.brand_artwork_only:
          browser.close()
          return
        for width,height,visitor in [(320,700,''),(390,844,''),(768,1024,''),(844,390,''),(1440,900,''),(390,844,'&visitor=v1')]:
          context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,
            has_touch=width<1000,reduced_motion='reduce',service_workers='block')
          context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
          page=context.new_page();errors=[]
          page.on('pageerror',lambda e:errors.append(str(e)))
          page.goto(mall_entry_url(probe_url(base+'?layout=expanded'+visitor)));page.wait_for_function('window.__sceneReady || window.__sceneFailed',timeout=90000)
          assert page.evaluate('window.__sceneReady===true')
          page.locator('#view-toggle').click()
          for ident,label,x in STORES:
            button=page.locator(f'[data-visit-store="{ident}"]');assert button.is_visible()
            button.scroll_into_view_if_needed();r=button.bounding_box();assert r['height']>=44 and r['width']>=44,r
            if args.screens and ident=='mili' and not visitor and width in (390,1440):
              page.screenshot(path=str(args.screens/f'directory-{width}.png'))
            button.click();page.wait_for_function('x=>Math.abs(__mall.state.x-x)<.1&&Math.abs(__mall.state.z-2.4)<.1',arg=x)
            if args.screens and not visitor and width in (390,768,1440):page.screenshot(path=str(args.screens/f'{ident}-approach-{width}.png'))
            if width==1440 and not visitor:
              walk(page,x+3.55,2.4,speed=1.9)
              page.evaluate('__mall.setInput({forward:1,yaw:0});__mall.step(2500);__mall.setInput({forward:0});__mall.step(20)')
              assert state(page)['z']>.25,('glass window should block passage',ident,state(page))
              assert page.evaluate('id=>__mall.teleport(id)',ident)
            page.evaluate('__mall.setInput({forward:1});__mall.step(1600);__mall.setInput({forward:0});__mall.step(20)')
            s=state(page);assert s['zone']==ident and s['z']<0 and s['doors'][ident]>.9,s
            if width in (390,1440) and not visitor:
              print(f'METRIC {width} {ident} inside: {s["drawCalls"]} draws, {s["renderTriangles"]} triangles',flush=True)
            page.locator('#view-toggle').click()
          assert page.locator('[data-store]:visible').count()==3 and page.locator('.product-card').count()==4
          assert all(page.locator(f'[data-store="{ident}"] h2').first.text_content()==label for ident,label,_ in STORES)
          # Start from the directory and reach each actual shelf via the real controller.
          if width in (390,1440) and not visitor:
            page.locator('[data-visit-store="newmoon"]').click()
            for sku in SKUS:
              assert page.evaluate('__mall.teleport("newmoon")')
              for x,z in APPROACH:
                walk(page,x,z,speed=1.9)
              can=page.evaluate('sku=>__mall.state.productAssets.cans[sku]',sku)
              front=can['placements'][can['reserveIndex']]
              walk(page,front['x'],BROWSE_Z,speed=1.8)
              face(page,front['x'],front['z'])
              expected=f'new-moon-{sku}-front'
              page.wait_for_function('id=>__mall.state.nearby===id',arg=expected)
              label=page.locator(f'[data-product="{expected}"]').get_attribute('data-product-name')
              inspect_product(page,width==390);assert page.locator('#product-dialog').is_visible()
              assert page.locator('#product-title').inner_text()==label
              assert page.locator('#product-shop').get_attribute('href')=='https://www.gjheshop.com/'
              assert 'unofficial' in page.locator('#product-description').inner_text().lower()
              page.wait_for_function('__newMoonPreview.state.loaded',timeout=30000)
              assert page.evaluate('__newMoonPreview.state.sku')==sku
              if args.screens and sku=='sa-425g':page.screenshot(path=str(args.screens/f'product-{width}.png'))
              page.locator('#product-add').click();page.locator('#product-close').click()
              page.wait_for_function('!document.querySelector("#product-dialog").open')
            bag_count(page,4)
            pickup=page.get_by_role('button',name='Pick up product',exact=True)
            if pickup.is_disabled():
              page.evaluate('__mall.setInput({forward:1,yaw:0});__mall.step(500);__mall.setInput({forward:0});__mall.step(20)')
            pickup.click();page.evaluate('__mall.step(1600)')
            assert page.evaluate('__mall.state.character.physicalProduct.phase')=='held'
            bag_count(page,4)
            page.get_by_role('button',name='Return to shelf',exact=True).click();page.evaluate('__mall.step(1600)')
            assert page.evaluate('__mall.state.character.physicalProduct.phase')=='empty'
            print(f'PASS {width} V2 physical pickup and return preserves the four-item bag',flush=True)
            # Each artwork point opens its official cover and the directory exhibit description.
            for ident,label,x in STORES[1:]:
              assert page.evaluate('id=>__mall.teleport(id)',ident)
              # The cookline occupies MILI's centre, while GOGO has an open central aisle.
              walk(page,x,-.85,speed=1.9)
              if ident=='mili':
                walk(page,x-1.45,-2.35,speed=1.8)
                walk(page,x-1.45,-7.85,speed=1.8)
              walk(page,x,-8.6,speed=1.8)
              face(page,x,-10.24)
              for _ in range(8):
                if state(page)['nearby']==ident:break
                click(page,'button[aria-label="Select next nearby action"]',width==390)
              assert state(page)['nearby']==ident,(ident,state(page))
              inspect_product(page,width==390);assert page.locator('#product-dialog').is_visible()
              assert page.locator('#product-title').inner_text()==label
              assert page.locator('#product-image').get_attribute('src')==f'assets/{ident}-brand-cover.jpg'
              assert_brand_copy(page.locator('#product-description'), 'en', ident)
              expect(page.locator('#product-description')).to_have_text(brand_description(page, ident).text_content())
              assert page.locator('#product-bag-actions').is_hidden();page.locator('#product-close').click()
            page.locator('#view-toggle').click();bag_count(page,4)
            page.locator('#bag-open').click();assert page.locator('#bag-items li').count()==4;page.locator('#bag-close').click()
          assert not errors,errors
          print(f'PASS {width}x{height} {visitor or "visitor=v2"}: directory destinations, physical doors'+(', four SKU and brand details, retained bag' if width in (390,1440) and not visitor else ''),flush=True)
          context.close()
        for query in ['', '?visitor=v1']:
          context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce',service_workers='block')
          context.add_init_script("localStorage.setItem('gjh-v11-tutorial-v1','dismissed')")
          page=context.new_page();page.goto(mall_entry_url(base+query));page.wait_for_function('window.__sceneReady',timeout=90000)
          for ident,label,x in STORES:
            page.locator('#view-toggle').click();page.locator(f'[data-visit-store="{ident}"]').click()
            page.wait_for_function('x=>Math.abs(__mall.state.x-x)<.1&&Math.abs(__mall.state.z-2.4)<.1',arg=x)
          print(f'PASS original scene {query or "visitor=v2"}: all three directory destinations',flush=True);context.close()
        for mode in ['no-js','physics-failure']:
          context=browser.new_context(java_script_enabled=mode!='no-js',service_workers='block');page=context.new_page()
          if mode=='physics-failure':page.route('**/rapier.mjs',lambda route:route.abort())
          page.goto(mall_entry_url(base+'?layout=expanded', '' if mode=='no-js' else 'experience'))
          if mode=='physics-failure':
            page.wait_for_function('window.__sceneFailed',timeout=90000)
            recovery=page.locator('#loader-directory')
            expect(recovery).to_be_visible()
            recovery.click()
            expect(page.locator('#store-list')).to_be_focused()
          assert page.locator('#store-list').is_visible() and page.locator('[data-store]').count()==3 and page.locator('.product-card').count()==4
          assert all(page.locator(f'[data-visit-store="{ident}"]').is_hidden() for ident,_,_ in STORES)
          print(f'PASS {mode}: readable directory and no misleading 3D action',flush=True);context.close()
        browser.close()
    finally:server.shutdown();server.server_close()
if __name__=='__main__':run()
