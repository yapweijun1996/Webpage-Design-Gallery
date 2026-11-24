const stage = document.querySelector("#stage");
const canvas = document.querySelector("#view");
const toolbar = document.querySelector("#toolbar");
const status = document.querySelector("#scene-status");
const stops = [...document.querySelectorAll("[data-stop]")];
const dialog = document.querySelector("#stop-dialog");
const weather = document.querySelector("#weather");
const sections = [...document.querySelectorAll(".stop-details .detail")];
const vendingSection = document.querySelector("#vending");
let vending;
let vendingOpen = false;

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
let syncRoute = () => {};
let routeRequest = 0;

async function enterShop() {
  if (!street || decodedHash() !== "#shop-interior") return;
  try {
    if (!shopExperience) {
      shopLoading ||= import("./shop-experience.js").then(({createShopExperience}) =>
        createShopExperience({street, stage, toolbar, onExit: () => {
          if (decodedHash() !== "#shop-interior") return;
          if (history.state?.__gjhMiniStreetStop) history.back();
          else {
            const url = new URL(location.href);
            url.hash = "shop";
            history.replaceState(history.state, "", url);
            syncRoute();
          }
        }}));
      shopExperience = await shopLoading;
    }
    if (decodedHash() === "#shop-interior") shopExperience.enter();
  } catch (error) {
    if (decodedHash() !== "#shop-interior") return;
    console.error("Could not enter the 3D shop", error);
    shopLoading = undefined;
    const enterButton = document.querySelector("#shop .enter-shop");
    if (enterButton) enterButton.hidden = true;
    enableFallbackShopping();
    status.textContent = "The 3D shop could not load. The product display remains available.";
    const url = new URL(location.href);
    url.hash = "shop";
    history.replaceState(history.state, "", url);
    syncRoute();
  }
}

if (typeof dialog.showModal === "function") {
  const sectionsByHash = new Map(sections.map((section) => [`#${section.id}`, section]));
  const historyMarker = "__gjhMiniStreetStop";
  let pendingOpener = null;
  let closingWithBack = false;
  let deferredStop;
  let previousFocus;
  let activeSection;
  dialog.append(...sections);
  const enter = document.createElement("button");
  enter.type = "button";
  enter.hidden = !street;
  enter.className = "enter-shop";
  enter.textContent = "Enter 3D shop";
  enter.addEventListener("click", () => {
    if (!street) return;
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
      closeStop(false);
      enterShop();
      return;
    }
    shopExperience?.exit();
    const selected = sectionsByHash.get(hash);
    const opener = pendingOpener || stops.find((stop) => stop.hash === hash);
    pendingOpener = null;
    if (!selected) {
      closeStop(false);
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
    pendingOpener = stop;
    if (decodedHash() !== stop.hash) {
      const previousState = history.state;
      const state = previousState && typeof previousState === "object" && !Array.isArray(previousState)
        ? {...previousState} : {};
      state[historyMarker] = true;
      history.pushState(state, "", stop.hash);
    }
    syncLocation();
  }

  for (const stop of stops.filter((link) => sectionsByHash.has(link.hash))) {
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
  fallbackShopping = import("./basket.js").then(({createShopBasket}) => {
    const host = document.querySelector(".masthead-inner");
    const basket = createShopBasket({host});
    const shop = document.querySelector("#shop");
    const add = document.createElement("button");
    add.type = "button";
    add.className = "enter-shop";
    add.textContent = "Add Australian abalone to basket";
    const message = document.createElement("p");
    message.setAttribute("role", "status");
    add.addEventListener("click", () => {
      if (basket.add("au-425g", {})) {
        message.textContent = "Added. Close this display to view your basket.";
      }
    });
    shop.querySelector(".pack-list").after(add, message);
    return basket;
  }).catch(error => {
    console.error("Could not load the virtual basket", error);
  });
  return fallbackShopping;
}

const showFallback = () => {
  shopExperience?.exit();
  const enterButton = document.querySelector("#shop .enter-shop");
  if (enterButton) enterButton.hidden = true;
  if (decodedHash() === "#shop-interior") {
    const url = new URL(location.href);
    url.hash = "shop";
    history.replaceState(history.state, "", url);
    syncRoute();
  }
  enableFallbackShopping();
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
    stage.dataset.webgl = "";
    toolbar.hidden = false;
    const enterShopButton = document.querySelector(".enter-shop");
    if (enterShopButton) enterShopButton.hidden = false;
    syncRoute();
    status.textContent = "3D street ready. Drag the street or use the camera controls.";

    for (const button of toolbar.querySelectorAll("[data-light]")) {
      button.addEventListener("click", () => {
        const night = button.dataset.light === "night";
        street.setNight(night);
        weather.textContent = night ? "Rainy evening" : "After the rain";
        for (const option of toolbar.querySelectorAll("[data-light]")) {
          option.setAttribute("aria-pressed", String(option === button));
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
