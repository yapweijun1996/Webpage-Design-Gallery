document.addEventListener('gjh:ready', () => {
  const section = document.getElementById('m04');
  const controls = section?.querySelector('.m04-controls');
  if (!controls) return;

  const nodes = [...controls.querySelectorAll('button')];
  const panels = [...section.querySelectorAll('.m04-panel')];
  const wires = [...section.querySelectorAll('[data-m04-wire]')];

  function selectNode(node) {
    const panelId = node.getAttribute('aria-controls');

    for (const button of nodes) {
      button.setAttribute('aria-pressed', String(button === node));
    }

    for (const panel of panels) {
      panel.hidden = panel.id !== panelId;
    }

    for (const wire of wires) {
      wire.classList.toggle('m04-active-wire', wire.dataset.m04Wire === panelId);
    }
  }

  for (const node of nodes) {
    node.addEventListener('click', () => selectNode(node));
  }

  selectNode(nodes[0]);
  controls.hidden = false;
}, { once: true });
