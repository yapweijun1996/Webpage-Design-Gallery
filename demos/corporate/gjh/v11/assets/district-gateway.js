import {expandedLayout} from './expanded-layout.js';

export const southDoor = Object.freeze({x:expandedLayout.entrance.x,z:expandedLayout.bounds.maxZ,halfWidth:2.16});
let laneImportAttempt=0;
async function loadKampungLane(T,signal) {
  // Browsers remember failed module requests for the lifetime of the document.
  const query=laneImportAttempt ? '?retry='+laneImportAttempt : '';
  let module;
  try {module=await import(`./kampung-lane.js${query}`);}
  catch(error) {laneImportAttempt++;throw error;}
  return module.loadKampungLane(T,signal);
}
const loadSingaporeStreet = (T,signal) => import('./street-chunk.js').then(module => module.loadSingaporeStreet(T,signal));

// The doorway remains solid until the destination has all of its proxies.
// A separate return distance prevents repeated allocations at the threshold.
export function createDistrictGateway({T,R,physics,scene,cameraObstacles,installSeat,setMallDetail,notice,tier = () => 'balanced',load = loadSingaporeStreet,loadLane = loadKampungLane}) {
  const {x:centre,z:threshold,halfWidth} = southDoor;
  const barrier = physics.createCollider(R.ColliderDesc.cuboid(halfWidth,2.7,.11).setTranslation(centre,2.68,threshold));
  const geometry = new T.BoxGeometry();
  const glass = new T.InstancedMesh(geometry,
    new T.MeshStandardMaterial({color:0xb1d6cb,transparent:true,opacity:.34,roughness:.25}),2);
  const rails = new T.InstancedMesh(geometry,
    new T.MeshStandardMaterial({color:0xc4a36e,roughness:.48,metalness:.32}),12);
  glass.name = 'South street sliding glass doors';
  rails.name = 'South street entrance rails';
  const matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3(), rotation = new T.Quaternion();
  function piece(mesh,index,x,y,z,w,h,d) {
    mesh.setMatrixAt(index,matrix.compose(position.set(x,y,z),rotation,scale.set(w,h,d)));
  }
  let opening = 0;
  function positionDoors() {
    let i = 0, j = 0;
    for (const side of [-1,1]) {
      const x = centre+side*(halfWidth/2+(halfWidth+.04)*opening);
      piece(glass,i++,x,2.66,threshold-.13,halfWidth,5.32,.07);
      for (const left of [-1,1]) piece(rails,j++,x+left*1.05,2.66,threshold-.14,.055,5.32,.085);
      for (const y of [.11,1.07,5.27]) piece(rails,j++,x,y,threshold-.16,2.12,.075,.095);
      piece(rails,j++,x-side*.80,1.27,threshold-.22,.045,.48,.09);
    }
    for (const mesh of [glass,rails]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  }
  positionDoors();
  scene.add(glass,rails);
  let chunk, controller, status = 'mall', interiorResident = true, cycles = 0, ended = false;
  let lane, laneRequest;
  function cancelVisit() {
    laneRequest?.abort();
    laneRequest=undefined;
  }
  async function visitLane(enter) {
    if(ended || lane || laneRequest) return false;
    const attempt=new AbortController();
    laneRequest=attempt;
    const timeout=setTimeout(()=>attempt.abort(),20000);
    let prepared;
    try {
      prepared=await loadLane(T,attempt.signal);
      if(attempt.signal.aborted || laneRequest!==attempt || ended) return false;
      prepared.mount(scene,R,physics,cameraObstacles);
      if(!enter(prepared.arrival)) return false;
      lane=prepared;prepared=undefined;
      retireStreet();
      mallDetail(false);
      return true;
    } catch { return false; }
    finally {
      prepared?.dispose();
      clearTimeout(timeout);
      if(laneRequest===attempt) laneRequest=undefined;
    }
  }
  function leaveLane(moveToMall) {
    cancelVisit();
    if(!lane || !moveToMall()) return false;
    lane.dispose();lane=undefined;
    mallDetail(true);
    return true;
  }
  let lastNotice = '';
  function message(value) {
    if (lastNotice === value) return;
    lastNotice = value;
    notice(value);
  }
  function closeDoors() {
    barrier.setEnabled(true);
    if (opening) { opening = 0; positionDoors(); }
  }
  function mallDetail(value) {
    if (value === interiorResident) return;
    interiorResident = value;
    setMallDetail(value);
  }
  function retireStreet() {
    closeDoors();
    controller?.abort();
    controller = undefined;
    chunk?.dispose(physics);
    chunk = undefined;
    status = 'mall';
    message('');
  }
  async function approach() {
    const attempt = new AbortController();
    controller = attempt;
    status = 'loading';
    message('Opening the Singapore street…');
    const timeout = setTimeout(() => attempt.abort(), 20000);
    try {
      const prepared = await load(T,attempt.signal);
      if (ended || attempt.signal.aborted || controller !== attempt) {
        prepared.dispose(physics);
        throw new DOMException('Street request cancelled','AbortError');
      }
      prepared.mount(scene,R,physics,cameraObstacles,installSeat);
      chunk = prepared;
      status = 'opening';
    } catch {
      if (controller === attempt && !ended) {
        status = 'unavailable';
        message('Street unavailable. Step back, then approach to retry.');
      }
    } finally {
      clearTimeout(timeout);
      if (controller === attempt) controller = undefined;
    }
  }
  return {
    visitLane, leaveLane, cancelVisit,
    get inKampung() { return Boolean(lane); },
    update({x,y,z,yaw}) {
      if (ended || lane) return;
      chunk?.update?.(x,z,tier());
      const outside = z-threshold, lateral = Math.abs(x-centre);
      if (outside < 4) mallDetail(true);
      if (outside < -6 || (outside < 0 && (y > 3 || lateral > 8))) {
        if (status !== 'mall') retireStreet();
        return;
      }
      const lookingOut = Number.isFinite(yaw) && Math.cos(yaw) < -.55;
      const near = lateral < 3.2 && outside < 1 && (outside > -1.95 || (lookingOut && outside > -4.5));
      if (status === 'unavailable' && !near) retireStreet();
      if (status === 'mall' && near) void approach();
      if (status === 'opening') {
        const instant = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        opening = instant ? 1 : Math.min(1,opening+.075);
        positionDoors();
        if (opening === 1) {
          barrier.setEnabled(false);
          status = 'ready';
          message('Street open. Walk through the south entrance.');
        }
      }
      if (chunk && outside > 1) {
        status = 'street';
        message(chunk.foodCourt?.notice || '');
      } else if (chunk && status === 'street' && outside < -.5) {
        status = 'ready';
        message('');
      }
      if (chunk && outside > 10 && interiorResident) {
        mallDetail(false);
        cycles++;
      }
    },
    foodCourtAt(x,z) { return chunk?.foodCourt?.contains(x,z) ?? false; },
    get state() {
      return {kampung:lane?.counts ?? null,foodCourt:chunk?.foodCourt?.state ?? {status:'distant'},status,interiorResident,cycles,models:chunk ? [...chunk.models] : [],street:chunk?.counts ?? {models:0,geometries:0,materials:0,colliders:0,cameraBounds:0,lodGroups:0,visibleLod:0}};
    },
    dispose() {
      if (ended) return;
      ended = true;
      cancelVisit();lane?.dispose();lane=undefined;
      retireStreet();
      physics.removeCollider(barrier,false);
      geometry.dispose();
      for (const mesh of [glass,rails]) { mesh.removeFromParent(); mesh.dispose(); mesh.material.dispose(); }
    }
  };
}
