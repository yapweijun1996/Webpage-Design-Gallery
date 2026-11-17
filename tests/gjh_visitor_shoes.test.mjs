import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../demos/corporate/gjh/v11/vendor/three.module.min.js';
import {createVisitorCustomization} from '../demos/corporate/gjh/v11/assets/visitor-v2-customization.js';
import {installVisitorV2Controls, readVisitorAppearance, saveVisitorAppearance} from '../demos/corporate/gjh/v11/assets/visitor-v2-controls.js';

const assets = new URL('../demos/corporate/gjh/v11/assets/', import.meta.url);
function glbJson(name) {
  const data = readFileSync(new URL(name, assets));
  return JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
}

test('both visitor LODs contain the same skinned shoe material component', () => {
  for (const file of ['gjh-mall-visitor-v2.glb', 'gjh-mall-visitor-v2-lod1.glb']) {
    const gltf = glbJson(file);
    const shoe = gltf.nodes.find(node => node.name === 'V2_shoes_Cream white');
    assert.ok(shoe && shoe.skin !== undefined);
    assert.equal(gltf.materials[gltf.meshes[shoe.mesh].primitives[0].material].name, 'Cream white');
  }
});

test('shoe colours are per-instance, survive animation and geometry changes, and dispose cleanly', () => {
  const root = new T.Group();
  const shared = new T.MeshStandardMaterial({color: 0xeeddcc});
  for (const name of ['V2_hair_main', 'V2_hair_alt_main', 'V2_outfit_GJH_main', 'V2_outfit_alt_main', 'V2_body_Warm_peach_skin', 'V2_glasses_main', 'V2_backpack_main', 'V2_watch_main', 'V2_shoes_Cream white']) {
    const mesh = new T.Mesh(new T.BufferGeometry(), shared); mesh.name = name; root.add(mesh);
  }
  const shoe = root.getObjectByName('V2_shoes_Cream white');
  const customization = createVisitorCustomization(root);
  const mixer = new T.AnimationMixer(root);
  const clip = new T.AnimationClip('walk', 1, [new T.NumberKeyframeTrack('.position[x]', [0, 1], [0, 1])]);
  mixer.clipAction(clip).play();
  for (const [choice, color] of [['black', 0x292c31], ['brown', 0x805b43], ['cream', 0xeeddcc]]) {
    customization.apply({shoes: choice});
    mixer.update(0.25);
    shoe.geometry = new T.BufferGeometry();
    assert.equal(shoe.material.color.getHex(), color);
    assert.equal(customization.state.shoes, choice);
    assert.equal(shared.color.getHex(), 0xeeddcc);
  }
  assert.throws(() => customization.apply({shoes: 'unknown'}), TypeError);
  customization.dispose();
  assert.equal(shoe.material, shared);
});

test('appearance storage tolerates unavailable and malformed data and restores valid fields', () => {
  let data = '{broken';
  const store = {getItem: () => data, setItem: (_key, value) => { data = value; }};
  const getStore = () => store;
  assert.deepEqual(readVisitorAppearance(getStore), {});
  data = JSON.stringify({shoes: 'black', hair: 'invalid', glasses: false, backpack: 'false'});
  assert.deepEqual(readVisitorAppearance(getStore), {shoes: 'black', glasses: false});
  saveVisitorAppearance({shoes: 'brown', glasses: true}, getStore);
  assert.deepEqual(readVisitorAppearance(getStore), {shoes: 'brown', glasses: true});
  const unavailable = () => { throw new Error('storage blocked'); };
  assert.deepEqual(readVisitorAppearance(unavailable), {});
  assert.doesNotThrow(() => saveVisitorAppearance({shoes: 'black'}, unavailable));
});

test('controls restore saved values to the visitor and select, then persist changes', () => {
  const previous = {document: globalThis.document, Option: globalThis.Option, localStorage: globalThis.localStorage, requestAnimationFrame: globalThis.requestAnimationFrame};
  let data = JSON.stringify({shoes: 'black', glasses: false});
  class Element {
    constructor() { this.children = []; this.listeners = {}; this.value = ''; }
    append(...children) { this.children.push(...children); }
    add(option) { this.children.push(option); if (this.children.length === 1) this.value = option.value; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
  }
  try {
    globalThis.document = {createElement: () => new Element(), activeElement: null};
    globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
    globalThis.localStorage = {getItem: () => data, setItem: (_key, value) => { data = value; }};
    const parent = new Element(), calls = [];
    installVisitorV2Controls(parent, value => calls.push(value));
    const selects = parent.children[0].children.flatMap(label => label.children || []).filter(element => element.name);
    const shoes = selects.find(select => select.name === 'shoes');
    assert.deepEqual(calls[0], {shoes: 'black', glasses: false});
    assert.equal(shoes.value, 'black');
    assert.equal(selects.find(select => select.name === 'glasses').value, 'false');
    shoes.value = 'brown';
    globalThis.requestAnimationFrame = () => {};
    shoes.listeners.change();
    assert.deepEqual(calls[1], {shoes: 'brown'});
    assert.deepEqual(JSON.parse(data), {shoes: 'brown', glasses: false});
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
