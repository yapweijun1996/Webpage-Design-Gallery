// Metres in expanded-world coordinates. Positive yaw turns local +Z toward +X.
export function roundedLoop(west, north, east, south, radius = 2) {
  let x = 10, z = south, heading = -Math.PI / 2, length = 0;
  const segments = [];
  function append(span, curvature = 0) {
    const segment = {start: length, span, x, z, heading, curvature};
    segments.push(segment);
    ({x, z, heading} = pose(segment, span));
    length += span;
  }
  function pose(segment, d) {
    const {x, z, heading, curvature: k} = segment;
    const angle = heading + k * d;
    return {x: x + (k ? (Math.cos(heading) - Math.cos(angle)) / k : d * Math.sin(angle)),
      z: z + (k ? (Math.sin(angle) - Math.sin(heading)) / k : d * Math.cos(angle)), heading: angle};
  }
  const corner = () => append(Math.PI * radius / 2, -1 / radius);
  append(10 - west - radius);
  corner();
  append(south - north - 2 * radius);
  corner();
  append(east - west - 2 * radius);
  corner();
  append(south - north - 2 * radius);
  corner();
  append(east - radius - 10);
  return {length, sample(distance) {
    const d = ((distance % length) + length) % length;
    const segment = segments.find(s => d < s.start + s.span) ?? segments[0];
    return pose(segment, d - segment.start);
  }};
}

export const tramEnvelopes = {
  car: {width: 1.4, length: 3, bottom: .06, top: 1.10},
  passenger: {width: .60, length: .60, bottom: .50, top: 1.65},
  camera: {width: .50, length: .50, bottom: 2.15, top: 2.65}
};
export const seatEyeHeight = 1.48;
export const chaseDistance = 5.2;
export const tramStations = {
  entry: {x: 10, z: 40.5}, east: {x: 33.5, z: 22},
  upper: {x: -13.5, z: 10, y: 7.2}
};
export const tramRoute = roundedLoop(tramStations.upper.x, 2.25, tramStations.east.x, tramStations.entry.z);

// The chase camera follows the same rail through bends, 5.2 m of arc behind the seat.
export function sampleTramEnvelopes(route, distance) {
  return Object.entries(tramEnvelopes).map(([id, shape]) => ({
    id, ...shape, ...route.sample(id === 'camera' ? distance - chaseDistance : distance)
  }));
}

export function addTramDebug(T, scene, now = () => performance.now()) {
  const points = [];
  for (let d = 0; d < tramRoute.length; d += .25) {
    const {x, z} = tramRoute.sample(d);
    points.push(new T.Vector3(x, .06, z));
  }
  const line = new T.LineLoop(new T.BufferGeometry().setFromPoints(points),
    new T.LineBasicMaterial({color: 0xff953c}));
  const {width, length, top, bottom} = tramEnvelopes.car;
  const car = new T.Mesh(new T.BoxGeometry(width, top - bottom, length),
    new T.MeshBasicMaterial({color: 0x909498}));
  line.name = 'Tram debug route';
  car.name = 'Tram debug car';
  const start = now();
  function update() {
    const {x, z, heading} = tramRoute.sample((now() - start) * .0015);
    car.position.set(x, (top + bottom) / 2, z);
    car.rotation.y = heading;
  }
  update();
  scene.add(line, car);
  return update;
}

// One opaque instanced draw with the mall's shared plain-box finish. Keep all pieces
// inside the surveyed car envelope and leave the south-side boarding opening.
export function createTramCar(T, scene) {
  const existingMaterial = scene.getObjectByName('box plain')?.material;
  const material = existingMaterial ?? new T.MeshStandardMaterial({roughness:.72});
  const geometry = new T.BoxGeometry();
  const {width, length} = tramEnvelopes.car;
  const jade = 0x153c30, cream = 0xe3d6b7, brass = 0xb59b62;
  const pieces = [
    [0,.11,0,width,.10,length,jade],
    [0,.47,1.44,width,.62,.12,jade],
    [0,.43,-1.44,width,.54,.12,jade],
    [.64,.38,0,.12,.44,2.78,jade],
    [-.64,.38,-.98,.12,.44,.75,jade],
    [-.64,.38,.98,.12,.44,.75,jade],
    [0,.40,-.05,.98,.16,.46,jade],
    [0,.49,-.05,.98,.06,.46,cream],
    [0,.78,-.30,.98,.42,.12,cream],
    [0,.81,1.44,width,.06,.12,brass],
    [0,.73,-1.44,width,.06,.12,brass],
    [0,.40,-.99,.98,.16,.46,jade],
    [0,.49,-.99,.98,.06,.46,cream],
    [0,.78,-1.24,.98,.42,.12,cream]
  ];
  if (existingMaterial) {
    const surfaces = new Float32Array(pieces.length * 2);
    pieces.forEach((_, i) => { surfaces[i * 2] = .72; });
    geometry.setAttribute('instanceSurface', new T.InstancedBufferAttribute(surfaces, 2));
  }
  const mesh = new T.InstancedMesh(geometry, material, pieces.length);
  mesh.name = 'Mall tram';
  mesh.visible = false;
  const matrix = new T.Matrix4(), color = new T.Color();
  pieces.forEach(([x,y,z,w,h,l,tint], index) => {
    mesh.setMatrixAt(index, matrix.makeScale(w,h,l).setPosition(x,y,z));
    mesh.setColorAt(index, color.setHex(tint));
  });
  scene.add(mesh);
  return {
    mesh,
    place({x,z,heading}) { mesh.position.set(x,0,z); mesh.rotation.y = heading; },
    dispose() {
      scene.remove(mesh);
      mesh.dispose();
      geometry.dispose();
      if (!existingMaterial) material.dispose();
    }
  };
}
