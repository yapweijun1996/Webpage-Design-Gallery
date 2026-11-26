// Only entry point. Each module exports init() and owns its own DOM.
import * as i18n from './core/i18n.js';
import * as toast from './core/toast.js';
import * as theme from './core/theme.js';
import * as update from './core/update.js';
import * as sw from './core/sw-register.js';
import * as header from './components/header.js';
import * as langSwitch from './components/lang-switch.js';
import * as demoNote from './components/demo-note.js';
import * as accordion from './components/accordion.js';
import * as tabs from './components/tabs.js';
import * as commerce from './components/commerce-demo.js';
import * as contact from './components/contact-form.js';
import * as review from './components/review.js';

for (const module of [i18n, toast, theme, update, sw, header, langSwitch, demoNote, accordion, tabs, commerce, contact, review]) {
  module.init();
}
