import contextlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from scripts import build_gjh_skylight_dapple as dapple
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
        self.assertEqual(score.outside_limits((.34, .20, .12, .85, 1.70, .38, .18)), [])
        self.assertEqual(score.outside_limits((.51, .19, .13, .86, 1.44, .33, .33)), list(score.METRICS))
        self.assertEqual(score.outside_limits((.42, .21, .10, .79, 1.57, .451, .26)), ['sat'])
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

    def test_skylight_projection_has_soft_warm_panes_and_tree_shadows(self):
        with Image.open(dapple.OUTPUT) as image:
            self.assertEqual(image.tobytes(), dapple.build().tobytes())
            alpha = image.getchannel('A')
            self.assertEqual(alpha.getextrema(), (0, dapple.MAX_ALPHA))
            gutter = 18
            for box in ((0, 0, image.width, gutter),
                        (0, image.height - gutter, image.width, image.height),
                        (0, 0, gutter, image.height),
                        (image.width - gutter, 0, image.width, image.height)):
                self.assertIsNone(alpha.crop(box).getbbox())
            pixels = getattr(image, 'get_flattened_data', image.getdata)()
            visible = {(r, g, b) for r, g, b, a in pixels if a >= 24}
            self.assertEqual(visible, {dapple.SUN})
            # At the atlas midpoint there is bright sun on both sides of a mullion.
            row = image.height // 2
            mullion = image.width // 2
            self.assertLessEqual(alpha.getpixel((mullion,row)), 6)
            self.assertGreater(alpha.getpixel((mullion-18,row)), 10)
            self.assertGreater(alpha.getpixel((mullion+18,row)), 10)
