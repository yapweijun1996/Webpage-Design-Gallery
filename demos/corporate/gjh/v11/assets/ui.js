import {createActionDialog} from '../../../../../assets/onboarding/action-dialog.js';
import {createTutorial} from './ux-tutorial.js';
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
import {createContextNavigation} from './context-navigation.js';
import {setupDemoBag} from './demo-bag.js';
import {setupNewMoonPreview} from './newmoon-detail-preview.js';
import {spatial, mapPoint, mapStoreRect, mapView} from './spatial.js';
import {expandedLayout, expandedMapPoint} from './expanded-layout.js';
import {storeDestinations} from './store-destinations.js';
import {liftLayout} from './lift-layout.js';
import {icon} from './icons.js';
import {FEATURE_KIOSK_ID, FEATURE_KIOSK_RECORD} from './feature-kiosk.js';


export function createUI(expanded = false) {
  const scene = document.getElementById('scene');
  const experience = document.getElementById('experience');
  const storeList = document.getElementById('store-list');
  const introText=document.querySelector('.mall-intro>p:last-child');
  if(introText)introText.textContent=expanded?'17 stores. One open invitation.':'Three stores. One open invitation.';
  const listSummary=document.querySelector('.list-summary');
  if(listSummary){
    const labels=listSummary.querySelectorAll('strong'),separators=listSummary.querySelectorAll('span');
    if(expanded){labels[1].textContent='14 concept stores';}
    else{labels[1].textContent='4 products';labels[2].hidden=true;separators[0].textContent=' / ';separators[1].hidden=true;}
  }
  const conceptDirectory = document.getElementById('planned-spaces-directory');
  conceptDirectory.hidden = !expanded;
  conceptDirectory.open = expanded;
  const destinations = storeDestinations(expanded);
  const destinationById = new Map(destinations.map(store => [store.id, store]));
  const viewToggle = document.getElementById('view-toggle');
  const directoryEnter3D = document.getElementById('directory-enter-3d');
  const storeVisitButtons = [...document.querySelectorAll('[data-visit-store]')];
  const directoryLoading = document.getElementById('directory-loading');
  directoryLoading.hidden = false;
  let directoryTouched = false;
  for (const event of ['pointerdown', 'keydown']) storeList.addEventListener(event, () => { directoryTouched = true; }, {once: true});
  const headerMap = document.getElementById('header-map');
  const locationName = document.getElementById('location-name');
  const status = document.getElementById('mall-status');
  const fallbackMessage = document.getElementById('fallback-message');
  const recovery = document.getElementById('graphics-recovery');
  const return3D = document.getElementById('graphics-return');
  const themeDialog=document.getElementById('mall-theme-dialog'),themeSelect=document.getElementById('mall-theme-select'),themeApply=document.getElementById('mall-theme-apply'),themeStatus=document.getElementById('mall-theme-status');
  const themeOpen=document.getElementById('mall-theme-open'),directoryThemeOpen=document.getElementById('directory-theme-open');
  let mallTheme=null,themeOpener=null;
  document.getElementById('graphics-reload').addEventListener('click', () => location.reload());
  return3D.addEventListener('click', () => { if (available) setView(true, true); });
  const playerDot = document.getElementById('player-dot');
  const floorplan=document.querySelector('.floorplan'),mapCaption=document.querySelector('.map-caption');
  const [west, centre, east] = spatial.stores;
  const floorplanLabel=expanded ? `Ground floor: ${destinations.length} stores open to explore. The gold dot marks your position.` : `Mall floorplan. ${west.label} on the left, ${centre.label} in the centre and ${east.label} on the right. The gold dot marks your position.`;
  floorplan.setAttribute('aria-label',floorplanLabel);
  const mapCaptionText=[...mapCaption.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
  const inspectPrompt = document.getElementById('inspect-prompt');
  const inspectButton = document.getElementById('inspect');
  const nearbyName = document.getElementById('nearby-name');
  const nearbyDistance = document.getElementById('nearby-distance');
  const nearbyStory=document.createElement('p');nearbyStory.className='brand-story-nearby';nearbyStory.hidden=true;nearbyStory.setAttribute('role','status');nearbyStory.setAttribute('aria-live','polite');
  inspectPrompt.append(nearbyStory);
  const help = document.getElementById('keyboard-help');
  const mallMap = document.getElementById('mall-map');
  const tutorial = createTutorial({parent: experience, touch: matchMedia('(pointer: coarse)').matches,
    onDismiss: () => { if (showing3D) scene.focus({preventScroll: true}); }});
  // Amenity dialogs retain their saved language/theme without mounting onboarding.
  let amenityLocale = 'en', amenityTheme = 'system';
  try {
    const saved = JSON.parse(localStorage.getItem('ob:gjh-v11:preferences:v1') || '{}');
    if (['en', 'zh-CN'].includes(saved.locale)) amenityLocale = saved.locale;
    if (['light', 'dark', 'system'].includes(saved.theme)) amenityTheme = saved.theme;
  } catch { /* Preferences are optional. */ }
  const amenityPanel=createActionDialog({id:'amenity-dialog',scene,closeIcon:()=>icon('close',{size:24}),
    getPreferences:()=>({locale:amenityLocale,resolvedTheme:amenityTheme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):amenityTheme}),
    onOpen:()=>notifyMode(),onClose:()=>notifyMode()});
  const guideReopen = document.getElementById('guide-reopen');
  const toolsMenu = document.getElementById('mall-tools');
  const toolsSummary = toolsMenu.querySelector('summary');
  toolsMenu.addEventListener('toggle', () => {
    if (!toolsMenu.open) help.open = false;
  });
  document.addEventListener('pointerdown', event => {
    if (toolsMenu.open && !toolsMenu.contains(event.target) && !event.target.closest('dialog[open]')) toolsMenu.open = false;
  });
  toolsMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !help.open && toolsMenu.open) {
      event.preventDefault();
      toolsMenu.open = false;
      toolsSummary.focus();
    }
  });
  const railGuide = document.getElementById('rail-guide');
  for (const entry of [guideReopen, railGuide]) entry?.setAttribute('aria-controls', 'guide-card');
  const touchGuide = matchMedia('(pointer: coarse)');
  let unsubscribeInteractions = null, lastGamepadButtons = [], gamepadDirectionAt = 0;
  let modeListener = null, shelfFocus = null;
  const modeSignals = () => ({productOpen: document.getElementById('product-dialog').open || externalPaused || document.getElementById('original-tin-dialog').open,
    bagOpen: document.getElementById('bag-dialog').open, shelfOpen: Boolean(shelfFocus?.open),
    panelOpen: themeDialog.open || amenityPanel.dialog.open || !showing3D || (compactMap.matches && (help.open || mallMap.open))});
  function syncTutorialSuspension(signals) {
    tutorial.setActive(available && showing3D && !signals.productOpen && !signals.bagOpen && !signals.shelfOpen &&
      !signals.panelOpen && !help.open && !mallMap.open && !document.hidden);
  }
  const notifyMode = () => {
    const signals = modeSignals();
    syncTutorialSuspension(signals);
    if (signals.shelfOpen && (signals.productOpen || signals.bagOpen || signals.panelOpen)) shelfFocus.close({focus: false});
    modeListener?.(modeSignals());
  };
  const compactMap = matchMedia('(max-width: 650px), (max-height: 560px) and (orientation: landscape)');
  function updateCompactPanels(){const paused=compactMap.matches&&(mallMap.open||help.open);document.body.classList.toggle('is-panel-open',paused);}
  let mapReturnFocus=headerMap;
  // Header, kiosk and quick guide share this map owner. The map's own
  // summary is not a second permanent entry on compact screens.
  function canUsePanels() {
    return available && showing3D && !dialog.open && !bag.open && !amenityPanel.dialog.open && !themeDialog.open && !externalPaused && !document.hidden;
  }
  function openMap() {
    if (!canUsePanels()) return false;
    shelfFocus?.close({focus: false});
    help.open = false; mapReturnFocus = headerMap;
    mallMap.open = true; headerMap.setAttribute('aria-expanded', 'true'); updateCompactPanels(); focusMap();
    return true;
  }
  function closeMap() {
    if (!canUsePanels()) return;
    mallMap.open = false; headerMap.setAttribute('aria-expanded', 'false'); updateCompactPanels(); notifyMode();
    (compactMap.matches ? headerMap : scene).focus({preventScroll: true});
  }
  function openHelp() {
    if (!canUsePanels()) return false;
    shelfFocus?.close({focus: false});
    if (compactMap.matches) mallMap.open = false;
    toolsMenu.open = true;
    help.open = true; updateCompactPanels(); notifyMode();
    help.querySelector('summary').focus({preventScroll: true});
    return true;
  }
  function closeGamepadPanel(panel) {
    if (panel === mallMap) closeMap();
    else if (panel === help && canUsePanels()) {
      help.open = false; updateCompactPanels(); notifyMode();
      help.querySelector('summary').focus({preventScroll: true});
    }
  }
  function handlePanelGamepad(pad, navigation) {
    if (!pad) { lastGamepadButtons = []; return false; }
    const rising = index => pad.buttons[index]?.pressed && !lastGamepadButtons[index];
    const now = performance.now();
    if (navigation && now - gamepadDirectionAt > 180) {
      const controls = [...navigation.querySelectorAll('button,select,input,a[href],summary')]
        .filter(node => node.getClientRects().length && !node.disabled);
      const onSelect = document.activeElement.matches('select');
      const direction = (pad.buttons[13]?.pressed || (!onSelect && pad.buttons[15]?.pressed) || pad.axes[1] > .5) ? 1 :
        (pad.buttons[12]?.pressed || (!onSelect && pad.buttons[14]?.pressed) || pad.axes[1] < -.5) ? -1 : 0;
      if (direction) {
        const index = controls.indexOf(document.activeElement);
        controls[(index + direction + controls.length) % controls.length]?.focus();
        gamepadDirectionAt = now;
      }
    }
    if (navigation && document.activeElement.matches('select') && (rising(0) || rising(14) || rising(15))) {
      const select = document.activeElement, delta = rising(14) ? -1 : 1;
      select.selectedIndex = (select.selectedIndex + delta + select.options.length) % select.options.length;
      select.dispatchEvent(new Event('change', {bubbles: true}));
    } else if (navigation && rising(0) && document.activeElement.matches('button,input[type=checkbox],a[href],summary')) {
      document.activeElement.click();
    }
    if (navigation instanceof HTMLDialogElement && rising(1)) navigation.close('dismiss');
    else if (navigation && rising(1)) closeGamepadPanel(navigation);
    if (rising(9) && !document.querySelector('dialog[open]')) openHelp();
    lastGamepadButtons = pad.buttons.map(button => button.pressed);
    return Boolean(navigation);
  }
  help.querySelector('summary').addEventListener('click', event => { if (!canUsePanels()) event.preventDefault(); });
  document.getElementById('map-close').addEventListener('click', closeMap);
  function updateViewToggle() {
    viewToggle.textContent = showing3D ? 'Store Directory' : 'Enter 3D Mall';
    viewToggle.setAttribute('aria-label', showing3D ? 'Switch to the accessible store directory' : 'Switch to the 3D virtual mall');
  }
  const resetMap = () => { mallMap.open = false; };
  resetMap();
  compactMap.addEventListener('change', () => {
    const active = document.activeElement;
    resetMap(); updateViewToggle();
    headerMap.hidden = !showing3D;
    headerMap.setAttribute('aria-expanded', String(mallMap.open));updateCompactPanels();
    // A details element may stay open across this breakpoint. Publish regardless
    // of toggle events and recover focus only if its control just became hidden.
    if (showing3D && ((active === headerMap && headerMap.hidden) ||
        (mallMap.contains(active) && !mallMap.open && active !== mallMap.querySelector('summary')))) {
      if (shelfFocus?.open) shelfFocus.focus();
      else headerMap.focus({preventScroll: true});
    }
    notifyMode();
  });
  mallMap.addEventListener('toggle', () => {
    if (compactMap.matches && mallMap.open) help.open = false;
    headerMap.setAttribute('aria-expanded', String(mallMap.open));updateCompactPanels();
    notifyMode();
  });
  help.addEventListener('toggle', () => { if (compactMap.matches && help.open) mallMap.open = false; headerMap.setAttribute('aria-expanded', String(mallMap.open)); updateCompactPanels(); notifyMode(); });
  headerMap.addEventListener('click', () => {
    if (headerMap.hidden || !canUsePanels()) return;
    if (mallMap.open) closeMap(); else openMap();
  });
  const dialog = document.getElementById('product-dialog');
  const newMoonPreview = setupNewMoonPreview();
  const bag = setupDemoBag();
  const bagDialog = document.getElementById('bag-dialog');
  const listTitle = document.getElementById('list-title');
  const contextNavigation = createContextNavigation({
    globalHost: document.getElementById('context-navigation-global'),
    directory: storeList,
    recoverFocus() {
      // Native modal owners control their own entry and close focus.
      if (!document.querySelector('dialog[open]')) (showing3D ? scene : listTitle).focus({preventScroll: true});
    },
    onHome() {
      // Recheck readiness at activation, including synthetic stale clicks.
      if (!available) return;
      if (compactMap.matches) { help.open = false; mallMap.open = false; }
      setView(true, !bag.open);
      if (bag.open) bag.closeTo(scene);
      else scene.focus({preventScroll: true});
      notifyMode();
    },
    onShops() {
      const fromBag = bag.open;
      setView(false, !fromBag);
      focusDirectory(!fromBag);
      if (fromBag) bag.closeTo(listTitle);
      notifyMode();
    },
  });
  function focusDirectory(moveFocus = true) {
    window.scrollTo({top: 0, behavior: 'instant'});
    if (moveFocus) listTitle.focus({preventScroll: true});
  }
  const modePanels = [themeDialog, amenityPanel.dialog, dialog, bagDialog, help, mallMap, document.getElementById('original-tin-dialog')];
  const modeObserver = new MutationObserver(notifyMode);
  for (const panel of modePanels) modeObserver.observe(panel, {attributes: true, attributeFilter: ['open']});
  for (const panel of [dialog, bagDialog]) panel.addEventListener('close', notifyMode);
  const closeButton = document.getElementById('product-close');
  const productTitle = document.getElementById('product-title');
  const productImage = document.getElementById('product-image');
  const productDescription = document.getElementById('product-description');
  const productKind = document.getElementById('product-kind');
  const layoutLink=document.getElementById('layout-preview-link');
  const layoutURL=new URL(location.href);
  if(expanded) layoutURL.searchParams.set('layout','classic'); else layoutURL.searchParams.delete('layout');
