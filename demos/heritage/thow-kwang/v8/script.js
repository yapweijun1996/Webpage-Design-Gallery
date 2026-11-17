const card = document.querySelector("[data-clue-card]");
const prompts = [...document.querySelectorAll("#game details")];
let current = 0;
function showClue() {
  const prompt = prompts[current];
  card.querySelector("[data-clue-title]").textContent =
    prompt.querySelector("summary").textContent;
  card.querySelector("[data-clue]").textContent =
    prompt.querySelector("div").textContent;
}
card.querySelector("[data-next-clue]").addEventListener("click", () => {
  current = (current + 1) % prompts.length;
  showClue();
});
showClue();
card.querySelector("[data-clue]").setAttribute("aria-live", "polite");
card.hidden = false;
