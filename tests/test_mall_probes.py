"""Offline fixtures for the GJH browser probes. Requires Pillow and NumPy."""
import io
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'docs'))
from browser_lighting import metrics, compare
from mall_character_probe import crop_boxes
from mall_lap_probe import apply_budget, cadence, stats
from mall_video_probe import analyse, regions, write_artifacts


class ProbeTests(unittest.TestCase):
    def test_cadence_and_budget_boundaries(self):
        self.assertEqual(stats([]), {'frames': 0})
        self.assertEqual(stats([16]*19 + [50])['slow50'], 1)
        self.assertEqual(cadence('desktop', 144), (60, 20, 57))
        self.assertEqual(cadence('tablet', 50), (50, 24, 47.5))
        row = dict(stats([1000/30]*100), deviceClass='phone', tier='low', referenceHz=120,
                   targetFps=30, budgetSamples=100, triangles=220000, drawCalls=70)
        self.assertTrue(apply_budget(row, 'phone', 'low', 220000, 70)['pass'])
        for field, value in [('targetFps', 60), ('triangles', 220001), ('drawCalls', 71),
                             ('fps', 28.9), ('p95', 36.1), ('frames', 0)]:
            self.assertFalse(apply_budget(dict(row, **{field:value}), 'phone', 'low', 220000, 70)['pass'])

    def test_diagonal_clusters_border_and_area(self):
        hot = np.array([[1, 0, 0, 1], [0, 1, 0, 0]], dtype=bool)
        self.assertEqual(regions(hot), [
            dict(label='R001', area=2, box=[0, 0, 2, 2]), dict(label='R002', area=1, box=[3, 0, 4, 1])])
        self.assertEqual(regions(~np.ones((2, 2), dtype=bool)), [])

    def test_blink_crop_and_presentation_intervals(self):
        frames = []
        for i in range(5):
            image = Image.new('RGB', (8, 4))
            if i % 2:
                image.putpixel((6, 2), (255, 255, 255))
            buf = io.BytesIO()
            image.save(buf, 'PNG')
            frames.append((i / 30, buf.getvalue()))
        row, hot = analyse(frames, width=8)
        self.assertEqual(row['fps'], 30)
        self.assertEqual(row['regions'][0]['area'], 1)
        with tempfile.TemporaryDirectory() as tmp:
            write_artifacts(tmp, frames, hot, row['regions'])
            with Image.open(Path(tmp) / 'R001.png') as crop:
                self.assertEqual(crop.size, (1, 1))
        with self.assertRaises(ValueError):
            analyse(frames[:2])

    def test_lighting_statistics_and_gates(self):
        image = Image.new('RGB', (2, 1))
        image.putpixel((1, 0), (200, 100, 50))
        row = metrics(image)
        self.assertEqual(row['redBlue'], 4)
        self.assertEqual(row['mean'], row['stddev'])
        ref = {'pose': row}
        self.assertFalse(compare(ref, ref))
        for metric in row:
            self.assertTrue(compare(ref, {'pose': dict(row, **{metric: row[metric]*.8})}))
        self.assertTrue(compare(ref, {}))
        with self.assertRaises(ValueError):
            metrics(Image.new('RGB', (8, 8)))

    def test_portrait_native_crops(self):
        pose = dict(head=(.5, .4), leftHand=(.7, .5), rightHand=(.3, .5), torso=.2)
        boxes = crop_boxes(pose, 393, 700)
        self.assertEqual(len(boxes), 4)
        self.assertLess(boxes['hair'][1], boxes['face'][1])
        with self.assertRaises(ValueError):
            crop_boxes(dict(pose, head=(0, 0)), 393, 700)
