const search = document.querySelector('#atlas-query');
const clear = document.querySelector('#atlas-clear');
const groups = [...document.querySelectorAll('.letter')];
const links = [...document.querySelectorAll('.atlas aside nav a')];
function filterAtlas() {
  const term = search.value.trim().toLocaleLowerCase('en-SG');
  let total = 0;
  for (const group of groups) {
    let matches = 0;
    for (const entry of group.querySelectorAll('article')) {
      const text = [...entry.querySelectorAll('h3, p, .format-list li')].map(node => node.textContent).join(' ');
      entry.hidden = !text.toLocaleLowerCase('en-SG').includes(term);
      if (!entry.hidden) matches++;
    }
    group.hidden = matches === 0;
    total += matches;
  }
  for (const link of links) link.hidden = document.getElementById(link.hash.slice(1)).hidden;
  document.querySelector('.atlas aside').hidden = total === 0;
  document.querySelector('#atlas-count').textContent = total ? total + (total === 1 ? ' drink' : ' drinks') + ' in the index' :
    'No matching drinks. Try another name, ingredient or pack size.';
  clear.hidden = search.value.length === 0;
}
document.querySelector('.atlas-search').hidden = false;
search.addEventListener('input', filterAtlas);
clear.addEventListener('click', () => {
  search.value = '';
  filterAtlas();
  search.focus();
});
filterAtlas();
