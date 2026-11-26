const stage = document.querySelector("#stage");
const canvas = document.querySelector("#view");
const toolbar = document.querySelector("#toolbar");
const status = document.querySelector("#scene-status");
const stops = [...document.querySelectorAll("[data-stop]")];
const shopStop = stops.find((stop) => stop.dataset.stop === "shop");
const dialog = document.querySelector("#stop-dialog");
const loadingDialog = document.querySelector("#shop-loading-dialog");
const shopLoadFallback = document.querySelector("#shop-load-fallback");
const weather = document.querySelector("#weather");
const sections = [...document.querySelectorAll(".stop-details .detail")];
const vendingSection = document.querySelector("#vending");
const lightingStorageKey = "gjh-mini-street-lighting";
const lightingButtons = [...toolbar.querySelectorAll("[data-light]")];

const cameraGroup = toolbar.querySelector(".camera-buttons");
const cameraLabel = document.createElement("span");
cameraLabel.className = "scene-camera-label";
cameraLabel.textContent = "Camera";
cameraGroup.before(cameraLabel);
for (const button of cameraGroup.querySelectorAll("button")) {
  button.title = button.getAttribute("aria-label");
}

const cameraHelp = document.createElement("details");
cameraHelp.className = "scene-camera-help";
const helpSummary = document.createElement("summary");
helpSummary.textContent = "Camera help";
cameraHelp.append(helpSummary);
const helpContent = document.createElement("div");
for (const instruction of [
  "Mouse: drag to look around. Scroll over the street view to zoom.",
  "Touch: drag to look around. Pinch to zoom.",
  "Keyboard: focus the street view, then use the arrow keys to look, + or − to zoom, and Home to reset.",
]) {
  const paragraph = document.createElement("p");
  paragraph.textContent = instruction;
  helpContent.append(paragraph);
}
cameraHelp.append(helpContent);
cameraGroup.after(cameraHelp);
cameraHelp.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !cameraHelp.open) return;
  event.preventDefault();
  cameraHelp.open = false;
  helpSummary.focus();
});

let vending;
let vendingOpen = false;
let directShopLink;

function readSceneLighting() {
  try {
    return localStorage.getItem(lightingStorageKey) === "day" ? "day" : "night";
  } catch {
    return "night";
  }
}

function applySceneLighting(mode) {
  const night = mode === "night";
  street.setNight(night);
  weather.textContent = night ? "Rainy evening" : "After the rain";
  stage.dataset.sceneLighting = mode;
  for (const button of lightingButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.light === mode));
  }
}

function setVendingOpen(open) {
  vendingOpen = open;
  if (open) vending?.open();
  else vending?.close();
}

function decodedHash() {
  try { return decodeURIComponent(location.hash); }
  catch { return ""; }
}

// Keep the street links and shop usable if the optional machine fails to load.
import("./vending.js").then(({ setupVending }) => {
  vending = setupVending(vendingSection);
  if (vendingOpen) vending.open();
}).catch(() => {
  vendingSection.querySelector("#vending-note").textContent = "The virtual drink machine could not load. Please try again.";
});

let street;
let shopExperience;
let shopModule;
let shopEntry;
let shopUnavailable = false;
const historyMarker = "__gjhMiniStreetStop";
const shopDisplayMarker = "__gjhMiniStreetShopDisplay";
let syncRoute = () => {};
let openCanvasShop = () => shopStop.click();

function isShopLocation(hash = decodedHash()) {
  return hash === "#shop-interior" || (hash === "#shop" && !history.state?.[shopDisplayMarker]);
}

function replaceShopLocation(hash, display = false) {
  const url = new URL(location.href);
  url.hash = hash;
  const state = {...history.state};
  if (display) state[shopDisplayMarker] = true;
  else delete state[shopDisplayMarker];
  history.replaceState(state, "", url);
}

function redirectToShopDisplay() {
  replaceShopLocation("shop", true);
  syncRoute();
}

function closeShopLoading() {
  if (!loadingDialog.open) return;
  loadingDialog.close();
  street?.setPaused(false);
}

async function enterShop(entry, onExit) {
  const isCurrent = () => entry === shopEntry && !entry.cancelled && !shopUnavailable && isShopLocation();
  try {
    // Give the browser a chance to paint the loading dialog before building the room.
    const paint = new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const module = shopExperience ? null : shopModule ??= import("./shop-experience.js");
    const [exports] = await Promise.all([module, paint]);
    if (!isCurrent()) return;
    shopExperience ??= exports.createShopExperience({street, stage, toolbar, onExit});
    cameraHelp.open = false;
    if (!shopExperience.enter()) throw new Error("The shop did not render an opening frame.");
    if (!isCurrent()) return;
    entry.ready = true;
    loadingDialog.close();
    if (decodedHash() === "#shop") replaceShopLocation("shop-interior");
    stage.querySelector(".shop-interior-controls")?.focus({preventScroll: true});
  } catch (error) {
    if (!isCurrent()) return;
    console.error("Could not enter the 3D shop", error);
    showShopFallback(true);
    status.textContent = "The 3D shop could not load. The product display remains available.";
  }
}

