import {storeDestinations} from './store-destinations.js';

const visibilityKey = 'gjh-v11-show-fps';
const milliseconds = value => Number.isFinite(value) ? `${value.toFixed(1)} ms` : '—';

function drawHistory(history, line, peakLabel) {
  if (!history?.length) {
    line.removeAttribute('points');
    peakLabel.textContent = '—';
    return;
  }
  // Keep the worst interval in each horizontal bin so brief stalls remain visible.
  const start = history[0].at, duration = Math.max(1, history[history.length - 1].at - start);
  const bins = new Map();
  let peak = 0;
  for (const {at, frameMs} of history) {
    if (!Number.isFinite(at) || !Number.isFinite(frameMs)) continue;
    const bin = Math.round(59 * (at - start) / duration);
    bins.set(bin, Math.max(frameMs, bins.get(bin) || 0));
    peak = Math.max(peak, frameMs);
  }
  const ceiling = Math.max(33.3, peak);
  const points = Array.from(bins, ([bin, value]) => `${(bin * 240 / 59).toFixed(1)},${(41 - value * 40 / ceiling).toFixed(1)}`);
  line.setAttribute('points', points.join(' '));
  peakLabel.textContent = milliseconds(peak);
}

export function createPerformancePanel({snapshot, report = snapshot}) {
  const panel = document.getElementById('performance-panel');
  const toggle = document.getElementById('performance-visible');
  const counter = document.getElementById('performance-fps');
  const summary = panel.querySelector('summary');
  const fields = panel.querySelectorAll('[data-performance]');
  const line = document.getElementById('performance-line'), peak = document.getElementById('performance-peak');

  const log = document.getElementById('performance-log');
  const emptyLog = document.getElementById('performance-log-empty');
  const locations = new Map(storeDestinations(true).map(store => [store.id, store.label]));
  locations.set('atrium', 'Courtyard');
  locations.set('upper', 'Upper level');

  function renderSlowFrames(data) {
    const recent = (data?.slowFrames || []).slice(-3).reverse();
    emptyLog.hidden = recent.length > 0;
    const relativeTime = new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', {numeric:'auto'});
    log.replaceChildren(...recent.map(event => {
      const row = document.createElement('li');
      const heading = document.createElement('div');
      const reason = document.createElement('strong');
      reason.textContent = event.reason === 'busy-callback' ? 'Long frame callback' : 'Delayed frame';
      const age = document.createElement('span');
      age.textContent = relativeTime.format(-Math.max(0, Math.round((performance.now() - event.at) / 1000)), 'second');
      heading.append(reason, age);
      const location = locations.get(event.zone);
      if (location) {
        const name = document.createElement('span');
        name.textContent = location;
        heading.append(name);
      }
      const timings = document.createElement('div');
      timings.textContent = `Interval ${milliseconds(event.frameMs)} · Callback ${milliseconds(event.callbackMs)}`;
      row.append(heading, timings);
      return row;
    }));
  }

  try { toggle.checked = localStorage.getItem(visibilityKey) !== 'false'; } catch { /* Session-only preference. */ }
  panel.hidden = !toggle.checked;
  toggle.addEventListener('change', () => {
    panel.hidden = !toggle.checked;
    if (panel.hidden) panel.open = false;
    try { localStorage.setItem(visibilityKey, String(toggle.checked)); } catch { /* Storage unavailable. */ }
  });

  function renderDetails(data) {
    const numbers = new Intl.NumberFormat(document.documentElement.lang || 'en');
    for (const field of fields) {
      const key = field.dataset.performance, value = data?.[key];
      field.textContent = key.endsWith('Ms') ? milliseconds(value) : Number.isFinite(value) ? numbers.format(value) : '—';
    }
    drawHistory(data?.history, line, peak);
    renderSlowFrames(data);
  }
  function close() {
    panel.open = false;
    summary.focus({preventScroll:true});
  }
  panel.addEventListener('toggle', () => { if (panel.open) renderDetails(snapshot()); });
  document.getElementById('performance-close').addEventListener('click', close);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.open) {
      event.stopPropagation();
      close();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (panel.open && !panel.contains(event.target)) panel.open = false;
  });

  document.getElementById('performance-download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(report(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url;
    link.download = `gjh-performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return {
    update(sample) {
      if (panel.hidden) return;
      const value = Number.isFinite(sample?.fps) ? String(Math.round(sample.fps)) : '—';
      if (counter.textContent !== value) counter.textContent = value;
      if (panel.open) renderDetails(snapshot());
    },
    reset() {
      counter.textContent = '—';
      if (panel.open) renderDetails(null);
    }
  };
}
