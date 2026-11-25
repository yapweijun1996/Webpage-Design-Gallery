"""Contract tests for metadata, safe paths and deterministic gallery generation."""

import copy
import hashlib
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build_gallery", ROOT / "scripts/build_gallery.py")
gallery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gallery)


ZOOMABLE_VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover"

class GalleryTests(unittest.TestCase):
    def test_real_companies_contain_their_own_versions(self):
        catalog = gallery.load_catalog()
        versions = [d["version"] for d in catalog["designs"] if d["companyId"] == "gjh"]
        self.assertEqual(versions, ["v1", *(f"v{number}" for number in range(5, 12)),
                                    "mini-street", *(f"v{number}" for number in range(12, 30))])
        self.assertEqual({c["id"] for c in catalog["companies"]}, {"gjh", "yeos", "thow-kwang", "pomelo-stem"})
        for company in catalog["companies"]:
            designs = [d for d in catalog["designs"] if d["companyId"] == company["id"]]
            if company["id"] == "pomelo-stem":
                self.assertEqual([(d["id"], d["demoPath"]) for d in designs], [
                    ("pomelo-stem-v3", "demos/corporate/pomelo-stem/v3/index.html"),
                    ("pomelo-stem-v4", "demos/corporate/pomelo-stem/v4/index.html"),
                    ("pomelo-stem-v2", "demos/corporate/pomelo-stem/v2/index.html"),
                    ("pomelo-stem-v5", "demos/corporate/pomelo-stem/v5/index.html"),
                    ("pomelo-stem-v6", "demos/corporate/pomelo-stem/v6/index.html"),
                    ("pomelo-stem-v1", "demos/corporate/pomelo-stem/v1/index.html")
                ])
            else:
                self.assertGreaterEqual(len({d["demoPath"] for d in designs}), 15)
            self.assertEqual(len({d["title"] for d in designs}), len(designs))

    def test_v8_metadata_exposes_immersive_concept_contract(self):
        catalog = gallery.load_catalog()
        design = next(item for item in catalog["designs"] if item["id"] == "gjh-v8")
        self.assertEqual(design["id"], "gjh-v8")
        self.assertEqual(design["companyId"], "gjh")
        self.assertIn("heritage", design["styles"])
        self.assertIn("editorial", design["styles"])
        self.assertEqual(design["devices"], ["desktop", "tablet", "mobile"])
        self.assertTrue(design["demoPath"].endswith("demos/corporate/gjh/v8/index.html"))

    def test_home_only_links_to_company_collections(self):
        page = gallery.build_pages(gallery.load_catalog())["index.html"]
        self.assertIn('href="companies/gjh/index.html"', page)
        self.assertIn('href="companies/yeos/index.html"', page)
        self.assertNotIn('class="design-card"', page)
        self.assertNotIn('href="demos/', page)

    def test_directory_order_matches_inventory_and_company_route_title(self):
        catalog = gallery.load_catalog()
        pages = gallery.build_pages(catalog)
        self.assertIn("All companies.", pages["companies/index.html"])
        page = pages["index.html"]
        self.assertIn("All companies.", page)
        self.assertLess(page.index('id="company-search"'), page.index('class="company-grid"'))
        self.assertLess(page.index('class="company-cover"'), page.index('class="company-card-copy"'))
        self.assertEqual(page.count('id="company-search"'), 1)

        catalog["companies"] = [c for c in catalog["companies"] if c["id"] == "gjh"]
        catalog["designs"] = [d for d in catalog["designs"] if d["companyId"] == "gjh"]
        page = gallery.build_pages(catalog)["index.html"]
        self.assertIn("One company.", page)
        self.assertLess(page.index('class="company-grid"'), page.index('id="company-search"'))
        self.assertEqual(page.count('id="company-search"'), 1)

    def test_single_design_collection_links_to_demo_without_comparison_controls(self):
        catalog = gallery.load_catalog()
        catalog["designs"] = [d for d in catalog["designs"] if d["companyId"] != "yeos" or d["version"] == "v1"]
        pages = gallery.build_pages(catalog)
        page = pages["companies/yeos/index.html"]
        self.assertIn('href="../../demos/food-beverage/yeos/v1/index.html"', page)
        self.assertIn('company=yeos&amp;design=v1', page)
        self.assertNotIn('id="style-filter"', page)
        self.assertNotIn('class="compare-checkbox"', page)
        self.assertNotIn('class="compare-tray"', page)
        self.assertIn('class="compare-checkbox"', pages["companies/gjh/index.html"])

    def test_collection_actions_resolve_to_published_designs_and_sections(self):
        catalog = gallery.load_catalog()
        pages = gallery.build_pages(catalog)
        for company in catalog["companies"]:
            with self.subTest(company=company["id"]):
                page = pages[f"companies/{company['slug']}/index.html"]
                landing = company["landing"]
                directory = company["demoDirectory"]
                primary = directory + "/" + company["featuredVersion"] + "/index.html"
                anchor = landing["anchor"]
                if anchor:
                    self.assertRegex((ROOT / primary).read_text(), rf'id=["\']{re.escape(anchor)}["\']')
                self.assertIn('href="../../' + primary + ("#" + anchor if anchor else "") + '"', page)
                self.assertIn(f'href="../../{directory}/{landing["alternativeVersion"]}/index.html"', page)
                self.assertIn(f'src="../../{directory}/{landing["image"]}"', page)

    def test_pomelo_landing_links_to_one_hub_and_its_five_categories(self):
        pages = gallery.build_pages(gallery.load_catalog())
        page = pages["companies/pomelo-stem/index.html"]
        route = "demos/corporate/pomelo-stem/v1/index.html"
        self.assertIn(f'class="primary-link" href="../../{route}#category-1"', page)
        self.assertIn(f'class="collection-alternative" href="../../{route}"', page)
        self.assertIn('href="../../demos/corporate/pomelo-stem/v2/index.html"', page)
        self.assertIn('Pomelo STEM Systems Blueprint', page)
        self.assertIn('href="../../demos/corporate/pomelo-stem/v3/index.html"', page)
        self.assertIn('Pomelo STEM Order Journey', page)
        v1_only = gallery.load_catalog()
        v1_only["designs"] = [d for d in v1_only["designs"]
                              if d["companyId"] != "pomelo-stem" or d["id"] == "pomelo-stem-v1"]
        self.assertNotIn('class="compare-checkbox"', gallery.build_pages(v1_only)["companies/pomelo-stem/index.html"])
        hub = (ROOT / route).read_text(encoding="utf-8")
        for category in range(1, 6):
            with self.subTest(category=category):
                self.assertEqual(hub.count(f'id="category-{category}"'), 1)
                self.assertIn(f'href="#category-{category}"', hub)

    def test_generation_is_deterministic(self):
        catalog = gallery.load_catalog()
        self.assertEqual(gallery.build_pages(catalog), gallery.build_pages(copy.deepcopy(catalog)))

    def test_v11_verified_optional_assets_are_published_and_cached_on_demand(self):
        catalog = gallery.load_catalog()
        scope = Path("demos/corporate/gjh/v11")
        folder = Path("assets/chibi-crowd")
        manifest = gallery.read_json(ROOT / scope / folder / "manifest.json")
        entries = (*manifest["modules"], *manifest["animation"].values())
        published = set(gallery.runtime_resources(catalog))
        workers = gallery.pwa_outputs({}, catalog, {"build": "test", "version": "1.0.0"})
        worker = workers[(scope / "pwa-sw.js").as_posix()]
        cache = json.loads(re.search(r"const LAZY_ASSETS = (\[.*?\]);", worker, re.S)[1])
        precache = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", worker, re.S)[1])
        expected = {folder / "manifest.json", *(folder / entry["file"] for entry in entries
                                                if entry["status"] == "verified")}
        expected.update(folder / entry["compact"]["file"] for entry in entries if "compact" in entry)
        piano = Path("assets/audio/piano")
        expected.update(piano / f"{note}{octave}.mp3"
                        for octave in (3, 4, 5) for note in ("C", "Ds", "Fs", "A"))
        self.assertIn(scope / piano / "LICENSE.txt", published)
        self.assertNotIn("assets/audio/piano/", workers["sw.js"])
        street = Path("assets/districts/singapore")
        expected.update(street / file for file in ("sources.json", "hdb-block.glb", "hdb-void-deck.glb",
                                                    "shophouse.glb", "road-segment.glb", "angsana-tree.glb"))
        court = Path("assets/districts/food-court")
        expected.update(court / file for file in ("sources.json", "hawker-stall.glb", "chicken-rice-stall.glb",
                                                   "restaurant-table-chair-set.glb", "kopitiam-kettle.glb"))
        malaysia = Path("assets/districts/malaysia")
        expected.update(malaysia / name for name in ("sources.json", "kampung-house.glb", "terrace-house.glb"))
        expected.update(Path("assets") / name for name in ("kampung-lane.js", "district-assets.js", "merge-static-geometries.js"))
        expected.add(Path("assets/interiors/showroom-atlas.png"))
        for area in ("assets/interiors", "assets/gallery-assets"):
            expected.update(path.relative_to(ROOT / scope) for path in (ROOT / scope / area).glob("*.glb"))
        expected.update(Path("assets") / (name + ".glb") for name in
                        ("pharmacy-counter", "speaker-soundbar", "tv-demo-table", "tv-floor-stand",
                         "electronic-keyboard", "battery-display-rack", "cordless-phone-display"))
        self.assertNotIn("assets/districts/", workers["sw.js"])
        self.assertEqual({Path(entry["path"]) for entry in cache}, expected)
        self.assertTrue({scope / path for path in expected} <= published)
        self.assertTrue(expected.isdisjoint(Path(entry["path"]) for entry in precache))
        self.assertNotIn("assets/chibi-crowd/", workers["sw.js"])
        for entry in cache:
            asset = ROOT / scope / entry["path"]
            self.assertEqual(entry["sha256"], hashlib.sha256(gallery.source_bytes(asset)).hexdigest())

    def test_paths_cannot_escape_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for value in ("../secret", "/absolute", "https://example.com/a", "a\\b"):
                with self.subTest(value=value), self.assertRaises(ValueError):
                    gallery.local_path(root, value)

    def test_missing_assets_stop_build(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "Missing resource"):
                gallery.local_path(Path(directory), "missing.webp")

    def test_duplicate_stable_ids_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            gallery.unique([{"id": "same"}, {"id": "same"}], "company")

    def test_metadata_text_is_escaped(self):
        catalog = copy.deepcopy(gallery.load_catalog())
        catalog["companies"][0]["name"] = '<script>alert("test")</script>'
        page = gallery.build_pages(catalog)["index.html"]
        self.assertNotIn('<script>alert("test")</script>', page)
        self.assertIn("&lt;script&gt;", page)

    def test_pages_allow_zoom_and_maskable_icon_is_separate(self):
        pages = gallery.build_pages(gallery.load_catalog())
        pages["v11-source.html"] = (ROOT / "demos/corporate/gjh/v11/index.html").read_text(encoding="utf-8")
        for name, page in pages.items():
            if name.endswith(".html"):
                viewport = re.search(r'<meta name="viewport" content="([^"]+)">', page)
                self.assertIsNotNone(viewport, name)
                content = viewport.group(1).lower()
                self.assertEqual(content, ZOOMABLE_VIEWPORT, name)
                self.assertNotIn("user-scalable=no", content, name)
                self.assertNotIn("maximum-scale", content, name)

        manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
        icons = manifest["icons"]
        self.assertIn({"src": "assets/icons/gallery-maskable-512.png", "sizes": "512x512",
                       "type": "image/png", "purpose": "maskable"}, icons)
        self.assertFalse(any("any maskable" in icon["purpose"] for icon in icons))
        self.assertEqual(sum(icon["purpose"] == "maskable" for icon in icons), 1)

    def test_published_shared_resources_and_precache_boundary(self):
        catalog = gallery.load_catalog()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            gallery.build(output)
            pomelo = Path("demos/corporate/pomelo-stem/v1")
            published = gallery.pomelo_studies.manifest_assets(gallery.ROOT, pomelo)
            actual = {file.relative_to(output) for folder in ("studies", "shared")
                      for file in (output / pomelo / folder).rglob("*") if file.is_file()}
            self.assertEqual(actual, published)
            self.assertEqual(len([file for file in actual if file.suffix == ".html"]), 240)
            for file in sorted(actual):
                self.assertEqual((output / file).read_bytes(), gallery.source_bytes(gallery.ROOT / file))
            self.assertFalse((output / pomelo / "study-assets.json").exists())
            worker = (output / pomelo / "sw.js").read_text(encoding="utf-8")
            self.assertNotIn('"studies/', worker)
            self.assertIn('"shared/study-tokens.css"', worker)
            for path in actual:
                if path.suffix == ".webp":
                    self.assertNotIn(f'"shared/{path.name}"', worker)
            self.assertNotIn("pomelo-stem/v1/studies/", (output / "sw.js").read_text(encoding="utf-8"))
            blueprint = gallery.pomelo_blueprint
            expected_blueprint = blueprint.HTML | blueprint.ASSETS | {blueprint.THUMBNAIL} | blueprint.SCREENSHOTS
            scope = output / blueprint.DIRECTORY
            self.assertEqual({file.relative_to(scope) for file in scope.rglob("*") if file.is_file()}, expected_blueprint)
            self.assertEqual(len(blueprint.HTML), 36)
            for path in blueprint.HTML:
                source = (scope / path).read_text(encoding="utf-8")
                self.assertIn('content="noindex,nofollow"', source, path)
                self.assertNotIn("serviceWorker", source, path)
                self.assertNotRegex(source, r'https?://(?:wa\.me|api\.whatsapp\.com)', path)
                self.assertNotRegex(source, r'<(?:img|script|link|iframe)\b[^>]*(?:src|href)="https?://', path)
                for href in re.findall(r'(?:href|src)="(\.{1,2}/[^"#]+)', source):
                    target = (scope / path.parent / href).resolve()
                    self.assertTrue(target.is_relative_to(scope.resolve()) and target.is_file(), (path, href))
            gallery_sw = (output / "sw.js").read_text(encoding="utf-8")
            self.assertEqual(set(re.findall(r'"path": "(demos/corporate/pomelo-stem/v2/[^"]+)"', gallery_sw)),
                             {(blueprint.DIRECTORY / blueprint.THUMBNAIL).as_posix()})
            journey = gallery.pomelo_order_journey
            scope = output / journey.DIRECTORY
            expected = journey.HTML | journey.ASSETS | {journey.THUMBNAIL} | journey.SCREENSHOTS
            self.assertEqual(len(journey.HTML), 12)
            self.assertEqual({file.relative_to(scope) for file in scope.rglob("*") if file.is_file()}, expected)
            for path in journey.HTML:
                source = (scope / path).read_text(encoding="utf-8")
                self.assertIn('content="noindex,nofollow"', source, path)
                self.assertNotIn("serviceWorker", source, path)
                self.assertNotRegex(source, r'https?://(?:wa\.me|api\.whatsapp\.com)', path)
                self.assertNotRegex(source, r'<(?:img|script|link|iframe)\b[^>]*(?:src|href)="https?://', path)
                for href in re.findall(r'(?:href|src)="(\.{1,2}/[^"#]+)', source):
                    target = (scope / path.parent / href).resolve()
                    self.assertTrue(target.is_relative_to(scope.resolve()) and target.is_file(), (path, href))
            for locale, status in (("", "Packed, awaiting pickup"), ("zh", "已打包，待自取"),
                                   ("ms", "Sudah dibungkus, sedia untuk diambil")):
                story = (scope / locale / "story.html").read_text(encoding="utf-8")
                self.assertIn("PS-0124", story)
                self.assertIn(status, story)
            self.assertEqual(set(re.findall(r'"path": "(demos/corporate/pomelo-stem/v3/[^"]+)"', gallery_sw)),
                             {(journey.DIRECTORY / journey.THUMBNAIL).as_posix()})
            # V4 reuses V3's published brand and story assets, while keeping its own routes.
            refined = output / "demos/corporate/pomelo-stem/v4"
            for locale in ("", "zh", "ms"):
                for page in ("index", "story", "services", "contact"):
                    route = refined / locale / (page + ".html")
                    source = route.read_text(encoding="utf-8")
                    self.assertIn('content="noindex,nofollow"', source)
                    self.assertNotIn("serviceWorker", source)
                    for href in re.findall(r'(?:href|src)="(\.{1,2}/[^"#]+)', source):
                        target = (route.parent / href).resolve()
                        self.assertTrue(target.is_relative_to(output.resolve()) and target.is_file(), (route, href))
            self.assertFalse((refined / "sw.js").exists())
            showcase = output / "demos/corporate/pomelo-stem/v5"
            for locale in ("", "zh", "ms"):
                for page in ("index", "showcase", "story", "services", "contact"):
                    route = showcase / locale / (page + ".html")
                    source = route.read_text(encoding="utf-8")
                    self.assertIn('content="noindex,nofollow"', source)
                    for href in re.findall(r'(?:href|src)="(\.{1,2}/[^"#]+)', source):
                        target = (route.parent / href).resolve()
                        self.assertTrue(target.is_relative_to(output.resolve()) and target.is_file(), (route, href))
            self.assertFalse((showcase / "sw.js").exists())
            v6 = output / "demos/corporate/pomelo-stem/v6"
            for locale in ("", "zh", "ms"):
                for name in gallery.pomelo_v6.PAGES:
                    route = v6 / locale / (name + ".html")
                    source = route.read_text(encoding="utf-8")
                    self.assertIn('content="noindex,nofollow"', source)
                    for href in re.findall(r'(?:href|src)="(\.{1,2}/[^"#]+)', source):
                        target = (route.parent / urlsplit(href).path).resolve()
                        self.assertTrue(target.is_relative_to(output.resolve()) and target.is_file(), (route, href))
                    self.assertIn(f'content="{gallery.pomelo_v6.VERSION}"', source)
                    self.assertEqual(source.count('integrity="sha256-'), 5)
            self.assertEqual(json.loads((v6 / "release.json").read_text())["version"], gallery.pomelo_v6.VERSION)
            self.assertFalse((v6 / "sw.js").exists())
            gallery_models = Path("demos/corporate/gjh/v11/assets/gallery-assets")
            for source in (gallery.ROOT / gallery_models).glob("*.glb"):
                self.assertEqual((output / gallery_models / source.name).read_bytes(), source.read_bytes())
            for name in ("assets/tokens.css", "assets/icons.svg", "assets/icons/gallery-maskable-512.png",
                         "assets/onboarding/action-dialog.js", "assets/onboarding/onboarding.css",
                         "design-system/onboarding/index.html",
                         "demos/corporate/gjh/shared/interaction.css",
                         "demos/corporate/gjh/shared/navigation.js",
                         "demos/corporate/gjh/v11/style.bundle.css",
                         "demos/corporate/gjh/v11/script.bundle.js",
                         "demos/corporate/gjh/v11/assets/world.bundle.js",
                         "demos/corporate/gjh/v11/assets/player.bundle.js",
                         "demos/corporate/gjh/v11/assets/character-v2.bundle.js",
                         "demos/corporate/gjh/v11/assets/startup-asset-pack.js",
                         "demos/corporate/gjh/v11/assets/startup-assets.pack",
                         "demos/corporate/gjh/v11/vendor/rapier_bg.wasm"):
                self.assertEqual((output / name).read_bytes(), (ROOT / name).read_bytes())
            self.assertFalse((output / "design-system/tokens.json").exists())
            self.assertFalse((output / "demos/corporate/gjh/research").exists())
            mini_street = next(design for design in catalog["designs"] if design["id"] == "gjh-mini-street")
            self.assertEqual(mini_street["status"], "concept")
            street = Path("demos/corporate/gjh/mini-street")
            street_files = {Path(name) for name in (
                "index.html", "style.css", "script.js", "scene.js", "world.js", "surfaces.js", "vending.js",
                "vending-viewer.js", "vending-model.js", "vending-audio.js", "vending-sequence.js",
                "shop-experience.js", "shop-experience.css", "shop-interior.js", "shop-interior-world.js", "shop-interior.css",
                "product-hand.js", "shop-product-catalog.js", "shop-product-ui.js", "shop-product-ui.css", "basket.js", "basket.css",
                "assets/posable-right-hand.glb", "assets/posable-right-hand.LICENSE.md",
                "assets/theme.css", "assets/thumbnail.webp", "assets/mini-street-anchor.webp",
                "assets/new-moon-label-atlas.webp", "assets/update.js", "release.json",
                "screenshots/1440.png", "screenshots/768.png", "screenshots/390.png",
            )}
            street_files.update(file.relative_to(ROOT / street) for file in (ROOT / street).iterdir()
                                if file.is_file() and file.suffix in (".js", ".css"))
            self.assertEqual({file.relative_to(output / street) for file in (output / street).rglob("*")
                              if file.is_file()}, street_files)
            v11 = street.parent / "v11"
            street_dependencies = {Path(name) for name in (
                "vendor/three.module.min.js", "vendor/three.LICENSE",
                "vendor/GLTFLoader.js", "vendor/BufferGeometryUtils.js",
                "assets/new-moon-can-au-425g-lod1.glb", "assets/new-moon-can-nz-425g-lod1.glb",
                "assets/new-moon-can-sa-425g-lod1.glb", "assets/new-moon-can-mx-454g-lod1.glb",
                "assets/new-moon-nz-425g-front.webp", "assets/new-moon-au-425g-front.webp",
                "assets/new-moon-sa-425g-front.webp", "assets/new-moon-mx-454g-front.webp",
            )}
            entry = Path("index.html")
            manifest = Path("release.json")
            app_version = json.loads((output / "version.json").read_text())["version"]
            street_page, street_release = gallery.build_mini_street(catalog, app_version)
            self.assertEqual((output / street / entry).read_text(), street_page)
            self.assertEqual((output / street / manifest).read_text(), street_release)
            toast = gallery.MINI_STREET_TOAST
            self.assertEqual((output / toast).read_bytes(), gallery.source_bytes(ROOT / toast))
            build_id = json.loads(street_release)["build"]
            toast_url = "../../../../" + toast.as_posix() + "?build=" + build_id
            self.assertIn(f'href="{toast_url}" integrity="sha256-', street_page)
            files = {street / file for file in street_files - {entry, manifest}}
            for name in files | {v11 / file for file in street_dependencies}:
                self.assertEqual((output / name).read_bytes(), gallery.source_bytes(ROOT / name), name)
            worker = (output / "sw.js").read_text()
            entries = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", worker, re.S).group(1))
            cached = {entry["path"] for entry in entries}
            self.assertIn("assets/tokens.css", cached)
            self.assertIn("assets/icons/gallery-maskable-512.png", cached)
            self.assertNotIn("assets/onboarding/action-dialog.js", cached)
            self.assertNotIn("design-system/onboarding/index.html", cached)
            self.assertNotIn("demos/corporate/gjh/shared/navigation.js", cached)
            self.assertNotIn("demos/corporate/gjh/v11/vendor/rapier.mjs", cached)
            self.assertEqual({name for name in cached if name.startswith(street.as_posix() + "/")},
                             {mini_street["thumbnail"]})
            self.assertTrue(cached.isdisjoint((v11 / file).as_posix() for file in street_dependencies))
            self.assertTrue(all(design["thumbnail"] in cached for design in catalog["designs"]))
            for company in catalog["companies"]:
                artwork = company["demoDirectory"] + "/" + company["landing"]["image"]
                self.assertIn(artwork, cached)
                self.assertTrue((output / artwork).is_file())
            mall = output / "demos/corporate/gjh/v11"
            for kit in ("signage", "interiors", "tram"):
                for source in (ROOT / "demos/corporate/gjh/v11/assets" / kit).rglob("*"):
                    if source.is_file():
                        name = source.relative_to(ROOT)
                        self.assertEqual((output / name).read_bytes(), source.read_bytes(), name)
                        self.assertNotIn(name.as_posix(), cached)
            startup_models = json.loads((ROOT / "data/gjh-startup-assets.json").read_text())
            self.assertFalse(any(name.startswith(("signage/", "interiors/", "tram/")) for name in startup_models))
            mall_worker = (mall / "pwa-sw.js").read_text()
            mall_entries = json.loads(re.search(r"const PRECACHE = (\[.*?\]);", mall_worker, re.S).group(1))
            self.assertEqual({entry["path"] for entry in mall_entries}, {
                "offline.html", "manifest.webmanifest", "assets/mall-icon-192.png", "assets/mall-icon-512.png",
                "style.bundle.css", "assets/loader.js", "assets/gjh-loader-mark.svg",
                "assets/signage/tokens.js", "assets/signage/models/manifest.json",
                "assets/signage/models/presets.json", "assets/signage/models/preset-icons.svg"})
            self.assertLessEqual(sum((mall / entry["path"]).stat().st_size for entry in mall_entries), 256 * 1024)
            for entry in mall_entries:
                self.assertEqual(hashlib.sha256((mall / entry["path"]).read_bytes()).hexdigest(), entry["sha256"])
            self.assertTrue((mall / "pwa.js").is_file())


    def test_nested_pages_use_prefix_safe_sprite_and_company_identity(self):
        pages = gallery.build_pages(gallery.load_catalog())
        self.assertIn('href="../assets/icons.svg#arrow-down"', pages["companies/index.html"])
        company = pages["companies/gjh/index.html"]
        self.assertIn('data-company="gjh"', company)
        self.assertIn('href="../../assets/icons.svg#arrow-right"', company)
        self.assertNotIn("<path ", company)
        with self.assertRaisesRegex(ValueError, "Unknown Gallery icon"):
            gallery.icon("unapproved")


if __name__ == "__main__":
    unittest.main()
