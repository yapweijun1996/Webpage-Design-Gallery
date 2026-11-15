/** The caller supplies the canonical selected interaction, never a second nearest search. */
export function createTargetGuidance({canvas, projection}) {
  const marker = document.querySelector('#interaction-point');
  const name = marker.querySelector('span');
  let size = null;
  function hide() { projection.visible(marker, false); }
  return {
    hide,
    update(item, label, camera, active) {
      // Products already have their owner-provided whole-shelf outline.
      if (!active || !item || item.id.startsWith('new-moon-')) { hide(); return; }
      const point = projection.point({x: item.x, y: item.y ?? 0, z: item.z}, camera);
      if (!point) { hide(); return; }
      if (name.textContent !== label || !size) {
        name.textContent = label;
        projection.visible(marker, true);
        size = {width: marker.offsetWidth, height: marker.offsetHeight};
      }
      const rect = canvas.getBoundingClientRect();
      projection.style(marker, 'left', point.x - rect.left);
      projection.style(marker, 'top', point.y - rect.top);
      // Include the label outline and the complete point ring, centred on the anchor.
      const box = {left: point.x - size.width / 2 - 2, right: point.x + size.width / 2 + 2, top: point.y - size.height - 2, bottom: point.y + 7};
      const inside = box.left >= rect.left + 4 && box.right <= rect.right - 4 && box.top >= rect.top + 4 && box.bottom <= rect.bottom - 4;
      // Native controls and disclosures keep their full hit areas and focus rings.
      const overlap = [...document.querySelectorAll('.site-header, .inspect-prompt, .keyboard-help, .mall-map, .joystick, .run-toggle, .scene-disclaimer, .scene-tools, .held-product-status')]
        .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
        .some(e => {
          const r = e.getBoundingClientRect();
          let {left, right, top, bottom} = r;
          const focused = e.matches(':focus-visible') ? e : e.querySelector(':focus-visible');
          if (focused) {
            const f = focused.getBoundingClientRect(), style = getComputedStyle(focused);
            const ring = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset));
            left = Math.min(left, f.left - ring); right = Math.max(right, f.right + ring);
            top = Math.min(top, f.top - ring); bottom = Math.max(bottom, f.bottom + ring);
          }
          return box.left < right + 2 && box.right > left - 2 && box.top < bottom + 2 && box.bottom > top - 2;
        });
      projection.visible(marker, inside && !overlap);
    },
  };
}
