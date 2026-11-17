window.thowKwangGuide.checklist();

const check = document.querySelector("[data-party-check]");
const number = check.querySelector("input");
const advice = check.querySelector("output");
const minimum = Number(
  document.querySelector(".team-card strong").firstChild.textContent,
);
number.addEventListener("input", () => {
  const count = number.valueAsNumber;
  if (!number.value && !number.validity.badInput) advice.textContent = "";
  else if (!Number.isSafeInteger(count) || count < 1)
    advice.textContent = "Enter a whole number of at least one.";
  else if (count < minimum)
    advice.textContent =
      "For this group size, explore a self-guided visit or enquire about a private workshop.";
  else
    advice.textContent =
      "Your group meets the tour minimum. Contact the operator to discuss a date.";
});
check.hidden = false;
