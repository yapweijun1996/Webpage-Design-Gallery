const stage = document.querySelector("#stage");
const canvas = document.querySelector("#view");
const toolbar = document.querySelector("#toolbar");
const status = document.querySelector("#scene-status");
const stops = [...document.querySelectorAll("[data-stop]")];
const dialog = document.querySelector("#stop-dialog");
const weather = document.querySelector("#weather");
const sections = [...document.querySelectorAll(".stop-details .detail")];
const capsules = [...document.querySelectorAll("[data-vend]")];
const result = document.querySelector(".vending-result");
const keepsakes = {
  cloud: "A tiny blue cloud charm.",
  leaf: "A pink blossom token.",
  star: "A little gold paper star.",
};

let previousFocus;
let street;

if (typeof dialog.showModal === "function") {
  const sectionsByHash = new Map(sections.map((section) => [`#${section.id}`, section]));
  const historyMarker = "__gjhMiniStreetStop";
  let pendingOpener = null;
  function decodedHash() {
    try { return decodeURIComponent(location.hash); }
    catch { return ""; }
  }
  dialog.append(...sections);

  function syncLocation() {
    const hash = decodedHash();
    const selected = sectionsByHash.get(hash);
    if (!selected) {
      pendingOpener = null;
      if (dialog.open) dialog.close();
      return;
    }
    previousFocus = pendingOpener || stops.find((stop) => stop.hash === hash);
    pendingOpener = null;
    if (dialog.open && !selected.hidden) return;
    for (const section of sections) section.hidden = section !== selected;
    dialog.setAttribute("aria-labelledby", selected.getAttribute("aria-labelledby"));
    result.textContent = "";
    for (const capsule of capsules) capsule.setAttribute("aria-pressed", "false");
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    street?.setPaused(true);
    selected.querySelector("h2").focus();
  }

  for (const stop of stops.filter((link) => sectionsByHash.has(link.hash))) {
    stop.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      pendingOpener = stop;
      if (decodedHash() !== stop.hash) {
        const previousState = history.state;
        const state = previousState && typeof previousState === "object" && !Array.isArray(previousState)
          ? {...previousState} : {};
        state[historyMarker] = true;
        history.pushState(state, "", stop.hash);
      }
      syncLocation();
    });
  }
  window.addEventListener("hashchange", syncLocation);
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    if (sectionsByHash.has(decodedHash())) {
      if (history.state?.[historyMarker]) history.back();
      else {
        const url = new URL(location.href);
        url.hash = "";
        history.replaceState(history.state, "", url);
      }
    }
    street?.setPaused(false);
    previousFocus?.focus();
  });
  for (const link of dialog.querySelectorAll(".back")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      dialog.close();
    });
  }
  syncLocation();
  if (document.readyState !== "complete") {
    window.addEventListener("load", () => requestAnimationFrame(() => {
      if (dialog.open && !dialog.contains(document.activeElement)) {
        dialog.querySelector(".detail:not([hidden]) h2")?.focus();
      }
    }), {once: true});
  }
}

document.querySelector("#vending-note").hidden = true;
document.querySelector("#vending-instructions").hidden = false;
document.querySelector(".capsules").hidden = false;
result.hidden = false;
for (const capsule of capsules) {
  capsule.setAttribute("aria-pressed", "false");
  capsule.addEventListener("click", () => {
    for (const button of capsules) button.setAttribute("aria-pressed", String(button === capsule));
    result.textContent = keepsakes[capsule.dataset.vend];
  });
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
    });
    stage.dataset.webgl = "";
    toolbar.hidden = false;
    status.textContent = "3D street ready. Drag the street or use the camera controls.";
    street.setPaused(dialog.open);

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
