export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const compactMap = matchMedia('(max-width: 650px), (max-height: 560px) and (orientation: landscape)');
  const resetMap = () => { mallMap.open = !compactMap.matches; };
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
  const closeButton = document.getElementById('product-close');
  const productTitle = document.getElementById('product-title');
  const productImage = document.getElementById('product-image');
  const productDescription = document.getElementById('product-description');
  const productKind = document.getElementById('product-kind');
  const mapButtons = [...document.querySelectorAll('[data-teleport]')];
  const records = new Map();
  const zones = { atrium: 'The courtyard', newmoon: 'New Moon', mili: 'MILI', gogo: 'GOGO' };
  let available = false;
  let showing3D = false;
  let currentZone = 'atrium';
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
      description: 'Official product imagery. A current brand-approved packaging edition has not been confirmed.',
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
    if (!record || dialog.open) return;
    returnFocus = document.activeElement;
    productTitle.textContent = record.name;
    productImage.src = record.image;
    productImage.alt = record.alt;
    productKind.textContent = record.kind;
    productDescription.textContent = record.description;
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }

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
      if (!showing3D || dialog.open) return;
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
      viewToggle.hidden = false;
      fallbackMessage.hidden = true;
      setView(true);
    },
    fallback(message) {
      setView(false);
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
        inspectButton.setAttribute('aria-label', nearby ? `Inspect ${records.get(nearby).name}` : 'Inspect nearby display');
        if (nearby && showing3D) announce(`${records.get(nearby).name}. Press F or tap Inspect for details.`);
      }
    },
    paused() {
      return !showing3D || dialog.open;
    },
    inspect,
    onTeleport(listener) {
      teleportListener = listener;
    },
    onView(listener) {
      viewListener = listener;
      listener(showing3D);
    },
  };
}
