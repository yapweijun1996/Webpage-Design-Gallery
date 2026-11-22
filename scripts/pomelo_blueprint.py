"""Publish the standalone multilingual Pomelo Systems Blueprint edition."""

from pathlib import Path


DESIGN_ID = "pomelo-stem-v2"
DIRECTORY = Path("demos/corporate/pomelo-stem/v2")
LANGUAGES = ("", "zh", "ms")
PAGES = (
    "index", "services", "online-shopping", "whatsapp-orders", "ai-integration",
    "custom-systems", "how-it-works", "seller-studio", "demo-case", "about", "faq", "contact",
)
HTML = frozenset(Path(language, page + ".html") for language in LANGUAGES for page in PAGES)
THUMBNAIL = Path("assets/thumbnail.webp")
SCREENSHOTS = frozenset(Path("screenshots", f"{size}.png") for size in (1440, 768, 390))
ASSETS = frozenset(Path("assets", name) for name in (
    "main.js", "style.css", "blueprint-tokens.css", "official-pomelo-mark.png", "spl2.jpg",
))


def runtime_resources(root, directory, thumbnail, screenshots, regular_file):
    """Keep the fixed 36-page matrix independent of the V1 study manifest."""
    if (directory != DIRECTORY or thumbnail != DIRECTORY / THUMBNAIL
            or screenshots != {DIRECTORY / path for path in SCREENSHOTS}):
        raise ValueError("Unexpected Pomelo Blueprint route or gallery media path")
    resources = {DIRECTORY / path for path in HTML | ASSETS | {THUMBNAIL} | SCREENSHOTS}
    for relative in sorted(resources):
        regular_file(root, relative)
    return resources
