import {controlIcon} from './icons.js';
import {element, button, controlList, stepProgress, helpButton, guideStages, trapDialogFocus} from './components.js';
import {messages} from './locales.js';

/** Owns UI state only. The host owns movement, scene pause and domain actions. */
export function createOnboarding({id = 'onboarding', appName, copy, steps, scene,
  modes = ['keyboard', 'touch'], actions = ['map', 'list'], theme = 'system', locale = 'en',
  canOpen = () => true, onAction = () => {}, onOpen = () => {}, onClose = () => {}, storageKey = id,
  parent = document.body, footer = null, showHelpEntry = true, onHelp = null, onBack = null} = {}) {
  if (!appName || !scene || !steps?.length) throw new Error('Onboarding requires appName, scene and steps.');
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || document.getElementById(`${id}-dialog`)) throw new Error('Onboarding requires a unique valid id.');
  if (!modes.length || modes.some(mode => !['keyboard','touch','gamepad'].includes(mode))) throw new Error('Unsupported onboarding input mode.');
  for (const step of steps) for (const mode of modes) for (const lang of Object.keys(messages)) {
    if (!step.label?.[lang] || !step.bindings?.[mode]?.[lang]) throw new Error(`Missing onboarding copy: ${step.id}/${mode}/${lang}`);
  }
  const controller = new AbortController(), {signal} = controller;
  const coarse = matchMedia('(pointer: coarse)'), dark = matchMedia('(prefers-color-scheme: dark)');
  let showNextTime = true, controlsExpanded = !matchMedia('(max-width: 650px)').matches;
  let modePreference = 'auto', mode = coarse.matches && modes.includes('touch') ? 'touch' : modes[0];
  let visible = false, tutorial = false, tipIndex = 0, previousFocus = null, previousHUDAction = null, settingsOpen = false;
  let hudSuppressed = false;
  let suspended = false, lastGamepadButtons = [], gamepadDirectionAt = 0;
  const key = `ob:${storageKey}:preferences:v1`;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (typeof saved.showNextTime === 'boolean') showNextTime = saved.showNextTime;
    if (['light', 'dark', 'system'].includes(saved.theme)) theme = saved.theme;
    if (messages[saved.locale]) locale = saved.locale;
    if (saved.mode === 'auto' || modes.includes(saved.mode)) modePreference = saved.mode;
  } catch { /* Storage is optional; the UI remains usable in memory. */ }
  if (!messages[locale]) locale = 'en';
  if (!['light', 'dark', 'system'].includes(theme)) theme = 'system';
  if (modePreference !== 'auto') mode = modePreference;
  const dialog = element('dialog', 'ob-ui ob-dialog'); dialog.id = `${id}-dialog`;
  const hud = element('div', 'ob-ui ob-hud'); hud.hidden = true;
  const live = element('p', 'ob-live'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
  hud.append(live); parent.append(dialog, hud);
  function save() {
    try { localStorage.setItem(key, JSON.stringify({theme, locale, mode: modePreference, showNextTime})); } catch { /* Optional preferences. */ }
  }
  function applyTheme() {
    for (const root of [dialog, hud]) {
      root.dataset.obTheme = theme === 'system' ? (dark.matches ? 'dark' : 'light') : theme;
      root.lang = locale;
    }
  }
  function text() { return messages[locale]; }
  function currentCopy() { return copy[locale] || copy.en; }
  function actionButton(action, className) {
    const node = button(currentCopy().actions?.[action] || text()[action], className, () => dialog.close(action));
    node.id = `${id}-${action}`; return node;
  }
  function settingsField(name, values, selected) {
    const label = element('label', '', text()[name]);
    const select = element('select'); select.dataset.obSetting = name;
    for (const [value, title] of values) { const option = element('option', '', title); option.value = value; select.append(option); }
    select.value = selected;
    select.addEventListener('change', () => {
      if (name === 'theme') theme = select.value;
      if (name === 'language') locale = select.value;
      if (name === 'input') { modePreference = select.value; if (modePreference !== 'auto') mode = modePreference; else mode = coarse.matches && modes.includes('touch') ? 'touch' : modes[0]; }
      save(); renderDialog(); renderHUD();
      dialog.querySelector(`[data-ob-setting="${name}"]`)?.focus({preventScroll:true});
    }); label.append(select); return label;
  }
  function renderDialog() {
    const t = text(), content = currentCopy();
    dialog.replaceChildren();
    dialog.setAttribute('aria-labelledby', `${id}-title`); dialog.setAttribute('aria-describedby', `${id}-description`);
    const header = element('div', 'ob-header');
    const close = button('×', 'ob-close', () => dialog.close('dismiss')); close.id = `${id}-close`; close.setAttribute('aria-label', t.close);
    header.append(element('p', 'ob-eyebrow', `${appName} · ${t.welcome}`), close);
    const title = element('h2', 'ob-title', content.title); title.id = `${id}-title`; title.tabIndex = -1;
    const description = element('p', 'ob-description', content.description); description.id = `${id}-description`;
    const heading = element('div', 'ob-section-heading');
    heading.append(element('h3', '', t.controls), element('span', 'ob-mode', t[mode]));
    const context=element('div','ob-context');
    context.append(settingsField('input',['auto',...modes].map(value=>[value,value==='auto'?`${t.auto} · ${t[mode]}`:t[value]]),modePreference),
      settingsField('language',[['en','English'],['zh-CN','简体中文']],locale));
    const settings = element('div', 'ob-settings'); settings.id = `${id}-settings`; settings.hidden = !settingsOpen;
    settings.append(settingsField('theme', ['system','light','dark'].map(value => [value,t[value]]), theme));
    const toggle = button(t.settings, 'ob-settings-toggle', () => {
      settingsOpen = !settingsOpen; settings.hidden = !settingsOpen; toggle.setAttribute('aria-expanded', String(settingsOpen));
    }); toggle.setAttribute('aria-expanded', String(settingsOpen)); toggle.setAttribute('aria-controls', settings.id);
    close.before(toggle);
    const actionsRow = element('div', 'ob-actions');
    actionsRow.append(actionButton('start','ob-primary'));
    if(actions.includes('list'))actionsRow.append(actionButton('list','ob-secondary-button'));
    if(actions.includes('map'))actionsRow.append(actionButton('map','ob-text-button ob-map-action'));
    const stages=guideStages(t.stages,1,t.phase(1,3));
    const controls=controlList(steps,mode,locale);controls.id=`${id}-controls`;controls.hidden=!controlsExpanded;
    const controlsToggle=button(t.details,'ob-controls-toggle ob-text-button',()=>{
      controlsExpanded=!controlsExpanded;controls.hidden=!controlsExpanded;controlsToggle.setAttribute('aria-expanded',String(controlsExpanded));
    });controlsToggle.textContent=t.controls;controlsToggle.setAttribute('aria-expanded',String(controlsExpanded));controlsToggle.setAttribute('aria-controls',controls.id);
    const preference=element('label','ob-preference');
    const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=showNextTime;checkbox.id=`${id}-show-next`;
    checkbox.addEventListener('change',()=>{showNextTime=checkbox.checked;save();});preference.append(checkbox,document.createTextNode(t.showNextTime));
    heading.querySelector('h3').replaceChildren(controlsToggle);
    dialog.append(header, stages, title, description, context, settings, heading, controls, actionsRow, preference);
    if(footer)dialog.append(footer);
    applyTheme();
  }
  function renderHUD(announce = false) {
    const t = text();
    const focusedAction=hud.contains(document.activeElement)?document.activeElement.dataset.obAction:null;
    hud.replaceChildren(live); hud.hidden = !visible || suspended || hudSuppressed || dialog.open || (!tutorial && !showHelpEntry);
    if (tutorial) {
      const tip = element('aside', 'ob-tip'); tip.setAttribute('aria-label', t.controls);
      const header = element('div','ob-tip-header');
      const done = tipIndex >= steps.length;
      const title=element('h3','',done ? t.ready : steps[tipIndex].label[locale]);
      title.prepend(controlIcon(done?'ready':steps[tipIndex].id));header.append(title);
      const dismiss=button('×','ob-close',stopTutorial);dismiss.setAttribute('aria-label',t.skip);dismiss.dataset.obAction='skip';header.append(dismiss);
      tip.append(guideStages(t.stages,done?3:2,t.phase(done?3:2,3)),header, stepProgress(Math.min(tipIndex+1,steps.length),steps.length,t.tip(Math.min(tipIndex+1,steps.length),steps.length)));
      if (!done) { const list=controlList([steps[tipIndex]],mode,locale);
        const illustration=element('div','ob-gesture');illustration.append(controlIcon(mode==='touch'?'touch':mode==='gamepad'?(steps[tipIndex].id==='look'?'gamepad-look':steps[tipIndex].id==='move'?'gamepad-move':'gamepad'):steps[tipIndex].id));
        tip.append(illustration,list); }
      else tip.append(element('p','ob-tip-copy',t.readyCopy));
      const controls=element('div','ob-tip-actions');
      const help=button(t.help,'ob-text-button',requestHelp);help.dataset.obAction='help';
      if(tipIndex>0){const back=button(t.back,'ob-text-button',()=>{tipIndex--;renderHUD(true);});back.dataset.obAction='back';controls.append(back);}
      const next=button(done?t.done:t.next,'ob-primary',() => {if(done)stopTutorial();else {tipIndex++;renderHUD(true);}});next.dataset.obAction='next';
      controls.append(help,next); tip.append(controls);

      hud.append(tip);
      if(announce)live.textContent=done?t.ready:`${t.tip(tipIndex+1,steps.length)}: ${steps[tipIndex].label[locale]}`;
    } else if (showHelpEntry) {const entry=helpButton(`${t.help} · ?`,requestHelp);entry.dataset.obAction='help';hud.append(entry);}
    applyTheme();
    if(focusedAction&&!hud.hidden)(hud.querySelector(`[data-ob-action="${focusedAction}"]`)||hud.querySelector('[data-ob-action=next]'))?.focus({preventScroll:true});
  }
  // Embedded experiences may provide one permanent help owner. All help entry
  // paths use it; welcome/tutorial state remains owned by this component.
  function requestHelp() {
    if (!visible || dialog.open || !canOpen()) return false;
    return onHelp ? onHelp() : openWelcome();
  }
  function stopTutorial() { tutorial=false; renderHUD(); scene.focus({preventScroll:true}); }
  function openWelcome() {
    if (!visible || dialog.open || !canOpen()) return false;
    previousFocus = document.activeElement;
    previousHUDAction=hud.contains(previousFocus)?previousFocus.dataset.obAction:null;
    renderDialog(); onOpen(); dialog.showModal(); renderHUD();
    dialog.querySelector('.ob-title').focus({preventScroll:true}); return true;
  }
  function setInputMode(next, {automatic = false} = {}) {
    if (!modes.includes(next) || (automatic && modePreference !== 'auto') || mode === next) return;
    mode = next;
    // Refresh only the changing guidance, preserving focus and open settings.
    const list = dialog.querySelector('.ob-controls');
    if(list){const nextList=controlList(steps,mode,locale);nextList.id=list.id;nextList.hidden=list.hidden;list.replaceWith(nextList);}
    const auto=dialog.querySelector('[data-ob-setting=input] option[value=auto]');if(auto)auto.textContent=`${text().auto} · ${text()[mode]}`;
    const label=dialog.querySelector('.ob-mode'); if(label)label.textContent=text()[mode];
    renderHUD();
  }
  dialog.addEventListener('cancel',event => {event.preventDefault();dialog.close('dismiss');},{signal});
  dialog.addEventListener('keydown',event=>trapDialogFocus(event,dialog,dialog.querySelector('.ob-title')),{signal});
  dialog.addEventListener('close',() => {
    const action=dialog.returnValue;
    if(action==='start'){tutorial=true;tipIndex=0;}
    renderHUD();
    if(action==='start')scene.focus({preventScroll:true});
    else if(previousHUDAction&&hud.querySelector(`[data-ob-action="${previousHUDAction}"]`))hud.querySelector(`[data-ob-action="${previousHUDAction}"]`).focus({preventScroll:true});
    else if(previousFocus?.isConnected && previousFocus.getClientRects().length)previousFocus.focus({preventScroll:true});else scene.focus({preventScroll:true});
    onClose(action);onAction(action);
  },{signal});
  scene.addEventListener('pointerdown',event => setInputMode(event.pointerType==='touch'?'touch':'keyboard',{automatic:true}),{signal});
  document.addEventListener('keydown',event => {
    const target=event.target;
    if(!visible||event.ctrlKey||event.metaKey||event.altKey||target.closest('input,select,textarea,[contenteditable="true"]'))return;
    if(event.key==='Escape'&&hud.contains(target)){event.preventDefault();stopTutorial();return;}
    if((event.key==='?'||event.key.toLowerCase()==='h')&&(target===scene||target===document.body)){event.preventDefault();requestHelp();}
    if(target===scene||target===document.body)setInputMode('keyboard',{automatic:true});
  },{signal});
  dark.addEventListener('change',applyTheme,{signal});
  coarse.addEventListener('change',() => setInputMode(coarse.matches?'touch':'keyboard',{automatic:true}),{signal});
  renderDialog();renderHUD();
  return {
    dialog, openWelcome, setInputMode,
    get mode(){return mode;},
    get preferences(){return {theme,locale,resolvedTheme:theme==='system'?(dark.matches?'dark':'light'):theme};},
    get shouldAutoShow(){return showNextTime;},
    setVisible(value){visible=Boolean(value);if(!visible&&dialog.open)dialog.close('view-change');renderHUD();},
    setSuspended(value){if(suspended===Boolean(value))return;suspended=Boolean(value);renderHUD();},
    // Scene actions can hide tips while confirmed actions still advance the tutorial.
    setHUDSuppressed(value){if(hudSuppressed===Boolean(value))return;hudSuppressed=Boolean(value);renderHUD();},
    report(action){if(tutorial&&!suspended&&!dialog.open&&steps[tipIndex]?.id===action){tipIndex++;renderHUD(true);}},
    handleGamepad(pad,navigationRoot=null){
      if(!pad||!modes.includes('gamepad')){lastGamepadButtons=[];return false;}
      const rising=index=>pad.buttons[index]?.pressed&&!lastGamepadButtons[index];
      const active=pad.axes.some(value=>Math.abs(value)>.2)||pad.buttons.some(value=>value.pressed);
      if(active)setInputMode('gamepad',{automatic:true});
      const now=performance.now();
      const navigation=dialog.open?dialog:navigationRoot;
      if(navigation && now-gamepadDirectionAt>180){
        const controls=[...navigation.querySelectorAll('button,select,input,a[href],summary')].filter(node=>node.getClientRects().length&&!node.disabled);
        const onSelect=document.activeElement.matches('select');
        const direction=(pad.buttons[13]?.pressed||(!onSelect&&pad.buttons[15]?.pressed)||pad.axes[1]>.5)?1:(pad.buttons[12]?.pressed||(!onSelect&&pad.buttons[14]?.pressed)||pad.axes[1]<-.5)?-1:0;
        if(direction){const index=controls.indexOf(document.activeElement);controls[(index+direction+controls.length)%controls.length]?.focus();gamepadDirectionAt=now;}
      }
      const consumed=Boolean(navigation);
      if(navigation&&document.activeElement.matches('select')&&(rising(0)||rising(14)||rising(15))){
        const select=document.activeElement,delta=rising(14)?-1:1;
        select.selectedIndex=(select.selectedIndex+delta+select.options.length)%select.options.length;
        select.dispatchEvent(new Event('change',{bubbles:true}));
      } else if(navigation&&rising(0)&&document.activeElement.matches('button,input[type=checkbox],a[href],summary'))document.activeElement.click();
      if(navigation instanceof HTMLDialogElement&&rising(1))navigation.close('dismiss');
      else if(navigation&&rising(1))onBack?.(navigation);
      if(!dialog.open&&rising(9))requestHelp();
      lastGamepadButtons=pad.buttons.map(value=>value.pressed);return consumed;
    },
    destroy(){const wasOpen=dialog.open;controller.abort();if(wasOpen){dialog.close('destroy');onClose('destroy');}dialog.remove();hud.remove();},
  };
}
