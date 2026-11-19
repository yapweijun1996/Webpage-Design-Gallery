import {setArtworkTextureTier} from './artwork-textures.js';

// Run from the mall's frame loop so every producer shares one upload budget.
export function createUploadScheduler({now = () => performance.now(), budgetMs = 4, maxSteps = 2} = {}) {
  const jobs = [];
  let maxFrameUploadMs = 0, lateAdditions = 0, closed = false;

  function settle(job, error) {
    const index = jobs.indexOf(job);
    if (index < 0) return;
    jobs.splice(index, 1);
    job.signal?.removeEventListener('abort', job.cancel);
    if (error) { job.iterator?.return?.(); job.reject(error); }
    else {
      if (job.late) lateAdditions++;
      job.resolve();
    }
  }

  function enqueue(makeSteps, {priority = () => 0, signal, late = true} = {}) {
    if (closed || signal?.aborted) return Promise.reject(new DOMException('Upload cancelled', 'AbortError'));
    return new Promise((resolve, reject) => {
      const job = {makeSteps, priority, signal, late, resolve, reject, iterator: null};
      job.cancel = () => settle(job, new DOMException('Upload cancelled', 'AbortError'));
      jobs.push(job);
      signal?.addEventListener('abort', job.cancel, {once:true});
    });
  }

  function runFrame(canRun, remaining = budgetMs) {
    if (!canRun || !jobs.length) return 0;
    const start = now();
    let steps = 0;
    while (jobs.length && steps < maxSteps && now() - start < Math.min(budgetMs, remaining)) {
      let job = jobs[0], priority = job.priority();
      for (let i = 1; i < jobs.length; i++) {
        const candidate = jobs[i];
        const rank = candidate.priority();
        if (rank < priority) { job = candidate; priority = rank; }
      }
      try {
        job.iterator ??= job.makeSteps();
        const step = job.iterator.next();
        if (step.done) settle(job);
        else {
          steps++;
          if (step.value() === false) break;
        }
      } catch (error) { settle(job, error); }
    }
    const elapsed = now() - start;
    maxFrameUploadMs = Math.max(maxFrameUploadMs, elapsed);
    return elapsed;
  }

  return {enqueue, runFrame,
    invalidate() { for (const job of jobs) { job.iterator?.return?.(); job.iterator = null; } },
    dispose() { closed = true; while (jobs.length) jobs[0].cancel(); },
    report() { return {lateAdditions, maxFrameUploadMs, pendingUploads:jobs.length}; }};
}

function materialTextures(material) {
  const textures = Object.values(material).filter(value => value?.isTexture);
  for (const {value} of Object.values(material.uniforms ?? {})) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry?.isTexture) textures.push(entry);
    }
  }
  return textures;
}

export function meshTextures(mesh, shadows=false) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const textures = materials.flatMap(materialTextures);
  if (shadows && mesh.castShadow) {
    for (const material of [mesh.customDepthMaterial,mesh.customDistanceMaterial]) {
      if (material) textures.push(...materialTextures(material));
    }
  }
  if (mesh.isSkinnedMesh && mesh.skeleton) {
    if (!mesh.skeleton.boneTexture) mesh.skeleton.computeBoneTexture();
    textures.push(mesh.skeleton.boneTexture);
  }
  if (mesh.morphTexture) textures.push(mesh.morphTexture);
  return textures;
}

// A minimal draw exercises the real bindings without resubmitting hidden stock.
export function limitWarmGeometry(geometry, grouped) {
  const {start, count} = geometry.drawRange, groups = geometry.groups;
  if (grouped && groups.length) {
    geometry.groups = groups.map(group => ({...group, count:Math.min(6, group.count)}));
    geometry.setDrawRange(0, Infinity);
  } else geometry.setDrawRange(0, 6);
  return () => {
    geometry.groups = groups;
    geometry.setDrawRange(start, count);
  };
}

