// Order PS-0124 demo state with a tiny publish/subscribe API. Example data only.
const state = {lines: {}, steps: {paid: false, packed: false, collected: false}, prep: {}};
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function addItem(id, name, price) {
  const line = state.lines[id] || {id, name, price, qty: 0};
  line.qty += 1;
  state.lines[id] = line;
  state.steps.paid = true;
  emit();
}

export function setPrep(id, done) {
  state.prep[id] = done;
  const values = Object.values(state.prep);
  state.steps.packed = values.length > 0 && values.every(Boolean);
  emit();
}

export function count() {
  return Object.values(state.lines).reduce((sum, line) => sum + line.qty, 0);
}

export function total() {
  return Object.values(state.lines).reduce((sum, line) => sum + line.qty * line.price, 0);
}
