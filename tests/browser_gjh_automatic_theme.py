"""Verify the automatic mall theme in headed Chrome against the local server."""

from gjh_menu_test_helpers import open_decor_theme
import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import expect, sync_playwright


URL = 'http://127.0.0.1:8820/demos/corporate/gjh/v11/?layout=expanded#experience'
SINGAPORE = ZoneInfo('Asia/Singapore')
STORAGE_KEY = 'gjh-v11-mall-theme-v1'
DATES = [
    ('2026-11-19', 'christmas', 'Automatic: Christmas (25 Dec, in 36 days)'),
    ('2026-11-09', 'deepavali', 'Automatic: Deepavali (8 Nov, yesterday)'),
    ('2027-01-10', 'lunar-new-year', 'Automatic: Lunar New Year (6 Feb, in 27 days)'),
    ('2027-03-01', 'everyday', 'Automatic: Everyday (next: Deepavali in 242 days)'),
]


def local_time(iso):
    return datetime.fromisoformat(iso).replace(tzinfo=SINGAPORE)


def expect_theme(page, theme):
    page.wait_for_function(
        """theme => __mall.state.theme.active === theme && !__mall.state.theme.pending &&
        JSON.stringify(__mall.state.themeDecorations) === JSON.stringify(theme === 'everyday' ? [] : [theme])""",
        arg=theme, timeout=90_000,
    )


def run(screens):
    screens.mkdir(parents=True, exist_ok=True)
    default_backend = 'metal' if sys.platform == 'darwin' else 'swiftshader'
    backend = os.environ.get('GALLERY_WEBGL_BACKEND', default_backend)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.environ['GALLERY_CHROME'],
            headless=False,
            args=[f'--use-angle={backend}', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
        )
        for day, theme, message in DATES:
            context = browser.new_context(
                timezone_id=SINGAPORE.key, viewport={'width': 1440, 'height': 900},
                reduced_motion='reduce', color_scheme='dark' if theme == 'deepavali' else 'light',
                service_workers='block',
            )
            context.add_init_script("""
                localStorage.setItem('gjh-v11-tutorial-v1', 'dismissed');
                new MutationObserver(() => {
                    if (window.__firstVisibleTheme === undefined && document.body?.classList.contains('is-3d')) {
                        window.__firstVisibleTheme = window.__mall?.state.theme.active;
                    }
                }).observe(document, {subtree:true, attributes:true, attributeFilter:['class']});
            """)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.clock.install(time=local_time(f'{day}T00:15:00'))
            page.goto(URL, wait_until='domcontentloaded')
            page.wait_for_function('window.__sceneReady === true', timeout=90_000)
            expect_theme(page, theme)
            assert page.evaluate('window.__firstVisibleTheme') == theme
            assert page.evaluate('(key) => localStorage.getItem(key)', STORAGE_KEY) is None
            page.screenshot(path=screens / f'{day}-mall.png')
            open_decor_theme(page)
            select = page.locator('#mall-theme-select')
            status = page.locator('#mall-theme-status')
            expect(select.locator('option').first).to_have_text('Automatic (follows the calendar)')
            expect(select).to_have_value('automatic')
            expect(status).to_have_text(message)
            page.screenshot(path=screens / f'{day}-dialog.png')
            print(f'PASS {day} {theme}: {message}', flush=True)

            if theme == 'christmas':
                for code, label, period in [
                    ('zh-Hans', '自动（跟随节日日历）', '圣诞节'),
                    ('ms', 'Automatik (mengikut kalendar)', 'Krismas'),
                    ('en', 'Automatic (follows the calendar)', 'Christmas'),
                ]:
                    page.locator('#scene-language').evaluate(
                        "(select, code) => { select.value = code; select.dispatchEvent(new Event('change')); }", code,
                    )
                    expect(select.locator('option').first).to_have_text(label)
                    expect(status).to_contain_text(period)

                select.select_option('everyday')
                page.locator('#mall-theme-apply').click()
                expect_theme(page, 'everyday')
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function('window.__sceneReady === true', timeout=90_000)
                expect_theme(page, 'everyday')
                open_decor_theme(page)
                expect(select).to_have_value('everyday')
                select.select_option('automatic')
                page.locator('#mall-theme-apply').click()
                expect_theme(page, 'christmas')
                assert page.evaluate('(key) => localStorage.getItem(key)', STORAGE_KEY) is None
                page.locator('#mall-theme-close').click()

                page.clock.set_system_time(local_time('2026-11-12T23:59:50'))
                page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow'))")
                expect_theme(page, 'everyday')
                page.clock.fast_forward(11_000)
                expect_theme(page, 'christmas')
                page.clock.set_system_time(local_time('2027-01-10T00:15:00'))
                page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
                expect_theme(page, 'lunar-new-year')
                print('PASS locale switching, persisted override, clearing, pageshow, local midnight and visibilitychange',
                      flush=True)
            assert not errors, errors
            context.close()
        browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--screens', type=Path, required=True)
    run(parser.parse_args().screens)
