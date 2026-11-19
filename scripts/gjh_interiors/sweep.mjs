// Store-local metres. The grid is used offline only.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as T from '../../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {expandedLayout} from '../../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {createExpandedInteriors} from '../../demos/corporate/gjh/v11/assets/expanded-interiors.js';

export const programme = new URL('../../docs/gjh-v11-interior-program.json', import.meta.url);
const grid = .1;
export const capsule = .28;

export function distance([x,z], {xyz, size, yawDeg = 0}) {
  const a = yawDeg*Math.PI/180, dx = x-xyz[0], dz = z-xyz[2];
  return Math.hypot(Math.max(0,Math.abs(dx*Math.cos(a)-dz*Math.sin(a))-size[0]/2),
    Math.max(0,Math.abs(dx*Math.sin(a)+dz*Math.cos(a))-size[2]/2));
}

function insideZone([x,z], polygon) {
  let inside=false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [ax,az]=polygon[j], [bx,bz]=polygon[i];
    const cross=(x-ax)*(bz-az)-(z-az)*(bx-ax);
    if (Math.abs(cross)<1e-8 && (x-ax)*(x-bx)<=0 && (z-az)*(z-bz)<=0) return true;
    if ((az>z)!==(bz>z) && x<ax+(bx-ax)*(z-az)/(bz-az)) inside=!inside;
  }
  return inside;
}

export async function studioBoxes() {
  globalThis.window = {requestIdleCallback() {}};
  globalThis.document = {addEventListener() {}};
  try {
    return (await createExpandedInteriors(T,expandedLayout,new T.Scene())).collisionBoxes;
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
}

export function obstacles(shop, studio = []) {
  const {world_origin_m:[ox,,oz],yaw_world_deg:yaw} = shop.frame;
  const a = yaw*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
  const [w,d] = shop.frame.lot_width_depth_m;
  const boxes = studio.map(b => {
    const dx = b.x-ox, dz = b.z-oz;
    return {xyz:[dx*c-dz*s,b.y-b.height/2,dx*s+dz*c], size:[b.width,b.height,b.depth],yawDeg:-yaw};
  }).filter(b => Math.abs(b.xyz[0])<w/2 && Math.abs(b.xyz[2])<=d/2);
  for (const item of shop.items) {
    if (item.collision !== 'none') boxes.push(item);
  }
  return [...boxes,...(shop.retainedObstacles ?? [])].filter(b => b.xyz[1]<1.75 && b.xyz[1]+b.size[1]>.1);
}

export function floorGrid(shop, boxes) {
  const [width,d] = shop.frame.lot_width_depth_m, front = d/2, back = front-shop.frame.actual_room_depth_m;
  const door = shop.frame.door_width_m/2;
  function clearance(p) {
    const [x,z] = p;
    const jamb = Math.hypot(Math.max(0,door-Math.abs(x)),Math.max(0,front-z));
    return Math.min(width/2-Math.abs(x),z-back,jamb,...boxes.map(b=>distance(p,b)));
  }
  // Sample between grid nodes as well as at each standing position.
  function edge(from,to,r) {
    const n = Math.max(1, Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/.05));
    for (let i=0;i<=n;i++) {
      const f=i/n;
      if (clearance(from.map((v,k)=>v+f*(to[k]-v)))+1e-8 < r) return false;
    }
    return true;
  }
  function flood(radius) {
    const start = [0,Math.round(front/grid)], queue = [start], visited = new Map();
    const queued = new Set([start.join(',')]);
    for (let head=0;head<queue.length;head++) {
      const [i,j] = queue[head], key=i+','+j;
      const p=[i*grid,j*grid];
      if (p[1]>front || clearance(p)<radius-1e-8) continue;
      visited.set(key,p);
      for (const [di,dj] of [[0,1],[1,0],[0,-1],[-1,0]]) {
        const ni=i+di,nj=j+dj;
        const nextKey=ni+','+nj;
        if (!queued.has(nextKey) && edge(p,[ni*grid,nj*grid],radius)) {
          queued.add(nextKey);
          queue.push([ni,nj]);
        }
      }
    }
    return visited;
  }
  return {clearance,edge,flood};
}

