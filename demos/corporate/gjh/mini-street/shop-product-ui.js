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
export function createShopProductUI({ mount, onClose, onRotate, onReset, onPutBack, onAddToBasket }) {
  const document = mount.ownerDocument;
  const root = document.createElement("section");
  root.className = "shop-product";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-labelledby", "shop-product-title");
  root.hidden = true;
  root.innerHTML = `
    <button class="shop-product-close" type="button">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
      Close
    </button>
    <div class="shop-product-preview">
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
  bind(add, () => onAddToBasket(currentProduct.id));

  document.addEventListener("keydown", (event) => {
    if (root.hidden || event.defaultPrevented || event.key !== "Escape") return;
    // Escape returns to the shop even after the shared canvas took pointer focus.
    if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) onClose();
  }, { signal });
  mount.append(root);

  function render({ phase = "idle", product, fallback = false, added = false, opener } = {}) {
    const visible = phase !== "idle";
    if (visible && root.hidden) previousFocus = opener ?? document.activeElement;
    const wasVisible = !root.hidden;
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
    rotateGroup.hidden = fallback;
    for (const button of [left, reset, right]) button.disabled = !inspecting || fallback;
    putBack.disabled = !inspecting;
    add.disabled = !inspecting || added;
    add.textContent = added ? "Added to basket" : "Add to basket";
    photo.hidden = !visible || !fallback;
    if (!photo.hidden && photo.src !== selected.photo) photo.src = selected.photo;
    const message = added ? "Added to the virtual basket." :
      phaseMessages[phase] ?? (fallback && inspecting ? "Showing product photo." : "");
    if (status.textContent !== message) status.textContent = message;
    root.hidden = !visible;

    if (visible && (!wasVisible || activeControl?.disabled)) {
      close.focus({ preventScroll: true });
    } else if (!visible && wasVisible) {
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