function beginShopEntry(onExit) {
  if (!shopEntry) {
    shopEntry = {started: false, cancelled: false};
    loadingDialog.showModal();
    street?.setPaused(true);
  }
  if (street && !shopEntry.started) {
    shopEntry.started = true;
    enterShop(shopEntry, onExit);
  }
}

if (typeof dialog.showModal === "function") {
  const sectionsByHash = new Map(sections.map((section) => [`#${section.id}`, section]));
  let pendingOpener = null;
  let closingWithBack = false;
  let deferredStop;
  let previousFocus;
  let activeSection;
  let shopOpener;
  dialog.append(...sections);

  directShopLink = document.createElement("a");
  directShopLink.className = "scene-shop-entry";
  directShopLink.href = "#shop-interior";
  directShopLink.textContent = "Enter New Moon Shop";
  directShopLink.hidden = true;
  stage.querySelector(".intro").append(directShopLink);

  shopLoadFallback.querySelector("button").addEventListener("click", () => {
    // Reload the module graph since browsers may retain a failed dynamic import.
    replaceShopLocation("shop-interior");
    location.reload();
  });

  function leaveShop(useDisplay) {
    if (!shopEntry || shopEntry.cancelled || !isShopLocation()) return;
    shopEntry.cancelled = true;
    if (history.state?.[historyMarker]) {
      closingWithBack = true;
      history.back();
    } else if (useDisplay) {
      redirectToShopDisplay();
    } else {
      replaceShopLocation("");
      syncLocation();
    }
  }

  function cancelShopEntry(event) {
    event.preventDefault();
    leaveShop(false);
  }

  loadingDialog.addEventListener("cancel", cancelShopEntry);
  loadingDialog.querySelector("form").addEventListener("submit", cancelShopEntry);

  function shopFocusTarget(opener) {
    return opener?.isConnected && !opener.closest("[hidden], [inert]") ? opener : shopStop;
  }

  function closeStop(updateLocation) {
    if (!activeSection) return;
    const hash = `#${activeSection.id}`;
    const returnFocus = activeSection.id === "shop" ? shopFocusTarget(previousFocus) : previousFocus;
    if (activeSection === vendingSection) setVendingOpen(false);
    activeSection = undefined;
    if (dialog.open) dialog.close();
    if (updateLocation && decodedHash() === hash) {
      if (history.state?.[historyMarker]) {
        closingWithBack = true;
        history.back();
      } else {
        const url = new URL(location.href);
        url.hash = "";
        history.replaceState(history.state, "", url);
      }
    }
    street?.setPaused(false);
    returnFocus?.focus();
  }

  function syncLocation() {
    const hash = decodedHash();
    if (isShopLocation(hash) && !shopUnavailable) {
      closeStop(false);
      const entryType = history.state?.[historyMarker];
      const routeOpener = entryType === "direct" ? directShopLink : entryType === "shop-canvas" ? canvas : shopStop;
      shopOpener ??= pendingOpener || routeOpener;
      pendingOpener = null;
      if (shopEntry?.ready && hash === "#shop") replaceShopLocation("shop-interior");
      beginShopEntry(() => leaveShop(true));
      return;
    }
    if (hash === "#shop-interior") {
      redirectToShopDisplay();
      return;
    }
    shopEntry = undefined;
    closeShopLoading();
    shopExperience?.exit();
    const selected = sectionsByHash.get(hash);
    const returnToEntry = shopOpener;
    shopOpener = undefined;
    const opener = pendingOpener || (selected?.id === "shop" && returnToEntry) ||
      stops.find((stop) => stop.hash === hash);
    pendingOpener = null;
    if (!selected) {
      closeStop(false);
      if (returnToEntry) shopFocusTarget(returnToEntry).focus({preventScroll: true});
      return;
    }
    if (dialog.open && activeSection === selected) return;
    if (activeSection === vendingSection) setVendingOpen(false);
    activeSection = selected;
    previousFocus = opener;
    for (const section of sections) section.hidden = section !== selected;
    dialog.setAttribute("aria-labelledby", selected.getAttribute("aria-labelledby"));
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    street?.setPaused(true);
    if (selected === vendingSection) setVendingOpen(true);
    selected.querySelector("h2").focus();
  }

  function openStop(stop, opener) {
    pendingOpener = opener;
    if (decodedHash() !== stop.hash) {
      const previousState = history.state;
      const state = previousState && typeof previousState === "object" && !Array.isArray(previousState)
        ? {...previousState} : {};
      delete state[shopDisplayMarker];
      state[historyMarker] = stop === directShopLink ? "direct" : opener === canvas ? "shop-canvas" : true;
      history.pushState(state, "", stop.hash);
    }
    syncLocation();
  }

  function requestStop(stop, opener = stop) {
    // A close-triggered Back can still be pending when the user opens another stop.
    if (closingWithBack) deferredStop = {stop, opener};
    else openStop(stop, opener);
  }

  const routedStops = stops.filter((link) => sectionsByHash.has(link.hash));
  for (const stop of [...routedStops, directShopLink]) {
    stop.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      requestStop(stop);
    });
  }
  openCanvasShop = () => requestStop(shopStop, canvas);

  window.addEventListener("hashchange", () => {
    closingWithBack = false;
    const request = deferredStop;
    deferredStop = undefined;
    if (request) openStop(request.stop, request.opener);
    else syncLocation();
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open) closeStop(true);
  });
  function dismiss(event) {
    event.preventDefault();
    closeStop(true);
  }
  dialog.addEventListener("cancel", dismiss);
  dialog.querySelector("form").addEventListener("submit", dismiss);
  for (const link of dialog.querySelectorAll(".back")) link.addEventListener("click", dismiss);
  syncRoute = syncLocation;
  syncLocation();
  if (document.readyState !== "complete") {
    window.addEventListener("load", () => requestAnimationFrame(() => {
      if (loadingDialog.open && !loadingDialog.contains(document.activeElement)) {
        loadingDialog.querySelector("button").focus({preventScroll: true});
      } else if (dialog.open && !dialog.contains(document.activeElement)) {
        dialog.querySelector(".detail:not([hidden]) h2")?.focus();
      }
    }), {once: true});
  }
} else {
  const syncInlineVending = () => {
    setVendingOpen(decodedHash() === "#vending");
    street?.setPaused(vendingOpen);
  };
  window.addEventListener("hashchange", syncInlineVending);
  syncInlineVending();
}

