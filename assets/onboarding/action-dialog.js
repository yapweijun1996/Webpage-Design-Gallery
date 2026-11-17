import {element,button,trapDialogFocus} from './components.js';

/** Shared modal actions for scene objects; the host supplies domain callbacks. */
export function createActionDialog({id,scene,getPreferences,onOpen=()=>{},onClose=()=>{},closeIcon=null}) {
  const dialog=element('dialog','ob-ui ob-dialog');dialog.id=id;
  dialog.setAttribute('aria-labelledby',`${id}-title`);dialog.setAttribute('aria-describedby',`${id}-description`);
  document.body.append(dialog);let opener=null,selection=null,title;
  const controller=new AbortController(),{signal}=controller;
  const local=(value,locale)=>typeof value==='string'?value:value[locale]||value.en;
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close('dismiss');},{signal});
  dialog.addEventListener('keydown',event=>trapDialogFocus(event,dialog,title),{signal});
  dialog.addEventListener('close',()=>{
    const action=selection;selection=null;onClose();
    if(!['view-change','fallback'].includes(dialog.returnValue)){
      (opener?.isConnected&&opener.getClientRects().length?opener:scene).focus({preventScroll:true});
      action?.();
    }
  },{signal});
  return {dialog,
    open(config){
      if(dialog.open)return false;
      selection=null;opener=document.activeElement;
      const prefs=getPreferences(),locale=prefs.locale;
      dialog.lang=locale;dialog.dataset.obTheme=prefs.resolvedTheme;
      const header=element('div','ob-header');
      const close=button(closeIcon?'':'×','ob-close',()=>dialog.close('dismiss'));if(closeIcon)close.append(closeIcon());close.setAttribute('aria-label',locale==='zh-CN'?'关闭':'Close');
      header.append(element('p','ob-eyebrow',local(config.eyebrow||{en:'Virtual Mall','zh-CN':'虚拟商城'},locale)),close);
      title=element('h2','ob-title',local(config.title,locale));title.id=`${id}-title`;title.tabIndex=-1;
      const description=element('p','ob-description',local(config.description,locale));description.id=`${id}-description`;
      const actions=element('div','ob-actions ob-object-actions');
      for(const item of config.actions){
        const node=button('',item.primary?'ob-primary':'ob-secondary-button',()=>{selection=item.onSelect;dialog.close(item.id);});
        const label=local(item.label,locale);
        if(item.image){
          const image=element('img','ob-object-image');image.src=item.image;image.alt='';image.width=48;image.height=48;node.append(image);
        }
        const visibleLabel=local(item.title||item.label,locale);
        const copy=element('span','ob-object-copy');copy.append(element('span','ob-object-label',visibleLabel));
        if(item.description)copy.append(element('span','ob-object-detail',local(item.description,locale)));
        node.append(copy);node.setAttribute('aria-label',visibleLabel===label?label:`${visibleLabel}. ${label}`);
        if(item.image||item.description)node.classList.add('ob-object-option');
        node.dataset.objectAction=item.id;actions.append(node);
      }
      dialog.replaceChildren(header,title,description,actions);dialog.showModal();onOpen();dialog.scrollTop=0;title.focus({preventScroll:true});return true;
    },
    close(reason='dismiss'){if(dialog.open)dialog.close(reason);},
    destroy(){controller.abort();if(dialog.open){dialog.close();onClose();}dialog.remove();},
  };
}
