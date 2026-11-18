import {isShelfInReach} from './visitor-v2-contact.js';

export function installPhysicalProductControl(player, world, paused, interactions, {productName, addHeldProductToBag}, onAdded) {
  document.querySelector('#visitor-motion-help').textContent='Pick up and return use a side close-up. Add a held product to your bag or return it to its original shelf before using Cart, a seat or the elevator. Close walls temporarily hide the visitor to keep the view clear.';
  document.querySelector('#bag-description').textContent='Session-only demo selections. No payment or order. Add a held product to your bag or return it to its original shelf to free your hands.';
  document.querySelector('.collection-note').textContent='Add to demo bag adds one item. In the 3D aisle, you can also pick up a can, then add it to your bag or return it to its original shelf.';

  const prompt=document.querySelector('#inspect-prompt'), scene=document.querySelector('#scene');
  const pickup=document.createElement('button'), add=document.createElement('button'), putBack=document.createElement('button');
  const notice=document.createElement('p'), heldStatus=document.querySelector('#held-product-status');
  for(const button of [pickup,add,putBack]) {button.type='button';button.hidden=true;}
  pickup.textContent='Pick up product';
  add.textContent='Add to bag';
  add.id='held-product-add';
  putBack.textContent='Return to shelf';
  putBack.id='held-product-return';
  notice.hidden=true;
  notice.setAttribute('role','status');
  prompt.prepend(add,putBack);
  prompt.append(pickup,notice);

  let nearby=null, confirmation='', confirmationUntil=0, previousStatus, previousNotice, previousPresentation;
  const shelves=new Map(world.shelves.map(shelf=>[shelf.id,shelf]));
  const canHandle=s=>!paused()&&!s.seated&&!s.pushing&&!s.elevatorTravel&&!s.productApproaching&&!s.character.physicalProduct.active;
  const canPickUp=(s,inReach)=>inReach&&s.character.physicalProduct.phase==='empty'&&canHandle(s);
  const canAdd=s=>s.character.physicalProduct.held&&canHandle(s);
  function canReturn(s) {
    const {held,id}=s.character.physicalProduct, home=shelves.get(id);
    return Boolean(held&&home&&canHandle(s)&&isShelfInReach(s,home.pickup));
  }
  for(const {id,pickup:approach} of shelves.values()) {
    const anchor={x:approach.x,y:0,z:approach.z};
    interactions.register({id,kind:'pickup',anchor,floor:0,radius:approach.radius,prompt:'Pick up product',
      availability() {
        const s=player.state;
        return nearby===id&&canPickUp(s,isShelfInReach(s,approach));
      },
      handler() {
        const token=world.reserveProduct(id);
        if(!token)return false;
        const ok=player.pickProduct(token);
        if(!ok)token.release();
        return ok;
      }});
  }

  const returnAction=interactions.register({id:'held-product',kind:'return',prompt:'Return to shelf',
    availability:()=>canReturn(player.state),
    handler:()=>player.returnProduct()});
  const addAction=interactions.register({id:'held-product',kind:'bag',prompt:'Add to bag',
    availability:()=>canAdd(player.state),
    handler() {
      const {id}=player.state.character.physicalProduct;
      const message=`Added ${productName(id)} to bag`;
      if(!addHeldProductToBag(id,player.bagProduct,message))return false;
      confirmation=message;
      confirmationUntil=performance.now()+3000;
      return true;
    }});
  pickup.addEventListener('click',()=>{
    interactions.dispatch(interactions.get('pickup',nearby));
    scene.focus({preventScroll:true});
  });
  putBack.addEventListener('click',()=>{
    interactions.dispatch(returnAction);
    scene.focus({preventScroll:true});
  });
  add.addEventListener('click',()=>{
    if(interactions.dispatch(addAction)){
      scene.focus({preventScroll:true});
      onAdded();
    }
  });

  return {actions:{pickup,add,putBack,notice}, update(s,id) {
    nearby=id;
    const p=s.character.physicalProduct, shelf=shelves.get(id);
    const inReach=Boolean(shelf&&isShelfInReach(s,shelf.pickup));
    const showPickup=p.phase==='empty'&&Boolean(shelf)&&!s.seated&&!s.pushing&&!s.elevatorTravel;
    const showConfirmation=p.phase==='bag'||(p.phase==='empty'&&performance.now()<confirmationUntil);
    const returnAvailable=canReturn(s), addAvailable=canAdd(s), pickupAvailable=canPickUp(s,inReach);
    const presentation=[p.phase,p.id,Boolean(s.productApproaching),showPickup,
      inReach,returnAvailable,addAvailable,pickupAvailable,showConfirmation].join('/');
    if(presentation===previousPresentation)return;
    previousPresentation=presentation;

    add.hidden=!p.held;
    add.disabled=!addAvailable;
    putBack.hidden=!returnAvailable;
    putBack.disabled=!returnAvailable;
    pickup.hidden=!showPickup;
    pickup.disabled=!pickupAvailable;
    notice.hidden=pickup.hidden;
    const hint=showPickup&&!inReach?'Move closer to the front of this shelf to pick up a product.':
      'Pick up a product to add it to your bag or return it to this shelf.';
    if(hint!==previousNotice){notice.textContent=hint;previousNotice=hint;}

    let message='';
    if(showConfirmation)message=confirmation;
    else if(p.phase!=='empty') {
      confirmationUntil=0;
      const label=productName(p.id);
      message=p.held?`Holding ${label}. Add it to your bag, or return it to its original New Moon shelf.`:
        s.productApproaching?`Approaching ${label} shelf…`:
        p.phase==='return'?`Returning ${label}…`:`Picking up ${label}…`;
    }
    heldStatus.hidden=!message;
    if(message!==previousStatus){heldStatus.textContent=message;previousStatus=message;}
  }};
}
