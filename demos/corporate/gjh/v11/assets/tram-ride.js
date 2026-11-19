import {createTramCar} from './tram-car.js';
import {tramEnvelopes, tramRoute, tramStations} from './tram-layout.js';

const SPEED = 1.5;
const APPROACH = 3;
const DWELL = .8;
const LOOK_AHEAD = .35;
const VISITOR_RADIUS = .35;
export const TRAM_STATION_ID = 'tram-south-entrance';
export const TRAM_BOARD_LABEL = 'Ride the tram';
export const tramLanding = Object.freeze({
  x: tramStations.entry.x, y: 0, z: tramStations.entry.z - 1.5, radius: 1.4
});

// Keep the waiting visitor outside the swept car envelope.
export function atTramLanding({x, z}) {
  return z <= tramStations.entry.z - tramEnvelopes.car.width / 2 - VISITOR_RADIUS &&
    Math.hypot(x - tramLanding.x, z - tramLanding.z) < tramLanding.radius;
}

// Distances from the T1 route survey. Copy comes from each store's brand and
// concept in docs/gjh-v11-interior-program.json, checked by the caption test.
export const tramCaptions = Object.freeze([
  ["S11", 22.56, "Hormel", "An open packing bench, kraft rolls and nested slatted crates make this a working stockroom for generic tinned goods."],
  ["S10", 27.14, "California Mexico", "A deep, open scallop shell cradles a generic seafood gift display against pale sand-coloured plaster."],
  ["S09", 35.14, "SPAM", "A stopped tinning conveyor with a yellow return wheel leads the eye diagonally across a navy machine-room counter."],
  ["S08", 43.14, "Skippy", "A tall stand of plain peanut-butter jars fronts a striped breakfast booth with toast trays at serving height."],
  ["S07", 51.14, "Gu Long", "A stepped pyramid of plain tins on a jade serving drum sits beneath one red lantern, like a banquet centrepiece."],
  ["S06", 59.05, "Flying Wheel", "Golden noodle ribbons hang at different lengths from a freestanding timber loom, against a quiet slate wall."],
  ["S01", 63.53, "New Moon", "A cream scalloped header and yellow crescent lead to four honey oak display bays, with optional heritage and serving stories beside the aisle."],
  ["S02", 73.53, "MILI", "A low lacquer pass and a broad copper extraction hood frame the preparation of a bowl, with condiments within reach of the cook."],
  ["S03", 83.53, "GOGO", "A scalloped parasol and compact ice-cream cart bring a street-side frozen-treat bar indoors."],
  ["S04", 93.53, "Borsch Med", "A sage sample counter opens into an oversized folding folio whose white leaves hold plain patch cards."],
  ["S05", 103.53, "Pien Tze Huang", "A bank of stepped dark-wood drawers opens around a single pale porcelain bowl in a quiet apothecary."],
  ["S12", 108.02, "Zeria", "Offset frosted index fins rise behind a low white supplement display, casting blue-green shadows between the layers."],
  ["S13", 115.92, "Sony", "Backlit headphone silhouettes turn a charcoal felt listening bar into a dark, close-focus audio showroom."],
  ["S14", 123.92, "LG", "Two offset picture planes frame an ivory upholstered living room like a bright domestic cinema."],
  ["S15", 131.92, "Casio", "A raised piano lid cuts a diagonal against walnut concert slats, with a shallow ivory-lit stage under the instrument."],
  ["S16", 139.92, "GP", "A perforated teal tool board holds a family of oversized empty eyelets above a small tracker demonstration bench."],
  ["S17", 144.5, "Gigaset", "A gabled felt telephone alcove frames a small real-scale cordless handset at the end of a warm domestic corridor."]
].map(([id, distance, name, feature]) => Object.freeze({id, distance, name, feature, direction:'On your left'})));

export function tramCaptionIndex(distance) {
  if (distance < 0 || distance >= tramRoute.length) return -1;
  let index = tramCaptions.length - 1;
  while (index >= 0 && distance < tramCaptions[index].distance) index--;
  return index;
}

export function tramEnabled(expanded, search) {
  // On by default in the expanded mall (owner decision, 2026-11-20); ?tram=0 turns it off.
  const flag = new URLSearchParams(search).get('tram');
  return expanded && flag !== '0' && flag !== 'off';
}

export function tramBoardReason(player) {
  if (player.pushing) return 'Stow the cart before boarding.';
  const product = player.character.physicalProduct;
  if (player.productApproaching || (product && product.phase !== 'empty')) {
    return 'Return the held product or add it to your bag before boarding.';
  }
  if (player.seated || player.elevatorTravel) return 'Finish your current action before boarding.';
  return '';
}

const idle = Object.freeze({phase:'idle', distance:0, caption:-1, active:false, seated:false, blocked:false});

