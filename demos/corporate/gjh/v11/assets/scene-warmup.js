import {meshTextures} from './model-warmup.js';
import {spatial, courtyardArrival} from './spatial.js';
import {expandedLayout, shopEntrance} from './expanded-layout.js';

export function createWarmReport() {
  return {ms:0, probes:0, programs:0, textures:0, skipped:false, reason:'pending'};
}

// The mall's RAF drives the iterator. A separate timer also bounds a driver
// fence that never signals or a foreground window that stops receiving frames.
export function createWarmRunner(work, report, {
  budgetMs, onFinish, lost, signal, now = () => performance.now(),
  setTimer = setTimeout, clearTimer = clearTimeout
}) {
  let started = now(), elapsed = 0, timer, finished = false;
  const duration = () => elapsed + (started === null ? 0 : now() - started);
  function stop(reason) {
    if (finished) return;
    finished = true;
    clearTimer(timer);
    signal?.removeEventListener('abort', skip);
    report.ms = Math.round(duration());
    report.reason = reason;
    report.skipped = reason !== 'complete';
    try { work.return(); } finally { onFinish(report); }
  }
  function arm() { timer = setTimer(() => stop(lost() ? 'context-loss' : 'timeout'), 6000 - elapsed); }
  function skip() { stop(signal.reason); }
  if (signal?.aborted) skip();
  else {
    arm();
    signal?.addEventListener('abort', skip, {once:true});
  }
  return {
    stop,
    visibility(hidden) {
      if (finished || hidden === (started === null)) return;
      if (hidden) {
        elapsed = duration();
        started = null;
        clearTimer(timer);
      } else {
        started = now();
        arm();
      }
    },
    runFrame() {
      if (finished || started === null) return;
      const sliceStart = now();
      try {
        do {
          if (lost()) return stop('context-loss');
          if (duration() >= 6000) return stop('timeout');
          const step = work.next();
          if (step.done) return stop(duration() >= 6000 ? 'timeout' : 'complete');
          if (step.value === false) return; // Poll parallel link / GPU completion next frame.
        } while (now() - sliceStart < budgetMs);
      } catch (error) {
        console.warn('Mall detail preparation interrupted', error);
        stop('error');
      }
    }
  };
}

export function mallProbePoses(expanded, elevator) {
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
  return poses;
}

