import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FESTIVAL_CALENDAR, LUNAR_NEW_YEAR_DATES, lunarNewYearFromIntl, resolveAutoTheme,
} from '../demos/corporate/gjh/v11/assets/festival-calendar.js';

function localDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

test('the calendar resolves inclusive lead and tail dates across years', () => {
  const cases = [
    ['2026-09-26', 'everyday', '2026-11-08', 43],
    ['2026-09-27', 'deepavali', '2026-11-08', 42],
    ['2026-11-08', 'deepavali', '2026-11-08', 0],
    ['2026-11-09', 'deepavali', '2026-11-08', -1],
    ['2026-11-11', 'deepavali', '2026-11-08', -3],
    ['2026-11-12', 'everyday', '2026-12-25', 43],
    ['2026-11-13', 'christmas', '2026-12-25', 42],
    ['2026-11-19', 'christmas', '2026-12-25', 36],
    ['2026-12-25', 'christmas', '2026-12-25', 0],
    ['2026-12-26', 'lunar-new-year', '2027-02-06', 42],
    ['2026-12-31', 'lunar-new-year', '2027-02-06', 37],
    ['2027-01-05', 'lunar-new-year', '2027-02-06', 32],
    ['2027-01-10', 'lunar-new-year', '2027-02-06', 27],
    ['2027-02-09', 'lunar-new-year', '2027-02-06', -3],
    ['2027-02-10', 'everyday', '2027-10-29', 261],
    ['2027-03-01', 'everyday', '2027-10-29', 242],
    ['2028-02-29', 'everyday', '2028-10-17', 231],
    ['2036-11-10', 'everyday', '2036-12-25', 45],
  ];
  for (const [date, theme, festival, days] of cases) {
    const result = resolveAutoTheme(localDate(date));
    assert.deepEqual([result.theme, result.festival.date, result.daysToFestival], [theme, festival, days], date);
  }
  assert.deepEqual(resolveAutoTheme(localDate('2026-11-19')), {
    theme: 'christmas', festival: {theme: 'christmas', date: '2026-12-25'},
    start: '2026-11-13', end: '2026-12-28', daysToFestival: 36,
  });
});

test('overlapping configurable windows prefer the nearest upcoming occasion, then the latest tail', () => {
  const calendar = [
    {theme: 'first', dateForYear: year => `${year}-02-28`, leadDays: 2, tailDays: 7},
    {theme: 'second', dateForYear: year => `${year}-03-03`, leadDays: 7, tailDays: 1},
  ];
  assert.equal(resolveAutoTheme(localDate('2028-02-27'), calendar).theme, 'first');
  assert.deepEqual(resolveAutoTheme(localDate('2028-02-29'), calendar), {
    theme: 'second', festival: {theme: 'second', date: '2028-03-03'},
    start: '2028-02-25', end: '2028-03-04', daysToFestival: 3,
  });
  assert.equal(resolveAutoTheme(localDate('2028-03-04'), calendar).theme, 'second');
  assert.equal(resolveAutoTheme(localDate('2028-03-05'), calendar).theme, 'first');
  assert.deepEqual(resolveAutoTheme(localDate('2028-03-05'), []), {
    theme: 'everyday', festival: null, start: null, end: null, daysToFestival: null,
  });
});

test('midnight uses the local date even when UTC is still on the previous day', () => {
  const previousZone = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Singapore';
    assert.equal(resolveAutoTheme(new Date('2026-11-12T15:59:59Z')).theme, 'everyday');
    assert.equal(resolveAutoTheme(new Date('2026-11-12T16:00:00Z')).theme, 'christmas');
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test('published Lunar New Year dates agree with Intl apart from two known ICU differences', () => {
  const lunar = FESTIVAL_CALENDAR.find(festival => festival.theme === 'lunar-new-year');
  const icuDifferences = {2027: '2027-02-07', 2030: '2030-02-02'};
  for (const [year, expected] of Object.entries(LUNAR_NEW_YEAR_DATES)) {
    const actual = lunarNewYearFromIntl(Number(year));
    assert.ok(actual === expected || (Object.hasOwn(icuDifferences, year) && actual === icuDifferences[year]),
      `${year}: expected ${expected}, Intl returned ${actual}`);
    assert.equal(lunar.dateForYear(Number(year)), expected);
  }
});

test('missing Intl Chinese calendar uses the fallback table and skips unknown years', t => {
  const lunar = FESTIVAL_CALENDAR.find(festival => festival.theme === 'lunar-new-year');
  t.mock.method(Intl, 'DateTimeFormat', () => { throw new RangeError('Unsupported calendar'); });
  assert.equal(lunarNewYearFromIntl(2028), null);
  for (const [year, expected] of Object.entries(LUNAR_NEW_YEAR_DATES)) {
    assert.equal(lunar.dateForYear(Number(year)), expected);
  }
  assert.equal(lunar.dateForYear(2036), null);
});
