export const PIANO_SAMPLES = Object.freeze(['C3','Ds3','Fs3','A3','C4','Ds4','Fs4','A4','C5','Ds5','Fs5','A5']);
export const PIANO_VOICES = Object.freeze({phone:12,desktop:24});
export const PIANO_RELEASE = .12;

export function createPianoSampler(context, {fetchSample = globalThis.fetch, idle} = {}) {
  let buffers = null, loading = null, failed = false, decoding;
  const voices = new Set();
  const release = voice => {
    voices.delete(voice);
    voice.source.onended = null;
    voice.source.disconnect();
    voice.gain.disconnect();
  };

  async function decode(bytes, signal) {
    // Native decodes cannot be canceled. A replacement load waits for one already in flight.
    if (decoding) await decoding;
    if (signal.aborted) return;
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, {once:true});
      const slice = deadline => {
        if (signal.aborted) return;
        if (deadline && deadline.timeRemaining() < 1.5) {
          idle(slice);
          return;
        }
        signal.removeEventListener('abort', onAbort);
        // One asynchronous native decode per idle frame. An individual decode is atomic.
        const result = Promise.resolve().then(() => {
          if (!signal.aborted) return context.decodeAudioData(bytes);
        });
        decoding = result.then(releaseDecode, releaseDecode);
        result.then(resolve, reject);
      };
      if (signal.aborted) onAbort();
      else idle(slice);
    });
  }

  function releaseDecode() {
    decoding = undefined;
  }

  function load() {
    if (loading || buffers || failed || !context.decodeAudioData || !fetchSample) return loading?.promise;
    const controller = new AbortController();
    const {signal} = controller;
    const promise = (async () => {
      try {
        const responses = await Promise.all(PIANO_SAMPLES.map(async name => {
          const response = await fetchSample(new URL(`./audio/piano/${name}.mp3`, import.meta.url), {signal});
          if (!response.ok) throw new Error(`Piano sample unavailable: ${name}`);
          return response;
        }));
        const decoded = [];
        for (const response of responses) {
          if (signal.aborted) return;
          decoded.push(await decode(await response.arrayBuffer(), signal));
        }
        if (!signal.aborted) buffers = decoded;
      } catch {
        if (!signal.aborted) failed = true;
        controller.abort();
      } finally {
        if (loading?.controller === controller) loading = null;
      }
    })();
    loading = {controller,promise};
    return promise;
  }

  function play(output, note, start, hold, velocity, limit) {
    if (!buffers || voices.size >= limit) return false;
    const index = Math.max(0, Math.min(buffers.length - 1, Math.round((note - 48) / 3)));
    const source = context.createBufferSource(), gain = context.createGain();
    const end = start + hold + PIANO_RELEASE;
    source.buffer = buffers[index];
    source.playbackRate.value = 2 ** ((note - (48 + index * 3)) / 12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(velocity, start + .008);
    gain.gain.setValueAtTime(velocity, start + hold);
    gain.gain.linearRampToValueAtTime(0, end);
    source.connect(gain);
    gain.connect(output);
    const voice = {source,gain};
    voices.add(voice);
    source.onended = () => release(voice);
    source.start(start);
    source.stop(end);
    return true;
  }

  function stop() {
    for (const voice of voices) {
      voice.source.stop();
      release(voice);
    }
  }
  function cancelLoad() {
    loading?.controller.abort();
    loading = null;
  }
  return {load,play,stop,cancelLoad, get ready() { return buffers !== null; }};
}
