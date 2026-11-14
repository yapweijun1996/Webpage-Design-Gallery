export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
import {setupDemoBag} from './demo-bag.js';
import {setupNewMoonPreview} from './newmoon-detail-preview.js';

export function createUI() {
  const scene = document.getElementById('scene');
  const experience = document.getElementById('experience');
  const storeList = document.getElementById('store-list');
  const viewToggle = document.getElementById('view-toggle');
  const locationName = document.getElementById('location-name');
  const status = document.getElementById('mall-status');
  const fallbackMessage = document.getElementById('fallback-message');
  const playerDot = document.getElementById('player-dot');
  const inspectPrompt = document.getElementById('inspect-prompt');
  const inspectButton = document.getElementById('inspect');
  const nearbyName = document.getElementById('nearby-name');
  const help = document.getElementById('keyboard-help');
  const mallMap = document.getElementById('mall-map');
  const guide = document.getElementById('guide-dialog');
  const guideClose = document.getElementById('guide-close');
  const guideTitle = document.getElementById('guide-title');
  let guideFromHelp = false;
  const guideStart = document.getElementById('guide-start');
  const guideMap = document.getElementById('guide-map');
  const guideList = document.getElementById('guide-list');
  const guideReopen = document.getElementById('guide-reopen');
  const guideSessionKey = 'gjh-v11-guide-seen-v1';
  const touchGuide = matchMedia('(pointer: coarse)');
  let guideSeen = false, guidePaused = false;
  try { guideSeen = sessionStorage.getItem(guideSessionKey) === '1'; } catch { /* Storage may be unavailable; keep this page usable. */ }
  function updateGuideInput() {
    guide.querySelector('[data-guide-desktop]').hidden = touchGuide.matches;
    guide.querySelector('[data-guide-touch]').hidden = !touchGuide.matches;
  }
  updateGuideInput(); touchGuide.addEventListener('change', updateGuideInput);
  const compactMap = matchMedia('(max-width: 650px), (max-height: 560px) and (orientation: landscape)');
  const resetMap = () => { mallMap.open = !guide.open && !compactMap.matches; };
  resetMap();
  compactMap.addEventListener('change', resetMap);
  mallMap.addEventListener('toggle', () => { if (compactMap.matches && mallMap.open) help.open = false; });
  help.addEventListener('toggle', () => { if (compactMap.matches && help.open) mallMap.open = false; });
  mallMap.addEventListener('keydown', event => {
    if (event.key === 'Escape' && compactMap.matches && mallMap.open) {
      mallMap.open = false;
      mallMap.querySelector('summary').focus();
    }
  });
  const dialog = document.getElementById('product-dialog');
  const newMoonPreview = setupNewMoonPreview();
  const bag = setupDemoBag();
  const closeButton = document.getElementById('product-close');
  const productTitle = document.getElementById('product-title');
  const productImage = document.getElementById('product-image');
  const productDescription = document.getElementById('product-description');
  const productKind = document.getElementById('product-kind');
  const mapButtons = [...document.querySelectorAll('[data-teleport]')];
  const records = new Map([['mall-directory', {name: 'Directory kiosk · Decorative screen', action: 'map'}]]);
  const zones = { atrium: 'The courtyard', newmoon: 'New Moon', mili: 'MILI', gogo: 'GOGO' };
  let available = false;
  let showing3D = false;
  let currentZone = 'atrium';
  let externalPaused = false;
  let nearby = null;
  let returnFocus = null;
  let teleportListener = null;
  let viewListener = null;

  for (const card of document.querySelectorAll('[data-product]')) {
    records.set(card.dataset.product, {
      name: card.dataset.productName,
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
    if (dialog.open) dialog.close();
    if (guide.open) guide.close('view-change');
    showing3D = next;
    experience.hidden = !next;
    storeList.hidden = next;
    document.body.classList.toggle('is-3d', next);
    viewToggle.textContent = next ? 'List view' : '3D view';
    viewToggle.setAttribute('aria-label', next ? 'Switch to the accessible store directory' : 'Switch to the 3D virtual mall');
    locationName.textContent = next ? zones[currentZone] : 'The store directory';
    help.open = false;
    if (moveFocus) (next ? scene : document.getElementById('list-title')).focus({ preventScroll: true });
    announce(next ? `3D mall open. Location: ${zones[currentZone]}. Open How to explore for controls.` : 'Store directory open. All three stores and verified product images are available below.');
    viewListener?.(next);
  }

  function inspect(id) {
    const record = records.get(id);
    if (!record || dialog.open || bag.open || guidePaused) return;
    if (record.action === 'map') {
      if (!available || !showing3D) return;
      help.open = false; mallMap.open = true;
      mapButtons[0]?.focus({preventScroll: true});
      announce('The kiosk screen is decorative. Use this three-store map to choose an entrance.');
      return;
    }
    returnFocus = document.activeElement;
    productTitle.textContent = record.name;
    productImage.src = record.image;
    productImage.alt = record.alt;
    productKind.textContent = record.kind;
    productDescription.textContent = record.description;
    newMoonPreview.open(id);
    bag.select(id);
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }

  function showGuide(event) {
    if (!available || !showing3D || guide.open || dialog.open || bag.open || externalPaused || document.hidden) return false;
    guideFromHelp = event?.currentTarget === guideReopen;
    help.open = false; mallMap.open = false;
    guidePaused = true;
    guide.showModal(); guideTitle.focus({preventScroll: true});
    return true;
  }
  guideClose.addEventListener('click', () => guide.close('dismiss'));
  guideStart.addEventListener('click', () => guide.close('start'));
  guideMap.addEventListener('click', () => guide.close('map'));
  guideList.addEventListener('click', () => guide.close('list'));
  guideReopen.addEventListener('click', showGuide);
  guide.addEventListener('cancel', event => { event.preventDefault(); guide.close('dismiss'); });
  guide.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    if (event.shiftKey && [guideTitle,guideClose].includes(document.activeElement)) { event.preventDefault(); guideList.focus(); }
    else if (!event.shiftKey && document.activeElement === guideList) { event.preventDefault(); guideClose.focus(); }
  });
  guide.addEventListener('close', () => {
    guidePaused = false;
    const action = guide.returnValue;
    if (action === 'fallback' || action === 'view-change') return;
    guideSeen = true;
    try { sessionStorage.setItem(guideSessionKey, '1'); } catch { /* The in-memory flag still prevents repeated automatic prompts. */ }
    if (!available || !showing3D) return;
    if (action === 'list') { setView(false, true); return; }
    if (action === 'map') {
      help.open = false; mallMap.open = true;
      mapButtons[0]?.focus({preventScroll: true});
      announce('Choose a store on the map. Your location has not changed.');
      return;
    }
    if (action === 'dismiss' && guideFromHelp) {
      help.open = true; guideReopen.focus({preventScroll: true});
    } else scene.focus({preventScroll: true});
    announce('Ready to explore. Open How to explore to review the controls.');
  });

  viewToggle.addEventListener('click', () => setView(!showing3D, true));
  inspectButton.addEventListener('click', () => { if (nearby) inspect(nearby); });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const target = returnFocus;
    returnFocus = null;
    if (target instanceof HTMLElement && target.isConnected && !target.closest('[hidden]')) {
      target.focus({ preventScroll: true });
    } else if (showing3D) {
      scene.focus({ preventScroll: true });
    }
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
  for (const button of mapButtons) {
    button.addEventListener('click', () => {
      if (!showing3D || dialog.open || guidePaused) return;
      help.open = false;
      if (compactMap.matches) mallMap.open = false;
      teleportListener?.(button.dataset.teleport);
      announce(`At the ${zones[button.dataset.teleport]} storefront.`);
      scene.focus({ preventScroll: true });
    });
  }
  document.getElementById('list-title').tabIndex = -1;

  return {
    show3D() {
      available = true;
      guideReopen.hidden = false;
      viewToggle.hidden = false;
      fallbackMessage.hidden = true;
      setView(true);
    },
    fallback(message) {
      // Move focus only when its current 3D control is about to disappear.
      // A user already browsing the directory or header must not be interrupted.
      const active = document.activeElement;
      const recoverFocus = showing3D && (experience.contains(active) || guide.contains(active) ||
        dialog.contains(active) || active === viewToggle);
      if (guide.open) guide.close('fallback');
      guidePaused = false; guideReopen.hidden = true;
      setView(false, recoverFocus);
      available = false;
      viewToggle.hidden = true;
      fallbackMessage.textContent = message || 'The 3D mall is unavailable on this device. Explore the complete store directory below.';
      fallbackMessage.hidden = false;
      announce(fallbackMessage.textContent);
    },
    update({ zone, x, z, nearby: nextNearby }) {
      if (zone in zones && zone !== currentZone) {
        currentZone = zone;
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
        nearby = next;
        document.body.classList.toggle('is-nearby', Boolean(nearby));
        inspectPrompt.hidden = !nearby;
        nearbyName.textContent = nearby ? records.get(nearby).name : '';
        const isMap = nearby && records.get(nearby).action === 'map';
        inspectButton.textContent = isMap ? 'Press F / tap Map' : 'Press F / tap Inspect';
        inspectButton.setAttribute('aria-label', isMap ? 'Open the three-store map from the directory kiosk' : nearby ? `Inspect ${records.get(nearby).name}` : 'Inspect nearby display');
        if (nearby && showing3D) announce(isMap ? 'Directory kiosk. Decorative screen. Press F or tap Map for the three-store map.' : `${records.get(nearby).name}. Press F or tap Inspect for details.`);
      }
    },
    paused() {
      return guidePaused || externalPaused || !showing3D || dialog.open || bag.open;
    },
    offerFirstGuide() { if (!guideSeen) showGuide(); },
    setExternalPaused(value) { externalPaused = Boolean(value); },
    inspect,
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
