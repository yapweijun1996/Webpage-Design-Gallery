"""Audit a generated artifact for accessibility, layout and laboratory performance."""

import argparse
import functools
import http.server
import importlib.util
import json
import os
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)
VIEWPORTS = ((1440, 900), (768, 1024), (390, 844))
ENVIRONMENT = (
    "Local Chrome, reduced motion, service workers blocked; "
    "laboratory LCP/CLS only, not field CWV or INP"
)
PERFORMANCE_OBSERVER = """
window.__perf = {lcp: 0, cls: 0, shifts: []};
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) __perf.lcp = entry.startTime;
}).observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) {
      __perf.cls += entry.value;
      __perf.shifts.push({
        value: entry.value,
        sources: (entry.sources || []).map(source =>
          source.node?.id || source.node?.className || source.node?.nodeName)
      });
    }
  }
}).observe({type: 'layout-shift', buffered: true});
"""
AXE_AUDIT = """async () => {
  const result = await axe.run(document, {
    runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}
  });
  return result.violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map(node => ({
      target: node.target,
      summary: node.failureSummary
    }))
  }));
}"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def audit_routes(browser, base, routes, axe_script, screenshots, evidence, release):
    results = []
    for name, route in routes.items():
        for width, height in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                reduced_motion="reduce",
                service_workers="block",
            )
            try:
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.add_init_script(PERFORMANCE_OBSERVER)
                page.goto(base + route, wait_until="networkidle")
                page.wait_for_timeout(700)
                page.screenshot(path=str(screenshots / f"{name}-{width}.png"))
                page.evaluate(axe_script.read_text())
                axe = page.evaluate(AXE_AUDIT)
                result = {
                    "route": route,
                    "name": name,
                    "width": width,
                    "overflow": page.evaluate("document.documentElement.scrollWidth > innerWidth"),
                    "errors": errors,
                    "axe": axe,
                    "lab": page.evaluate("__perf"),
                }
                results.append(result)
                print(name, width, "axe", len(axe), "overflow", result["overflow"], flush=True)
                evidence.write_text(json.dumps({
                    "release": release,
                    "axeVersion": page.evaluate("axe.version"),
                    "environment": ENVIRONMENT,
                    "results": results,
                }, indent=2) + "\n")
            finally:
                context.close()
    return results


def run(args, parser):
    routes = {
        "home": "",
        "directory": "companies/",
        "company": "companies/gjh/",
        "detail": "designs/?company=gjh&design=v6",
        "compare": "compare/?company=gjh&left=v5&right=v7",
        "offline": "offline.html",
    }
    routes.update({design["version"]: design["demoPath"] for design in gallery.load_catalog()["designs"]})
    if args.routes:
        routes = {name: route for name, route in routes.items() if name in args.routes}
        if not routes:
            parser.error("No matching routes")
    filename = "ssot-browser-targeted.json" if args.routes else "ssot-browser.json"
    evidence = ROOT / "docs/evidence" / filename
    evidence.parent.mkdir(parents=True, exist_ok=True)
    screenshots = Path(tempfile.mkdtemp(prefix="ssot-browser-review-"))
    with tempfile.TemporaryDirectory(prefix="ssot-audit-") as temporary:
        root = Path(temporary)
        artifact = root / "Webpage-Design-Gallery"
        gallery.build(artifact)
        release = json.loads((artifact / "version.json").read_text())
        handler = functools.partial(Handler, directory=str(root))
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}/Webpage-Design-Gallery/"
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    executable_path=os.environ["GALLERY_CHROME"],
                    args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
                )
                try:
                    results = audit_routes(browser, base, routes, args.axe_script,
                                           screenshots, evidence, release)
                finally:
                    browser.close()
        finally:
            server.shutdown()
            server.server_close()
    print(f"Review screenshots: {screenshots}")
    assert not any(result["overflow"] or result["errors"] or result["axe"] for result in results), (
        f"Review failed: see {evidence.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit all Gallery and GJH routes in a generated artifact.")
    parser.add_argument("--axe-script", type=Path, required=True, help="Reviewed local axe-core bundle")
    parser.add_argument("--routes", nargs="*", help="Optional named route subset for targeted reruns")
    run(parser.parse_args(), parser)
