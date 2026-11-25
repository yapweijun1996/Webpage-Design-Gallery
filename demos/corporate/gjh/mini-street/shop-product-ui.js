import { getNewMoonProduct, NEW_MOON_DEFAULT_PRODUCT } from "./shop-product-catalog.js";

const phaseMessages = {
  loading: "Loading product view…",
  reaching: "Picking up the can…",
  lifting: "Picking up the can…",
  returning: "Returning the can to the shelf…",
  stowing: "Adding the can to the basket…",
};

/**
 * Mounts controls over the existing street canvas. The preview element supplies
 * the view bounds. The caller owns scene transitions and basket state.
 */
export function createShopProductUI({
  mount, onClose, onRotate, onDrag, onReset, onPutBack, onAddToBasket,
}) {
  const document = mount.ownerDocument;
  const root = document.createElement("section");
  root.className = "shop-product";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "shop-product-title");
  root.hidden = true;
  root.innerHTML = `
    <button class="shop-product-close" type="button">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
      Close
    </button>
    <div class="shop-product-preview">
      <span class="shop-product-drag-hint" aria-hidden="true" hidden>Drag to rotate</span>
      <img class="shop-product-photo" width="768" height="768" decoding="async" alt="" hidden>
    </div>
    <div class="shop-product-panel">
      <p class="shop-product-brand">New Moon</p>
      <h2 id="shop-product-title"></h2>
      <dl class="shop-product-specs">
        <div><dt>Pack size</dt><dd></dd></div>
        <div><dt>Origin</dt><dd></dd></div>
      </dl>
      <p class="shop-product-status" role="status" aria-atomic="true"></p>
      <div class="shop-product-rotate" role="group" aria-label="Product view controls">
        <button type="button" data-product-rotate="left" aria-label="Rotate left" title="Rotate left">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>
        </button>
        <button type="button" data-product-rotate="reset" aria-label="Reset rotation" title="Reset rotation">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 10a7 7 0 1 1 1 7M5 5v5h5"/></svg>
        </button>
        <button type="button" data-product-rotate="right" aria-label="Rotate right" title="Rotate right">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>
        </button>
      </div>
      <div class="shop-product-actions">
        <button type="button" data-product-action="put-back">Put back</button>
        <button type="button" data-product-action="add">Add to basket</button>
      </div>
    </div>`;
  const preview = root.querySelector(".shop-product-preview");
  const photo = root.querySelector(".shop-product-photo");
  const dragHint = root.querySelector(".shop-product-drag-hint");
  const close = root.querySelector(".shop-product-close");
  const title = root.querySelector("h2");
  const [packSize, origin] = root.querySelectorAll("dd");
  const status = root.querySelector(".shop-product-status");
  const rotateGroup = root.querySelector(".shop-product-rotate");
  const [left, reset, right] = rotateGroup.querySelectorAll("button");
  const [putBack, add] = root.querySelectorAll("[data-product-action]");
  const events = new AbortController();
  const { signal } = events;
  let previousFocus;
  let currentProduct;
  let addFailed = false;
  const inertSiblings = [];
  let drag;

  function bind(button, action) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      action();
    }, { signal });
  }
  bind(close, onClose);
  bind(left, () => onRotate(-1));
  bind(reset, onReset);
  bind(right, () => onRotate(1));
  bind(putBack, onPutBack);
  bind(add, () => {
    if (onAddToBasket(currentProduct.id) === false) {
      addFailed = true;
      status.textContent = "The basket has reached its quantity limit.";
    }
  });

  function isolatePage() {
    for (let child = root; child.parentElement && child !== document.body; child = child.parentElement) {
      for (const sibling of child.parentElement.children) {
        if (sibling !== child && typeof sibling.inert === "boolean" && !sibling.inert) {
          sibling.inert = true;
          inertSiblings.push(sibling);
        }
      }
    }
  }

  function endDrag(pointerId = drag?.id) {
    if (!drag || drag.id !== pointerId) return;
    drag = undefined;
    delete preview.dataset.dragging;
    if (preview.hasPointerCapture(pointerId)) preview.releasePointerCapture(pointerId);
  }

  preview.addEventListener("pointerdown", (event) => {
    if (!preview.hasAttribute("data-rotatable") || !event.isPrimary || event.button !== 0 || drag) return;
    preview.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    preview.dataset.dragging = "";
  }, { signal });
  preview.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (dx || dy) onDrag(dx, dy);
  }, { signal });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    preview.addEventListener(type, event => endDrag(event.pointerId), { signal });
  }

  document.addEventListener("keydown", (event) => {
    if (root.hidden || event.defaultPrevented) return;
    const active = document.activeElement;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) onClose();
    } else if (event.key === "Tab") {
      const buttons = [...root.querySelectorAll("button:not(:disabled)")]
        .filter(button => !button.closest("[hidden]"));
      const first = buttons[0];
      const last = buttons.at(-1);
      if (!buttons.includes(active) || active === (event.shiftKey ? first : last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
  }, { signal });
  mount.append(root);

  function render({ phase = "idle", product, fallback = false, added = false, opener } = {}) {
    const visible = phase !== "idle";
    const wasVisible = !root.hidden;
    if (visible && !wasVisible) {
      previousFocus = opener ?? document.activeElement;
      addFailed = false;
    }
    const activeControl = root.contains(document.activeElement) ? document.activeElement : null;
    const selected = getNewMoonProduct(product?.id) ?? (wasVisible ? currentProduct : undefined) ?? NEW_MOON_DEFAULT_PRODUCT;
    if (currentProduct !== selected) {
      currentProduct = selected;
      title.textContent = selected.title;
      packSize.textContent = selected.size;
      origin.textContent = selected.origin;
      photo.alt = `Front of the New Moon ${selected.title} can`;
    }
    root.dataset.phase = phase;
    root.toggleAttribute("data-fallback", fallback);
    const inspecting = phase === "inspecting";
    const canDrag = Boolean(onDrag && inspecting && !fallback);
    preview.toggleAttribute("data-rotatable", canDrag);
    dragHint.hidden = !canDrag;
    if (!canDrag) endDrag();
    rotateGroup.hidden = fallback;
    for (const button of [left, reset, right]) button.disabled = !inspecting || fallback;
    putBack.disabled = !inspecting;
    add.disabled = !inspecting || added;
    add.textContent = added ? "Added to basket" : "Add to basket";
    photo.hidden = !visible || !fallback;
    if (!photo.hidden && photo.src !== selected.photo) photo.src = selected.photo;
    const message = added && phase !== "stowing" ? "Added to the virtual basket." :
      addFailed && inspecting ? "The basket has reached its quantity limit." :
      phaseMessages[phase] ?? (fallback && inspecting ? "Showing product photo." : "");
    if (status.textContent !== message) status.textContent = message;
    root.hidden = !visible;

    if (visible && (!wasVisible || activeControl?.disabled)) {
      close.focus({ preventScroll: true });
      if (!wasVisible) isolatePage();
    } else if (!visible && wasVisible) {
      for (const sibling of inertSiblings) sibling.inert = false;
      inertSiblings.length = 0;
      previousFocus?.focus({ preventScroll: true });
      previousFocus = undefined;
    }
  }

  function destroy() {
    render();
    events.abort();
    root.remove();
  }

  return { render, preview, destroy };
}
