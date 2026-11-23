import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {brandPlaqueMessages} from '../demos/corporate/gjh/v11/assets/brand-plaque-copy.js';

const kit = JSON.parse(readFileSync(new URL('../demos/corporate/gjh/v11/assets/brand-kit/brand-kit.json', import.meta.url)));
const records = Object.values(kit);
const phrases = {
  S01: ['425'], S02: ['510'], S03: ['potong'], S04: ['18'], S05: [], S06: ['70'],
  S07: ['397'], S08: ['500'], S09: ['340'], S10: ['454'], S11: [], S12: ['150', 'Chondro Support'],
  S13: ['MDR-E9LP', 'GJH'], S14: ['UR75', '43', '4K'], S15: ['GP-510BP', 'CELVIANO Grand Hybrid'],
  S16: ['eTag'], S17: ['A270'],
};

test('the installed upper gallery localizes the title, story and accessible logo for every slot', () => {
  assert.deepEqual(records.map(record => record.slot), Object.keys(phrases));
  const translations = new Map(Array.from(brandPlaqueMessages(records), ([source, zh, ms]) =>
    [source, {'zh-Hans': zh, ms}]));
  const display = (source, language) => translations.get(source)?.[language] ?? source;
  for (const {slot, brand, tagline, story} of records) {
    const original = [tagline, brand + ' · ' + tagline, story, brand + ' logo'];
    for (const language of ['en', 'zh-Hans', 'ms', 'zh-Hans', 'en']) {
      const fields = original.map(source => display(source, language));
      if (language === 'en') {
        assert.deepEqual(fields, original);
      } else {
        fields.forEach((field, i) => assert.notEqual(field, original[i], slot + '/' + language));
        assert.equal(fields[1], brand + ' · ' + fields[0]);
        assert.equal(fields[3], language === 'ms' ? 'Logo ' + brand : brand + ' 标志');
        for (const phrase of phrases[slot]) assert.ok(fields[2].includes(phrase), slot + '/' + language + ': ' + phrase);
      }
    }
  }
  assert.equal(translations.size, records.length * 4);
});
