export function installPhysicalProductControl(player,world,paused,interactions) {
  document.querySelector('#visitor-motion-help').textContent='Pick up and return use a side close-up. The held-item status names the return shelf. Return the item before using Cart, a seat or the elevator. Close walls temporarily hide the visitor to keep the view clear.';
  document.querySelector('#bag-description').textContent='Session-only demo selections. No payment or order. Physical products picked from a shelf are carried separately and must be returned to the same shelf before sitting, using a cart or travelling in the elevator.';
  document.querySelector('.collection-note').textContent='Bag selections are separate from physical shelf products. In the 3D aisle, use Pick up product and Return to shelf.';
  const prompt=document.querySelector('#inspect-prompt'),button=document.createElement('button'),notice=document.createElement('p');
  button.type='button';button.textContent='Pick up product';notice.setAttribute('role','status');
  notice.textContent='Physical product is separate from your demo bag. Return it to the same shelf.';
  prompt.classList.add('has-physical-product');prompt.append(button,notice);let nearby=null,withinReach=false;
  const heldStatus=document.querySelector('#held-product-status');
  const labels=new Map([...document.querySelectorAll('.product-card[data-product]')].map(card=>[card.dataset.product,card.querySelector('.eyebrow').textContent.trim().replaceAll(' / ',' ')]));
  for (const shelf of world.shelves) {
    const approach=shelf.pickup;
    interactions.register({id:shelf.id,kind:'pickup',anchor:{x:approach.x,y:0,z:approach.z},floor:0,radius:approach.radius,
      prompt() {
        const s=player.state,p=s.character.physicalProduct;
        return s.productApproaching?'Approaching shelf…':p.phase==='held'?'Return to shelf':p.phase==='return'?'Returning…':p.phase==='pickup'?'Picking up…':'Pick up product';
      },
      availability() {
        const s=player.state,p=s.character.physicalProduct;
        return Boolean(nearby===shelf.id&&!s.seated&&!s.pushing&&!s.elevatorTravel&&!paused()&&!p.active&&!s.productApproaching&&Math.hypot(s.x-approach.x,s.z-approach.z)<=approach.radius&&(!p.held||p.id===shelf.id));
      },
      handler() {
        const held=player.state.character.physicalProduct;
        if(held.phase==='held')return player.returnProduct();
        if(held.phase==='empty'){
          const token=world.reserveProduct(shelf.id);if(token){const ok=player.pickProduct(token);if(!ok)token.release();return ok;}
        }
        return false;
      }});
  }
  button.addEventListener('click',()=>{
    interactions.dispatch(interactions.get('pickup',nearby));
    document.querySelector('#scene').focus({preventScroll:true});
  });
  return {update(s,id){nearby=id;const p=s.character.physicalProduct;
    const approach=world.shelves.find(shelf=>shelf.id===id)?.pickup;
    withinReach=Boolean(approach&&Math.hypot(s.x-approach.x,s.z-approach.z)<=approach.radius);
    heldStatus.hidden=p.phase==='empty';
    const label=labels.get(p.id)||'New Moon product';
    const message=s.productApproaching?`Approaching ${label} shelf…`:p.phase==='pickup'?`Picking up ${label}…`:p.phase==='return'?`Returning ${label}…`:`Holding ${label}. ${id===p.id?(withinReach?'Use Return to shelf.':'Move closer to its shelf to return.'):'Return to its New Moon shelf.'}`;
    if(heldStatus.textContent!==message)heldStatus.textContent=message;
    const action=interactions.get('pickup',id);
    const available=action&&!s.seated&&!s.pushing&&!s.elevatorTravel;
    button.hidden=!available;notice.hidden=!available||p.held;
    button.disabled=!action||!action.availability();
    button.textContent=action?.prompt()||'Pick up product';
    notice.textContent=!withinReach?'Move closer to the front of this shelf to pick up or return a product.':p.held&&p.id!==id?'This is a different product. Return your held item to its original New Moon shelf.':'Physical product is separate from your demo bag. Return it to the same shelf.';
  }};
}
