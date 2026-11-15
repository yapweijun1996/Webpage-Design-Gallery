import {controlIcon} from './icons.js';
/** Framework-neutral DOM components. Text is always inserted as textContent. */
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(text, className, action) {
  const node = element('button', className, text);
  node.type = 'button';
  if (action) node.addEventListener('click', action);
  return node;
}
export function keyboardKey(label) { return element('kbd', 'ob-key', label); }
export function controlList(steps, mode, locale) {
  const list = element('ol', 'ob-controls');
  list.dataset.inputMode = mode;
  for (const [index, step] of steps.entries()) {
    const row = element('li');
    const label = element('span', 'ob-control-name');
    label.append(controlIcon(step.id), document.createTextNode(step.label[locale]));
    const binding = element('span', 'ob-binding');
    for (const part of step.bindings[mode][locale]) {
      binding.append(part.key ? keyboardKey(part.key) : element('span', '', part.text));
    }
    row.append(label, binding); list.append(row);
  }
  return list;
}
export function stepProgress(current, total, label) {
  const wrapper = element('div', 'ob-progress');
  const progress = element('progress'); progress.max = total; progress.value = current;
  progress.setAttribute('aria-label', label);
  const text = element('span', '', label);
  wrapper.append(progress, text); return wrapper;
}
export function helpButton(label, action) { return button(label, 'ob-help', action); }

export function guideStages(labels, current, caption) {
  const wrapper=element('div','ob-stage-overview');
  const list=element('ol','ob-stages');list.setAttribute('aria-label',caption);
  labels.forEach((label,index)=>{
    const item=element('li');
    const marker=element('span','ob-stage-dot',index+1<current?'✓':String(index+1));marker.setAttribute('aria-hidden','true');
    item.append(marker,document.createTextNode(label));
    if(index+1===current)item.setAttribute('aria-current','step');
    if(index+1<current)item.dataset.complete='true';
    list.append(item);
  });wrapper.append(list);return wrapper;
}

export function trapDialogFocus(event, dialog, initial) {
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button,select,input,a[href]')].filter(node=>node.getClientRects().length&&!node.disabled);
  const first=controls[0],last=controls.at(-1),active=document.activeElement;
  if(event.shiftKey&&(active===first||active===initial)){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&active===last){event.preventDefault();first?.focus();}
}
