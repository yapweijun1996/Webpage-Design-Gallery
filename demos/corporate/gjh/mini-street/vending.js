import { createVendingAudio } from "./vending-audio.js";
import { CHUTE_CONTACT, RELEASE, TRAY_IMPACT, TRAY_RATTLE, VEND_DURATION } from "./vending-sequence.js";

export const drinks = [
  { code: "A1", name: "Lime Soda", label: "LIME", color: "#9fce63", shape: "can" },
  { code: "A2", name: "Peach Tea", label: "PEACH", color: "#f2a65f", shape: "bottle" },
  { code: "A3", name: "Berry Fizz", label: "BERRY", color: "#d17dae", shape: "can" },
  { code: "B1", name: "Ginger Ale", label: "GINGER", color: "#efc76a", shape: "can" },
  { code: "B2", name: "Still Water", label: "WATER", color: "#7dd1ea", shape: "bottle" },
  { code: "B3", name: "Lemon Tea", label: "LEMON", color: "#d9d875", shape: "bottle" },
];

function drinkArt({ label, color, shape }) {
  const art = document.createElement("span");
  art.className = "drink-art";
  art.dataset.shape = shape;
  art.dataset.label = label;
  art.style.setProperty("--drink-color", color);
  art.setAttribute("aria-hidden", "true");
  return art;
}

