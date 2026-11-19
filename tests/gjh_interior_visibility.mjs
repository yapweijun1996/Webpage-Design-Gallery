function observeWorld(world) {
  let renderer, camera;
  const original = world.scene.onBeforeRender;
  world.scene.onBeforeRender = function (activeRenderer, scene, activeCamera, ...args) {
    if (activeCamera.layers.isEnabled(0)) {
      renderer = activeRenderer;
      camera = activeCamera;
    }
    original.call(this, activeRenderer, scene, activeCamera, ...args);
  };
  try {
    __mall.setInput({});
    __mall.step(0);
  } finally {
    world.scene.onBeforeRender = original;
  }
  if (!renderer || !camera) throw new Error('Mall did not render a world frame');
  return {renderer, camera};
}

const moduleFromMall = path => window.testModule ? window.testModule(path) : import(new URL(path, location.href));
const mainPass = (scene, camera) => scene === window.__visibilityWorld.scene && camera.layers.isEnabled(0);
const hasColor = node => (Array.isArray(node.material) ? node.material : [node.material]).some(material => material.colorWrite);
const visible = node => {
  for (let current = node; current; current = current.parent) if (!current.visible) return false;
  return true;
};

export async function checkNewMoonEarlyEntry(captureScreenshots = false) {
  const T = await moduleFromMall('vendor/three.module.min.js');
  const world = window.__visibilityWorld;
  if (!__mall.teleport('newmoon')) throw new Error('New Moon teleport failed');
  const {camera} = observeWorld(world);
  const shelves = window.__visibilityProducts.filter(mesh =>
    mesh.isInstancedMesh && mesh.instanceMatrix.count === world.productAssets.shelf.instances && hasColor(mesh));
  if (world.productAssets.shelf.status !== 'loaded' || shelves.length !== 5) {
    throw new Error('Expected five loaded New Moon cabinet material batches');
  }
  const drawn = new Set();
  const originals = shelves.map(mesh => mesh.onAfterRender);
  for (const [index, mesh] of shelves.entries()) {
    mesh.onAfterRender = function (renderer, scene, activeCamera, ...args) {
      if (mainPass(scene, activeCamera)) drawn.add(this);
      originals[index].call(this, renderer, scene, activeCamera, ...args);
    };
  }
  const poses = [];
  const capture = (name, yaw, pitch = 0) => {
    drawn.clear();
    __mall.setInput({yaw, pitch});
    const state = __mall.step(300);
    const frustum = new T.Frustum().setFromProjectionMatrix(
      new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const misses = [];
    let expected = 0;
    for (const mesh of shelves) {
      if (!frustum.intersectsObject(mesh)) continue;
      expected++;
      if (visible(mesh) && mesh.layers.test(camera.layers) && drawn.has(mesh)) continue;
      misses.push({material:mesh.material.name, visible:visible(mesh), layer:mesh.layers.mask,
        count:mesh.count, radius:mesh.boundingSphere.radius});
    }
    const pose = {name, position:[state.x,state.y,state.z], camera:state.camera.position,
      callCount:state.drawCalls, expected, drawn:drawn.size, misses};
    if (captureScreenshots) pose.screenshot = document.getElementById('scene').toDataURL();
    poses.push(pose);
  };
  try {
    capture('entrance', 0);
    __mall.setInput({yaw:0, forward:1});
    __mall.step(4400);
    capture('back-wall', 0);
    capture('back-wall-oblique', .43, .08);
  } finally {
    shelves.forEach((mesh, index) => { mesh.onAfterRender = originals[index]; });
    __mall.setInput(null);
  }
  return {tier:__mall.state.graphics.quality.tier, warm:__mall.performanceReport().warm, poses};
}

export async function sweepInteriorVisibility() {
  const T = await moduleFromMall('vendor/three.module.min.js');
  const {expandedLayout} = await moduleFromMall('assets/expanded-layout.js');
  const world = window.__visibilityWorld;
  const {renderer, camera: liveCamera} = observeWorld(world);
  const camera = liveCamera.clone(), viewProjection = new T.Matrix4(), frustum = new T.Frustum();
  const matrix = new T.Matrix4(), instance = new T.Sphere();
  const visitor = new T.Vector3(), stores = [], misses = [], badBounds = [];
  const geometryBounds = new Map(), point = new T.Vector3();
  const originalPose = __mall.state;
  const scissor = renderer.getScissor(new T.Vector4()), scissorTest = renderer.getScissorTest();

  // Build the expected volume from each instance, independently of the
  // aggregate sphere Three uses to accept or reject the entire batch.
  function volumes(mesh) {
    const geometry = mesh.geometry;
    if (!geometryBounds.has(geometry)) {
      const positions = geometry.attributes.position;
      const center = new T.Box3().setFromBufferAttribute(positions).getCenter(new T.Vector3());
      let radiusSquared = 0;
      for (let i=0; i<positions.count; i++) {
        radiusSquared = Math.max(radiusSquared, center.distanceToSquared(point.fromBufferAttribute(positions,i)));
      }
      geometryBounds.set(geometry,new T.Sphere(center,Math.sqrt(radiusSquared)));
    }
    const sphere = geometryBounds.get(geometry);
    if (!mesh.isInstancedMesh) return [sphere.clone().applyMatrix4(mesh.matrixWorld)];
    const current = [];
    for (let i=0; i<mesh.count; i++) {
      mesh.getMatrixAt(i,matrix);
      instance.copy(sphere).applyMatrix4(matrix);
      current.push(instance.clone());
    }
    return current;
  }

  // Exercise the real render list and draw calls at the same projection with
  // only one pixel of raster work per pose.
  renderer.setScissor(0,0,1,1);
  renderer.setScissorTest(true);
  try {
    for (const [index, slot] of expandedLayout.slots.entries()) {
      const id = 'S' + slot.number, room = world.interiors.groups[index];
      if (!room || !room.children.some(child => child.name.endsWith('-details.glb'))) {
        throw new Error('Room detail GLB is missing for ' + id);
      }
      const meshes = new Set(), drawn = new Set(), restore = [];
      const add = mesh => { if (mesh.isMesh && hasColor(mesh)) meshes.add(mesh); };
      room.traverse(add);
      world.scene.traverse(mesh => { if (mesh.userData.shopSlot === index+1) add(mesh); });
      if (!index) window.__visibilityProducts.forEach(add);
      const gallery = world.scene.getObjectByName(id + ' interior');
      if (index>=3 && !gallery) throw new Error('Gallery room is missing for ' + id);
      if (gallery) {
        const hero = world.scene.getObjectByName(id + ' hero display');
        const loadedDisplay = hero.children.length > 2 && hero.userData.modelReady;
        gallery.traverse(mesh => { if (!loadedDisplay || mesh.name !== id+' display fallback') add(mesh); });
      }
      if (!meshes.size) throw new Error('Empty mesh inventory for ' + id);
      for (const mesh of meshes) {
        const original = mesh.onAfterRender;
        mesh.onAfterRender = function (r, scene, activeCamera, ...args) {
          if (mainPass(scene, activeCamera) && (!this.isInstancedMesh || this.count>0)) drawn.add(this);
          original.call(this,r,scene,activeCamera,...args);
        };
        restore.push(() => { mesh.onAfterRender = original; });
      }
      const width = slot.side === 'north' ? slot.maxX-slot.minX : slot.maxZ-slot.minZ;
      const depth = slot.side === 'north' ? slot.maxZ-slot.minZ : slot.maxX-slot.minX;
      const positions = [-.23,0,.23].flatMap(x => [-.20,.22].map(z => [x*width,z*depth]));
      const report = {id, meshes:meshes.size, poses:0, expected:0, drawn:0, maxCalls:0, misses:0};
      try {
        for (const [x,z] of positions) {
          visitor.set(x,0,z).applyMatrix4(room.matrixWorld);
          world.updateShopLods(visitor,false,'balanced');
          world.scene.updateMatrixWorld(true);
          const expectedVolumes = [...meshes].map(mesh => {
            const spheres = volumes(mesh);
            if (mesh.isInstancedMesh) {
              if (mesh.count !== mesh.instanceMatrix.count) {
                misses.push({id,mesh:mesh.name || mesh.material.name,position:[x,z],
                  instanceCount:mesh.count,expectedInstances:mesh.instanceMatrix.count});
                report.misses++;
              }
              // Three permits lazy initialization for an as-yet unsubmitted batch.
              if (!mesh.boundingSphere) mesh.computeBoundingSphere();
              const bounds = mesh.boundingSphere;
              if (spheres.some(sphere => bounds.center.distanceTo(sphere.center)+sphere.radius > bounds.radius+1e-6)) {
                badBounds.push({id,mesh:mesh.name || mesh.material.name, position:[x,z]});
              }
              for (const sphere of spheres) sphere.applyMatrix4(mesh.matrixWorld);
            }
            return {mesh,spheres};
          });
          for (let quarter=0; quarter<4; quarter++) {
            camera.position.copy(visitor).setY(1.65);
            camera.rotation.set(-.12,room.rotation.y+quarter*Math.PI/2,0,'YXZ');
            camera.updateMatrixWorld();
            frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
            drawn.clear();
            renderer.render(world.scene,camera);
            report.poses++;
            report.maxCalls = Math.max(report.maxCalls,renderer.info.render.calls);
            for (const {mesh,spheres} of expectedVolumes) {
              if (!spheres.some(sphere => frustum.intersectsSphere(sphere))) continue;
              report.expected++;
              const inFrustum = !mesh.frustumCulled || frustum.intersectsObject(mesh);
              if (inFrustum && visible(mesh) && mesh.layers.test(camera.layers) && drawn.has(mesh)) {
                report.drawn++;
                continue;
              }
              report.misses++;
              misses.push({id,position:[x,z],quarter,mesh:mesh.name || mesh.material.name,
                inFrustum,visible:visible(mesh),layers:mesh.layers.mask,drawn:drawn.has(mesh)});
            }
          }
        }
      } finally {
        restore.forEach(callback => callback());
      }
      if (!report.expected) throw new Error('No in-frustum meshes sampled for ' + id);
      stores.push(report);
    }
  } finally {
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    world.updateShopLods(originalPose,false,'balanced');
    __mall.setInput(null);
  }
  return {stores,misses,badBounds};
}
