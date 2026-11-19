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
  for (const method of ['compile', 'render', 'initTexture', 'initRenderTarget']) {
    const original = renderer[method];
    renderer[method] = function (...args) {
      const before = start();
      try { return original.apply(this, args); }
      finally {
        const subject = args[0];
        end(`renderer.${method}`, before, subject?.name || subject?.image?.src || subject?.type);
      }
    };
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
  return {start,end,steps,report:() => events.length < capacity ? events.slice() : [...events.slice(next),...events.slice(0,next)]};
}
