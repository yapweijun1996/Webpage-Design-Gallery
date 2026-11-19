// Prop and capsule solver groups opt out of solving against one another. The
// controller still sees each prop, while the sweep below owns all push impulses.
const CAPSULE_SOLVER_GROUP = 0x8000bfff;
const PROP_SOLVER_GROUP = 0x40007fff;
const SLEEP_SECONDS = 1.5;
const FADE_SECONDS = .24;
const MAX_PUSH_IMPULSE = .18;

export function createPhysicsPropPool(world, {phone = false} = {}) {
  const capacity = phone ? 6 : 12;
  const slots = Array.from({length: capacity}, () => ({
    body: null, prop: null, awake: false, fade: 0, still: 0
  }));
  const impulse = {x: 0, y: 0, z: 0};
  let zone = null, activeBodies = 0, occupied = 0;

  function finish(slot) {
    slot.prop.mesh.visible = false;
    slot.prop.mesh.material.opacity = 1;
    slot.prop = null;
    occupied--;
  }
  function remove(slot, fade) {
    activeBodies -= Number(slot.awake);
    world.removeRigidBody(slot.body);
    slot.body = null;
    slot.awake = false;
    slot.fade = FADE_SECONDS;
    const prop = slot.prop;
    if (!fade) finish(slot);
    prop.onRemove?.();
  }
  function setZone(next) {
    if (next === zone) return;
    zone = next;
    for (const slot of slots) if (slot.body) remove(slot, true);
  }
  function spawn(prop, x, y, z) {
    if (zone === null) return false;
    let available = null, fading = null;
    for (const slot of slots) {
      if (slot.prop === prop) return false;
      if (!slot.prop) available ??= slot;
      else if (!slot.body) fading ??= slot;
    }
    const slot = available ?? fading;
    if (!slot) return false;
    const body = prop.createBody(x, y, z);
    if (slot.prop) finish(slot);
    slot.prop = prop;
    slot.body = body;
    slot.still = 0;
    prop.mesh.position.set(x, y, z);
    prop.mesh.quaternion.identity();
    prop.mesh.visible = true;
    occupied++;
    slot.awake = !body.isSleeping();
    activeBodies += Number(slot.awake);
    return true;
  }
  function despawn(prop, fade = false) {
    for (const slot of slots) {
      if (slot.prop !== prop || !slot.body) continue;
      remove(slot, fade);
      return true;
    }
    return false;
  }

  function push(capsule, start, end) {
    const dx = end.x - start.x, dz = end.z - start.z;
    const travel = Math.hypot(dx, dz);
    if (travel < .002 || travel > .25) return;
    const capsuleRadius = capsule.radius();
    for (const slot of slots) {
      if (!slot.body) continue;
      const {mesh, radius, halfHeight, mass} = slot.prop;
      const point = mesh.position;
      if (Math.abs(end.y - point.y) > .55 + capsuleRadius + halfHeight) continue;
      const ox = point.x - end.x, oz = point.z - end.z;
      const distance = Math.hypot(ox, oz);
      const towards = ox * dx + oz * dz;
      if (distance > capsuleRadius + radius + .045 || towards <= 0) continue;

      const nx = ox / distance, nz = oz / distance;
      const velocity = slot.body.linvel();
      const speed = velocity.x * nx + velocity.z * nz;
      const amount = Math.min(MAX_PUSH_IMPULSE, mass * Math.max(0, .85 * towards / (distance * travel) - speed));
      if (amount <= .001) continue;
      impulse.x = nx * amount;
      impulse.z = nz * amount;
      slot.body.applyImpulse(impulse, true);
      slot.still = 0;
    }
  }
  function afterStep(dt) {
    for (const slot of slots) {
      const {prop, body} = slot;
      if (!prop) continue;
      if (!body) {
        slot.fade -= dt;
        if (slot.fade <= 1e-8) finish(slot);
        else prop.mesh.material.opacity = slot.fade / FADE_SECONDS;
        continue;
      }
      activeBodies -= Number(slot.awake);
      slot.awake = false;
      if (body.isSleeping()) continue;
      const point = body.translation(), rotation = body.rotation();
      const {position, quaternion} = prop.mesh;
      const linear = Math.hypot(point.x - position.x, point.y - position.y, point.z - position.z);
      const angular = Math.abs(quaternion.x * rotation.x + quaternion.y * rotation.y +
        quaternion.z * rotation.z + quaternion.w * rotation.w);
      position.copy(point);
      quaternion.copy(rotation);
      if (point.y < prop.floor - 2) {
        remove(slot, true);
        continue;
      }
      // Require quiet motion for 1.5 s, so a falling or rolling prop cannot freeze.
      slot.still = linear <= .025 * dt && angular >= Math.cos(.2 * dt / 2) ? slot.still + dt : 0;
      if (slot.still + 1e-8 >= SLEEP_SECONDS) body.sleep();
      else {
        slot.awake = true;
        activeBodies++;
      }
    }
  }
  return {setZone, spawn, despawn, push, afterStep,
    get zone() { return zone; },
    get occupied() { return occupied; },
    get activeBodies() { return activeBodies; }};
}

function makeProp(T, R, world, scene, geometry, {name, radius, halfHeight, mass, color, ball, bounce, ccd}) {
  const material = new T.MeshStandardMaterial({color, roughness: .78, transparent: true});
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.visible = false;
  scene.add(mesh);
  return {
    mesh, radius, halfHeight, mass, floor: 0,
    createBody(x, y, z) {
      const desc = R.RigidBodyDesc.dynamic().setTranslation(x, y, z)
        .setCcdEnabled(ccd).setCanSleep(true).setLinearDamping(ball ? .7 : 1.0).setAngularDamping(ball ? 1.6 : 4);
      const shape = ball ? R.ColliderDesc.ball(radius) : R.ColliderDesc.cylinder(halfHeight, radius);
      shape.setMass(mass).setFriction(ball ? .65 : .85)
        .setRestitution(bounce).setRestitutionCombineRule(R.CoefficientCombineRule.Max)
        .setSolverGroups(PROP_SOLVER_GROUP);
      const body = world.createRigidBody(desc);
      world.createCollider(shape, body);
      return body;
    }
  };
}

