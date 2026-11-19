import {disposeVisitorScene, loadVisitorGLTF} from './visitor-gltf.js';

// The model origin is the centre of the modular hand's cylindrical grip.
// Keep the reserved shelf prop and the baked fingers in this same frame.
export function createFirstPersonHand(T, visual, dress) {
  const root = new T.Group(), grip = new T.Group(), local = new T.Matrix4();
  root.name = 'FirstPersonCarryHand';
  root.matrixAutoUpdate = false;
  root.visible = false;
  root.add(grip);
  visual.add(root);
  let model, loading, disposed = false;

  function prepare() {
    if (!model && !loading && !disposed) {
      loading = loadVisitorGLTF(new URL('./visitor-carry-hand.glb', import.meta.url)).then(({scene}) => {
        if (disposed) { disposeVisitorScene(scene); return; }
        model = scene;
        dress?.(model);
        grip.add(model);
      }).catch(() => {}).finally(() => { loading = null; });
    }
  }

  function frame(camera) {
    if (!root.visible) return;
    // Frame in metres at the can centre. Keep room for the cuff on narrow screens
    // and compensate for zoom without changing the product's scale.
    const halfHeight = Math.max(.30, .215 / camera.aspect);
    const depth = halfHeight / Math.tan(camera.fov * Math.PI / 360);
    const portrait = camera.aspect < 1;
    const x = halfHeight * camera.aspect * (portrait ? .38 : .49);
    local.makeRotationY(-Math.atan2(x, depth)).setPosition(x, -(portrait ? .36 : .42) * halfHeight, -depth);
    camera.updateWorldMatrix(true, false);
    visual.updateWorldMatrix(true, false);
    root.matrix.copy(visual.matrixWorld).invert().multiply(camera.matrixWorld).multiply(local);
    root.matrixWorldNeedsUpdate = true;
  }

  return {
    grip, frame, prepare,
    show(visible) {
      root.visible = visible;
      grip.position.y = 0;
      if (visible) prepare();
    },
    refreshStyle() { if (model) dress?.(model); },
    dispose() {
      disposed = true;
      root.removeFromParent();
      if (model) disposeVisitorScene(model);
    }
  };
}
