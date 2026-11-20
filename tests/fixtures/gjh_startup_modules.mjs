// Supply a small scene and the hardware boundaries. Keep the loader, generated
// entry bundle, its bundled UI and the transfer implementations under test.
const stubs = {
  '/vendor/rapier.mjs': `
    export default {
      async init(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length !== 3082103) throw Error('Expected Rapier bytes');
      },
      World: class { step() {} }
    };
  `,
  '/vendor/three.module.min.js': `
    export * from './three.module.min.js?real';
    export class PMREMGenerator {
      dispose() {}
      fromScene() { return {texture: {}, dispose() {}}; }
    }
    export class WebGLRenderer {
      debug = {};
      shadowMap = {};
      capabilities = {getMaxAnisotropy: () => 1};
      info = {render: {}, reset() {this.render.calls = this.render.triangles = 0;}};
      constructor({context}) {this.context = context;}
      getContext() {return this.context;}
      getPixelRatio() {return 1;}
      setDrawingBufferSize() {}
      getRenderTarget() {return null;}
      getClearAlpha() {return 1;}
      getClearColor(color) {return color;}
      setClearColor() {}
      setRenderTarget() {}
      render() {this.info.render.calls++;}
    }
  `,
  '/assets/world.bundle.js': `
    export async function createWorld(T) {
      return {scene: new T.Scene(), interactables: [], doors: [], seats: [],
        cameraObstacles: [], shelves: [], shopExhibits: {}, applyMallTheme: () => true,
        updateShopLods() {}, updateSigns() {}, prepareUpperLevel() {},
        drawWithPlayerContact(shadow, draw) {draw();}};
    }
  `,
  '/assets/player.bundle.js': `
    export async function createPlayer(T) {
      return {camera: new T.PerspectiveCamera(),
        state: {x: 0, y: 0, z: 0, character: {cart: {}, collection: {}}},
        teleport() {}, setBagCount() {}, setPaused() {}, resizeCamera() {}, updateCamera() {},
        cartCapability: () => ({}), clearInput() {}, setInput() {}, resetInterpolation() {},
        cancelCollection() {}, refreshCameraMode() {}, update() {}};
    }
  `,
  '/assets/elevator-v2.js': `
    export function createElevatorV2() {return {interactables: []};}
  `,
};

export async function load(url, context, nextLoad) {
  const source = Object.entries(stubs).find(([path]) => url.endsWith('/gjh/v11' + path))?.[1];
  if (source) return {format: 'module', source, shortCircuit: true};
  return nextLoad(url, context);
}
