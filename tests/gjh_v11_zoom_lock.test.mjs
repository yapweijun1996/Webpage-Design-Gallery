import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['index.html', 'offline.html']) {
  test(`v11 ${file} locks viewport zoom`, () => {
    const html = readFileSync(new URL(`../demos/corporate/gjh/v11/${file}`, import.meta.url), 'utf8');
    const content = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
    assert.match(content, /initial-scale=1/);
    assert.match(content, /maximum-scale=1/);
    assert.match(content, /user-scalable=no/);
  });
}
