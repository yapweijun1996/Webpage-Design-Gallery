window.__finishModuleEvaluated=(window.__finishModuleEvaluated||0)+1;
// Original procedural finishes: no external images, network requests or brand assets.
// A failed canvas allocation leaves the existing flat materials usable.
export function createNaturalSurfaceTextures(T, makeCanvas = () => document.createElement('canvas')) {
  window.__finishFactoryCalls=(window.__finishFactoryCalls||0)+1;
  const created = [];
  function canvas() {
    const element = makeCanvas(); element.width = element.height = 256;
    const context = element.getContext('2d');
    if (!context) throw new Error('2D canvas unavailable');
    return {element, context};
  }
  function texture(element, repeatX = 1, repeatY = 1) {
    const map = new T.CanvasTexture(element); created.push(map);window.__finishCreated=(window.__finishCreated||0)+1;map.addEventListener('dispose',()=>{window.__finishDisposed=(window.__finishDisposed||0)+1;});
    map.colorSpace = T.SRGBColorSpace; map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(repeatX, repeatY); map.anisotropy = 2;
    return map;
  }
  try {
    const stone = canvas(), sc = stone.context;
    sc.fillStyle = '#e8e1d2'; sc.fillRect(0, 0, 256, 256);
    // Veins remain understated so repeated two-metre slabs read as stone,
    // rather than a high-contrast wallpaper or artificial checkerboard.
    for (let i = 0; i < 10; i++) {
      const y = 14 + i * 27;
      sc.strokeStyle = i % 3 === 0 ? 'rgba(111,103,88,.075)' : 'rgba(255,255,255,.15)';
      sc.lineWidth = i % 3 === 0 ? 1.4 : .7;
      sc.beginPath(); sc.moveTo(-10, y);
      sc.bezierCurveTo(65, y-14+(i%3)*5, 160, y+15-(i%4)*4, 266, y-8); sc.stroke();
    }
    for (let i = 0; i < 220; i++) {
      const x = (i * 73 + 19) % 256, y = (i * 137 + 11) % 256;
      sc.fillStyle = i % 2 ? 'rgba(120,108,92,.05)' : 'rgba(255,255,255,.11)';
      sc.fillRect(x, y, 1, 1);
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
