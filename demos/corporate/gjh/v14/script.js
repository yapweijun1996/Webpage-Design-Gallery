const archiveView = document.getElementById('archive-view');

function selectLinkedView() {
  if (location.hash === '#archive-view') {
    archiveView.checked = true;
    archiveView.focus({preventScroll:true});
  }
}

window.addEventListener('hashchange', selectLinkedView);
document.querySelector('.entry-action[href="#archive-view"]').addEventListener('click', () => {
  archiveView.checked = true;
});
selectLinkedView();
