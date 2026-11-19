"""Headed desktop Chrome early-entry walk. Serve the worktree on 127.0.0.1:8815."""
import argparse
import json
import os
import sys

from playwright.sync_api import sync_playwright


URL = "http://127.0.0.1:8815/demos/corporate/gjh/v11/"
ROUTE = [[16, 37], [16, 30], [29.3, 31], [29.3, 18], [29.3, 14.3],
         [29.3, 6], [16, 5], [-6, 5], [-11, 16], [-12, 30], [10, 42]]
TARGET = [29.3, 14.3]

OBSERVE = r"""() => {
  const probe = window.earlyProbe = {events:[], slow:[], frames:0, maxMs:0, rows:[], interrupted:false};
  const now = () => performance.now();
  window.addEventListener('load', () => { probe.loadAt = now(); }, {once:true});
  document.addEventListener('click', event => {
    if (event.target.id === 'loader-enter-now') probe.clickAt = now();
  }, true);

  const gl = WebGL2RenderingContext.prototype;
  const shaders = new WeakMap(), programs = new WeakMap(), used = new WeakSet();
  let programCount = 0, frame = 0;
  function wrap(name, describe) {
    const original = gl[name];
    gl[name] = function (...args) {
      const at = now(), result = original.apply(this, args), ms = now() - at;
      const payload = describe(args);
      if (payload) probe.events.push({at, ms, frame, call:name, ...payload});
      return result;
    };
  }
  wrap('shaderSource', ([shader, source]) => {
    shaders.set(shader, {
      name:/#define SHADER_NAME[ \t]+(\S+)/.exec(source)?.[1],
      type:/#define SHADER_TYPE[ \t]+(\S+)/.exec(source)?.[1],
      pointLights:/uniform PointLight pointLights\[\s*(\d+)\s*\]/.exec(source)?.[1]
    });
  });
  wrap('compileShader', ([shader]) => shaders.get(shader));
  wrap('attachShader', ([program, shader]) => {
    if (!programs.has(program)) programs.set(program, {id:++programCount, shaders:[]});
    programs.get(program).shaders.push(shaders.get(shader));
  });
  wrap('linkProgram', ([program]) => programs.get(program));
  wrap('useProgram', ([program]) => {
    if (!program || used.has(program)) return;
    used.add(program);
    return programs.get(program);
  });
  wrap('texStorage2D', ([, levels,, width,height]) => ({levels,width,height}));
  wrap('texImage2D', args => {
    const source = args.length <= 6 ? args[5] : args[8];
    return {level:args[1],width:args.length <= 6 ? source?.width : args[3],
      height:args.length <= 6 ? source?.height : args[4],source:source?.src || source?.constructor?.name};
  });
  wrap('texSubImage2D', args => {
    const source = args.length <= 7 ? args[6] : args[8];
    return {level:args[1],width:args.length <= 7 ? source?.width : args[4],
      height:args.length <= 7 ? source?.height : args[5],source:source?.src || source?.constructor?.name};
  });
  wrap('generateMipmap', () => ({}));
  wrap('bufferData', ([target,data]) => ({target,bytes:typeof data === 'number' ? data : data?.byteLength}));
  wrap('bufferSubData', ([target,offset,data,first,length]) => ({
    target,offset,bytes:length ? length*data.BYTES_PER_ELEMENT : data?.byteLength
  }));
  const waitForLink = gl.getProgramParameter;
  gl.getProgramParameter = function (program, parameter) {
    const at = now(), result = waitForLink.call(this, program, parameter), ms = now() - at;
    if (ms >= 2) probe.events.push({at, ms, frame, call:'getProgramParameter', parameter, ...programs.get(program)});
    return result;
  };

  let previous, lastReport = -Infinity;
  function sample(at) {
    frame++;
    const overlay = document.getElementById('app-loader');
    if (!probe.buttonAt && !document.getElementById('loader-enter-now')?.hidden && window.mallLoader)
      probe.buttonAt = now();
    if (!probe.warmAt && window.mallLoader?.snapshot().stage === 'warm') probe.warmAt = now();
    if (!probe.start && probe.clickAt && overlay?.hidden && window.__mall?.ready) {
      probe.start = now();
      probe.startRaf = at;
      probe.warmOnEntry = __mall.performanceReport().warm;
    }
    if (probe.start && !probe.done) {
      if (previous >= probe.startRaf) {
        const ms = at - previous;
        probe.frames++;
        probe.maxMs = Math.max(probe.maxMs, ms);
        if (ms >= 50) probe.slow.push({at, previous, frameMs:ms});
      }
      if (at - lastReport >= 3000 || at - probe.startRaf >= 60000) {
        const report = __mall.performanceReport();
        probe.rows.push(...report.history, ...report.slowFrames);
        lastReport = at;
        if (at - probe.startRaf >= 60000) probe.done = true;
      }
    }
    previous = at;
    if (!probe.done) requestAnimationFrame(sample);
  }
  window.addEventListener('blur', () => { if (probe.start && !probe.done) probe.interrupted = true; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && probe.start && !probe.done) probe.interrupted = true;
  });
  requestAnimationFrame(sample);
}"""

