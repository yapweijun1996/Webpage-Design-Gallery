"""Build company-first static pages and an allowlisted GitHub Pages artifact."""

import argparse
import html
import hashlib
import importlib.util
import json
import re
import struct
from pathlib import Path
from string import Template
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DS_SPEC = importlib.util.spec_from_file_location("build_design_system", ROOT / "scripts/build_design_system.py")
design_system = importlib.util.module_from_spec(DS_SPEC)
DS_SPEC.loader.exec_module(design_system)
RAPIER_SPEC = importlib.util.spec_from_file_location("build_rapier", ROOT / "scripts/build_rapier.py")
rapier = importlib.util.module_from_spec(RAPIER_SPEC)
RAPIER_SPEC.loader.exec_module(rapier)
GJH_CSS_SPEC = importlib.util.spec_from_file_location("build_gjh_css", ROOT / "scripts/build_gjh_css.py")
gjh_css = importlib.util.module_from_spec(GJH_CSS_SPEC)
GJH_CSS_SPEC.loader.exec_module(gjh_css)
GJH_PACK_SPEC = importlib.util.spec_from_file_location("build_gjh_startup_pack", ROOT / "scripts/build_gjh_startup_pack.py")
gjh_pack = importlib.util.module_from_spec(GJH_PACK_SPEC)
GJH_PACK_SPEC.loader.exec_module(gjh_pack)
GJH_JS_SPEC = importlib.util.spec_from_file_location("build_gjh_startup_js", ROOT / "scripts/build_gjh_startup_js.py")
gjh_js = importlib.util.module_from_spec(GJH_JS_SPEC)
GJH_JS_SPEC.loader.exec_module(gjh_js)


DEMO_PWA_SPEC = importlib.util.spec_from_file_location("build_demo_pwas", ROOT / "scripts/build_demo_pwas.py")
demo_pwas = importlib.util.module_from_spec(DEMO_PWA_SPEC)
DEMO_PWA_SPEC.loader.exec_module(demo_pwas)


ATLAS_SPEC = importlib.util.spec_from_file_location("build_style_atlas", ROOT / "scripts/build_style_atlas.py")
style_atlas = importlib.util.module_from_spec(ATLAS_SPEC)
ATLAS_SPEC.loader.exec_module(style_atlas)


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
        landing = company.get("landing")
        if landing:
            image = local_path(directory, landing["image"]).relative_to(directory)
            if (len(image.parts) != 3 or image.parts[0] not in {d["version"] for d in own}
                    or image.parts[1] != "assets" or image.suffix not in {".jpg", ".jpeg", ".png", ".svg", ".webp"}):
                raise ValueError(f"Landing artwork must be a published demo image: {image}")
            if not re.fullmatch(r"[a-z0-9-]*", landing["anchor"]):
                raise ValueError(f"Invalid landing anchor: {company['id']}")
            if landing["alternativeVersion"] not in {d["version"] for d in own}:
                raise ValueError(f"Unknown alternative design: {company['id']}")
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


def icon(name, prefix=""):
    known = {item["id"] for item in read_json(ROOT / "design-system/icons.json")["icons"]}
    if name not in known:
        raise ValueError(f"Unknown Gallery icon: {name}")
    return f'<svg class="gallery-icon" aria-hidden="true" focusable="false"><use href="{escape(prefix)}assets/icons.svg#{name}"></use></svg>'


def company_card(company, designs, prefix, categories):
    own = [d for d in designs if d["companyId"] == company["id"]]
    featured = next(d for d in own if d["version"] == company["featuredVersion"])
    name = escape(company["name"])
    category_name = ", ".join(categories[c] for c in company["categories"])
    attrs = card_data({"company": company["id"], "name": company["name"],
                       "search": " ".join((company["name"], company["slug"], company["industry"], company["location"])),
                       "categories": " ".join(company["categories"]), "count": len(own)})
    return f'''<a class="company-card" href="{prefix}companies/{escape(company['slug'])}/index.html" {attrs}>
      <div class="company-cover"><img src="{prefix}{escape(featured['thumbnail'])}" alt="Design preview for {name}" width="720" height="450" loading="lazy"><span class="cover-badge">DESIGN COLLECTION</span></div>
      <div class="company-card-copy"><div class="card-topline"><span class="company-monogram" aria-hidden="true">{escape(company['initials'])}</span><span class="industry-label">{escape(category_name)} &middot; {escape(company['location'])}</span></div>
      <h3>{name}</h3><p class="card-description">{escape(company['description'])}</p><div class="card-bottom"><span>{plural(len(own), 'design concept')}</span><span class="card-action">Explore designs <span aria-hidden="true">{icon("arrow-right", prefix)}</span></span></div></div></a>'''


