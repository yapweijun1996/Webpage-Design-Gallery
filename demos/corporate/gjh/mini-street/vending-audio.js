import { CHUTE_CONTACT, MOTOR_START, RELEASE, TRAY_IMPACT, TRAY_RATTLE, VEND_DURATION } from "./vending-sequence.js";

// Use filtered noise for friction and contact and short resonances for the cabinet.
// The sounds are generated locally and share one audio context for the dialog.
export function createVendingAudio(AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext) {
  let context;
  let noiseBuffer;
  let currentCue;
  let enabled = false;
  let request = 0;

  function stop() {
    request += 1;
    if (!currentCue) return;
    const { output, sources } = currentCue;
    currentCue = undefined;
    output.disconnect();
    for (const source of sources) source.stop();
  }

  function startCue(draw) {
    const output = context.createGain();
    output.gain.value = 0.38;
    output.connect(context.destination);
    const cue = { output, sources: new Set() };
    currentCue = cue;
    const start = context.currentTime + 0.008;

    function layer(source, at, length, level, attack, input = source) {
      const envelope = context.createGain();
      input.connect(envelope);
      envelope.connect(output);
      const end = at + length;
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(level, at + attack);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end - 0.004);
      envelope.gain.linearRampToValueAtTime(0, end);
      source.onended = () => {
        source.disconnect();
        if (input !== source) input.disconnect();
        envelope.disconnect();
        cue.sources.delete(source);
        if (currentCue === cue && cue.sources.size === 0) {
          output.disconnect();
          currentCue = undefined;
        }
      };
      source.start(at);
      cue.sources.add(source);
      source.stop(end);
    }

    function tone(offset, length, level, type, frequency, endFrequency = frequency, attack = 0.003) {
      const at = start + offset;
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + length);
      layer(oscillator, at, length, level, attack);
    }

    function noise(offset, length, level, frequency, endFrequency = frequency, attack = 0.003) {
      if (!noiseBuffer) {
        noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.55), context.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
      }
      const at = start + offset;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      source.buffer = noiseBuffer;
      source.connect(filter);
      filter.type = "bandpass";
      filter.Q.value = 0.9;
      filter.frequency.setValueAtTime(frequency, at);
      filter.frequency.exponentialRampToValueAtTime(endFrequency, at + length);
      layer(source, at, length, level, attack, filter);
    }

    draw(tone, noise);
  }

  function play(name, { bottle = false, reducedMotion = false } = {}) {
    if (!enabled) return;
    stop();
    const token = request;
    const draw = () => {
      if (token !== request || !enabled || context.state !== "running") return;
      try {
        startCue((tone, noise) => {
          if (name === "select") {
            noise(0, 0.033, 0.20, 2400, 1000);
            tone(0, 0.030, 0.19, "triangle", 430, 230);
            tone(0.037, 0.072, 0.14, "sine", 1318);
            return;
          }
          if (name === "collect") {
            noise(0, 0.112, 0.21, bottle ? 870 : 1550, 560, 0.018);
            tone(0.078, 0.071, 0.29, "triangle", 210, 120);
            noise(0.087, 0.038, 0.16, 1700, 900);
            return;
          }

          const seconds = reducedMotion ? 0.40 : VEND_DURATION / 1000;
          const motor = seconds * MOTOR_START;
          const release = seconds * RELEASE;
          const chute = seconds * CHUTE_CONTACT;
          const impact = seconds * TRAY_IMPACT;
          const rattle = seconds * TRAY_RATTLE;
          noise(0, 0.039, 0.26, 1800, 680);
          tone(0, 0.072, 0.32, "triangle", 260, 120);
          tone(motor, release - motor, 0.20, "triangle", 109, 158, 0.047);
          tone(motor + 0.020, release - motor, 0.09, "sawtooth", 220, 306, 0.035);
          noise(motor, release - motor, 0.21, 360, 730, 0.055);
          noise(release, 0.170, 0.19, bottle ? 740 : 1400, 580);
          tone(chute, 0.076, 0.24, "triangle", bottle ? 180 : 300, 105);
          noise(chute, 0.076, 0.20, 1250, 670);
          tone(impact, 0.14, 0.47, "triangle", bottle ? 163 : 232, 83);
          tone(impact + 0.007, 0.11, 0.16, "sine", bottle ? 570 : 984, bottle ? 360 : 790);
          noise(impact, 0.063, 0.33, bottle ? 840 : 1850, 710);
          tone(rattle, 0.10, 0.13, "triangle", bottle ? 210 : 520, bottle ? 105 : 270);
          noise(rattle + 0.028, 0.087, 0.12, 1150, 690);
        });
      } catch {
        stop();
      }
    };
    try {
      if (context.state === "running") draw();
      else context.resume().then(draw, () => {});
    } catch { /* Playback is optional. */ }
  }

  async function setEnabled(value) {
    if (!value) {
      enabled = false;
      stop();
      return false;
    }
    const token = ++request;
    try {
      context ??= new AudioContext();
      // Call resume inside the button's activation so mobile browsers can unlock sound.
      if (context.state !== "running") await context.resume();
      if (token === request) enabled = context.state === "running";
    } catch {
      if (token === request) enabled = false;
    }
    return enabled;
  }

  return { available: typeof AudioContext === "function", play, setEnabled, stop };
}
