"""Shared headed browser setup and repeatable mall poses."""
import os
import platform
from pathlib import Path

URL = 'http://localhost:8830/demos/corporate/gjh/v11/'
INIT = """
localStorage.setItem('gjh-v11-tutorial-v1','dismissed');
localStorage.setItem('gjh-v11-graphics-quality-v1','%s');
"""


def launch(playwright):
    return playwright.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME'), headless=False,
                                      args=['--use-angle=metal'] if platform.system() == 'Darwin' else [])


def enter(context, url, tier, observe=False, throttle=1):
    context.add_init_script(INIT % tier)
    if observe:
        context.add_init_script(path=Path(__file__).with_name('mall_render_probe.js'))
    page = context.new_page()
    if throttle != 1:
        context.new_cdp_session(page).send('Emulation.setCPUThrottlingRate', {'rate': throttle})
    page.goto(url, wait_until='domcontentloaded')
    page.locator('#arrival-walk').click()
    page.wait_for_function("""tier => window.__mall?.ready && window.__sceneReady &&
      document.querySelector('#app-loader').hidden && __mall.state.graphics.quality.tier === tier &&
      (() => { const {interiors, signage} = __mall.performanceReport(), p = __mall.state.modelPreload;
        return interiors.tier === tier && interiors.preinstalled.shops === 17 &&
          signage.tier === tier && p && p.settled === p.total; })()""",
                           arg=tier, polling=500, timeout=180000)
    page.locator('#scene').focus()
    return page


def assert_teleport(page, zone):
    if not page.evaluate('zone => __mall.teleport(zone)', zone):
        raise RuntimeError(f'Cannot reach {zone}')


def scene_only(page):
    page.add_style_tag(content='body * {visibility:hidden !important} #scene {visibility:visible !important}')
