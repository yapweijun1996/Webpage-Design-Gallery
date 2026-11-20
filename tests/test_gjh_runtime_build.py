import gzip
"""Contracts for reproducible V11 startup assets."""

import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RuntimeBuildTests(unittest.TestCase):
    def test_startup_pack_contains_the_original_models(self):
        build = load('build_gjh_startup_pack')
        build.build(check=True)
        data = gzip.decompress(build.PACK.read_bytes())
        self.assertEqual(data[:8], b'GJHPACK1')
        header_length = struct.unpack_from('<I', data, 8)[0]
        entries = json.loads(data[12:12 + header_length])
        names = json.loads(build.MANIFEST.read_text())
        self.assertEqual(list(entries), names)
        for name, (offset, length) in entries.items():
            self.assertEqual(data[12 + header_length + offset:12 + header_length + offset + length],
                             (build.ASSETS / name).read_bytes(), name)

    def test_clean_prebuilt_javascript_needs_no_bun(self):
        build = load('build_gjh_startup_js')
        self.assertTrue(build.current())
        with patch.object(build.shutil, 'which', side_effect=AssertionError('Bun should not be needed')):
            build.build()
            build.build(check=True)
        original_digest = build.digest
        entry = (build.ROOT / build.JOBS[0]['entry']).resolve()
        with patch.object(build, 'digest', side_effect=lambda path: '0' * 64 if path.resolve() == entry else original_digest(path)):
            self.assertFalse(build.current())
            with self.assertRaisesRegex(ValueError, 'Regenerate'):
                build.build(check=True)
        with patch.object(build, 'current', return_value=False), patch.object(build.shutil, 'which', return_value=None):
            with self.assertRaisesRegex(ValueError, 'standalone Bun'):
                build.build()

    def test_rapier_outputs_are_pinned_and_runtime_check_detects_changes(self):
        build = load('build_rapier')
        generated = build.outputs()
        wrapper = generated[build.VENDOR / 'rapier.mjs']
        wasm = generated[build.VENDOR / 'rapier_bg.wasm']
        self.assertTrue(wasm.startswith(b'\0asm'))
        self.assertIn(b'new URL("./rapier_bg.wasm",import.meta.url)', wrapper)
        self.assertNotIn(b'AGFzbQEAAAAB', wrapper)
        build.build(check=True)
        with tempfile.TemporaryDirectory() as directory:
            broken = Path(directory) / 'bad.gz'
            broken.write_bytes(b'not a gzip file')
            with patch.object(build, 'SOURCE', broken), self.assertRaises((OSError, EOFError)):
                build.outputs()

    def test_css_bundle_is_current_and_rejects_stale_output(self):
        build = load('build_gjh_css')
        build.build(check=True)
        with tempfile.TemporaryDirectory() as directory:
            stale = Path(directory) / 'style.bundle.css'
            stale.write_text('stale', encoding='utf-8')
            with patch.object(build, 'OUTPUT', stale), self.assertRaises(ValueError):
                build.build(check=True)


if __name__ == '__main__':
    unittest.main()
