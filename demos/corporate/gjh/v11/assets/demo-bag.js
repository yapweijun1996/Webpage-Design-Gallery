/** Session-only demo selection. No prices, checkout, orders or network writes. */
export function createBagStore(ids, storage = null) {
  const allowed = new Set(ids), quantities = new Map(), listeners = new Set();
  const key = 'gjh-v11-demo-bag-v1';
  try {
    const saved = JSON.parse(storage?.getItem(key) || '{}');
    for (const id of allowed) if (Number.isInteger(saved?.[id]) && saved[id] > 0 && saved[id] <= 9) quantities.set(id, saved[id]);
  } catch { /* A blocked or invalid session never prevents browsing. */ }
  const snapshot = () => Object.freeze(Object.fromEntries(quantities));
  function change(id, amount) {
    if (!allowed.has(id) || !Number.isInteger(amount)) return;
    const next = Math.max(0, Math.min(9, (quantities.get(id) || 0) + amount));
    if (next) quantities.set(id, next); else quantities.delete(id);
    publish();
  }
  function publish() {
    const value = snapshot();
    try { storage?.setItem(key, JSON.stringify(value)); } catch { /* Memory-only fallback. */ }
    listeners.forEach(listener => listener(value));
  }
  return {snapshot, change, remove(id) { if (allowed.has(id)) { quantities.delete(id); publish(); } }, clear() { quantities.clear(); publish(); }, subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); }};
}

export function setupDemoBag() {
  const records = new Map([...document.querySelectorAll('[data-product]')].map(card => [card.dataset.product, {name:card.dataset.productName, image:card.dataset.productImage}]));
  let storage = null; try { storage = sessionStorage; } catch { /* Memory-only fallback. */ }
  const store = createBagStore(records.keys(), storage);
  const dialog = document.querySelector('#bag-dialog'), open = document.querySelector('#bag-open'), close = document.querySelector('#bag-close'), items = document.querySelector('#bag-items'), empty = document.querySelector('#bag-empty'), clear = document.querySelector('#bag-clear'), add = document.querySelector('#product-add'), note = document.querySelector('#product-bag-status'), status = document.querySelector('#bag-status');
  let current = null;
  function button(text, label, action) { const el = document.createElement('button'); el.type='button'; el.textContent=text; el.setAttribute('aria-label',label); el.addEventListener('click',action); return el; }
  function render(value) {
    const active = document.activeElement, focusKey = active?.dataset.bagFocus;
    const total = Object.values(value).reduce((a,b)=>a+b,0);
    open.textContent = `Bag (${total})`; open.setAttribute('aria-label',`Open demo bag, ${total} items`);
    items.replaceChildren(); empty.hidden = total > 0; clear.hidden = total === 0;
    for (const [id,quantity] of Object.entries(value)) {
      const record=records.get(id), row=document.createElement('li'), image=document.createElement('img'), name=document.createElement('h3'), controls=document.createElement('div'), count=document.createElement('span');
      image.src=record.image;image.alt='';image.width=64;image.height=64;name.textContent=record.name;count.textContent=`${quantity}`;count.setAttribute('aria-label',`Quantity ${quantity}`);
      const minus=button('−',`Decrease ${record.name}`,()=>{store.change(id,-1);status.textContent=`${record.name} quantity decreased.`;}), plus=button('+',`Increase ${record.name}`,()=>{store.change(id,1);status.textContent=`${record.name} quantity increased.`;}), remove=button('Remove',`Remove ${record.name}`,()=>{store.remove(id);status.textContent=`${record.name} removed.`;});
      [minus,plus,remove].forEach((el,i)=>el.dataset.bagFocus=`${id}-${i}`);plus.disabled=quantity===9;
      controls.className='bag-quantity';controls.append(minus,count,plus,remove);row.append(image,name,controls);items.append(row);
    }
    if (current) { const n=value[current]||0;add.disabled=n===9;note.textContent=n ? `${n} in your demo bag · maximum 9 per item.` : 'Demo only. No payment or order is created.'; }
    if (focusKey && dialog.open) { const replacement=[...items.querySelectorAll('button')].find(el=>el.dataset.bagFocus===focusKey&&!el.disabled); (replacement||close).focus({preventScroll:true}); }
  }
  store.subscribe(render);open.hidden=false;
  open.addEventListener('click',()=>{dialog.showModal();close.focus({preventScroll:true});});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>open.focus({preventScroll:true}));
  clear.addEventListener('click',()=>{store.clear();status.textContent='Demo bag cleared.';close.focus({preventScroll:true});});
  add.addEventListener('click',()=>{if(current){store.change(current,1);note.textContent=`Added to demo bag. ${store.snapshot()[current]} of this item. No order created.`;}});
  return {get open(){return dialog.open;}, select(id){current=records.has(id)?id:null;document.querySelector('#product-bag-actions').hidden=!current;render(store.snapshot());}};
}