export function setupVending(section) {
  const layout = section.querySelector(".vending-layout");
  const preview = layout.querySelector(".vending-viewer");
  const viewport = preview.querySelector(".vending-orbit");
  const guide = section.querySelector(".vending-guide");
  const soundButton = guide.querySelector(".vending-sound");
  const dialog = section.closest("dialog");
  const machine = section.querySelector(".vending-machine");
  const stock = machine.querySelector(".vending-stock");
  const message = machine.querySelector(".vending-message");
  const serve = machine.querySelector(".vending-serve");
  const tray = machine.querySelector(".vending-tray");
  const pocket = tray.querySelector(".vending-pocket");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const sound = createVendingAudio();
  let soundRequest = 0;
  let selection = -1;
  let flight;
  let animation;
  let settleTimer;
  let startedAt;
  let viewer;
  let viewerRequest = 0;
  let opened = false;
  let showDropInViewer = false;

  function canSeeViewer() {
    if (!viewer) return false;
    const view = viewport.getBoundingClientRect();
    const bounds = dialog?.open ? dialog.getBoundingClientRect() : view;
    const screen = window.visualViewport;
    const top = Math.max(view.top, bounds.top, screen?.offsetTop ?? 0);
    const bottom = Math.min(view.bottom, bounds.bottom, screen ? screen.offsetTop + screen.height : window.innerHeight);
    return view.height > 0 && bottom - top >= view.height * 0.72;
  }

  function syncViewer() {
    viewer?.setState({ phase: machine.dataset.phase, selection, startedAt, showDropInViewer });
  }

  function setPhase(phase, text) {
    machine.dataset.phase = phase;
    message.textContent = text;
    serve.setAttribute("aria-disabled", String(phase !== "selected"));
    tray.setAttribute("aria-disabled", String(phase !== "ready"));
    for (const [index, slot] of slots.entries()) {
      slot.setAttribute("aria-pressed", String(index === selection));
      slot.disabled = phase === "dispensing" || phase === "ready";
    }
    syncViewer();
  }

  const slots = drinks.map((drink, index) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "vending-slot";
    slot.dataset.slot = drink.code;
    const code = document.createElement("span");
    code.className = "vending-code";
    code.textContent = drink.code;
    const name = document.createElement("span");
    name.className = "vending-drink-name";
    name.textContent = drink.name;
    slot.append(drinkArt(drink), code, name);
    slot.addEventListener("click", (event) => {
      selection = index;
      setPhase("selected", `${drink.code} · ${drink.name}`);
      if (event.isTrusted) sound.play("select");
    });
    return slot;
  });
  stock.append(...slots);

  function clearFlight() {
    clearTimeout(settleTimer);
    settleTimer = undefined;
    animation?.cancel();
    animation = undefined;
    flight?.remove();
    flight = undefined;
    startedAt = undefined;
  }

  function reset(text = "Choose a drink") {
    clearFlight();
    sound.stop();
    pocket.replaceChildren();
    delete machine.dataset.localVend;
    selection = -1;
    showDropInViewer = false;
    setPhase("idle", text);
  }

  function deliver(drink) {
    clearFlight();
    pocket.append(drinkArt(drink));
    setPhase("ready", `${drink.name} ready in the tray`);
    if (document.activeElement === serve) tray.focus();
  }

  serve.addEventListener("click", (event) => {
    if (machine.dataset.phase !== "selected") return;
    const drink = drinks[selection];
    const source = slots[selection].querySelector(".drink-art");
    showDropInViewer = canSeeViewer();
    const animate = !motion.matches && (showDropInViewer || typeof source.animate === "function");
    if (!showDropInViewer || motion.matches) machine.dataset.localVend = "";
    startedAt = performance.now();
    setPhase("dispensing", `Dispensing ${drink.name}…`);
    if (event.isTrusted) sound.play("vend", { bottle: drink.shape === "bottle", reducedMotion: !animate });
    if (!animate) {
      deliver(drink);
      return;
    }
    if (showDropInViewer) {
      settleTimer = setTimeout(() => deliver(drink), VEND_DURATION);
      return;
    }

    const cabinet = machine.getBoundingClientRect();
    const origin = source.getBoundingClientRect();
    const destination = pocket.getBoundingClientRect();
    const x = destination.left + (destination.width - origin.width) / 2 - origin.left;
    const y = destination.top + (destination.height - origin.height) / 2 - origin.top;
    flight = drinkArt(drink);
    flight.classList.add("vending-flight");
    flight.style.left = `${origin.left - cabinet.left - machine.clientLeft}px`;
    flight.style.top = `${origin.top - cabinet.top - machine.clientTop}px`;
    machine.append(flight);
    const drop = flight.animate([
      { offset: 0, transform: "translate(0, 0) rotate(0)" },
      { offset: 0.12, transform: "translate(0, 0) rotate(0)", easing: "ease-in-out" },
      { offset: RELEASE, transform: "translate(4px, 3px) rotate(12deg)", easing: "cubic-bezier(.45, .03, .84, .51)" },
      { offset: CHUTE_CONTACT, transform: `translate(${x * 0.63}px, ${y * 0.53}px) rotate(51deg)`, easing: "ease-in" },
      { offset: TRAY_IMPACT, transform: `translate(${x - 6}px, ${y + 1}px) rotate(96deg)`, easing: "ease-out" },
      { offset: TRAY_RATTLE, transform: `translate(${x - 2}px, ${y - 5}px) rotate(77deg)`, easing: "ease-in" },
      { offset: 1, transform: `translate(${x}px, ${y}px) rotate(82deg)` },
    ], { duration: VEND_DURATION, fill: "forwards" });
    animation = drop;
    function settleDrop() {
      if (animation === drop) deliver(drink);
    }
    // Some browsers may leave a newly created animation pending indefinitely.
    // Finish the transaction even if the compositor never starts it.
    settleTimer = setTimeout(settleDrop, VEND_DURATION + 640);
    drop.finished.then(settleDrop, settleDrop);
  });

  tray.addEventListener("click", (event) => {
    if (machine.dataset.phase !== "ready") return;
    const index = selection;
    reset("Collected. Choose again.");
    if (event.isTrusted) sound.play("collect", { bottle: drinks[index].shape === "bottle" });
    if (document.activeElement === tray) slots[index].focus();
  });

  motion.addEventListener?.("change", () => {
    if (!motion.matches || machine.dataset.phase !== "dispensing") return;
    machine.dataset.localVend = "";
    sound.stop();
    deliver(drinks[selection]);
  });

  soundButton.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    const request = ++soundRequest;
    const enabled = soundButton.getAttribute("aria-pressed") !== "true";
    soundButton.setAttribute("aria-pressed", String(enabled));
    const active = await sound.setEnabled(enabled);
    if (request === soundRequest) soundButton.setAttribute("aria-pressed", String(active));
  });

  function releaseViewer(restoreFocus = false) {
    const hadFocus = preview.contains(document.activeElement);
    viewer?.dispose();
    viewer = undefined;
    preview.hidden = true;
    delete layout.dataset.viewer;
    dialog?.removeAttribute("data-vending-viewer");
    if (restoreFocus && hadFocus) section.querySelector("h2").focus();
  }

  async function loadViewer() {
    const request = ++viewerRequest;
    try {
      const { createVendingViewer } = await import("./vending-viewer.js");
      if (request !== viewerRequest) return;
      viewer = createVendingViewer(preview, {
        drinks, motion, onFailure: () => releaseViewer(true),
      });
      preview.hidden = false;
      layout.dataset.viewer = "ready";
      dialog?.setAttribute("data-vending-viewer", "");
      syncViewer();
    } catch {
      if (request === viewerRequest) releaseViewer(true);
    }
  }

  function open() {
    if (opened) return;
    opened = true;
    loadViewer();
  }

  function close() {
    opened = false;
    viewerRequest += 1;
    releaseViewer();
    reset();
  }

  window.addEventListener("pagehide", () => {
    viewerRequest += 1;
    releaseViewer();
    reset();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && opened) loadViewer();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) sound.stop();
  });

  reset();
  machine.hidden = false;
  section.querySelector("#vending-note").hidden = true;
  guide.hidden = false;
  soundButton.hidden = !sound.available;
  return { open, close };
}
