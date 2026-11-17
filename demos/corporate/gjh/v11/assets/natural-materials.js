// Original procedural finishes: no external images, network requests or brand assets.
// A failed canvas allocation leaves the existing flat materials usable.
export function createNaturalSurfaceTextures(T, makeCanvas = () => document.createElement('canvas')) {
  const created = [];
  function canvas() {
    const element = makeCanvas(); element.width = element.height = 256;
    const context = element.getContext('2d');
    if (!context) throw new Error('2D canvas unavailable');
    return {element, context};
  }
  function texture(element, repeatX = 1, repeatY = 1) {
    const map = new T.CanvasTexture(element); created.push(map);
    map.colorSpace = T.SRGBColorSpace; map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(repeatX, repeatY); map.anisotropy = 2;
    return map;
  }
  try {
    const stone = canvas(), sc = stone.context;
    sc.fillStyle = '#e1d9cc'; sc.fillRect(0, 0, 256, 256);
    // Mineral flecks and cloudy veins share one tile across the arcade.
    let seed = 37;
    function sample() {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (let i = 0; i < 3400; i++) {
      const x = sample() * 256, y = sample() * 256, size = .4 + sample() * 2.1;
      sc.fillStyle = i % 3 ? 'rgba(91,86,72,.115)' : 'rgba(255,255,251,.5)';
      sc.fillRect(x, y, size, size * .56);
    }
    for (let i = 0; i < 8; i++) {
      const y = i * 34, phase = sample() * 38 - 19;
      for (const [width, color] of [[6, 'rgba(143,126,103,.055)'],[1.1, 'rgba(126,114,96,.14)']]) {
        sc.strokeStyle = color; sc.lineWidth = width;
        sc.beginPath(); sc.moveTo(0, y);
        sc.bezierCurveTo(86,y+phase,175,y-phase,256,y); sc.stroke();
      }
    }
    sc.strokeStyle = 'rgba(102,91,75,.22)'; sc.lineWidth = 1;
    sc.strokeRect(.5, .5, 255, 255);
    const stoneMap = texture(stone.element, 35, 30);
    const wood = canvas(), wc = wood.context;
    wc.fillStyle = '#f5f0e5'; wc.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) {
      const x = (i * 37 + 9) % 256;
      wc.strokeStyle = i % 4 ? 'rgba(96,69,42,.11)' : 'rgba(255,255,255,.2)';
      wc.lineWidth = i % 5 ? .7 : 1.3;
      wc.beginPath(); wc.moveTo(x, -4);
      wc.bezierCurveTo(x + (i%5)-2, 80, x - (i%7)+3, 175, x+2, 260); wc.stroke();
    }
    return Object.freeze({stone: stoneMap, wood: texture(wood.element)});
  } catch {
    for (const item of created) item.dispose();
    return Object.freeze({stone: null, wood: null});
  }
}
