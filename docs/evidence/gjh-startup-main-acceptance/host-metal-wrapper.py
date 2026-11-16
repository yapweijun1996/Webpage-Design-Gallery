"""Run an existing browser check with this host's verified native ANGLE backend."""
import runpy
import os
import sys
from pathlib import Path
from playwright.sync_api import BrowserType, Page
original_launch = BrowserType.launch
def launch(self, *args, **kwargs):
    browser_args = [arg for arg in kwargs.get('args', []) if not arg.startswith('--use-angle=')]
    kwargs['args'] = browser_args + ['--use-angle=metal']
    return original_launch(self, *args, **kwargs)
BrowserType.launch = launch
if os.environ.get('GALLERY_LEGACY_VISITOR') == '1':
    original_goto = Page.goto
    def goto(self, url, *args, **kwargs):
        if '/demos/corporate/gjh/v11/' in url and '?' not in url:
            url += '?visitor=v1'
        return original_goto(self, url, *args, **kwargs)
    Page.goto = goto
script = sys.argv.pop(1)
sys.path.insert(0, str(Path(script).resolve().parent))
runpy.run_path(script, run_name='__main__')