// r170's screen and linear-target programs differ. A nonempty one-pixel
// viewport on the real canvas exercises its output color space and MSAA under
// the opaque loader. Detailed ground-floor passes use the linear target too.
export function* prepareScene({T, renderer, scene, camera, expanded, elevator, detailed,
  updateLights, initTexture}, report) {
  const probe = camera.clone(false), staging = new T.Scene(), meshes = [], lights = [];
  const frustum = new T.Frustum(), viewProjection = new T.Matrix4();
  staging.matrixWorldAutoUpdate = false;
  staging.environment = scene.environment;
  staging.environmentIntensity = scene.environmentIntensity;
  staging.environmentRotation.copy(scene.environmentRotation);
  staging.fog = scene.fog;
  const textures = new Set();
  for (const texture of [scene.environment, scene.background]) if (texture?.isTexture) textures.add(texture);
  const stack = [scene];
  while (stack.length) {
    const node = stack.pop();
    stack.push(...node.children);
    if (node.isLight) lights.push(node);
    if (node.isMesh || node.isLine || node.isPoints || node.isSprite) {
      meshes.push(node);
      for (const texture of meshTextures(node)) textures.add(texture);
    }
    yield;
  }
  for (const texture of textures) {
    initTexture(texture);
    report.textures++;
    yield;
  }

  const gl = renderer.getContext(), parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const target = detailed ? new T.WebGLRenderTarget(1, 1) : null;
  const viewport = new T.Vector4(), scissor = new T.Vector4();
  const variants = new Set(), programs = new Set();
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

  function submit(batch, activeLights, output, compile) {
    const objects = [...activeLights, ...batch];
    const saved = objects.map(node => [node.visible, node.frustumCulled, node.layers.mask, node.children]);
    const instanceCounts = new Map();
    const hiddenMaterials = new Set();
    const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
    const shadows = renderer.shadowMap, shadowAuto = shadows.autoUpdate, shadowNeeds = shadows.needsUpdate;
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
        if (!compile && mesh.isInstancedMesh) {
          // The full instance buffer uploads even for one instance. Three can
          // cache bounds during render sorting, so compute them at full count.
          if (!mesh.boundingSphere) mesh.computeBoundingSphere();
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
        renderer.setScissor(0, 0, 1, 1);
        renderer.setScissorTest(true);
      }
      shadows.autoUpdate = shadows.needsUpdate = false;
      renderer.autoClear = true;
      if (compile) {
        for (const material of renderer.compile(staging, probe)) {
          // A shared material can have instanced, skinned and two-sided variants.
          for (const program of renderer.properties.get(material).programs.values()) programs.add(program);
        }
        report.programs = programs.size;
      } else renderer.render(staging, probe);
    } finally {
      staging.children = [];
      objects.forEach((node, i) => {
        [node.visible, node.frustumCulled, node.layers.mask, node.children] = saved[i];
      });
      for (const material of hiddenMaterials) material.visible = false;
      for (const [mesh, count] of instanceCounts) mesh.count = count;
      renderer.autoClear = autoClear;
      shadows.autoUpdate = shadowAuto;
      shadows.needsUpdate = shadowNeeds;
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
      activeLights.map(light => light.type + Number(light.castShadow)).sort().join(',');
  }
  function* pass(activeLights, output, candidates) {
    if (!candidates.length) return;
    const key = variantKey(activeLights, output);
    const fresh = !variants.has(key);
    variants.add(key);
    const batchSize = 12;
    if (!fresh) {
      const visible = [];
      for (const mesh of candidates) {
        if (mesh.isSprite ? frustum.intersectsSprite(mesh) : frustum.intersectsObject(mesh)) visible.push(mesh);
        if (visible.length === batchSize) break;
        yield;
      }
      candidates = visible.length ? visible : candidates.slice(0, 1);
    }
    const count = candidates.length;
    if (fresh) {
      for (let i = 0; i < count; i += batchSize) {
        submit(candidates.slice(i, i + batchSize), activeLights, output, true);
        yield;
      }
      if (parallel) {
        const pending = [...programs];
        while (pending.length) {
          if (pending.at(-1).isReady()) pending.pop();
          else yield false;
        }
      }
    }
    for (let i = 0; i < count; i += batchSize) {
      submit(candidates.slice(i, i + batchSize), activeLights, output, false);
      yield;
    }
  }

  try {
    probe.layers.set(0);
    const poses = mallProbePoses(expanded, elevator);
    const glow = detailed ? meshes.filter(mesh => mesh.layers.isEnabled(1)) : [];
    function* drawPose(pose, onlyNewVariant = false) {
      const active = probeLights(pose);
      const mainLights = active.filter(light => light.layers.isEnabled(0));
      const output = detailed && pose.y === 0 ? target : null;
      if (onlyNewVariant && variants.has(variantKey(mainLights, output))) return;
      probe.position.set(pose.x, pose.y + 1.65, pose.z);
      probe.rotation.set(0, pose.yaw, 0);
      probe.updateMatrixWorld();
      frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(probe.projectionMatrix, probe.matrixWorldInverse));
      yield* pass(mainLights, output, meshes);
      if (output && glow.length) yield* pass(active.filter(light => light.layers.isEnabled(1)), target, glow);
      report.probes++;
    }
    for (const pose of poses) yield* drawPose(pose);
    if (expanded) {
      // The middle of an arcade can have a light count none of its doors has.
      // Sample the walk in metre increments and submit only missing variants.
      const {entrance, atrium} = expandedLayout;
      for (const end of [atrium, ...spatial.stores.map(store => store.arrival)]) {
        const distance = Math.ceil(Math.hypot(end.x - entrance.x, end.z - entrance.z));
        for (let i = 1; i < distance; i++) {
          yield* drawPose({x:entrance.x + (end.x - entrance.x) * i / distance,
            z:entrance.z + (end.z - entrance.z) * i / distance, y:0, yaw:0}, true);
          yield;
        }
      }
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
