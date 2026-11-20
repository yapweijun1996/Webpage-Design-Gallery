// Loads each module fragment into its slot, then fires "gjh:ready" so module scripts can init.
(async()=>{const slots=[...document.querySelectorAll('[data-module]')];
await Promise.all(slots.map(async s=>{try{const r=await fetch('modules/'+s.dataset.module+'.html');if(r.ok)s.innerHTML=await r.text()}catch(e){console.warn('module load failed',s.dataset.module,e)}}));
window.GJH_READY=true;document.dispatchEvent(new CustomEvent('gjh:ready'));})();
