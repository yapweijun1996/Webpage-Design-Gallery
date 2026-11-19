"""Serve the worktree and run headed GJH probes sequentially on this computer."""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
from threading import Thread

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=Path('output/perf-suite'))
    parser.add_argument('--baseline', type=Path, default=Path('output/lighting-baseline.json'))
    parser.add_argument('--update-baseline', action='store_true')
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    results = {}
    with ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=ROOT)) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}/demos/corporate/gjh/v11/'
        jobs = []
        for device, tier in [('phone', 'low'), ('tablet', 'balanced'), ('desktop', 'detailed')]:
            jobs.append((f'lap-{device}-{tier}', 'docs/mall_lap_probe.py',
                         ['--device', device, '--tier', tier, '--json', out / f'lap-{device}-{tier}.json']))
        for route in ['default', 'shops', 'upper']:
            jobs.append((f'video-{route}', 'docs/mall_video_probe.py',
                         ['--route', route, '--out', out / f'video-{route}']))
        lighting = ['--baseline', args.baseline.resolve(), '--out', out / 'lighting']
        jobs.append(('lighting', 'tests/browser_lighting.py',
                     lighting + (['--update-baseline'] if args.update_baseline else [])))
        try:
            for name, script, options in jobs:
                print(f'Running {name}', flush=True)
                rc = subprocess.run([sys.executable, script, '--url', url, *options], cwd=ROOT).returncode
                results[name] = ('REFERENCE WRITTEN' if rc == 0 and name == 'lighting' and args.update_baseline
                                 else 'PASS' if rc == 0 else f'FAIL ({rc})')
        finally:
            server.shutdown()
            thread.join()
    (out / 'summary.json').write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
    return int(any(value.startswith('FAIL') for value in results.values()))


if __name__ == '__main__':
    sys.exit(main())
