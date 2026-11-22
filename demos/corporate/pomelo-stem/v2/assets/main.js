'use strict';
document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-contact-draft]')) return;
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const out = form.querySelector('output');
  const label = form.querySelector('select[name="service"]').selectedOptions[0]?.textContent.trim() || '';
  const summary = String(data.get('summary') || '').trim();
  out.textContent = summary ? form.dataset.draft + '\n' + form.dataset.service + ': ' + label + '\n\n' + summary : form.dataset.emptyDraft;
});
const demoBoards = Array.from(document.querySelectorAll('[data-demo]'));
const demoOrder = {step: 0, method: ''};
function renderDemo(board) {
  const {step, method} = demoOrder;
  const select = board.querySelector('[data-demo-select]');
  select.value = method;
  select.disabled = step !== 1;
  select.removeAttribute('aria-invalid');
  board.querySelector('[data-demo-field]').hidden = step !== 1;
  board.querySelector('[data-demo-error]').hidden = true;
  for (const node of board.querySelectorAll('[data-demo-step]')) {
    const stage = Number(node.dataset.demoStep);
    node.classList.toggle('done', stage < step);
    if (stage === step) node.setAttribute('aria-current','step');
    else node.removeAttribute('aria-current');
  }
  const record = board.querySelector('[data-demo-method]');
  record.textContent = method ? select.selectedOptions[0].textContent : record.dataset.missing;
  const copy = board.querySelector('[data-demo-copy="' + step + '"]').content;
  board.querySelector('.demo-status').textContent = copy.querySelector('strong').textContent;
  board.querySelector('.demo-description').textContent = copy.querySelector('p').textContent;
  for (const button of board.querySelectorAll('[data-demo-action]')) {
    const action = button.dataset.demoAction;
    button.hidden = action === 'reset' ? step === 0 : action !== ['start','review','approve'][step];
  }
  board.querySelector('[data-demo-controls]').hidden = false;
}
function renderAllDemos() { for (const board of demoBoards) renderDemo(board); }
for (const board of demoBoards) {
  board.addEventListener('change', (event) => {
    if (event.target.matches('[data-demo-select]') && demoOrder.step === 1) {
      const value = event.target.value;
      demoOrder.method = ['pickup','delivery'].includes(value) ? value : '';
      renderAllDemos();
    }
  });
  board.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-demo-action]');
    if (!button) return;
    const action = button.dataset.demoAction;
    if (action === 'reset') {
      demoOrder.step = 0;
      demoOrder.method = '';
    } else if (action === 'start' && demoOrder.step === 0) demoOrder.step = 1;
    else if (action === 'review' && demoOrder.step === 1) {
      if (!demoOrder.method) {
        board.querySelector('[data-demo-error]').hidden = false;
        const select = board.querySelector('[data-demo-select]');
        select.setAttribute('aria-invalid','true');
        select.focus();
        return;
      }
      demoOrder.step = 2;
    } else if (action === 'approve' && demoOrder.step === 2 && demoOrder.method) demoOrder.step = 3;
    else return;
    renderAllDemos();
    const focus = ['[data-demo-action="start"]','[data-demo-select]','[data-demo-action="approve"]','[data-demo-action="reset"]'][demoOrder.step];
    board.querySelector(focus).focus();
  });
}
renderAllDemos();
(() => {
  const holder=document.querySelector('[data-single-preview]');
  if(!holder)return;
  const pages=Array.from(holder.querySelectorAll('[data-page]'));
  const shells=Array.from(document.querySelectorAll('[data-locale-chrome]'));
  const languageLinks=Array.from(document.querySelectorAll('[data-language]'));
  const routes=Array.from(document.querySelectorAll('[data-route]'));
  function update(focus){
    const name=location.hash.slice(1)||'index';
    if(name==='main' && holder.querySelector('[data-page]:not([hidden])'))return;
    const next=pages.find(p=>p.dataset.page===name)||pages[0];
    for(const page of pages)page.hidden=page!==next;
    for(const shell of shells)shell.hidden=shell.dataset.localeChrome!==next.dataset.locale;
    for(const link of routes){
      if(link.dataset.route===next.dataset.page)link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    for(const link of languageLinks)link.href='#'+(link.dataset.language==='en'?'':link.dataset.language+'/')+next.dataset.slug;
    document.title=next.dataset.title;
    document.documentElement.lang=next.lang;
    if(focus){window.scrollTo({top:0,behavior:'instant'});next.focus({preventScroll:true});}
  }
  window.addEventListener('hashchange',()=>update(true));
  for(const skip of document.querySelectorAll('.skip'))skip.addEventListener('click',(event)=>{
    event.preventDefault();holder.querySelector('[data-page]:not([hidden])')?.focus();
  });
  update(false);
})();
