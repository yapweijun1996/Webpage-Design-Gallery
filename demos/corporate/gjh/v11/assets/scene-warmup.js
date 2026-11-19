import {captureShadowMaterials, limitWarmGeometry, meshTextures, withShadowMaterials} from './model-warmup.js';
import {registerInteriorWarmup} from './interiors/warmup.js';
import {spatial, courtyardArrival} from './spatial.js';
import {expandedLayout, shopEntrance} from './expanded-layout.js';

export function createWarmReport() {
  return {ms:0, probes:0, programs:0, textures:0, lightVariants:0, shadowCasters:0, skipped:false, reason:'pending'};
}

// Submit the real first view under the overlay and give its GPU work time to
// finish. Polling never blocks the thread or waits for the full mall sweep.
export function* prepareEntryFrame(gl, draw, now = () => performance.now()) {
  const start = now(), deadline = start + 300;
  const result = reason => ({reason, ms:Math.round(now() - start)});
  draw();
  if (gl.isContextLost()) return result('context-loss');
  if (now() >= deadline) return result('timeout');
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!fence) return result('unavailable');
  try {
    gl.flush();
    do {
      yield;
      if (gl.isContextLost()) return result('context-loss');
      if (now() >= deadline) return result('timeout');
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.WAIT_FAILED) return result('unavailable');
      if (status !== gl.TIMEOUT_EXPIRED) return result('complete');
    } while (true);
  } finally {
    if (!gl.isContextLost()) gl.deleteSync(fence);
  }
}

// One owner for manual, adaptive and viewport-triggered tier requests. A
// superseded iterator is closed before another can publish staged objects.
export function createTierQueue(enqueue) {
  let pending;
  function cancel() {
    pending?.controller.abort();
    pending = null;
  }
  function request(key, makeWork) {
    if (pending?.key === key) return pending.promise;
    cancel();
    const controller = new AbortController();
    // Retarget nearest-first interior downloads immediately, even when an old
    // room's upload would otherwise take priority over the new sweep.
    const work = makeWork();
    const promise = enqueue(() => work, {signal:controller.signal}).catch(error => {
      if (error.name !== 'AbortError') throw error;
    }).finally(() => {
      if (pending?.controller === controller) pending = null;
    });
    pending = {key, controller, promise};
    return promise;
  }
  return {request, cancel, get pending() { return Boolean(pending); }};
}

// Registration is eager so even an already-dismissed loader starts the room
// queue. Closing the sweep releases its sign stage and leaves room RAFs running.
export function prepareTier({T, renderer, world, player, expanded, elevator, atmosphere,
  modelWarmup, width, height, screenPixel, applyProfile, frameTrace, startup=false}, profile, report) {
  const {scene, signage, interiors} = world;
  const {tier, shadows} = profile;
  void world.bakedLighting?.prepare(tier);
  let interiorsReady = false, interiorError;
  void registerInteriorWarmup(interiors, {T, renderer, scene, lights:atmosphere.interiorWarmLights, tier},
    {deferActivation:true}).then(() => { interiorsReady = true; }, error => { interiorError = error; });

  return sweep();
  function* sweep() {
    let stage;
    try {
      const directPrepared = new WeakSet(), directPrograms = new Set();
      if (startup && ((expanded && shadows) || (signage && signage.getTier() !== tier))) {
        yield* prepareScene({T, renderer, scene, camera:player.camera, expanded, elevator,
          shadows:false, detailed:false, artworkTier:tier, screenPixel, extra:modelWarmup.pendingMeshes(),
          exclude:interiors?.groups, prepared:directPrepared, programs:directPrograms,
          updateLights:atmosphere.setLightFloor ?? atmosphere.update, lightVariants:atmosphere.lightVariants,
          initTexture:modelWarmup.initTexture, alternatesFor:modelWarmup.alternatesFor}, report);
      }
      if (signage) {
        const signageWork = signage.prepareTier(tier, renderer);
        stage = yield* (frameTrace ? frameTrace.steps('signage.prepare', signageWork) : signageWork);
      }
      const replacing = stage && stage.meshes !== signage.activeMeshes();
      // The room installer fences the exact selected layers and lighting. A
      // scene traversal would also warm cached rooms from inactive tiers.
      const exclude = [...(interiors?.groups ?? [])];
      if (replacing) exclude.push(...signage.activeMeshes());
      const detailed = expanded && shadows;
      if (detailed) yield* atmosphere.preparePost(Math.floor(width*profile.pixelRatio),
        Math.floor(height*profile.pixelRatio),screenPixel);
      const prepared = shadows ? new WeakSet() : directPrepared, programs = directPrograms;
      const {camera,state} = player, direction = camera.getWorldDirection(new T.Vector3());
      const chase = tier === 'low' ? null : {
        distance:Math.hypot(camera.position.x-state.x,camera.position.z-state.z),
        height:camera.position.y-state.y, pitch:Math.asin(direction.y)
      };
      let revision;
      do {
        revision = modelWarmup.arrivalRevision;
        const extra = modelWarmup.pendingMeshes();
        if (replacing) extra.push(...stage.meshes);
        yield* prepareScene({T, renderer, scene, camera, expanded, elevator, shadows, detailed, artworkTier:tier,
          screenPixel, extra, exclude, prepared, programs, chase, updateLights:atmosphere.setLightFloor ?? atmosphere.update,
          lightVariants:atmosphere.lightVariants, initTexture:modelWarmup.initTexture,
          alternatesFor:modelWarmup.alternatesFor}, report);
        while (!interiorsReady) {
          if (interiorError) throw interiorError;
          yield false;
        }
        // Cached rooms skip the installer. Their shared atlas still has to
        // follow the incoming tier after a downgrade or a superseded sweep.
        for (const texture of interiors?.artworkForTier?.(tier) ?? []) {
          if (modelWarmup.initTexture(texture,tier)) yield false;
        }
        // Other models can arrive while either GPU fence is pending.
      } while (revision !== modelWarmup.arrivalRevision);
      if (interiors && !interiors.activateTier(tier)) throw new Error('Interior tier was superseded');
      if (stage) signage.activate(stage);
      applyProfile(profile);
    } finally {
      if (stage) signage.discard(stage);
    }
  }
}

