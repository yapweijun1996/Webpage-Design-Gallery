const stage = document.querySelector("#stage");
const canvas = document.querySelector("#view");
const toolbar = document.querySelector("#toolbar");
const status = document.querySelector("#scene-status");
const stops = [...document.querySelectorAll("[data-stop]")];
const dialog = document.querySelector("#stop-dialog");
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
  "Mouse: drag to look around. Hold Shift and scroll to zoom.",
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
let shopLoading;
let shopUnavailable = false;
const historyMarker = "__gjhMiniStreetStop";
let syncRoute = () => {};
let routeRequest = 0;

function redirectToShopDisplay() {
  const url = new URL(location.href);
  url.hash = "shop";
  const state = history.state;
  const directState = state?.[historyMarker] ? {...state, [historyMarker]: false} : state;
  history.replaceState(directState, "", url);
  syncRoute();
}

async function enterShop() {
  if (!street || shopUnavailable || decodedHash() !== "#shop-interior") return;
  try {
    if (!shopExperience) {
      shopLoading ||= import("./shop-experience.js").then(({createShopExperience}) => {
        if (shopUnavailable) return;
        shopExperience = createShopExperience({street, stage, toolbar, onExit: () => {
          if (decodedHash() !== "#shop-interior") return;
          if (history.state?.[historyMarker]) history.back();
          else redirectToShopDisplay();
        }});
      });
      await shopLoading;
    }
    if (!shopUnavailable && decodedHash() === "#shop-interior") {
      cameraHelp.open = false;
      shopExperience.enter();
    }
  } catch (error) {
    if (shopUnavailable || decodedHash() !== "#shop-interior") return;
    console.error("Could not enter the 3D shop", error);
    showShopFallback();
    status.textContent = "The 3D shop could not load. The product display remains available.";
  }
}

if (typeof dialog.showModal === "function") {
  const sectionsByHash = new Map(sections.map((section) => [`#${section.id}`, section]));
  let pendingOpener = null;
  let closingWithBack = false;
  let deferredStop;
  let previousFocus;
  let activeSection;
  let directOpener;
  dialog.append(...sections);

  directShopLink = document.createElement("a");
  directShopLink.className = "scene-shop-entry";
  directShopLink.href = "#shop-interior";
  directShopLink.textContent = "Enter New Moon Shop";
  directShopLink.hidden = true;
  stage.querySelector(".intro").append(directShopLink);

  const enter = document.createElement("button");
  enter.type = "button";
  enter.hidden = !street;
  enter.className = "enter-shop";
  enter.textContent = "Enter 3D shop";
  enter.addEventListener("click", () => {
    if (!street || shopUnavailable) return;
    routeRequest++;
    history.pushState({...history.state, [historyMarker]: true}, "", "#shop-interior");
    syncLocation();
  });
  sectionsByHash.get("#shop").querySelector("p").after(enter);

  function closeStop(updateLocation) {
    if (!activeSection) return;
    const hash = `#${activeSection.id}`;
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
    previousFocus?.focus();
  }

  function syncLocation() {
    const hash = decodedHash();
    if (hash === "#shop-interior") {
      directOpener = history.state?.[historyMarker] === "direct" ? directShopLink : undefined;
      if (shopUnavailable) redirectToShopDisplay();
      else {
        closeStop(false);
        enterShop();
      }
      return;
    }
    shopExperience?.exit();
    const selected = sectionsByHash.get(hash);
    const returnToEntry = directOpener;
    directOpener = undefined;
    const opener = pendingOpener || stops.find((stop) => stop.hash === hash);
    pendingOpener = null;
    if (!selected) {
      closeStop(false);
      if (returnToEntry && !returnToEntry.hidden) returnToEntry.focus({preventScroll: true});
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

  async function openStop(stop) {
    const request = ++routeRequest;
    if (stop.dataset.stop === "shop" && street && !dialog.open) {
      await street.focusShop();
      if (request !== routeRequest) return;
    }
    if (stop !== directShopLink) pendingOpener = stop;
    if (decodedHash() !== stop.hash) {
      const previousState = history.state;
      const state = previousState && typeof previousState === "object" && !Array.isArray(previousState)
        ? {...previousState} : {};
      state[historyMarker] = stop === directShopLink ? "direct" : true;
      history.pushState(state, "", stop.hash);
    }
    syncLocation();
  }

  const routedStops = stops.filter((link) => sectionsByHash.has(link.hash));
  for (const stop of [...routedStops, directShopLink]) {
    stop.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      // A close-triggered Back can still be pending when the user opens another stop.
      if (closingWithBack) deferredStop = stop;
      else openStop(stop);
    });
  }
  window.addEventListener("hashchange", () => {
    routeRequest++;
    closingWithBack = false;
    const stop = deferredStop;
    deferredStop = undefined;
    if (stop) openStop(stop);
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
      if (dialog.open && !dialog.contains(document.activeElement)) {
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

function showShopFallback() {
  shopUnavailable = true;
  shopExperience?.exit();
  const enterButton = document.querySelector("#shop .enter-shop");
  if (enterButton) enterButton.hidden = true;
  if (directShopLink) directShopLink.hidden = true;
  if (decodedHash() === "#shop-interior") redirectToShopDisplay();
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
      activate: (name) => stops.find((stop) => stop.dataset.stop === name)?.click(),
      fail: showFallback,
      startPaused: dialog.open || vendingOpen,
    });
    applySceneLighting(readSceneLighting());
    stage.dataset.webgl = "";
    toolbar.hidden = false;
    if (directShopLink) directShopLink.hidden = false;
    const enterShopButton = document.querySelector(".enter-shop");
    if (enterShopButton) enterShopButton.hidden = false;
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
      button.addEventListener("click", () => street.look(button.dataset.camera));
    }
  } catch {
    showFallback();
  }
}
start();
