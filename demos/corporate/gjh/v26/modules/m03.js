document.addEventListener('gjh:ready', () => {
  const section = document.getElementById('m03');

  if (section?.querySelector('#m03-title')) {
    section.setAttribute('aria-labelledby', 'm03-title');
  }
});
