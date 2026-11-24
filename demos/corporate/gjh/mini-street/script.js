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

if (typeof dialog.showModal === "function") {
  const sectionsByHash = new Map(sections.map((section) => [`#${section.id}`, section]));
  const historyMarker = "__gjhMiniStreetStop";
  let pendingOpener = null;
  let closingWithBack = false;
  let deferredStop;
  let previousFocus;
  let activeSection;
  dialog.append(...sections);

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

  function openStop(stop) {
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

const showFallback = () => {
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
