import contextlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from scripts import lighting_score as score


class LightingScoreTest(unittest.TestCase):
    def test_synthetic_pixels_and_crop(self):
        image = Image.new('RGB', (2, 1))
        image.putdata([(0, 0, 0), (255, 32, 128)])
        value = .2126 + (.7152 * 32 + .0722 * 128) / 255
        expected = (value / 2, value / 2, value * .05, value * .95, 255 / 128, 223 / 510, .5)
        with patch.object(score, 'np', None):
            fallback = score.measure(image)
        for values in (fallback, score.measure(image)):
            for actual, target in zip(values, expected):
                self.assertAlmostEqual(actual, target)
        self.assertAlmostEqual(score.measure(image, crop=(1, 0, 2, 1))[0], value)
        with self.assertRaises(ValueError):
            score.measure(image, crop=(-1, 0, 2, 1))

    def test_thresholds_and_folder_report(self):
        self.assertEqual(score.outside_limits(score.CONCEPT), [])
        self.assertEqual(score.outside_limits((.34, .20, .12, .85, 1.70, .34, .18)), [])
        self.assertEqual(score.outside_limits((.51, .19, .13, .86, 1.44, .33, .33)), list(score.METRICS))
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()) as out:
            Image.new('RGB', (4, 2), 'white').save(Path(directory) / 'white.png')
            (Path(directory) / 'metrics.json').write_text('{}')
            self.assertEqual(score.main([directory]), 0)
            self.assertEqual(score.main([directory, '--check']), 1)
            self.assertIn('white.png', out.getvalue())
            self.assertNotIn('metrics.json', out.getvalue())

    def test_browser_shop_crop_clips_to_visible_pixels(self):
        with patch.object(sys, 'path', sys.path + [str(Path(__file__).resolve().parent)]):
            from browser_lighting import shop_crop
        image = Image.new('RGB', (100, 80))
        self.assertEqual(shop_crop(image, (-.1, .25, .9, 1.1)).size, (90, 60))
        with self.assertRaises(ValueError):
            shop_crop(image, (1.1, .2, 1.4, .5))

    def test_repository_concept_scores_inside_targets(self):
        path = Path(__file__).resolve().parents[1] / 'docs/references/gjh-mall-modern-premium-concept.png'
        with Image.open(path) as image:
            self.assertEqual(score.outside_limits(score.measure(image)), [])
