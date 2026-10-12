import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffDays, weekdayIndex, WEEKDAYS_EN } from '../../../lib/dates.js';
import { calculate, ymd } from './calc.js';

const item = (r, label) => r.items.find((i) => i.label === label);

test('Ordinary birthday: 1990-06-15 on 2026-10-12 is 36 years, 3 months, 27 days', () => {
  const r = calculate({ birth: '1990-06-15', asOf: '2026-10-12' });
  assert.equal(r.items[0].value, '36 years, 3 months, 27 days');
  assert.equal(item(r, 'Age in years').value, 36);
  assert.equal(item(r, 'Total months').value, 435);
  assert.equal(item(r, 'Day of the week you were born').value, 'Friday');
});

test('Day before a birthday keeps the old age; the birthday itself adds a year', () => {
  assert.deepEqual(ymd('1990-06-15', '2026-06-14'), { years: 35, months: 11, days: 30 });
  assert.deepEqual(ymd('1990-06-15', '2026-06-15'), { years: 36, months: 0, days: 0 });
  const r = calculate({ birth: '1990-06-15', asOf: '2026-06-15' });
  assert.match(item(r, 'Next birthday').value, /today, age 36/);
  const eve = calculate({ birth: '1990-06-15', asOf: '2026-06-14' });
  assert.match(item(eve, 'Next birthday').value, /Monday, June 15, 2026 \(in 1 day, turning 36\)/);
});

test('Month-end borrowing uses the month before the as-of month', () => {
  // Jan 31 to Mar 1: borrowing February (28) is not enough, so January (31) is used too.
  assert.deepEqual(ymd('2026-01-31', '2026-03-01'), { years: 0, months: 0, days: 29 });
  assert.deepEqual(ymd('2026-03-31', '2026-04-30'), { years: 0, months: 0, days: 30 });
  assert.deepEqual(ymd('2026-01-31', '2026-03-31'), { years: 0, months: 2, days: 0 });
  assert.deepEqual(ymd('2020-12-31', '2021-03-01'), { years: 0, months: 1, days: 29 });
  assert.deepEqual(ymd('2015-03-31', '2026-10-12'), { years: 11, months: 6, days: 11 });
});

test('Leap-day birthday in a leap year: birthday stays on February 29', () => {
  const r = calculate({ birth: '2000-02-29', asOf: '2023-10-12' });
  assert.match(item(r, 'Next birthday').value, /^Thursday, February 29, 2024 /);
  assert.equal(r.notes.length, 2);
  assert.deepEqual(ymd('2000-02-29', '2024-02-29'), { years: 24, months: 0, days: 0 });
});

test('Leap-day birthday in a common year: the birthday and the year count both move to March 1', () => {
  const r = calculate({ birth: '2000-02-29', asOf: '2026-10-12' });
  assert.equal(item(r, 'Next birthday').value, 'Monday, March 1, 2027 (in 140 days, turning 27)');
  // On 28 February of a common year the person is still 26 and the birthday is tomorrow (no contradiction)
  const eve = calculate({ birth: '2000-02-29', asOf: '2027-02-28' });
  assert.equal(item(eve, 'Age in years').value, 26);
  assert.match(item(eve, 'Next birthday').value, /March 1, 2027 \(in 1 day, turning 27\)/);
  const day = calculate({ birth: '2000-02-29', asOf: '2027-03-01' });
  assert.equal(item(day, 'Age in years').value, 27);
  assert.match(item(day, 'Next birthday').value, /today, age 27/);
  // In a leap year the birthday is 29 February itself
  assert.match(item(calculate({ birth: '2000-02-29', asOf: '2028-02-29' }), 'Next birthday').value, /February 29, 2028 \(today, age 28\)/);
  assert.deepEqual(ymd('2000-02-29', '2001-02-28'), { years: 0, months: 11, days: 30 });
  assert.deepEqual(ymd('2000-02-29', '2001-03-01'), { years: 1, months: 0, days: 0 });
  assert.equal(calculate({ birth: '1990-06-15', asOf: '2026-10-12' }).notes.length, 1);
});

test('Totals agree with diffDays and with the years/months/days breakdown', () => {
  const cases = [['1990-06-15', '2026-10-12'], ['2000-02-29', '2026-10-12'], ['1999-12-31', '2000-03-01'], ['1000-01-01', '9998-12-31'], ['2026-10-12', '2026-10-12']];
  for (const [birth, asOf] of cases) {
    const r = calculate({ birth, asOf });
    const days = diffDays(birth, asOf);
    assert.equal(item(r, 'Total days').value, days);
    const { years, months } = ymd(birth, asOf);
    assert.equal(item(r, 'Total months').value, years * 12 + months);
    const w = Math.floor(days / 7);
    assert.ok(item(r, 'Total weeks and days').value.startsWith(`${w.toLocaleString('en-US')} week`));
    assert.equal(item(r, 'Day of the week you were born').value, WEEKDAYS_EN[weekdayIndex(birth)]);
  }
});

test('Born today: everything is zero and the next birthday is a year away', () => {
  const r = calculate({ birth: '2026-10-12', asOf: '2026-10-12' });
  assert.equal(r.items[0].value, '0 years, 0 months, 0 days');
  assert.equal(item(r, 'Total days').value, 0);
});

test('Invalid inputs return an error instead of NaN', () => {
  assert.ok(calculate({ birth: '2023-02-29', asOf: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '', asOf: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '1990-06-15', asOf: 'abc' }).error);
  assert.ok(calculate({ birth: '1990-06-15', asOf: undefined }).error);
  assert.ok(calculate({ birth: '2026-10-13', asOf: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '0999-01-01', asOf: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '2000-01-01', asOf: '9999-01-01' }).error);
  assert.ok(calculate({}).error);
});
