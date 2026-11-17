const field = document.querySelector("#field-note");
const save = document.querySelector("[data-save-note]");
const status = document.querySelector("[data-note-status]");
save.hidden = false;
save.disabled = true;
field.addEventListener("input", () => {
  save.disabled = !field.value.trim();
  status.textContent = "";
});
save.addEventListener("click", () => {
  const note = new Blob(
    ["Pottery observation\n\n" + field.value.trim() + "\n"],
    { type: "text/plain;charset=utf-8" },
  );
  const url = URL.createObjectURL(note);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pottery-field-note.txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  status.textContent = "Your text file is ready to download.";
});
