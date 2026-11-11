"""Build company-first static pages and an allowlisted GitHub Pages artifact."""

import argparse
import html
import hashlib
import json
import re
import struct
from pathlib import Path
from string import Template
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def local_path(root, value):
    """Reject absolute paths, URLs, traversal and symlink escapes in metadata."""
    if not isinstance(value, str) or not value or "\\" in value:
        raise ValueError(f"Invalid local path: {value!r}")
    if urlparse(value).scheme or value.startswith("/") or ".." in Path(value).parts:
        raise ValueError(f"Unsafe local path: {value}")
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes repository: {value}")
    if not path.exists():
        raise ValueError(f"Missing resource: {value}")
    return path


def unique(records, kind):
    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError(f"Duplicate {kind} IDs")


def load_catalog(root=ROOT):
    companies = read_json(root / "data/companies.json")
    categories = read_json(root / "data/categories.json")
    styles = read_json(root / "data/styles.json")
    for records, kind in ((companies, "company"), (categories, "category"), (styles, "style")):
        unique(records, kind)
    if len({c["slug"] for c in companies}) != len(companies):
        raise ValueError("Duplicate company slugs")
    category_ids = {c["id"] for c in categories}
    style_ids = {s["id"] for s in styles}
    designs = []
    for company in companies:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", company["slug"]):
            raise ValueError("Invalid company slug")
        if not set(company["categories"]).issubset(category_ids):
            raise ValueError("Unknown company category")
        if urlparse(company["officialWebsite"]).scheme != "https":
            raise ValueError("Official website must use HTTPS")
        directory = local_path(root, company["demoDirectory"])
        for metadata in sorted(directory.glob("*/metadata.json")):
            item = read_json(metadata)
            route = metadata.parent.relative_to(root).as_posix() + "/"
            if item["demoRoute"] != route or item["version"] != metadata.parent.name:
                raise ValueError(f"Metadata route/version mismatch: {metadata}")
            if item["companyId"] != company["id"] or item["company"] != company["legalName"]:
                raise ValueError(f"Company mismatch: {metadata}")
            if not set(item["styles"]).issubset(style_ids):
                raise ValueError(f"Unknown style: {metadata}")
            if not isinstance(item["order"], int):
                raise ValueError("Design order must be an integer")
            thumbnail = route + item["thumbnail"]
            local_path(root, thumbnail)
            local_path(root, route + "index.html")
            screenshots = {}
            for device, width in (("desktop", 1440), ("tablet", 768), ("mobile", 390)):
                image = local_path(root, route + f"screenshots/{width}.png")
                raw = image.read_bytes()[:24]
                if raw[:8] != b"\x89PNG\r\n\x1a\n":
                    raise ValueError(f"Invalid PNG screenshot: {image}")
                w, h = struct.unpack(">II", raw[16:24])
                screenshots[device] = {"path": image.relative_to(root).as_posix(), "width": w, "height": h}
            designs.append({
                "id": item["id"], "companyId": company["id"], "slug": item["version"],
                "version": item["version"], "title": item["displayTitle"],
                "description": item["summary"], "styles": item["styles"],
                "status": "concept", "order": item["order"], "demoPath": route + "index.html",
                "thumbnail": thumbnail, "screenshots": screenshots,
                "devices": ["desktop", "tablet", "mobile"], "disclaimer": item["disclaimer"],
            })
        own = [d for d in designs if d["companyId"] == company["id"]]
        if not own or company["featuredVersion"] not in {d["version"] for d in own}:
            raise ValueError(f"Missing designs or featured version: {company['id']}")
    unique(designs, "design")
    designs.sort(key=lambda d: (d["companyId"], d["order"], d["id"]))
    return {"companies": companies, "categories": categories, "styles": styles, "designs": designs}


def escape(value):
    return html.escape(str(value), quote=True)


def render(name, **values):
    template = (ROOT / f"templates/gallery/{name}.html").read_text(encoding="utf-8")
    return Template(template).substitute(values)


def plural(count, singular):
    return f"{count} {singular}" + ("" if count == 1 else "s")


def card_data(attributes):
    return " ".join(f'data-{key}="{escape(value)}"' for key, value in attributes.items())