def collection_feature(company, designs):
    by_version = {design["version"]: design for design in designs}
    featured = by_version[company["featuredVersion"]]
    landing = company.get("landing", {})
    image = (company["demoDirectory"] + "/" + landing["image"]) if landing else featured["thumbnail"]
    target = featured["demoPath"]
    if landing.get("anchor"):
        target += "#" + landing["anchor"]
    links = [(target, landing.get("action", featured["title"]), "primary-link")]
    alternative = by_version.get(landing.get("alternativeVersion"))
    if alternative:
        links.append((alternative["demoPath"], landing["alternativeAction"], "collection-alternative"))
    actions = "".join(f'<a class="{style}" href="../../{escape(path)}">{escape(label)} {icon("arrow-right", "../../")}</a>'
                      for path, label, style in links)
    return {"collection_image": escape(image), "collection_actions": actions}


def design_card(design, company, can_compare):
    prefix = "../../"
    query = f"company={escape(company['id'])}&amp;design={escape(design['version'])}"
    title = escape(design["title"])
    attrs = card_data({"design": design["version"], "title": design["title"],
                       "styles": " ".join(design["styles"]), "order": design["order"]})
    compare_control = f'''<label class="compare-checkbox"><input type="checkbox" value="{escape(design['version'])}">Compare<span class="visually-hidden"> {title}</span></label>''' if can_compare else ""
    return f'''<article class="design-card" {attrs}>
      <a class="design-preview" href="{prefix}designs/index.html?{query}" aria-label="View {title} details"><img src="{prefix}{escape(design['thumbnail'])}" alt="{title} desktop preview" width="720" height="450" loading="lazy"></a>
      <div class="design-card-copy"><div class="version-row"><span class="version-badge">{escape(design['version'].upper())}</span>{compare_control}</div>
      <h3><a href="{prefix}designs/index.html?{query}">{title}</a></h3><p class="card-description">{escape(design['description'])}</p><div class="card-bottom"><a class="details-link" href="{prefix}designs/index.html?{query}">View details</a><a class="card-action" href="{prefix}{escape(design['demoPath'])}">Open live demo <span aria-hidden="true">{icon("arrow-up-right", prefix)}</span><span class="visually-hidden">: {title}</span></a></div></div></article>'''


def validate_locales(directory=ROOT / "locales"):
    """Reject incomplete packs and broken dynamic placeholders before publication."""
    packs = {code: read_json(directory / f"{code}.json") for code in ("zh-Hans", "ms")}
    packs["en"] = read_json(directory / "source/en.json")
    for code, pack in packs.items():
        for kind in ("messages", "patterns"):
            messages = pack.get(kind)
            if not isinstance(messages, dict) or not all(isinstance(value, str) and value for value in messages.values()):
                raise ValueError(f"Invalid locale map: {code}/{kind}")
            if messages.keys() != packs["en"][kind].keys():
                raise ValueError(f"Incomplete locale keys: {code}/{kind}")
            for key, value in messages.items():
                if sorted(re.findall(r"\{\w+\}", key)) != sorted(re.findall(r"\{\w+\}", value)):
                    raise ValueError(f"Invalid locale placeholders: {code}/{key}")
    return packs


def build_english_pack(pack, check):
    # English HTML already supplies identity translations; patterns still drive dynamic labels.
    runtime = {"messages": {key: value for key, value in pack["messages"].items() if key != value},
               "patterns": pack["patterns"]}
    content = json.dumps(runtime, ensure_ascii=False, indent=2) + "\n"
    target = ROOT / "locales/en.json"
    if target.is_file() and target.read_text(encoding="utf-8") == content:
        return
    if check:
        raise ValueError("Regenerate locales/en.json from locales/source/en.json")
    with target.open("w", encoding="utf-8", newline="\n") as output:
        output.write(content)