export function audit(shop,studio) {
  const boxes=obstacles(shop,studio), floor=floorGrid(shop,boxes), issues=[];
  // Structural side and back walls are axis-aligned in the local shop frame.
  const walls=boxes.filter(b=>Math.max(b.size[0],b.size[2])>6 && Math.min(b.size[0],b.size[2])<.3);
  const reachable=floor.flood(capsule), wide=floor.flood(.6);
  const pointKey=p=>p.map(v=>Math.round(v/grid)).join(',');
  function connected(p,field,r) {
    const node=field.get(pointKey(p));
    return node && floor.edge(node,p,r);
  }
  for (const item of shop.items) {
    const {id,standing,xyz,size,yawDeg,anchor}=item;
    if (!insideZone([xyz[0],xyz[2]],shop.zones[item.zone] ?? [])) issues.push([id,'outside zone']);
    if (!connected(standing,reachable,capsule)) issues.push([id,'blocked route']);
    if (!connected(standing,wide,.6)) issues.push([id,'aisle < 1.2 m']);
    if (distance(standing,item)>item.reachDistance) issues.push([id,'out of reach']);
    const pickupMargin = shop.slot === 'S01' && item.socket === 'shelves' ? .25 : .15;
    if (item.action.includes('pick up') && floor.clearance(standing)-capsule < pickupMargin-1e-8)
      issues.push([id,`pick-up clearance < ${pickupMargin} m`]);
    const surface=shop.anchors[anchor];
    if (surface?.owner) {
      const parent=shop.items.find(candidate=>candidate.id===surface.owner);
      const [x,y,z]=surface.xyz;
      if (!parent || distance([x,z],parent)>1e-6 || y<parent.xyz[1] || y>parent.xyz[1]+parent.size[1]+.001)
        issues.push([id,'support outside parent']);
    }
    const tolerance=anchor==='floor' ? .026 : .001;
    if (!surface || distance([xyz[0],xyz[2]],surface)>1e-6 || Math.abs(xyz[1]-surface.xyz[1])>tolerance)
      issues.push([id,'unsupported']);
    const a=yawDeg*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));
    const [w,d]=shop.frame.lot_width_depth_m, hz=(size[0]*s+size[2]*c)/2;
    const hx=(size[0]*c+size[2]*s)/2;
    const touchesWall=walls.some(wall=>{
      const swap=Math.abs(Math.sin((wall.yawDeg ?? 0)*Math.PI/180))>.5;
      const wx=wall.size[swap ? 2 : 0]/2,wz=wall.size[swap ? 0 : 2]/2;
      return xyz[1]<wall.xyz[1]+wall.size[1] && xyz[1]+size[1]>wall.xyz[1] &&
        Math.abs(xyz[0]-wall.xyz[0])<hx+wx-1e-6 && Math.abs(xyz[2]-wall.xyz[2])<hz+wz-1e-6;
    });
    if (touchesWall || Math.abs(xyz[0])+hx>w/2 || xyz[2]+hz>d/2 || xyz[2]-hz<d/2-shop.frame.actual_room_depth_m)
      issues.push([id,'inside wall']);
  }
  // A ray from standing eye height to the upper half of the focal silhouette.
  if (['S01','S02','S03'].includes(shop.slot)) {
    const target=shop.items.find(item=>item.id===shop.focal);
    const start=shop.frame.threshold_local_xz_m;
    for (let step=1;step<100;step++) {
      const t=step/100, y=1.55+t*(target.xyz[1]+target.size[1]*.75-1.55);
      const p=[start[0]+t*(target.xyz[0]-start[0]),start[1]+t*(target.xyz[2]-start[1])];
      if (shop.items.some(i=>i!==target && i.xyz[1]<y && i.xyz[1]+i.size[1]>y && distance(p,i)<1e-8)) {
        issues.push([target.id,'entrance sightline blocked']);
        break;
      }
    }
  }
  for (const seat of shop.frame.preserved_seats) {
    if (!connected(seat.exit_local_m,wide,.6)) issues.push([seat.id,'seat exit aisle < 1.2 m']);
  }
  if (['S02','S03'].includes(shop.slot) && !connected([0,-3],reachable,capsule))
    issues.push([shop.slot,'back-wall story blocked']);
  for (const [from,to] of shop.aisles) if (!floor.edge(from,to,.6)) issues.push([from,to,'aisle < 1.2 m']);
  if (!connected(shop.turning,wide,.6) || floor.clearance(shop.turning)<.75) issues.push(['turning circle < 1.5 m']);
  return issues;
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const plan=JSON.parse(readFileSync(programme)), studio=await studioBoxes();
  for (const shop of plan.stores) {
    if (shop.slot==='S03' && process.argv.includes('--legacy-table')) {
      shop.retainedObstacles.push({xyz:[0,0,.5],size:[1.61,.875,1.61]});
    }
    const issues=audit(shop,studio);
    console.log(shop.slot, issues.length ? JSON.stringify(issues) : 'clear');
    if (issues.length) process.exitCode=1;
  }
}
