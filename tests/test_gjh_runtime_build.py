"""Contracts for reproducible V11 startup assets."""

import importlib.util
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
