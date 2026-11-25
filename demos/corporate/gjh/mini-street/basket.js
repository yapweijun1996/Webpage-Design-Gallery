import { getNewMoonProduct, NEW_MOON_DEFAULT_PRODUCT, NEW_MOON_PRODUCTS } from "./shop-product-catalog.js";

const storageKey = "gjh-mini-street:basket:v2";
const legacyStorageKey = "gjh-mini-street:basket:v1";
const maxQuantity = Number.MAX_SAFE_INTEGER;
const repeatWindow = 250;
const visitOnly = "Browser saving is unavailable. Your selections are kept until you leave this page.";

function readQuantities(raw, version) {
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return {};
  }
  if (saved?.version !== version) return {};
  const products = version === 1 ? [NEW_MOON_DEFAULT_PRODUCT] : NEW_MOON_PRODUCTS;
  const quantities = {};
  let remaining = maxQuantity;
  for (const {id} of products) {
    const quantity = saved.items?.[id];
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !remaining) continue;
    quantities[id] = Math.min(quantity, remaining);
    remaining -= quantities[id];
  }
  return quantities;
}

function countItems(quantities) {
  return Object.values(quantities).reduce((total, quantity) => total + quantity, 0);
}

function itemsChanged(previous, next) {
  return NEW_MOON_PRODUCTS.some(({id}) => previous[id] !== next[id]);
}

function addedMessage(product, total) {
  return "Added " + product.name + ". " + total + (total === 1 ? " item" : " items") + " in basket.";
}

