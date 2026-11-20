"""Capture five matching Low-tier arrival views in headed phone Chrome."""
import argparse
import json
import math
from pathlib import Path

from mall_browser_probe import URL, enter, launch
from verify_mall_support import probe_url

EVIDENCE = Path(__file__).parent / "evidence/gjh-v11-upper-layout"
# Walk via the perimeter. The last pair is the camera yaw and pitch in radians.
VIEWS = [
    ("landing", [], [1.571, .12]),
    ("west-aisle", [[-8.12, 10], [-8.12, 12.9]], [-2.5, .18]),
    ("brand-gallery", [[-8.12, 14.4], [-3, 14.4]], [3.142, .08]),
    ("east-rail", [[1.58, 14.4], [1.58, 10]], [-1.571, .16]),
    ("lounge", [[1.58, 7.6]], [1.1, .2]),
]
POSE = """async ([stops, angles]) => {
  for (const [x,z] of stops) {
    const s = await __mall.testWalkTo(x,z,{speed:2.5});
    if (Math.hypot(s.x-x,s.z-z)>.081) throw Error('Blocked at '+[x,z]);
  }
  __mall.setInput({yaw:angles[0],pitch:angles[1]});
  const {x,y,z,camera,drawCalls,renderTriangles:triangles,zone} = __mall.step(300);
  if (zone!=='upper' || Math.abs(y-7.2)>.08) throw Error('Off deck');
  return {x,y,z,camera,drawCalls,triangles};
}"""


def main():
    from io import BytesIO
    from PIL import Image
    from playwright.sync_api import sync_playwright
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=URL)
    parser.add_argument("--out", type=Path, default=EVIDENCE)
    parser.add_argument("stage", choices=("before", "after"))
    args = parser.parse_args()
    folder = args.out / args.stage
    folder.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p, launch(p) as browser:
        context = browser.new_context(viewport={"width":390, "height":844},
                                      device_scale_factor=3, has_touch=True, is_mobile=True,
                                      service_workers="block")
        page = enter(context, probe_url(args.url), "low")
        page.evaluate("() => __mall.testWalkTo(-6.4,10,{speed:2.5})")
        page.locator("#inspect").tap()
        page.wait_for_function("__mall.state.zone==='upper' && !__mall.state.elevatorTravel && __mall.testUpperPoints().length===20")
        rows = {}
        for name, stops, angles in VIEWS:
            rows[name] = page.evaluate(POSE, [stops, angles])
            Image.open(BytesIO(page.screenshot())).save(folder / (name + ".webp"), quality=86)
        (folder / "poses.json").write_text(json.dumps(rows, indent=2) + "\n")
        if args.stage == "after":
            before = json.loads((args.out / "before/poses.json").read_text())
            for name, row in rows.items():
                baseline = before[name]
                # Each walk terminates within 0.08 m of the shared target.
                if math.hypot(row["x"] - baseline["x"], row["z"] - baseline["z"]) > .162:
                    raise AssertionError(f"{name}: viewpoints do not match")
                if row["drawCalls"] > 70 or row["triangles"] > baseline["triangles"] + 1000:
                    raise AssertionError(f"{name}: render budget exceeded: {row}")


if __name__ == "__main__":
    main()
