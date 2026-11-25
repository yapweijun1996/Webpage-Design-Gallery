import { miniMessages, miniPatterns } from "./mini-i18n-copy.js";

const storageKey = "wdg.language";
const languages = new Map([
  ["en", "English"],
  ["zh-Hans", "简体中文"],
  ["ms", "Bahasa Melayu"],
]);
const messages = new Map(miniMessages.map(([source, zh, ms]) => [source, {"zh-Hans": zh, ms}]));
const attributes = ["aria-label", "alt", "title", "placeholder", "content"];
const attributeSelector = '[aria-label], [alt], [title], [placeholder], meta[name="description"]';
const excluded = 'script, style, noscript, textarea, template, [translate="no"]';
const originals = new WeakMap();
const basketSaving = "Browser saving is unavailable. Your selections are kept until you leave this page.";
let language = getMiniLanguage();
let initialized = false;

export function getMiniLanguage() {
  try {
    const choice = localStorage.getItem(storageKey);
    return languages.has(choice) ? choice : "en";
  } catch {
    return "en";
  }
}

function exactCopy(source) {
  return messages.get(source)?.[language] ?? source;
}

function translateText(source) {
  if (language === "en" || !source.trim()) return source;
  const text = source.trim().replace(/\s+/g, " ");
  let output = exactCopy(text);
  if (output === text) {
    const warning = " " + basketSaving;
    if (text.endsWith(warning)) {
      output = translateText(text.slice(0, -warning.length)) + " " + exactCopy(basketSaving);
    } else {
      for (const [pattern, zh, ms] of miniPatterns) {
        const match = pattern.exec(text);
        if (!match) continue;
        output = (language === "zh-Hans" ? zh : ms).replace(/\{(\d+)\}/g, (_, index) => exactCopy(match[index]));
        break;
      }
    }
  }
  if (output === text) return source;
  return source.slice(0, source.length - source.trimStart().length) + output + source.slice(source.trimEnd().length);
}

/** Localize a canonical message template. Values such as builds remain verbatim. */
export function translateMini(_key, englishFallback, values = {}) {
  return translateText(englishFallback).replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder
  );
}

function renderValue(node, key, current, write) {
  if (!current?.trim()) return;
  let fields = originals.get(node);
  if (!fields) {
    fields = new Map();
    originals.set(node, fields);
  }
  const previous = fields.get(key);
  const source = previous?.output === current ? previous.source : current;
  const output = translateText(source);
  fields.set(key, {source, output});
  if (output !== current) write(output);
}

function renderText(node) {
  if (node.parentElement && !node.parentElement.closest(excluded)) {
    renderValue(node, "text", node.nodeValue, (value) => { node.nodeValue = value; });
  }
}

function renderAttribute(element, name) {
  if (element.closest(excluded) || (name === "content" && !element.matches('meta[name="description"]'))) return;
  renderValue(element, name, element.getAttribute(name), (value) => element.setAttribute(name, value));
}

function renderTree(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    renderText(node);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || node.closest(excluded)) return;
  const renderAttributes = (element) => {
    for (const name of attributes) {
      if (element.hasAttribute(name)) renderAttribute(element, name);
    }
  };
  if (node.matches(attributeSelector)) renderAttributes(node);
  for (const element of node.querySelectorAll(attributeSelector)) renderAttributes(element);
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) renderText(walker.currentNode);
}

function createPicker(button, setLanguage) {
  if (!button) return () => {};
  const select = document.createElement("select");
  select.className = "mini-language-select";
  select.id = "mini-language-choice";
  for (const [code, name] of languages) {
    const option = document.createElement("option");
    option.value = code;
    option.lang = code;
    option.textContent = name;
    select.append(option);
  }
  const dialog = document.createElement("dialog");
  const nativeDialog = typeof dialog.showModal === "function";
  const labelTarget = document.getElementById(button.getAttribute("aria-labelledby"));
  if (nativeDialog) {
    dialog.className = "mini-language-dialog";
    dialog.id = "mini-language-dialog";
    dialog.setAttribute("aria-labelledby", "mini-language-heading");
    const form = document.createElement("form");
    form.method = "dialog";
    const heading = document.createElement("h2");
    heading.id = "mini-language-heading";
    heading.textContent = "Choose language";
    const label = document.createElement("label");
    label.htmlFor = select.id;
    label.textContent = "Language";
    const done = document.createElement("button");
    done.type = "submit";
    done.className = "mini-language-done";
    done.textContent = "Done";
    form.append(heading, label, select, done);
    dialog.append(form);
    document.body.append(dialog);
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", dialog.id);
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      select.value = language;
      dialog.showModal();
      button.setAttribute("aria-expanded", "true");
      select.focus();
    });
    dialog.addEventListener("keydown", (event) => event.stopPropagation());
    select.addEventListener("change", () => setLanguage(select.value, true));
    dialog.addEventListener("close", () => {
      button.setAttribute("aria-expanded", "false");
      button.focus();
    });
  } else {
    button.after(select);
    button.hidden = true;
    select.addEventListener("change", () => setLanguage(select.value, true));
  }
  button.disabled = false;

  return () => {
    select.value = language;
    const label = exactCopy("Language") + " · " + languages.get(language);
    if (!nativeDialog) select.setAttribute("aria-label", exactCopy("Language"));
    if (labelTarget) {
      labelTarget.textContent = label;
    } else {
      button.setAttribute("aria-label", label);
      button.title = label;
    }
    const display = button.querySelector("[data-language-label]");
    if (display) display.textContent = {"en": "EN", "zh-Hans": "中文", "ms": "MS"}[language];
  };
}

/** Localize the existing Mini Street DOM and new nodes from the 3D interactions. */
export function initMiniI18n(button = document.querySelector("#mini-language")) {
  if (initialized) return;
  initialized = true;
  const root = document.documentElement;
  const observer = new MutationObserver((changes) => {
    observer.disconnect();
    for (const change of changes) {
      if (!change.target.isConnected) continue;
      if (change.type === "characterData") renderText(change.target);
      if (change.type === "attributes") renderAttribute(change.target, change.attributeName);
      for (const node of change.addedNodes) {
        if (node.isConnected) renderTree(node);
      }
    }
    observe();
  });
  const observe = () => observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: attributes,
  });
  const refreshPicker = createPicker(button, setLanguage);

  function setLanguage(choice, save = false) {
    language = languages.has(choice) ? choice : "en";
    if (save) {
      try { localStorage.setItem(storageKey, language); } catch { /* Keep the choice for this visit. */ }
    }
    observer.disconnect();
    root.lang = language;
    renderTree(root);
    refreshPicker();
    observe();
    window.dispatchEvent(new CustomEvent("mini:languagechange", {detail: {language}}));
  }

  setLanguage(language);
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) setLanguage(event.newValue);
    if (event.key === null) setLanguage(getMiniLanguage());
  });
}
