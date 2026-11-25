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
