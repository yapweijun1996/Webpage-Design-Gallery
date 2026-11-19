// Opt-in CPU attribution. RAF gaps can also include GPU or compositor work.
export function createFrameTrace(renderer) {
  const events = [], capacity = 2048;
  let next = 0;
  const programCount = () => renderer.info.programs?.length ?? 0;
  function start() {
    const {geometries,textures} = renderer.info.memory;
    return {at:performance.now(), programs:programCount(), geometries, textures};
  }
  function end(work, before, subject) {
    const ms = performance.now() - before.at;
    const {geometries,textures} = renderer.info.memory;
    const programs = programCount() - before.programs;
    if (ms < 2 && !programs && textures === before.textures && geometries === before.geometries) return;
    events[next] = {work, subject, at:before.at, ms, programs,
      addedPrograms:programs > 0 ? renderer.info.programs.slice(before.programs).map(({id,name,type}) => ({id,name,type})) : [],
      geometries:geometries-before.geometries, textures:textures-before.textures};
    next = (next + 1) % capacity;
  }
  function wrap(owner, method, label, describe) {
    const original = owner[method];
    owner[method] = function (...args) {
      const before = start();
      try { return original.apply(this, args); }
      finally { end(label, before, describe?.(args)); }
    };
  }
  let shadowMap;
  function watchShadowMap() {
    if (shadowMap === renderer.shadowMap) return;
    shadowMap = renderer.shadowMap;
    wrap(shadowMap, 'render', 'shadowMap.render', ([, scene]) => scene.name || scene.type);
  }
  for (const method of ['compile', 'render', 'initTexture', 'initRenderTarget']) {
    wrap(renderer, method, `renderer.${method}`, ([subject, camera]) => {
      const name = subject?.name || subject?.image?.src || subject?.type;
      if (method !== 'render') return name;
      const target = renderer.getRenderTarget();
      return `${name} layer=${camera.layers.mask} target=${target ? target.texture.name || 'offscreen' : 'screen'}`;
    });
  }
  watchShadowMap();
  const gl = renderer.getContext();
  for (const method of ['getProgramInfoLog', 'getShaderInfoLog', 'getProgramParameter',
    'texStorage2D', 'texImage2D', 'texSubImage2D', 'generateMipmap']) {
    wrap(gl, method, `gl.${method}`, method === 'getProgramParameter' ? ([, parameter]) => parameter : undefined);
  }
  function* steps(label, work) {
    try {
      for (;;) {
        const before = start();
        const step = work.next();
        end(label, before);
        if (step.done) return step.value;
        yield step.value;
      }
    } finally { work.return(); }
  }
  return {start,end,steps,watchShadowMap,report:() => events.length < capacity ? events.slice() : [...events.slice(next),...events.slice(0,next)]};
}
