function initM01Opening() {
  document.querySelector('#m01 .m01-opening')?.classList.add('m01-enter');
}

document.addEventListener('gjh:ready', initM01Opening, { once: true });
if (window.GJH_READY) initM01Opening();
