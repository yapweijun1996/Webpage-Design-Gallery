window.thowKwangGuide.filter();
const input = document.querySelector("[data-find]");
document.querySelector(".letter-index").addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;
  input.value = "";
  input.dispatchEvent(new Event("input"));
  document.querySelector(link.hash).open = true;
});