export function createModelWarmup(T, renderer) {
  const scheduler = createUploadScheduler();
  let initialized = new WeakMap();
  const alternateBindings = new WeakMap(), pendingBatches=new Set();
  let arrivalRevision=0;
  const camera = new T.PerspectiveCamera();
  camera.position.z = 1;
  const staging = new T.Scene();
  staging.name = 'Model warmup';
  staging.matrixWorldAutoUpdate = false;
  const target = new T.WebGLRenderTarget(1, 1);
  const scissor = new T.Vector4();

  function initTexture(texture, artworkTier) {
    setArtworkTextureTier(texture, artworkTier);
    if (initialized.get(texture) === texture.version) return false;
    renderer.initTexture(texture);
    initialized.set(texture, texture.version);
    return true;
  }

  function withMesh(mesh, scene, mask, linear, work) {
    const {visible, frustumCulled, children, count} = mesh;
    const layers = mesh.layers.mask;
    const previousTarget = renderer.getRenderTarget();
    const activeFace = renderer.getActiveCubeFace(), activeMip = renderer.getActiveMipmapLevel();
    const scissorTest = renderer.getScissorTest();
    const {autoClear, toneMapping, sortObjects} = renderer, autoReset = renderer.info.autoReset;
    const shadows = renderer.shadowMap, {autoUpdate, needsUpdate} = shadows;
    const {calls, triangles, points, lines} = renderer.info.render;
    renderer.getScissor(scissor);
    try {
      staging.fog = scene.fog;
      staging.environment = scene.environment;
      staging.environmentIntensity = scene.environmentIntensity;
      // Keep the exact mesh and its bindings. In particular, r170 uploads
      // instance attributes per object; a cloned mesh would upload its own.
      staging.children = scene.children.filter(node => node.isLight && node.visible);
      staging.children.push(mesh);
      mesh.children = [];
      mesh.layers.mask = mask;
      mesh.visible = true;
      mesh.frustumCulled = false;
      if (mesh.isInstancedMesh) mesh.count = Math.min(1, mesh.instanceMatrix.count);
      camera.layers.mask = mask & 1 ? 1 : mask;
      mesh.updateWorldMatrix(true, false);
      renderer.autoClear = false;
      renderer.sortObjects = false;
      renderer.info.autoReset = false;
      shadows.autoUpdate = shadows.needsUpdate = false;
      renderer.setRenderTarget(linear ? target : null);
      if (!linear) {
        // An empty scissor keeps the canvas intact and uses the real screen
        // color space and tone mapping. A normal render target changes both.
        renderer.setScissor(0, 0, 0, 0);
        renderer.setScissorTest(true);
      }
      return work();
    } finally {
      mesh.visible = visible;
      mesh.frustumCulled = frustumCulled;
      mesh.children = children;
      mesh.layers.mask = layers;
      if (mesh.isInstancedMesh) mesh.count = count;
      staging.children = [];
      renderer.autoClear = autoClear;
      renderer.sortObjects = sortObjects;
      renderer.toneMapping = toneMapping;
      renderer.info.autoReset = autoReset;
      // Keep Three's frame counter monotonic for its internal upload caches.
      Object.assign(renderer.info.render, {calls, triangles, points, lines});
      shadows.autoUpdate = autoUpdate;
      shadows.needsUpdate = needsUpdate;
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.setRenderTarget(previousTarget, activeFace, activeMip);
    }
  }

  function* prepareMesh(mesh, scene, mask, linear) {
    let programs;
    yield () => {
      const materials = withMesh(mesh, scene, mask, linear, () => renderer.compile(staging, camera));
      // r170 compileAsync polls these programs on a timer. Hold the references
      // in this job so polling pauses with it and restarts on context loss.
      if (renderer.extensions?.has('KHR_parallel_shader_compile')) {
        programs = [...materials].map(material => renderer.properties.get(material).currentProgram);
      }
      return false;
    };
    while (programs?.some(program => !program.isReady())) yield () => false;
    yield () => {
      const restore = limitWarmGeometry(mesh.geometry, Array.isArray(mesh.material));
      try { withMesh(mesh, scene, mask, linear, () => renderer.render(staging, camera)); }
      finally { restore(); }
      return false;
    };
  }

  function prepare(root, scene, {hide = false, linear = () => false, artworkTier, alternates = [], includeInSceneSweep = true, ...options} = {}) {
    const meshes = [];
    for (const model of Array.isArray(root) ? root : [root]) {
      model.traverse(mesh => {
        if (mesh.isMesh || mesh.isLine || mesh.isPoints) meshes.push({mesh, mask:mesh.layers.mask});
      });
    }
    if (!meshes.length) return Promise.resolve();
    if (includeInSceneSweep) {
      pendingBatches.add(meshes);
      arrivalRevision++;
    }
    if (hide) for (const {mesh} of meshes) mesh.layers.mask = 0;
    return scheduler.enqueue(function* () {
      for (const {mesh, mask} of meshes) {
        for (const texture of new Set(meshTextures(mesh))) {
          if (artworkTier === undefined && initialized.get(texture) === texture.version) continue;
          yield () => {
            if (initTexture(texture,artworkTier) && texture.userData?.artworkMipmaps === 'generate') return false;
          };
        }
        yield* prepareMesh(mesh, scene, mask, false);
        if (linear()) yield* prepareMesh(mesh, scene, mask, true);
      }
    }, options).then(() => {
      // LOD swaps replace geometry/material on the same live mesh; traversal
      // alone can only see one binding. Keep both with the owner's lifetime.
      for (const [owner,alternate] of alternates) {
        alternateBindings.set(owner,[owner.clone(false),alternate]);
      }
    }).finally(() => {
      pendingBatches.delete(meshes);
      if (hide) for (const {mesh, mask} of meshes) mesh.layers.mask = mask;
    });
  }

  // Tiny inventory steps share a slice. GPU waits always release the RAF.
  // Closing this adapter also closes the underlying sweep and its GPU fence.
  function enqueueSweep(makeWork, options) {
    return scheduler.enqueue(function* () {
      const work=makeWork();
      let done=false;
      try {
        while(!done) yield () => {
          const start=performance.now();
          do {
            const step=work.next();
            done=step.done;
            if(done || step.value===false)break;
          } while(performance.now()-start<1.5);
          return false;
        };
      } finally {work.return();}
    },{late:false,...options});
  }

  return {prepare, initTexture, enqueueSweep, alternatesFor:mesh=>alternateBindings.get(mesh),
    get arrivalRevision(){return arrivalRevision;},
    pendingMeshes:()=>Array.from(pendingBatches).flatMap(batch=>batch.map(entry=>entry.mesh)),
    report:scheduler.report,
    runFrame(canRun, remaining) { return scheduler.runFrame(canRun && !renderer.getContext().isContextLost(), remaining); },
    invalidate() { initialized = new WeakMap(); scheduler.invalidate(); },
    dispose() { scheduler.dispose(); target.dispose(); }};
}
