import {createUploadScheduler} from '../model-warmup.js';

export const emptyInteriorReport = tier => ({
  tier,shops:0,drawCalls:0,triangles:0,modelsLoaded:0,bytes:0,preinstalled:{shops:0,ms:0}
});

// The loader awaits this promise within its own warm deadline. The installer
// stays attached to live RAFs if the loader times out or the visitor skips it.
export function registerInteriorWarmup(interiors, {T,renderer,scene,lights,tier}, options) {
  return interiors?.prepare(tier, () => createInstaller(T,renderer,scene,lights), options) ?? Promise.resolve();
}

function createInstaller(T, renderer, scene, {accents,limit}) {
  const queue = createUploadScheduler({budgetMs:2,maxSteps:12});
  const staging = new T.Scene(), lighting = new T.Scene(), camera = new T.PerspectiveCamera();
  const target = new T.WebGLRenderTarget(1,1);
  const accentSet = new Set(accents);
  const fixed = scene.children.filter(node => node.isLight && !accentSet.has(node)).map(light => light.clone());
  const variable = accents.slice(0,limit).map(light => {
    const copy = light.clone();
    copy.visible = true;
    return copy;
  });

  function compile(roots, count, linear, programs) {
    const previous = renderer.getRenderTarget(), shadows = renderer.shadowMap.enabled;
    const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    try {
      // Point light counts change Three's program cache key. Use the exact
      // kit materials and cover each count the concourse can select.
      staging.children = roots;
      lighting.children = [...fixed,...variable.slice(0,count)];
      lighting.environment = scene.environment;
      lighting.fog = scene.fog;
      renderer.shadowMap.enabled = linear;
      renderer.setRenderTarget(linear ? target : null);
      const materials = renderer.compile(staging,camera,lighting);
      if (renderer.extensions.has('KHR_parallel_shader_compile')) {
        for (const material of materials) programs.add(renderer.properties.get(material).currentProgram);
      }
    } finally {
      staging.children = lighting.children = [];
      renderer.shadowMap.enabled = shadows;
      renderer.setRenderTarget(previous,face,mip);
    }
  }

  async function build(makeWork, options) {
    let value;
    await queue.enqueue(function* () {
      const work = makeWork();
      let done = false;
      try {
        while (!done) yield () => {
          const step = work.next();
          done = step.done;
          if (done) value = step.value;
        };
      } finally { work.return(); }
    }, {...options,late:false});
    return value;
  }

  async function prepare(roots, {tier,priority,signal,prepareModel}) {
    const linear = () => tier === 'detailed';
    const options = {priority,signal,late:false};
    const results = await Promise.allSettled([
      prepareModel(roots, {...options,linear,includeInSceneSweep:false}),
      queue.enqueue(function* () {
        const programs = new Set();
        for (const output of linear() ? [false,true] : [false]) {
          for (let count=0; count<=variable.length; count++) {
            for (const root of roots) yield () => compile([root],count,output,programs);
          }
        }
        for (const program of programs) while (!program.isReady()) yield () => false;
      }, options)
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    const gl = renderer.getContext();
    let fence;
    try {
      // Await submitted work without synchronously waiting on the driver.
      await queue.enqueue(function* () {
        yield () => {
          fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
          if (!fence) throw new Error('Unable to fence interior kit uploads');
          gl.flush();
          return false;
        };
        let status;
        do {
          yield () => { status = gl.clientWaitSync(fence,0,0); return status !== gl.TIMEOUT_EXPIRED; };
        } while (status === gl.TIMEOUT_EXPIRED);
        if (status === gl.WAIT_FAILED) throw new Error('Interior kit GPU fence failed');
      }, options);
    } finally {
      if (fence && !gl.isContextLost()) gl.deleteSync(fence);
    }
  }

  return {
    build, prepare,
    runFrame(remaining) { return queue.runFrame(!renderer.getContext().isContextLost(), remaining); },
    dispose() { queue.dispose(); target.dispose(); }
  };
}
