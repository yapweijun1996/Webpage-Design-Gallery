// Only the flagged ride requests a tier. Keep its previous warmed carriage
// mounted until the replacement has completed the shared sliced upload plan.
export function createTramCar(T, scene, prepareModel) {
  const mesh = new T.Group();
  mesh.name = 'Mall tram';
  mesh.visible = false;
  scene.add(mesh);
  let current, anchor, request, tier, failed = false;
  async function select(next = 'balanced') {
    if (tier === next) return;
    tier = next;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    failed = false;
    let release;
    try {
      const {loadVisitorGLTF, disposeVisitorScene} = await import('./visitor-gltf.js');
      controller.signal.throwIfAborted();
      const url = new URL('./tram/' + next + '.glb', import.meta.url);
      const {scene: model} = await loadVisitorGLTF(url);
      release = () => { model.removeFromParent(); disposeVisitorScene(model); };
      controller.signal.throwIfAborted();
      const seat = model.getObjectByName('TramSeatAnchor');
      if (!seat) throw Error('Missing tram seat');
      await prepareModel?.(model, {late:false, fence:true, signal:controller.signal});
      controller.signal.throwIfAborted();
      current?.();
      mesh.add(model);
      anchor = seat;
      current = release;
      release = null;
    } catch {
      if (!controller.signal.aborted) { tier = null; failed = true; }
    } finally { release?.(); }
  }
  return {
    mesh, select, get anchor() { return anchor; },
    get reason() {
      if (anchor) return '';
      return failed ? 'Tram unavailable.' : 'Preparing the tram.';
    },
    place({x,z,heading}) { mesh.position.set(x,0,z); mesh.rotation.y = heading; },
    seatPose({x,z,heading}) {
      const offset = anchor.position, sin = Math.sin(heading), cos = Math.cos(heading);
      return {x:x + offset.x*cos + offset.z*sin, y:offset.y,
        z:z - offset.x*sin + offset.z*cos, heading:heading + anchor.rotation.y};
    },
    dispose() { request?.abort(); current?.(); mesh.removeFromParent(); }
  };
}
