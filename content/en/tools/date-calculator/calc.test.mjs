import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, addMonths, breakdown } from './calc.js';
import { addDays, weekdayIndex } from '../../../lib/dates.js';

const between = (start, end, includeEnd = 'no') => calculate({ mode: 'between', start, end, includeEnd });
const add = (start, o = {}) => calculate({ mode: 'add', start, years: 0, months: 0, weeks: 0, days: 0, ...o });
const val = (r, label) => r.items.find((i) => i.label.startsWith(label)).value;

test('Known span: 2026-01-01 to 2026-12-31 is 364 days, 365 including the end date', () => {
  const r = between('2026-01-01', '2026-12-31');
  assert.equal(r.items[0].value, 364);
  assert.equal(val(r, 'In weeks'), '52 weeks and 0 days');
  assert.equal(between('2026-01-01', '2026-12-31', 'yes').items[0].value, 365);
});

test('Leap years: 2024 has 366 days, 2100 is not a leap year, 2000 is', () => {
  assert.equal(between('2024-01-01', '2024-12-31', 'yes').items[0].value, 366);
  assert.equal(between('2100-01-01', '2100-12-31', 'yes').items[0].value, 365);
  assert.equal(between('2000-01-01', '2000-12-31', 'yes').items[0].value, 366);
  assert.equal(between('2024-02-28', '2024-03-01').items[0].value, 2);
  assert.equal(between('2025-02-28', '2025-03-01').items[0].value, 1);
});

test('Swapped dates give the same count and a note', () => {
  const a = between('2026-12-31', '2026-01-01');
  assert.equal(a.items[0].value, 364);
  assert.ok(a.notes.some((n) => n.includes('swapped')));
  assert.ok(!between('2026-01-01', '2026-12-31').notes.some((n) => n.includes('swapped')));
});

test('Same day: 0 days, or 1 when the end date is included', () => {
  const r = between('2026-10-12', '2026-10-12');
  assert.equal(r.items[0].value, 0);
  assert.equal(val(r, 'Weekdays'), 0);
  const inc = between('2026-10-12', '2026-10-12', 'yes');
  assert.equal(inc.items[0].value, 1);
  assert.equal(val(inc, 'Weekdays'), 1); // Monday
});

test('Weekday and weekend counts match a brute-force count', () => {
  const starts = ['2026-10-12', '2024-02-27', '2023-12-30', '2026-01-01', '2000-02-29'];
  for (const s of starts) {
    for (const len of [0, 1, 2, 5, 6, 7, 8, 13, 30, 100, 366, 1000]) {
      for (const inc of ['no', 'yes']) {
        const end = addDays(s, len);
        const r = between(s, end, inc);
        let wd = 0;
        let total = 0;
        for (let k = inc === 'yes' ? 0 : 1; k <= len; k++) {
          const dow = weekdayIndex(addDays(s, k));
          total++;
          if (dow !== 0 && dow !== 6) wd++;
        }
        assert.equal(r.items[0].value, total, `${s} +${len} ${inc}`);
        assert.equal(val(r, 'Weekdays'), wd, `${s} +${len} ${inc} weekdays`);
        assert.equal(val(r, 'Weekend'), total - wd, `${s} +${len} ${inc} weekend`);
      }
    }
  }
});

test('Years, months and days breakdown', () => {
  assert.deepEqual(breakdown('2026-01-01', '2026-12-31'), { years: 0, months: 11, days: 30 });
  assert.deepEqual(breakdown('2020-02-29', '2026-10-12'), { years: 6, months: 7, days: 13 });
  assert.deepEqual(breakdown('2026-01-31', '2026-02-28'), { years: 0, months: 0, days: 28 });
  assert.deepEqual(breakdown('2024-05-10', '2025-05-10'), { years: 1, months: 0, days: 0 });
});

test('Adding months clamps to the last day of the month', () => {
  assert.equal(add('2024-01-31', { months: 1 }).items[0].value, 'Thursday, February 29, 2024');
  assert.equal(add('2025-01-31', { months: 1 }).items[0].value, 'Friday, February 28, 2025');
  assert.equal(add('2026-03-31', { months: -1 }).items[0].value, 'Saturday, February 28, 2026');
  assert.equal(add('2026-08-31', { months: 1 }).items[0].value, 'Wednesday, September 30, 2026');
  assert.equal(add('2024-02-29', { years: 1 }).items[0].value, 'Friday, February 28, 2025');
  assert.ok(add('2025-01-31', { months: 1 }).notes.some((n) => n.includes('last day')));
  assert.ok(!add('2025-01-15', { months: 1 }).notes.some((n) => n.includes('last day')));
  assert.equal(addMonths('2026-01-31', 13), '2027-02-28');
});

test('Adding and subtracting days, weeks, months and years', () => {
  const r = add('2026-10-12', { days: 30 });
  assert.equal(r.items[0].value, 'Wednesday, November 11, 2026');
  assert.equal(val(r, 'Day of the week'), 'Wednesday');
  assert.equal(val(r, 'Total days'), 30);
  assert.equal(add('2026-10-12', { weeks: 2, days: 1 }).items[0].value, 'Tuesday, October 27, 2026');
  assert.equal(add('2026-10-12', { days: -12 }).items[0].value, 'Wednesday, September 30, 2026');
  assert.equal(add('2026-10-12', { years: -1, months: 2, days: 3 }).items[0].value, 'Monday, December 15, 2025');
  assert.equal(val(add('2024-01-01', { years: 1 }), 'Total days'), 366);
  assert.equal(val(add('2026-10-12', {}), 'Total days'), 0);
});

test('Range limits are enforced', () => {
  assert.ok(add('9999-12-31', { days: 1 }).error);
  assert.equal(add('9999-12-31', { days: -1 }).items[0].value, 'Thursday, December 30, 9999');
  assert.ok(add('1000-01-01', { days: -1 }).error);
  assert.ok(add('2026-01-01', { years: 8000 }).error);
  assert.ok(add('2026-01-01', { years: 1e9 }).error);
  assert.ok(between('0999-12-31', '2026-01-01').error);
  assert.ok(between('2026-01-01', '2026-01-01').items);
});

test('Invalid inputs return an error instead of NaN', () => {
  assert.ok(calculate({ mode: 'between', start: '', end: '2026-01-01' }).error);
  assert.ok(calculate({ mode: 'between', start: '2026-02-30', end: '2026-03-01' }).error);
  assert.ok(calculate({ mode: 'between', start: '2026-01-01', end: 'abc' }).error);
  assert.ok(add('2026-01-01', { days: NaN }).error);
  assert.ok(add('2026-01-01', { months: 1.5 }).error);
  assert.ok(add('2026-01-01', { weeks: Infinity }).error);
  assert.ok(calculate({ mode: 'other', start: '2026-01-01' }).error);
  assert.ok(calculate({}).error);
});
