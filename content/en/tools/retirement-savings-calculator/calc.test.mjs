import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, deferralLimit } from './calc.js';

const base = { age: 30, retireAge: 65, balance: 20000, salary: 70000, contribPct: 8, matchRate: 50, matchCap: 6, raise: 3, rate: 6, inflation: 2.5 };
const near = (a, b, tol = 0.006) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('One year: 6% growth on the balance, then contribution and match at year end', () => {
  const r = calculate({ ...base, retireAge: 31 });
  // 20000 x 1.06 + 5600 (8% of 70000) + 2100 (50% of min(5600, 4200))
  near(r.items[0].value, 28900);
  assert.equal(r.items[2].value, 5600);
  assert.equal(r.items[3].value, 2100);
});

test('Zero return and zero raise: balance is the sum of everything put in', () => {
  const r = calculate({ ...base, balance: 0, salary: 100000, contribPct: 10, matchRate: 0, retireAge: 40, rate: 0, raise: 0 });
  assert.equal(r.items[0].value, 100000);
  assert.equal(r.items[4].value, 0);
});

test('Level contributions match the future-value-of-annuity formula', () => {
  const r = calculate({ ...base, raise: 0, matchRate: 0, inflation: 0 });
  const n = 35, i = 0.06;
  const expected = 20000 * Math.pow(1 + i, n) + 5600 * ((Math.pow(1 + i, n) - 1) / i);
  near(r.items[0].value, expected, 0.01);
  near(r.items[1].value, expected, 0.01);
});

test('Contributions are capped at the IRS limit, with catch-up amounts by age', () => {
  assert.equal(deferralLimit(49), 24500);
  assert.equal(deferralLimit(50), 32500);
  assert.equal(deferralLimit(59), 32500);
  assert.equal(deferralLimit(60), 35750);
  assert.equal(deferralLimit(63), 35750);
  assert.equal(deferralLimit(64), 32500);
  const r = calculate({ ...base, balance: 0, salary: 400000, contribPct: 15, age: 58, retireAge: 62, raise: 0, rate: 0 });
  assert.equal(r.items[2].value, 136500); // 2 x 32,500 + 2 x 35,750
  assert.equal(r.items[3].value, 48000); // 4 x (50% x 24,000)
  assert.ok(r.notes[0].includes('higher than the IRS limit'));
});

test('Invalid input returns an error message instead of NaN', () => {
  assert.ok(calculate({ ...base, age: NaN }).error);
  assert.ok(calculate({ ...base, retireAge: 30 }).error);
  assert.ok(calculate({ ...base, retireAge: 25 }).error);
  assert.ok(calculate({ ...base, balance: -1 }).error);
  assert.ok(calculate({ ...base, salary: 0 }).error);
  assert.ok(calculate({ ...base, contribPct: 101 }).error);
  assert.ok(calculate({ ...base, age: 30.5 }).error);
  assert.ok(calculate({}).error);
});

test('Inflation lowers the value in today\'s dollars; the default case is reproducible', () => {
  const r = calculate(base);
  assert.equal(r.items[0].value, 1404259.32);
  near(r.items[1].value, 1404259.32 / Math.pow(1.025, 35), 0.01);
  near(r.items[2].value + r.items[3].value + r.items[4].value + 20000, r.items[0].value, 0.02);
  assert.equal(r.table.rows.length, 35);
});

test('A match limit of 0 or a 0% contribution gives no employer match', () => {
  assert.equal(calculate({ ...base, matchCap: 0 }).items[3].value, 0);
  const r = calculate({ ...base, contribPct: 0 });
  assert.equal(r.items[2].value, 0);
  assert.equal(r.items[3].value, 0);
});