// The mall's RAF drives the iterator. A separate timer also bounds a driver
// fence that never signals or a foreground window that stops receiving frames.
export function createWarmRunner(work, report, {
  budgetMs, onRelease = () => {}, onFinish, lost, signal, now = () => performance.now(),
  setTimer = setTimeout, clearTimer = clearTimeout
}) {
  let started = now(), elapsed = 0, timer, finished = false, blocking = true;
  const duration = () => elapsed + (started === null ? 0 : now() - started);
  function release(reason) {
    if (!blocking) return;
    blocking = false;
    clearTimer(timer);
    signal?.removeEventListener('abort', skip);
    report.ms = Math.round(duration());
    report.reason = reason;
    report.skipped = reason !== 'complete';
    onRelease(report);
  }
  function stop(reason) {
    if (finished) return;
    finished = true;
    if (!blocking) report.background = reason;
    try { work.return(); } finally {
      release(reason);
      onFinish(report);
    }
  }
  function background(reason) {
    report.background = 'running';
    release(reason);
  }
  function arm() {
    timer = setTimer(() => lost() ? stop('context-loss') : background('timeout'), 6000 - elapsed);
  }
  function skip() { background(signal.reason); }
  if (signal?.aborted) skip();
  else {
    arm();
    signal?.addEventListener('abort', skip, {once:true});
  }
  return {
    stop,
    get blocking() { return blocking; },
    visibility(hidden) {
      if (finished || hidden === (started === null)) return;
      if (hidden) {
        elapsed = duration();
        started = null;
        clearTimer(timer);
      } else {
        started = now();
        if (blocking) arm();
      }
    },
    runFrame(remaining = 4) {
      if (finished || started === null) return;
      const sliceStart = now();
      const budget = blocking ? budgetMs : Math.min(4, remaining);
      try {
        while (now() - sliceStart < budget) {
          if (lost()) return stop('context-loss');
          if (blocking && duration() >= 6000) return background('timeout');
          const step = work.next();
          if (step.done) {
            if (blocking && duration() >= 6000) background('timeout');
            return stop('complete');
          }
          if (step.value === false) return; // Poll parallel link / GPU completion next frame.
        }
      } catch (error) {
        console.warn('Mall detail preparation interrupted', error);
        stop('error');
      }
    }
  };
}

