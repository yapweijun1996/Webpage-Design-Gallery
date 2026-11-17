"""Publishing gates for independent locale packs."""
import importlib.util
import json
import re
from html.parser import HTMLParser
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('build_gallery', ROOT / 'scripts/build_gallery.py')
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


class PreferencesTests(unittest.TestCase):
    def test_current_packs_are_complete(self):
        gallery.validate_locales()

    def test_generated_gallery_copy_is_translatable(self):
        pack = json.loads((ROOT / 'locales/source/en.json').read_text())
        patterns = [re.compile('^' + re.sub(r'\\\{\w+\\\}', '.+?', re.escape(key)) + '$') for key in pack['patterns']]

        class CopyParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.skipped = 0
                self.messages = set()

            def handle_starttag(self, tag, attrs):
                if tag in ('script', 'style', 'noscript'):
                    self.skipped += 1
                if not self.skipped:
                    self.messages.update(value for key, value in attrs if key in ('aria-label', 'title', 'placeholder', 'alt'))

            def handle_endtag(self, tag):
                if tag in ('script', 'style', 'noscript'):
                    self.skipped -= 1

            def handle_data(self, value):
                if not self.skipped and re.search('[a-zA-Z]{2}', value):
                    self.messages.add(value.strip())

        parser = CopyParser()
        for path, html in gallery.build_pages(gallery.load_catalog()).items():
            if path.endswith('.html'):
                parser.feed(html)
        proper_names = {'English', 'Bahasa Melayu', 'FMCG'}
        for company in gallery.load_catalog()['companies']:
            proper_names.update(company[key] for key in ('name', 'legalName', 'initials', 'industry'))
        missing = sorted(message for message in parser.messages if message not in pack['messages'] and message not in proper_names and not any(pattern.fullmatch(message) for pattern in patterns))
        self.assertEqual(missing, [], 'Add new gallery interface copy to every language pack')


    def test_invalid_packs_fail_before_publication(self):
        for kind in ('missing', 'placeholder', 'array'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                folder = Path(temporary) / 'locales'
                shutil.copytree(ROOT / 'locales', folder)
                path = folder / 'ms.json'
                pack = json.loads(path.read_text())
                if kind == 'missing':
                    del pack['messages']['Theme']
                elif kind == 'placeholder':
                    pack['patterns']['Update to {release}'] = 'Kemas kini'
                else:
                    pack['messages'] = []
                path.write_text(json.dumps(pack))
                with self.assertRaises(ValueError):
                    gallery.validate_locales(folder)


if __name__ == '__main__':
    unittest.main()
