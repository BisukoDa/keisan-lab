import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { currency: 'USD', goal: 20000, current: 2000, rate: 4, years: 3, months: 0 };

test('0% rate: (goal - saved) / months', () => {
  const r = calculate({ ...base, rate: 0 });
  assert.equal(r.items[0].value, 500);
  assert.equal(r.items[2].value, 0);
  assert.equal(r.items[3].value, 20000);
});

test('Matches the annuity formula with monthly compounding', () => {
  const i = 0.04 / 12, n = 36;
  const g = Math.pow(1 + i, n);
  const expected = (20000 - 2000 * g) * i / (g - 1);
  const r = calculate(base);
  assert.ok(Math.abs(r.items[0].value - expected) <= 0.0101);
  assert.ok(r.items[3].value >= 20000 && r.items[3].value < 20001);
});

test('Starting from $0: reverse of the future value of a deposit stream', () => {
  const r = calculate({ ...base, current: 0, rate: 6, years: 10 });
  const i = 0.005, n = 120;
  const fv = r.items[0].value * (Math.pow(1 + i, n) - 1) / i;
  assert.ok(fv >= 20000 && fv < 20000 + r.items[0].value);
  assert.equal(r.items[4].value, 120);
});

test('Goal already reached by growth needs no deposit', () => {
  const r = calculate({ ...base, current: 20000, years: 1 });
  assert.equal(r.items[0].value, 0);
  assert.ok(r.notes[0].includes('already grow'));
});

test('Months only and singular unit', () => {
  const r = calculate({ ...base, current: 0, rate: 0, goal: 1200, years: 0, months: 1 });
  assert.equal(r.items[0].value, 1200);
  assert.equal(r.items[4].unit, ' deposit');
});

test('Invalid input returns an error, never NaN', () => {
  for (const bad of [{ goal: NaN }, { goal: 0 }, { goal: -5 }, { current: -1 }, { current: NaN }, { rate: -1 }, { rate: 31 }, { years: 0, months: 0 }, { years: 1.5 }, { months: 12 }, { years: 51 }, { currency: 'XXX' }]) {
    const r = calculate({ ...base, ...bad });
    assert.ok(r.error, JSON.stringify(bad));
  }
});

test('Extremely small rates stay accurate and the table matches the summary', () => {
  for (const rate of [1e-9, 1e-11, 1e-12]) {
    const r = calculate({ ...base, rate });
    assert.equal(r.items[0].value, 500);
    const last = r.table.rows[r.table.rows.length - 1];
    assert.equal(last[3].value, r.items[3].value);
    assert.ok(last[3].value >= 20000);
  }
});
