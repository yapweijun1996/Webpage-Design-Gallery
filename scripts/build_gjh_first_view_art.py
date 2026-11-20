"""Resize the authored visitor atlas and entry imagery (requires Pillow with WebP)."""
import io
import json
import struct
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'demos/corporate/gjh/v11/assets'


def write_glb(document, binary, path):
    header = json.dumps(document, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(
        struct.pack('<4sIII4s', b'glTF', 2, 28 + len(header) + len(binary), len(header), b'JSON')
        + header + struct.pack('<I4s', len(binary), b'BIN\0') + binary
    )


def visitor_atlas(variant):
    raw = (ASSETS / f'gjh-tripo-visitor{variant}.glb').read_bytes()
    length, = struct.unpack_from('<I', raw, 12)
    document = json.loads(raw[20:20 + length])
    binary = raw[28 + length:]
    image, = document['images']
    view = document['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    return document, binary, view, Image.open(io.BytesIO(binary[start:start + view['byteLength']]))


def build():
    document, binary, view, image = visitor_atlas('')
    # Keep skin, rig and clips byte-identical. The skin's far LOD can still
    # bind to this skeleton and the original portrait stays the same UV layout.
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    encoded = io.BytesIO()
    image.save(encoded, 'JPEG', quality=76, optimize=True)
    jpeg = encoded.getvalue()
    start = view.get('byteOffset', 0)
    extent = (view['byteLength'] + 3) & ~3
    padded = jpeg + b'\0' * (-len(jpeg) % 4)
    for other in document['bufferViews']:
        if other.get('byteOffset', 0) > start:
            other['byteOffset'] += len(padded) - extent
    view['byteLength'] = len(jpeg)
    binary = binary[:start] + padded + binary[start + extent:]
    document['buffers'][0]['byteLength'] = len(binary)
    write_glb(document, binary, ASSETS / 'gjh-tripo-entry.glb')

    for variant, quality in (('', 84), ('-2k', 86)):
        _, _, _, image = visitor_atlas(variant)
        image.save(ASSETS / f'gjh-tripo-portrait{variant}.webp', 'WEBP', quality=quality, method=6)

    sources = [*ASSETS.glob('*-brand-cover.jpg'), *ASSETS.glob('new-moon-*-front.jpg')]
    for source in sources:
        image = Image.open(source)
        image.thumbnail((768, 768), Image.Resampling.LANCZOS)
        image.save(source.with_suffix('.webp'), 'WEBP', quality=82, method=6)


if __name__ == '__main__':
    build()
