"""Split the pinned Rapier package's embedded WASM without changing its bytes."""

import base64
import gzip
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'third_party/rapier/rapier-original.mjs.gz'
SOURCE_SHA256 = '02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0'
WASM_SHA256 = '17cfa80eebd8de0291b948496dbffba724b98b489687f8272ca236a7bbf1dd4b'
VENDOR = ROOT / 'demos/corporate/gjh/v11/vendor'
PATTERN = re.compile(rb'oC\.toByteArray\("(AGFzbQ[A-Za-z0-9+/=]+)"\)\.buffer')


def outputs():
    source = gzip.decompress(SOURCE.read_bytes())
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError('Pinned Rapier source does not match its reviewed hash')
    matches = list(PATTERN.finditer(source))
    if len(matches) != 1:
        raise ValueError('Expected exactly one embedded Rapier WASM module')
    match = matches[0]
    wasm = base64.b64decode(match.group(1), validate=True)
    if hashlib.sha256(wasm).hexdigest() != WASM_SHA256:
        raise ValueError('Extracted Rapier WASM does not match its reviewed hash')
    replacement = b'input??new URL("./rapier_bg.wasm",import.meta.url)'
    wrapper = source[:match.start()] + replacement + source[match.end():]
    if wrapper.count(b'function FC(){') != 1:
        raise ValueError('Rapier init signature changed')
    wrapper = wrapper.replace(b'function FC(){', b'function FC(input){')
    return {VENDOR / 'rapier.mjs': wrapper, VENDOR / 'rapier_bg.wasm': wasm}


def build(check=False):
    for path, content in outputs().items():
        if check:
            if not path.exists() or path.read_bytes() != content:
                raise ValueError(f'Regenerate Rapier runtime: {path.relative_to(ROOT)}')
        else:
            path.write_bytes(content)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
