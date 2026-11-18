import {interiorAsset,interiorStores,interiorTiers,radians,worldInteriorBox} from './config.js';
import {buildInteriorDecoration,interiorMaterials} from './decoration.js';
import {createInteriorModelLoader,disposeInteriorModel} from './models.js';
import {prepareInteriorKit} from './warmup.js';

export const emptyInteriorReport = tier => ({tier,shops:0,drawCalls:0,triangles:0,modelsLoaded:0,bytes:0});

export function createInteriorKit(T, scene, {
  assetBase, packshot, prepareModel, registerCollider,
  loadModel = createInteriorModelLoader(T,assetBase),
  schedule = run => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run,{timeout:500});
    else setTimeout(run,0);
  }
}) {
  const materials = interiorMaterials(T);
  const stores = Object.values(interiorStores);
  const cache = new Map(), failed = new Map();
  const lifecycle = new AbortController();
  const report = emptyInteriorReport('low'), renderedShops = new Set();
  let queued = false, loading = false, drawing = false;
  function measure(root, id) {
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      let calls, triangles;
      mesh.onBeforeRender = renderer => {
        if (!drawing) return;
        ({calls,triangles} = renderer.info.render);
      };
      mesh.onAfterRender = renderer => {
        if (!drawing) return;
        report.drawCalls += renderer.info.render.calls-calls;
        report.triangles += renderer.info.render.triangles-triangles;
        renderedShops.add(id);
      };
    });
  }
  const shops = stores.map(store => {
    const group = new T.Group();
    group.name = `${store.id} ${store.style}`;
    group.position.set(...store.frame.world_origin_m);
    group.rotation.y = radians(store.frame.yaw_world_deg);
    const base = buildInteriorDecoration(T,store,materials);
    if (store.id === 'S01' && packshot) {
      const photo = new T.MeshBasicMaterial({map:packshot,toneMapped:false});
      const panel = (width, x,y,z, yaw = 0) => {
        const mesh = new T.Mesh(new T.PlaneGeometry(width,width),photo);
        mesh.position.set(x,y,z);
        mesh.rotation.y = yaw;
        base.add(mesh);
      };
      // The larger original photograph stays inside the triptych recess and
      // shares the same texture as the reading stand and product detail.
      const [x,y,z] = store.anchor.position_m;
      panel(1.51,x,y+1.10,z+.006);
      const stand = store.props.find(prop => prop.kind === 'photo');
      const [sx,sy,sz] = stand.position_m, a = radians(stand.yaw_deg);
      panel(.69,sx+.053*Math.sin(a),sy+stand.envelope_whd_m[1]-.4,sz+.053*Math.cos(a),a);
    }
    measure(base,store.id);
    group.add(base);
    // Register ground solids immediately, before a visitor can walk into them.
    for (const box of store.colliders) registerCollider(worldInteriorBox(store,box));
    group.visible = false;
    scene.add(group);
    return {store,group,distance:Infinity,model:null,layers:[]};
  });

  function choose(shop) {
    const asset = interiorAsset(shop.store,report.tier);
    const model = cache.get(asset.file) ?? (report.tier === 'detailed' ? cache.get(shop.store.files.balanced.file) : undefined)
      ?? cache.get(shop.store.files.low.file);
    if (shop.model) shop.model.visible = false;
    if (model) model.visible = true;
    shop.model = model;
    shop.layers.forEach((layer,i) => { layer.visible = i < interiorTiers.indexOf(report.tier); });
  }

  function nextRequest() {
    const detail = interiorTiers.indexOf(report.tier);
    const now = Date.now();
    let next;
    for (const shop of shops) {
      if (!shop.group.visible || (next && shop.distance >= next.shop.distance)) continue;
      const asset = interiorAsset(shop.store,report.tier);
      if ((cache.has(asset.file) && shop.layers.length >= detail) || (failed.get(asset.file) ?? 0) > now) continue;
      next = {shop,asset};
    }
    return next;
  }

  function prefetch() {
    if (!prepareModel || queued || loading || !nextRequest() || lifecycle.signal.aborted) return;
    queued = true;
    schedule(async () => {
      queued = false;
      if (globalThis.document?.hidden || lifecycle.signal.aborted) return;
      const request = nextRequest();
      if (!request) return;
      const {shop,asset} = request;
      const detail = interiorTiers.indexOf(report.tier);
      loading = true;
      let model;
      const layers = [];
      try {
        if (!cache.has(asset.file)) {
          model = await loadModel(asset,lifecycle.signal);
          if (lifecycle.signal.aborted) { disposeInteriorModel(model); return; }
          model.name = `${shop.store.id} ${shop.store.anchor.asset_id} (${asset.tier})`;
          model.position.set(...shop.store.anchor.position_m);
          model.rotation.y = radians(shop.store.anchor.yaw_deg);
          model.visible = false;
        }
        for (let i=shop.layers.length; i<detail; i++) layers.push(buildInteriorDecoration(T,shop.store,materials,i+1));
        const roots = model ? [model,...layers] : layers;
        const kit = new T.Group();
        kit.add(...roots);
        const priority = () => shop.distance + (interiorAsset(shop.store,report.tier) === asset ? -24 : 40);
        await prepareInteriorKit(prepareModel,kit,priority,lifecycle.signal);
        for (const root of roots) measure(root,shop.store.id);
        shop.group.add(...roots);
        shop.layers.push(...layers);
        if (model) {
          cache.set(asset.file,model);
          report.modelsLoaded++;
          report.bytes += asset.bytes;
        }
        choose(shop);
      } catch {
        disposeInteriorModel(model);
        for (const layer of layers) layer.traverse(mesh => mesh.geometry?.dispose());
        // Leave the room in its prepared state while retrying transient failures.
        failed.set(asset.file,Date.now()+15000);
      } finally {
        loading = false;
        prefetch();
      }
    });
  }

  return {
    update(position,tier) {
      report.tier = interiorTiers.includes(tier) ? tier : 'low';
      for (const shop of shops) {
        shop.distance = Math.hypot(position.x-shop.group.position.x,position.z-shop.group.position.z);
        shop.group.visible = Math.abs(position.y) < 4 && shop.distance < 12.5;
        choose(shop);
      }
      prefetch();
    },
    beginFrame() {
      report.drawCalls = report.triangles = 0;
      renderedShops.clear();
      drawing = true;
    },
    endFrame() {
      drawing = false;
      report.shops = renderedShops.size;
    },
    report: () => ({...report}),
    dispose() { lifecycle.abort(); }
  };
}
