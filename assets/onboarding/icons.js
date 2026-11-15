/** Original line diagrams shared by the controls and tutorial; no font or image requests. */
const shapes = {
  move: ['M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4'],
  look: ['M8 6a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0Z','M12 2v5M2 12h4M18 12h4M4 10l-2 2 2 2M20 10l2 2-2 2'],
  inspect: ['M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6'],
  touch: ['M7 13V7a2 2 0 0 1 4 0v5-8a2 2 0 0 1 4 0v9l2-2a2 2 0 0 1 3 3l-4 6H9l-5-5a2 2 0 0 1 3-2M2 4h3M19 4h3'],
  gamepad: ['M7 7h10c3 0 5 10 3 11-2 1-4-3-5-3H9c-1 0-3 4-5 3-2-1 0-11 3-11ZM6 11h4M8 9v4M16 10h.01M18 12h.01'],
  'gamepad-look': ['M7 7h10c3 0 5 10 3 11-2 1-4-3-5-3H9c-1 0-3 4-5 3-2-1 0-11 3-11Z','M16 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4M16 9v1M16 18v1M12 14h1M19 14h1'],
  'gamepad-move': ['M7 7h10c3 0 5 10 3 11-2 1-4-3-5-3H9c-1 0-3 4-5 3-2-1 0-11 3-11Z','M8 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4M8 7v1M8 16v1M4 12h1M11 12h1'],
  ready: ['M21 12a9 9 0 1 1-5-8M7 12l4 4L21 5'],
};
export function controlIcon(name) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.classList.add('ob-icon');
  for(const [index,d] of (shapes[name]||shapes.inspect).entries()){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);if(name.startsWith('gamepad-')&&index===1)path.classList.add('ob-icon-highlight');svg.append(path);}
  return svg;
}
