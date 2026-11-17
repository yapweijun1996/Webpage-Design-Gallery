import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialHud} from '../demos/corporate/gjh/v11/assets/ux-spatial-hud.js';
import {createInteractionRegistry} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';
import {mapPoint} from '../demos/corporate/gjh/v11/assets/spatial.js';
import {expandedMapPoint} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';

class Element {
  constructor(attributes = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.hidden = false;
    this.textContent = '';
    this.classList = {add: name => this.setAttribute('class', `${this.getAttribute('class') || ''} ${name}`.trim())};
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  getAttributeNames() { return [...this.attributes.keys()]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    return selector === '[id]' ? descendants.filter(child => child.getAttribute('id') !== null) : descendants;
  }
  querySelector(selector) { return this.querySelectorAll('*').find(child => child.getAttribute('id') === selector.slice(1)) || null; }
  cloneNode() {
    const clone = new Element(Object.fromEntries(this.attributes));
    clone.children = this.children.map(child => child.cloneNode(true));
    return clone;
  }
}

function fixture(expanded = false) {
  const elements = Object.fromEntries(['floor-indicator', 'nearest-target', 'control-interact', 'mini-map', 'mini-map-plan']
    .map(id => [id, new Element({id})]));
  const source = new Element({class:'floorplan', viewBox:expanded ? '0 0 700 600' : '0 0 300 290'});
  const service = new Element({id:'map-service', 'data-service':'directory'});
  service.append(new Element({id:'service-label'}));
  source.append(service, new Element({id:'player-dot', r:expanded ? '10' : '6'}));
  const root = {getElementById:id => elements[id], querySelector:() => source,
    createElementNS:() => new Element(), createElement:() => new Element()};
  const hud = createSpatialHud({expanded, root});
  const [map, context] = elements['mini-map-plan'].children;
  const dot = map.children.find(child => child.getAttribute('class') === 'mini-map-player');
  const heading = map.children.find(child => child.getAttribute('class') === 'mini-map-heading');
  return {hud, elements, map, dot, heading, context};
}

for (const expanded of [false, true]) {
  test(`${expanded ? 'expanded' : 'classic'} map projects player position and heading`, () => {
    const f = fixture(expanded);
    assert.equal(f.elements['control-interact'].hidden, true);
    const position = {x:10, z:12, yaw:Math.PI / 2};
    f.hud.update({position});
    const point = expanded ? expandedMapPoint(10, 12) : mapPoint(10, 12);
    assert.equal(f.dot.getAttribute('cx'), String(point.x));
    assert.equal(f.dot.getAttribute('cy'), String(point.y));
    assert.equal(f.heading.getAttribute('transform'), `translate(${point.x} ${point.y}) rotate(-90)`);
    f.hud.update({position:{x:-10,z:-5,yaw:0}, zone:'newmoon'});
    assert.equal(f.elements['floor-indicator'].textContent, 'Floor 01 - Atrium · New Moon');
  });
}

test('upper-floor and travelling labels never misrepresent the ground-floor player position', () => {
  const f = fixture(true);
  f.hud.update({position:{x:10,z:12}, zone:'upper'});
  assert.equal(f.elements['floor-indicator'].textContent, 'Floor 02 - Upper Level');
  assert.equal(f.elements['mini-map'].dataset.floor, '02');
  assert.equal(f.dot.style.display, 'none');
  assert.equal(f.heading.style.display, 'none');
  assert.equal(f.context.textContent, 'Ground-floor plan · You are on Floor 02');
  f.hud.update({position:{x:10,z:12}, travelling:true});
  assert.equal(f.context.textContent, 'Ground-floor plan · Lift in transit');
  assert.equal(f.dot.style.display, 'none');
  f.hud.update({position:{x:10,z:12}});
  assert.equal(f.dot.style.display, '');
  assert.equal(f.heading.style.display, '');
});

test('F hint follows only usable registry selection during active exploration', () => {
  const f = fixture();
  let available = true;
  const registry = createInteractionRegistry([{id:'kiosk',x:0,z:0,radius:2,
    availability:() => available}]);
  function update(position, changes = {}) {
    const selection = registry.nearest(position, {travelling:Boolean(changes.travelling)});
    f.hud.update({position, interaction:selection.item, distance:selection.distance,
      targetLabel:'Directory kiosk', active:true, ...changes});
  }
  update({x:1,z:0});
  assert.equal(f.elements['control-interact'].hidden, false);
  assert.equal(f.elements['nearest-target'].textContent, 'Nearest: Directory kiosk · 1.0 m');
  assert.equal(f.elements['nearest-target'].hidden, false);
  for (const changes of [{active:false}, {usable:false}, {travelling:true}]) {
    update({x:1,z:0}, changes);
    assert.equal(f.elements['control-interact'].hidden, true);
    assert.equal(f.elements['nearest-target'].hidden, true);
  }
  update({x:4,z:0});
  assert.equal(f.elements['control-interact'].hidden, true);
  available = false;
  update({x:1,z:0});
  assert.equal(f.elements['control-interact'].hidden, true);
  available = true;
  update({x:1,z:0});
  f.hud.suspend();
  assert.equal(f.elements['control-interact'].hidden, true);
  assert.equal(f.elements['nearest-target'].hidden, true);
});
