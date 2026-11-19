import {interiorAsset,interiorStores,interiorTiers,radians,worldInteriorBox} from './config.js';
import {prepareInteriorDecoration,interiorMaterials} from './decoration.js';
import {createInteriorModelLoader,disposeInteriorModel} from './models.js';
import {mergeStaticGeometries} from '../merge-static-geometries.js';

import {roomDetails} from './detail-files.js';
import {emptyInteriorReport} from './warmup.js';

export function createInteriorKit(T, scene, {
  assetBase, packshot, prepareModel, registerCollider,
  loadModel = createInteriorModelLoader(T,assetBase),
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
  now = () => performance.now()
}) {
  const materials = interiorMaterials(T);
  const report = emptyInteriorReport('low'), renderedShops = new Set();
  let installer, request, initialTier, activeTier, decoding = false, drawing = false, disposed = false;

  let lastUpdate;

  function* measure(root, id) {
    const meshes = [];
    root.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
    for (const mesh of meshes) {
      if (mesh.isInstancedMesh) mesh.computeBoundingSphere();
      else mesh.geometry.computeBoundingSphere();
      let calls, triangles;
      mesh.onBeforeRender = renderer => {
        if (drawing) ({calls,triangles} = renderer.info.render);
      };
      mesh.onAfterRender = renderer => {
        if (!drawing) return;
        report.drawCalls += renderer.info.render.calls-calls;
        report.triangles += renderer.info.render.triangles-triangles;
        renderedShops.add(id);
      };
      yield;
    }
  }

  function* decoration(store, detail) {
    const base = yield* prepareInteriorDecoration(T,store,materials,0);
    const batches = new Map(base.children.map(mesh => [mesh.material,[mesh.geometry]]));
    for (let level=1; level<=detail; level++) {
      const extra = yield* prepareInteriorDecoration(T,store,materials,level);
      for (const mesh of extra.children) {
        if (!batches.has(mesh.material)) batches.set(mesh.material,[]);
        batches.get(mesh.material).push(mesh.geometry);
      }
    }
    base.clear();
    for (const [material,parts] of batches) {
      const geometry = parts.length === 1 ? parts[0] : mergeStaticGeometries(T,parts);
      if (parts.length > 1) parts.forEach(part => part.dispose());
      base.add(new T.Mesh(geometry,material));
      yield;
    }
    if (store.id !== 'S01' || !packshot) return base;
    const photo = new T.MeshBasicMaterial({map:packshot,toneMapped:false});
    const panel = (width,x,y,z,yaw = 0) =>
      new T.PlaneGeometry(width,width).rotateY(yaw).translate(x,y,z);
    // The original photograph shares the product and reading-stand texture.
    const [x,y,z] = store.anchor.position_m;
    const stand = store.props.find(prop => prop.kind === 'photo');
    const [sx,sy,sz] = stand.position_m, a = radians(stand.yaw_deg);
    const photos = [panel(1.51,x,y+1.10,z+.006),
      panel(.69,sx+.053*Math.sin(a),sy+stand.envelope_whd_m[1]-.4,sz+.053*Math.cos(a),a)];
    base.add(new T.Mesh(mergeStaticGeometries(T,photos),photo));
    photos.forEach(geometry => geometry.dispose());
    return base;
  }

  const shops = Object.values(interiorStores).map(store => {
    const group = new T.Group();
    group.name = `${store.id} ${store.style}`;
    group.position.set(...store.frame.world_origin_m);
    group.rotation.y = radians(store.frame.yaw_world_deg);
    group.visible = false;
    scene.add(group);
    return {store,group,distance:Infinity,near:false,phase:0,motion:null,models:new Map(),layers:[],ready:new Map(),shown:null,removeColliders:null};
  });

  function installColliders(shop) {
    if (shop.removeColliders) return;
    const removals = [];
    try {
      for (const box of shop.store.colliders) {
        const remove = registerCollider(worldInteriorBox(shop.store,box));
        if (typeof remove === 'function') removals.push(remove);
      }
      shop.removeColliders = removals;
    } catch (error) {
      for (const remove of removals) remove();
      throw error;
    }
  }

  function removeColliders(shop) {
    for (const remove of shop.removeColliders ?? []) remove();
    shop.removeColliders = null;
  }

  function show(shop, roots) {
    installColliders(shop);
    for (const root of shop.shown ?? []) root.visible = false;
    for (const root of roots) root.visible = true;
    shop.shown = roots;
    shop.group.visible = shop.near;
  }

  function activateTier(tier) {
    if (request?.tier !== tier || report.preinstalled.shops !== shops.length) return false;
    for (const shop of shops) show(shop,shop.ready.get(tier));
    activeTier = report.tier = tier;
    return true;
  }

  function finish(job) {
    if (job.remaining) return;
    if (report.preinstalled.shops < shops.length) {
      job.retryAt = now()+15000;
      return;
    }
    if (!job.deferActivation) activateTier(job.tier);
    job.resolve({...report.preinstalled});
  }

  function start(tier, deferActivation = false) {
    initialTier ??= tier;
    if (request) {
      request.controller.abort();
      request.resolve({...report.preinstalled});
    }
    const controller = new AbortController(), started = now();
    const waiting = shops.filter(shop => !shop.ready.has(tier));
    report.preinstalled = {shops:shops.length-waiting.length,ms:0};
    const job = {tier,controller,started,waiting,remaining:waiting.length,inflight:0,retryAt:Infinity,deferActivation};
    job.done = new Promise(resolve => { job.resolve = resolve; });
    request = job;
    finish(job);
    return job;
  }

  function awaitLatest(job) {
    return job.done.then(result => request && request !== job ? awaitLatest(request) : result);
  }

  async function stage(shop, job) {
    const {tier,controller:{signal}} = job;
    const asset = interiorAsset(shop.store,tier), detail = interiorTiers.indexOf(tier);
    const priority = () => shop.distance-200;
    const build = work => installer.build(work, {priority,signal});
    const required = [asset,roomDetails[shop.store.id]];
    const freshModels = new Map();
    let freshDecoration;
    try {
      try {
        for (const member of required) {
          if (shop.models.has(member.file)) continue;
          try {
            const model = await loadModel(member,signal,build);
            freshModels.set(member.file,model);
            model.name = `${shop.store.id} ${member.file}`;
            if (!member.roomDetail) {
              model.position.set(...shop.store.anchor.position_m);
              model.rotation.y = radians(shop.store.anchor.yaw_deg);
            }
          } catch {
            // Keep successful members and retry only the missing asset.
          }
          if (signal.aborted) return;
        }
      } finally {
        decoding = false;
      }
      await build(function* () {
        if (!shop.layers[detail]) {
          freshDecoration = yield* decoration(shop.store,detail);
          yield* measure(freshDecoration,shop.store.id);
        }
        for (const model of freshModels.values()) yield* measure(model,shop.store.id);
      });
      if (signal.aborted) return;
      const fresh = [freshDecoration,...freshModels.values()].filter(Boolean);
      const models = required.map(member => freshModels.get(member.file) ?? shop.models.get(member.file)).filter(Boolean);
      const roots = [shop.layers[detail] ?? freshDecoration,...models];
      await installer.prepare(roots, {tier,priority,signal,prepareModel});
      if (signal.aborted) return;
      for (const root of fresh) { root.visible = false; shop.group.add(root); }
      shop.group.updateMatrixWorld(true);
      for (const root of fresh) root.userData.roomBounds = new T.Box3().setFromObject(root);
      if (freshDecoration) shop.layers[detail] = freshDecoration;
      for (const member of required) {
        const root = freshModels.get(member.file);
        if (!root) continue;
        shop.models.set(member.file,root);
        if (member.roomDetail) shop.motion = root.userData.roomMotion;
        report.modelsLoaded++;
        report.bytes += member.bytes;
      }
      freshModels.clear();
      freshDecoration = undefined;
      if (models.length === required.length) {
        // An early entrant sees only complete rooms and their matching proxies.
        if (!activeTier && tier === initialTier) {
          show(shop,roots);
          report.tier = tier;
        }
        shop.ready.set(tier,roots);
        report.preinstalled.shops++;
      }
    } catch {
      // Keep the last usable kit and retry failed rooms on the same schedule.
    } finally {
      for (const root of freshModels.values()) disposeInteriorModel(root);
      freshDecoration?.traverse(mesh => {
        mesh.geometry?.dispose();
        if (mesh.material?.map === packshot && packshot) mesh.material.dispose();
      });
      job.inflight--;
      if (!signal.aborted) {
        job.remaining--;
        report.preinstalled.ms = Math.round(now()-job.started);
        finish(job);
      }
    }
  }

  return {
    prepare(tier, createInstaller, {deferActivation = false} = {}) {
      installer ??= createInstaller();
      const job = request?.tier === tier ? request : start(tier,deferActivation);
      return deferActivation ? job.done : awaitLatest(job);
    },
    activateTier,
    groups: shops.map(shop => shop.group),
    setTier(tier) {
      const target = interiorTiers.includes(tier) ? tier : 'low';
      if (installer && !disposed && request?.tier !== target) start(target);
    },
    update(position, view) {
      const time = now(), delta = Math.min(.1,Math.max(0,(time-(lastUpdate ?? time))*.001));
      lastUpdate = time;
      for (let i=0; i<shops.length; i++) {
        const shop = shops[i], wasNear = shop.near;
        shop.distance = Math.hypot(position.x-shop.group.position.x,position.z-shop.group.position.z);
        shop.near = Math.abs(position.y) < 4 && shop.distance < 12.5;
        shop.group.visible = shop.shown !== null && shop.near;
        if (shop.group.visible) for (const root of shop.shown) {
          const bounds = root.userData.roomBounds;
          root.visible = !view?.shopVisibility || bounds.isEmpty() || !view.shopVisibility.occluded(i+1,bounds);
        }
        if (!shop.group.visible || !wasNear || !shop.motion || reducedMotion?.matches) continue;
        shop.phase += delta;
        if (shop.motion.scroll) shop.motion.scroll.offset.x = (shop.phase*.065)%1;
        if (shop.motion.pulse) shop.motion.pulse.emissiveIntensity = 1+.32*Math.sin(shop.phase*2.1);
      }
    },
    runFrame(remaining = 2) {
      if (!request || disposed || remaining <= 0) return 0;
      if (now() >= request.retryAt) {
        request.waiting = shops.filter(shop => !shop.ready.has(request.tier));
        request.remaining = request.waiting.length;
        request.retryAt = Infinity;
      }
      const {waiting} = request;
      if (!decoding && waiting.length && request.inflight < 2) {
        let nearest = 0;
        for (let i=1; i<waiting.length; i++) if (waiting[i].distance < waiting[nearest].distance) nearest = i;
        const [shop] = waiting.splice(nearest,1);
        decoding = true;
        request.inflight++;
        void stage(shop,request);
      }
      return installer.runFrame(remaining);
    },
    get activeTier() { return activeTier; },
    beginFrame() {
      report.drawCalls = report.triangles = 0;
      renderedShops.clear();
      drawing = true;
    },
    endFrame() {
      drawing = false;
      report.shops = renderedShops.size;
    },
    report: () => ({...report,preinstalled:{...report.preinstalled}}),
    invalidate() {
      request?.controller.abort();
      request?.resolve({...report.preinstalled});
      request = initialTier = activeTier = undefined;
      report.preinstalled = {shops:0,ms:0};
      for (const shop of shops) {
        removeColliders(shop);
        shop.ready.clear();
        for (const root of shop.shown ?? []) root.visible = false;
        shop.shown = null;
        shop.group.visible = false;
      }
    },
    dispose() {
      disposed = true;
      request?.controller.abort();
      request?.resolve({...report.preinstalled});
      installer?.dispose();
      for (const shop of shops) {
        removeColliders(shop);
        for (const model of shop.models.values()) disposeInteriorModel(model);
        shop.layers.forEach(layer => layer.traverse(mesh => {
          mesh.geometry?.dispose();
          if (packshot && mesh.material?.map === packshot) mesh.material.dispose();
        }));
        shop.group.removeFromParent();
      }
      materials.opaque.dispose();
      materials.glow.dispose();
      loadModel.dispose?.();
    }
  };
}
