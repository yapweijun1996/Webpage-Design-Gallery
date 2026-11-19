import {interiorAsset,interiorStores,interiorTiers,radians,worldInteriorBox} from './config.js';
import {buildInteriorDecoration,interiorMaterials} from './decoration.js';
import {createInteriorModelLoader,disposeInteriorModel} from './models.js';

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

  function measure(root, id) {
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
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
    });
  }

  function decoration(store, detail) {
    const base = buildInteriorDecoration(T,store,materials,detail);
    if (detail || store.id !== 'S01' || !packshot) return base;
    const photo = new T.MeshBasicMaterial({map:packshot,toneMapped:false});
    const panel = (width,x,y,z,yaw = 0) => {
      const mesh = new T.Mesh(new T.PlaneGeometry(width,width),photo);
      mesh.position.set(x,y,z);
      mesh.rotation.y = yaw;
      base.add(mesh);
    };
    // The original photograph shares the product and reading-stand texture.
    const [x,y,z] = store.anchor.position_m;
    panel(1.51,x,y+1.10,z+.006);
    const stand = store.props.find(prop => prop.kind === 'photo');
    const [sx,sy,sz] = stand.position_m, a = radians(stand.yaw_deg);
    panel(.69,sx+.053*Math.sin(a),sy+stand.envelope_whd_m[1]-.4,sz+.053*Math.cos(a),a);
    return base;
  }

  const shops = Object.values(interiorStores).map(store => {
    const group = new T.Group();
    group.name = `${store.id} ${store.style}`;
    group.position.set(...store.frame.world_origin_m);
    group.rotation.y = radians(store.frame.yaw_world_deg);
    for (const box of store.colliders) registerCollider(worldInteriorBox(store,box));
    group.visible = false;
    scene.add(group);
    return {store,group,distance:Infinity,near:false,phase:0,motion:null,models:new Map(),layers:[],ready:new Map(),shown:null};
  });

  function show(shop, roots) {
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
    const job = {tier,controller,started,waiting,remaining:waiting.length,retryAt:Infinity,deferActivation};
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
    const required = [asset,roomDetails[shop.store.id]];
    const freshModels = new Map(), freshLayers = [];
    try {
      try {
        for (const member of required) {
          if (shop.models.has(member.file)) continue;
          try {
            const model = await loadModel(member,signal);
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
      for (let i=shop.layers.length; i<=detail; i++) freshLayers.push(decoration(shop.store,i));
      const fresh = [...freshLayers,...freshModels.values()];
      for (const root of fresh) measure(root,shop.store.id);
      const models = required.map(member => freshModels.get(member.file) ?? shop.models.get(member.file)).filter(Boolean);
      const roots = [...shop.layers.slice(0,detail+1),...freshLayers,...models];
      await installer.prepare(roots, {tier,priority,signal,prepareModel});
      if (signal.aborted) return;
      for (const root of fresh) { root.visible = false; shop.group.add(root); }
      shop.layers.push(...freshLayers);
      for (const member of required) {
        const root = freshModels.get(member.file);
        if (!root) continue;
        shop.models.set(member.file,root);
        if (member.roomDetail) shop.motion = root.userData.roomMotion;
        report.modelsLoaded++;
        report.bytes += member.bytes;
      }
      freshModels.clear();
      freshLayers.length = 0;
      if (models.length === required.length) {
        shop.ready.set(tier,roots);
        report.preinstalled.shops++;
      }
      // On first install, including a loader timeout, publish each room only
      // after it has finished. A tier switch keeps the previous full set.
      if (!activeTier && tier === initialTier) {
        report.tier = tier;
        show(shop,roots);
      }
    } catch {
      // Keep the last usable kit and retry failed rooms on the same schedule.
    } finally {
      for (const root of freshModels.values()) disposeInteriorModel(root);
      for (const layer of freshLayers) layer.traverse(mesh => {
        mesh.geometry?.dispose();
        if (mesh.material?.map === packshot && packshot) mesh.material.dispose();
      });
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
    update(position) {
      const time = now(), delta = Math.min(.1,Math.max(0,(time-(lastUpdate ?? time))*.001));
      lastUpdate = time;
      for (let i=0; i<shops.length; i++) {
        const shop = shops[i], wasNear = shop.near;
        shop.distance = Math.hypot(position.x-shop.group.position.x,position.z-shop.group.position.z);
        shop.near = Math.abs(position.y) < 4 && shop.distance < 12.5;
        shop.group.visible = shop.shown !== null && shop.near;
        if (!shop.group.visible || !wasNear || !shop.motion || reducedMotion?.matches) continue;
        shop.phase += delta;
        if (shop.motion.scroll) shop.motion.scroll.offset.x = (shop.phase*.065)%1;
        if (shop.motion.pulse) shop.motion.pulse.emissiveIntensity = 1+.32*Math.sin(shop.phase*2.1);
      }
    },
    runFrame() {
      if (!request || disposed) return 0;
      if (now() >= request.retryAt) {
        request.waiting = shops.filter(shop => !shop.ready.has(request.tier));
        request.remaining = request.waiting.length;
        request.retryAt = Infinity;
      }
      const {waiting} = request;
      if (!decoding && waiting.length) {
        let nearest = 0;
        for (let i=1; i<waiting.length; i++) if (waiting[i].distance < waiting[nearest].distance) nearest = i;
        const [shop] = waiting.splice(nearest,1);
        decoding = true;
        void stage(shop,request);
      }
      return installer.runFrame();
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
        for (const model of shop.models.values()) disposeInteriorModel(model);
        for (const layer of shop.layers) layer.traverse(mesh => {
          mesh.geometry?.dispose();
          if (packshot && mesh.material?.map === packshot) mesh.material.dispose();
        });
        shop.group.removeFromParent();
      }
      materials.opaque.dispose();
      materials.glow.dispose();
      loadModel.dispose?.();
    }
  };
}
