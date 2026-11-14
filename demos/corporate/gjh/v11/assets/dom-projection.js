/** DOM presentation only: project owner coordinates without creating scene resources. */
export function createDOMProjection(T, canvas) {
  function points(positions, view) {
    view.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect();
    const projected = positions.map(p => new T.Vector3(p.x, p.y, p.z).project(view));
    if (!rect.width || !rect.height || projected.some(p => ![p.x, p.y, p.z].every(Number.isFinite) || p.z < -1 || p.z > 1)) return null;
    return projected.map(p => ({x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2}));
  }
  function bounds(box, view) {
    const positions = [box.min.x, box.max.x].flatMap(x => [box.min.y, box.max.y].flatMap(y =>
      [box.min.z, box.max.z].map(z => ({x, y, z}))));
    const projected = points(positions, view);
    if (!projected) return null;
    return {left: Math.min(...projected.map(p => p.x)), top: Math.min(...projected.map(p => p.y)),
      right: Math.max(...projected.map(p => p.x)), bottom: Math.max(...projected.map(p => p.y))};
  }
  function style(element, key, value) {
    const next = `${Math.round(value * 100) / 100}px`;
    if (element.style[key] !== next) element.style[key] = next;
  }
  function visible(element, show) { if (element.hidden === show) element.hidden = !show; }
  function place(element, box, relative) {
    visible(element, Boolean(box));
    if (!box) return;
    style(element, 'left', box.left - relative.left); style(element, 'top', box.top - relative.top);
    style(element, 'width', box.right - box.left); style(element, 'height', box.bottom - box.top);
  }
  return {bounds, place, style, visible, point(position, view) { return points([position], view)?.[0] || null; }};
}
