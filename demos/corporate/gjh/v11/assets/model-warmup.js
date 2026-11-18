// Optional models stay detached until this idle work has finished or been skipped.
export function createModelWarmup(T, renderer, firstFrame, canWarm) {
  let pending = firstFrame;
  const camera = new T.PerspectiveCamera();
  camera.position.z = 1;

  function warm(model, scene) {
    if (!canWarm() || document.hidden || renderer.getContext().isContextLost()) return;
    const staging = new T.Scene();
    staging.fog = scene.fog;
    staging.environment = scene.environment;
    const target = new T.WebGLRenderTarget(1, 1);
    const previousTarget = renderer.getRenderTarget();
    const toneMapping = renderer.toneMapping;
    const shadows = renderer.shadowMap;
    const {autoUpdate, needsUpdate} = shadows;
    const renderInfo = renderer.info.render;
    const {calls, triangles, points, lines} = renderInfo;
    const visible = model.visible;
    const culled = [];
    try {
      // Match the live lights for the default framebuffer shader variants.
      for (const light of scene.children) if (light.isLight && light.visible) staging.add(light.clone());
      staging.add(model);
      model.visible = true;
      renderer.compile?.(staging, camera);
      model.traverseVisible(mesh => {
        if (!mesh.isMesh || !mesh.frustumCulled) return;
        culled.push(mesh);
        mesh.frustumCulled = false;
      });
      // The tiny offscreen draw submits vertex and texture uploads. It also
      // avoids r170's asynchronous shader polling across context restoration.
      shadows.autoUpdate = shadows.needsUpdate = false;
      renderer.setRenderTarget(target);
      renderer.render(staging, camera);
    } finally {
      for (const mesh of culled) mesh.frustumCulled = true;
      model.visible = visible;
      staging.clear();
      renderer.toneMapping = toneMapping;
      shadows.autoUpdate = autoUpdate;
      shadows.needsUpdate = needsUpdate;
      Object.assign(renderInfo, {calls, triangles, points, lines});
      try { renderer.setRenderTarget(previousTarget); }
      finally { target.dispose(); }
    }
  }

  return (model, scene) => {
    pending = pending.then(() => new Promise(resolve => {
      if (!canWarm() || document.hidden) { resolve(); return; }
      const run = () => {
        try { warm(model, scene); } catch { /* The regular draw may still succeed. */ }
        finally { resolve(); }
      };
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, {timeout:1500});
      else window.setTimeout(run, 100);
    })).catch(() => { /* Scheduling is optional too. */ });
    return pending;
  };
}
