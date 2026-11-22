"""Publish only the standalone Order Journey edition's fixed runtime files."""

from pathlib import Path


DESIGN_ID = "pomelo-stem-v3"
DIRECTORY = Path("demos/corporate/pomelo-stem/v3")
LANGUAGES = ("", "zh", "ms")
PAGES = ("index", "story", "services", "contact")
HTML = frozenset(Path(language, page + ".html") for language in LANGUAGES for page in PAGES)
THUMBNAIL = Path("assets/thumbnail.webp")
SCREENSHOTS = frozenset(Path("screenshots", f"{size}.png") for size in (1440, 768, 390))
ASSETS = frozenset(Path("assets", name) for name in (
    "style.css", "journey-tokens.css", "logo.png", "hero.webp", "message.webp",
    "review.webp", "pack.webp", "story-message.webp", "story-review.webp", "story-pack.webp",
))


def runtime_resources(root, directory, thumbnail, screenshots, regular_file):
    """Keep the twelve localized routes independent of V1/V2's file sets."""
    if (directory != DIRECTORY or thumbnail != DIRECTORY / THUMBNAIL
            or screenshots != {DIRECTORY / path for path in SCREENSHOTS}):
        raise ValueError("Unexpected Pomelo Order Journey route or gallery media path")
    files = {DIRECTORY / path for path in HTML | ASSETS | {THUMBNAIL} | SCREENSHOTS}
    for relative in sorted(files):
        regular_file(root, relative)
    return files