def company_card(company, designs, prefix, categories):
    own = [d for d in designs if d["companyId"] == company["id"]]
    featured = next(d for d in own if d["version"] == company["featuredVersion"])
    name = escape(company["name"])
    category_name = ", ".join(categories[c] for c in company["categories"])
    attrs = card_data({"company": company["id"], "name": company["name"],
                       "search": company["name"] + " " + company["industry"] + " " + company["location"],
                       "categories": " ".join(company["categories"]), "count": len(own)})
    return f'''<a class="company-card" href="{prefix}companies/{escape(company['slug'])}/index.html" {attrs}>
      <div class="company-cover"><img src="{prefix}{escape(featured['thumbnail'])}" alt="Design preview for {name}" width="720" height="450" loading="lazy"><span class="cover-badge">DESIGN COLLECTION</span></div>
      <div class="company-card-copy"><div class="card-topline"><span class="company-monogram" aria-hidden="true">{escape(company['initials'])}</span><span class="industry-label">{escape(category_name)} &middot; {escape(company['location'])}</span></div>
      <h3>{name}</h3><p class="card-description">{escape(company['description'])}</p><div class="card-bottom"><span>{plural(len(own), 'design concept')}</span><span class="card-action">Explore designs <span aria-hidden="true">&rarr;</span></span></div></div></a>'''


def design_card(design, company):
    prefix = "../../"
    query = f"company={escape(company['id'])}&amp;design={escape(design['version'])}"
    title = escape(design["title"])
    attrs = card_data({"design": design["version"], "title": design["title"],
                       "styles": " ".join(design["styles"]), "order": design["order"]})
    return f'''<article class="design-card" {attrs}>
      <a class="design-preview" href="{prefix}designs/index.html?{query}" aria-label="View {title} details"><img src="{prefix}{escape(design['thumbnail'])}" alt="{title} desktop preview" width="720" height="450" loading="lazy"></a>
      <div class="design-card-copy"><div class="version-row"><span class="version-badge">{escape(design['version'].upper())}</span><span class="design-status">Independent concept</span><label class="compare-checkbox"><input type="checkbox" value="{escape(design['version'])}">Compare<span class="visually-hidden"> {title}</span></label></div>
      <h3><a href="{prefix}designs/index.html?{query}">{title}</a></h3><p class="card-description">{escape(design['description'])}</p><div class="card-bottom"><a class="details-link" href="{prefix}designs/index.html?{query}">View details</a><a class="card-action" href="{prefix}{escape(design['demoPath'])}">Open live demo <span aria-hidden="true">&nearr;</span><span class="visually-hidden">: {title}</span></a></div></div></article>'''


def runtime_resources(catalog):
    resources = {Path(name) for name in (
        "assets/gallery.css", "assets/pwa.css", "src/gallery.js", "src/pwa.js",
        "data/companies.json", "data/categories.json", "data/styles.json", "manifest.webmanifest",
        "assets/icons/gallery.svg", "assets/icons/gallery-180.png", "assets/icons/gallery-192.png", "assets/icons/gallery-512.png",
    )}
    for design in catalog["designs"]:
        directory = Path(design["demoPath"]).parent
        resources.update(directory / name for name in ("index.html", "style.css", "script.js"))
        resources.update(p.relative_to(ROOT) for p in (ROOT / directory / "assets").iterdir() if p.is_file())
        resources.update(Path(s["path"]) for s in design["screenshots"].values())
    return sorted(resources)


def source_bytes(path):
    """Match Git/Linux publication bytes when building from a Windows checkout."""
    if path.suffix in (".html", ".css", ".js", ".json", ".webmanifest", ".txt"):
        return path.read_text(encoding="utf-8-sig").encode("utf-8")
    return path.read_bytes()


def release_info(catalog):
    version = read_json(ROOT / "data/app.json")["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Application version must use major.minor.patch")
    digest = hashlib.sha256(json.dumps(catalog, sort_keys=True).encode("utf-8"))
    inputs = runtime_resources(catalog) + list((ROOT / "templates/gallery").glob("*")) + [Path("scripts/build_gallery.py"), Path("data/app.json")]
    for name in sorted(set(path.relative_to(ROOT) if path.is_absolute() else path for path in inputs)):
        digest.update(name.as_posix().encode("utf-8") + b"\0" + source_bytes(ROOT / name))
    return {"version": version, "build": digest.hexdigest()[:16]}


