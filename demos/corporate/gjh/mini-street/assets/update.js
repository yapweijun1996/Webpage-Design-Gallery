const updateParameter = "mini-street-update";
const timeout = 8000;
const releaseURL = new URL("../release.json", import.meta.url);
const icons = {
  idle: "M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2",
  checking: "M20 12a8 8 0 1 1-8-8",
  current: "m5 12 4 4L19 6",
  available: "M12 4v12m-5-5 5 5 5-5M5 20h14",
  offline: "M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0m-3 4h.01M3 3l18 18",
  error: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 5v5m0 3h.01",
};

const labels = {
  idle: ["update.check", "Check for updates"],
  checking: ["update.checking", "Checking for updates…"],
  current: ["update.check", "Check for updates"],
  available: ["update.apply", "Apply update"],
  applying: ["update.applying", "Applying update…"],
  offline: ["update.check", "Check for updates"],
  error: ["update.check", "Check for updates"],
};

function validRelease(release) {
  return typeof release?.version === "string" && /^\d+\.\d+\.\d+$/.test(release.version) &&
    typeof release.build === "string" && /^[0-9a-f]{16}$/.test(release.build);
}

function pageRelease(document) {
  const release = {
    version: document.querySelector('meta[name="mini-street-version"]')?.content,
    build: document.querySelector('meta[name="mini-street-build"]')?.content,
  };
  return validRelease(release) ? release : null;
}

function sameRelease(first, second) {
  return first?.build === second?.build && first?.version === second?.version;
}

function renderBuild(release) {
  return `v${release.version} · ${release.build.slice(0, 8)}`;
}

async function verifyLatest(view, page, cacheKey, abort) {
  const manifest = new URL(releaseURL);
  manifest.searchParams.set("check", cacheKey);
  const timer = view.setTimeout(() => abort.abort(), timeout);
  const request = async (url) => {
    const response = await view.fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: abort.signal,
    });
    if (!response.ok) throw new Error("Update information unavailable.");
    return response;
  };
  try {
    const [release, html] = await Promise.all([
      request(manifest).then((response) => response.json()),
      request(page).then((response) => response.text()),
    ]);
    const remote = new view.DOMParser().parseFromString(html, "text/html");
    if (!validRelease(release) || !sameRelease(release, pageRelease(remote))) {
      throw new Error("The published page and release information disagree.");
    }
    return release;
  } finally {
    view.clearTimeout(timer);
    abort.abort();
  }
}

const englishText = (_, text, values = {}) => text.replace(/\{(\w+)\}/g,
  (placeholder, key) => values[key] ?? placeholder);

export function initMiniUpdate({ button, version, status, translate = englishText }) {
  if (!button || !version || !status) return;
  const document = button.ownerDocument;
  const view = document.defaultView;
  const label = button.querySelector("[data-update-label]");
  const path = button.querySelector("path[data-update-icon]");
  const styles = [...document.querySelectorAll("link[data-mini-street-style]")];
  const haveStyles = styles.length > 0 && styles.every((link) => link.sheet);
  const current = haveStyles ? pageRelease(document) : null;
  let available;
  let activeRequest;
  let state = "idle";
  let message;

  function refresh() {
    const action = translate(...labels[state]);
    const busy = Boolean(activeRequest);
    button.dataset.state = state;
    button.setAttribute("aria-label", action);
    button.setAttribute("aria-busy", String(busy));
    button.setAttribute("aria-disabled", String(button.disabled || busy));
    if (label) label.textContent = action;
    path?.setAttribute("d", icons[state] ?? icons.checking);
    version.textContent = current ? renderBuild(current) : translate("update.unavailableBuild", "Build unavailable");
    version.title = current ? `v${current.version} · ${current.build}` : version.textContent;
    status.textContent = message ? translate(...message) : "";
  }

  function show(next, key, english, values) {
    state = next;
    message = key ? [key, english, values] : undefined;
    refresh();
  }

  function cancelCheck() {
    activeRequest?.abort();
    activeRequest = undefined;
  }

  function offline() {
    cancelCheck();
    available = undefined;
    show("offline", "update.offline", "You are offline. Reconnect to check for updates.");
  }

  function verifyNavigation() {
    const url = new URL(view.location.href);
    const expected = url.searchParams.get(updateParameter)?.split(".")[0];
    if (!/^[0-9a-f]{16}$/.test(expected ?? "")) return false;
    url.searchParams.delete(updateParameter);
    view.history.replaceState(view.history.state, "", url);
    if (current?.build === expected) {
      show("current", "update.applied", "Updated to {build}.", { build: renderBuild(current) });
    } else {
      show("error", "update.applyFailed", "The new build did not load. Check again to retry.");
    }
    return true;
  }

  view.addEventListener("mini:languagechange", refresh);
  if (!current) {
    button.disabled = true;
    show("error", "update.unavailable", "Updates are unavailable in this preview.");
    return refresh;
  }

  button.disabled = false;
  if (!verifyNavigation()) {
    if (view.navigator.onLine) refresh();
    else offline();
  }
  view.addEventListener("offline", offline);
  view.addEventListener("online", () => {
    if (state === "offline") show("idle");
  });
  view.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    available = undefined;
    cancelCheck();
    if (view.navigator.onLine) show("idle");
    else offline();
  });

  button.addEventListener("click", async () => {
    if (activeRequest) return;
    if (!view.navigator.onLine) {
      offline();
      return;
    }
    const applying = available;
    if (applying && document.querySelector(".mini-basket-saving:not([hidden])") &&
      document.querySelector(".mini-basket-items:not([hidden])")) {
      show("available", "update.unsavedBasket", "Your basket is saved for this visit only. Keep this page open to retain it.");
      return;
    }
    available = undefined;
    const request = activeRequest = new view.AbortController();
    show(...(applying
      ? ["applying", "update.applying", "Applying update…"]
      : ["checking", "update.checking", "Checking for updates…"]));
    const page = new URL(view.location.href);
    const cacheKey = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    page.searchParams.set(updateParameter, applying ? `${applying.build}.${cacheKey}` : cacheKey);
    try {
      const latest = await verifyLatest(view, page, cacheKey, request);
      if (activeRequest !== request) return;
      if (!view.navigator.onLine) {
        offline();
      } else if (applying && sameRelease(applying, latest)) {
        view.location.replace(page);
      } else if (current.build === latest.build) {
        show("current", "update.current", "Mini Street is up to date.");
      } else {
        available = latest;
        show("available", "update.available", "Update available · {build}", { build: renderBuild(latest) });
      }
    } catch {
      if (activeRequest !== request) return;
      if (view.navigator.onLine) show("error", "update.failed", "The update could not be verified. Check again shortly.");
      else offline();
    } finally {
      if (activeRequest === request) {
        activeRequest = undefined;
        refresh();
      }
    }
  });
  return refresh;
}
