const channelLinks = [...document.querySelectorAll('.channels a')];
const scenes = [...document.querySelectorAll('.scene')];

function selectChannel(fragment) {
  const active = scenes.find(scene => '#' + scene.id === fragment) || scenes[0];
  for (const scene of scenes) scene.hidden = scene !== active;
  for (const link of channelLinks) {
    if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}

// Reveal the destination before the browser follows the native fragment link.
for (const link of channelLinks) {
  link.addEventListener('click', event => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      selectChannel(link.hash);
    }
  });
}

window.addEventListener('hashchange', () => selectChannel(location.hash));
selectChannel(location.hash);
