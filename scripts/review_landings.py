"""Compare the gallery's captured first screens with a Git revision in a portable HTML file."""

import argparse
import base64
import io
import json
import subprocess
from html import escape
from pathlib import Path
from string import Template

from PIL import Image
from build_gallery import ROOT, load_catalog

VIEWPORTS = {390: ("mobile", 844), 768: ("tablet", 1024), 1440: ("desktop", 900)}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def picture(raw):
    image = Image.open(io.BytesIO(raw))
    image.load()
    return image


def logical_height(image, width):
    if image.width < width or image.width % width:
        raise ValueError(f"Expected a capture at {width} CSS pixels or an integer device scale, got {image.width}")
    return image.height // (image.width // width)


def preview(image, width, height):
    scale = image.width // width
    visible = image.crop((0, 0, image.width, height * scale)).convert("RGB")
    visible.thumbnail((min(width, 760), height), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    visible.save(buffer, format="WEBP", quality=83, method=2)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f'<img width="{visible.width}" height="{visible.height}" loading="lazy" alt="" src="data:image/webp;base64,{encoded}">'


def viewport_row(design, previous, commit, width):
    device, viewport_height = VIEWPORTS[width]
    current = picture((ROOT / design["screenshots"][device]["path"]).read_bytes())
    before = None
    if previous:
        before = picture(git("show", commit + ":" + previous["screenshots"][device]["path"]))
    height = min(viewport_height, logical_height(current, width))
    if before is not None:
        height = min(height, logical_height(before, width))
    old = preview(before, width, height) if before is not None else '<p>New edition</p>'
    new = preview(current, width, height)
    return f'''<div class="comparison" data-width="{width}">
      <figure><figcaption>Before · {width} px</figcaption>{old}</figure>
      <figure><figcaption>After · {width} px</figcaption>{new}</figure>
    </div>'''


def build_report(base, company_id, widths, output):
    commit = git("rev-parse", "--verify", "--end-of-options", base + "^{commit}").decode().strip()
    baseline = {d["id"]: d for d in json.loads(git("show", commit + ":data/designs.json"))}
    catalog = load_catalog()
    companies = [c for c in catalog["companies"] if not company_id or c["id"] == company_id]
    if not companies:
        raise ValueError(f"Unknown company ID: {company_id}")
    sections = []
    links = []
    count = 0
    for company in companies:
        name, slug = escape(company["name"]), escape(company["slug"])
        cards = []
        for design in (d for d in catalog["designs"] if d["companyId"] == company["id"]):
            title, version = escape(design["title"]), escape(design["version"].upper())
            rows = "".join(viewport_row(design, baseline.get(design["id"]), commit, w) for w in widths)
            cards.append(f'<article><h3>{title} <small>{version}</small></h3>{rows}</article>')
        links.append(f'<a href="#{slug}">{name}</a>')
        sections.append(f'<section id="{slug}"><h2>{name}</h2>{"".join(cards)}</section>')
        count += len(cards)
    template = Template((ROOT / "templates/review/landings.html").read_text(encoding="utf-8"))
    options = "".join(f'<option value="{w}">{w} px</option>' for w in widths)
    result = template.substitute(revision=commit[:12], count=count, sections="".join(sections),
                                 options=options, links="".join(links))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result, encoding="utf-8")
    print(f"{count} designs at {', '.join(map(str, widths))} CSS pixels. Wrote {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Git revision containing the earlier data/designs.json and screenshots")
    parser.add_argument("--output", type=Path, required=True, help="Output HTML file, including its images")
    parser.add_argument("--company", help="Limit the review to a company ID")
    parser.add_argument("--width", type=int, choices=VIEWPORTS, action="append",
                        help="Viewport to include. Repeat for multiple widths. Defaults to all three.")
    args = parser.parse_args()
    try:
        build_report(args.base, args.company, list(dict.fromkeys(args.width or VIEWPORTS)), args.output)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Cannot create landing review: {error}\n")
