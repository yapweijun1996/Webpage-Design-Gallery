"""Build or verify pinned, prebuilt V11 ESM bundles without npm packages.

A clean checkout builds and checks with Python alone. Regenerating stale
bundles additionally requires the pinned standalone Bun compiler.
"""
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = Path('demos/corporate/gjh/v11')
MANIFEST = ROOT / 'data/gjh-startup-bundles.json'
BUN_VERSION = '1.3.11'
JOBS = (
    {
        'entry': BASE / 'script.js', 'output': BASE / 'script.bundle.js',
        'external': ('*world.js', '*player.js', '*elevator-v2.js', '*mall-themes.js',
                     '*startup-asset-pack.js', '*startup-physics.js', '*original-tin.js', '*npcs.js',
                     '*shop-interactions.js',
                     '*newmoon-detail-preview.js', '*demo-bag.js', '*GLTFLoader.js', '*three.module.min.js', '*rapier.mjs'),
        'rewrite': (('"./newmoon-detail-preview.js"', '"./assets/newmoon-detail-preview.js"'),
                    ('"./demo-bag.js"', '"./assets/demo-bag.js"'),
                    ('"./assets/world.js"', '"./assets/world.bundle.js"'),
                    ('"./assets/player.js"', '"./assets/player.bundle.js"')),
    },
    {
        'entry': BASE / 'assets/world.js', 'output': BASE / 'assets/world.bundle.js',
        'external': ('*GLTFLoader.js', '*BufferGeometryUtils.js', '*three.module.min.js',
                     '*natural-materials.js', '*startup-asset-pack.js',
                     '*brand-wall.js'),
        'rewrite': (),
    },
    {
        'entry': BASE / 'assets/player.js', 'output': BASE / 'assets/player.bundle.js',
        'external': ('*visitor-gltf.js', '*character-v2.js', '*character-tripo.js', '*GLTFLoader.js', '*push-cart.js', '*seated-pose.js',
                     '*collection-gesture.js', '*carry-bag.js'),
        'rewrite': (('"./character-v2.js"', '"./character-v2.bundle.js"'),),
    },
    {
        'entry': BASE / 'assets/character-v2.js', 'output': BASE / 'assets/character-v2.bundle.js',
        'external': ('*GLTFLoader.js', '*BufferGeometryUtils.js', '*three.module.min.js'), 'rewrite': (),
    },
)


def digest(path):
    # Match the gallery generator's normalized text bytes across Git checkouts.
    data = path.read_text(encoding='utf-8-sig').encode('utf-8') if path.suffix in ('.js', '.py', '.json') else path.read_bytes()
    return hashlib.sha256(data).hexdigest()


def current():
    try:
        manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        if manifest['version'] != 1 or manifest['bun'] != BUN_VERSION:
            return False
        if manifest['builder'] != digest(Path(__file__)):
            return False
        if not isinstance(manifest['inputs'], dict) or not isinstance(manifest['outputs'], dict):
            return False
        if not {job['entry'].as_posix() for job in JOBS}.issubset(manifest['inputs']):
            return False
        if set(manifest['outputs']) != {job['output'].as_posix() for job in JOBS}:
            return False
        for name, expected in {**manifest['inputs'], **manifest['outputs']}.items():
            if not isinstance(name, str) or not isinstance(expected, str) or len(expected) != 64:
                return False
            path = (ROOT / name).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file() or digest(path) != expected:
                return False
        return bool(manifest['inputs'])
    except (OSError, ValueError, KeyError, TypeError):
        return False


def build(check=False):
    if current():
        return
    if check:
        raise ValueError('Regenerate the GJH startup JavaScript bundles')
    executable = shutil.which('bun')
    if not executable:
        raise ValueError(f'Stale GJH bundles need standalone Bun {BUN_VERSION}; clean builds require Python only')
    version = subprocess.check_output([executable, '--version'], text=True).strip()
    if version != BUN_VERSION:
        raise ValueError(f'GJH bundle generation needs Bun {BUN_VERSION}, found {version}')
    inputs, outputs = set(), {}
    with tempfile.TemporaryDirectory(prefix='gjh-bundles-') as temporary:
        temporary = Path(temporary)
        for index, job in enumerate(JOBS):
            output = temporary / f'bundle-{index}.js'
            metadata = temporary / f'meta-{index}.json'
            command = [executable, 'build', str(job['entry']), '--target=browser',
                       f'--outfile={output}', f'--metafile={metadata}']
            command.extend(f'--external={pattern}' for pattern in job['external'])
            subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True)
            text = output.read_text(encoding='utf-8')
            for before, after in job['rewrite']:
                if text.count(before) != 1:
                    raise ValueError(f'Unexpected bundle import boundary: {before}')
                text = text.replace(before, after, 1)
            content = ('// Generated by scripts/build_gjh_startup_js.py; edit source modules.\n' + text).encode('utf-8')
            outputs[job['output'].as_posix()] = hashlib.sha256(content).hexdigest()
            (ROOT / job['output']).write_bytes(content)
            for name in json.loads(metadata.read_text(encoding='utf-8'))['inputs']:
                path = (ROOT / name).resolve()
                if not path.is_relative_to(ROOT) or not path.is_file():
                    raise ValueError(f'Unsafe bundle input: {name}')
                inputs.add(path.relative_to(ROOT).as_posix())
    manifest = {'version': 1, 'bun': BUN_VERSION, 'builder': digest(Path(__file__)),
                'inputs': {name: digest(ROOT / name) for name in sorted(inputs)}, 'outputs': outputs}
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
