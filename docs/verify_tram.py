"""Ride the south-entrance tram, verify caption order, controls and frame time."""
import json
import math

from verify_mall_support import capture, face, options, press, require, run, walk

ORDER = (
    "Hormel", "California Mexico", "SPAM", "Skippy", "Gu Long", "Flying Wheel",
    "New Moon", "MILI", "GOGO", "Borsch Med", "Pien Tze Huang", "Zeria", "Sony",
    "LG", "Casio", "GP", "Gigaset",
)
STATION = (10, 39)
HUD = "#tram-ride-hud"

# Measure the complete unaccelerated lap in one browser task chain. Screenshots
# and Playwright control clicks run during the second ride, outside this sample.
TIMED_LAP = """() => new Promise((resolve, reject) => {
  let last, lastDraw, frame = __mall.movementSample().frames;
  let first = null, lastCaption = null, distanceAtTenSeconds = null;
  const captions = [], rafGaps = [], drawGaps = [];
  let sawArrival = false;
  const started = performance.now();
  if (!__mall.testPress('ride')) return reject(Error('Ride action failed'));
  function sample(now) {
    const ride = __mall.testTramState();
    if (document.hidden || !document.hasFocus()) return reject(Error('Tram probe lost foreground focus'));
    if (now - started > 150000) return reject(Error('Tram timed out: ' + JSON.stringify(ride)));
    if (ride.seated) {
      first ??= now;
      if (last != null) rafGaps.push(now - last);
      last = now;
      const currentFrame = __mall.movementSample().frames;
      if (currentFrame !== frame) {
        if (lastDraw != null) drawGaps.push(now - lastDraw);
        lastDraw = now;
        frame = currentFrame;
        const title = document.querySelector('#tram-ride-hud:not([hidden]) strong')?.textContent;
        if (title?.endsWith(' · On your left') && title !== lastCaption) {
          const feature = document.querySelector('#tram-ride-hud p').textContent;
          captions.push({name:title.split(' · ')[0], feature, distance:ride.distance});
          lastCaption = title;
        }
      }
      if (distanceAtTenSeconds == null && now - first >= 10000) distanceAtTenSeconds = ride.distance;
      sawArrival ||= ride.phase === 'arrival';
    }
    if (!ride.active) resolve({captions, rafGaps, drawGaps, sawArrival, distanceAtTenSeconds});
    else requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
})"""


def check_lap(lap, concepts):
    names = tuple(card["name"] for card in lap["captions"])
    require(names == ORDER, f"Wrong caption sequence: {names}")
    for card in lap["captions"]:
        require(card["feature"] == concepts[card["name"]], f"Wrong caption copy: {card}")
    distances = [card["distance"] for card in lap["captions"]]
    require(all(a < b for a, b in zip(distances, distances[1:])), f"Invalid caption distances: {distances}")
    require(lap["sawArrival"] and 12 <= (lap["distanceAtTenSeconds"] or 0) <= 17,
            f"Ride did not advance at regular speed over 10 s: {lap['distanceAtTenSeconds']}")
    for key in ("rafGaps", "drawGaps"):
        gaps = lap[key]
        require(len(gaps) >= 200, f"Missing {key} samples")
        slow = [gap for gap in gaps if gap >= 50]
        require(not slow, f"{key}: {len(slow)} gaps ≥ 50 ms; worst {max(gaps):.2f} ms")


def check_exit(page):
    state = page.evaluate("""() => {
      const {x,z,seated,capsuleEnabled} = __mall.state;
      return {x,z,seated,capsuleEnabled};
    }""")
    require(not state["seated"] and state["capsuleEnabled"], f"Player did not regain walking: {state}")
    require(math.hypot(state["x"] - STATION[0], state["z"] - STATION[1]) < .15,
            f"Tram exited outside the south entrance station: {state}")
    require(not page.locator(HUD).is_visible(), "Ride HUD remained open after exit")


def verify_controls(page, args):
    require(page.evaluate("() => __mall.testSetTramSpeed(5)"), "Could not set control-probe ride speed")
    require(press(page, "ride"), "Could not board second ride")
    page.wait_for_function("() => __mall.testTramState().seated", timeout=15000)
    require(page.evaluate("() => __mall.camera.mode") == "third-person", "Expected a chase view of the tram")
    require(page.evaluate("() => __mall.testTramCarVisible()"), "The car is outside the chase view")
    capture(page, args.out, "tram-car")
    page.wait_for_function("() => __mall.testTramState().caption >= 0", timeout=15000)
    card = page.locator(HUD)
    card.get_by_role("button", name="Pause", exact=True).click()
    paused = page.evaluate("() => __mall.testTramState()")
    require(paused["paused"] and paused["caption"] >= 0, f"Pause did not retain a caption: {paused}")
    capture(page, args.out, "tram-caption")
    page.wait_for_timeout(300)
    require(page.evaluate("() => __mall.testTramState().distance") == paused["distance"], "Pause moved the tram")
    card.get_by_role("button", name="Skip shop", exact=True).click()
    skipped = page.evaluate("() => __mall.testTramState()")
    require(skipped["caption"] == -1 and skipped["distance"] == paused["distance"], "Skip did not hide only the current caption")
    card.get_by_role("button", name="Resume", exact=True).click()
    page.wait_for_function("d => __mall.testTramState().distance > d + 1", arg=paused["distance"])
    card.get_by_role("button", name="End", exact=True).click()
    ending = page.evaluate("() => __mall.testTramState()")
    require(ending["ending"] and ending["seated"] and ending["caption"] == -1, "End must return with passenger seated")
    page.wait_for_function("""() => {
      const ride = __mall.testTramState();
      return ride.phase === 'arrival' && Math.abs(ride.distance - __mall.testTramRouteLength()) < .001;
    }""", timeout=30000)
    require(page.evaluate("() => !__mall.state.capsuleEnabled"), "Passenger left before the station dwell")
    page.wait_for_function("() => __mall.testTramState().phase === 'idle'", timeout=10000)
    check_exit(page)


def verify(page, args):
    from verify_interactions import PROGRAMME

    concepts = {shop["brand"]: shop["concept"] for shop in
                json.loads(PROGRAMME.read_text(encoding="utf-8"))["stores"]}
    walk(page, *STATION)
    face(page, 10, 40.5)
    require(page.locator("#inspect").is_visible() and page.locator("#inspect-verb").inner_text() == "Ride the tram",
            "Station does not offer Ride the tram")
    page.wait_for_function("() => __mall.performanceReport().uploads.pendingUploads === 0")
    lap = page.evaluate(TIMED_LAP)
    (args.out / "tram-timing.json").write_text(json.dumps(lap, indent=2) + "\n", encoding="utf-8")
    check_exit(page)
    verify_controls(page, args)
    check_lap(lap, concepts)
    print(f'17 captions | worst rAF {max(lap["rafGaps"]):.2f} ms | worst draw gap {max(lap["drawGaps"]):.2f} ms')


if __name__ == "__main__":
    # Leave NPCs enabled by default. The track and landing rules remain live.
    run(options("verify-tram", __doc__).parse_args(), verify, tram="1")