def runtime_resources(catalog):
    resources = {Path(name) for name in (
        "src/demo-pwa.js", "assets/demo-pwa.css", "assets/tokens.css", "assets/gjh-themes.css", "assets/icons.svg", "assets/gallery.css", "assets/pwa.css", "src/gallery.js", "src/pwa.js", "src/preferences-boot.js", "src/preferences.js",
        "locales/en.json", "locales/zh-Hans.json", "locales/ms.json",
        "data/companies.json", "data/categories.json", "data/styles.json", "manifest.webmanifest",
        "assets/icons/gallery.svg", "assets/icons/gallery-180.png", "assets/icons/gallery-192.png", "assets/icons/gallery-512.png", "assets/icons/gallery-maskable-512.png",
    )}
    resources.update(Path("demos/corporate/gjh/v11") / name for name in
                     ("manifest.webmanifest", "offline.html", "pwa.js", "style.bundle.css", "script.bundle.js"))
    # Shared 3D UI ships with the demo; keep it out of the gallery shell precache.
    for directory in ("assets/onboarding", "design-system/onboarding"):
        resources.update(path.relative_to(ROOT) for path in (ROOT / directory).rglob("*") if path.is_file())
    for company in catalog["companies"]:
        shared = ROOT / company["demoDirectory"] / "shared"
        if shared.is_dir():
            resources.update(path.relative_to(ROOT) for path in shared.iterdir()
                             if path.is_file() and path.suffix in (".css", ".js"))
    for design in catalog["designs"]:
        directory = Path(design["demoPath"]).parent
        resources.add(directory / "index.html")
        resources.update(directory / name for name in ("style.css", "script.js") if (ROOT / directory / name).is_file())
        resources.update(p.relative_to(ROOT) for p in (ROOT / directory / "assets").iterdir() if p.is_file())
        assets = ROOT / directory / "assets"
        for nested in ("brand-kit", "brands", "gallery-assets"):
            resources.update(path.relative_to(ROOT) for path in (assets / nested).rglob("*") if path.is_file())
        vendor = ROOT / directory / "vendor"
        if vendor.is_dir():
            resources.update(p.relative_to(ROOT) for p in vendor.iterdir() if p.is_file())
        resources.update(Path(s["path"]) for s in design["screenshots"].values())
    resources.update(style_atlas.resources(ROOT))
    return sorted(resources)


def source_bytes(path):
    """Match Git/Linux publication bytes when building from a Windows checkout."""
    if path.suffix in (".html", ".css", ".js", ".json", ".webmanifest", ".txt") or path == ROOT / "assets/icons.svg":
        return path.read_text(encoding="utf-8-sig").encode("utf-8")
    return path.read_bytes()


