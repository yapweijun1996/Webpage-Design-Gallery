/* Enhancements never hide essential content or replace native anchor navigation. */
const toggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
const mobile = matchMedia('(max-width: 900px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine) and (min-width: 901px)');
document.documentElement.classList.add('js');
let lastFocus = document.activeElement;
document.addEventListener('focusin', event => { lastFocus = event.target; });
function closeMenu(returnFocus = false) {
  navigation.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  if (returnFocus) toggle.focus();
}
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
});
navigation.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  closeMenu();
  if (mobile.matches && link.hash) document.querySelector(link.hash)?.focus({preventScroll:true});
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.header') && toggle.getAttribute('aria-expanded') === 'true') {
    const focusInside = navigation.contains(document.activeElement);
    closeMenu(focusInside);
  }
});
mobile.addEventListener('change', () => closeMenu(mobile.matches && navigation.contains(lastFocus)));

const eras = {
  '1940s': {title:'A provision store. A beginning.',copy:'The Goh brothers’ Rochor Road store supplied everyday food essentials.',image:'gjh-history-composite.jpg',alt:'Historical shopfront composite published on the official GJH website',caption:'Official-site historical composite; not an original archival photograph.'},
  '1959': {title:'New Moon’s own beginning.',copy:'New Moon’s brand history dates its first abalone product to 1959. Brand origin is distinct from later GJH ownership.',image:'new-moon-brand-cover.jpg',alt:'Contemporary official New Moon brand photograph',caption:'Contemporary brand photograph illustrating this chapter; not a 1959 photograph.'},
  '1981': {title:'More possibilities with MILI.',copy:'GJH’s company timeline identifies MILI as its second house brand in 1981.',image:'mili-brand-cover.jpg',alt:'Contemporary official MILI brand photograph',caption:'Contemporary brand photograph illustrating this chapter; not a 1981 photograph.'},
  '2004': {title:'An expanding world of care.',copy:'GJH’s timeline records a chapter in health through Borsch Med in 2004.',image:'borsch-med-quality.png',alt:'Contemporary official Borsch Med brand photograph',caption:'Contemporary brand photograph illustrating this chapter; not a 2004 photograph.'}
};
function setEra(key) {
  const era = eras[key];
  document.querySelectorAll('[data-era]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.era === key)));
  document.querySelector('#era-title').textContent = era.title;
  document.querySelector('#era-copy').textContent = era.copy;
  const image = document.querySelector('#era-image');
  image.src = `assets/${era.image}`;
  image.alt = era.alt;
  document.querySelector('#era-caption').textContent = era.caption;
}
document.querySelectorAll('[data-era]').forEach(button => button.addEventListener('click', () => setEra(button.dataset.era)));

const milestones = [...document.querySelectorAll('[data-milestone]')];
const journey = document.querySelector('#journey');
let manualMilestone = false;
function setMilestone(index, announce = false) {
  milestones.forEach((button, current) => button.setAttribute('aria-pressed', String(current === index)));
  if (announce) document.querySelector('#journey-status').textContent = `${milestones[index].dataset.milestone} — ${milestones[index].querySelector('span:not(.timeline-dot)').textContent}`;
}
milestones.forEach((button, index) => button.addEventListener('click', () => {
  manualMilestone = true;
  setMilestone(index, true);
}));
document.querySelectorAll('[data-market]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-market]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelectorAll('[data-connection]').forEach(path => path.classList.toggle('active', path.dataset.connection === button.dataset.market));
  document.querySelector('#market-status').textContent = button.dataset.market === 'Singapore' ? 'Singapore — the starting point of GJH’s story.' : `${button.dataset.market} — named in GJH’s company profile. Product availability and distribution terms vary.`;
}));

/* One requested frame per scroll burst; no continuous render loop or WebGL. */
let frame = 0;
const hero = document.querySelector('.hero');
const brands = document.querySelector('#brands');
const brandObjects = [...document.querySelectorAll('.brand-object')];
function updateScroll() {
  frame = 0;
  const heroRect = hero.getBoundingClientRect();
  if (!reducedMotion.matches && heroRect.bottom > 0) {
    const progress = Math.min(1, Math.max(0, -heroRect.top / heroRect.height));
    hero.style.setProperty('--hero-y', `${progress * 55}px`);
    hero.style.setProperty('--hero-scale', String(1.025 + progress * .045));
  }
  const brandRect = brands.getBoundingClientRect();
  if (finePointer.matches && !reducedMotion.matches && brandRect.bottom > 0 && brandRect.top < innerHeight) {
    const progress = (innerHeight / 2 - brandRect.top) / (innerHeight + brandRect.height);
    brandObjects.forEach((card, index) => card.style.setProperty('--depth-y', `${progress * (index - 1) * 42}px`));
  }
  const rect = journey.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (innerHeight * .85 - rect.top) / (innerHeight * .65 + rect.height * .35)));
  journey.style.setProperty('--journey-progress', `${progress * 100}%`);
  if (!manualMilestone && rect.top < innerHeight && rect.bottom > 0) setMilestone(Math.min(milestones.length - 1, Math.floor(progress * milestones.length)));
}
function requestScroll() { if (!frame) frame = requestAnimationFrame(updateScroll); }
addEventListener('scroll', requestScroll, {passive:true});
addEventListener('resize', requestScroll, {passive:true});
reducedMotion.addEventListener('change', () => {
  hero.style.removeProperty('--hero-y');
  hero.style.removeProperty('--hero-scale');
  brandObjects.forEach(card => card.style.removeProperty('--depth-y'));
  requestScroll();
});
brandObjects.forEach(card => {
  card.addEventListener('pointermove', event => {
    if (!finePointer.matches || reducedMotion.matches) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--tilt-x', `${((event.clientX - rect.left) / rect.width - .5) * 7}deg`);
    card.style.setProperty('--tilt-y', `${-((event.clientY - rect.top) / rect.height - .5) * 5}deg`);
  });
  card.addEventListener('pointerleave', () => {
    card.style.removeProperty('--tilt-x');
    card.style.removeProperty('--tilt-y');
  });
});
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (!reducedMotion.matches) entry.target.animate([{opacity:.7,translate:'0 18px'},{opacity:1,translate:'0 0'}], {duration:750,easing:'cubic-bezier(.2,.75,.25,1)'});
      observer.unobserve(entry.target);
    });
  }, {threshold:.12});
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}
requestScroll();
