// RAF intervals approximate presentation cadence. CPU durations measure the
// synchronous handler and render submission; WebGL can finish on the GPU later.
const FRAME_WINDOW_MS = 5000;
const SLOW_THRESHOLD_MS = 50;

function rollingHistory(capacity, duration) {
  const slots = [];
  let start = 0, count = 0;

  function prune(now) {
    while (count && now - slots[start].at >= duration) {
      start = (start + 1) % capacity;
      count--;
    }
  }
  function append(now) {
    prune(now);
    if (count === capacity) {
      start = (start + 1) % capacity;
      count--;
    }
    const index = (start + count++) % capacity;
    const slot = slots[index] ||= {};
    slot.at = now;
    return slot;
  }
  function values() {
    return Array.from({length:count}, (_, i) => slots[(start + i) % capacity]);
  }
  return {append, prune, values, get length() { return count; }};
}

function metric(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function copyFields(record, frameMs, info, detail) {
  record.frameMs = frameMs;
  record.drawCalls = metric(info?.render?.calls);
  record.triangles = metric(info?.render?.triangles);
  record.geometries = metric(info?.memory?.geometries);
  record.textures = metric(info?.memory?.textures);
  record.simulationMs = metric(detail?.simulationMs);
  record.renderMs = metric(detail?.renderMs);
  record.callbackMs = metric(detail?.callbackMs);
  record.steps = metric(detail?.steps);
  record.zone = detail?.zone ?? null;
  record.x = Number.isFinite(detail?.x) ? detail.x : null;
  record.z = Number.isFinite(detail?.z) ? detail.z : null;
  record.tier = detail?.tier ?? null;
  record.width = metric(detail?.width);
  record.height = metric(detail?.height);
}

export function createPerformanceMonitor() {
  const frames = rollingHistory(720, FRAME_WINDOW_MS);
  const slowFrames = rollingHistory(20, 60000);
  const seconds = rollingHistory(120, 120000);
  let enabled = false, previous = null, bucket = null;
  let latest = {};
  copyFields(latest, null);

  function frame(now, info, detail) {
    if (!enabled || !Number.isFinite(now)) return;
    const interval = previous !== null && now > previous ? now - previous : null;
    previous = now;
    frames.prune(now);
    slowFrames.prune(now);
    seconds.prune(now);
    if (interval !== null) latest = frames.append(now);
    else latest = {};
    copyFields(latest, interval, info, detail);
    latest.at = now;
    const busy = latest.callbackMs >= SLOW_THRESHOLD_MS;
    const slow = busy || interval >= SLOW_THRESHOLD_MS;
    if (slow) {
      const event = slowFrames.append(now);
      Object.assign(event, latest);
      event.reason = busy ? 'busy-callback' : 'raf-gap';
    }
    const second = Math.floor(now / 1000) * 1000;
    if (!bucket || bucket.at !== second) {
      bucket = seconds.append(second);
      Object.assign(bucket, {samples:0,totalMs:0,maxMs:null,maxCallbackMs:null,maxDrawCalls:null,maxTriangles:null,slowCount:0});
    }
    bucket.zone = latest.zone;
    bucket.tier = latest.tier;
    bucket.x = latest.x;
    bucket.z = latest.z;
    if (interval !== null) {
      bucket.samples++;
      bucket.totalMs += interval;
      bucket.maxMs = Math.max(bucket.maxMs, interval);
    }
    if (latest.callbackMs !== null) bucket.maxCallbackMs = Math.max(bucket.maxCallbackMs, latest.callbackMs);
    if (latest.drawCalls !== null) bucket.maxDrawCalls = Math.max(bucket.maxDrawCalls, latest.drawCalls);
    if (latest.triangles !== null) bucket.maxTriangles = Math.max(bucket.maxTriangles, latest.triangles);
    if (slow) bucket.slowCount++;
  }

  function snapshot({includeHistory = true} = {}) {
    const rows = frames.values();
    const sorted = rows.map(row => row.frameMs).sort((a,b) => a-b);
    const percentile = p => sorted[Math.ceil(sorted.length*p)-1] ?? null;
    const mean = sorted.length ? sorted.reduce((sum,ms) => sum+ms,0) / sorted.length : null;
    const result = {...latest, enabled, samples:rows.length, fps:mean ? 1000/mean : null,
      p50Ms:percentile(.50), p95Ms:percentile(.95), p99Ms:percentile(.99),
      slowThresholdMs:SLOW_THRESHOLD_MS, slowFrameCount:slowFrames.length};
    if (includeHistory) {
      result.history = rows.map(row => ({...row}));
      result.slowFrames = slowFrames.values().map(row => ({...row}));
      result.seconds = seconds.values().map(({totalMs, ...row}) => {
        const meanMs = row.samples ? totalMs/row.samples : null;
        return {...row, meanMs, fps:meanMs ? 1000/meanMs : null};
      });
    }
    return result;
  }

  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) previous = null;
    },
    pause() { previous = null; },
    frame, snapshot
  };
}