export function createTramRide({blocked, canBoard, canExit, onBoard, onExit}) {
  let phase = 'idle', distance = 0, dwell = 0, obstructed = false;
  let paused = false, ending = false, skipped = -1, speedMultiplier = 1;
  const seated = () => phase === 'ride' || phase === 'arrival';
  function reset() {
    phase = 'idle';
    distance = dwell = 0;
    paused = ending = obstructed = false;
    skipped = -1;
  }
  function move(dt, limit) {
    const next = Math.min(limit, distance + dt * SPEED);
    obstructed = blocked(distance, Math.min(limit, next + LOOK_AHEAD));
    if (!obstructed) distance = next;
    return distance === limit;
  }
  return {
    board() {
      if (phase !== 'idle') return false;
      phase = 'approach';
      distance = -APPROACH;
      return true;
    },
    togglePause() {
      if (phase !== 'ride' || ending) return false;
      paused = !paused;
      return true;
    },
    skipShop() {
      const index = tramCaptionIndex(distance);
      if (phase !== 'ride' || ending || index < 0 || index === skipped) return false;
      skipped = index;
      return true;
    },
    end() {
      if (phase === 'approach' || phase === 'boarding') {
        reset();
        return true;
      }
      if (phase !== 'ride' || ending) return false;
      ending = true;
      paused = false;
      return true;
    },
    setSpeedMultiplier(value) { speedMultiplier = value; },
    step(dt) {
      if (phase === 'approach' && move(dt, 0)) {
        phase = 'boarding';
        dwell = DWELL;
      } else if (phase === 'boarding') {
        dwell -= dt;
        if (dwell <= 0 && canBoard()) {
          onBoard(tramRoute.sample(0));
          phase = 'ride';
        }
      } else if (phase === 'ride' && !paused && move(dt * speedMultiplier, tramRoute.length)) {
        phase = 'arrival';
        dwell = DWELL;
      } else if (phase === 'arrival') {
        dwell -= dt;
        if (dwell > 0) return;
        obstructed = !canExit();
        if (!obstructed) {
          onExit();
          reset();
        }
      }
    },
    get active() { return phase !== 'idle'; },
    get seated() { return seated(); },
    get distance() { return distance; },
    get state() {
      if (phase === 'idle') return idle;
      const index = tramCaptionIndex(distance);
      return {phase, distance, active:true, seated:seated(),
        paused, ending, blocked:obstructed, index,
        caption:ending || index === skipped ? -1 : index};
    }
  };
}

// Crowd avatars are top-level groups in the mall's visitor render layer.
// NPCs use movement queries but have no individual Rapier collider.
function someVisitor(scene, test) {
  return scene.children.some(node => node.isGroup && node.visible &&
    node.layers.mask === (1 << 2) && Math.abs(node.position.y) < 1.1 && test(node.position));
}

export function tramTrackBlocked(scene, visitor, from, to) {
  const steps = Math.max(1, Math.ceil((to - from) / .12));
  const poses = Array.from({length:steps + 1}, (_, i) => tramRoute.sample(from + (to - from) * i / steps));
  function overlaps(point) {
    const {width, length} = tramEnvelopes.car;
    return poses.some(({x, z, heading}) => {
      const dx = point.x - x, dz = point.z - z;
      const sin = Math.sin(heading), cos = Math.cos(heading);
      return Math.abs(dx * cos - dz * sin) <= width / 2 + VISITOR_RADIUS &&
        Math.abs(dx * sin + dz * cos) <= length / 2 + VISITOR_RADIUS;
    });
  }
  return (visitor && Math.abs(visitor.y - .89) < 1.1 && overlaps(visitor)) || someVisitor(scene, overlaps);
}

function landingOccupied(scene) {
  const {x, z} = tramStations.entry;
  return someVisitor(scene, p => Math.abs(p.x - x) < .6 + VISITOR_RADIUS &&
    p.z >= tramLanding.z - .6 - VISITOR_RADIUS && p.z <= z + VISITOR_RADIUS);
}

export function createPlayerTram({expanded, search, T, scene, getPosition, getBoardReason, clearPath, enterSeat, exitSeat, prepareModel, tier}) {
  if (!tramEnabled(expanded, search)) return null;
  const exit = {x:tramLanding.x, y:.91, z:tramLanding.z};
  const car = createTramCar(T, scene, prepareModel);
  void car.select(tier);
  const floor = .4025;
  const seat = {id:TRAM_STATION_ID, name:'Mall tram', floor, footY:floor, frontEdge:.20};
  const seatAt = distance => car.seatPose(tramRoute.sample(distance));
  let previousDistance = 0;
  function nearStation() {
    const p = getPosition();
    return Math.abs(p.y - .89) <= .5 && atTramLanding(p);
  }
  const ride = createTramRide({
    blocked: (from, to) => tramTrackBlocked(scene, ride.seated ? null : getPosition(), from, to),
    canBoard: () => !getBoardReason() && !landingOccupied(scene) && clearPath(getPosition(), {...seatAt(0), y:floor + .89}),
    canExit: () => !landingOccupied(scene) && clearPath(getPosition(), exit),
    onBoard: () => {
      const pose = seatAt(0);
      enterSeat(Object.assign(seat, pose), pose);
    },
    onExit: () => exitSeat(exit)
  });
  const controls = {
    get state() { return ride.state; },
    get reason() { return getBoardReason() || car.reason; },
    board() {
      if (controls.reason || !nearStation() || !ride.board()) return false;
      previousDistance = ride.distance;
      car.place(tramRoute.sample(ride.distance));
      return true;
    },
    setSpeedMultiplier: ride.setSpeedMultiplier,
    pause: ride.togglePause,
    skip: ride.skipShop,
    end() {
      if (!ride.end()) return false;
      if (!ride.active) car.mesh.visible = false;
      return true;
    }
  };
  return {
    controls, selectTier:car.select,
    get seated() { return ride.seated; },
    update(dt) {
      if (!ride.active) return null;
      previousDistance = ride.distance;
      if (!ride.seated && !nearStation()) controls.end();
      else ride.step(dt);
      if (!ride.active) {
        car.mesh.visible = false;
        return null;
      }
      return ride.seated ? seatAt(ride.distance) : null;
    },
    sync(alpha) {
      if (!ride.active) return null;
      const distance = previousDistance + (ride.distance - previousDistance) * alpha;
      car.place(tramRoute.sample(distance));
      car.mesh.visible = distance > -APPROACH;
      return distance;
    },
    visualSeat(target) { car.anchor.getWorldPosition(target); },
    dispose() { car.dispose(); }
  };
}
