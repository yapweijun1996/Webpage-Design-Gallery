import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeatPlacements, createSeatAnchor} from '../demos/corporate/gjh/v11/assets/seat-placements.js';
import {liftLayout} from '../demos/corporate/gjh/v11/assets/lift-layout.js';

const coordinates = placements => placements.map(({x,z}) => [x,z]);
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);

test('all classic and expanded bench placements have authored seat data and stable identities', () => {
  const classic=createSeatPlacements(false), expanded=createSeatPlacements(true);
  assert.deepEqual(coordinates(classic), [[-7.8,9.5],[7.8,9.5],[-7.8,13],[7.8,13],[-3,-6.8],[3,-6.8],[7,-6.8],[13,-6.8]]);
  assert.deepEqual(coordinates(expanded), [[-5.7,24.5],[-2.3,24.5],[22.3,24.5],[25.7,24.5],[-3,-6.8],[3,-6.8],[7,-6.8],[13,-6.8],[-6.1,8.8],[.1,8.8],[-3,11.7]]);
  for(const placements of [classic,expanded]) {
    for(const [index,p] of placements.entries()) {
      assert.equal(p.id,index ? `bench-seat-${index+1}` : 'courtyard-seat');
      assert.equal(p.anchor.x,p.x); near(p.anchor.y,p.floor+.015); near(p.anchor.z,p.z-.23*p.facing);
      assert.equal(p.exit.x,p.x); assert.equal(p.exit.y,p.floor); near(p.exit.z,p.z-1.2*p.facing);
      assert.equal(p.pose.facing,p.facing); assert.equal(p.pose.angle,p.facing===1?0:Math.PI);
      assert.equal(p.clearance.interactionRadius,1.65); assert.equal(p.clearance.capsuleRadius,.3);
      const seat=createSeatAnchor(p,123);
      assert.equal(seat.collider,123); assert.equal(seat.x,p.anchor.x); assert.equal(seat.y,p.anchor.y);
      assert.equal(seat.z,p.anchor.z); assert.equal(seat.exitX,p.exit.x); assert.equal(seat.exitZ,p.exit.z);
      assert.equal(seat.clearance,p.clearance); assert.equal(seat.accessible,p.accessible);
    }
  }
  assert.ok(classic.every(p=>p.accessible && p.floor===0));
  assert.equal(expanded.filter(p=>p.accessible).length,10);
});

test('upper exits are on the slab and bench collider leaves a capsule-wide planter passage', () => {
  const deck=createSeatPlacements(true).filter(p=>p.group==='deck');
  const {shaft,slab,upper}=liftLayout;
  for(const p of deck.slice(0,2)) {
    assert.equal(p.floor,upper); assert.ok(p.accessible);
    assert.ok(p.exit.x>slab.minX && p.exit.x<slab.maxX && p.exit.z>slab.minZ && p.exit.z<slab.maxZ);
    assert.ok(p.exit.x<shaft.minX || p.exit.x>shaft.maxX || p.exit.z<shaft.minZ || p.exit.z>shaft.maxZ);
    const planterX=p.x<0?-8.1:2.1;
    const gap=Math.abs(p.x-planterX)-p.clearance.colliderWidth/2-.68/2;
    assert.ok(gap>2*p.clearance.capsuleRadius);
  }
  const blocked=deck[2];
  assert.equal(blocked.accessible,false);
  assert.ok(blocked.exit.x>shaft.minX && blocked.exit.x<shaft.maxX && blocked.exit.z>shaft.minZ && blocked.exit.z<shaft.maxZ);
});
