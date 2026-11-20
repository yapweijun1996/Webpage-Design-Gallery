function m09InitDeck() {
  const viewer = document.querySelector("#m09 .m09-viewer");
  if (!viewer || viewer.dataset.m09Ready) return;
  viewer.dataset.m09Ready = "true";

  const slides = [...viewer.querySelectorAll(".m09-slide")];
  const previous = viewer.querySelector(".m09-prev");
  const next = viewer.querySelector(".m09-next");
  const fullscreen = viewer.querySelector(".m09-fullscreen");
  const counter = viewer.querySelector(".m09-counter");
  const slideName = counter.querySelector(".m09-sr");
  const message = viewer.querySelector(".m09-message");
  let current = 0;

  function turnPage(step) {
    const target = current + step;
    if (target < 0 || target >= slides.length) return;

    slides[current].hidden = true;
    current = target;
    slides[current].hidden = false;
    counter.firstChild.nodeValue = `${current + 1} / ${slides.length}`;
    slideName.textContent = `，${slides[current].querySelector("h3").textContent}`;
    previous.setAttribute("aria-disabled", String(current === 0));
    next.setAttribute("aria-disabled", String(current === slides.length - 1));
  }

  previous.addEventListener("click", () => turnPage(-1));
  next.addEventListener("click", () => turnPage(1));

  viewer.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      turnPage(event.key === "ArrowLeft" ? -1 : 1);
    }
  });

  fullscreen.addEventListener("click", async () => {
    message.hidden = true;
    try {
      if (document.fullscreenElement === viewer) {
        await document.exitFullscreen();
      } else {
        await viewer.requestFullscreen();
      }
    } catch {
      message.textContent = "当前无法切换全屏。";
      message.hidden = false;
    }
  });

  document.addEventListener("fullscreenchange", () => {
    fullscreen.textContent = document.fullscreenElement === viewer ? "退出全屏" : "全屏";
  });
}

document.addEventListener("gjh:ready", m09InitDeck);
if (window.GJH_READY) m09InitDeck();
