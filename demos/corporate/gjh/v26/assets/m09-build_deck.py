"""Build the editable PowerPoint from the web module's slide content."""

from pathlib import Path
from xml.etree import ElementTree

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Inches, Pt


ASSETS = Path(__file__).resolve().parent
INK = "14110D"
PAPER = "F6EFE0"
GOLD = "E6C77A"
EVIDENCE_COLORS = {
    "已证实": "A9DCB5",
    "有报道": GOLD,
    "未核实": "F5AE9F",
}


def add_text(slide, value, x, y, width, height, size, color, *, bold=False):
    box = slide.shapes.add_textbox(
        Inches(x), Inches(y), Inches(width), Inches(height)
    )
    frame = box.text_frame
    frame.word_wrap = True
    frame.margin_left = frame.margin_right = Pt(0)
    frame.margin_top = frame.margin_bottom = Pt(0)

    paragraph = frame.paragraphs[0]
    paragraph.line_spacing = 1.18
    run = paragraph.add_run()
    run.text = value
    run.font.name = "Microsoft YaHei"
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)

    properties = run._r.get_or_add_rPr()
    properties.set("lang", "zh-CN")
    east_asian = OxmlElement("a:ea")
    east_asian.set("typeface", "Microsoft YaHei")
    properties.append(east_asian)


def build_deck():
    fragment = ASSETS.parent / "modules" / "m09.html"
    module = ElementTree.parse(fragment)
    articles = module.findall(".//article")
    if len(articles) != 10:
        raise ValueError("The web module must contain exactly ten slides.")

    deck = Presentation()
    deck.slide_width = Inches(13 + 1 / 3)
    deck.slide_height = Inches(7.5)
    deck.core_properties.title = "GJH 故事工作室"
    deck.core_properties.subject = "GJH故事与品牌名录"
    deck.core_properties.author = "GJH 故事工作室"
    blank_layout = deck.slide_layouts[6]
    for layout in list(deck.slide_layouts):
        if layout != blank_layout:
            deck.slide_layouts.remove(layout)

    for page, article in enumerate(articles, start=1):
        slide = deck.slides.add_slide(blank_layout)
        fill = slide.background.fill
        fill.solid()
        fill.fore_color.rgb = RGBColor.from_string(INK)

        title = article.findtext("h3")
        lead = article.findtext("p")
        if lead is not None:
            add_text(slide, title, 0.95, 2.57, 11.4, 1.05, 52, GOLD, bold=True)
            add_text(slide, lead, 0.99, 3.86, 11.2, 0.95, 25, PAPER)
        else:
            add_text(slide, title, 0.95, 0.95, 11.4, 1, 38, GOLD, bold=True)
            for index, record in enumerate(article.findall("./div/p")):
                status = record.find("strong")
                y = 2.2 + index * 1.08
                add_text(slide, status.text, 0.99, y + 0.03, 1.05, 0.5, 16,
                         EVIDENCE_COLORS[status.text], bold=True)
                add_text(slide, status.tail.strip(), 2.18, y, 10.06, 0.96, 23, PAPER)

        add_text(slide, f"{page:02d} / {len(articles):02d}", 0.99, 6.94, 2, 0.3, 12, GOLD)
        slide.notes_slide.notes_text_frame.text = f"资料来源：docs/{article.attrib['data-source']}"

    deck.save(ASSETS / "m09-gjh-deck.pptx")


if __name__ == "__main__":
    build_deck()