let fallbackShopping;
function enableFallbackShopping() {
  if (fallbackShopping) return fallbackShopping;
  fallbackShopping = Promise.all([
    import("./basket.js"), import("./shop-product-catalog.js"),
  ]).then(([{createShopBasket}, {NEW_MOON_PRODUCTS}]) => {
    const host = document.querySelector(".masthead-inner");
    const basket = shopExperience?.moveBasketTo(host) ?? createShopBasket({host});
    const shop = document.querySelector("#shop");
    const choices = document.createElement("div");
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    for (const product of NEW_MOON_PRODUCTS) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "enter-shop";
      add.textContent = `Add ${product.title} to basket`;
      add.addEventListener("click", () => {
        if (basket.add(product.id, {})) {
          message.textContent = `${product.title} added. Close this display to view your basket.`;
        }
      });
      choices.append(add);
    }
    shop.querySelector(".pack-list").after(choices, message);
    return basket;
  }).catch(error => {
    console.error("Could not load the virtual basket", error);
  });
  return fallbackShopping;
}

function showShopFallback(canRetry = false) {
  shopUnavailable = true;
  shopExperience?.exit();
  shopLoadFallback.hidden = !canRetry;
  if (directShopLink) directShopLink.hidden = true;
  if (decodedHash() === "#shop-interior") redirectToShopDisplay();
  else syncRoute();
  enableFallbackShopping();
}

const showFallback = () => {
  showShopFallback();
  delete stage.dataset.webgl;
  toolbar.hidden = true;
  status.textContent = "The 3D street is unavailable. The shop, vending demo and mall link are available below.";
};

async function start() {
  try {
    const { createStreet } = await import("./scene.js");
    street = createStreet({
      canvas,
      stops,
      activate: (name) => {
        if (name === "shop") openCanvasShop();
        else stops.find((stop) => stop.dataset.stop === name)?.click();
      },
      fail: showFallback,
      onZoomChange: (zoom, min, max) => {
        cameraGroup.querySelector('[data-camera="zoom-out"]').setAttribute("aria-disabled", String(zoom <= min));
        cameraGroup.querySelector('[data-camera="zoom-in"]').setAttribute("aria-disabled", String(zoom >= max));
      },
      onViewChange: (view) => stage.toggleAttribute("data-visitor-focus", view.stop === "visitor"),
      startPaused: dialog.open || loadingDialog.open || vendingOpen,
    });
    applySceneLighting(readSceneLighting());
    stage.dataset.webgl = "";
    toolbar.hidden = false;
    if (directShopLink) directShopLink.hidden = false;
    syncRoute();
    status.textContent = "3D street ready. Drag the street or use the camera controls.";

    for (const button of lightingButtons) {
      button.addEventListener("click", () => {
        const mode = button.dataset.light;
        applySceneLighting(mode);
        try {
          localStorage.setItem(lightingStorageKey, mode);
        } catch {
          // Lighting still changes when the browser blocks storage.
        }
      });
    }
    for (const button of toolbar.querySelectorAll("[data-camera]")) {
      button.addEventListener("click", () => {
        if (button.getAttribute("aria-disabled") !== "true") street.look(button.dataset.camera);
      });
    }
  } catch {
    showFallback();
  }
}
start();
