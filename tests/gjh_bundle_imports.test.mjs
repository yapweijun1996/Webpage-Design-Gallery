import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = new URL('../demos/corporate/gjh/v11/', import.meta.url);
const bundles = ['script.bundle.js', ...readdirSync(new URL('assets/', root))
  .filter(name => name.endsWith('.bundle.js')).map(name => `assets/${name}`)];
const lazyConsumers = [...bundles, 'assets/loader.js', 'assets/npcs.js', 'assets/tram-car.js',
  'assets/original-tin.js', 'assets/interiors/config.js', 'assets/newmoon-detail-preview.js'];
const startupExports = {
  'assets/audio.js': ['mallAudio.subscribe', 'mallAudio.prepareForLoader'],
  'assets/startup-physics.js': ['startPhysics', 'physicsBytes:number'],
  'assets/startup-asset-pack.js': ['startStartupPack', 'releaseStartupAssetPack', 'startupPackBytes:number'],
};
const lazyExports = {
  'assets/brand-wall.js': ['addBrandWallAtlas'],
  'assets/carry-bag.js': ['createCarryBag'],
  'assets/character-tripo.js': ['createCharacterTripo'],
  'assets/character-v2.bundle.js': ['createCharacterV2'],
  'assets/christmas.js': ['prepareChristmasDecor'],
  'assets/collection-gesture.js': ['createCollectionGesture'],
  'assets/crowd.js': ['loadModularLooks'],
  'assets/deepavali.js': ['prepareDeepavaliDecor'],
  'assets/dom-projection.js': ['createDOMProjection'],
  'assets/elevator-v2.js': ['createElevatorV2'],
  'assets/interiors/action-layout.js': ['actionsBySlot:object'],
  'assets/interiors/shop-interactions.js': ['installShopInteractions'],
  'assets/lunar-new-year.js': ['prepareLunarDecor'],
  'assets/mall-themes.js': ['createMallThemeCoordinator'],
  'assets/natural-materials.js': ['createNaturalSurfaceTextures'],
  'assets/npcs.js': ['createNpcSystem', 'loadNpcSystem'],
  'assets/player.bundle.js': ['createPlayer'],
  'assets/products.js': ['NEW_MOON_CANS:array', 'addProducts'],
  'assets/push-cart.js': ['createLazyCart'],
  'assets/seated-pose.js': ['createSeatedPose'],
  'assets/shelf-focus.js': ['createShelfFocus'],
  'assets/target-guidance.js': ['createTargetGuidance'],
  'assets/visitor-gltf.js': ['loadVisitorGLTF', 'disposeVisitorScene'],
  'assets/visitor-v2-controls.js': ['installVisitorV2Controls'],
  'assets/visitor-v2-product-ui.js': ['installPhysicalProductControl'],
  'assets/world.bundle.js': ['createWorld'],
  'script.bundle.js': [], // The route imports for side effects, exercised by the startup smoke.
  'vendor/GLTFLoader.js': ['GLTFLoader'],
  'vendor/rapier.mjs': ['default.init', 'default.World'],
  'vendor/three.module.min.js': ['WebGLRenderer', 'Scene', 'Vector3'],
};

// Bun can turn a dynamic import into a promise of an internal namespace.
const inlineExports = {};

// Use Node's bundled parser so the tests need no npm install or Bun compiler.
if (process.execArgv.includes('--expose-internals')) {
  const require = createRequire(import.meta.url);
  const {parse} = require('internal/deps/acorn/acorn/dist/acorn');
  const {simple} = require('internal/deps/acorn/acorn-walk/dist/walk');
  const threePaths = new Set(['./vendor/three.module.min.js', '../vendor/three.module.min.js']);
  const problems = [];
  const lazyPaths = new Set();
  const inlinePaths = new Set();

  for (const name of lazyConsumers) {
    const url = new URL(name, root);
    const ast = parse(readFileSync(url, 'utf8'), {ecmaVersion: 'latest', sourceType: 'module'});
    const specifiers = new Set();
    const namespaces = new Map();
    const inlineImports = new Set();
    const add = ({source}) => { if (source) specifiers.add(source.value); };
    simple(ast, {
      ImportDeclaration: add,
      ExportNamedDeclaration: add,
      ExportAllDeclaration: add,
      ImportExpression({source}) {
        let path = source.value;
        if (source.type !== 'Literal' || typeof path !== 'string') {
          // Seasonal imports append a retry query to a fixed module path.
          assert.ok(source.type === 'TemplateLiteral' && (source.expressions.length === 0 ||
            (source.expressions.length === 1 && source.expressions[0].name === 'query' &&
              source.quasis[1].value.cooked === '')), `${name} has a non-static module path`);
          path = source.quasis[0].value.cooked;
        }
        specifiers.add(path);
        const resolved = new URL(path, url);
        assert.ok(resolved.href.startsWith(root.href), `${name} imports ${path} outside V11`);
        lazyPaths.add(resolved.href.slice(root.href.length));
      },
      CallExpression({callee, arguments: args}) {
        if (callee.name === '__export') {
          namespaces.set(args[0].name, new Set(args[1].properties.map(({key}) => key.name ?? key.value)));
        }
        if (callee.property?.name !== 'then' || callee.object?.callee?.object?.name !== 'Promise' ||
            callee.object.callee.property?.name !== 'resolve') return;
        const body = args[0]?.body;
        const result = body?.type === 'SequenceExpression' ? body.expressions.at(-1) : body;
        if (result?.name?.startsWith('exports_')) inlineImports.add(result.name);
      },
    });
    for (const namespace of inlineImports) {
      assert.ok(Object.hasOwn(inlineExports, namespace), `${name} has an unchecked lazy namespace ${namespace}`);
      const [, ...keys] = inlineExports[namespace];
      for (const key of keys) assert.ok(namespaces.get(namespace)?.has(key), `${name} ${namespace} lacks ${key}`);
      inlinePaths.add(namespace);
    }
    for (const specifier of specifiers) {
      if (specifier.endsWith('three.module.min.js') && !threePaths.has(specifier)) {
        problems.push(`${name}: unexpected Three.js path ${specifier}`);
      }
      if (/^\.\.?\//.test(specifier) && !statSync(new URL(specifier, url), {throwIfNoEntry: false})?.isFile()) {
        problems.push(`${name}: missing module ${specifier}`);
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.deepEqual([...lazyPaths].sort(), Object.keys(lazyExports).sort());
  assert.deepEqual([...inlinePaths].sort(), Object.keys(inlineExports).sort());

  globalThis.location = new URL('https://mall.test/');
  const contracts = [...Object.entries({...startupExports, ...lazyExports}),
    ...Object.values(inlineExports).map(([path, ...keys]) => [path, keys])];
  for (const [path, keys] of contracts) {
    if (!keys.length) continue;
    const module = await import(new URL(path, root));
    for (const contract of keys) {
      const [key, expected = 'function'] = contract.split(':');
      const value = key.split('.').reduce((object, member) => object?.[member], module);
      const shape = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
      assert.equal(shape, expected, `${path} must resolve with ${key} as ${expected}`);
    }
  }
} else {
  test('all v11 startup bundle imports resolve with the shapes their consumers expect', () => {
    const env = {...process.env};
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--expose-internals', fileURLToPath(import.meta.url)], {env, encoding: 'utf8'});
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  });
}
