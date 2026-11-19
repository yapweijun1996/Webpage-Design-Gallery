import {shopEntrance} from '../expanded-layout.js';
import {atlasCells,atlasSize,plateRect} from './atlas-layout.js';
import {bayWidth,fasciaBand} from './config.js';

// Shared dimensions for the two atlas decals and their projecting hardware socket.
export const bladeSocket = Object.freeze({inset:.24, drop:.78, reach:.94, height:.69, thickness:.043});

export function uvRect(r,size=atlasSize) {
  return [(r.x+.5)/size,1-(r.y+r.h-.5)/size,
    (r.x+r.w-.5)/size,1-(r.y+.5)/size];
}

// Local +Z faces the aisle. A group carries only the mount and one static face
// buffer until the scene owner merges it. No IO, lights, scene or physics access.
export function createShopSign(T,config,bay) {
  const group=new T.Group(), entrance=shopEntrance(bay), anchor=Number(bay.number)<=3;
  group.name='Store sign '+config.id;
  group.position.set(entrance.x,0,entrance.z);
  group.rotation.y=entrance.yaw;
  const cells=atlasCells(Number(bay.number)-1);
  const {width,height,depth}=config.size, band=fasciaBand(bay);
  const z=(anchor?.44:.23)+depth, y=(band.top+band.bottom)/2;
  const bladeX=-width/2+bladeSocket.inset, bladeY=y-bladeSocket.drop, bladeDepth=bladeSocket.reach;
  const positions=[],uvs=[],indices=[];
  function panel(x,y,z,w,h,yaw,cell){
    const start=positions.length/3, cs=Math.cos(yaw),sn=Math.sin(yaw);
    for(const [u,v] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]])
      positions.push(x+w*u*cs,y+h*v,z-w*u*sn);
    const [l,b,r,t]=uvRect(cell);
    uvs.push(l,b,r,b,r,t,l,t);
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  panel(0,y,z,width,height,0,cells.fascia);
  if(config.blade){
    // Separate outward-facing winding keeps the lettering legible from either end.
    for(const side of [-1,1])panel(bladeX+side*(bladeSocket.thickness/2+.001),bladeY,z+bladeDepth/2,
      bladeDepth-.05,bladeSocket.height-.045,side*Math.PI/2,cells.blade);
  }
  // Permanent number plate on the fixed pier also serves stores with no blade.
  panel(width/2-.32,3.7,z,.60,.20,0,plateRect(cells.blade));
  const span=bayWidth(bay);
  if(config.poster){
    if(anchor){
      panel(-span*.359,2.15,.24,1.52,1.32,0,cells.poster);
    } else {
      // Left window lightbox, beside the view into the shop and clear of the doors.
      panel(-span/2+.98,bay.posterHeight??2.46,-.09,1.24,1.08,0,cells.poster);
      const heroX=bay.side==='north'?3:2.55;
      panel(heroX-.61,.42,-.44,.68,.51,0,cells.poster);
    }
  }
  if(!anchor){
    const roomDepth=bay.side==='north'?bay.maxZ-bay.minZ:bay.maxX-bay.minX;
    panel(0,3.69,-roomDepth+.98,3.63,.415,0,cells.fascia);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  group.add(new T.Mesh(geometry,config.faceMaterial));
  group.userData.mount={y,z,depth,bladeX,bladeY,bladeDepth};
  group.updateMatrixWorld();
  return group;
}

// Turn horizontal ink runs and their exposed perimeter into capped relief.
// Caps sample the exact artwork UVs. The mask supplies geometry only.
export function letterGeometry(T,mask,config,mount,cell) {
  const {width:n,height:m,ink}=mask;
  if(!ink.some(Boolean))return null;
  const p=[],uv=[],idx=[], [left,bottom,right,top]=uvRect(cell);
  function quad(points){
    const start=p.length/3;
    for(const [x,y,d] of points){
      p.push((x/n-.5)*config.size.width,mount.y+(.5-y/m)*config.size.height,mount.z+d);
      uv.push(left+(right-left)*x/n,top+(bottom-top)*y/m);
    }
    idx.push(start,start+1,start+2,start,start+2,start+3);
  }
  const bevel=.018,base=.001;
  function wall(x,y,ex,ey){quad([[x,y,base],[ex,ey,base],[ex,ey,bevel],[x,y,bevel]]);}
  function run(y,condition,handle){
    for(let x=0;x<n;){
      if(!condition(x)){x++;continue;}
      const start=x++;
      while(x<n&&condition(x))x++;
      handle(start,x,y);
    }
  }
  for(let y=0;y<m;y++){
    const row=y*n;
    run(y,x=>ink[row+x],(a,b)=>{
      quad([[a,y+1,bevel],[b,y+1,bevel],[b,y,bevel],[a,y,bevel]]);
      wall(a,y,a,y+1);wall(b,y+1,b,y);
    });
    run(y,x=>ink[row+x]&&!ink[row-n+x],(a,b)=>wall(b,y,a,y));
    run(y,x=>ink[row+x]&&!ink[row+n+x],(a,b)=>wall(a,y+1,b,y+1));
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();
  return g;
}
