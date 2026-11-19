// All boxes use the same local +Z front and Three.js Y rotation as the showroom.
function corners(box) {
  const angle = (box.yawDeg ?? 0)*Math.PI/180;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j]) => {
    const x = i*box.size[0]/2, z = j*box.size[2]/2;
    return [box.xyz[0]+x*c+z*s,box.xyz[2]-x*s+z*c];
  });
}

export function footprintGap(first, second) {
  const a = corners(first), b = corners(second);
  let separated = false, nearest = Infinity;
  for (const [p,q] of [[a,b],[b,a]]) {
    for (const [i,start] of p.entries()) {
      const end = p[(i+1)%4], dx = end[0]-start[0], dz = end[1]-start[1];
      const length2 = dx*dx+dz*dz;
      if (q.every(([x,z]) => dx*(z-start[1])-dz*(x-start[0])<0)) separated = true;
      for (const [x,z] of q) {
        const t = Math.max(0,Math.min(1,((x-start[0])*dx+(z-start[1])*dz)/length2));
        nearest = Math.min(nearest,Math.hypot(x-start[0]-t*dx,z-start[1]-t*dz));
      }
    }
  }
  return separated ? nearest : 0;
}

// Slab intersection in the box frame, with t in [0,1] along the sightline.
function firstHit(start,end,box) {
  const a = (box.yawDeg ?? 0)*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
  function local([x,y,z]) {
    const dx = x-box.xyz[0], dz = z-box.xyz[2];
    return [dx*c-dz*s,y-box.xyz[1]-box.size[1]/2,dx*s+dz*c];
  }
  const from = local(start), to = local(end);
  let entry = 0, exit = 1;
  for (let i=0;i<3;i++) {
    const half = box.size[i]/2, delta = to[i]-from[i];
    if (Math.abs(delta)<1e-9) {
      if (Math.abs(from[i])>half) return Infinity;
    } else {
      const n = (-half-from[i])/delta, f = (half-from[i])/delta;
      entry = Math.max(entry,Math.min(n,f));
      exit = Math.min(exit,Math.max(n,f));
    }
  }
  return entry<=exit ? entry : Infinity;
}

function backedByWall(item, physical) {
  const a = item.yawDeg*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
  const [x,y,z] = item.xyz, [w,h,d] = item.size;
  // Both ends of the back edge must meet a wall or its continuous built-in lining.
  return [-.499,.499].every(side => {
    const edge = [x+side*w*c-d*s/2,y+h/2,z-side*w*s-d*c/2];
    const end = [edge[0]-.020001*s,edge[1],edge[2]-.020001*c];
    const inside = [edge[0]+.001*s,edge[1],edge[2]+.001*c];
    return physical.some(box => box.size[1]>=1.8 && !Number.isFinite(firstHit(inside,inside,box)) &&
      Number.isFinite(firstHit(edge,end,box)));
  });
}

function entranceVisible(shop, focal, physical) {
  const [x,z] = shop.frame.threshold_local_xz_m;
  const start = [x,shop.frame.floor_surface_y_m+1.6,z];
  const [width,height] = shop.capture.viewport_css_px;
  const verticalSlope = Math.tan(58*Math.PI/360);
  const a = focal.yawDeg*Math.PI/180;
  // Sample the upper silhouette across its width. The GOGO cart is off-axis.
  for (const fraction of [0,-.25,.25,-.49,.49]) {
    const offset = focal.size[0]*fraction;
    const end = [focal.xyz[0]+offset*Math.cos(a),focal.xyz[1]+.75*focal.size[1],
      focal.xyz[2]-offset*Math.sin(a)];
    const depth = z-end[2];
    if (depth<=0 || Math.abs(end[0]-x)>depth*verticalSlope*width/height ||
        Math.abs(end[1]-start[1])>depth*verticalSlope) continue;
    const limit = firstHit(start,end,focal);
    if (!physical.some(box=>box!==focal && firstHit(start,end,box)<limit-1e-6)) return true;
  }
  return false;
}

