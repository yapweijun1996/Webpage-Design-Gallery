const DAY_MS = 86_400_000;
const DEFAULT_LEAD_DAYS = 42;
const DEFAULT_TAIL_DAYS = 3;
const isoDate = day => new Date(day * DAY_MS).toISOString().slice(0, 10);

// Published civil dates: https://www.hko.gov.hk/en/gts/time/conversion.htm
export const LUNAR_NEW_YEAR_DATES = Object.freeze({
  2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13',
  2030: '2030-02-03', 2031: '2031-01-23', 2032: '2032-02-11', 2033: '2033-01-31',
  2034: '2034-02-19', 2035: '2035-02-08',
});

// Lakshmi Puja: https://diwali.info/diwali-dates
// The 2034 date follows the Southern Deepavali observance documented in
// docs/gjh-v11-stage9-theme-infrastructure.md.
const DEEPAVALI_DATES = Object.freeze({
  2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17', 2029: '2029-11-05',
  2030: '2030-10-26', 2031: '2031-11-14', 2032: '2032-11-02', 2033: '2033-10-22',
  2034: '2034-11-09', 2035: '2035-10-30',
});

export function lunarNewYearFromIntl(year) {
  try {
    const format = new Intl.DateTimeFormat('en-u-ca-chinese', {
      month: 'numeric', day: 'numeric', timeZone: 'UTC',
    });
    if (format.resolvedOptions().calendar !== 'chinese') return null;
    for (let day = Date.UTC(year, 0, 20); day <= Date.UTC(year, 1, 21); day += DAY_MS) {
      const parts = format.formatToParts(day);
      if (parts.some(part => part.type === 'month' && part.value === '1') &&
          parts.some(part => part.type === 'day' && part.value === '1')) {
        return isoDate(day / DAY_MS);
      }
    }
  } catch { /* Some runtimes do not provide the Chinese calendar. */ }
  return null;
}

function lunarNewYear(year) {
  // ICU can differ by a day in these two years. Use the published local dates.
  if (year === 2027 || year === 2030) return LUNAR_NEW_YEAR_DATES[year];
  return lunarNewYearFromIntl(year) ?? LUNAR_NEW_YEAR_DATES[year] ?? null;
}

export const FESTIVAL_CALENDAR = Object.freeze([
  Object.freeze({theme: 'lunar-new-year', dateForYear: lunarNewYear}),
  Object.freeze({theme: 'christmas', dateForYear: year => `${year}-12-25`}),
  Object.freeze({theme: 'deepavali', dateForYear: year => DEEPAVALI_DATES[year]}),
]);

/** Choose a theme for the visitor's local civil day. Festival dates, start and
 * end are ISO civil dates with inclusive bounds. Everyday reports the next
 * known festival, if any. daysToFestival is signed during a festival's tail. */
export function resolveAutoTheme(date, calendar = FESTIVAL_CALENDAR) {
  const year = date.getFullYear();
  // Project the local date onto a day number so DST never changes the day count.
  const today = Date.UTC(year, date.getMonth(), date.getDate()) / DAY_MS;
  const festivals = [];
  for (const {theme, dateForYear, leadDays = DEFAULT_LEAD_DAYS, tailDays = DEFAULT_TAIL_DAYS} of calendar) {
    const firstYear = Math.min(year - 1, new Date((today - tailDays) * DAY_MS).getUTCFullYear());
    const lastYear = Math.max(year + 1, new Date((today + leadDays) * DAY_MS).getUTCFullYear());
    for (let festivalYear = firstYear; festivalYear <= lastYear; festivalYear++) {
      const date = dateForYear(festivalYear);
      if (!date) continue;
      const day = Date.parse(date) / DAY_MS;
      festivals.push({
        festival: {theme, date}, start: isoDate(day - leadDays), end: isoDate(day + tailDays),
        daysToFestival: day - today, inWindow: day - leadDays <= today && today <= day + tailDays,
      });
    }
  }
  festivals.sort((a, b) => a.daysToFestival - b.daysToFestival);
  const current = festivals.find(item => item.inWindow && item.daysToFestival >= 0) ??
    festivals.findLast(item => item.inWindow);
  const details = current ?? festivals.find(item => item.daysToFestival >= 0);
  return {
    theme: current?.festival.theme ?? 'everyday', festival: details?.festival ?? null,
    start: details?.start ?? null, end: details?.end ?? null, daysToFestival: details?.daysToFestival ?? null,
  };
}
