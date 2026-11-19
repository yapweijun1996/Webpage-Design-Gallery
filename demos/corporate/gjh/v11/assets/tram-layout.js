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
