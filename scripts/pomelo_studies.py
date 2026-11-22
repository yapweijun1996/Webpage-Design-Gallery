"""Publish only the registered Pomelo study routes and shared static assets."""

import json
import re
from pathlib import Path


DESIGN_ID = "pomelo-stem-v1"
DIRECTORY = Path("demos/corporate/pomelo-stem/v1")
LANGUAGES = ("en", "zh-Hans", "ms")
PAGES = ("index", "services", "cases", "contact")
STUDY_COUNT = 20
SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
STUDY_PAGE = re.compile(rf"studies/({SLUG})/(?:en|zh-Hans|ms)/(?:index|services|cases|contact)\.html")
SHARED_ASSET = re.compile(rf"shared/{SLUG}\.(?:css|svg|js|webp)")


def regular_file(root, relative):
    """Accept a canonical repository-relative path through real directories only."""
    candidate = root
    for component in relative.parts:
        candidate /= component
        if candidate.is_symlink():
            raise ValueError(f"Pomelo publication rejects symbolic links: {relative.as_posix()}")
    if not candidate.is_file():
        raise ValueError(f"Missing Pomelo publication file: {relative.as_posix()}")
    return candidate


def manifest_assets(root, directory=DIRECTORY):
    if directory != DIRECTORY:
        raise ValueError(f"Unexpected Pomelo study collection location: {directory.as_posix()}")
    manifest = regular_file(root, directory / "study-assets.json")
    entries = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(entries, list):
        raise ValueError("Pomelo study-assets.json must be an array of relative paths")

    paths = set()
    study_ids = set()
    pages = set()
    for entry in entries:
        match = STUDY_PAGE.fullmatch(entry) if isinstance(entry, str) else None
        if not match and not (isinstance(entry, str) and SHARED_ASSET.fullmatch(entry)):
            raise ValueError(f"Invalid Pomelo publication path: {entry!r}")
        if entry in paths:
            raise ValueError(f"Duplicate Pomelo publication path: {entry}")
        paths.add(entry)
        if match:
            study_ids.add(match.group(1))
            pages.add(entry)

    required = {f"studies/{study}/{lang}/{page}.html"
                for study in study_ids for lang in LANGUAGES for page in PAGES}
    if len(study_ids) != STUDY_COUNT or pages != required:
        raise ValueError(f"Pomelo publication requires exactly {STUDY_COUNT} complete study matrices; "
                         f"found {len(study_ids)} studies / {len(pages)} pages")
    shared = paths - pages
    if not shared:
        raise ValueError("Pomelo publication requires shared static assets")
    thumbnails = {path for path in shared if path.endswith(".webp")}
    if thumbnails != {f"shared/{study}.webp" for study in study_ids}:
        raise ValueError("Pomelo publication requires exactly one shared WebP preview per study")

    resources = {directory / path for path in paths}
    for resource in sorted(resources):
        regular_file(root, resource)
    return resources


def runtime_resources(root, directory, thumbnail, screenshots):
    fixed = {DIRECTORY / path for path in ("index.html", "assets/thumbnail.webp",
             "screenshots/1440.png", "screenshots/768.png", "screenshots/390.png")}
    if thumbnail != DIRECTORY / "assets/thumbnail.webp" or screenshots != fixed - {
            DIRECTORY / "index.html", thumbnail}:
        raise ValueError("Unexpected Pomelo thumbnail or screenshot paths")
    resources = manifest_assets(root, directory) | fixed
    for resource in sorted(fixed):
        regular_file(root, resource)
    return resources
