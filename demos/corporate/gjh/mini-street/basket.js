const storageKey = "gjh-mini-street:basket:v1";
const product = {
  sku: "au-425g",
  name: "New Moon Australia Abalone",
  size: "425 g",
  photo: new URL("../v11/assets/new-moon-au-425g-front.webp", import.meta.url).href,
};
const repeatWindow = 250;
const visitOnly = "Browser saving is unavailable. Your selections are kept until you leave this page.";

function readQuantity(raw) {
  try {
    const saved = JSON.parse(raw);
    const quantity = saved?.items?.[product.sku];
    return saved?.version === 1 && Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0;
  } catch {
    return 0;
  }
}

/** Mount one shopping basket. Pass a unique object to add() for each picked-up item. */
export function createShopBasket({host = document.querySelector(".masthead-inner") ?? document.body} = {}) {
  const doc = host.ownerDocument;
  const view = doc.defaultView;
  const abort = new view.AbortController();
  const events = new view.EventTarget();
  const pickedItems = new WeakSet();
  let lastAdd = -Infinity;
  let quantity = 0;
  let storage;
  let opener;
  let noticeTimer;

  const dock = doc.createElement("div");
  dock.className = "mini-basket-dock";
  dock.innerHTML = [
    '<button type="button" class="mini-basket-launcher" aria-haspopup="dialog" aria-controls="mini-basket">',
    '  <span>Basket</span><span class="mini-basket-badge" aria-hidden="true">0</span>',
    '</button>',
    '<p class="mini-basket-notice" role="status" aria-atomic="true"></p>',
  ].join("");
  const launcher = dock.querySelector("button");
  const badge = dock.querySelector(".mini-basket-badge");
  const notice = dock.querySelector(".mini-basket-notice");

  const dialog = doc.createElement("dialog");
  dialog.id = "mini-basket";
  dialog.className = "mini-basket";
  dialog.setAttribute("aria-labelledby", "mini-basket-title");
  dialog.setAttribute("aria-describedby", "mini-basket-description");
  dialog.innerHTML = [
    '<header class="mini-basket-heading">',
    '  <h2 id="mini-basket-title" tabindex="-1">Virtual basket</h2>',
    '  <button type="button" class="mini-basket-close" aria-label="Close basket">',
    '    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    '  </button>',
    '</header>',
    '<p id="mini-basket-description">Keep track of the products you pick in Mini Street.</p>',
    '<p class="mini-basket-empty">Your basket is empty.</p>',
    '<ul class="mini-basket-items" hidden>',
    '  <li class="mini-basket-item">',
    '    <img class="mini-basket-photo" width="64" height="64" alt="">',
    '    <div class="mini-basket-product"><strong></strong><span></span></div>',
    '    <div class="mini-basket-edit">',
    '      <div class="mini-basket-quantity" role="group" aria-label="Quantity">',
    '        <button type="button" data-change="-1" aria-label="Decrease quantity">−</button>',
    '        <span></span>',
    '        <button type="button" data-change="1" aria-label="Increase quantity">+</button>',
    '      </div>',
    '      <button type="button" class="mini-basket-remove">Remove</button>',
    '    </div>',
    '  </li>',
    '</ul>',
    '<p class="mini-basket-saving" hidden></p>',
    '<p class="mini-basket-status" role="status" aria-atomic="true"></p>',
    '<button type="button" class="mini-basket-continue">Continue shopping</button>',
  ].join("");

  const heading = dialog.querySelector("h2");
  const items = dialog.querySelector(".mini-basket-items");
  const empty = dialog.querySelector(".mini-basket-empty");
  const quantityLabel = dialog.querySelector(".mini-basket-quantity span");
  const increment = dialog.querySelector('[data-change="1"]');
  const decrement = dialog.querySelector('[data-change="-1"]');
  const remove = dialog.querySelector(".mini-basket-remove");
  const continueButton = dialog.querySelector(".mini-basket-continue");
  const saveWarning = dialog.querySelector(".mini-basket-saving");
  const dialogStatus = dialog.querySelector(".mini-basket-status");
  const photo = dialog.querySelector(".mini-basket-photo");
  dialog.querySelector(".mini-basket-product strong").textContent = product.name;
  dialog.querySelector(".mini-basket-product span").textContent = product.size;
  remove.setAttribute("aria-label", "Remove " + product.name);
  saveWarning.textContent = visitOnly;
  host.append(dock);
  doc.body.append(dialog);

  function render() {
    const focusRemoved = !quantity && items.contains(doc.activeElement);
    if (quantity && !photo.hasAttribute("src")) photo.src = product.photo;
    items.hidden = !quantity;
    empty.hidden = Boolean(quantity);
    quantityLabel.textContent = String(quantity);
    increment.disabled = quantity >= Number.MAX_SAFE_INTEGER;
    badge.textContent = quantity > 99 ? "99+" : String(quantity);
    launcher.setAttribute("aria-label", "Basket, " + quantity + (quantity === 1 ? " item" : " items"));
    saveWarning.hidden = Boolean(storage);
    if (focusRemoved) continueButton.focus();
  }

  function announce(message) {
    if (dialog.open) {
      dialogStatus.textContent = message;
      return;
    }
    notice.textContent = message;
    view.clearTimeout(noticeTimer);
    noticeTimer = view.setTimeout(() => { notice.textContent = ""; }, 5000);
  }

  function currentQuantity() {
    if (!storage) return quantity;
    try {
      return readQuantity(storage.getItem(storageKey));
    } catch {
      storage = undefined;
      return quantity;
    }
  }

  function reconcile() {
    const previous = quantity;
    quantity = currentQuantity();
    render();
    if (quantity !== previous) {
      if (dialog.open) announce("Basket updated. Quantity " + quantity + ".");
      events.dispatchEvent(new view.Event("change"));
    }
  }

  try {
    storage = view.localStorage;
  } catch {
    storage = undefined;
  }
  reconcile();

  function changeQuantity(update, describe) {
    const previous = quantity;
    const current = currentQuantity();
    const next = update(current);
    const changed = next !== current && Number.isSafeInteger(next) && next >= 0;
    quantity = changed ? next : current;
    if (changed && storage) {
      try {
        storage.setItem(storageKey, JSON.stringify({
          version: 1,
          items: quantity ? {[product.sku]: quantity} : {},
        }));
      } catch {
        storage = undefined;
      }
    }

    render();
    if (changed) {
      const message = describe(quantity);
      announce(storage ? message : message + " " + visitOnly);
    } else if (next > Number.MAX_SAFE_INTEGER) {
      announce("The basket has reached its quantity limit.");
    }
    if (quantity !== previous) events.dispatchEvent(new view.Event("change"));
    return changed;
  }

  function add(sku, pickedItem) {
    if (abort.signal.aborted || sku !== product.sku) return false;
    if (pickedItem != null && (typeof pickedItem !== "object" || pickedItems.has(pickedItem))) return false;
    const now = view.performance.now();
    if (pickedItem == null && now - lastAdd < repeatWindow) return false;

    const previousAdd = lastAdd;
    if (pickedItem == null) lastAdd = now;
    else pickedItems.add(pickedItem);
    const changed = changeQuantity((value) => value + 1, (value) => (
      "Added " + product.name + ". " + value + (value === 1 ? " item" : " items") + " in basket."
    ));
    if (!changed) {
      if (pickedItem == null) lastAdd = previousAdd;
      else pickedItems.delete(pickedItem);
    }
    return changed;
  }

  function open(trigger = doc.activeElement) {
    if (abort.signal.aborted || dialog.open || doc.querySelector("dialog[open]")) return false;
    try {
      dialog.showModal();
    } catch {
      announce("The basket could not open. Please try again.");
      return false;
    }
    opener = trigger instanceof view.HTMLElement ? trigger : launcher;
    view.clearTimeout(noticeTimer);
    notice.textContent = "";
    dialogStatus.textContent = "";
    heading.focus({preventScroll: true});
    return true;
  }

  function close() {
    if (!dialog.open) return;
    dialog.close();
    if (!doc.querySelector("dialog[open]")) {
      const returnTarget = opener?.isConnected ? opener : launcher;
      returnTarget.focus({preventScroll: true});
      if (doc.activeElement !== returnTarget) launcher.focus({preventScroll: true});
    }
    opener = undefined;
  }

  const listen = (target, type, handler) => target.addEventListener(type, handler, {signal: abort.signal});
  listen(launcher, "click", () => open(launcher));
  listen(dialog, "cancel", (event) => {
    event.preventDefault();
    close();
  });
  listen(dialog, "keydown", (event) => {
    if (event.key !== "Tab") return;
    const buttons = Array.from(dialog.querySelectorAll("button:not(:disabled)"))
      .filter((button) => !button.closest("[hidden]"));
    const first = buttons[0];
    const last = buttons.at(-1);
    const active = doc.activeElement;
    const wrap = event.shiftKey ? active === first || active === heading : active === last;
    if (!wrap) return;
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  });
  listen(dialog.querySelector(".mini-basket-close"), "click", close);
  listen(continueButton, "click", close);
  listen(increment, "click", () => changeQuantity((value) => value + 1, (value) => "Quantity " + value + "."));
  listen(decrement, "click", () => changeQuantity((value) => Math.max(0, value - 1), (value) => (
    value ? "Quantity " + value + "." : "Removed " + product.name + "."
  )));
  listen(remove, "click", () => changeQuantity(() => 0, () => "Removed " + product.name + "."));
  listen(view, "storage", (event) => {
    if (storage && event.storageArea === storage && (event.key === storageKey || event.key === null)) reconcile();
  });
  listen(view, "pageshow", reconcile);

  function subscribe(listener) {
    if (abort.signal.aborted) return () => {};
    listener(quantity);
    const update = () => listener(quantity);
    listen(events, "change", update);
    return () => events.removeEventListener("change", update);
  }

  function cleanup() {
    close();
    abort.abort();
    view.clearTimeout(noticeTimer);
    dialog.remove();
    dock.remove();
  }

  return {add, open, close, count: () => quantity, subscribe, cleanup};
}