def build_pages(catalog, release=None):
    release = release or release_info(catalog)
    def shell(**values):
        return render("base", app_version=release["version"], app_build=release["build"], **values)
    companies, designs = catalog["companies"], catalog["designs"]
    category_names = {c["id"]: c["name"] for c in catalog["categories"]}
    pages = {}
    for path, prefix in (("index.html", ""), ("companies/index.html", "../")):
        filters = '<div class="filter-bar" id="filters"><label class="search-field">Find a company<input id="company-search" type="search" placeholder="Search companies, industries or locations" autocomplete="off"></label><label>Category<select id="category-filter"><option value="">All categories</option>'
        filters += "".join(f'<option value="{escape(c["id"])}">{escape(c["name"])}</option>' for c in catalog["categories"])
        filters += '</select></label><label>Sort by<select id="company-sort"><option value="name">Name A–Z</option><option value="designs">Most designs</option></select></label></div>'
        content = render("home", company_count=len(companies), company_summary=plural(len(companies), "company") if len(companies) == 1 else f"{len(companies)} companies", design_summary=plural(len(designs), "design"), company_filters=filters, company_cards="".join(company_card(c, designs, prefix, category_names) for c in companies))
        if path != "index.html":
            content = content.replace("One company.<br><span>Many creative directions.</span>", "All companies.<br><span>Find your next direction.</span>")
        pages[path] = shell(title="Companies — Webpage Design Gallery", description="Explore independent website design concepts, organized by company.", prefix=prefix, current='aria-current="page"', page_kind="companies", content=content)
    for company in companies:
        own = [d for d in designs if d["companyId"] == company["id"]]
        available_styles = {style for d in own for style in d["styles"]}
        options = "".join(f'<option value="{escape(s["id"])}">{escape(s["name"])}</option>' for s in catalog["styles"] if s["id"] in available_styles)
        content = render("company", company_name=escape(company["name"]), initials=escape(company["initials"]), company_description=escape(company["description"]), industry=escape(company["industry"]), location=escape(company["location"]), design_summary=plural(len(own), "design concept"), official_website=escape(company["officialWebsite"]), design_count=len(own), design_cards="".join(design_card(d, company) for d in own), style_options=options)
        pages[f"companies/{company['slug']}/index.html"] = shell(title=escape(company["name"]) + " — Design collection", description=escape(company["description"]), prefix="../../", current="", page_kind="company", content=content)
    for page in ("design", "compare"):
        path = "designs/index.html" if page == "design" else "compare/index.html"
        pages[path] = shell(title=f"{page.title()} — Webpage Design Gallery", description="Explore and compare independent website design concepts.", prefix="../", current="", page_kind=page, content=render(page))
    pages["offline.html"] = shell(title="Connection needed — Webpage Design Gallery", description="Browse saved company collections or reconnect to open a live demo.", prefix="", current="", page_kind="offline", content=render("offline"))
    pages["data/designs.json"] = json.dumps(designs, indent=2, ensure_ascii=False) + "\n"
    return pages


def pwa_outputs(pages, catalog, release):
    paths = set(pages) | {p.as_posix() for p in runtime_resources(catalog) if not p.as_posix().startswith("demos/")}
    paths.update(design["thumbnail"] for design in catalog["designs"])
    entries = []
    for name in sorted(paths):
        data = pages[name].encode("utf-8") if name in pages else source_bytes(ROOT / name)
        entries.append({"path": name, "sha256": hashlib.sha256(data).hexdigest()})
    worker = (ROOT / "templates/gallery/sw.js").read_text(encoding="utf-8")
    worker = worker.replace("__BUILD__", json.dumps(release["build"])).replace("__VERSION__", json.dumps(release["version"])).replace("__PRECACHE__", json.dumps(entries, indent=2))
    return {"version.json": json.dumps(release, indent=2) + "\n", "sw.js": worker}


def build(output=ROOT, check=False):
    catalog = load_catalog()
    release = release_info(catalog)
    pages = build_pages(catalog, release)
    pages.update(pwa_outputs(pages, catalog, release))
    if check:
        stale = [name for name, text in pages.items() if not (ROOT / name).exists() or (ROOT / name).read_text(encoding="utf-8") != text]
        if stale:
            raise ValueError("Regenerate gallery pages: " + ", ".join(stale))
    else:
        for name, text in pages.items():
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text, encoding="utf-8", newline="\n")
        if output.resolve() != ROOT:
            # Publish only the gallery and known demo runtime resources, never research downloads.
            for name in runtime_resources(catalog):
                source = local_path(ROOT, name.as_posix())
                target = output / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source_bytes(source))
    print(f"Gallery {'checked' if check else 'built'}: {len(catalog['companies'])} companies, {len(catalog['designs'])} designs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    build(args.output.resolve(), args.check)
