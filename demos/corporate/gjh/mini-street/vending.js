export const drinks = [
  { code: "A1", name: "Lime Soda", label: "LIME", color: "#9fce63", shape: "can" },
  { code: "A2", name: "Peach Tea", label: "PEACH", color: "#f2a65f", shape: "bottle" },
  { code: "A3", name: "Berry Fizz", label: "BERRY", color: "#d17dae", shape: "can" },
  { code: "B1", name: "Ginger Ale", label: "GINGER", color: "#efc76a", shape: "can" },
  { code: "B2", name: "Still Water", label: "WATER", color: "#7dd1ea", shape: "bottle" },
  { code: "B3", name: "Lemon Tea", label: "LEMON", color: "#d9d875", shape: "bottle" },
];

const DROP_DURATION = 880;

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
  const dialog = section.closest("dialog");
  const machine = section.querySelector(".vending-machine");
  const stock = machine.querySelector(".vending-stock");
  const message = machine.querySelector(".vending-message");
  const serve = machine.querySelector(".vending-serve");
  const tray = machine.querySelector(".vending-tray");
  const pocket = tray.querySelector(".vending-pocket");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let selection = -1;
  let flight;
  let animation;
  let settleTimer;
  let startedAt;
  let viewer;
  let viewerRequest = 0;
  let opened = false;

  function syncViewer() {
    viewer?.setState({ phase: machine.dataset.phase, selection, startedAt });
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
    slot.addEventListener("click", () => {
      selection = index;
      setPhase("selected", `${drink.code} · ${drink.name}`);
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
    pocket.replaceChildren();
    selection = -1;
    setPhase("idle", text);
  }

  function deliver(drink) {
    clearFlight();
    pocket.append(drinkArt(drink));
    setPhase("ready", `${drink.name} ready in the tray`);
    if (document.activeElement === serve) tray.focus();
  }

  serve.addEventListener("click", () => {
    if (machine.dataset.phase !== "selected") return;
    const drink = drinks[selection];
    const source = slots[selection].querySelector(".drink-art");
    startedAt = performance.now();
    setPhase("dispensing", `Dispensing ${drink.name}…`);
    if (motion.matches) {
      deliver(drink);
      return;
    }
    if (viewer) {
      settleTimer = setTimeout(() => deliver(drink), DROP_DURATION);
      return;
    }
    if (typeof source.animate !== "function") {
      deliver(drink);
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
      { offset: 0.22, transform: "translate(2px, -3px) rotate(12deg)", easing: "cubic-bezier(.55, .05, .87, .58)" },
      { offset: 0.76, transform: `translate(${x}px, ${y + 4}px) rotate(91deg)`, easing: "ease-out" },
      { offset: 0.89, transform: `translate(${x - 3}px, ${y - 6}px) rotate(72deg)`, easing: "ease-in" },
      { offset: 1, transform: `translate(${x}px, ${y}px) rotate(82deg)` },
    ], { duration: DROP_DURATION, fill: "forwards" });
    animation = drop;
    function settleDrop() {
      if (animation === drop) deliver(drink);
    }
    // Some browsers may leave a newly created animation pending indefinitely.
    // Finish the transaction even if the compositor never starts it.
    settleTimer = setTimeout(settleDrop, 1600);
    drop.finished.then(settleDrop, settleDrop);
  });

  tray.addEventListener("click", () => {
    if (machine.dataset.phase !== "ready") return;
    const index = selection;
    reset("Collected. Choose again.");
    if (document.activeElement === tray) slots[index].focus();
  });

  motion.addEventListener?.("change", () => {
    if (motion.matches && machine.dataset.phase === "dispensing") deliver(drinks[selection]);
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
        drinks, motion, dropDuration: DROP_DURATION, onFailure: () => releaseViewer(true),
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

  reset();
  machine.hidden = false;
  section.querySelector("#vending-note").hidden = true;
  section.querySelector("#vending-instructions").hidden = false;
  return { open, close };
}
