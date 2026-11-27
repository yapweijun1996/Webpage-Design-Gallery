"""Browser checks for Pomelo STEM V8; pass --no-capture to keep gallery media unchanged."""
import argparse
import functools
import http.server
import io
import json
import os
from pathlib import Path
import threading
import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demos/corporate/pomelo-stem/v8'
PAGES = ('index', 'commerce', 'services', 'about', 'contact')
HOME_HEIGHT_LIMITS = {320: 6000, 390: 5900}
RELEASE = json.loads((DEMO / 'release.json').read_text('utf-8'))
VERSION = RELEASE['version']
major, minor, patch = map(int, VERSION.split('.'))
NEWER = f'{major}.{minor}.{patch + 1}'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def launch(p):
    path = os.environ.get('GALLERY_CHROME')
    return p.chromium.launch(executable_path=path, headless=True) if path else p.chromium.launch(headless=True)


def check_toasts(browser, base, errors):
    """Exercise real motion, replacement and dismissal without writing screenshots."""
    for width, height in ((1440, 900), (768, 1024), (390, 844), (320, 568)):
        context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='no-preference', service_workers='block')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(base + 'index.html', wait_until='load')
            page.evaluate("document.documentElement.setAttribute('data-theme', 'light')")
            toggle = page.locator('[data-theme-toggle]').first
            toggle.evaluate('button => button.click()')
            page.wait_for_function("document.querySelector('.toast[data-key=theme]') !== null")
            strings = page.evaluate("JSON.parse(document.querySelector('#i18n-runtime').textContent)")
            assert page.locator('.toast__title').inner_text() == strings['toast.themeDark.title'], width
            assert page.locator('.toast__detail').inner_text() == strings['toast.themeDark.detail'], width
            page.evaluate("window.__themeToast = document.querySelector('.toast[data-key=theme]'); window.__themeIcon = window.__themeToast.querySelector('svg').outerHTML; window.__themeDetail = window.__themeToast.querySelector('.toast__detail').textContent")
            toggle.evaluate('button => button.click()')
            assert page.locator('.toast').count() == 1, width
            assert page.locator('.toast__title').inner_text() == strings['toast.themeLight.title'], width
            assert page.locator('.toast__detail').inner_text() == strings['toast.themeLight.detail'], width
            assert page.evaluate("window.__themeDetail !== window.__themeToast.querySelector('.toast__detail').textContent"), width
            assert page.evaluate("window.__themeToast === document.querySelector('.toast[data-key=theme]')"), width
            assert page.evaluate("window.__themeIcon !== window.__themeToast.querySelector('svg').outerHTML"), width
            page.locator('.toast__close').evaluate('button => button.click()')
            page.wait_for_function("document.querySelector('.toast') === null")

            # Sample every animation frame while the button is visible, including enter/exit/replace.
            page.evaluate('window.scrollTo(0, innerHeight * 3)')
            page.wait_for_function("document.querySelector('[data-back-to-top]').dataset.state === 'visible'")
            page.wait_for_timeout(250)
            page.evaluate("""() => {
              window.__clearanceActive = true;
              window.__clearanceFailures = [];
              window.__clearanceSamples = 0;
              const sample = () => {
                if (!window.__clearanceActive) return;
                const button = document.querySelector('[data-back-to-top]');
                const region = document.querySelector('[data-toast-region]');
                const gap = parseFloat(getComputedStyle(region).rowGap);
                const box = button.getBoundingClientRect();
                if (button.dataset.state === 'visible') {
                  for (const item of region.children) {
                    const toast = item.getBoundingClientRect();
                    window.__clearanceSamples += 1;
                    if (toast.top - box.bottom < gap - 0.5 || box.top < 0 || box.bottom > innerHeight) {
                      window.__clearanceFailures.push({toastTop: toast.top, buttonTop: box.top, buttonBottom: box.bottom, gap});
                    }
                  }
                }
                requestAnimationFrame(sample);
              };
              requestAnimationFrame(sample);
            }""")
            page.evaluate("""async () => {
              const {toast} = await import('./assets/js/core/toast.js');
              toast({key: 'clearance', messageKey: 'toast.themeLight.title', detailKey: 'toast.themeLight.detail', sticky: true});
            }""")
            page.wait_for_timeout(260)
            box = page.locator('.toast').bounding_box()
            assert box['width'] <= 360 and box['height'] >= 64, (width, box)
            title = page.locator('.toast__title').bounding_box()
            detail = page.locator('.toast__detail').bounding_box()
            assert detail['y'] >= title['y'] + title['height'], (width, title, detail)
            one_line_each = page.locator('.toast__text').evaluate("text => [...text.children].every(line => line.getBoundingClientRect().height <= parseFloat(getComputedStyle(line).lineHeight) + 0.5)")
            if one_line_each:
                assert 64 <= box['height'] <= 70, (width, box)
            assert page.locator('.toast-region').evaluate('region => parseFloat(getComputedStyle(region).rowGap)') == 8
            close = page.locator('.toast__close').bounding_box()
            assert close['width'] >= 44 and close['height'] >= 44, (width, close)
            page.evaluate("""async () => {
              const {toast} = await import('./assets/js/core/toast.js');
              toast({type: 'success', messageKey: 'toast.online.title', detailKey: 'toast.online.detail', sticky: true});
              toast({type: 'warning', messageKey: 'toast.formNotSent.title', detailKey: 'toast.formNotSent.detail', sticky: true});
            }""")
            page.wait_for_timeout(260)
            assert page.locator('.toast').count() == 3
            assert page.locator('.toast__title').count() == page.locator('.toast__detail:visible').count() == 3
            assert page.locator('.toast__title, .toast__detail').evaluate_all("lines => lines.every(line => getComputedStyle(line).webkitLineClamp === '2' && line.getBoundingClientRect().height <= 2 * parseFloat(getComputedStyle(line).lineHeight) + 0.5)"), width
            page.evaluate("""async () => {
              const {toast} = await import('./assets/js/core/toast.js');
              const {t} = await import('./assets/js/core/i18n.js');
              toast({key: 'clearance', type: 'error', messageKey: 'toast.updateError.title', detailKey: 'toast.updateError.detail',
                action: {label: t('update.retry'), onClick() {}}});
            }""")
            page.wait_for_timeout(260)
            assert page.locator('.toast').count() == 3
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            action = page.locator('.toast__action').bounding_box()
            assert action['width'] >= 44 and action['height'] >= 44, (width, action)
            page.locator('.toast__close').first.evaluate('button => button.click()')
            page.wait_for_timeout(260)
            page.locator('.toast__close').evaluate_all('buttons => buttons.forEach(button => button.click())')
            page.wait_for_function("document.querySelector('.toast') === null")
            page.evaluate('window.__clearanceActive = false')
            assert page.evaluate('window.__clearanceSamples') > 10, width
            assert not page.evaluate('window.__clearanceFailures'), (width, page.evaluate('window.__clearanceFailures'))
        finally:
            context.close()

    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(base + 'index.html', wait_until='load')
        page.mouse.move(0, 0)
        started = time.monotonic()
        page.evaluate("""async () => {
          const {toast} = await import('./assets/js/core/toast.js');
          window.__timedToast = toast({messageKey: 'toast.themeLight.title', detailKey: 'toast.themeLight.detail'});
        }""")
        page.wait_for_function('!window.__timedToast.isConnected', timeout=3500)
        assert time.monotonic() - started >= 2.8
        page.evaluate("""async () => {
          const {toast} = await import('./assets/js/core/toast.js');
          window.__timedToast = toast({messageKey: 'toast.themeLight.title', detailKey: 'toast.themeLight.detail'});
        }""")
        page.locator('.toast').hover()
        page.wait_for_timeout(3500)
        assert page.locator('.toast').count() == 1
        page.locator('.toast__close').focus()
        page.mouse.move(0, 0)
        page.wait_for_timeout(3500)
        assert page.locator('.toast').count() == 1
        page.locator('[data-menu-open]').focus()
        page.wait_for_function('!window.__timedToast.isConnected', timeout=3500)
    finally:
        context.close()


