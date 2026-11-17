"""Pair original primary artwork with before/after browser captures, preserving each viewport."""
import argparse
from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont, ImageOps

from build_style_atlas import image_path, records, sources

ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = "#f8f6ef"
INK = "#283029"


def place(board, path, origin, box, expected=None):
    with Image.open(path) as source:
        if expected and source.size != expected:
            raise ValueError(f"{path}: expected {expected}, found {source.size}")
        thumbnail = ImageOps.contain(source.convert("RGB"), box, Image.Resampling.LANCZOS)
        board.paste(thumbnail, origin)


def sheet(company, entry, captures, target):
    version = entry["version"]
    board = Image.new("RGB", (1780, 1084), BACKGROUND)
    draw = ImageDraw.Draw(board)
    label = ImageFont.load_default(size=20)
    title = ImageFont.load_default(size=33)
    draw.text((22, 14), f"{company['name']}  /  {version.upper()}  /  {entry['style']}", font=title, fill=INK)
    draw.text((22, 75), "Primary mockup", font=label, fill=INK)
    place(board, ROOT / image_path(company["id"], entry["key"]), (22, 109), (688, 445))
    draw.text((22, 583), "Visitor action", font=label, fill=INK)
    draw.text((22, 615), entry["action"], font=title, fill=INK)
    draw.text((22, 702), "Art direction", font=label, fill=INK)
    draw.multiline_text((22, 737), "\n".join(wrap(entry["notes"], 53)), font=label, fill=INK, spacing=8)
    for phase, y in (("before", 75), ("after", 574)):
        for width, height, x, box in ((1440, 900, 731, (782, 462)), (390, 844, 1543, (214, 462))):
            draw.text((x, y), f"{phase.title()} · {width} × {height}", font=label, fill=INK)
            path = captures / company["id"] / phase / f"{version}-{width}.png"
            place(board, path, (x, y + 33), box, (width, height))
    target.parent.mkdir(parents=True, exist_ok=True)
    board.save(target, "WEBP", quality=87, method=5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", type=Path, help="Root of <company>/<before|after>/<version>-<width>.png")
    args = parser.parse_args()
    companies = {c["id"]: c for c in records(ROOT / "data/companies.json")}
    for path in sources(ROOT):
        company = companies[path.parent.name]
        for entry in records(path):
            if entry["kind"] == "primary":
                target = path.parent / "audit" / (entry["version"] + ".webp")
                sheet(company, entry, args.captures, target)
                print(target.relative_to(ROOT), flush=True)


if __name__ == "__main__":
    main()
