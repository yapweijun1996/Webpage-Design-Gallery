import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSeatPlacements, createSeatAnchor, deckBenchFallback, groundBenchFallback} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';
import {layouts} from '../demos/corporate/gjh/v11/assets/interiors/layout.js';
import {GLTFLoader} from '../demos/corporate/gjh/v11/vendor/GLTFLoader.js';
import {Box3, Vector3} from '../demos/corporate/gjh/v11/vendor/three.module.min.js';

const coordinates = placements => placements.map(({x,z}) => [x,z]);
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);

test('all classic and expanded bench placements have authored seat data and stable identities', () => {
  const classic=createSeatPlacements(false), expanded=createSeatPlacements(true);
  assert.deepEqual(coordinates(classic), [[-7.8,9.5],[7.8,9.5],[-7.8,13],[7.8,13],[-3,-6.8],[3,-6.8],[7,-6.8],[13,-6.8]]);
  assert.deepEqual(coordinates(expanded), [[-5.7,24.5],[-2.3,24.5],[22.3,24.5],[25.7,24.5],[-2.7,-6.8],[3.05,-7.85],[7,-6.8],[13.35,-7.05],[-6.65,12.55],[.1,8.8],[-3,6]]);
  for(const placements of [classic,expanded]) {
    for(const [index,p] of placements.entries()) {
      assert.equal(p.id,index ? `bench-seat-${index+1}` : 'courtyard-seat');
      assert.equal(p.exit.y,p.floor);
      assert(Math.hypot(p.exit.x-p.x+1.2*Math.sin(p.pose.angle),p.exit.z-p.z+1.2*Math.cos(p.pose.angle))<1e-6);
      assert.equal(p.pose.facing,p.facing); if (placements===classic || !['mili','gogo'].includes(p.group)) assert.equal(p.pose.angle,p.facing===1?0:Math.PI);
      assert.equal(p.clearance.interactionRadius,1.65); assert.equal(p.clearance.capsuleRadius,.3);
      const seat=createSeatAnchor(p,123);
      assert.equal(seat.collider,123); near((seat.x-p.x)*Math.cos(p.pose.angle)-(seat.z-p.z)*Math.sin(p.pose.angle),0);
      assert.equal(seat.exitX,p.exit.x); assert.equal(seat.exitZ,p.exit.z);
      assert.equal(seat.clearance,p.clearance); assert.equal(seat.accessible,p.accessible);
    }
  }
  assert.ok(classic.every(p=>p.accessible && p.floor===0));
  assert.equal(expanded.filter(p=>p.accessible).length,11);
  assert.equal(Object.keys(layouts).length,17);
  const shopSeats = Object.values(layouts).flatMap(({frame}) => frame.preserved_seats.map(seat => ({
    id:seat.id, x:frame.world_origin_m[0]+seat.centre_local_m[0], z:frame.world_origin_m[2]+seat.centre_local_m[1]
  })));
  assert.deepEqual(expanded.filter(p=>p.group==='mili'||p.group==='gogo').map(({id,x,z})=>({id,x,z})), shopSeats);
});

test('every interactive bench anchor lands on the GLB cushion and faces its opening', async () => {
  const bytes = await readFile(new URL('../demos/corporate/gjh/v11/assets/GJH_PUB_002.glb', import.meta.url));
  const {scene} = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  const bounds = new Box3().setFromObject(scene);
  const upholstery = scene.getObjectsByProperty('isMesh', true).find(mesh => mesh.material.name === 'Sand upholstery');
  const vertices = upholstery.geometry.attributes.position;
  const cushion = new Box3(), backrest = new Box3(), top = [];
  for (let i = 0; i < vertices.count; i++) {
    const p = upholstery.localToWorld(new Vector3().fromBufferAttribute(vertices, i));
    if (Math.abs(p.x) < .5) {
      (p.y < .66 ? cushion : backrest).expandByPoint(p);
      if (p.y < .66) top.push(p);
    }
  }
  assert.ok(!cushion.isEmpty() && !backrest.isEmpty());
  const flatFront = Math.min(...top.filter(p => p.y >= cushion.max.y - .001).map(p => p.z));
  for (const expanded of [false, true]) {
    for (const placement of createSeatPlacements(expanded)) {
      const seat = createSeatAnchor(placement, 1);
      const label = seat.name;
      const c=Math.cos(seat.angle), s=Math.sin(seat.angle);
      const localX=(seat.x-placement.x)*c-(seat.z-placement.z)*s;
      const localDepth=(x,z)=>(x-placement.x)*s+(z-placement.z)*c;
      const localZ=localDepth(seat.x,seat.z);
      assert.ok(Math.abs(localX) < .01 && localX > bounds.min.x && localX < bounds.max.x, label);
      assert.ok(localZ > cushion.min.z && localZ < backrest.min.z, label);
      assert.ok(Math.abs(localZ - (flatFront + backrest.min.z) / 2) < .003, label);
      assert.ok(Math.abs(seat.y - placement.floor - cushion.max.y * .8) < .002, label);
      assert.ok(localZ < backrest.min.z, label);
      assert.ok(localDepth(seat.exitX,seat.exitZ) - localZ < bounds.min.z - localZ - .3, label);
      const fallback = placement.group === 'deck' ? deckBenchFallback : groundBenchFallback;
      const fallbackScale = placement.group === 'deck' ? 1 : .8;
      const fallbackSeat = createSeatAnchor(placement, 1, fallback, fallbackScale);
      const fallbackZ = localDepth(fallbackSeat.x,fallbackSeat.z);
      near(fallbackSeat.y, placement.floor+fallback.top*fallbackScale);
      assert.ok(fallbackZ > fallback.front && fallbackZ < fallback.backrestFront, label);
      assert.ok(fallbackZ < fallback.backrestFront, label);
    }
  }
});

test('upper exits are supported by the slab and clear the shaft and guards', () => {
  const deck=createSeatPlacements(true).filter(p=>p.group==='deck');
  const {shaft,slab,upper}=liftLayout;
  for(const p of deck) {
    assert.equal(p.floor,upper); assert.ok(p.accessible);
    const radius=p.clearance.capsuleRadius;
    assert.ok(p.exit.x-radius>slab.minX && p.exit.x+radius<slab.maxX && p.exit.z-radius>slab.minZ && p.exit.z+radius<slab.maxZ);
    const dx=Math.max(shaft.minX-p.exit.x,0,p.exit.x-shaft.maxX);
    const dz=Math.max(shaft.minZ-p.exit.z,0,p.exit.z-shaft.maxZ);
    assert.ok(Math.hypot(dx,dz)>radius+.05, 'exit must clear the shaft guard');
  }
  const third=deck[2];
  assert.ok(third.z+third.clearance.colliderDepth/2<shaft.minZ-.05);
});