def check_release_recheck(browser, base, errors):
    """Cover same-version builds, generic dirty-page consent and focus during eviction."""
    context = browser.new_context(viewport={'width': 320, 'height': 568}, reduced_motion='no-preference', service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.route('**/release.json*', lambda route: route.fulfill(content_type='application/json', body=json.dumps({
            'version': VERSION, 'build': RELEASE['build'] + '.recheck',
        })))
        titles = {
            '': 'Reload and lose unsaved changes?',
            'zh/': '重新加载并清除未保存的内容？',
            'ms/': 'Muat semula dan buang perubahan yang belum disimpan?',
        }
        for locale, title in titles.items():
            page.goto(base + locale + 'commerce.html', wait_until='load')
            page.evaluate("""async () => {
              const root = new URL(document.querySelector('meta[name="pomelo-root"]').content, document.baseURI);
              await (await import(new URL('assets/js/core/update.js', root))).check({manual: true});
            }""")
            page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'available'")
            assert page.locator('.update-button__chip').inner_text() == 'v' + VERSION
            assert page.locator('.toast[data-key="update"]').count() == 1
            page.locator('[data-add="mug"]').click()
            assert page.locator('[data-commerce-demo]').get_attribute('data-dirty') == 'true'
            page.locator('[data-update]').click()
            page.locator('.dialog[role="alertdialog"]').wait_for()
            assert page.locator('[data-update-loader]').count() == 0
            assert page.locator('.dialog__title').inner_text() == title, locale
            assert page.locator('.dialog').evaluate("panel => { const body = document.getElementById(panel.getAttribute('aria-describedby')); return body?.tagName === 'P' && panel.contains(body) && body.textContent.trim().length > 0; }")
            page.keyboard.press('Escape')
            page.locator('.dialog').wait_for(state='detached')
            assert page.locator('[data-update-loader]').count() == 0
            assert page.locator('[data-update]').get_attribute('data-state') == 'available'

        # Restored/autofilled input must trigger consent without an input event or data-dirty.
        page.goto(base + 'contact.html', wait_until='load')
        page.evaluate("""async () => {
          document.querySelector('form input').value = 'Restored input';
          const module = await import('./assets/js/core/update.js');
          void module.apply();
        }""")
        page.locator('.dialog[role="alertdialog"]').wait_for()
        assert not page.locator('[data-dirty="true"]').count()
        assert page.locator('.dialog__title').inner_text() == titles['']
        page.keyboard.press('Escape')
        page.locator('.dialog').wait_for(state='detached')

        page.goto(base + 'index.html', wait_until='load')
        page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'available'")
        page.locator('.toast__close').evaluate_all('buttons => buttons.forEach(button => button.click())')
        page.wait_for_function("document.querySelector('[data-toast-region]').hidden")
        page.evaluate("""async () => {
          const {toast} = await import('./assets/js/core/toast.js');
          const region = document.querySelector('[data-toast-region]');
          if (!region.hidden) throw new Error('Empty toast region must be hidden');
          const first = toast({key: 'focus-first', title: 'First', sticky: true});
          const second = toast({key: 'focus-second', title: 'Second', sticky: true});
          toast({key: 'focus-third', title: 'Third', sticky: true});
          first.querySelector('.toast__close').focus();
          toast({key: 'focus-fourth', title: 'Fourth', sticky: true});
          if (first.isConnected || region.children.length !== 3) throw new Error('Capacity eviction failed');
          if (document.activeElement !== second.querySelector('.toast__close') || !document.activeElement.isConnected) {
            throw new Error('Focused eviction must move focus to the next toast close button');
          }
          if (region.hidden || region.getAttribute('role') !== 'region' || !region.getAttribute('aria-label')) {
            throw new Error('Populated toast region must remain accessible and named');
          }
        }""")
        assert page.evaluate("document.activeElement.matches('.toast__close') && document.activeElement.isConnected")
        page.locator('.toast__close').evaluate_all('buttons => buttons.forEach(button => button.click())')
        page.wait_for_function("document.querySelector('[data-toast-region]').hidden")
        assert page.locator('[role="status"]').count() >= 1
        assert page.locator('[role="alert"]').count() == 1
    finally:
        context.close()


def assert_loader_brand(loader, tagline):
    """Check decorative branding, placement, theme contrast and narrow text layout."""
    mark = loader.locator('svg.loader__mark')
    assert mark.is_visible()
    assert mark.get_attribute('aria-hidden') == 'true'
    assert mark.get_attribute('focusable') == 'false'
    assert mark.locator('title, desc, [id], [href], [src]').count() == 0
    text = loader.locator('.loader__tagline')
    assert text.inner_text() == tagline
    assert text.is_visible()
    box = mark.bounding_box()
    card = loader.locator('.loader__card').bounding_box()
    assert box['width'] == box['height'] == 64
    assert abs(box['x'] + box['width'] / 2 - card['x'] - card['width'] / 2) <= 1
    assert text.bounding_box()['y'] >= box['y'] + box['height']
    assert text.evaluate('node => node.scrollWidth <= node.clientWidth')
    assert loader.locator('.loader__card').evaluate('node => node.scrollWidth <= node.clientWidth')
    assert loader.evaluate("""node => {
      const luminance = color => {
        const channels = color.match(/[0-9.]+/g).slice(0, 3).map(v => {
          const c = Number(v) / 255;
          return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const background = luminance(getComputedStyle(node.querySelector('.loader__card')).backgroundColor);
      const contrast = color => {
        const foreground = luminance(color);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      };
      return contrast(getComputedStyle(node.querySelector('.loader__mark path')).fill) >= 3 &&
        contrast(getComputedStyle(node.querySelector('.loader__tagline')).color) >= 4.5;
    }""")


def check_update_loader_branding(browser, base, errors):
    context = browser.new_context(viewport={'width': 320, 'height': 568}, service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        for locale, tagline in {'': 'Growing Smarter Solutions.', 'zh/': '智慧方案，伴你成长。',
                                'ms/': 'Penyelesaian pintar untuk terus berkembang.'}.items():
            page.goto(base + locale + 'index.html', wait_until='load')
            page.evaluate("""async version => {
              const root = document.querySelector('meta[name=pomelo-root]').content;
              const {show} = await import(root + 'assets/js/core/loader.js');
              const {t} = await import(root + 'assets/js/core/i18n.js');
              window.__brandLoader = show({title: t('loader.updateTitle', {version}), detail: t('loader.updateDetail')});
            }""", VERSION)
            loader = page.locator('[data-update-loader]')
            assert loader.locator('.loader__mark').evaluate('node => node.outerHTML === document.querySelector("#page-loader .loader__mark").outerHTML')
            for theme in ('light', 'dark'):
                page.evaluate('theme => { document.documentElement.dataset.theme = theme; }', theme)
                for motion in ('no-preference', 'reduce'):
                    page.emulate_media(reduced_motion=motion)
                    assert_loader_brand(loader, tagline)
                    indicator = loader.locator('.loader__indicator')
                    if motion == 'reduce':
                        assert indicator.is_hidden()
                        assert loader.evaluate('node => node.getAnimations({subtree: true}).length') == 0
                    else:
                        assert indicator.is_visible()
                        assert indicator.evaluate('node => getComputedStyle(node).animationName') == 'loader-spin'
            page.evaluate('window.__brandLoader.close()')
    finally:
        context.close()


def check_page_loaders(browser, base, errors):
    """Check early critical CSS, delayed readiness, module failure and the no-JS fallback."""
    copies = {'': 'Loading…', 'zh/': '正在加载…', 'ms/': 'Memuatkan…'}
    taglines = {'': 'Growing Smarter Solutions.', 'zh/': '智慧方案，伴你成长。',
                'ms/': 'Penyelesaian pintar untuk terus berkembang.'}
    context = browser.new_context(viewport={'width': 320, 'height': 568}, reduced_motion='reduce', service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.add_init_script("""window.__loaderShows = 0;
          new MutationObserver(records => {
            for (const record of records) {
              if (record.target.id === 'page-loader' && record.attributeName === 'hidden' && !record.target.hidden) window.__loaderShows += 1;
            }
          }).observe(document, {subtree: true, attributes: true, attributeFilter: ['hidden']});
          const schedule = window.setTimeout.bind(window);
          window.setTimeout = (fn, delay, ...args) => {
            const timer = schedule(fn, delay, ...args);
            if (delay === 8000) window.__loaderSafety = () => { clearTimeout(timer); fn(...args); };
            return timer;
          };
        """)
        page.goto(base + 'index.html', wait_until='load')
        assert page.evaluate('window.__loaderShows') == 0
        assert page.locator('#page-loader').is_hidden()

        # Hold parsing at the end of the body, so neither modules nor DOMContentLoaded can mark it ready.
        pending = []
        styles = []
        page.route('**/loader-test.js', lambda route: pending.append(route))
        page.route('**/site.bundle.css*', lambda route: styles.append(route))

        def delay_document(route):
            locale = next((locale for locale in copies if locale and f'/{locale}' in route.request.url), '')
            html = (DEMO / locale / 'index.html').read_text('utf-8')
            route.fulfill(status=200, content_type='text/html', body=html.replace('</body>', '<script src="loader-test.js"></script></body>'))

        page.route('**/index.html', delay_document)
        for locale, copy in copies.items():
            pending.clear()
            styles.clear()
            page.goto(base + locale + 'index.html', wait_until='commit')
            page.locator('#page-loader').wait_for(state='visible')
            assert page.locator('#page-loader .loader__title').inner_text() == copy
            assert page.locator('#main').get_attribute('aria-busy') == 'true'
            assert page.locator('#page-loader [role="status"]').get_attribute('aria-live') == 'polite'
            assert not page.locator('#page-loader').evaluate('node => node.contains(document.activeElement)')
            # scrollbar-gutter: stable keeps a scrollbar slot, so the loader covers the client area.
            box = page.locator('#page-loader').bounding_box()
            assert box['x'] == 0 and box['y'] == 0 and box['height'] == 568, box
            assert 300 <= box['width'] <= 320, box
            assert page.locator('#page-loader .loader__indicator').evaluate('node => getComputedStyle(node).animationName') == 'none'
            assert page.locator('#page-loader .loader__indicator').is_hidden()
            assert page.locator('#page-loader').evaluate('node => node.getAnimations({subtree: true}).length') == 0
            for theme in ('light', 'dark'):
                page.evaluate('(theme) => { document.documentElement.dataset.theme = theme; }', theme)
                assert page.locator('#page-loader .loader__card').evaluate('node => getComputedStyle(node).backgroundColor !== "rgba(0, 0, 0, 0)"')
                assert_loader_brand(page.locator('#page-loader'), taglines[locale])
            assert pending and styles
            if locale == 'ms/':
                page.evaluate('window.__loaderSafety()')
            elif locale == 'zh/':
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}))")
            else:
                for route in styles:
                    route.continue_()
                styles.clear()
                pending[0].fulfill(status=200, content_type='text/javascript', body='')
                pending.clear()
            page.locator('#page-loader').wait_for(state='hidden')
            assert page.locator('#main').get_attribute('aria-busy') is None
            assert not page.locator('body').evaluate('node => node.classList.contains("is-loading")')
            for route in styles:
                route.continue_()
            for route in pending:
                route.fulfill(status=200, content_type='text/javascript', body='')
            page.wait_for_load_state('load')
            assert page.locator('#page-loader').is_hidden()
        page.unroute('**/index.html')
        page.unroute('**/loader-test.js')
        page.unroute('**/site.bundle.css*')
        page.route('**/assets/js/main.js*', lambda route: route.abort())
        page.goto(base + 'index.html', wait_until='load')
        assert page.locator('#page-loader').is_hidden()
        assert page.locator('h1').is_visible()
    finally:
        context.close()
    context = browser.new_context(java_script_enabled=False, viewport={'width': 320, 'height': 568})
    try:
        page = context.new_page()
        page.goto(base + 'index.html', wait_until='load')
        assert page.locator('#page-loader').is_hidden()
        assert page.locator('h1').is_visible()
        assert page.locator('#main').get_attribute('aria-busy') is None
    finally:
        context.close()


