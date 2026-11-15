import {createActionDialog} from '../../../../../assets/onboarding/action-dialog.js';
import {createOnboarding} from '../../../../../assets/onboarding/onboarding.js';
import {createExperienceProfile} from '../../../../../assets/onboarding/profiles.js';
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
import {createContextNavigation} from './context-navigation.js';
import {setupDemoBag} from './demo-bag.js';
import {setupNewMoonPreview} from './newmoon-detail-preview.js';

export function createUI() {
  const scene = document.getElementById('scene');
  const experience = document.getElementById('experience');
  const storeList = document.getElementById('store-list');
  const viewToggle = document.getElementById('view-toggle');
  const directoryEnter3D = document.getElementById('directory-enter-3d');
  const visitNewMoon3D = document.getElementById('visit-newmoon-3d');
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
  document.getElementById('graphics-reload').addEventListener('click', () => location.reload());
  return3D.addEventListener('click', () => { if (available) setView(true, true); });
  const playerDot = document.getElementById('player-dot');
  const floorplan=document.querySelector('.floorplan'),floorplanLabel=floorplan.getAttribute('aria-label'),mapCaption=document.querySelector('.map-caption');
  const mapCaptionText=[...mapCaption.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.includes('You are here'));
  const inspectPrompt = document.getElementById('inspect-prompt');
  const inspectButton = document.getElementById('inspect');
  const nearbyName = document.getElementById('nearby-name');
  const nearbyDistance = document.getElementById('nearby-distance');
  const help = document.getElementById('keyboard-help');
  const mallMap = document.getElementById('mall-map');
  let guideFromHUD=false;
  const guideFooter=document.createElement('div');guideFooter.id='context-navigation-guide';guideFooter.className='context-navigation-footer';
  const onboarding = createOnboarding({...createExperienceProfile('mall'), id:'guide', storageKey:'gjh-v11', scene, footer:guideFooter,
    modes:['keyboard','touch','gamepad'], showHelpEntry:false, onHelp:openHelp, onBack:closeGamepadPanel, canOpen:()=>available&&showing3D&&!dialog.open&&!bag.open&&!amenityPanel.dialog.open&&!externalPaused, onOpen:()=>{guidePaused=true;guideFromHelp=document.activeElement===guideReopen;guideFromHUD=Boolean(document.activeElement.closest('.ob-hud'));notifyMode();} });
  const guide = onboarding.dialog;
  const amenityPanel=createActionDialog({id:'amenity-dialog',scene,getPreferences:()=>onboarding.preferences,onOpen:()=>notifyMode(),onClose:()=>notifyMode()});
  let previousTutorialPose = null;
  let guideFromHelp = false;
  const guideReopen = document.getElementById('guide-reopen');
  const guideSessionKey = 'gjh-v11-guide-seen-v1';
  const touchGuide = matchMedia('(pointer: coarse)');
  let guideSeen = false, guidePaused = false;
  try { guideSeen = sessionStorage.getItem(guideSessionKey) === '1'; } catch { /* Storage may be unavailable; keep this page usable. */ }
  let modeListener = null, shelfFocus = null;
  const modeSignals = () => ({productOpen: document.getElementById('product-dialog').open || externalPaused || document.getElementById('original-tin-dialog').open,
    bagOpen: document.getElementById('bag-dialog').open, shelfOpen: Boolean(shelfFocus?.open),
    panelOpen: amenityPanel.dialog.open || !showing3D || guidePaused || guide.open || (compactMap.matches && (help.open || mallMap.open))});
  function syncOnboardingSuspension(signals) {
    // Contextual tips yield to the scene action HUD instead of covering its controls.
    const actionHUD = showing3D && (!inspectPrompt.hidden || cartState().active || cartState().heldProduct);
    onboarding.setHUDSuppressed(Boolean(actionHUD));
    onboarding.setSuspended(amenityPanel.dialog.open || signals.productOpen || signals.bagOpen || signals.shelfOpen || !showing3D || help.open || (compactMap.matches && mallMap.open));
  }
  const notifyMode = () => {
    const signals = modeSignals();
    syncOnboardingSuspension(signals);
    if (signals.shelfOpen && (signals.productOpen || signals.bagOpen || signals.panelOpen)) shelfFocus.close({focus: false});
    modeListener?.(modeSignals());
  };
  const compactMap = matchMedia('(max-width: 650px), (max-height: 560px) and (orientation: landscape)');
  function updateCompactPanels(){const paused=compactMap.matches&&(mallMap.open||help.open);document.body.classList.toggle('is-panel-open',paused);}
  let mapReturnFocus=headerMap;
  // Header, kiosk and quick guide share this map owner. The map's own
  // summary is not a second permanent entry on compact screens.
  function canUsePanels() {
    return available && showing3D && !guidePaused && !guide.open && !dialog.open && !bag.open && !amenityPanel.dialog.open && !externalPaused && !document.hidden;
  }
  function openMap() {
    if (!canUsePanels()) return false;
    shelfFocus?.close({focus: false});
    help.open = false; mapReturnFocus = headerMap;
    mallMap.open = true; headerMap.setAttribute('aria-expanded', String(compactMap.matches)); updateCompactPanels(); focusMap();
    return true;
  }
  function closeMap() {
    if (!compactMap.matches || !canUsePanels()) return;
    mallMap.open = false; headerMap.setAttribute('aria-expanded', 'false'); updateCompactPanels(); notifyMode();
    (compactMap.matches ? headerMap : scene).focus({preventScroll: true});
  }
  function openHelp() {
    if (!canUsePanels()) return false;
    shelfFocus?.close({focus: false});
    if (compactMap.matches) mallMap.open = false;
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
  help.querySelector('summary').addEventListener('click', event => { if (!canUsePanels()) event.preventDefault(); });
  document.getElementById('map-close').addEventListener('click', closeMap);
  function updateViewToggle() {
    viewToggle.textContent = showing3D ? (compactMap.matches ? 'Stores' : 'Store directory') : 'Enter 3D Mall';
    viewToggle.setAttribute('aria-label', showing3D ? 'Switch to the accessible store directory' : 'Switch to the 3D virtual mall');
  }
  const resetMap = () => { mallMap.open = !guide.open && !compactMap.matches; };
  resetMap();
  compactMap.addEventListener('change', () => {
    const active = document.activeElement;
    resetMap(); updateViewToggle();
    headerMap.hidden = !showing3D || !compactMap.matches;
    headerMap.setAttribute('aria-expanded', String(compactMap.matches && mallMap.open));updateCompactPanels();
    // A details element may stay open across this breakpoint. Publish regardless
    // of toggle events and recover focus only if its control just became hidden.
    if (showing3D && ((active === headerMap && headerMap.hidden) ||
        (mallMap.contains(active) && !mallMap.open && active !== mallMap.querySelector('summary')))) {
      if (shelfFocus?.open) shelfFocus.focus();
      else (compactMap.matches ? headerMap : scene).focus({preventScroll: true});
    }
    notifyMode();
  });
  mallMap.addEventListener('toggle', () => {
    if (compactMap.matches && mallMap.open) help.open = false;
    headerMap.setAttribute('aria-expanded', String(compactMap.matches && mallMap.open));updateCompactPanels();
    notifyMode();
  });
  help.addEventListener('toggle', () => { if (compactMap.matches && help.open) mallMap.open = false; headerMap.setAttribute('aria-expanded', 'false'); updateCompactPanels(); notifyMode(); });
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
      if (guide.open) { guide.close('start'); return; }
      setView(true, !bag.open);
      if (bag.open) bag.closeTo(scene);
      else scene.focus({preventScroll: true});
      notifyMode();
    },
    onShops() {
      if (guide.open) { guide.close('list'); return; }
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
  const modePanels = [amenityPanel.dialog, dialog, bagDialog, help, guide, mallMap, document.getElementById('original-tin-dialog')];
  const modeObserver = new MutationObserver(notifyMode);
  for (const panel of modePanels) modeObserver.observe(panel, {attributes: true, attributeFilter: ['open']});
  for (const panel of [dialog, bagDialog]) panel.addEventListener('close', notifyMode);
  const closeButton = document.getElementById('product-close');
  const productTitle = document.getElementById('product-title');
  const productImage = document.getElementById('product-image');
  const productDescription = document.getElementById('product-description');
  const productKind = document.getElementById('product-kind');
  const mapButtons = [...document.querySelectorAll('[data-teleport]')];
  function focusMap() {
    // Publish the footer reservation before revealing the focused destination.
    notifyMode();
    mapButtons[0]?.focus({preventScroll: true});
    mapButtons[0]?.scrollIntoView({block: 'nearest', behavior: 'instant'});
  }
  let seated=false, seatNotice=null, seatListener=null, elevatorListener=null, cartListener=null, cartState=()=>({available:false,active:false}), previousCartMode=null,previousCartSeated=null,previousCartAvailable=null,previousHeldProduct=null,previousElevatorTravel=false;
  const cartControls=document.querySelector('#cart-controls'),cartToggle=document.querySelector('#cart-toggle'),cartStatus=document.querySelector('#cart-status');
  const sceneCart=document.querySelector('#scene-cart');
  function updateCartControls() {
    const cart=cartState();
    const recoverFocus=!cart.available&&bag.open&&cartControls.contains(document.activeElement);
    cartControls.hidden=!cart.available;
    cartToggle.textContent=cart.active?'Stow cart':'Use cart in 3D';
    cartToggle.disabled=!cart.available||(cart.seated&&!cart.active);
    sceneCart.hidden=!cart.available||!showing3D||(compactMap.matches&&(mallMap.open||help.open));
    sceneCart.textContent=cart.active?'Stow cart':'Cart';
    sceneCart.setAttribute('aria-pressed',String(cart.active));
    sceneCart.disabled=cartToggle.disabled;
    if(previousCartAvailable!==cart.available||previousCartMode!==cart.active||previousCartSeated!==cart.seated||previousHeldProduct!==cart.heldProduct||previousElevatorTravel!==cart.elevatorTravel){
      cartStatus.textContent=!cart.available?'The 3D cart is unavailable. Your bag selection is unchanged.':cart.heldProduct?heldInstruction(cart):cart.elevatorTravel?'Wait for the elevator to stop.':cart.seated?'Stand up before using the cart.':cart.active?'Cart active. Slower walking with a wide turning clearance; stow before sitting.':'Cart stowed. Bag selection unchanged. Use an open area; narrow aisles may require stowing.';
      previousCartAvailable=cart.available;previousCartMode=cart.active;previousCartSeated=cart.seated;previousHeldProduct=cart.heldProduct;previousElevatorTravel=cart.elevatorTravel;
    }
    if(recoverFocus)document.getElementById('bag-close').focus({preventScroll:true});
    return cart;
  }
  function heldInstruction(state){return `Return ${records.get(state.heldProduct)?.compactName||'the held product'} to its New Moon shelf first.`;}
  function toggleCart(){const state=cartState();if(!state.available){updateCartControls();return;}const next=!state.active;const ok=cartListener?.(next);if(!ok){const message=state.heldProduct?heldInstruction(state):state.seated?'Stand up before using the cart.':state.elevatorTravel?'Wait for the elevator to stop.':'Cart needs about 3 metres of clear floor. Move away from walls, shelves and furniture; try the open MILI entrance.';cartStatus.textContent=message;announce(message);if(!bag.open)document.querySelector('#bag-open').click();return;}
    if(next){setView(true);bag.closeTo(scene);}
    cartStatus.textContent=next?'Cart active. Slower walking; stow before sitting. Your bag selection is unchanged.':'Cart stowed. Your bag selection is unchanged.';
    sceneCart.setAttribute('aria-pressed',String(next));scene.focus({preventScroll:true});
  }
  cartToggle.addEventListener('click',toggleCart);sceneCart.addEventListener('click',toggleCart);
  const records = new Map([['courtyard-seat',{name:'Courtyard bench',action:'seat'}],['mall-directory', {name: 'Directory kiosk · Decorative screen', action: 'map'}]]);
  for(const [id,name] of [['service-desk','Guest services'],['wayfinding-west','Store directions'],['wayfinding-east','Store directions'],['featured-showcase','New Moon featured collection']])records.set(id,{name,action:'amenity'});
  const zones = { atrium: 'The courtyard', newmoon: 'New Moon', mili: 'MILI', gogo: 'GOGO', upper: 'Upper level' };
  let available = false;
  let showing3D = false;
  let currentZone = 'atrium';
  let externalPaused = false;
  let nearby = null;
  let returnFocus = null;
  let teleportListener = null;
  let viewListener = null;
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!showing3D||!compactMap.matches||dialog.open||bag.open||guide.open||amenityPanel.dialog.open)return;
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

  function setView(show, moveFocus = false) {
    const next = show && available;
    if (next === showing3D) return;
    shelfFocus?.close({focus: false});
    if (dialog.open) dialog.close();
    amenityPanel.close('view-change');
    if (guide.open) guide.close('view-change');
    showing3D = next;
    onboarding.setVisible(next);
    experience.hidden = !next;
    storeList.hidden = next;
    document.body.classList.toggle('is-3d', next);
    updateViewToggle();
    help.open = false;
    headerMap.hidden = !next || !compactMap.matches;
    headerMap.setAttribute('aria-expanded', String(next && compactMap.matches && mallMap.open));
    if (moveFocus) (next ? scene : document.getElementById('list-title')).focus({ preventScroll: true });
    announce(next ? `3D mall open. Location: ${zones[currentZone]}. Open Help for controls.` : 'Store directory open. All three stores and verified product images are available below.');
    viewListener?.(next);
    notifyMode();
  }

  function inspect(id) {
    const record = records.get(id);
    if (!record || dialog.open || bag.open || guidePaused || amenityPanel.dialog.open) return;
    shelfFocus?.close();
    if(record.action==='amenity'){openAmenity(id);return;}
    if(record.action==='elevator'){const ok=elevatorListener?.();announce(ok?'Elevator travelling to the other level.':'Return held products and stow the cart before travelling.');scene.focus({preventScroll:true});return;}
    if(record.action==='seat'){const ok=seatListener?.(true,id);seatNotice=null;if(!ok){seatNotice=cartState().heldProduct?heldInstruction(cartState()):'Seat path blocked. Approach the clear front of the bench.';nearbyName.textContent=seatNotice;announce(seatNotice);}scene.focus({preventScroll:true});return;}
    if (record.action === 'map') {
      if (openMap()) announce('The kiosk screen is decorative. Use this three-store map to choose an entrance.');
      return;
    }
    returnFocus = document.activeElement;
    onboarding.report('inspect');
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
  }

  function inspectNearby(id) {
    // Product Inspect is the detail action. The shelf remains an owned
    // presentation mode for retained lifecycle/fallback coverage, but it must
    // not be an intermediate click for a nearby SKU: the readable product
    // viewer is the first surface opened from the user's Inspect action.
    inspect(id);
  }

  function showGuide(event) {
    if (!available || !showing3D || guide.open || dialog.open || bag.open || amenityPanel.dialog.open || externalPaused || document.hidden) return false;
    shelfFocus?.close({focus: false});
    guideFromHelp = event?.currentTarget === guideReopen;
    help.open = false; mallMap.open = false;
    return onboarding.openWelcome();
  }
  guideReopen.addEventListener('click', showGuide);
  guide.addEventListener('close', () => {
    guidePaused = false;
    const action = guide.returnValue;
    if (action === 'fallback' || action === 'view-change') return;
    guideSeen = true;
    try { sessionStorage.setItem(guideSessionKey, '1'); } catch { /* The in-memory flag still prevents repeated automatic prompts. */ }
    if (!available || !showing3D) return;
    if (action === 'list') { setView(false, true); focusDirectory(); return; }
    if (action === 'map') {
      if (openMap()) announce('Choose a store on the map. Your location has not changed.');
      return;
    }
    if (action === 'dismiss' && guideFromHelp) {
      help.open = true; guideReopen.focus({preventScroll: true});
    } else if(!guideFromHUD) scene.focus({preventScroll: true});
    const target = nearby ? records.get(nearby) : null;
    const touch = matchMedia('(pointer: coarse)').matches;
    const hint = target
      ? `${target.name}. ${target.action === 'map' ? (touch ? 'Tap Map' : 'press F or tap Map') : (touch ? 'Tap Inspect' : 'press F or tap Inspect')} for details.`
      : 'Open Help to review the controls.';
    announce(`Ready to explore. ${hint}`);
  });

  // Keep the guide's blocking lifetime through its native close action, so a
  // guide-to-map/list handoff never briefly resumes the covered gameplay.
  guide.addEventListener('close', notifyMode);

  viewToggle.addEventListener('click', () => setView(!showing3D, true));
  directoryEnter3D.addEventListener('click', () => setView(true, true));
  function visitNewMoon() {
    if (!available) return;
    setView(true);
    travelToStore('newmoon');
  }
  visitNewMoon3D.addEventListener('click', visitNewMoon);
  const cardStoreButtons = [...document.querySelectorAll('[data-visit-newmoon]')];
  for (const button of cardStoreButtons) button.addEventListener('click', visitNewMoon);
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
    if(!showing3D||dialog.open||guidePaused)return;
    help.open=false;if(compactMap.matches)mallMap.open=false;
    teleportListener?.(zone);announce(`At the ${zones[zone]} storefront.`);scene.focus({preventScroll:true});
  }
  for(const button of mapButtons)button.addEventListener('click',()=>travelToStore(button.dataset.teleport));
  function navigateStore(zone){
    if(showing3D)travelToStore(zone);
    else {storeFilter='all';updateCatalog();const title=document.getElementById(`${zone}-title`);title.tabIndex=-1;title.scrollIntoView({block:'start'});title.focus({preventScroll:true});}
  }
  function openAmenity(id){
    const storeActions=['newmoon','mili','gogo'].map(zone=>({id:zone,label:{en:`Visit ${zones[zone]}`,'zh-CN':`前往 ${zones[zone]}`},onSelect:()=>navigateStore(zone)}));
    const directory={id:'directory',label:{en:'Browse store directory','zh-CN':'浏览店铺目录'},onSelect:()=>setView(false,true)};
    if(id==='featured-showcase'){
      amenityPanel.open({title:{en:'New Moon featured collection','zh-CN':'New Moon 精选产品'},description:{en:'Choose a product to view its official image and details. The display door stays closed; the 3D cans are unofficial visual demonstrations.','zh-CN':'选择产品查看官方图片与详情。展柜门保持关闭，3D 罐身为非官方视觉示意。'},actions:[...document.querySelectorAll('[data-product]')].map(card=>{
        const [country,weight]=card.querySelector('.eyebrow').textContent.split('/').map(value=>value.trim());
        const translated={'New Zealand':'新西兰','Australia':'澳大利亚','South Africa':'南非','Mexico':'墨西哥'}[country]||country;
        return {id:card.dataset.product,label:card.dataset.productName,title:{en:`${country} abalone`,'zh-CN':`${translated}鲍鱼`},description:weight,image:card.dataset.productImage,onSelect:()=>inspect(card.dataset.product)};
      })});
    }else{
      const desk=id==='service-desk';
      amenityPanel.open({title:desk?{en:'Guest services','zh-CN':'访客服务'}:{en:'Find your store','zh-CN':'寻找店铺'},description:desk?{en:'Choose a store, browse the directory, or review the controls. This is a self-service guide, not a staffed service desk.','zh-CN':'选择店铺、浏览目录或查看操作帮助。此处提供自助指引，并非真人服务台。'}:{en:'Ground floor: New Moon on the west, MILI in the centre, GOGO on the east. Choose a store to go to its entrance.','zh-CN':'一楼：New Moon 位于西侧，MILI 位于中央，GOGO 位于东侧。选择店铺即可前往入口。'},actions:[...storeActions,directory,...(desk&&showing3D?[{id:'help',label:{en:'How to explore','zh-CN':'如何探索'},onSelect:()=>showGuide()}]:[])]});
    }
  }
  for(const button of document.querySelectorAll('[data-amenity]')){button.hidden=false;button.addEventListener('click',()=>openAmenity(button.dataset.amenity));}
  document.getElementById('list-title').tabIndex = -1;

  return {
    modeSignals,
    clearGuidance() { if (!nearbyDistance.hidden) nearbyDistance.hidden = true; },
    updateGuidance(item, distance, active) {
      const record = item && records.get(item.id);
      const show = active && showing3D && !inspectPrompt.hidden && item?.id === nearby && record && Number.isFinite(distance);
      if (nearbyDistance.hidden === Boolean(show)) nearbyDistance.hidden = !show;
      if (!show) return null;
      const text = `≈${distance.toFixed(1)} m`;
      if (nearbyDistance.textContent !== text) nearbyDistance.textContent = text;
      return record.compactName || (record.action === 'map' ? 'Directory kiosk' : record.action === 'elevator' ? `Elevator · ${currentZone === 'upper' ? 'Upper level' : 'Ground floor'}` : record.name);
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
        host: bag.open ? document.getElementById('context-navigation-bag') :
          guide.open ? document.getElementById('context-navigation-guide') : undefined});
    },
    onModeState(listener) { modeListener = listener; },
    show3D() {
      available = true;
      directoryLoading.hidden = true;
      directoryEnter3D.hidden = false;
      visitNewMoon3D.hidden = false;
      for (const button of cardStoreButtons) button.hidden = false;
      guideReopen.hidden = false;
      viewToggle.hidden = false;
      headerMap.hidden = !showing3D || !compactMap.matches;
      fallbackMessage.hidden = true;
      if (directoryTouched) {
        updateViewToggle();
        notifyMode();
      } else setView(true);
    },
    restored() {
      available = true;
      directoryLoading.hidden = true;
      directoryEnter3D.hidden = false;
      visitNewMoon3D.hidden = false;
      for (const button of cardStoreButtons) button.hidden = false;
      // A validated renderer grants availability, never an automatic view/focus change.
      guideSeen = true; guideReopen.hidden = false;
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
      const recoverFocus = showing3D && (experience.contains(active) || guide.contains(active) ||
        dialog.contains(active) || amenityPanel.dialog.contains(active) || active === viewToggle);
      if (guide.open) guide.close('fallback');
      guidePaused = false; guideReopen.hidden = true;
      setView(false, recoverFocus);
      available = false;
      directoryLoading.hidden = true;
      directoryEnter3D.hidden = true;
      visitNewMoon3D.hidden = true;
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
    update({ zone, x, z, yaw, nearby: nextNearby, collectionActive = false, isSeated = false,seatPhase='idle',seatName=null }) {
      if (!guidePaused && showing3D && previousTutorialPose) {
        if (Math.hypot(x-previousTutorialPose.x,z-previousTutorialPose.z)>.02) onboarding.report('move');
        if (Math.abs(yaw-previousTutorialPose.yaw)>.01) onboarding.report('look');
      }
      previousTutorialPose={x,z,yaw};
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
        playerDot.setAttribute('cx', String((Math.max(-15, Math.min(15, x)) + 15) * 10));
        playerDot.setAttribute('cy', String((Math.max(-11, Math.min(18, z)) + 11) * 10));
      }
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
        nearbyName.textContent = isShelf ? product.compactName : product?.name || '';
        const identity = inspectPrompt.querySelector('.nearby-card');
        if (isShelf) { identity.setAttribute('role', 'group'); identity.setAttribute('aria-label', product.name); }
        else { identity.removeAttribute('role'); identity.removeAttribute('aria-label'); }
        const record=product;
        const amenityAction=nearby==='service-desk'?'Get help':nearby?.startsWith('wayfinding-')?'Choose a store':nearby==='featured-showcase'?'View collection':null;
        const isMap = record?.action === 'map';
        const touchOnly = matchMedia('(pointer: coarse)').matches;
        inspectButton.textContent = isMap ? (touchOnly ? 'Tap to open map' : 'Press F / tap Map') : (touchOnly ? 'Tap Inspect' : 'Press F / tap Inspect');
        if (isShelf) inspectButton.textContent = 'Inspect';
        inspectButton.setAttribute('aria-label', isMap ? 'Open the three-store map from the directory kiosk' : nearby ? `Inspect ${records.get(nearby).name}` : 'Inspect nearby display');
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
      else if(nearby&&records.get(nearby).action==='seat'){nearbyName.textContent=`${records.get(nearby).name} · Sit here`;inspectButton.textContent=touchGuide.matches?'Tap Sit':'Press F / tap Sit';inspectButton.setAttribute('aria-label',`Sit on ${records.get(nearby).name}`);}
      else if(nearby&&records.get(nearby).action==='elevator'){nearbyName.textContent=`Elevator · ${zone==='upper'?'Upper level':'Ground floor'}`;inspectButton.textContent='Change level';inspectButton.setAttribute('aria-label','Use elevator to change levels');}
      const cart=updateCartControls();
      document.body.classList.toggle('is-pushing',Boolean(cart.active));
      if(nearby&&records.get(nearby).action==='seat'&&cart.active){nearbyName.textContent='Stow your cart from Bag before sitting';inspectButton.disabled=true;}else inspectButton.disabled=seatPhase==='stand';
      if(seatNotice)nearbyName.textContent=seatNotice;
      inspectPrompt.hidden = (!nearby && !seated) || collectionActive;
      notifyMode();
    },
    handleGamepad(pad) { return onboarding.handleGamepad(pad,amenityPanel.dialog.open?amenityPanel.dialog:dialog.open?dialog:bag.open?bagDialog:help.open?help:compactMap.matches&&mallMap.open?mallMap:!showing3D?document.body:null); },
    paused() {
      const signals=modeSignals();
      syncOnboardingSuspension(signals);
      return signals.panelOpen||signals.productOpen||signals.bagOpen||signals.shelfOpen;
    },
    offerFirstGuide() { if (!guideSeen && onboarding.shouldAutoShow) showGuide(); },
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
    setElevator(listener){records.set('visitor-elevator',{name:'Elevator · Change level',action:'elevator'});elevatorListener=listener;},
    setSeats(seats){for(const seat of seats)records.set(seat.id,{name:seat.name,action:'seat'});},
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
