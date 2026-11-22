import assert from 'node:assert/strict';
import test from 'node:test';
import {tokenizeStyles} from './tokenize.mjs';

test('exact values, existing variables and priorities survive token migration', () => {
  const input = {
    'theme.css': ':root{--accent:#a52b40;--radius:3px}.card{box-shadow:7px 7px 0 var(--accent);border-radius:var(--radius);color:#fff!important}',
    'common.css': '/* Example: color: blue; */ @media(max-width:700px){h1{font:700 2rem/1.1 Georgia,serif;color:var(--accent)}}',
  };
  const {styles, tokens} = tokenizeStyles(input);
  assert.deepEqual(tokenizeStyles(Object.fromEntries(Object.entries(input).reverse())), {styles, tokens});
  assert.ok(Object.values(tokens).includes('7px'));
  assert.ok(Object.values(tokens).includes('700 2rem/1.1 Georgia,serif'));
  assert.match(styles['theme.css'], /box-shadow:var\(--pomelo-study[^)]+\) var\(--pomelo-study[^)]+\) var\(--pomelo-study[^)]+\) var\(--accent\)/);
  assert.match(styles['theme.css'], /border-radius:var\(--radius\)/);
  assert.match(styles['theme.css'], /color:var\(--pomelo-study[^)]+\)!important/);
  assert.match(styles['common.css'], /\/\* Example: color: blue; \*\/ @media\(max-width:700px\)/);
  for (const value of Object.values(tokens)) assert.doesNotMatch(value, /var\(/);
});