def check_late_page_loader(browser, base, errors):
    """Pause parsing before the body arrives, then keep readiness pending after it arrives."""
    context = browser.new_context(viewport={'width': 320, 'height': 568}, service_workers='block')
    context.add_init_script("""(() => {
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => {
        const timer = schedule(callback, delay, ...args);
        if (delay === 8000) window.__loaderSafety = () => { clearTimeout(timer); callback(...args); };
        return timer;
      };
    })();""")
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    head, tail = [], []
    html = (DEMO / 'index.html').read_text('utf-8')
    html = html.replace('</head>', '<script src="late-head.js"></script></head>')
    html = html.replace('</body>', '<script src="late-tail.js"></script></body>')
    page.route('**/index.html', lambda route: route.fulfill(content_type='text/html', body=html))
    page.route('**/late-head.js', lambda route: head.append(route))
    page.route('**/late-tail.js', lambda route: tail.append(route))
    try:
        for cutoff in (False, True):
            page.goto(base + 'index.html', wait_until='commit')
            page.wait_for_function('typeof window.__loaderSafety === "function"')
            page.wait_for_timeout(500)
            assert head and page.locator('#page-loader').count() == 0
            if cutoff:
                page.evaluate('window.__loaderSafety()')
            head.pop().fulfill(content_type='text/javascript', body='')
            page.wait_for_function('document.querySelector("#main") !== null')
            loader = page.locator('#page-loader')
            if cutoff:
                assert loader.is_hidden()
            else:
                loader.wait_for(state='visible')
                assert page.locator('body').evaluate('node => node.classList.contains("is-loading")')
                assert not loader.evaluate('node => node.contains(document.activeElement)')
            assert tail
            tail.pop().fulfill(content_type='text/javascript', body='')
            page.wait_for_load_state('load')
            assert loader.is_hidden()
            assert not page.locator('body').evaluate('node => node.classList.contains("is-loading")')
    finally:
        context.close()