STEER = """({route, target}) => {
  const probe = window.earlyProbe;
  let waypoint = 0, sampled = -Infinity;
  probe.closest = Infinity;
  probe.visits = [];
  function steer(at) {
    if (probe.done) return;
    if (at - sampled >= 100) {
      sampled = at;
      const {x,z,yaw} = __mall.state;
      const distance = Math.hypot(x-target[0],z-target[1]);
      if (distance < probe.closest) {
        probe.closest = distance;
        probe.closestAt = at;
      }
      let [dx, dz] = [route[waypoint][0]-x, route[waypoint][1]-z];
      if (Math.hypot(dx,dz) < .45) {
        probe.visits.push({at,x,z,waypoint});
        waypoint = (waypoint + 1) % route.length;
        [dx, dz] = [route[waypoint][0]-x, route[waypoint][1]-z];
      }
      const next = Math.atan2(-dx,-dz);
      if (Math.abs(next-yaw) > .035) {
        // Set camera yaw between RAFs. The actual walk uses the W key and live physics.
        __mall.setInput({yaw:next});
        __mall.setInput(null);
      }
    }
    requestAnimationFrame(steer);
  }
  requestAnimationFrame(steer);
}"""


def walk(page, tier):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(URL, wait_until="load")
    page.locator("#arrival-walk").click()
    page.wait_for_function("performance.now() >= earlyProbe.loadAt + 1500")
    enter_now = page.locator("#loader-enter-now")
    enter_now.wait_for(state="visible", timeout=90000)
    enter_now.click(force=True)
    page.wait_for_function("earlyProbe.start && window.__sceneReady", timeout=90000)
    page.locator("#scene").focus()
    page.evaluate(STEER, {"route": ROUTE, "target": TARGET})
    page.keyboard.down("w")
    try:
        page.wait_for_function("earlyProbe.done", polling=500, timeout=75000)
    finally:
        page.keyboard.up("w")

    probe, report = page.evaluate("() => [earlyProbe, __mall.performanceReport()]")
    start = probe["startRaf"]
    rows = {row["at"]: row for row in probe["rows"] if start <= row["at"] <= start + 60100}
    busy = sorted((row for row in rows.values() if (row["callbackMs"] or 0) >= 50),
                  key=lambda row: row["at"])
    events = probe["events"]

    for sample in probe["slow"]:
        previous, at = sample["previous"], sample["at"]
        sample["callback"] = min(rows.values(), key=lambda row: abs(row["at"] - previous), default=None)
        sample["nearbyGL"] = [event for event in events if previous <= event["at"] < at]
    slow_busy = [{**row, "nearbyGL": [event for event in events
                 if row["at"] <= event["at"] <= row["at"] + row["callbackMs"] + 5]} for row in busy]
    gl_slow = [event for event in events if event["ms"] >= 4]
    pose_gl = [event for event in events if abs(event["at"] - probe.get("closestAt", -2000)) < 1000
               and event["call"] in ("linkProgram", "useProgram", "texImage2D", "texSubImage2D", "bufferData")]
    result = {
        "tier": tier, "effectiveTier": report["graphics"]["tier"], "samples": probe["frames"],
        "slowRafCount": len(probe["slow"]), "maxRafMs": probe["maxMs"], "slowRaf": probe["slow"],
        "busyCallbackCount": len(busy), "busyCallbacks": slow_busy, "slowGLCalls": gl_slow,
        "peakTriangles": max((row["triangles"] or 0 for row in rows.values()), default=0),
        "clickAfterLoadMs": probe["clickAt"] - probe["loadAt"],
        "buttonAfterLoadMs": probe["buttonAt"] - probe["loadAt"],
        "warmOnEntry": probe["warmOnEntry"], "warm": report["warm"],
        "uploads": report["uploads"], "interiors": report["interiors"], "signage": report["signage"],
        "closestToOwnerPoseM": probe["closest"], "poseGL": pose_gl, "visited": probe["visits"],
        "viewport": report["viewport"], "drawingBuffer": [report["width"], report["height"]],
        "interrupted": probe["interrupted"], "errors": errors,
    }
    print(json.dumps(result), flush=True)
    return (not errors and not probe["interrupted"] and report["graphics"]["tier"] == tier
            and report["warm"]["reason"] == "enter-now" and probe["closest"] < .55
            and bool(rows) and probe["frames"] > 0 and not probe["slow"] and not busy)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tier", choices=["low", "balanced", "detailed"], required=True)
    args = parser.parse_args()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ["GALLERY_CHROME"],
                                             headless=False, args=["--use-angle=metal"])
        try:
            # Owner report records a 945px viewport and an 893px drawing buffer.
            context = browser.new_context(viewport={"width": 1189, "height": 945}, device_scale_factor=1)
            context.add_init_script(f"""({OBSERVE})();
              localStorage.setItem('gjh-v11-tutorial-v1','dismissed');
              localStorage.setItem('gjh-v11-graphics-quality-v1',{json.dumps(args.tier)});""")
            return walk(context.new_page(), args.tier)
        finally:
            browser.close()


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
