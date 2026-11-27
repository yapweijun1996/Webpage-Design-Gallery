// Only entry point. Each module exports init() and owns its own DOM.
import * as i18n from './core/i18n.js';
import * as toast from './core/toast.js';
import * as theme from './core/theme.js';
import * as update from './core/update.js';
import * as sw from './core/sw-register.js';
import * as header from './components/header.js';
import * as langMenu from './components/lang-menu.js';
import * as backToTop from './components/back-to-top.js';
import * as demoNote from './components/demo-note.js';
import * as accordion from './components/accordion.js';
import * as tabs from './components/tabs.js';
import * as commerce from './components/commerce-demo.js';
import * as contact from './components/contact-form.js';
import * as review from './components/review.js';
import * as motion from './components/motion.js';

for (const module of [i18n, toast, theme, update, sw, langMenu, header, backToTop, demoNote, accordion, tabs, commerce, contact, review, motion]) {
  module.init();
}
window.__pomeloV8PageReady?.();