def check_scroll_lock_width(browser, base, errors):
    """Compare actual content widths for page loading, modal loading and dialogs on desktop.

    The scrollbar slot is reserved from 1024px; phones use overlay scrollbars, and keeping small
    screens at full width protects the 320/390 home-height limits.
    """
    for width in (1440, 1024):
        context = browser.new_context(viewport={'width': width, 'height': 568}, service_workers='block')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(base + 'index.html', wait_until='load')
            assert page.locator('html').evaluate('node => getComputedStyle(node).scrollbarGutter') == 'stable'
            # Custom scrollbars also exercise reserved desktop space on overlay-scrollbar hosts.
            if width >= 768:
                page.add_style_tag(content='::-webkit-scrollbar { width: 16px; }')
            measure = """() => ['body', '#main', 'h1'].map(selector => {
              const box = document.querySelector(selector).getBoundingClientRect();
              return {width: box.width, left: box.left};
            })"""
            baseline = page.evaluate(measure)
            assert baseline[0]['width'] > 0
            page.evaluate("document.body.classList.add('is-loading'); document.querySelector('#page-loader').hidden = false")
            assert page.evaluate(measure) == baseline, ('page loader', width)
            page.evaluate("document.body.classList.remove('is-loading'); document.querySelector('#page-loader').hidden = true")
            assert page.evaluate(measure) == baseline, ('page loader closed', width)
            for overlay in ('loader', 'dialog'):
                page.evaluate("""async overlay => {
                  const button = document.querySelector('[data-update]');
                  button.focus();
                  if (overlay === 'loader') {
                    const {show} = await import('./assets/js/core/loader.js');
                    window.__widthOverlay = show({returnFocus: button});
                  } else {
                    const {open} = await import('./assets/js/core/dialog.js');
                    window.__widthOverlay = open();
                  }
                }""", overlay)
                assert page.locator('body').evaluate('node => node.classList.contains("is-locked")')
                assert page.evaluate(measure) == baseline, (overlay, width)
                page.evaluate('window.__widthOverlay.close()')
                assert page.evaluate(measure) == baseline, (overlay + ' closed', width)
        finally:
            context.close()


