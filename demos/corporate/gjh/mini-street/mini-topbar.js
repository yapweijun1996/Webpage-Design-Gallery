"use strict";

(() => {
  const themeKey = "gjh-mini-street-site-theme";
  const root = document.documentElement;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let theme = "dark";

  try {
    if (localStorage.getItem(themeKey) === "light") theme = "light";
  } catch {
    // The appearance control also works when storage is unavailable.
  }

  function applyTheme() {
    root.dataset.siteTheme = theme;
    themeColor.content = theme === "light" ? "#fcf7ed" : "#122a24";
  }

  applyTheme();

  document.addEventListener("DOMContentLoaded", () => {
    const controls = document.querySelectorAll(".mini-icon-button");
    for (const control of controls) {
      const resetTip = () => control.removeAttribute("data-tip-dismissed");
      control.addEventListener("pointerenter", resetTip);
      control.addEventListener("focus", resetTip);
    }
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      for (const control of controls) {
        if (control.matches(":hover, :focus-visible")) control.dataset.tipDismissed = "";
      }
    });

    const toggle = document.querySelector("#mini-theme");
    const renderToggle = () => toggle.setAttribute("aria-pressed", String(theme === "dark"));
    renderToggle();
    toggle.disabled = false;

    toggle.addEventListener("click", () => {
      root.dataset.siteThemeReady = "";
      theme = theme === "light" ? "dark" : "light";
      applyTheme();
      renderToggle();
      try {
        localStorage.setItem(themeKey, theme);
      } catch {
        // Keep the selected appearance for this visit.
      }
    });
  }, { once: true });
})();
