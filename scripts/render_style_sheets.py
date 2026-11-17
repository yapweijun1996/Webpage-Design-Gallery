"""Make labelled overview sheets from the final atlas images. Requires Pillow."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps
from build_style_atlas import image_path, records, sources

ROOT = Path(__file__).resolve().parents[1]


def draw_sheet(company, entries, output):
    columns, tile_width, tile_height = 4, 400, 303
    rows = (len(entries) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_width + 40, rows * tile_height + 96), "#f6f3eb")
    draw = ImageDraw.Draw(sheet)
    title_font = ImageFont.load_default(size=32)
    label_font = ImageFont.load_default(size=18)
    small_font = ImageFont.load_default(size=15)
    draw.text((24,18), company["name"], font=title_font, fill="#273025")
    draw.text((26,58), f"{len(entries)} landing-page design references", font=small_font, fill="#4d594a")
    for index, entry in enumerate(entries):
        col, row = index % columns, index // columns
        x, y = 24 + col * tile_width, 90 + row * tile_height
        with Image.open(ROOT / image_path(company["id"], entry["key"])) as original:
            image = ImageOps.contain(original.convert("RGB"), (tile_width - 14, 240), Image.Resampling.LANCZOS)
            sheet.paste(image, (x + (tile_width - 14 - image.width)//2, y))
        draw.text((x, y + 247), entry["style"], font=label_font, fill="#273025")
        draw.text((x, y + 272), entry["version"].upper() + "  /  " + entry["kind"], font=small_font, fill="#52604f")
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, "WEBP", quality=87, method=5)


if __name__ == "__main__":
    companies = {company["id"]: company for company in records(ROOT / "data/companies.json")}
    for path in sources(ROOT):
        company = path.parent.name
        target = ROOT / "style-atlas/sheets" / (company + ".webp")
        draw_sheet(companies[company], records(path), target)
        print(target.relative_to(ROOT))