def check_release_safety(browser, base, errors):
    """Exercise timeout cancellation, final consent and native no-JS submission."""
    context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    context.add_init_script("""(() => {
      const sw = new EventTarget();
      sw.register = async () => ({});
      sw.getRegistration = async () => ({
        update: () => new Promise(resolve => { window.__finishUpdate = resolve; }),
        waiting: {postMessage() { window.__skipWaiting = true; }}
      });
      Object.defineProperty(navigator, 'serviceWorker', {value: sw});
      window.__updateSW = sw;
      const schedule = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => {
        const timer = schedule(callback, delay, ...args);
        if (delay === 12000) window.__expireApply = () => { clearTimeout(timer); callback(...args); };
        return timer;
      };
    })();""")
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    navigations = []
    page.on('framenavigated', lambda frame: navigations.append(frame.url) if frame == page.main_frame else None)
    try:
        page.goto(base + 'contact.html', wait_until='load')
        # Old cached HTML may not contain any page-open loader template.
        page.evaluate("""() => {
          window.__markGeometry = node => [node.tagName, [...node.attributes]
            .filter(attr => attr.name !== 'xmlns').map(attr => [attr.name, attr.value]).sort(),
            [...node.children].map(window.__markGeometry)];
          const mark = document.querySelector('#page-loader .loader__mark');
          window.__expectedMark = window.__markGeometry(mark);
          mark.remove();
        }""")
        page.evaluate("async () => { const module = await import('./assets/js/core/update.js'); void module.apply(); }")
        page.wait_for_function('typeof window.__finishUpdate === "function"')
        loader = page.locator('[data-update-loader]')
        loader.wait_for(state='visible')
        assert loader.locator('.loader__mark').evaluate('node => JSON.stringify(window.__markGeometry(node)) === JSON.stringify(window.__expectedMark)')
        assert loader.locator('[role="alertdialog"]').get_attribute('aria-modal') == 'true'
        assert loader.locator('[role="status"]').get_attribute('aria-live') == 'polite'
        assert loader.evaluate('node => node.contains(document.activeElement)')
        for key in ('Tab', 'Shift+Tab', 'Escape'):
            page.keyboard.press(key)
            assert loader.evaluate('node => node.contains(document.activeElement)')
        assert page.locator('#main').evaluate('node => node.inert')
        assert page.locator('[data-toast-region]').evaluate('node => node.inert')
        assert page.evaluate("document.elementFromPoint(1, 1).closest('[data-update-loader]') !== null")
        for theme in ('light', 'dark'):
            page.evaluate('(theme) => { document.documentElement.dataset.theme = theme; }', theme)
            for width in (320, 390):
                page.set_viewport_size({'width': width, 'height': 568})
                box = loader.bounding_box()
                # scrollbar-gutter: stable may reserve a classic scrollbar slot on desktop engines.
                assert box['x'] == 0 and box['y'] == 0 and box['height'] == 568 and width - 20 <= box['width'] <= width, box
                card = loader.locator('.loader__card').bounding_box()
                assert card['x'] >= 0 and card['x'] + card['width'] <= width, (theme, width, card)
                assert loader.locator('.loader__card').evaluate('node => getComputedStyle(node).color !== getComputedStyle(node).backgroundColor')
                assert loader.locator('.loader__card').evaluate("node => { const p = document.getElementById(node.getAttribute('aria-describedby')); return p && node.contains(p) && p.textContent.length > 0; }")
        page.emulate_media(reduced_motion='reduce')
        assert loader.locator('.loader__indicator').evaluate('node => getComputedStyle(node).animationName') == 'none'
        page.evaluate('window.__finishUpdate()')
        page.wait_for_function('window.__skipWaiting === true')
        before = len(navigations)
        page.evaluate("window.__expireApply(); window.__updateSW.dispatchEvent(new Event('controllerchange'))")
        page.wait_for_timeout(150)
        assert page.locator('[data-update]').get_attribute('data-state') == 'error'
        assert page.locator('[data-update]').is_enabled()
        assert loader.count() == 0
        assert page.locator('[data-update]').evaluate('node => document.activeElement === node')
        assert not page.locator('#main').evaluate('node => node.inert')
        assert len(navigations) == before, navigations

        page.goto(base + 'contact.html', wait_until='load')
        page.evaluate("async () => { const module = await import('./assets/js/core/update.js'); void module.apply(); }")
        page.wait_for_function('typeof window.__finishUpdate === "function"')
        # Simulate restored input while the modal correctly prevents physical editing.
        page.locator('#f-name').evaluate("node => { node.value = 'Keep this draft'; node.dispatchEvent(new Event('input', {bubbles: true})); }")
        page.evaluate('window.__finishUpdate()')
        page.wait_for_function('window.__skipWaiting === true')
        before = len(navigations)
        page.evaluate("window.__updateSW.dispatchEvent(new Event('controllerchange')); window.__updateSW.dispatchEvent(new Event('controllerchange'))")
        page.locator('.dialog[role="alertdialog"]').wait_for()
        assert page.locator('.dialog').count() == 1
        assert loader.count() == 0
        page.keyboard.press('Escape')
        page.locator('.dialog').wait_for(state='detached')
        assert page.locator('#f-name').input_value() == 'Keep this draft'
        assert page.locator('[data-update]').get_attribute('data-state') == 'available'
        assert page.locator('[data-update]').is_enabled()
        assert page.locator('[data-update]').evaluate('node => document.activeElement === node')
        page.evaluate("window.__updateSW.dispatchEvent(new Event('controllerchange'))")
        page.wait_for_timeout(100)
        assert len(navigations) == before

        # Consent can be retried, and even duplicate controller events reload only once.
        page.evaluate('window.__finishUpdate = null')
        page.locator('[data-update]').click()
        assert loader.count() == 0
        page.locator('.dialog__actions button').last.click()
        page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'applying'")
        page.wait_for_function('typeof window.__finishUpdate === "function"')
        page.evaluate('window.__skipWaiting = false; window.__finishUpdate()')
        page.wait_for_function('window.__skipWaiting === true')
        page.evaluate("window.__updateSW.dispatchEvent(new Event('controllerchange')); window.__updateSW.dispatchEvent(new Event('controllerchange'))")
        page.locator('.dialog__actions button').last.click()
        page.wait_for_function('!window.__finishUpdate')
        page.wait_for_timeout(100)
        assert len(navigations) == before + 1, navigations
        assert page.locator('[data-update-loader]').count() == 0

        page.goto(base + 'commerce.html', wait_until='load')
        page.locator('#prep-1').check()
        assert page.evaluate("async () => (await import('./assets/js/core/unsaved.js')).hasUnsavedInput()")
        page.reload(wait_until='load')
        assert not page.locator('#prep-1').is_checked()
        # Restored controls are exempt only when explicitly marked as persisted.
        assert page.evaluate("""async () => {
          const {hasUnsavedInput} = await import('./assets/js/core/unsaved.js');
          const persisted = document.createElement('div');
          persisted.dataset.unsaved = 'ignore';
          const field = document.createElement('input');
          persisted.append(field);
          document.body.append(persisted);
          field.value = 'Automatically restored';
          if (hasUnsavedInput()) return false;
          field.dataset.unsaved = 'track';
          return hasUnsavedInput();
        }""")
    finally:
        context.close()

    context = browser.new_context(java_script_enabled=False, service_workers='block')
    page = context.new_page()
    try:
        for locale in ('', 'zh/', 'ms/'):
            url = base + locale + 'contact.html'
            page.goto(url, wait_until='load')
            assert page.locator('form button[type="submit"]').is_disabled()
            note = page.locator('[data-form-fallback]')
            assert note.is_visible()
            assert note.locator('a').get_attribute('href') == 'https://wa.me/601139023123'
            assert page.locator('form button[type="submit"]').evaluate("button => getComputedStyle(button).cursor") == 'not-allowed'
            page.locator('#f-name').fill('Private name')
            page.locator('#f-message').fill('Private message')
            page.locator('#f-name').press('Enter')
            page.locator('form button[type="submit"]').scroll_into_view_if_needed()
            box = page.locator('form button[type="submit"]').bounding_box()
            page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            page.wait_for_timeout(100)
            assert page.url == url, page.url
            assert page.locator('#f-name').input_value() == 'Private name'
            assert page.locator('#f-message').input_value() == 'Private message'
    finally:
        context.close()


