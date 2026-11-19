import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {expandedStoreAt, plannedSpaces} from '../demos/corporate/gjh/v11/assets/expanded-layout.js';
import {installShopInteractions} from '../demos/corporate/gjh/v11/assets/interiors/shop-interactions.js';
import {createInteractionRegistry} from '../demos/corporate/gjh/v11/assets/interaction-registry.js';

async function setup() {
  const meshes = [], entries = [], messages = [];
  const registry = createInteractionRegistry(entries);
  const targets = await installShopInteractions(T,{add:mesh => meshes.push(mesh)},registry,m => messages.push(m));
  function focus(target, camera = 'first-person') {
    const position = {...target.standing,y:target.floor};
    const zone = expandedStoreAt(position.x,position.z).id;
    const context = {zone,player:{camera}};
    let {item} = registry.nearest(position,context);
    for (let i=0; item?.id !== target.id && i<2; i++) {
      assert(registry.cycle(1),target.id);
      item = registry.nearest(position,context).item;
    }
    assert.equal(item.id,target.id);
    return item;
  }
  return {meshes,entries,messages,registry,targets,focus};
}

test('no-browser showroom installation and dispatch in all real zones and both camera views', async () => {
  const {meshes,entries,messages,registry,targets,focus} = await setup();
  assert.equal(meshes.length,0);
  for (const {id:zone} of plannedSpaces) {
    const actions = targets.filter(t => t.shopAction.zone === zone);
    assert(actions.length >= 2 && actions.length <= 3,zone);
    for (const [index,target] of actions.entries()) {
      for (const other of actions.slice(index+1)) {
        assert(Math.hypot(target.standing.x-other.standing.x,target.standing.z-other.standing.z)>=.45,target.id);
      }
      const position = {...target.standing,y:target.floor};
      const story = {id:target.id+'-story',...target.standing,floor:target.floor,radius:.9};
      entries.push(story);
      for (const camera of ['first-person','third-person']) {
        registry.nearest({x:0,z:0},{zone:'atrium'});
        assert.equal(registry.nearest(position,{zone}).item.id,story.id);
        const item = focus(target,camera);
        assert(item.shopAction.name && item.shopAction.label && item.shopAction.done);
        assert(registry.dispatch(item));
        registry.advanceShopActions(zone,.1);
        const [mesh] = meshes;
        assert(mesh.visible && !mesh.castShadow);
        assert(mesh.geometry.index.count/3 <= 300);
        assert(mesh.position.toArray().every(Number.isFinite));
        assert.equal(meshes.length,1);
        assert(registry.advanceShopActions(zone,1));
        assert.equal(messages.at(-1),target.shopAction.done);
        assert.equal(registry.advanceShopActions(zone,.01),false);
      }
      entries.pop();
    }
  }
});

test('audio starts on activation, supports mute in both shops and stops on cancellation', async t => {
  const starts = [], stops = [];
  const param = {setValueAtTime() {},linearRampToValueAtTime() {},exponentialRampToValueAtTime() {}};
  class AudioStub {
    currentTime = 0;
    createOscillator() {
      return {frequency:param,connect() {},disconnect() {},start:time=>starts.push(time),stop:time=>stops.push(time)};
    }
    createGain() { return {gain:param,connect() {},disconnect() {}}; }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis,'AudioContext');
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:AudioStub});
  t.after(() => {
    if (original) Object.defineProperty(globalThis,'AudioContext',original);
    else delete globalThis.AudioContext;
  });
  const {registry,targets,focus} = await setup();
  function activate(id,complete=true) {
    const item = focus(targets.find(target => target.id === id));
    assert(registry.dispatch(item));
    if (complete) registry.advanceShopActions(item.shopAction.zone,1);
  }
  assert.equal(starts.length,0);
  activate('S15-focal',false);
  assert.equal(starts.length,1);
  registry.advanceShopActions('atrium',.1);
  assert.equal(stops.at(-1),undefined);
  assert.equal(registry.shopState('S15-focal').phase,'cancelled');
  activate('S13-leftfront');
  activate('S15-leftfront');
  activate('S13-onleft');
  assert.equal(starts.length,1);
  activate('S15-pianoback');
  activate('S13-focal');
  assert.equal(starts.length,2);
});
