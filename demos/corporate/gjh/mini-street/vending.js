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

  function setPhase(phase, text) {
    machine.dataset.phase = phase;
    message.textContent = text;
    serve.setAttribute("aria-disabled", String(phase !== "selected"));
    tray.setAttribute("aria-disabled", String(phase !== "ready"));
    for (const [index, slot] of slots.entries()) {
      slot.setAttribute("aria-pressed", String(index === selection));
      slot.disabled = phase === "dispensing" || phase === "ready";
    }
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
    setPhase("dispensing", `Dispensing ${drink.name}…`);
    if (motion.matches || typeof source.animate !== "function") {
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
    ], { duration: 880, fill: "forwards" });
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
  window.addEventListener("pagehide", () => reset());

  reset();
  machine.hidden = false;
  section.querySelector("#vending-note").hidden = true;
  section.querySelector("#vending-instructions").hidden = false;
  return { reset };
}
