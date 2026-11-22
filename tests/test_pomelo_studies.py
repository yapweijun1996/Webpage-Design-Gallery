"""Exercise the Pomelo publication contract without depending on authored content."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/pomelo_studies.py"
SPEC = importlib.util.spec_from_file_location("pomelo_studies", SCRIPT)
studies = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(studies)


class PomeloStudiesTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.repo = Path(temp.name)
        self.hub = self.repo / studies.DIRECTORY
        self.pages = [f"studies/s{i:02d}/{lang}/{page}.html"
                      for i in range(1, 21) for lang in ("en", "zh-Hans", "ms")
                      for page in ("index", "services", "cases", "contact")]
        self.previews = [f"shared/s{i:02d}.webp" for i in range(1, 21)]
        self.entries = self.pages + self.previews + ["shared/theme.css", "shared/symbols.svg", "shared/study.js"]
        self.fixed = ["index.html", "assets/thumbnail.webp", "screenshots/1440.png",
                      "screenshots/768.png", "screenshots/390.png"]
        for name in self.entries + self.fixed:
            self.write(name, "fixture\n")
        self.manifest(self.entries)

    def write(self, name, contents):
        path = self.hub / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(contents, encoding="utf-8")

    def manifest(self, entries):
        self.write("study-assets.json", json.dumps(entries))

    def test_complete_allowlist_publishes_only_registered_resources(self):
        self.write("shared/prototype.js", "not registered")
        self.write("studies/s01/en/draft.html", "not registered")
        fixed = {studies.DIRECTORY / path for path in self.fixed}
        thumbnail = studies.DIRECTORY / "assets/thumbnail.webp"
        screenshots = {file for file in fixed if file.parent.name == "screenshots"}
        self.assertEqual(
            studies.runtime_resources(self.repo, studies.DIRECTORY, thumbnail, screenshots),
            fixed | {studies.DIRECTORY / path for path in self.entries},
        )

    def test_manifest_requires_complete_matrix_and_unique_paths(self):
        for entries, message in (
            ({"resources": self.entries}, "must be an array"),
            (self.entries[1:], "complete study matrices"),
            ([entry for entry in self.entries if entry != self.previews[0]], "one shared WebP preview"),
            (self.entries + ["shared/unrelated.webp"], "one shared WebP preview"),
            (self.entries + [self.entries[0]], "Duplicate"),
            (self.pages, "shared static assets"),
        ):
            with self.subTest(message=message):
                self.manifest(entries)
                with self.assertRaisesRegex(ValueError, message):
                    studies.manifest_assets(self.repo)

    def test_manifest_requires_canonical_public_routes(self):
        for extra in ("./shared/study.js", "shared//study.js", "shared/archive/study.js",
                      "shared/study.json", "studies/s01/zh/index.html", "studies/s01/en/archive.html", 19):
            with self.subTest(extra=extra):
                self.manifest(self.entries + [extra])
                with self.assertRaisesRegex(ValueError, "Invalid Pomelo publication path"):
                    studies.manifest_assets(self.repo)

    def test_listed_resources_must_exist_and_use_real_directories(self):
        asset = self.hub / "shared/study.js"
        asset.unlink()
        with self.assertRaisesRegex(ValueError, "Missing Pomelo publication file"):
            studies.manifest_assets(self.repo)
        real = self.hub / "shared/theme.css"
        asset.symlink_to(real)
        with self.assertRaisesRegex(ValueError, "rejects symbolic links"):
            studies.manifest_assets(self.repo)
        asset.unlink()
        self.write("shared/study.js", "fixture\n")
        directory = self.hub / "studies/s01/en"
        renamed = directory.with_name("english")
        directory.rename(renamed)
        directory.symlink_to(renamed, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "rejects symbolic links"):
            studies.manifest_assets(self.repo)
