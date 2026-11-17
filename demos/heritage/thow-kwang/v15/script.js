const filters = document.querySelector(".desk-filters");
const cards = [...document.querySelectorAll("[data-topic]")];
const count = document.querySelector(".desk-count");
function selectIntent(intent) {
  let visible = 0;
  for (const card of cards) {
    card.hidden = intent !== "all" && card.dataset.topic !== intent;
    if (!card.hidden) visible++;
  }
  for (const button of filters.querySelectorAll("button")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.intent === intent),
    );
  }
  count.textContent = visible + " official destinations";
}
filters.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) selectIntent(button.dataset.intent);
});
filters.hidden = false;
count.hidden = false;
selectIntent("all");
