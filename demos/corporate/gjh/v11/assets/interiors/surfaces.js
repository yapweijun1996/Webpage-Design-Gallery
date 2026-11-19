import {radians} from './config.js';
import {decalHeight} from '../surface-decals.js';

// Convex fields are tessellated in place. Borders and grout share edges with
// their neighbours, so there are no overlapping floor faces in a finish.
function floorPolygon(xCount, zCount, colourAt, put) {
  for (let row=0; row<zCount; row++) for (let column=0; column<xCount; column++) {
    const x = column/xCount-.5, z = row/zCount-.5;
    const u = x+1/xCount, v = z+1/zCount;
    const colour = colourAt(column,row);
    put([[x,z],[x,v],[u,v],[u,z]],colour);
  }
}

function radialFloor(steps, radiusAt, rings, put) {
  let inner = 0;
  for (const [outer,colour] of rings) {
    for (let i=0;i<steps;i++) {
      const a = 2*Math.PI*i/steps, b = 2*Math.PI*(i+1)/steps;
      const point = (phase,r) => [Math.cos(phase)*r*radiusAt(phase)/2, Math.sin(phase)*r*radiusAt(phase)/2];
      put(inner ? [point(a,inner),point(a,outer),point(b,outer),point(b,inner)].reverse()
        : [[0,0],point(b,outer),point(a,outer)],colour);
    }
    inner = outer;
  }
}

export function floorFinish(T, store) {
  const floor = store.floor, [width,depth] = floor.field_width_depth_m;
  const [x,y,z] = floor.position_m, a = radians(floor.yaw_deg), c = Math.cos(a), s = Math.sin(a);
  const finishY = decalHeight(y,floor.offset_m);
  const palette = store.palette.map(entry => entry.hex);
  const [,field,edge] = floor.colours.map(value => palette[value] ?? value);
  const color = new T.Color(field), trim = new T.Color(edge);
  const tint = color.clone().lerp(trim,.33), dark = color.clone().multiplyScalar(.78);
  const light = color.clone().lerp(new T.Color('#F4EBDD'),.19);
  const positions=[], colours=[];
  function put(points, finish) {
    for (let i=1;i<points.length-1;i++) for (const [u,v] of [points[0],points[i],points[i+1]]) {
      positions.push(x+c*u*width+s*v*depth,finishY,z-s*u*width+c*v*depth);
      colours.push(finish.r,finish.g,finish.b);
    }
  }
  const rect = (left,back,right,front,finish) => put([[left,back],[left,front],[right,front],[right,back]],finish);
  function matGrid(columns,rows,pattern,border=.035) {
    rect(-.5,-.5,.5,-.5+border,trim);
    rect(-.5,.5-border,.5,.5,trim);
    rect(-.5,-.5+border,-.5+border,.5-border,trim);
    rect(.5-border,-.5+border,.5,.5-border,trim);
    floorPolygon(columns,rows,pattern,(points,finish) =>
      put(points.map(([u,v]) => [u*(1-2*border),v*(1-2*border)]),finish));
  }
  switch (floor.pattern) {
    case 'runner': matGrid(7,1,(i) => i===1 || i===5 ? tint : color,.022); break;
    case 'tile': matGrid(9,8,(i,j) => (i+j)%3===0 ? light : (i+j)%3===1 ? dark : color); break;
    case 'reed': matGrid(13,1,(i) => i%3===0 ? tint : color,.022); break;
    case 'planks': matGrid(1,14,(i,j) => [color,tint,light,dark][j%4],.02); break;
    case 'gingham': matGrid(8,10,(i,j) => i%2 && j%2 ? trim : (i+j)%2 ? tint : color,.026); break;
    case 'tracks': matGrid(9,1,(i) => i===2 || i===6 ? trim : i===3 || i===5 ? tint : color,.04); break;
    case 'blocks': matGrid(11,9,(i,j) => [color,tint,light,dark][(17*i+7*j+i*j)%4],.037); break;
    case 'wool': matGrid(7,1,i => i%2===0 ? color : dark,.033); break;
    case 'lane': matGrid(9,7,(i,j) => i===4 && j%2===0 ? trim : i>=3 && i<=5 ? tint : light); break;
    case 'cork': {
      const points = [[-.5,-.5],[-.5,.11],[-.27,.25],[-.27,.5],[.27,.5],[.27,.25],[.5,.11],[.5,-.5]];
      for (let i=0;i<points.length;i++) {
        const p=points[i], q=points[(i+1)%points.length];
        // Border rings scaled around the centre leave space for the main field.
        put([p,q,q.map(v=>v*.94),p.map(v=>v*.94)],trim);
      }
      const [, , a, b, c, d] = points.map(([u,v])=>[u*.94,v*.94]);
      const edge = .5*.94, shoulder = .11*.94;
      rect(-edge,-edge,edge,shoulder,color);
      put([[-edge,shoulder],a,d,[edge,shoulder]],tint);
      put([a,b,c,d],light);
      break;
    }
    case 'octagon': radialFloor(8,()=>1,[[.86,color],[.94,trim],[1,tint]],put); break;
    case 'pill': radialFloor(24,t=>1+.08*Math.cos(2*t),[[.88,color],[.91,trim],[.95,tint]],put); break;
    case 'sweep': radialFloor(24,t=>1+.14*Math.sin(2*t),[[.52,color],[.63,tint],[.76,trim],[.88,light],[.94,trim]],put); break;
    case 'scallop': radialFloor(36,t=>.96+.06*Math.cos(t*9),[[.82,color],[.94,trim],[1,tint]],put); break;
    case 'arcs': radialFloor(24,()=>1,[[.62,color],[.65,trim],[.76,color],[.79,trim],[.91,color],[.94,trim],[1,light]],put); break;
    case 'felt': radialFloor(24,()=>1,[[.91,color],[.93,tint],[1,dark]],put); break;
    case 'stage': radialFloor(24,()=>1,[[.74,color],[.78,tint],[.91,color],[.95,trim],[1,color]],put); break;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function kelvinColour(T, kelvin) {
  // Match a warm-to-cool blackbody approximation in display sRGB.
  const x = kelvin/100;
  const clamp = value => Math.max(0,Math.min(255,value))/255;
  return new T.Color().setRGB(1,clamp(99.4708*Math.log(x)-161.1196),
    clamp(138.5177*Math.log(x-10)-305.0448),T.SRGBColorSpace);
}