export function registerPhysicsProps(T, R, world, {
  scene, interactables, reserveProduct, expanded, phone, prepareModel, interiors
}) {
  const pool = createPhysicsPropPool(world, {phone});
  const can = makeProp(T, R, world, scene, new T.CylinderGeometry(.03875, .03875, .124, 12),
    {name: 'Dropped can', radius: .03875, halfHeight: .062, mass: .16, color: 0xc1a46d, bounce: .32, ccd: true});
  const ball = makeProp(T, R, world, scene, new T.IcosahedronGeometry(.16, 1),
    {name: 'Atrium ball', radius: .16, halfHeight: .16, mass: .28, color: 0xa74634, ball: true, bounce: .26, ccd: true});
  const basket = makeProp(T, R, world, scene,
    new T.LatheGeometry([new T.Vector2(0, -.14), new T.Vector2(.16, -.14), new T.Vector2(.21, .14),
      new T.Vector2(.19, .14), new T.Vector2(.14, -.115), new T.Vector2(0, -.115)], 12),
    {name: 'Atrium basket', radius: .21, halfHeight: .14, mass: .55, color: 0x8b6842, bounce: .06, ccd: false});
  if (prepareModel) void prepareModel([can.mesh, ball.mesh, basket.mesh], {late: false}).catch(() => {});

  const ballX = expanded ? 11.4 : 3.5, basketX = expanded ? 13 : 5;
  const propZ = expanded ? 26 : 11;
  let ballSpawned = false, basketSpawned = false;
  let held = null, dropped = null, resumePickup = null, taking = false;
  let capsule, capsuleBody, bodyStepMs = 0;

  function findCapsule(collider) {
    if (capsule || collider.shapeType() !== R.ShapeType.Capsule) return;
    const body = collider.parent();
    if (!body?.isKinematic()) return;
    capsule = collider;
    capsuleBody = body;
    capsule.setSolverGroups(CAPSULE_SOLVER_GROUP);
  }

  const step = world.step;
  // Keep the single caller-owned 60 Hz step, including its existing arguments.
  world.step = function (events, hooks) {
    if (!pool.occupied) {
      bodyStepMs = 0;
      return step.call(this, events, hooks);
    }
    const start = performance.now();
    if (!capsule) world.forEachCollider(findCapsule);
    if (capsule?.isEnabled()) pool.push(capsule, capsuleBody.translation(), capsuleBody.nextTranslation());
    const result = step.call(this, events, hooks);
    pool.afterStep(world.timestep);
    bodyStepMs = performance.now() - start;
    return result;
  };

  const report = interiors?.report;
  // Expanded performanceReport already pulls the live zone's interior report.
  // bodyStepMs covers the shared solver step plus prop input and mesh sync.
  if (report) interiors.report = function () {
    return {...report.call(this), activeBodies: pool.activeBodies, bodyStepMs};
  };

  function canReach(position) {
    const phase = position?.character?.physicalProduct?.phase;
    const p = can.mesh.position;
    return Boolean(dropped && phase === 'empty' && !position.seated && !position.pushing && !position.elevatorTravel &&
      p.y >= position.y - .2 && p.y <= position.y + 1.35 &&
      Math.hypot(position.x - p.x, position.z - p.z) < 1.05);
  }
  can.onRemove = () => {
    const product = dropped;
    dropped = resumePickup = null;
    if (!taking) product?.release();
  };

  interactables.physicsProps = {
    visit(zone, position) {
      const next = position.elevatorTravel ? null : zone;
      if (next !== pool.zone) {
        pool.setZone(next);
        ballSpawned = basketSpawned = false;
      }
      // The two props are off the entry path and activate near their alcove.
      if (next !== 'atrium' || Math.abs(position.x - ballX) > 7 || Math.abs(position.z - propZ) > 7) return;
      if (!ballSpawned) ballSpawned = pool.spawn(ball, ballX, ball.radius + .015, propZ);
      if (!basketSpawned) basketSpawned = pool.spawn(basket, basketX, basket.halfHeight + .015, propZ);
    },
    drop(position) {
      if (!held || dropped || pool.zone === null) return false;
      return held.releaseToFloor((product, base, pickUp) => {
        can.floor = position.y;
        if (!pool.spawn(can, base.x, base.y + can.halfHeight, base.z)) return false;
        held = null;
        dropped = product;
        resumePickup = pickUp;
        return true;
      });
    },
    floorAction: {
      id: 'physics-floor-can', kind: 'pickup', anchor: can.mesh.position,
      // Use the standing-action HUD presentation for a moving registry target.
      shopAction: {name: 'Dropped can', label: 'Pick up'},
      availability: ({player}) => canReach(player),
      handler() {
        if (!resumePickup?.(can.mesh.position, can.mesh.quaternion, can.halfHeight)) return false;
        taking = true;
        pool.despawn(can);
        taking = false;
        return true;
      }
    }
  };

  return function reserveWithPhysics(id) {
    const token = reserveProduct(id);
    if (!token) return null;
    token.onPickup = () => {
      // Starting a different shelf transfer replaces the player's shelf home.
      // Recycle a previous floor can before that home is changed.
      if (dropped) pool.despawn(can, true);
    };
    token.onHeld = controls => { held = controls; };
    token.onReleased = () => { if (held?.id === id) held = null; };
    return token;
  };
}
