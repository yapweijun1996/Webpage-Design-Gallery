// Opt-in CPU attribution. RAF gaps can also include GPU or compositor work.
export function createFrameTrace(renderer) {
  const events = [], capacity = 2048;
  let next = 0;
  const programCount = () => renderer.info.programs?.length ?? 0;
  function start() {
    const {geometries,textures} = renderer.info.memory;
    return {at:performance.now(), programs:programCount(), geometries, textures};
  }
  function end(work, before, subject, force = false) {
    const ms = performance.now() - before.at;
    const {geometries,textures} = renderer.info.memory;
    const programs = programCount() - before.programs;
    if (!force && ms < 2 && !programs && textures === before.textures && geometries === before.geometries) return;
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
    const render = shadowMap.render;
    shadowMap.render = function (lights, scene, camera) {
      const active = this.enabled && (this.autoUpdate || this.needsUpdate);
      const allocating = active && lights.some(light => !light.shadow?.map);
      const before = start();
      try { return render.call(this,lights,scene,camera); }
      finally { end(allocating ? 'shadowMap.firstRender' : 'shadowMap.render',before,scene.name || scene.type,allocating); }
    };
  }
  for (const method of ['compile', 'render', 'initTexture', 'initRenderTarget', 'setRenderTarget']) {
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

// Sample adjacent warm and live submissions separately. Three can evict one
// program and create another without changing renderer.info.programs.length.
export function createProgramTrace(renderer) {
  let previous = new Set(), next = 0, lastPose;
  const samples = [], events = [];
  function event(kind, detail) { events.push({kind, detail}); }
  function player(pose) {
    const values = [pose.character.lod?.level, pose.seatPhase, pose.character.physicalProduct?.phase, pose.cameraOccluded];
    const labels = ['player-lod','seat','product','camera-occlusion'];
    values.forEach((value, i) => {
      if (lastPose?.[i] !== value) event(labels[i], value);
    });
    lastPose = values;
  }
  function sample(pass, warm, zone) {
    const programs = renderer.info.programs;
    const added = programs.filter(program => !previous.has(program.id));
    const removed = previous.size + added.length - programs.length;
    const changes = pass === 'live' ? events.splice(0) : [];
    if (!added.length && !removed && !changes.length) return;
    samples[next] = {at:performance.now(), pass, warm, zone, events:changes,
      delta:programs.length - previous.size, removed,
      added:added.map(({id,name,cacheKey}) => ({id,name,cacheKey}))};
    next = (next + 1) % 512;
    previous = new Set(programs.map(program => program.id));
  }
  return {event, player, sample, report:() => samples.length < 512 ? samples.slice() : [...samples.slice(next), ...samples.slice(0,next)]};
}
