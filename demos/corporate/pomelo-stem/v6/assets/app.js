(function(){
'use strict';
var root=document.documentElement;
function ready(){root.classList.remove('booting')}
if(document.readyState==='complete')ready();else window.addEventListener('load',ready,{once:true});
var toggle=document.querySelector('[data-theme-toggle]');
function sync(){if(!toggle)return;var dark=root.dataset.theme==='dark';toggle.setAttribute('aria-pressed',String(dark));toggle.querySelector('[data-theme-label]').textContent=dark?toggle.dataset.lightLabel:toggle.dataset.darkLabel;}
if(toggle){sync();toggle.addEventListener('click',function(){root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('pomelo-showcase-theme',root.dataset.theme)}catch(e){}sync()})}
document.querySelectorAll('[data-preview]').forEach(function(group){
 var buttons=Array.from(group.querySelectorAll('[data-panel]'));
 var panels=Array.from(group.querySelectorAll('[data-preview-panel]'));
 function select(name){if(!buttons.some(function(b){return b.dataset.panel===name}))name='p1';buttons.forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.panel===name))});panels.forEach(function(p){p.hidden=p.dataset.previewPanel!==name})}
 var hash=location.hash.match(/^#demo-([1-4])$/);select(hash?'p'+hash[1]:'p1');
 buttons.forEach(function(button){button.addEventListener('click',function(){select(button.dataset.panel)})});
 window.addEventListener('hashchange',function(){var m=location.hash.match(/^#demo-([1-4])$/);if(m)select('p'+m[1])});
 group.addEventListener('change',function(event){if(event.target.matches('[data-method]')){var p=event.target.closest('[data-preview-panel]');p.querySelector('[data-action=confirm]').disabled=true;var s=p.querySelector('[data-status]');s.textContent=s.dataset.initial}});
 group.addEventListener('click',function(event){
  var btn=event.target.closest('[data-action]');if(!btn)return;
  var panel=btn.closest('[data-preview-panel]'),status=panel.querySelector('[data-status]'),action=btn.dataset.action;
  if(action==='reset'){status.textContent=status.dataset.initial;panel.querySelectorAll('select').forEach(function(s){s.value=''});panel.querySelectorAll('[data-action=confirm],[data-action=check]').forEach(function(b){b.disabled=true});return}
  if(action==='review'){if(!panel.querySelector('[data-method]').value){status.textContent=btn.dataset.missing;return}panel.querySelector('[data-action=confirm]').disabled=false}
  if(action==='draft')panel.querySelector('[data-action=check]').disabled=false;
  status.textContent=btn.dataset.next || status.dataset.next;
 });
});
})();