function furnishingIssues(shop, item, fixed, focal) {
  const issues = [], {socket,xyz:[x,,z],yawDeg} = item;
  const kind = shop.props.find(prop=>prop.socket===socket)?.kind;
  const wallRun = ['rack','counter','cabinet','case'].includes(kind);
  const flush = wallRun && backedByWall(item,fixed);
  if (wallRun && !flush) issues.push('back more than 0.02 m from wall finish');
  const onGrid = value => Math.abs(value*20-Math.round(value*20))<1e-7;
  // Exact wall contact can set the normal coordinate between two grid lines.
  const freeX = flush && Math.abs(yawDeg%180)===90;
  const freeZ = flush && yawDeg%180===0;
  if (!item.placementNote && ((!onGrid(x) && !freeX) || (!onGrid(z) && !freeZ) || yawDeg%15))
    issues.push('off 0.05 m placement grid or 15 degree yaw');
  const nativeSeat = socket==='seats' || socket==='stools3';
  if (nativeSeat || ['chair','sofa','ottoman'].includes(kind) || item.modelId==='lounge-sofa-bench') {
    const bearing = Math.atan2(focal.xyz[0]-x,focal.xyz[2]-z);
    const facing = (yawDeg+(nativeSeat ? 180 : 0))*Math.PI/180;
    if (Math.cos(bearing-facing)<Math.cos(7.51*Math.PI/180)) issues.push('seat faces away from focal');
  }
  if (kind==='plant' || ['plant2','fern3'].includes(socket)) {
    const [w,d] = shop.frame.lot_width_depth_m;
    const back = d/2-shop.frame.actual_room_depth_m;
    // Measure from the plant envelope to the nearest side and end of the bay.
    const sideGap = w/2-Math.abs(x)-item.size[0]/2;
    const endGap = Math.min(d/2-z,z-back)-item.size[2]/2;
    if (Math.max(sideGap,endGap)>1.5) issues.push('plant outside corner');
  }
  return issues;
}

export function placementIssues(shop, floor, fixed) {
  const issues = [], focal = shop.items.find(i=>i.id===shop.focal);
  if (!entranceVisible(shop,focal,[...shop.items,...fixed.filter(box=>!box.replacedDisplay)])) issues.push([focal.id,'entrance sightline blocked']);
  if (shop.floor.position_m[0] || shop.floor.yaw_deg%180) issues.push([shop.slot,'floor off axis']);
  const large = item => Math.max(...item.size)>=.8;
  for (const [index,item] of shop.items.entries()) {
    for (const message of furnishingIssues(shop,item,fixed,focal)) issues.push([item.id,message]);
    if (floor.clearance(item.standing)<.75-1e-8) issues.push([item.id,'turning circle < 1.5 m']);
    if (!large(item)) continue;
    if (item.collision==='kit') {
      for (const box of fixed) {
        // A replacement display retains the previous physical island's collider.
        // Long wall linings and the back of a fitted cabinet may meet by design.
        if (box.replacedDisplay || !large(box) || Math.max(box.size[0],box.size[2])>4 ||
            backedByWall(item,[box])) continue;
        if (Math.min(item.xyz[1]+item.size[1],box.xyz[1]+box.size[1])<=Math.max(item.xyz[1],box.xyz[1])) continue;
        if (footprintGap(item,box)<.15-1e-8)
          issues.push([item.id,'footprint gap < 0.15 m to studio fixture at '+box.xyz.filter((_,k)=>k!==1).map(v=>v.toFixed(2))]);
      }
    }
    for (const other of shop.items.slice(index+1)) {
      if (!large(other) || Math.min(item.xyz[1]+item.size[1],other.xyz[1]+other.size[1])<=
          Math.max(item.xyz[1],other.xyz[1])+.001) continue;
      if (footprintGap(item,other)<.15-1e-8) issues.push([item.id,'footprint gap < 0.15 m to '+other.id]);
    }
  }
  return issues;
}