export function mallProbePoses(expanded, elevator, chase) {
  const atrium = expanded ? expandedLayout.atrium : courtyardArrival;
  const poses = [{...atrium, y:0, yaw:0}];
  if (expanded) {
    poses.push({...expandedLayout.entrance, y:0, yaw:0});
    for (const slot of expandedLayout.slots) {
      const door = shopEntrance(slot);
      poses.push({x:door.x + 2.4 * door.normalX, z:door.z + 2.4 * door.normalZ, y:0, yaw:door.yaw});
    }
  } else {
    for (const store of spatial.stores) poses.push({...store.arrival, y:0, yaw:0});
  }
  const deck = elevator ?? (expanded ? expandedLayout.lift : null);
  if (deck) poses.push({x:deck.x, z:deck.z, y:deck.upper, yaw:0});
  if (expanded && chase) {
    // The entry-facing eye probe misses both side aisles and the spring-arm
    // view after the northbound 2.5-second walk away from the arrival.
    for (const [advance,yaw] of [[0,Math.PI/2],[0,-Math.PI/2],[6.6,0]]) {
      poses.push({x:atrium.x,z:atrium.z-advance,y:0,yaw,chase});
    }
  }
  return poses;
}

// r170's screen and linear-target programs differ. A nonempty one-pixel
// viewport on the real canvas exercises its output color space under
// the opaque loader. Detailed ground-floor passes use the linear target too.
export function* prepareScene({T, renderer, scene, camera, expanded, elevator, detailed, artworkTier,
  updateLights, lightVariants, initTexture, alternatesFor, shadows=renderer.shadowMap.enabled, extra=[], exclude=[], screenPixel=()=>1,
  prepared=new WeakSet(), programs=new Set(), chase}, report) {
  const probe = camera.clone(false), staging = new T.Scene(), meshes = [], lights = [];
  const frustum = new T.Frustum(), viewProjection = new T.Matrix4();
  staging.name = 'Mall scene warmup';
  staging.matrixWorldAutoUpdate = false;
  staging.environment = scene.environment;
  staging.environmentIntensity = scene.environmentIntensity;
  staging.environmentRotation.copy(scene.environmentRotation);
  staging.fog = scene.fog;
  const textures = new Set();
  for (const texture of [scene.environment, scene.background]) if (texture?.isTexture) textures.add(texture);
  const stack = [scene, ...extra], excluded = new Set(exclude);
  while (stack.length) {
    const node = stack.pop();
    if (excluded.has(node)) continue;
    excluded.add(node);
    stack.push(...node.children);
    if (node.isLight) {
      lights.push(node);
      if (node.map?.isTexture) textures.add(node.map);
    }
    if (node.isMesh || node.isLine || node.isPoints || node.isSprite) {
      const alternates=alternatesFor?.(node);
      if(alternates)stack.push(...alternates.filter(other=>other.geometry!==node.geometry || other.material!==node.material));
      if(prepared.has(node))continue;
      prepared.add(node);
      meshes.push(node);
      for (const texture of meshTextures(node,shadows)) textures.add(texture);
    }
    yield;
  }
  if (!meshes.length) return;

  const gl = renderer.getContext(), parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const target = detailed ? new T.WebGLRenderTarget(1, 1) : null;
  const viewport = new T.Vector4(), scissor = new T.Vector4();
  const variants = new Map();
  let fence;
  function probeLights(pose) {
    const previous = lights.map(light => light.visible);
    try {
      updateLights(pose);
      return lights.filter(light => {
        for (let node = light; node; node = node.parent) if (!node.visible) return false;
        return true;
      });
    } finally {
      lights.forEach((light, i) => { light.visible = previous[i]; });
    }
  }

  function submit(batch, activeLights, output, compile, depth=false, passShadows=shadows, depthMaterials) {
    const objects = [...activeLights, ...batch];
    const saved = objects.map(node => [node.visible, node.frustumCulled, node.layers.mask, node.children]);
    const instanceCounts = new Map();
    const hiddenMaterials = new Set(), restoreGeometry = new Map();
    const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear, sortObjects=renderer.sortObjects;
    const shadowMap = renderer.shadowMap;
    const shadowEnabled = shadowMap.enabled, shadowAuto = shadowMap.autoUpdate, shadowNeeds = shadowMap.needsUpdate;
    const info = renderer.info.render, {calls, triangles, points, lines} = info;
    renderer.getViewport(viewport);
    renderer.getScissor(scissor);
    try {
      for (const node of objects) {
        // Keep the real object, including its per-object instance and skin bindings.
        node.updateWorldMatrix(true, false);
        node.children = [];
        node.visible = true;
        node.frustumCulled = false;
        node.layers.mask = 1;
      }
      for (const mesh of batch) {
        const geometry = mesh.geometry;
        if (!compile && geometry && !restoreGeometry.has(geometry)) {
          restoreGeometry.set(geometry, limitWarmGeometry(geometry, Array.isArray(mesh.material)));
        }
        if (!compile && mesh.isInstancedMesh) {
          instanceCounts.set(mesh, mesh.count);
          mesh.count = Math.min(1, mesh.instanceMatrix.count);
        }
        for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (!mat.visible) { hiddenMaterials.add(mat); mat.visible = true; }
        }
      }
      staging.children = objects;
      renderer.setRenderTarget(output);
      if (!output) {
        renderer.setViewport(0, 0, 1, 1);
        const size=screenPixel();
        renderer.setScissor(0, 0, size, size);
        renderer.setScissorTest(true);
      }
      shadowMap.enabled = passShadows;
      shadowMap.autoUpdate = shadowMap.needsUpdate = depth;
      renderer.autoClear = true;
      renderer.sortObjects = false; // Never cache bounds at the temporary instance count.
      if (compile) {
        const linked = [];
        const compileBatch = () => renderer.compile(staging, probe);
        const materials = depthMaterials ? withShadowMaterials(batch[0],depthMaterials,staging,compileBatch) : compileBatch();
        for (const material of materials) {
          // A shared material can have instanced, skinned and two-sided variants.
          for (const program of renderer.properties.get(material).programs.values()) {
            if (!programs.has(program)) {
              programs.add(program);
              linked.push(program);
            }
          }
        }
        report.programs = programs.size;
        return linked;
      } else renderer.render(staging, probe);
    } finally {
      staging.children = [];
      objects.forEach((node, i) => {
        [node.visible, node.frustumCulled, node.layers.mask, node.children] = saved[i];
      });
      for (const material of hiddenMaterials) material.visible = false;
      for (const [mesh, count] of instanceCounts) mesh.count = count;
      for (const restore of restoreGeometry.values()) restore();
      renderer.autoClear = autoClear;
      renderer.sortObjects = sortObjects;
      shadowMap.enabled = shadowEnabled;
      shadowMap.autoUpdate = shadowAuto;
      shadowMap.needsUpdate = shadowNeeds;
      Object.assign(info, {calls, triangles, points, lines});
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.setRenderTarget(previous, face, mip);
    }
  }

  // Light counts are shader defines. Doors with the same lighting still draw
  // from their own pose, but only a new shader configuration needs a full sweep.
  function variantKey(activeLights, output) {
    return (output ? 'linear:' : 'screen:') +
      activeLights.map(light => light.type + Number(light.castShadow) + Number(Boolean(light.map))).sort().join(',');
  }
  const visits=[];
  const glow=detailed ? meshes.filter(mesh=>mesh.layers.isEnabled(1)) : [];
  const npcMeshes=meshes.filter(mesh=>mesh.layers.isEnabled(2));
  const batchSize=4;
  function addPass(pose, active, output, candidates, layer='main', probeVisit=false, passShadows=shadows) {
    if(!candidates.length)return;
    const key=layer+passShadows+variantKey(active,output);
    const fresh=!variants.has(key);
    const pass={pose,active,output,candidates,fresh,passShadows};
    if(fresh)variants.set(key,pass);
    if(fresh || probeVisit)visits.push(pass);
  }
  function addPose(pose,onlyNew=false) {
    const active=probeLights(pose), main=active.filter(light=>light.layers.isEnabled(0));
    const output=detailed && pose.y===0 ? target : null;
    if(onlyNew && variants.has('main'+shadows+variantKey(main,output)))return;
    addPass(pose,main,output,meshes,'main',true);
    if(output)addPass(pose,active.filter(light=>light.layers.isEnabled(1)),target,glow,'glow');
    visits.push({endPose:true});
  }
  function position(pose) {
    const arm=pose.chase?.distance ?? 0;
    probe.position.set(pose.x+Math.sin(pose.yaw)*arm,pose.y+(pose.chase?.height ?? 1.65),pose.z+Math.cos(pose.yaw)*arm);
    probe.rotation.set(pose.chase?.pitch ?? 0,pose.yaw,0,'YXZ');
    probe.updateMatrixWorld();
    frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(probe.projectionMatrix,probe.matrixWorldInverse));
  }

  try {
    probe.layers.set(0);
    const poses=mallProbePoses(expanded,elevator,chase);
    for(const pose of poses)addPose(pose);
    if(lightVariants){
      for(const active of lightVariants(lights)){
        const main=active.filter(light=>light.layers.isEnabled(0));
        for(const output of detailed ? [target,null] : [null]) {
          addPass(poses[0],main,output,meshes);
          if (detailed && !output) addPass(poses[0],main,output,meshes,'main',false,false);
          const npcLights=active.filter(light=>light.layers.isEnabled(2));
          if (variantKey(npcLights,output)!==variantKey(main,output)) {
            addPass(poses[0],npcLights,output,npcMeshes,'npc');
            if (detailed && !output) addPass(poses[0],npcLights,output,npcMeshes,'npc',false,false);
          }
        }
        if(detailed)addPass(poses[0],active.filter(light=>light.layers.isEnabled(1)),target,glow,'glow');
      }
    } else if(expanded){
      const {entrance,atrium}=expandedLayout;
      for(const end of [atrium,...spatial.stores.map(store=>store.arrival)]){
        const distance=Math.ceil(Math.hypot(end.x-entrance.x,end.z-entrance.z));
        for(let i=1;i<distance;i++){
          addPose({x:entrance.x+(end.x-entrance.x)*i/distance,z:entrance.z+(end.z-entrance.z)*i/distance,y:0,yaw:0},true);
          yield;
        }
      }
    }
    report.lightVariants=Math.max(report.lightVariants,variants.size);
    for (const texture of textures) {
      const uploaded = initTexture(texture,artworkTier);
      report.textures++;
      yield uploaded && (shadows || texture.userData?.artworkMipmaps === 'generate') ? false : undefined;
    }
    // A live draw shares ANGLE's command stream with the staging renderer.
    // Drain each link batch before adding more work to that stream.
    for(const {active,output,candidates,passShadows} of variants.values()){
      const linkSize = shadows ? 1 : batchSize;
      for(let i=0;i<candidates.length;i+=linkSize){
        const linking = submit(candidates.slice(i,i+linkSize),active,output,true,false,passShadows);
        if (parallel && linking.length) {
          yield false;
          for (const program of linking) while (!program.isReady()) yield false;
        }
        yield shadows && linking.length ? false : undefined;
      }
    }
    if (shadows) {
      const casters = meshes.filter(mesh => mesh.castShadow);
      // A color compile does not visit Three's native shadow materials. Warm
      // those bindings through its actual depth pass, independent of the
      // follow camera's current coverage or the caster's live visibility.
      const shadowPasses = new Map();
      for (const {active,passShadows} of variants.values()) {
        if (passShadows && active.some(light => light.castShadow)) {
          shadowPasses.set(variantKey(active,target),active);
        }
      }
      // Also keep the caller's explicit shadow pass for custom scenes.
      if (!shadowPasses.size) {
        const active = probeLights(poses[0]).filter(light => light.layers.isEnabled(0));
        shadowPasses.set(variantKey(active,target),active);
      }
      for (const active of shadowPasses.values()) {
        // Initialize the retained map even when every caster arrives late.
        submit([],active,target,false,true);
        yield false;
        for (const caster of casters) {
          const draw = () => submit([caster],active,target,false,true);
          const materials = captureShadowMaterials(renderer,draw);
          try {
            if (materials.length) {
              yield false;
              const linking = submit([caster],active,target,true,false,true,materials);
              yield false;
              if (parallel) for (const program of linking) while (!program.isReady()) yield false;
            }
            draw();
            yield false;
          } finally {
            materials.forEach(material => material.dispose());
          }
        }
      }
      report.shadowCasters += casters.length;
    }
    let completedPoses=0;
    for(const visit of visits){
      if(visit.endPose){report.probes=Math.max(report.probes,++completedPoses);continue;}
      const {pose,active,output,fresh,candidates,passShadows}=visit;
      position(pose);
      let batch=[];
      for(const mesh of candidates){
        if(fresh || !mesh.frustumCulled || (mesh.isSprite?frustum.intersectsSprite(mesh):frustum.intersectsObject(mesh)))batch.push(mesh);
        if(batch.length===batchSize){
          submit(batch,active,output,false,false,passShadows);
          batch=[];
          yield false;
          if(!fresh)break;
        }
      }
      if(batch.length){submit(batch,active,output,false,false,passShadows);yield false;}
    }
    // rAF and renderer.render only establish CPU submission. Wait without
    // blocking the UI for commands already queued on the actual WebGL2 driver.
    fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!fence) throw new Error('Unable to fence mall detail uploads');
    gl.flush();
    let status;
    do {
      yield false;
      status = gl.clientWaitSync(fence, 0, 0);
    } while (status === gl.TIMEOUT_EXPIRED);
    if (status === gl.WAIT_FAILED) throw new Error('Mall detail GPU fence failed');
  } finally {
    if (fence && !gl.isContextLost()) gl.deleteSync(fence);
    target?.dispose();
  }
}
