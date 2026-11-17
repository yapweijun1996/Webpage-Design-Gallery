export function installPhysicalProductControl(player,world,paused,interactions) {
  document.querySelector('#visitor-motion-help').textContent='Visitor v2 reaches for physical shelf products and uses hand/foot contact adjustment. Pick up and return use a side close-up. The held-item status names the return shelf; return the item before using Cart, a seat or the elevator. Close walls temporarily hide the visitor to keep the view clear.';
  document.querySelector('#bag-description').textContent='Session-only demo selections. No payment or order. Physical products picked from a shelf are carried separately and must be returned to the same shelf before sitting, using a cart or travelling in the elevator.';
  document.querySelector('.collection-note').textContent='Bag selections are separate from physical shelf products. In the 3D aisle, use Pick up product and Return to shelf.';
  const prompt=document.querySelector('#inspect-prompt'),button=document.createElement('button'),notice=document.createElement('p');
  button.type='button';button.textContent='Pick up product';notice.setAttribute('role','status');
  notice.textContent='Physical product is separate from your demo bag. Return it to the same shelf.';
  prompt.classList.add('has-physical-product');prompt.append(button,notice);let nearby=null;
  const heldStatus=document.querySelector('#held-product-status');
  const labels=new Map([...document.querySelectorAll('.product-card[data-product]')].map(card=>[card.dataset.product,card.querySelector('.eyebrow').textContent.trim().replaceAll(' / ',' ')]));
  const pickupAction = {kind:'pickup', handler() {
    const s=player.state,held=s.character.physicalProduct;
    if(held.phase==='held'){if(nearby===held.id)return player.returnProduct();}
    else if(held.phase==='empty'&&nearby?.startsWith('new-moon-')&&!s.seated&&!s.pushing&&!s.elevatorTravel){
      const token=world.reserveProduct(nearby);if(token){const ok=player.pickProduct(token);if(!ok)token.release();return ok;}
    }
    return false;
  }};
  button.addEventListener('click',()=>{
    if(paused())return;
    interactions.dispatch(pickupAction);
    document.querySelector('#scene').focus({preventScroll:true});
  });
  return {update(s,id){nearby=id;const p=s.character.physicalProduct;
    const approach=world.shelves.find(shelf=>shelf.id===id)?.pickup;
    const withinReach=approach&&Math.hypot(s.x-approach.x,s.z-approach.z)<=approach.radius;
    heldStatus.hidden=p.phase==='empty';
    const label=labels.get(p.id)||'New Moon product';
    const message=s.productApproaching?`Approaching ${label} shelf…`:p.phase==='pickup'?`Picking up ${label}…`:p.phase==='return'?`Returning ${label}…`:`Holding ${label}. ${id===p.id?(withinReach?'Use Return to shelf.':'Move closer to its shelf to return.'):'Return to its New Moon shelf.'}`;
    if(heldStatus.textContent!==message)heldStatus.textContent=message;
    const available=id?.startsWith('new-moon-')&&!s.seated&&!s.pushing&&!s.elevatorTravel;
    button.hidden=!available;notice.hidden=!available||p.held;
    button.disabled=paused()||p.active||s.productApproaching||!withinReach||(p.held&&p.id!==id);
    button.textContent=s.productApproaching?'Approaching shelf…':p.phase==='held'?'Return to shelf':p.phase==='return'?'Returning…':p.phase==='pickup'?'Picking up…':'Pick up product';
    notice.textContent=!withinReach?'Move closer to the front of this shelf to pick up or return a product.':p.held&&p.id!==id?'This is a different product. Return your held item to its original New Moon shelf.':'Physical product is separate from your demo bag. Return it to the same shelf.';
  }};
}
