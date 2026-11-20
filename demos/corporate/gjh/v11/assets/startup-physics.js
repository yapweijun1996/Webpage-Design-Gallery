const wasm = new URL('../vendor/rapier_bg.wasm', import.meta.url);
export const physicsBytes = 3082103;
let shared;

async function download(report) {
  const response = await fetch(wasm, {priority:'high', signal:AbortSignal.timeout(90000)});
  if (!response.ok || !response.body) throw Error('Mall physics download failed');
  const bytes = new Uint8Array(physicsBytes);
  let loaded = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes.set(value, loaded);
      loaded += value.byteLength;
      report?.(loaded, physicsBytes);
    }
  } finally {
    await reader.cancel();
  }
  if (loaded !== bytes.length) throw Error('Incomplete mall physics download');
  return bytes;
}

export function startPhysics(report) {
  // Route startup owns this transfer. Handle early failures until the engine
  // awaits the same promise and opens the directory fallback.
  shared ??= download(report);
  void shared.catch(() => {});
  return shared;
}
