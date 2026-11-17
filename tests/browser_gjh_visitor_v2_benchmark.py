"""Isolated five-character render sample; not a physical-device FPS test."""
from gjh_startup_test_helpers import mall_entry_url
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('GALLERY_CHROME','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':390,'height':844})
    page.goto(mall_entry_url(os.environ.get('GJH_V2_URL','http://127.0.0.1:18769/demos/corporate/gjh/v11/?visitor=v2')))
    page.wait_for_function('window.__mall?.ready',timeout=60000)
    result=page.evaluate((ROOT/'tests/visitor-v2-benchmark.js').read_text())
    print(json.dumps(result,indent=2))
    browser.close()
