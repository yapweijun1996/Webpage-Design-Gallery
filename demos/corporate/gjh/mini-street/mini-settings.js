import { initMiniI18n, translateMini } from "./mini-i18n.js";
import { initMiniUpdate } from "./assets/update.js";

initMiniI18n();
initMiniUpdate({
  button: document.querySelector("#mini-update"),
  version: document.querySelector("#mini-version"),
  status: document.querySelector("#mini-update-status"),
  translate: translateMini,
});