layoutLink.href=layoutURL.href;
layoutLink.textContent=expanded?'Classic 3-store view':'Return to the expanded mall';
  document.getElementById('layout-preview-notice').hidden=!expanded;
  if (expanded) {
    document.getElementById('layout-preview-notice').textContent = 'Ground floor: 17 stores open to explore.';
    const destinationSelect = document.getElementById('map-destination');
    for (const store of destinations) destinationSelect.add(new Option(`${store.number} · ${store.label}`, store.id));
    document.getElementById('map-destination-controls').hidden = false;
    document.getElementById('map-visit').addEventListener('click', () => travelToStore(destinationSelect.value));
    const ns='http://www.w3.org/2000/svg';
    floorplan.setAttribute('viewBox','0 0 700 600'); floorplan.setAttribute('preserveAspectRatio','xMidYMid meet');
    const background=floorplan.querySelector('.map-courtyard');
    for(const [key,value] of Object.entries({x:1,y:1,width:698,height:598,rx:0}))background.setAttribute(key,value);
    floorplan.querySelector('.map-walkway').setAttribute('d','M130 150H570V510H130Z');
    floorplan.querySelector('.map-label:not(.map-entry)').setAttribute('y','320');
    floorplan.querySelector('.map-label:not(.map-entry)').setAttribute('x','350');
    floorplan.querySelector('.map-entry').setAttribute('x','350');floorplan.querySelector('.map-entry').setAttribute('y','575');
    playerDot.setAttribute('r','10');
    for(const bay of expandedLayout.slots){
      const origin=expandedMapPoint(bay.minX,bay.minZ);
      const store = destinations[Number(bay.number)-1];
      let rect = floorplan.querySelector(`[data-map-store="${store.id}"]`);
      if (!rect) {
        rect = document.createElementNS(ns, 'rect');
        rect.dataset.mapStore = store.id;
        rect.dataset.spaceId = store.id;
        rect.dataset.spaceStatus = store.status;
        rect.setAttribute('class','map-store');
        floorplan.insertBefore(rect, playerDot);
      }
      for(const [key,value] of Object.entries({x:origin.x+2,y:origin.y+2,width:(bay.maxX-bay.minX)*10-4,height:(bay.maxZ-bay.minZ)*10-4,rx:3}))rect.setAttribute(key,value);
      const tooltip = document.createElementNS(ns, 'title');
      tooltip.textContent = `${store.number} · ${store.label}`;
      rect.append(tooltip);
      rect.addEventListener('click', () => travelToStore(store.id));
      const label=document.createElementNS(ns,'text');label.setAttribute('class','expanded-map-number');
      label.setAttribute('x',origin.x+(bay.maxX-bay.minX)*5);label.setAttribute('y',origin.y+(bay.maxZ-bay.minZ)*5+6);
      label.setAttribute('text-anchor','middle');label.textContent=bay.number;floorplan.insertBefore(label,playerDot);
    }
    document.querySelector('.map-scale').textContent = '17 stores';
  }
  const mapServices=[];
  let servicesLegend=null;
  function addMapService(id,letter,label,point){
    if(!expanded||mapServices.some(service=>service.id===id))return;
    const ns='http://www.w3.org/2000/svg',position=expandedMapPoint(point.x,point.z);
    const group=document.createElementNS(ns,'g');group.dataset.mapService=id;group.setAttribute('pointer-events','none');
    const title=document.createElementNS(ns,'title');title.textContent=label;group.append(title);
    const marker=document.createElementNS(ns,'rect');marker.setAttribute('class','map-store');
    for(const [key,value] of Object.entries({x:position.x-20,y:position.y-20,width:40,height:40,rx:8}))marker.setAttribute(key,value);
    const text=document.createElementNS(ns,'text');text.setAttribute('x',position.x);text.setAttribute('y',position.y+8);text.setAttribute('text-anchor','middle');
    text.style.font='var(--gjh-font-expanded-map-number)';text.style.fill='var(--gjh-color-expanded-map-text)';text.textContent=letter;
    group.append(marker,text);floorplan.insertBefore(group,playerDot);mapServices.push({id,letter,label});
    if(!servicesLegend){servicesLegend=document.createElement('p');servicesLegend.className='map-caption';servicesLegend.id='map-services-legend';document.querySelector('.map-content').append(servicesLegend);}
    servicesLegend.textContent=mapServices.map(service=>`${service.letter} ${service.label}`).join(' · ');
  }
  if(expanded){
    addMapService('directory','D','Directory',liftLayout.directory);
    addMapService('guest-guide','G','Guest guide',liftLayout.desk);
    addMapService('featured-collection','F','Featured collection',liftLayout.showcase);
  }
  const mapButtons = [...document.querySelectorAll('[data-teleport]')];
  // Preserve readable static HTML without JS; synchronize the live map and
  // directory from the same validated records used by the 3D world.
  for (const store of spatial.stores) {
    const mapButton=mapButtons.find(button=>button.dataset.teleport===store.id);
    const mapRect=floorplan.querySelector(`[data-map-store="${store.id}"]`);
    const article=storeList.querySelector(`[data-store="${store.id}"]`);
    const filter=storeList.querySelector(`[data-store-filter="${store.id}"]`);
    const title=document.getElementById(store.contentRef);
    if (!mapButton || !mapRect || !article || !filter || !title || !article.contains(title)) throw new Error(`Missing store content for ${store.id}`);
    const rect=mapStoreRect(store);
    if (!expanded) for (const key of ['x','y','width','height']) mapRect.setAttribute(key,String(rect[key]));
    mapButton.style.left=`${rect.x / mapView.width * 100}%`;
    mapButton.style.width=`${rect.width / mapView.width * 100}%`;
    mapButton.querySelector('span').textContent=store.number;
    mapButton.lastChild.textContent=store.label;
    mapButton.setAttribute('aria-label',`Go to the ${store.label} storefront`);
    mapButton.disabled=!store.available;
    filter.lastChild.textContent=` ${store.label}`;
    title.textContent=store.label;
    article.querySelector('.store-story > .eyebrow').textContent=`${store.number} / The ${store.label} store`;
    if (article.dataset.brand) article.dataset.brandName=store.label;
  }
  storeList.querySelector('[data-store-filter="all"]').textContent=expanded?'Featured stores (3)':`All stores (${spatial.stores.length})`;
  storeList.querySelector('.list-summary strong').textContent=expanded?'17 stores':`${spatial.stores.length} stores`;
  function focusMap() {
    // Publish the footer reservation before revealing the focused destination.
    notifyMode();
    mapButtons[0]?.focus({preventScroll: true});
    mapButtons[0]?.scrollIntoView({block: 'nearest', behavior: 'instant'});
  }
  let seated=false, seatNotice=null, seatListener=null, elevatorListener=null, cartListener=null, cartState=()=>({available:false,active:false}), previousCartMode=null,previousCartSeated=null,previousCartAvailable=null,previousHeldProduct=null,previousElevatorTravel=false,previousCartReason=null;
  let currentElevatorState=null,currentElevatorUpper=null;
  const cartControls=document.querySelector('#cart-controls'),cartToggle=document.querySelector('#cart-toggle'),cartStatus=document.querySelector('#cart-status');
  const sceneCart=document.querySelector('#scene-cart');
  const cartIcon=icon('cart',{size:18});
  const interactionIcons=new Map();
  function updateCartControls() {
    const cart=cartState();
    const recoverFocus=!cart.available&&bag.open&&cartControls.contains(document.activeElement);
    cartControls.hidden=!cart.available;
    cartToggle.textContent=cart.active?'Stow cart':'Use cart in 3D';
    cartToggle.disabled=!cart.available||(!cart.active&&cart.capability?.disabled===true);
    sceneCart.hidden=!cart.available||!showing3D||(compactMap.matches&&(mallMap.open||help.open));
    const cartLabel=cart.active?'Stow Cart':'Shopping Cart';
    if(sceneCart.textContent!==cartLabel)sceneCart.textContent=cartLabel;
    if(sceneCart.firstChild!==cartIcon)sceneCart.prepend(cartIcon);
    sceneCart.setAttribute('aria-pressed',String(cart.active));
    sceneCart.disabled=!cart.available||(!cart.active&&cart.capability?.sceneDisabled===true);
    sceneCart.title=`${cartReason(cart)?`${cartReason(cart)} `:''}Demo shopping cart. No orders are created.`;
    sceneCart.setAttribute('aria-label',`${cartLabel}. Demo shopping cart; no orders are created.${cartReason(cart)?` ${cartReason(cart)}`:''}`);
    sceneCart.setAttribute('aria-describedby','cart-status');
    if(previousCartAvailable!==cart.available||previousCartMode!==cart.active||previousCartSeated!==cart.seated||previousHeldProduct!==cart.heldProduct||previousElevatorTravel!==cart.elevatorTravel||previousCartReason!==cart.capability?.reason){
      cartStatus.textContent=cartReason(cart)&&!cart.active?cartReason(cart):!cart.available?'The 3D cart is unavailable. Your bag selection is unchanged.':cart.heldProduct?heldInstruction(cart):cart.elevatorTravel?'Wait for the elevator to stop.':cart.seated?'Stand up before using the cart.':cart.active?'Cart active. Slower walking with a wide turning clearance; stow before sitting.':'Cart stowed. Bag selection unchanged. Use an open area; narrow aisles may require stowing.';
      previousCartAvailable=cart.available;previousCartMode=cart.active;previousCartSeated=cart.seated;previousHeldProduct=cart.heldProduct;previousElevatorTravel=cart.elevatorTravel;previousCartReason=cart.capability?.reason;
    }
    if(recoverFocus)document.getElementById('bag-close').focus({preventScroll:true});
    return cart;
  }
  function cartReason(state){return state.capability?.reasonCode==='held-product'?heldInstruction(state):state.capability?.reason;}
  function heldInstruction(state){return `Return ${records.get(state.heldProduct)?.compactName||'the held product'} to its New Moon shelf first.`;}
  function toggleCart(){const state=cartState();if(!state.available){updateCartControls();return;}const next=!state.active;const ok=cartListener?.(next);if(!ok){const message=cartReason(state)|| (state.heldProduct?heldInstruction(state):state.seated?'Stand up before using the cart.':state.elevatorTravel?'Wait for the elevator to stop.':'Cart needs about 3 metres of clear floor. Move away from walls, shelves and furniture; try the open MILI entrance.');cartStatus.textContent=message;announce(message);if(!bag.open)document.querySelector('#bag-open').click();return;}
    if(next){setView(true);bag.closeTo(scene);}
    cartStatus.textContent=next?'Cart active. Slower walking; stow before sitting. Your bag selection is unchanged.':'Cart stowed. Your bag selection is unchanged.';
    toolsMenu.open=false;sceneCart.setAttribute('aria-pressed',String(next));scene.focus({preventScroll:true});
  }
  cartToggle.addEventListener('click',toggleCart);sceneCart.addEventListener('click',toggleCart);
  const records = new Map([['courtyard-seat',{name:'Courtyard bench',action:'seat'}],['mall-directory', {name: 'Directory kiosk · Decorative screen', action: 'map'}]]);
  records.set(FEATURE_KIOSK_ID, FEATURE_KIOSK_RECORD);
  for(const [id,name] of [['service-desk','Guest services'],['wayfinding-west','Store directions'],['wayfinding-east','Store directions'],['featured-showcase','New Moon featured collection']])records.set(id,{name,action:'amenity'});
  const zones = { atrium: 'Courtyard', ...Object.fromEntries(destinations.map(store=>[store.id,store.label])), upper: 'Upper level' };
  let available = false;
  let showing3D = false;
  let currentZone = 'atrium';
  let externalPaused = false;
  let nearby = null;
  let interactionRegistry = null, selectedInteraction = null;
  let returnFocus = null;
  let teleportListener = null;
  let viewListener = null;
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!showing3D||!compactMap.matches||dialog.open||bag.open||amenityPanel.dialog.open)return;
    const panel=help.open?help:mallMap.open?mallMap:null;
    if(panel){event.preventDefault();event.stopImmediatePropagation();panel.open=false;(panel===mallMap?mapReturnFocus:panel.querySelector('summary')).focus({preventScroll:true});}
  },true);

  for (const card of document.querySelectorAll('[data-product]')) {
    records.set(card.dataset.product, {
      name: card.dataset.productName,
      compactName: card.dataset.productName.replace(/^New Moon Premium /, '').replace(/^Wild Caught /, '').replace(/ \(.*?\)/, ''),
      image: card.dataset.productImage,
      alt: `Front packshot of ${card.dataset.productName}`,
      kind: 'New Moon / Product detail',
      description: 'Official product imagery shown here. The mall’s 3D can is an unofficial photo-derived demo with estimated dimensions and label layout, not a verified packaging replica or brand-approved edition.' + (card.dataset.product.includes('-mx-') ? ' The Mexico 3D can includes a 121-degree unprinted placeholder sector.' : ''),
    });
  }
  for (const card of document.querySelectorAll('[data-brand]')) {
    records.set(card.dataset.brand, {
      name: card.dataset.brandName,
      image: card.dataset.brandImage,
      alt: `Official ${card.dataset.brandName} brand cover artwork`,
      kind: 'Brand artwork',
      description: `Original official ${card.dataset.brandName} brand cover artwork. No verified ${card.dataset.brandName} product packshots are available for this concept; no ${card.dataset.brandName} products are depicted or listed.`,
    });
  }

  function announce(message) {
    if (status.textContent !== message) status.textContent = message;
  }

  function updateMallTheme(state=mallTheme?.state()) {
    if (!expanded) return;
    if (state && [...themeSelect.options].some(option=>option.value===state.active)) themeSelect.value=state.active;
    themeApply.disabled=!mallTheme || !available || Boolean(state?.suspended || state?.pending);
    themeSelect.disabled=!mallTheme || !available || Boolean(state?.suspended || state?.pending);
    themeStatus.textContent=!mallTheme?'Theme settings are unavailable. The everyday appearance remains.':!available?'Theme settings are unavailable while 3D is not ready.':state?.message || `${state?.label || 'Everyday'} is active.`;
  }
  function openMallTheme(event) {
    if (themeDialog.open || document.querySelector('dialog[open]') || (showing3D && !canUsePanels())) return;
    themeOpener=event.currentTarget;shelfFocus?.close({focus:false});
    themeDialog.showModal();updateMallTheme();notifyMode();document.getElementById('mall-theme-title').focus({preventScroll:true});
  }
  for(const button of [themeOpen,directoryThemeOpen]) button.addEventListener('click',openMallTheme);
  document.getElementById('mall-theme-close').addEventListener('click',()=>{mallTheme?.cancel();themeDialog.close();});
  themeDialog.addEventListener('cancel',()=>mallTheme?.cancel());
  themeDialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...themeDialog.querySelectorAll('button:not(:disabled),select:not(:disabled)')].filter(node=>node.getClientRects().length);
    if(!controls.length)return;
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  });
  themeDialog.addEventListener('close',()=>{
    mallTheme?.cancel();notifyMode();
    if(themeOpener?.isConnected && themeOpener.getClientRects().length && (available || themeOpener===directoryThemeOpen)) themeOpener.focus({preventScroll:true});
    themeOpener=null;
  });
  themeApply.addEventListener('click',()=>{if(mallTheme && available) void mallTheme.select(themeSelect.value);});

  function setView(show, moveFocus = false) {
    const next = show && available;
    if (next === showing3D) return;
    shelfFocus?.close({focus: false});
    if (dialog.open) dialog.close();
    if (themeDialog.open) {mallTheme?.cancel();themeDialog.close('view-change');}
    amenityPanel.close('view-change');
    showing3D = next;
    mallMap.open = false;
    locationName.textContent = next ? zones[currentZone] : 'The store directory';
    experience.hidden = !next;
    storeList.hidden = next;
    document.body.classList.toggle('is-3d', next);
    toolsMenu.open = false;
    const assetNotice = document.getElementById('loader-asset-notice');
    if (next) document.getElementById('controls-copy').append(assetNotice);
    else document.querySelector('.site-header').after(assetNotice);
    updateViewToggle();
    help.open = false;
    headerMap.hidden = !next;
    headerMap.setAttribute('aria-expanded', String(next && mallMap.open));
    if (moveFocus) (next ? scene : document.getElementById('list-title')).focus({ preventScroll: true });
    announce(next ? `3D mall open. Location: ${zones[currentZone]}. Open Help for controls.` : expanded?'Store directory open. Explore all 17 stores and four featured products.':'Store directory open. All three stores and verified product images are available below.');
    viewListener?.(next);
    notifyMode();
  }
  const interactionHandlers = {
    amenity: id => openAmenity(id),
    elevator: () => {const calling=currentElevatorState&&currentElevatorState.docked!==(currentZone==='upper'?currentElevatorUpper:0);const ok=elevatorListener?.();announce(ok?(calling?'Elevator called. Wait here, then choose Ride when it arrives.':'Elevator travelling to the other level.'):'Wait for the elevator, return held products and stow the cart before travelling.');scene.focus({preventScroll:true});return ok;},
    seat: id => {const ok=seatListener?.(true,id);seatNotice=null;if(!ok){seatNotice=cartState().heldProduct?heldInstruction(cartState()):'Seat path blocked. Approach the clear front of the bench.';nearbyName.textContent=seatNotice;announce(seatNotice);}scene.focus({preventScroll:true});return ok;},
    map: () => {const opened=openMap();if (opened) announce(expanded?'The directory kiosk shows the expanded mall map.':'The kiosk screen is decorative. Use this three-store map to choose an entrance.');return opened;},
  };

  function inspect(id) {
    const record = records.get(id);
    if (!record || dialog.open || bag.open || amenityPanel.dialog.open) return false;
    shelfFocus?.close();
    if(record.action==='brand-story'){
      returnFocus=document.activeElement;
      productTitle.textContent=`${record.brand} · ${record.tagline}`;
      productImage.src=record.image;productImage.alt=record.alt;
      productKind.textContent=record.kind;productDescription.textContent=record.story;
      dialog.showModal();closeButton.focus({preventScroll:true});notifyMode();
      return true;
    }
    productTitle.textContent = record.name;
    productImage.src = record.image;
    productImage.alt = record.alt;
    productKind.textContent = record.kind;
    productDescription.textContent = record.description;
    bag.select(id);
    dialog.showModal();
    newMoonPreview.open(id);
    closeButton.focus({ preventScroll: true });
    notifyMode();
    return true;
  }

  function inspectNearby(id) {
    // Product Inspect is the detail action. The shelf remains an owned
    // presentation mode for retained lifecycle/fallback coverage, but it must
    // not be an intermediate click for a nearby SKU: the readable product
    // viewer is the first surface opened from the user's Inspect action.
    if (selectedInteraction?.id === id) interactionRegistry?.dispatch(selectedInteraction);
  }

  function showGuide() {
    if (!canUsePanels()) return false;
    shelfFocus?.close({focus: false});
    help.open = false; mallMap.open = false; updateCompactPanels(); notifyMode();
    toolsMenu.open = false;
    tutorial.reopen();
    return true;
  }
  guideReopen.addEventListener('click', showGuide);
  railGuide?.addEventListener('click', showGuide);

  viewToggle.addEventListener('click', () => setView(!showing3D, true));
  directoryEnter3D.addEventListener('click', () => setView(true, true));
  function visitStore(id) {
    if (!available || !destinationById.get(id)?.available) return;
    setView(true);
    travelToStore(id);
  }
  for (const button of storeVisitButtons) button.addEventListener('click', () => visitStore(button.dataset.visitStore));
  const cardStoreButtons = [...document.querySelectorAll('[data-visit-newmoon]')];
  for (const button of cardStoreButtons) button.addEventListener('click', () => visitStore('newmoon'));
  const storeFilters = [...document.querySelectorAll('[data-store-filter]')];
  const stores = [...document.querySelectorAll('[data-store]')];
  const productSearch = document.getElementById('product-search');
  const productCategory = document.getElementById('product-category');
  const productSort = document.getElementById('product-sort');
  const productResults = document.getElementById('product-results');
  const productGrid = document.querySelector('.product-grid');
  const cards = [...productGrid.querySelectorAll('.product-card')];
  let storeFilter = 'all';
  function updateCatalog() {
    for (const button of storeFilters) button.setAttribute('aria-pressed', String(button.dataset.storeFilter === storeFilter));
    for (const store of stores) store.hidden = storeFilter !== 'all' && store.dataset.store !== storeFilter;
    document.querySelector('.brand-stories').hidden = storeFilter === 'newmoon';
    const query = productSearch.value.trim().toLocaleLowerCase();
    const sorted = productSort.value === 'name' ? [...cards].sort((a, b) => a.dataset.productName.localeCompare(b.dataset.productName)) : cards;
    let count = 0;
    for (const card of sorted) {
      card.hidden = !card.dataset.productName.toLocaleLowerCase().includes(query) ||
        (productCategory.value !== 'all' && card.dataset.category !== productCategory.value);
      if (!card.hidden) count++;
      productGrid.append(card);
    }
    productResults.hidden = false;
    productResults.textContent = count ? `${count} New Moon product${count === 1 ? '' : 's'} shown. Check the official eShop for current price and availability.` : 'No products match your search. Try another search term.';
  }
  for (const button of storeFilters) button.addEventListener('click', () => { storeFilter = button.dataset.storeFilter; updateCatalog(); });
  document.getElementById('hero-shop').addEventListener('click', () => { storeFilter = 'all'; updateCatalog(); });
  productSearch.addEventListener('input', updateCatalog);
  productCategory.addEventListener('change', updateCatalog);
  productSort.addEventListener('change', updateCatalog);
  for (const link of document.querySelectorAll('.mall-amenities-directory a[href$="-title"]')) {
    link.addEventListener('click', () => { storeFilter = 'all'; updateCatalog(); });
  }
  document.querySelector('.directory-nav').hidden = false;
  document.querySelector('.catalog-controls').hidden = false;
  updateCatalog();
  const addButtons = [...document.querySelectorAll('[data-add]')];
  for (const button of addButtons) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const id = button.dataset.add;
      bag.change(id, 1);
      button.closest('.product-copy').querySelector('.product-feedback').textContent = `Added to demo bag · ${bag.snapshot()[id]} of this item. No order created.`;
      announce(`${records.get(id).name} added to your demo bag. No order was created.`);
    });
  }
  bag.subscribe(items => {
    for (const button of addButtons) {
      const quantity = items[button.dataset.add] || 0;
      const feedback = button.closest('.product-copy').querySelector('.product-feedback');
      if (feedback.textContent) feedback.textContent = quantity ? `${quantity} in your demo bag. No order created.` : 'Removed from demo bag.';
      button.disabled = quantity >= 9;
      button.textContent = button.disabled ? 'Maximum in bag' : 'Add to demo bag';
    }
  });
  inspectButton.addEventListener('click', () => { if(seated){seatNotice=null;if(!seatListener?.(false)){seatNotice='Exit blocked. Use the map to leave safely.';nearbyName.textContent=seatNotice;announce('Exit blocked. Use the map to leave safely.');}scene.focus({preventScroll:true});}else if (nearby) inspectNearby(nearby); });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const target = returnFocus;
    returnFocus = null;
    if (target instanceof HTMLElement && target.isConnected && !target.closest('[hidden]')) {
      target.focus({ preventScroll: true });
    } else {
      (showing3D ? scene : listTitle).focus({ preventScroll: true });
    }
    notifyMode();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const first = closeButton;
    const last = document.getElementById('product-shop');
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  for (const button of document.querySelectorAll('[data-inspect]')) {
    button.hidden = false;
    button.addEventListener('click', () => inspect(button.dataset.inspect));
  }
  function travelToStore(zone){
    const store=destinationById.get(zone);
    if(!showing3D||dialog.open||!store?.available)return;
    if(!interactionRegistry?.dispatch(interactionRegistry.get('travel',zone))){announce('Store travel is unavailable right now. Please try again.');return;}
    if(expanded)document.getElementById('map-destination').value=zone;
    help.open=false;mallMap.open=false;
    announce(`At the ${store.label} storefront.`);scene.focus({preventScroll:true});
  }
  for(const button of mapButtons)button.addEventListener('click',()=>travelToStore(button.dataset.teleport));
  function navigateStore(zone){
    if(showing3D)travelToStore(zone);
    else {storeFilter='all';updateCatalog();const title=document.getElementById(`${zone}-title`) || document.getElementById(zone)?.querySelector('h3');if(!title)return;if(conceptDirectory.contains(title))conceptDirectory.open=true;title.tabIndex=-1;title.scrollIntoView({block:'start'});title.focus({preventScroll:true});}
  }
  function openAmenity(id){
    const storeActions=destinations.filter(store=>store.available).map(store=>({id:store.id,label:{en:`Visit ${store.label}`,'zh-CN':`前往 ${store.label}`},onSelect:()=>navigateStore(store.id)}));
    const directory={id:'directory',label:{en:'Browse store directory','zh-CN':'浏览店铺目录'},onSelect:()=>setView(false,true)};
    if(id==='featured-showcase'){
      return amenityPanel.open({title:{en:'New Moon featured collection','zh-CN':'New Moon 精选产品'},description:{en:'Choose a product to view its official image and details. The display door stays closed; the 3D cans are unofficial visual demonstrations.','zh-CN':'选择产品查看官方图片与详情。展柜门保持关闭，3D 罐身为非官方视觉示意。'},actions:[...document.querySelectorAll('[data-product]')].map(card=>{
        const [country,weight]=card.querySelector('.eyebrow').textContent.split('/').map(value=>value.trim());
        const translated={'New Zealand':'新西兰','Australia':'澳大利亚','South Africa':'南非','Mexico':'墨西哥'}[country]||country;
        return {id:card.dataset.product,label:card.dataset.productName,title:{en:`${country} abalone`,'zh-CN':`${translated}鲍鱼`},description:weight,image:card.dataset.productImage,onSelect:()=>inspect(card.dataset.product)};
      })});
    }else{
      const desk=id==='service-desk';
      return amenityPanel.open({title:desk?{en:'Guest services','zh-CN':'访客服务'}:{en:'Find your store','zh-CN':'寻找店铺'},description:desk?{en:'Choose a store, browse the directory, or review the controls. This is a self-service guide, not a staffed service desk.','zh-CN':'选择店铺、浏览目录或查看操作帮助。此处提供自助指引，并非真人服务台。'}:expanded?{en:'Choose a store to go to its entrance.','zh-CN':'选择店铺即可前往入口。'}:{en:'Ground floor: New Moon on the west, MILI in the centre, GOGO on the east. Choose a store to go to its entrance.','zh-CN':'一楼：New Moon 位于西侧，MILI 位于中央，GOGO 位于东侧。选择店铺即可前往入口。'},actions:[...storeActions,directory,...(desk&&showing3D?[{id:'help',label:{en:'How to explore','zh-CN':'如何探索'},onSelect:()=>showGuide()}]:[])]});
    }
  }
  for(const button of document.querySelectorAll('[data-amenity]')){button.hidden=false;button.addEventListener('click',()=>openAmenity(button.dataset.amenity));}
  document.getElementById('list-title').tabIndex = -1;

  return {
    setInteractionRegistry(registry) {
      interactionRegistry = registry;
      unsubscribeInteractions?.();
      unsubscribeInteractions = registry.subscribe(() => {
        if (available && showing3D) tutorial.report('interact');
      });
      for (const store of destinations) registry.register({id:store.id,kind:'travel',prompt:`Visit ${store.label}`,
        availability:()=>showing3D&&!dialog.open&&store.available,
        handler:()=>teleportListener?.(store.id)});
    },
    describeInteraction(item) {
      if (item.kind === 'open' && item.door) {
        const name = `${destinationById.get(item.door.zone)?.label || 'Store'} door`;
        records.set(item.id, {name, action:'door'});
        return {kind:'open', prompt:() => item.door.targetOpen ? 'Close' : 'Open',
          handler:() => { if (dialog.open || bag.open || amenityPanel.dialog.open) return false; item.door.toggle(); scene.focus({preventScroll:true}); return true; }};
      }
      const record = records.get(item.id);
      const kind = item.kind || (record?.action === 'seat' ? 'sit' : record?.action === 'elevator' ? 'travel' : record?.action === 'map' ? 'open' : 'inspect');
      const prompt = record?.action === 'elevator' ? () => currentElevatorState ? (currentElevatorState.calling ? 'Calling elevator' : currentElevatorState.docked !== (currentZone === 'upper' ? currentElevatorUpper : 0) ? 'Call elevator' : `Ride to ${currentZone === 'upper' ? 'ground floor' : 'upper landing'}`) : 'Change level' : record?.action === 'map' ? 'Map' : kind === 'sit' ? 'Sit' : kind === 'open' ? 'Open' : kind === 'travel' ? 'Travel' : kind === 'pickup' ? 'Pick up' : 'Inspect';
      return {kind, prompt,
        availability: () => records.has(item.id), handler: () => {
          if (dialog.open || bag.open || amenityPanel.dialog.open) return false;
          shelfFocus?.close();
          return (interactionHandlers[records.get(item.id)?.action] || inspect)(item.id);
        }};
    },
    modeSignals,
    clearGuidance() { if (!nearbyDistance.hidden) nearbyDistance.hidden = true; },
    updateGuidance(item, distance, active) {
      const record = item && records.get(item.id);
      const show = active && showing3D && !inspectPrompt.hidden && item?.id === nearby && record && Number.isFinite(distance);
      if (nearbyDistance.hidden === Boolean(show)) nearbyDistance.hidden = !show;
      if (!show) return null;
      const text = `≈${distance.toFixed(1)} m`;
      if (nearbyDistance.textContent !== text) nearbyDistance.textContent = text;
      return record.action === 'brand-story' ? record.brand : record.compactName || (record.action === 'map' ? 'Directory kiosk' : record.action === 'elevator' ? `Elevator · ${currentZone === 'upper' ? 'Upper level' : 'Ground floor'}` : record.name);
    },
    setShelfFocus(controller) {
      shelfFocus = controller;
      bag.subscribe(value => controller.quantities(value));
      // Existing native owners retain their own focus. Cancel before their entry.
      document.getElementById('bag-open').addEventListener('click', () => controller.close({focus: false}), true);
      headerMap.addEventListener('click', () => controller.close({focus: false}), true);
    },
    shelfChanged: notifyMode,
    addToBag(id) { bag.change(id, 1); },
    projectMode(mode) {
      contextNavigation.update({mode, available, destination: showing3D ? 'home' : 'shops',
        host: bag.open ? document.getElementById('context-navigation-bag') : undefined});
    },
    onModeState(listener) { modeListener = listener; },
    configureMallTheme(coordinator) {
      if(!expanded)return;
      mallTheme=coordinator;themeSelect.replaceChildren();
      for(const option of coordinator?.options() || [{id:'everyday',label:'Everyday'}]) {
        const node=document.createElement('option');node.value=option.id;node.textContent=option.label;themeSelect.append(node);
      }
      themeOpen.hidden=false;directoryThemeOpen.hidden=false;updateMallTheme();
    },
    updateMallTheme,
    show3D() {
      available = true;
      updateMallTheme();
      directoryLoading.hidden = true;
      directoryEnter3D.hidden = false;
      for (const button of storeVisitButtons) button.hidden = !destinationById.has(button.dataset.visitStore);
      for (const button of cardStoreButtons) button.hidden = false;
      guideReopen.hidden = false;
      if (railGuide) railGuide.hidden = false;
      viewToggle.hidden = false;
      headerMap.hidden = !showing3D;
      fallbackMessage.hidden = true;
      if (directoryTouched) {
        updateViewToggle();
        notifyMode();
      } else setView(true);
    },
    restored() {
      available = true;
      updateMallTheme();
      directoryLoading.hidden = true;
      directoryEnter3D.hidden = false;
      for (const button of storeVisitButtons) button.hidden = !destinationById.has(button.dataset.visitStore);
      for (const button of cardStoreButtons) button.hidden = false;
      // A validated renderer grants availability, never an automatic view/focus change.
      guideReopen.hidden = false;
      if (railGuide) railGuide.hidden = false;
      viewToggle.hidden = false; return3D.hidden = false;
      updateCartControls();
      fallbackMessage.textContent = 'The 3D mall is available again in Low quality. Return when you are ready. Movement and temporary actions were stopped. Bag selections are unchanged.';
      notifyMode();
      announce(fallbackMessage.textContent);
    },
    fallback(message) {
      // Move focus only when its current 3D control is about to disappear.
      // A user already browsing the directory or header must not be interrupted.
      const active = document.activeElement;
      const recoverFocus = showing3D && (experience.contains(active) || themeDialog.contains(active) ||
        dialog.contains(active) || amenityPanel.dialog.contains(active) || active === viewToggle);
      if (themeDialog.open) themeDialog.close('fallback');
      guideReopen.hidden = true;
      if (railGuide) railGuide.hidden = true;
      setView(false, recoverFocus);
      available = false;
      updateMallTheme();
      directoryLoading.hidden = true;
      directoryEnter3D.hidden = true;
      for (const button of storeVisitButtons) button.hidden = true;
      for (const button of cardStoreButtons) button.hidden = true;
      // Directory fallback can leave setView unchanged, so refresh independently
      // of view/HUD callbacks and recover only disappearing cart-control focus.
      updateCartControls();
      notifyMode();
      viewToggle.hidden = true;
      recovery.hidden = false; return3D.hidden = true;
      fallbackMessage.textContent = message || 'The 3D mall is unavailable on this device. Explore the complete store directory below.';
      fallbackMessage.hidden = false;
      announce(fallbackMessage.textContent);
    },
    update({ zone, x, z, yaw, nearby: nextNearby, interaction = null, collectionActive = false, isSeated = false,seatPhase='idle',seatName=null,elevatorState=null,elevatorUpper=7.2 }) {
      tutorial.reportPose({x,z,yaw});
      if (zone in zones && zone !== currentZone) {
        currentZone = zone;
        const upper=zone==='upper';playerDot.style.display=upper?'none':'';mapCaption.querySelector('.map-key').hidden=upper;floorplan.setAttribute('aria-label',upper?'Ground floor map. Choose a store to return to its entrance.':floorplanLabel);if(mapCaptionText)mapCaptionText.textContent=upper?' Ground floor map ':'You are here';
        if (showing3D) {
          locationName.textContent = zones[zone];
          announce(`Location: ${zones[zone]}.`);
        }
        for (const button of mapButtons) {
          if (button.dataset.teleport === zone) button.setAttribute('aria-current', 'location');
          else button.removeAttribute('aria-current');
        }
      }
      if (Number.isFinite(x) && Number.isFinite(z)) {
        const point=expanded ? expandedMapPoint(x,z) : mapPoint(x,z);
        playerDot.setAttribute('cx', String(point.x));
        playerDot.setAttribute('cy', String(point.y));
      }
      currentElevatorState=elevatorState;currentElevatorUpper=elevatorUpper;
      selectedInteraction = interaction;
      const next = records.has(nextNearby) ? nextNearby : null;
      if (next !== nearby) {
        nearby = next;seatNotice=null;
        document.body.classList.toggle('is-nearby', Boolean(nearby));
        inspectPrompt.hidden = !nearby;
        const product = nearby && records.get(nearby);
        const image = document.getElementById('nearby-image');
        const isShelf = Boolean(product?.image && nearby.startsWith('new-moon-'));
        inspectPrompt.classList.toggle('is-shelf-nearby', isShelf);
        image.hidden = !isShelf;
        if (isShelf) image.src = product.image;
        nearbyName.textContent = isShelf ? product.compactName : product?.action==='brand-story'?`${product.brand} · ${product.tagline}`:product?.name || '';
        const isBrandStory=product?.action==='brand-story';
        nearbyStory.textContent=isBrandStory?product.story:'';
        nearbyStory.hidden=!isBrandStory;
        inspectPrompt.classList.toggle('has-brand-story',isBrandStory);
        const identity = inspectPrompt.querySelector('.nearby-card');
        if (isShelf) { identity.setAttribute('role', 'group'); identity.setAttribute('aria-label', product.name); }
        else { identity.removeAttribute('role'); identity.removeAttribute('aria-label'); }
        const record=product;
        const amenityAction=nearby==='service-desk'?'Get help':nearby?.startsWith('wayfinding-')?'Choose a store':nearby==='featured-showcase'?'View collection':null;
        const isMap = record?.action === 'map';
        const touchOnly = matchMedia('(pointer: coarse)').matches;
        const prompt = typeof selectedInteraction?.prompt === 'function' ? selectedInteraction.prompt() : selectedInteraction?.prompt || 'Inspect';
        inspectButton.textContent = isMap ? (touchOnly ? `Tap to open ${prompt.toLowerCase()}` : `Press F / tap ${prompt}`) : (touchOnly ? `Tap ${prompt}` : `Press F / tap ${prompt}`);
        if (isShelf) inspectButton.textContent = 'Inspect';
        if(isBrandStory)inspectButton.textContent=touchOnly?'Tap story':'Press F / tap story';
        inspectButton.setAttribute('aria-label',isBrandStory?`Read the ${record.brand} brand story`:isMap?expanded?'Open the expanded mall map from the directory kiosk':'Open the three-store map from the directory kiosk':nearby?`Inspect ${records.get(nearby).name}`:'Inspect nearby display');
        if(amenityAction){
          inspectButton.textContent=touchGuide.matches?amenityAction:`Press F / ${amenityAction.toLowerCase()}`;
          inspectButton.setAttribute('aria-label',`${amenityAction}: ${record.name}`);
        }
        if (nearby && showing3D) {
          const name = product.action === 'elevator' ? `Elevator · ${zone === 'upper' ? 'Upper level' : 'Ground floor'}` : product.name;
          announce(`${name}. Nearby interaction selected.`);
        }
      }
      seated=isSeated;document.body.classList.toggle('is-seated',seated);
      if(seated){nearbyName.textContent=`${seatName||'Bench'} · ${seatPhase==='align'?'Aligning':seatPhase==='sit'?'Sitting down':seatPhase==='stand'?'Standing up':'Seated'}`;inspectButton.textContent=seatPhase==='stand'?'Standing up…':seatPhase==='seated'?'Stand up':'Cancel / stand';inspectButton.setAttribute('aria-label',seatPhase==='seated'?'Stand up from bench':'Cancel sitting and stand');}
      else if(nearby&&selectedInteraction?.kind==='sit'){const action=typeof selectedInteraction.prompt==='function'?selectedInteraction.prompt():selectedInteraction.prompt;nearbyName.textContent=`${records.get(nearby).name} · Sit here`;inspectButton.textContent=touchGuide.matches?`Tap ${action}`:`Press F / tap ${action}`;inspectButton.setAttribute('aria-label',`Sit on ${records.get(nearby).name}`);}
      else if(nearby&&selectedInteraction?.kind==='travel'){const action=typeof selectedInteraction.prompt==='function'?selectedInteraction.prompt():selectedInteraction.prompt;nearbyName.textContent=`Elevator · ${zone==='upper'?'Upper level':'Ground floor'}`;inspectButton.textContent=action;inspectButton.setAttribute('aria-label',action);}
      else if(nearby&&selectedInteraction?.kind==='open'&&selectedInteraction.door){const action=typeof selectedInteraction.prompt==='function'?selectedInteraction.prompt():selectedInteraction.prompt;nearbyName.textContent=records.get(nearby).name;inspectButton.textContent=touchGuide.matches?`Tap ${action}`:`Press F / tap ${action}`;inspectButton.setAttribute('aria-label',`${action} ${records.get(nearby).name}`);}
      const iconName=seated||selectedInteraction?.kind==='sit'?'sit':selectedInteraction?.kind==='travel'?'lift':selectedInteraction?.kind==='open'&&selectedInteraction.door?'door':selectedInteraction?.kind==='pickup'?'pick-up':records.get(nearby)?.action==='map'?'map-pin':'quality-inspection';
      if(!interactionIcons.has(iconName))interactionIcons.set(iconName,icon(iconName,{size:18}));
      const actionIcon=interactionIcons.get(iconName);
      if(inspectButton.firstChild!==actionIcon){inspectButton.querySelector('svg')?.remove();inspectButton.prepend(actionIcon);}
      const cart=updateCartControls();
      document.body.classList.toggle('is-pushing',Boolean(cart.active));
      if(nearby&&records.get(nearby).action==='seat'&&cart.active){nearbyName.textContent='Stow your cart from Bag before sitting';inspectButton.disabled=true;}else inspectButton.disabled=seatPhase==='stand';
      if(seatNotice)nearbyName.textContent=seatNotice;
      inspectPrompt.hidden = (!nearby && !seated) || collectionActive;
      notifyMode();
    },
    handleGamepad(pad) {
      const wasThemeOpen=themeDialog.open;
      const handled=handlePanelGamepad(pad,themeDialog.open?themeDialog:amenityPanel.dialog.open?amenityPanel.dialog:dialog.open?dialog:bag.open?bagDialog:help.open?help:mallMap.open?mallMap:!showing3D?document.body:null);
      // Native close queues its event; abort before a pending preparation microtask.
      if(wasThemeOpen&&!themeDialog.open)mallTheme?.cancel();
      return handled;
    },
    paused() {
      const signals=modeSignals();
      return signals.panelOpen||signals.productOpen||signals.bagOpen||signals.shelfOpen;
    },
    offerFirstGuide() { if (canUsePanels()) { notifyMode(); tutorial.offer(); } },
    setExternalPaused(value) { externalPaused = Boolean(value); notifyMode(); },
    inspect,
    inspectNearby,
    onCollect(test, listener) {
      bag.configureCollect(id=>available&&test(id),id=>{
        if(!available||!test(id))return false;
        returnFocus=null;dialog.close('collect');setView(true);scene.focus({preventScroll:true});
        if(!listener(id))return false;
        announce('One item added to demo bag. Simplified collection gesture, not a physical shelf pickup.');
        return true;
      });
    },
    onCart(state,listener){cartState=state;cartListener=listener;},
    setElevator(listener){addMapService('visitor-lift','L','Visitor lift',liftLayout);records.set('visitor-elevator',{name:'Elevator · Change level',action:'elevator'});elevatorListener=listener;},
    setSeats(seats){for(const seat of seats)records.set(seat.id,{name:seat.name,action:'seat'});},
    setBrandStories(stories){for(const [id,record] of Object.entries(stories))records.set(id,record);},
    onSeat(listener){seatListener=listener;},
    onBagChange(listener) { return bag.subscribe(listener); },
    onTeleport(listener) {
      teleportListener = listener;
    },
    onView(listener) {
      viewListener = listener;
      listener(showing3D);
    },
  };
}