/** Mount one shopping basket. Pass a unique object to add() for each picked-up item. */
export function createShopBasket({host = document.querySelector(".masthead-inner") ?? document.body} = {}) {
  const doc = host.ownerDocument;
  const view = doc.defaultView;
  const abort = new view.AbortController();
  const events = new view.EventTarget();
  const pickedItems = new WeakSet();
  const lastAdds = new Map();
  let quantities = {};
  let storage;
  let opener;
  let noticeTimer;

  const dock = doc.createElement("div");
  dock.className = "mini-basket-dock";
  dock.innerHTML = [
    '<button type="button" class="mini-basket-launcher" aria-haspopup="dialog" aria-controls="mini-basket">',
    '  <span>Basket</span><span class="mini-basket-badge" aria-hidden="true">0</span>',
    '</button>',
    '<div class="mini-basket-feedback">',
    '  <p class="mini-basket-notice" role="status" aria-atomic="true"></p>',
    '  <div class="mini-basket-feedback-actions" hidden>',
    '    <button type="button" class="mini-basket-review" aria-haspopup="dialog" aria-controls="mini-basket">View basket</button>',
    '    <button type="button" class="mini-basket-dismiss" aria-label="Dismiss basket message">Dismiss</button>',
    '  </div>',
    '</div>',
  ].join("");
  const launcher = dock.querySelector("button");
  const badge = dock.querySelector(".mini-basket-badge");
  const notice = dock.querySelector(".mini-basket-notice");
  const feedback = dock.querySelector(".mini-basket-feedback");
  const feedbackActions = dock.querySelector(".mini-basket-feedback-actions");
  const review = dock.querySelector(".mini-basket-review");

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
    '<p id="mini-basket-description">Your selections in this demo.</p>',
    '<div class="mini-basket-content">',
    '<p class="mini-basket-empty">Your basket is empty.</p>',
    '<ul class="mini-basket-items" hidden></ul>',
    '<template>',
    '  <li class="mini-basket-item" hidden>',
    '    <img class="mini-basket-photo" width="64" height="64" alt="">',
    '    <div class="mini-basket-product"><strong></strong><span></span></div>',
    '    <div class="mini-basket-edit">',
    '      <div class="mini-basket-quantity" role="group">',
    '        <button type="button" data-change="-1">−</button>',
    '        <span></span>',
    '        <button type="button" data-change="1">+</button>',
    '      </div>',
    '      <button type="button" class="mini-basket-remove">Remove</button>',
    '    </div>',
    '  </li>',
    '</template>',
    '<p class="mini-basket-saving" hidden></p>',
    '</div>',
    '<p class="mini-basket-status" role="status" aria-atomic="true"></p>',
    '<button type="button" class="mini-basket-continue">Continue shopping</button>',
  ].join("");

  const heading = dialog.querySelector("h2");
  const items = dialog.querySelector(".mini-basket-items");
  const content = dialog.querySelector(".mini-basket-content");
  const empty = dialog.querySelector(".mini-basket-empty");
  const continueButton = dialog.querySelector(".mini-basket-continue");
  const saveWarning = dialog.querySelector(".mini-basket-saving");
  const dialogStatus = dialog.querySelector(".mini-basket-status");
  const rowTemplate = dialog.querySelector("template");
  const rows = NEW_MOON_PRODUCTS.map(product => {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const photo = row.querySelector(".mini-basket-photo");
    const group = row.querySelector(".mini-basket-quantity");
    const quantityLabel = group.querySelector("span");
    const increment = group.querySelector('[data-change="1"]');
    const decrement = group.querySelector('[data-change="-1"]');
    const remove = row.querySelector(".mini-basket-remove");
    row.querySelector(".mini-basket-product strong").textContent = product.name;
    row.querySelector(".mini-basket-product span").textContent = product.size;
    group.setAttribute("aria-label", "Quantity for " + product.name);
    increment.setAttribute("aria-label", "Increase quantity for " + product.name);
    decrement.setAttribute("aria-label", "Decrease quantity for " + product.name);
    remove.setAttribute("aria-label", "Remove " + product.name);
    items.append(row);
    return {product, row, photo, quantityLabel, increment, decrement, remove};
  });
  rowTemplate.remove();
  saveWarning.textContent = visitOnly;
  host.append(dock);
  doc.body.append(dialog);

  function render() {
    const total = countItems(quantities);
    const previousFocus = doc.activeElement;
    const focusedIndex = rows.findIndex(({row}) => row.contains(previousFocus));
    for (const {product, row, photo, quantityLabel, increment} of rows) {
      const quantity = quantities[product.id] ?? 0;
      row.hidden = !quantity;
      if (quantity && !photo.hasAttribute("src")) photo.src = product.photo;
      quantityLabel.textContent = String(quantity);
      increment.disabled = total >= maxQuantity;
    }
    items.hidden = !total;
    empty.hidden = Boolean(total);
    badge.textContent = total > 99 ? "99+" : String(total);
    launcher.setAttribute("aria-label", "Basket, " + total + (total === 1 ? " item" : " items"));
    saveWarning.hidden = Boolean(storage);
    if (focusedIndex >= 0) {
      const focused = rows[focusedIndex];
      if (focused.row.hidden) {
        const neighbor = rows.slice(focusedIndex + 1).find(({row}) => !row.hidden) ??
          rows.slice(0, focusedIndex).findLast(({row}) => !row.hidden);
        (neighbor?.remove ?? continueButton).focus();
      } else if (previousFocus === focused.increment && focused.increment.disabled) {
        focused.decrement.focus();
      }
    }
  }

  function dismissNotice() {
    view.clearTimeout(noticeTimer);
    notice.textContent = "";
    feedbackActions.hidden = true;
    delete feedback.dataset.visible;
  }

  function announce(message, showReview = false) {
    if (dialog.open) {
      dialogStatus.textContent = message;
      return;
    }
    feedback.dataset.visible = "";
    feedbackActions.hidden = !showReview;
    notice.textContent = message;
    view.clearTimeout(noticeTimer);
    if (!showReview) noticeTimer = view.setTimeout(dismissNotice, 5000);
  }

  function acknowledgeAdd(id) {
    const product = getNewMoonProduct(id);
    if (!product || abort.signal.aborted) return;
    const message = addedMessage(product, countItems(quantities));
    announce(storage ? message : message + " " + visitOnly, true);
    review.focus({preventScroll: true});
  }

  function currentQuantities() {
    if (!storage) return quantities;
    try {
      const saved = storage.getItem(storageKey);
      // The first edit writes v2. An older open tab can only write the legacy key.
      return saved === null ? readQuantities(storage.getItem(legacyStorageKey), 1) : readQuantities(saved, 2);
    } catch {
      storage = undefined;
      return quantities;
    }
  }

  function reconcile() {
    const previous = quantities;
    quantities = currentQuantities();
    render();
    if (itemsChanged(previous, quantities)) {
      if (dialog.open) announce("Basket updated. Total quantity " + countItems(quantities) + ".");
      events.dispatchEvent(new view.Event("change"));
    }
  }

  try {
    storage = view.localStorage;
  } catch {
    storage = undefined;
  }
  reconcile();

  function changeQuantity(id, update, describe) {
    const previous = quantities;
    const current = currentQuantities();
    const quantity = current[id] ?? 0;
    const next = update(quantity);
    const limit = maxQuantity - (countItems(current) - quantity);
    const changed = next !== quantity && Number.isSafeInteger(next) && next >= 0 && next <= limit;
    quantities = current;
    if (changed) {
      quantities = {...current};
      if (next) quantities[id] = next;
      else delete quantities[id];
      if (storage) {
        try {
          storage.setItem(storageKey, JSON.stringify({version: 2, items: quantities}));
        } catch {
          storage = undefined;
        }
      }
    }

    render();
    if (changed && describe) {
      const message = describe(next, countItems(quantities));
      announce(storage ? message : message + " " + visitOnly);
    } else if (next > limit && describe) {
      announce("The basket has reached its quantity limit.");
    }
    if (itemsChanged(previous, quantities)) events.dispatchEvent(new view.Event("change"));
    return changed;
  }

  function add(sku, pickedItem, {deferNotice = false} = {}) {
    const product = getNewMoonProduct(sku);
    if (abort.signal.aborted || !product) return false;
    if (pickedItem != null && (typeof pickedItem !== "object" || pickedItems.has(pickedItem))) return false;
    const now = view.performance.now();
    const previousAdd = lastAdds.get(sku);
    if (pickedItem == null && now - (previousAdd ?? -Infinity) < repeatWindow) return false;

    if (pickedItem == null) lastAdds.set(sku, now);
    else pickedItems.add(pickedItem);
    const describe = deferNotice ? undefined : (_, total) => addedMessage(product, total);
    const changed = changeQuantity(sku, (value) => value + 1, describe);
    if (!changed) {
      if (pickedItem != null) pickedItems.delete(pickedItem);
      else if (previousAdd === undefined) lastAdds.delete(sku);
      else lastAdds.set(sku, previousAdd);
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
    dismissNotice();
    dialogStatus.textContent = "";
    content.scrollTop = 0;
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
  listen(review, "click", () => open(launcher));
  listen(dock.querySelector(".mini-basket-dismiss"), "click", () => {
    dismissNotice();
    launcher.focus({preventScroll: true});
  });
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
  for (const {product, increment, decrement, remove} of rows) {
    const showQuantity = (value) => product.name + " quantity " + value + ".";
    const showRemoval = () => "Removed " + product.name + ".";
    listen(increment, "click", () => changeQuantity(product.id, (value) => value + 1, showQuantity));
    listen(decrement, "click", () => changeQuantity(product.id, (value) => Math.max(0, value - 1), (value) => (
      value ? showQuantity(value) : showRemoval()
    )));
    listen(remove, "click", () => changeQuantity(product.id, () => 0, showRemoval));
  }
  listen(view, "storage", (event) => {
    if (storage && event.storageArea === storage &&
        (event.key === storageKey || event.key === legacyStorageKey || event.key === null)) reconcile();
  });
  listen(view, "pageshow", reconcile);

  function subscribe(listener) {
    if (abort.signal.aborted) return () => {};
    listener(countItems(quantities));
    const update = () => listener(countItems(quantities));
    listen(events, "change", update);
    return () => events.removeEventListener("change", update);
  }

  function cleanup() {
    close();
    abort.abort();
    dismissNotice();
    dialog.remove();
    dock.remove();
  }

  return {add, acknowledgeAdd, dismissNotice, open, close, count: () => countItems(quantities), subscribe, cleanup};
}