def check_qa825(browser, base, errors):
    """Cover reversible drafts, nested dialogs, localized statuses and honest prep completion."""
    context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        for locale in ('', 'zh/', 'ms/'):
            strings = json.loads((DEMO / 'i18n' / (locale.strip('/') or 'en')).with_suffix('.json').read_text('utf-8'))
            page.goto(base + locale + 'contact.html', wait_until='load')
            page.wait_for_function("!document.querySelector('form button[type=submit]').disabled")
            assert page.locator('[data-form-fallback]').is_hidden()
            for field in ('#f-name', '#f-business', '#f-message'):
                page.locator(field).fill('Draft')
                assert page.evaluate("async () => { const root = new URL(document.querySelector('meta[name=pomelo-root]').content, document.baseURI); return (await import(new URL('assets/js/core/unsaved.js', root))).hasUnsavedInput(); }")
                page.locator(field).fill('')
                assert not page.evaluate("async () => { const root = new URL(document.querySelector('meta[name=pomelo-root]').content, document.baseURI); return (await import(new URL('assets/js/core/unsaved.js', root))).hasUnsavedInput(); }")
            page.goto(base + locale + 'commerce.html', wait_until='load')
            page.wait_for_function("document.querySelector('[data-order-total]').textContent.length > 0")
            statuses = page.locator('[data-step-status]')
            assert statuses.all_text_contents() == [strings['pickup.status.pending']] * 3
            for index in range(1, 4):
                page.locator(f'#prep-{index}').check()
            assert page.locator('[data-step].is-done').count() == 0
            assert page.locator('.toast__title').last.inner_text() == strings['toast.studioDone.detail']
            assert page.locator('.toast__detail').last.is_hidden()
            for index in range(1, 4):
                page.locator(f'#prep-{index}').uncheck()
            assert not page.evaluate("async () => { const root = new URL(document.querySelector('meta[name=pomelo-root]').content, document.baseURI); return (await import(new URL('assets/js/core/unsaved.js', root))).hasUnsavedInput(); }")
            page.locator('[data-add="mug"]').click()
            assert statuses.all_text_contents() == [strings['pickup.status.done'], strings['pickup.status.pending'], strings['pickup.status.pending']]
            for index in range(1, 4):
                page.locator(f'#prep-{index}').check()
            assert statuses.all_text_contents() == [strings['pickup.status.done'], strings['pickup.status.done'], strings['pickup.status.pending']]
            assert page.locator('.toast__title').last.inner_text() == strings['toast.studioDone.title']
            page.locator('#prep-1').uncheck()
            assert statuses.nth(1).text_content() == strings['pickup.status.pending']

        page.goto(base + 'contact.html', wait_until='load')
        page.locator('[data-menu-open]').click()
        page.evaluate("""async () => {
          const {confirm} = await import('./assets/js/core/dialog.js');
          void confirm({title: 'Update confirmation', body: 'Reload this demo?'});
        }""")
        assert page.locator('.dialog').count() == 2
        assert page.locator('.dialog-backdrop').first.evaluate('node => node.inert')
        page.keyboard.press('Escape')
        assert page.locator('.dialog').count() == 1
        assert page.locator('body').evaluate("node => node.classList.contains('is-locked')")
        assert page.locator('#main').evaluate('node => node.inert')
        assert not page.locator('.dialog-backdrop').evaluate('node => node.inert')
        assert page.evaluate("document.querySelector('.dialog').contains(document.activeElement)")
        page.keyboard.press('Escape')
        assert not page.locator('body').evaluate("node => node.classList.contains('is-locked')")
        assert not page.locator('#main').evaluate('node => node.inert')

        # A failed module must leave the server-rendered note available in every locale.
        page.route('**/assets/js/main.js*', lambda route: route.abort())
        for locale in ('', 'zh/', 'ms/'):
            page.goto(base + locale + 'contact.html', wait_until='load')
            assert page.locator('form button[type="submit"]').is_disabled()
            assert page.locator('[data-form-fallback]').is_visible()
    finally:
        context.close()

    # Exercise both listeners in a real page. Exact reload-call counting is covered in Node.
    context = browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    context.add_init_script("""(() => {
      const sw = new EventTarget();
      window.__controllerBuild = sessionStorage.getItem('qa825-controller-build') || 'old';
      sw.controller = {postMessage(message, ports) { ports[0].postMessage({build: window.__controllerBuild}); }};
      sw.register = async () => ({});
      sw.getRegistration = async () => ({update: async () => {}, waiting: {postMessage() {
        window.__waitingRequests = (window.__waitingRequests || 0) + 1;
      }}});
      Object.defineProperty(navigator, 'serviceWorker', {value: sw});
      window.__sharedSW = sw;
    })();""")
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    navigations = []
    page.on('framenavigated', lambda frame: navigations.append(frame.url) if frame == page.main_frame else None)
    try:
        page.goto(base + 'index.html', wait_until='load')
        page.wait_for_function('window.__waitingRequests === 1')
        page.evaluate("async () => { await (await import('./assets/js/core/update.js')).apply(); }")
        page.wait_for_function('window.__waitingRequests === 2')
        page.evaluate("window.__controllerBuild = document.querySelector('meta[name=pomelo-build]').content; sessionStorage.setItem('qa825-controller-build', window.__controllerBuild); window.__sharedSW.dispatchEvent(new Event('controllerchange'))")
        page.wait_for_function('!window.__waitingRequests')
        page.wait_for_timeout(150)
        assert len(navigations) == 2, navigations
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-capture', action='store_true', help='Run checks without rewriting gallery media')
    args = parser.parse_args()
    handler = functools.partial(Quiet, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}/demos/corporate/pomelo-stem/v8/'
    errors = []
    try:
        with sync_playwright() as p:
            browser = launch(p)
            check_toasts(browser, base, errors)
            check_release_recheck(browser, base, errors)
            check_page_loaders(browser, base, errors)
            check_late_page_loader(browser, base, errors)
            check_scroll_lock_width(browser, base, errors)
            check_update_loader_branding(browser, base, errors)
            check_release_safety(browser, base, errors)
            check_qa825(browser, base, errors)
            for width, height in ((1440, 900), (768, 1024), (390, 844), (375, 812), (320, 568)):
                context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce', service_workers='block')
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
                for locale in ('', 'zh/', 'ms/'):
                    for name in PAGES:
                        response = page.goto(base + locale + name + '.html', wait_until='load')
                        assert response.status == 200, (width, locale, name)
                        assert page.locator('h1').count() == 1, (width, locale, name)
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, locale, name)
                        assert page.locator('.update-button__chip').inner_text() == 'v' + VERSION
                        assert page.locator('#page-loader').is_hidden()
                        assert page.locator('[data-update-loader]').count() == 0
                        if name == 'index' and width in HOME_HEIGHT_LIMITS:
                            home_height = page.evaluate('document.documentElement.scrollHeight')
                            assert home_height <= HOME_HEIGHT_LIMITS[width], (width, locale, home_height, HOME_HEIGHT_LIMITS[width])
                        if width <= 400:
                            for control in page.locator('a[href]:visible, button:visible, .check-group label:visible').all():
                                if control.get_attribute('class') == 'skip-link':
                                    continue
                                box = control.bounding_box()
                                assert box['width'] >= 44 and box['height'] >= 44, (width, locale, name, control.evaluate('el => el.outerHTML'), box)
                if not args.no_capture and width in (1440, 768, 390):
                    page.goto(base + 'index.html', wait_until='load')
                    page.wait_for_function("[...document.images].filter(i => i.loading !== 'lazy').every(i => i.complete)")
                    page.screenshot(path=str(DEMO / 'screenshots' / f'{width}.png'))
                    if width == 1440:
                        from PIL import Image
                        image = Image.open(io.BytesIO(page.screenshot())).convert('RGB').resize((720, 450), Image.LANCZOS)
                        image.save(DEMO / 'assets/thumbnail.webp', 'WEBP', quality=82)
                context.close()

            context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', service_workers='block')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            # Commerce: tabs switch without moving the page, add-to-order updates count and toasts.
            page.goto(base + 'commerce.html')
            page.locator('#tab-shop').scroll_into_view_if_needed()
            y = page.evaluate('scrollY')
            page.locator('[data-add="mug"]').click()
            page.locator('[data-add="bowl"]').click()
            page.locator('.toast').first.wait_for()
            assert page.locator('[data-order-count]').inner_text() == '2'
            page.locator('#tab-order').click()
            assert page.locator('#panel-order').is_visible()
            assert abs(page.evaluate('scrollY') - y) < 2
            assert page.locator('[data-order-total]').inner_text().replace('\xa0', ' ') == 'RM 83.00', page.locator('[data-order-total]').inner_text()
            page.keyboard.press('ArrowRight')
            assert page.evaluate("document.activeElement.getAttribute('role')") == 'tab'
            # Demo note opens an accessible dialog that traps focus and closes on Escape.
            page.locator('[data-demo-note]').first.click()
            dialog = page.locator('.dialog')
            dialog.wait_for()
            assert dialog.get_attribute('role') in ('dialog', 'alertdialog')
            assert page.evaluate("document.querySelector('.dialog').contains(document.activeElement)")
            for _ in range(5):
                page.keyboard.press('Tab')
                assert page.evaluate("document.querySelector('.dialog').contains(document.activeElement)")
            page.keyboard.press('Escape')
            dialog.wait_for(state='detached')
            # Mobile menu sheet.
            page.evaluate("const probe = document.createElement('div'); probe.id = 'inert-probe'; probe.inert = true; document.body.append(probe)")
            page.locator('[data-menu-open]').click()
            assert page.locator('.dialog .dialog-nav a').count() == 5
            page.locator('.dialog [data-theme-toggle]').click()
            assert page.locator('[data-toast-region]').evaluate('node => !node.inert && !node.closest("[inert]")')
            assert page.locator('[data-toast-live]').count() == 2
            assert page.locator('[data-toast-live]').evaluate_all('nodes => nodes.every(node => !node.inert && !node.closest("[inert]"))')
            assert page.locator('#main').evaluate('node => node.inert')
            page.evaluate("async () => { const {toast} = await import('./assets/js/core/toast.js'); toast({key: 'dialog-focus', title: 'Focus check', sticky: true}); }")
            for _ in range(14):
                page.keyboard.press('Tab')
                assert page.evaluate("document.querySelector('.dialog').contains(document.activeElement)")
            page.locator('.toast[data-key="dialog-focus"] .toast__close').focus()
            page.keyboard.press('Tab')
            assert page.evaluate("document.querySelector('.dialog').contains(document.activeElement)")
            page.keyboard.press('Escape')
            assert not page.locator('#main').evaluate('node => node.inert')
            assert page.locator('#inert-probe').evaluate('node => node.inert')
            assert page.locator('[data-toast-region], [data-toast-live]').evaluate_all('nodes => nodes.every(node => !node.inert)')
            # Language button: disclosure with keyboard support, page does not move.
            page.goto(base + 'services.html#faq')
            lang_button = page.locator('[data-lang-menu] button')
            assert lang_button.is_visible() and lang_button.get_attribute('aria-expanded') == 'false'
            y = page.evaluate('scrollY')
            lang_button.click()
            assert lang_button.get_attribute('aria-expanded') == 'true'
            assert abs(page.evaluate('scrollY') - y) < 2
            assert page.locator('[data-lang-menu] [aria-current="true"]').get_attribute('data-lang') == 'en'
            assert page.locator('[data-lang-menu] a[data-lang="zh"]').get_attribute('href').endswith('services.html#faq')
            box = page.locator('[data-lang-menu] ul').bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= 390, box
            page.keyboard.press('Escape')
            assert lang_button.get_attribute('aria-expanded') == 'false'
            assert page.evaluate("document.activeElement.closest('[data-lang-menu]') !== null")
            lang_button.focus()
            page.keyboard.press('ArrowDown')
            assert page.evaluate("document.activeElement.dataset.lang") == 'en'
            page.mouse.click(5, 400)
            assert lang_button.get_attribute('aria-expanded') == 'false'
            page.locator('[data-lang-menu] button').click()
            page.locator('[data-lang-menu] a[data-lang="ms"]').click()
            page.wait_for_url('**/ms/services.html#faq')
            # Back-to-top appears after scrolling, returns to top and focuses h1.
            page.goto(base + 'index.html')
            top = page.locator('[data-back-to-top]')
            assert top.get_attribute('data-state') == 'hidden'
            page.evaluate('window.scrollTo(0, innerHeight * 3)')
            page.wait_for_function("document.querySelector('[data-back-to-top]').dataset.state === 'visible'")
            tb = top.bounding_box()
            assert tb['width'] >= 44 and tb['x'] + tb['width'] <= 390 and tb['y'] + tb['height'] <= 844
            top.click()
            page.wait_for_function('scrollY === 0')
            page.wait_for_function("document.activeElement && document.activeElement.tagName === 'H1'")
            page.wait_for_function("document.querySelector('[data-back-to-top]').dataset.state === 'hidden'")
            # Four distinct toasts do not freeze the page and at most three stay.
            page.goto(base + 'commerce.html')
            for item in ('mug', 'bowl', 'basket'):
                page.locator(f'[data-add="{item}"]').click()
            page.locator('[data-theme-toggle]').first.evaluate('b => b.click()')
            assert page.evaluate('1 + 1') == 2
            assert page.locator('.toast-region .toast:not(.is-leaving)').count() <= 3
            page.evaluate("document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('pomelo-v8-theme')")
            # Theme toggle persists.
            page.goto(base + 'index.html')
            page.locator('[data-menu-open]').click()
            page.locator('.dialog [data-theme-toggle]').click()
            assert page.locator('html').get_attribute('data-theme') == 'dark'
            page.keyboard.press('Escape')
            page.reload()
            assert page.locator('html').get_attribute('data-theme') == 'dark'
            # Update button: manual check says current, then a newer release offers an update.
            page.locator('[data-update]').click()
            page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'current'")
            page.route('**/release.json*', lambda route: route.fulfill(content_type='application/json', body=json.dumps({'version': NEWER, 'build': '20990101.1'})))
            page.evaluate("localStorage.clear()")
            page.reload()
            page.locator('[data-update]').click()
            page.wait_for_function("document.querySelector('[data-update]').dataset.state === 'available'")
            page.unroute('**/release.json*')
            # Contact form validates without sending anything.
            posted = []
            page.on('request', lambda request: posted.append(request.url) if request.method != 'GET' else None)
            page.goto(base + 'contact.html')
            page.locator('form button[type="submit"]').click()
            assert page.locator('[aria-invalid="true"]').count() >= 1
            assert not posted
            context.close()

            # Scroll motion: below-the-fold blocks reveal on scroll; reduced motion and no JS show everything.
            for reduced in ('no-preference', 'reduce'):
                context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion=reduced, service_workers='block')
                page = context.new_page()
                page.goto(base + 'index.html')
                page.wait_for_function("document.querySelectorAll('.story-step').length > 0")
                waiting = page.locator('[data-reveal="wait"]').count()
                if reduced == 'reduce':
                    assert waiting == 0, 'reduced motion must not hide anything'
                else:
                    assert waiting > 0, 'below-the-fold blocks should wait for scroll'
                    assert page.locator('.hero [data-reveal]').count() == 0
                    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
                    page.wait_for_function("document.querySelectorAll('[data-reveal=\"wait\"]').length < " + str(waiting))
                    page.evaluate("window.scrollTo(0, 0)")
                    page.emulate_media(reduced_motion='reduce')
                    page.wait_for_function("document.querySelectorAll('[data-reveal]').length === 0")
                context.close()
            context = browser.new_context(viewport={'width': 390, 'height': 844}, java_script_enabled=False, service_workers='block')
            page = context.new_page()
            page.goto(base + 'index.html')
            assert page.locator('[data-reveal]').count() == 0
            assert page.locator('.story-step').first.evaluate("el => getComputedStyle(el).opacity") == '1'
            context.close()

            # Service worker installs and serves the home page offline.
            context = browser.new_context(viewport={'width': 1440, 'height': 900})
            page = context.new_page()
            page.goto(base + 'index.html')
            page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null || (navigator.serviceWorker.ready.then(() => location.reload()), false)", timeout=15000)
            page.wait_for_function("caches.keys().then(k => k.some(n => n.startsWith('pomelo-v8-')))", timeout=15000)
            context.set_offline(True)
            page.reload()
            assert page.locator('h1').count() == 1
            context.close()
            browser.close()
    finally:
        server.shutdown()
    assert not errors, errors
    print('Pomelo V8 browser checks passed')


if __name__ == '__main__':
    main()
