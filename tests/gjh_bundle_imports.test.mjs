import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = new URL('../demos/corporate/gjh/v11/', import.meta.url);
const bundles = ['script.bundle.js', ...readdirSync(new URL('assets/', root))
  .filter(name => name.endsWith('.bundle.js')).map(name => `assets/${name}`)];

// Use Node's bundled parser so the tests need no npm install or Bun compiler.
if (process.execArgv.includes('--expose-internals')) {
  const require = createRequire(import.meta.url);
  const {parse} = require('internal/deps/acorn/acorn/dist/acorn');
  const {simple} = require('internal/deps/acorn/acorn-walk/dist/walk');
  const threePaths = new Set(['./vendor/three.module.min.js', '../vendor/three.module.min.js']);
  const problems = [];

  for (const name of bundles) {
    const url = new URL(name, root);
    const ast = parse(readFileSync(url, 'utf8'), {ecmaVersion: 'latest', sourceType: 'module'});
    const specifiers = new Set();
    const add = ({source}) => { if (source) specifiers.add(source.value); };
    simple(ast, {
      ImportDeclaration: add,
      ExportNamedDeclaration: add,
      ExportAllDeclaration: add,
      ImportExpression({source}) {
        if (source.type === 'Literal' && typeof source.value === 'string') {
          specifiers.add(source.value);
          return;
        }
        // Seasonal imports append a retry query to a fixed module path.
        assert.ok(source.type === 'TemplateLiteral' && (source.expressions.length === 0 ||
          (source.expressions.length === 1 && source.expressions[0].name === 'query' &&
            source.quasis[1].value.cooked === '')), `${name} has a non-static module path`);
        specifiers.add(source.quasis[0].value.cooked);
      },
    });
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
} else {
  test('all v11 startup bundle imports resolve', () => {
    const env = {...process.env};
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--expose-internals', fileURLToPath(import.meta.url)], {env, encoding: 'utf8'});
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  });
}
