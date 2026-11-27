// The page-open variant is server-rendered and controlled independently by loader-boot.js.
import {mount} from './dialog.js';
import {t} from './i18n.js';

let loaderCount = 0;

export function show({title, detail, returnFocus} = {}) {
  window.__pomeloV8PageReady?.();
  const id = `loader-${++loaderCount}`;
  const backdrop = document.createElement('div');
  backdrop.className = 'loader';
  backdrop.setAttribute('data-update-loader', '');
  const panel = document.createElement('div');
  panel.className = 'loader__card';
  panel.tabIndex = -1;
  panel.setAttribute('role', 'alertdialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', id + '-title');
  panel.setAttribute('aria-describedby', id + '-detail');
  const brand = document.createElement('div');
  brand.className = 'loader__brand';
  const mark = document.querySelector('#page-loader .loader__mark').cloneNode(true);
  const tagline = document.createElement('p');
  tagline.className = 'loader__tagline';
  tagline.textContent = t('loader.tagline');
  brand.append(mark, tagline);
  const indicator = document.createElement('span');
  indicator.className = 'loader__indicator';
  indicator.setAttribute('aria-hidden', 'true');
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const heading = document.createElement('p');
  heading.className = 'loader__title';
  heading.id = id + '-title';
  heading.textContent = title;
  const text = document.createElement('p');
  text.className = 'loader__detail';
  text.id = id + '-detail';
  text.textContent = detail;
  status.append(heading, text);
  panel.append(brand, indicator, status);
  backdrop.append(panel);
  return mount(backdrop, panel, {opener: returnFocus, dismissible: false, blockToasts: true});
}
