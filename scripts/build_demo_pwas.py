"""Generate a separate install identity and verified offline cache for each demo."""

import hashlib
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path


class DemoTheme(HTMLParser):
    def __init__(self):
        super().__init__()
        self.color = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "meta" and attrs.get("name") == "theme-color":
            self.color = attrs.get("content")


def outputs(root, catalog, release, resources, source_bytes, precache_runtime):
    template = (root / "templates/gallery/demo-sw.js").read_text(encoding="utf-8").replace(
        "__PRECACHE_RUNTIME__", precache_runtime)
    companies = {company["id"]: company for company in catalog["companies"]}
    result = {}
    hashes = {}
    shared_ui = {Path(path) for path in ("src/demo-pwa.js", "assets/demo-pwa.css", "assets/tokens.css")}
    icons = [("gallery-192.png", 192, "any"), ("gallery-512.png", 512, "any"),
             ("gallery-maskable-512.png", 512, "maskable")]
    shared_ui.update(Path("assets/icons") / name for name, _, _ in icons)
    shared_ui.add(Path("assets/icons/gallery-180.png"))
    for design in catalog["designs"]:
        if design["id"] == "gjh-v11":
            continue  # The virtual mall has its own small offline directory and worker.
        if design["id"] in ("gjh-mini-street", "pomelo-stem-v2", "pomelo-stem-v3"):
            continue  # Preserve the standalone editions' no-worker behavior.
        directory = Path(design["demoPath"]).parent
        company = companies[design["companyId"]]
        theme = DemoTheme()
        theme.feed((root / design["demoPath"]).read_text("utf-8"))
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", theme.color or ""):
            raise ValueError(f"Missing opaque theme color: {directory}")
        def relative(path):
            return Path(os.path.relpath(path, directory)).as_posix()
        manifest = {
            "id": "./", "name": company["name"] + " · " + design["title"],
            "short_name": design["title"], "description": design["description"], "lang": "en-SG",
            "start_url": "./index.html", "scope": "./", "display": "standalone",
            "theme_color": theme.color, "background_color": theme.color,
            "icons": [{"src": relative(Path("assets/icons") / name), "sizes": f"{size}x{size}",
                       "type": "image/png", "purpose": purpose} for name, size, purpose in icons],
        }
        manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        result[(directory / "manifest.webmanifest").as_posix()] = manifest_text
        files = set(shared_ui)
        company_dir = directory.parent
        for path in resources:
            if path.name == "thumbnail.webp" or "screenshots" in path.parts:
                continue
            # Keep the index usable offline without precaching 240 study documents.
            if design["id"] == "pomelo-stem-v1" and (
                    path.is_relative_to(directory / "studies")
                    or (path.parent == directory / "shared" and path.suffix == ".webp")):
                continue
            if path.is_relative_to(directory) or path.is_relative_to(company_dir / "shared"):
                files.add(path)
            # These two content collections use their first edition's small image and font library.
            if company["id"] in ("yeos", "thow-kwang") and path.is_relative_to(company_dir / "v1/assets"):
                if path.suffix.lower() in (".webp", ".png", ".jpg", ".jpeg", ".woff2", ".ttf", ".svg"):
                    files.add(path)
        if company["id"] == "gjh":
            files.add(Path("assets/gjh-themes.css"))
        entries = {"manifest.webmanifest": hashlib.sha256(manifest_text.encode()).hexdigest()}
        for path in sorted(files):
            if path not in hashes:
                hashes[path] = hashlib.sha256(source_bytes(root / path)).hexdigest()
            entries[relative(path)] = hashes[path]
        worker = template.replace("__RELEASE__", json.dumps(release)).replace(
            "__ASSETS__", json.dumps(entries, indent=2)).replace(
            "__IDENTITY__", json.dumps(relative(Path("version.json"))))
        result[(directory / "sw.js").as_posix()] = worker
    return result