def release_info(catalog):
    design_system.build(ROOT, check=True)
    version = read_json(ROOT / "data/app.json")["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Application version must use major.minor.patch")
    digest = hashlib.sha256(json.dumps(catalog, sort_keys=True).encode("utf-8"))
    inputs = runtime_resources(catalog) + list((ROOT / "templates/gallery").glob("*")) + [Path("scripts/build_gallery.py"), Path("scripts/build_demo_pwas.py"), Path("data/app.json")]
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
        single_company = len(companies) == 1
        content = render(
            "home", prefix=prefix, company_count=len(companies), design_summary=plural(len(designs), "design"),
            heading="One company." if path == "index.html" and single_company else "All companies.",
            direction="Many creative directions." if path == "index.html" else "Find your next direction.",
            company_filters_before="" if single_company else filters, company_filters_after=filters if single_company else "",
            company_cards="".join(company_card(c, designs, prefix, category_names) for c in companies),
        )
        pages[path] = shell(title="Companies — Webpage Design Gallery", description="Explore independent website design concepts, organized by company.", prefix=prefix, current='aria-current="page"', page_kind="companies", content=content)
    for company in companies:
        own = [d for d in designs if d["companyId"] == company["id"]]
        available_styles = {style for d in own for style in d["styles"]}
        options = "".join(f'<option value="{escape(s["id"])}">{escape(s["name"])}</option>' for s in catalog["styles"] if s["id"] in available_styles)
        can_compare = len(own) > 1
        content = render(
            "company", prefix="../../", company_id=escape(company["id"]), company_name=escape(company["name"]),
            company_description=escape(company["description"]), **collection_feature(company, own),
            industry=escape(company["industry"]), location=escape(company["location"]),
            official_website=escape(company["officialWebsite"]),
            design_count=len(own), design_cards="".join(design_card(d, company, can_compare) for d in own),
            collection_title="Explore the designs" if can_compare else "Explore the design",
            collection_controls=render("collection-controls", prefix="../../", style_options=options) if can_compare else "",
        )
        pages[f"companies/{company['slug']}/index.html"] = shell(title=escape(company["name"]) + " — Design collection", description=escape(company["description"]), prefix="../../", current="", page_kind="company", content=content)
    for page in ("design", "compare"):
        path = "designs/index.html" if page == "design" else "compare/index.html"
        pages[path] = shell(title=f"{page.title()} — Webpage Design Gallery", description="Explore and compare independent website design concepts.", prefix="../", current="", page_kind=page, content=render(page))
    pages["offline.html"] = shell(title="Connection needed — Webpage Design Gallery", description="Browse saved company collections or reconnect to open a live demo.", prefix="", current="", page_kind="offline", content=render("offline", prefix=""))
    pages["data/designs.json"] = json.dumps(designs, indent=2, ensure_ascii=False) + "\n"
    return pages


def pwa_outputs(pages, catalog, release):
    paths = set(pages) | {p.as_posix() for p in runtime_resources(catalog) if p.as_posix() not in ("src/demo-pwa.js", "assets/demo-pwa.css") and not p.as_posix().startswith(("demos/", "style-atlas/images/", "style-atlas/sheets/", "assets/onboarding/", "design-system/onboarding/"))}
    paths.update(design["thumbnail"] for design in catalog["designs"])
    paths.update(c["demoDirectory"] + "/" + c["landing"]["image"] for c in catalog["companies"] if c.get("landing"))
    entries = []
    for name in sorted(paths):
        data = pages[name].encode("utf-8") if name in pages else source_bytes(ROOT / name)
        entries.append({"path": name, "sha256": hashlib.sha256(data).hexdigest()})
    worker = (ROOT / "templates/gallery/sw.js").read_text(encoding="utf-8")
    worker = worker.replace("__BUILD__", json.dumps(release["build"])).replace("__VERSION__", json.dumps(release["version"])).replace("__PRECACHE__", json.dumps(entries, indent=2))
    mall_root = ROOT / "demos/corporate/gjh/v11"
    mall_paths = ("offline.html", "manifest.webmanifest", "assets/mall-icon-192.png", "assets/mall-icon-512.png",
                  "style.bundle.css", "assets/loader.js", "assets/gjh-loader-mark.svg")
    mall_entries = [{"path": name, "sha256": hashlib.sha256(source_bytes(mall_root / name)).hexdigest()} for name in mall_paths]
    mall_worker = (ROOT / "templates/gallery/gjh-v11-sw.js").read_text(encoding="utf-8")
    mall_worker = mall_worker.replace("__BUILD__", json.dumps(release["build"])).replace("__VERSION__", json.dumps(release["version"])).replace("__PRECACHE__", json.dumps(mall_entries, indent=2))
    outputs = demo_pwas.outputs(ROOT, catalog, release, runtime_resources(catalog), source_bytes)
    outputs.update({"version.json": json.dumps(release, indent=2) + "\n", "sw.js": worker,
                    "demos/corporate/gjh/v11/pwa-sw.js": mall_worker})
    return outputs


def build(output=ROOT, check=False):
    packs = validate_locales()
    build_english_pack(packs["en"], check)
    rapier.build(check=check)
    gjh_css.build(check=check)
    gjh_pack.build(check=check)
    gjh_js.build(check=check)
    design_system.build(ROOT, check=check)
    catalog = load_catalog()
    style_atlas.build(ROOT, catalog, check)
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
            with target.open("w", encoding="utf-8", newline="\n") as page_file:
                page_file.write(text)
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
