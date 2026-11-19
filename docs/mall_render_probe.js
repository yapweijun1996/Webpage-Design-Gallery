// Loaded by Playwright before Three.js. Nothing here ships with the mall.
(() => {
  const events = window.__THREE_DEVTOOLS__ ||= new EventTarget();
  const scenes = new Map();
  const probe = window.mallProbe = {scenes, renderer: null, timing: false, drawOwners: false};
  let gl, ext, rendererName, active, inCallback = false;
  const pending = [], samples = [];
  let owners, peakOwners, ownerScene, collectOwners = false, peakDraws = 0;
  probe.startOwners = (enabled, sceneId) => {
    probe.drawOwners = enabled;
    ownerScene = sceneId;
    peakDraws = 0;
    peakOwners = null;
  };
  function poll() {
    if (!ext) return;
    const invalid = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (pending.length) {
      const {query, at} = pending[0];
      if (!invalid && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!invalid) samples.push({at, ms: gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6});
      gl.deleteQuery(query);
      pending.shift();
    }
  }
  events.addEventListener('observe', ({detail}) => {
    if (detail.isScene) scenes.set(detail.uuid, detail);
    if (detail.domElement?.id !== 'scene' || !detail.getContext) return;
    probe.renderer = detail;
    gl = detail.getContext();
    ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    rendererName = debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    const draw = detail.renderBufferDirect;
    detail.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
      if (!collectOwners) return draw.apply(this, arguments);
      const before = this.info.render.calls, beforeTriangles = this.info.render.triangles;
      const result = draw.apply(this, arguments);
      const calls = this.info.render.calls - before;
      if (calls) {
        const label = object.name.trim() || object.material?.name || object.type;
        const name = object.parent?.name ? `${object.parent.name} / ${label}` : label;
        const entry = owners.get(object.id) ?? {id:object.id, name, calls:0, triangles:0};
        entry.calls += calls;
        entry.triangles += this.info.render.triangles - beforeTriangles;
        owners.set(object.id, entry);
      }
      return result;
    };
    const render = detail.render;
    detail.render = function(scene, camera) {
      if (probe.timing && ext && inCallback && !active && pending.length < 12) {
        active = gl.createQuery();
        if (active) gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
      }
      const previous = collectOwners;
      collectOwners = Boolean(owners && (!ownerScene || scene.uuid === ownerScene));
      try { return render.call(this, scene, camera); }
      finally { collectOwners = previous; }
    };
  });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => raf(at => {
    if (probe.timing || pending.length) poll();
    inCallback = true;
    if (probe.drawOwners) owners = new Map();
    try { callback(at); }
    finally {
      inCallback = false;
      if (owners) {
        const entries = [...owners.values()];
        const calls = entries.reduce((sum, entry) => sum + entry.calls, 0);
        if (calls > peakDraws) {
          peakDraws = calls;
          peakOwners = entries.sort((a,b) => b.calls-a.calls || b.triangles-a.triangles);
        }
        owners = null;
      }
      if (active) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push({query: active, at});
        active = null;
      }
    }
  });
  probe.read = (start, sceneId) => {
    poll();
    const valid = samples.splice(0).filter(sample => sample.at >= start);
    const scene = scenes.get(sceneId);
    if (!scene || !probe.renderer) throw Error('The probe could not observe the active Three.js world');
    let lights = 0;
    scene.traverseVisible(node => { if (node.isPointLight) lights++; });
    return {gpuMs: valid.length ? valid.reduce((sum, s) => sum + s.ms, 0) / valid.length : null,
      gpuSamples: valid.length, gpuTimerAvailable: Boolean(ext), renderer: rendererName ?? null,
      shaderPrograms: probe.renderer.info.programs.length, pointLights: lights,
      bufferWidth: gl?.drawingBufferWidth, bufferHeight: gl?.drawingBufferHeight,
      ...(probe.drawOwners && {drawOwnerCalls:peakDraws, drawOwners:peakOwners})};
  };
})();
