/* Named native disclosures retain their reading order and work without scripting. */
window.thowKwangGuide = {
  diagram() {
    const plate = document.querySelector("[data-kiln]");
    if (!plate) return;
    const panels = [...document.querySelectorAll("details[data-part]")];
    const caption = plate.querySelector("[data-kiln-caption]");
    const select = () => {
      const active = panels.find((panel) => panel.open);
      plate.dataset.selected = active?.dataset.part || "";
      caption.hidden = !active;
      if (active) {
        caption.querySelector("strong").textContent =
          active.querySelector("summary").textContent;
        caption.querySelector("p").textContent =
          active.querySelector("div").textContent;
      }
      for (const pin of plate.querySelectorAll("[data-zone]")) {
        if (pin.dataset.zone === plate.dataset.selected)
          pin.setAttribute("aria-current", "true");
        else pin.removeAttribute("aria-current");
      }
    };
    panels.forEach((panel) => panel.addEventListener("toggle", select));
    document.querySelectorAll("a[data-zone]").forEach((link) =>
      link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        const panel = panels.find((item) => item.id === link.dataset.zone);
        if (panel) {
          event.preventDefault();
          panels.forEach((item) => {
            item.open = item === panel;
          });
          select();
        }
      }),
    );
    select();
  },
  filter() {
    const field = document.querySelector("[data-find]");
    if (!field) return;
    const rows = [...document.querySelectorAll("[data-term]")];
    field.parentElement.hidden = false;
    field.addEventListener("input", () => {
      const term = field.value.trim().toLowerCase();
      rows.forEach((row) => {
        row.hidden = !row.textContent.toLowerCase().includes(term);
      });
      const count = rows.filter((row) => !row.hidden).length;
      document.querySelector("[role=status]").textContent = count
        ? count + (count === 1 ? " entry shown" : " entries shown")
        : "No entries match. Try another word.";
    });
  },
  checklist() {
    const boxes = [...document.querySelectorAll(".checks input")];
    const output = document.querySelector("[data-progress]");
    if (!output) return;
    output.hidden = false;
    const update = () => {
      output.textContent =
        boxes.filter((box) => box.checked).length +
        " of " +
        boxes.length +
        " marked";
    };
    boxes.forEach((box) => box.addEventListener("change", update));
    update();
  },
};
