const scenes = document.querySelectorAll(".scene");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let crossing = false;

function focusScene() {
  const scene = document.getElementById(location.hash.slice(1) || "outside");
  scene?.querySelector("h1, h2")?.focus({ preventScroll: true });
}

window.addEventListener("hashchange", focusScene);

for (const scene of scenes) {
  scene.querySelector(".step").addEventListener("click", async (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reducedMotion.matches || !scene.animate) return;

    event.preventDefault();
    if (crossing) return;
    crossing = true;
    const destination = document.querySelector(event.currentTarget.hash);
    try {
      // Timeout guard: animations never finish in a hidden tab, which would strand the visitor.
      const settle = (anim) => Promise.race([anim.finished, new Promise((done) => setTimeout(done, 400))]);
      await settle(scene.animate([{ opacity: 1 }, { opacity: 0.22 }], { duration: 80 }));
      location.hash = destination.id;
      destination.scrollIntoView();
      focusScene();
      await settle(destination.animate([{ opacity: 0.22 }, { opacity: 1 }], { duration: 110 }));
    } finally {
      crossing = false;
    }
  });
}
