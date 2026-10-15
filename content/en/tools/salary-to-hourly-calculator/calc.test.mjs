import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { amount: 52000, period: 'year', hoursPerWeek: 40, unpaidWeeks: 0 };
const run = (o = {}) => calculate({ ...base, ...o });
const get = (r, label) => r.items.find((i) => i.label === label).value;

test('52,000 a year at 40 hours is exactly 25.00 an hour (2,080 hours)', () => {
  const r = run();
  assert.equal(get(r, 'Hourly pay'), 25);
  assert.equal(get(r, 'Weekly pay'), 1000);
  assert.equal(get(r, 'Daily pay (5-day week)'), 200);
  assert.equal(get(r, 'Biweekly pay'), 2000);
  assert.equal(get(r, 'Monthly pay'), 4333.33);
});

test('OPM example: 89,033 divided by 2,087 is 42.66', () => {
  assert.equal(get(run({ amount: 89033 }), 'Hourly pay using the federal 2,087-hour divisor'), 42.66);
});

test('monthly and weekly salaries are converted to a yearly amount first', () => {
  assert.equal(get(run({ amount: 6250, period: 'month' }), 'Yearly pay'), 75000);
  assert.equal(get(run({ amount: 1442.31, period: 'week' }), 'Yearly pay'), 75000.12);
  assert.equal(get(run({ amount: 2000, period: 'biweek' }), 'Hourly pay'), 25);
});

test('unpaid weeks off reduce the hours: 75,000 over 50 weeks is 37.50', () => {
  assert.equal(get(run({ amount: 75000, unpaidWeeks: 2 }), 'Hourly pay'), 37.5);
  assert.equal(get(run({ amount: 75000 }), 'Hourly pay'), 36.06);
});

test('invalid input returns an error instead of NaN', () => {
  for (const o of [{ amount: NaN }, { amount: 0 }, { amount: -5 }, { hoursPerWeek: 0 }, { hoursPerWeek: 101 }, { unpaidWeeks: 52 }, { unpaidWeeks: -1 }, { period: 'day' }, { hoursPerWeek: NaN }]) {
    assert.ok(run(o).error, JSON.stringify(o));
  }
});

test('overtime note appears only above 40 hours', () => {
  assert.ok(run({ hoursPerWeek: 45 }).notes.some((n) => n.includes('Overtime')));
  assert.ok(!run().notes.some((n) => n.includes('Overtime')));
});

test('weekly pay with unpaid weeks stays consistent: 1,000 a week for 48 weeks', () => {
  const r = run({ amount: 1000, period: 'week', unpaidWeeks: 4 });
  assert.equal(get(r, 'Yearly pay'), 48000);
  assert.equal(get(r, 'Hourly pay'), 25);
  assert.equal(get(r, 'Weekly pay'), 1000);
  assert.equal(get(r, 'Biweekly pay'), 2000);
  assert.equal(get(r, 'Monthly pay'), 4000);
});

test('fractional unpaid weeks are rejected', () => {
  assert.ok(run({ unpaidWeeks: 0.5 }).error);
});
