"""Pack the first-view models and artwork using only Python stdlib."""
import gzip
import io
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'demos/corporate/gjh/v11/assets'
MANIFEST = ROOT / 'data/gjh-startup-assets.json'
TEMPLATE = ROOT / 'templates/gallery/gjh-v11-startup-asset-pack.js'
PACK = ASSETS / 'startup-assets.pack'
LOADER = ASSETS / 'startup-asset-pack.js'
MAGIC = b'GJHPACK1'


def outputs():
    names = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if not isinstance(names, list) or not names or not all(isinstance(name, str) for name in names):
        raise ValueError('Startup asset names must be a nonempty string list')
    if names != sorted(set(names)):
        raise ValueError('Startup asset names must be sorted, unique and nonempty')
    entries, chunks, offset = {}, [], 0
    for name in names:
        if not isinstance(name, str) or not re.fullmatch(r'(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\.(?:glb|json|svg|webp)', name):
            raise ValueError(f'Unsafe startup asset name: {name!r}')
        path = ASSETS / name
        data = path.read_text(encoding='utf-8-sig').encode('utf-8') if path.suffix in {'.json', '.svg'} else path.read_bytes()
        entries[name] = [offset, len(data)]
        chunks.append(data)
        offset += len(data)
    header = json.dumps(entries, separators=(',', ':'), ensure_ascii=True).encode('ascii')
    pack = MAGIC + struct.pack('<I', len(header)) + header + b''.join(chunks)
    if len(pack) > 10 * 1024 * 1024:
        raise ValueError('Startup asset pack exceeds its 10 MiB upper bound')
    template = TEMPLATE.read_text(encoding='utf-8')
    if template.count('__STARTUP_ASSET_NAMES__') != 1:
        raise ValueError('Expected one startup asset name placeholder')
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode='wb', compresslevel=9, mtime=0) as stream:
        stream.write(pack)
    compressed = output.getvalue()
    loader = template.replace('__STARTUP_ASSET_NAMES__', json.dumps(names, separators=(',', ':')))
    loader = loader.replace('__STARTUP_PACK_BYTES__', str(len(compressed)))
    return {PACK: compressed, LOADER: loader.encode('utf-8')}


def build(check=False):
    for path, content in outputs().items():
        if check:
            actual = None
            if path.exists():
                actual = path.read_text(encoding='utf-8-sig').encode('utf-8') if path.suffix == '.js' else path.read_bytes()
            if actual != content:
                raise ValueError(f'Regenerate mall startup assets: {path.relative_to(ROOT)}')
        else:
            path.write_bytes(content)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
