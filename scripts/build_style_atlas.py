"""Generate the public visual reference index from the art director's source records."""
import json
import re
from html import escape
from pathlib import Path
from string import Template


def sources(root):
    return sorted((root / "docs/landing-atlas").glob("*/directions.json"))


def records(path):
    return json.loads(path.read_text(encoding="utf-8"))


def image_path(company, key):
    if not all(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", part) for part in (company, key)):
        raise ValueError(f"Invalid design reference path: {company}/{key}")
    return Path("style-atlas/images") / company / (key + ".webp")


def resources(root):
    files = {Path("style-atlas/index.html"), Path("style-atlas/atlas.css")}
    for path in sources(root):
        files.add(Path("style-atlas/sheets") / (path.parent.name + ".webp"))
        files.update(image_path(path.parent.name, item["key"]) for item in records(path))
    return files


def render(root, catalog):
    companies = {company["id"]: company for company in catalog["companies"]}
    designs = {(design["companyId"], design["version"]): design for design in catalog["designs"]}
    groups, navigation = [], []
    total = 0
    markdown = ["# Landing style atlas", "",
                "Open the [live atlas](https://yapweijun1996.github.io/Webpage-Design-Gallery/style-atlas/) to filter the references and compare them with current demo previews.", "",
                "Every published edition has one primary mockup. Alternate directions propose another composition for the linked edition. The source records, palettes and art direction live under [docs/landing-atlas](../docs/landing-atlas).", ""]
    for path in sources(root):
        company_id = path.parent.name
        company = companies[company_id]
        name = escape(company["name"])
        entries = records(path)
        markdown.extend([f"## {company['name']}", "", f"[See all {len(entries)} references together](sheets/{company_id}.webp)", "", "| Edition | Art direction | Image | Live demo |",
                         "| --- | --- | --- | --- |"])
        checked = path.with_name("verified-renders.json")
        factual_renders = set(records(checked)) if checked.exists() else set()
        keys, primaries, cards = set(), set(), []
        for item in entries:
            key, version, kind = item["key"], item["version"], item["kind"]
            design = designs[company_id, version]
            source = (root / item["image"]).resolve()
            if not source.is_relative_to((root / "demos").resolve()) or not source.is_file():
                raise ValueError(f"Missing source artwork for {company_id}/{key}")
            if key in keys or kind not in ("primary", "alternate") or (kind == "primary" and version in primaries):
                raise ValueError(f"Invalid or repeated reference: {company_id}/{key}")
            keys.add(key)
            if kind == "primary":
                primaries.add(version)
            image = image_path(company_id, key)
            if not (root / image).is_file():
                raise ValueError(f"Missing mockup: {image}")
            anchor = company_id + "-" + (version if kind == "primary" else key)
            role = "Primary reference" if kind == "primary" else "Alternate direction"
            medium = "Typeset UI study" if key in factual_renders else "AI-generated UI study"
            subject = escape(item["style"])
            title = escape(item["headline"])
            image_url = escape(image.relative_to("style-atlas").as_posix())
            live = "https://yapweijun1996.github.io/Webpage-Design-Gallery/" + design["demoPath"]
            markdown.append(f'| {version.upper()} · {kind} | {item["style"]} | [Open WebP]({image_url}) | [Open demo]({live}) |')
            cards.append(f'''<article id="{anchor}" data-kind="{kind}">
  <a class="art" href="{image_url}" aria-label="Open full-size {subject} mockup"><img src="{image_url}" alt="{subject} landing concept for {title}" loading="lazy" decoding="async" width="1440" height="900"></a>
  <div class="caption"><p class="edition">{role} · {escape(version.upper())} · {medium}</p><h3>{subject}</h3>
  <p>{escape(item["notes"])}</p>
  <div class="actions"><a href="../{escape(design["demoPath"])}">Open {escape(design["title"])} <span aria-hidden="true">↗</span></a><a href="{image_url}">Full-size mockup</a></div>
  <details><summary>Compare with the gallery preview</summary><figure><img src="../{escape(design["thumbnail"])}" loading="lazy" decoding="async" width="720" height="450" alt="Published gallery preview of {escape(design["title"])}"><figcaption>Current demo · {escape(design["title"])}</figcaption></figure></details></div>
</article>''')
        expected = {version for cid, version in designs if cid == company_id}
        if factual_renders - keys:
            raise ValueError(f"Unrecognised reference in {checked}")
        if primaries != expected:
            raise ValueError(f"Each published {name} edition requires one primary reference")
        navigation.append(f'<a href="#{company_id}">{name}</a>')
        groups.append(f'<section id="{company_id}"><header class="company"><h2>{name}</h2><div class="actions"><a href="sheets/{company_id}.webp">Open overview sheet</a><a href="../companies/{company["slug"]}/index.html">Company collection ↗</a></div></header><div class="grid">'+"\n".join(cards)+'</div></section>')
        total += len(cards)
        markdown.append("")
    template = Template((root / "templates/atlas/index.html").read_text(encoding="utf-8"))
    html = template.substitute(total=total, navigation="".join(navigation), sections="\n".join(groups))
    return {"index.html": html, "README.md": "\n".join(markdown)}


def build(root, catalog, check):
    for filename, content in render(root, catalog).items():
        target = root / "style-atlas" / filename
        if check:
            if not target.exists() or target.read_text(encoding="utf-8") != content:
                raise ValueError(f"Regenerate {filename} using scripts/build_gallery.py")
        else:
            target.write_text(content, encoding="utf-8", newline="\n")
