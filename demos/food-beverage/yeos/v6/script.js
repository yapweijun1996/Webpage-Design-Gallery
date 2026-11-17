function revealSpecimen() {
  const specimen = document.getElementById(location.hash.slice(1));
  if (specimen?.matches('details.spec')) specimen.open = true;
}
document.querySelector('.specimen-key').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (link) document.getElementById(link.hash.slice(1)).open = true;
});
window.addEventListener('hashchange', revealSpecimen);
revealSpecimen();
