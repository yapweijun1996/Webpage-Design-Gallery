import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../demos/corporate/gjh/v11/vendor/three.module.min.js";
import { createVendingAudio } from "../demos/corporate/gjh/mini-street/vending-audio.js";
import { buildVendingModel } from "../demos/corporate/gjh/mini-street/vending-model.js";
import { CHUTE_CONTACT, MOTOR_START, RELEASE, TRAY_IMPACT, VEND_DURATION } from "../demos/corporate/gjh/mini-street/vending-sequence.js";
import { drinks } from "../demos/corporate/gjh/mini-street/vending.js";

const noop = () => {};

test("each selected 3D pack advances, drops, rebounds and settles while its auger and flap move", () => {
  const context = new Proxy({}, {
    get(_target, key) {
      return key === "createLinearGradient" || key === "createRadialGradient"
        ? () => ({ addColorStop: noop })
        : noop;
    },
  });
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    const scene = new THREE.Scene();
    const model = buildVendingModel(scene, drinks, { getPropertyValue: () => "#9fce63" });
    const vend = scene.getObjectByName("Vend button");
    const flap = scene.getObjectByName("Pickup flap");
    for (const [selection, drink] of drinks.entries()) {
      const pack = scene.getObjectByName(`${drink.code} dispensing pack`);
      const auger = scene.getObjectByName(`${drink.code} auger`);
      model.setState({ phase: "selected", selection });
      assert.equal(pack.visible, false);
      model.setState({ phase: "dispensing", selection });
      model.poseDrop(0.035);
      assert.equal(pack.visible, true);
      assert.ok(vend.position.z < -0.01);
      const shelfHeight = pack.position.y;
      model.poseDrop(RELEASE);
      assert.ok(pack.position.z > 0.4);
      assert.ok(auger.rotation.z > 6);
      assert.equal(Math.abs(vend.position.z), 0);
      assert.equal(pack.position.y, shelfHeight);
      model.poseDrop(CHUTE_CONTACT);
      assert.ok(pack.position.y < shelfHeight);
      model.poseDrop(TRAY_IMPACT);
      assert.ok(flap.rotation.x < -1);
      model.poseDrop(TRAY_IMPACT + 0.045);
      const reboundHeight = pack.position.y;
      model.setState({ phase: "ready", selection });
      model.poseDrop(1);
      assert.ok(reboundHeight > pack.position.y);
      assert.ok(Math.abs(pack.rotation.z - Math.PI / 2) < 0.04);
      assert.ok(Math.abs(pack.position.x + 0.133) < 0.00001);
      assert.ok(pack.position.y > 0.46 && pack.position.y < 0.49);
      assert.ok(flap.rotation.x > -0.4 && flap.rotation.x < 0);
      model.setState({ phase: "idle", selection: -1 });
      model.poseDrop(1);
      assert.equal(pack.visible, false);
      assert.equal(flap.rotation.x, 0);
      assert.equal(auger.rotation.z, 0);
    }
  } finally {
    delete globalThis.document;
  }
});

function audioFixture() {
  const sources = [];
  const outputs = [];
  let created = 0;
  let resumed = 0;
  const parameter = () => ({
    setValueAtTime(value) { this.initial = value; },
    linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop,
  });
  const node = () => ({
    connect(destination) { this.destination = destination; },
    disconnect() { this.destination = undefined; },
  });

  class Context {
    constructor() {
      created += 1;
      this.currentTime = 3;
      this.sampleRate = 8000;
      this.state = "suspended";
      this.destination = {};
    }

    async resume() {
      resumed += 1;
      this.state = "running";
    }

    createGain() {
      const gain = { ...node(), gain: parameter() };
      outputs.push(gain);
      return gain;
    }

    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBiquadFilter() { return { ...node(), frequency: parameter(), Q: {} }; }

    createBufferSource() {
      const source = {
        ...node(),
        start(at) { this.started = at; },
        stop(at) { this.stopped = at; },
      };
      sources.push(source);
      return source;
    }

    createOscillator() { return Object.assign(this.createBufferSource(), { frequency: parameter() }); }
  }

  return {
    audio: createVendingAudio(Context), sources, outputs,
    get created() { return created; },
    get resumed() { return resumed; },
  };
}

test("sound starts only after opt-in and schedules distinct cues with the vend timeline", async () => {
  const fixture = audioFixture();
  const { audio, sources } = fixture;
  audio.play("select");
  assert.equal(fixture.created, 0);
  assert.ok(await audio.setEnabled(true));
  assert.equal(fixture.created, 1);
  assert.equal(fixture.resumed, 1);
  audio.play("select");
  const selection = sources.splice(0);
  assert.ok(selection.some(source => source.started > 3.03));
  audio.play("vend");
  const can = sources.splice(0);
  const first = Math.min(...can.map(source => source.started));
  const cueAt = (stage) => can.find(source => Math.abs(source.started - first - stage * VEND_DURATION / 1000) < 0.00001);
  for (const stage of [MOTOR_START, RELEASE, CHUTE_CONTACT, TRAY_IMPACT]) assert.ok(cueAt(stage), stage);
  assert.ok(selection.every(source => source.stopped === undefined));
  audio.play("collect");
  assert.ok(sources.every(source => source.started < 3.12));
  assert.ok(can.every(source => source.stopped === undefined));
});

test("mute and dismissal cut off scheduled layers and a denied resume remains silent", async () => {
  const { audio, outputs, sources } = audioFixture();
  await audio.setEnabled(true);
  audio.play("vend", { bottle: true, reducedMotion: true });
  assert.ok(sources.every(source => source.started < 3.4));
  assert.ok(outputs[0].destination);
  await audio.setEnabled(false);
  assert.equal(outputs[0].destination, undefined);
  assert.ok(sources.every(source => source.stopped === undefined));
  const count = sources.length;
  audio.play("collect");
  assert.equal(sources.length, count);
  await audio.setEnabled(true);
  audio.play("vend");
  audio.stop();
  assert.ok(sources.every(source => source.stopped === undefined));

  const denied = createVendingAudio(class {
    state = "suspended";
    async resume() { throw new Error("Autoplay denied"); }
  });
  assert.equal(await denied.setEnabled(true), false);
  assert.doesNotThrow(() => denied.play("vend"));
});
