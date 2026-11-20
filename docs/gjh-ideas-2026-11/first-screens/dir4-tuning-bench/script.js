(() => {
  const stage = document.querySelector(".stage");
  const selector = stage.querySelector("fieldset");
  const radios = [...selector.querySelectorAll("input")];
  const activities = document.querySelector("#activities");
  const stops = radios.map(input => document.getElementById(input.value));
  const still = document.querySelector("#still");
  const selectedStill = activities.querySelector("img");
  const title = document.querySelector("#headline");
  const category = document.querySelector("#category");
  const destination = stage.querySelector(".destination");
  const entry = {title: title.textContent, src: still.src, alt: still.alt};
  let current = -1;
  let drag = null;

  function pointTo(index) {
    const angle = index < 0 ? 0 : -66 + index * 44;
    stage.style.setProperty("--angle", angle + "deg");
  }

  function show(index) {
    current = index;
    const section = stops[index];
    const image = section ? selectedStill : entry;
    if (still.src !== image.src) still.src = image.src;
    still.alt = image.alt;
    title.textContent = section ? section.querySelector("h2").textContent : entry.title;
    category.textContent = section ? section.querySelector("p").textContent : "";
    category.hidden = destination.hidden = !section;
    if (section) {
      const link = section.querySelector("a");
      destination.textContent = link.textContent;
      destination.href = link.href;
    } else {
      destination.removeAttribute("href");
    }
    radios.forEach((input, i) => { input.checked = i === index; });
    pointTo(index);
  }

  function commit(index) {
    show(index);
    const hash = "#" + radios[index].value;
    if (location.hash !== hash) history.pushState(null, "", hash);
  }

  function restore() {
    show(radios.findIndex(input => "#" + input.value === location.hash));
  }

  selector.addEventListener("change", event => {
    const index = radios.indexOf(event.target);
    if (index >= 0) commit(index);
  });
  window.addEventListener("hashchange", restore);
  window.addEventListener("pageshow", restore);

  function begin(event) {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    drag = {id: event.pointerId, start: event.clientX, index: current};
    event.currentTarget.setPointerCapture(event.pointerId);
    stage.classList.add("dragging");
  }

  function move(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const steps = Math.round((event.clientX - drag.start) / 28);
    if (steps === 0) drag.index = current;
    else if (current < 0) drag.index = steps > 0 ? Math.min(3, steps - 1) : Math.max(0, 4 + steps);
    else drag.index = Math.max(0, Math.min(3, current + steps));
    pointTo(drag.index);
  }

  function end(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (event.type === "pointerup") {
      move(event);
      if (drag.index >= 0 && drag.index !== current) commit(drag.index);
    }
    drag = null;
    pointTo(current);
    stage.classList.remove("dragging");
  }

  for (const handle of [stage.querySelector(".visual"), stage.querySelector(".mini-dial")]) {
    handle.addEventListener("pointerdown", begin);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
    handle.addEventListener("lostpointercapture", end);
  }

  restore();
  activities.hidden = true;
  stage.querySelector(".fallback-link").hidden = true;
  selector.hidden = false;
  stage.classList.add("enhanced");
})();
