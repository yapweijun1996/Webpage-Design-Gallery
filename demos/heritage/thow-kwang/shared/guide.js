/* Named native disclosures retain their reading order and work without scripting. */
window.thowKwangGuide = {
  diagram() {
    const plate = document.querySelector("[data-kiln]");
    if (!plate) return;
    const panels = [...document.querySelectorAll("details[data-part]")];
    const select = () => {
      plate.dataset.selected = panels.find((p) => p.open)?.dataset.part || "";
    };
    panels.forEach((panel) => panel.addEventListener("toggle", select));
    document.querySelectorAll("a[data-zone]").forEach((link) =>
      link.addEventListener("click", () => {
        const panel = panels.find((item) => item.id === link.dataset.zone);
        if (panel) {
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
