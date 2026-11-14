export function installPhysicalProductControl(player,world,paused) {
  document.querySelector('#bag-description').textContent='Session-only demo selections. No payment or order. Physical products picked from a shelf are carried separately and must be returned to the same shelf before sitting, using a cart or travelling in the elevator.';
  document.querySelector('.collection-note').textContent='Bag selections are separate from physical shelf products. In the 3D aisle, use Pick up product and Return to shelf.';
  const prompt=document.querySelector('#inspect-prompt'),button=document.createElement('button'),notice=document.createElement('p');
  button.type='button';button.textContent='Pick up product';notice.setAttribute('role','status');
  notice.textContent='Physical product is separate from your demo bag. Return it to the same shelf.';
  prompt.classList.add('has-physical-product');prompt.append(button,notice);let nearby=null;
  button.addEventListener('click',()=>{
    if(paused())return;
    const s=player.state,held=s.character.physicalProduct;
    if(held.phase==='held'){if(nearby===held.id)player.returnProduct();}
    else if(held.phase==='empty'&&nearby?.startsWith('new-moon-')&&!s.seated&&!s.pushing&&!s.elevatorTravel){
      const token=world.reserveProduct(nearby);if(token&&!player.pickProduct(token))token.release();
    }
    document.querySelector('#scene').focus({preventScroll:true});
  });
  return {update(s,id){nearby=id;const p=s.character.physicalProduct;
    const available=id?.startsWith('new-moon-')&&!s.seated&&!s.pushing&&!s.elevatorTravel;
    button.hidden=!available;notice.hidden=!available;
    button.disabled=paused()||p.active||(p.held&&p.id!==id);
    button.textContent=p.phase==='held'?'Return to shelf':p.phase==='return'?'Returning…':p.phase==='pickup'?'Picking up…':'Pick up product';
  }};
}
