import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { currency: 'USD', initial: 10000, monthly: 200, rate: 7, years: 10, compounding: '12' };
const near = (a, b, tol = 0.006) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('Lump sum only matches A = P(1 + r/n)^(nt) for every frequency', () => {
  for (const n of [1, 2, 4, 12, 365]) {
    const r = calculate({ ...base, initial: 1000, monthly: 0, rate: 5, years: 10, compounding: String(n) });
    near(r.items[0].value, 1000 * Math.pow(1 + 0.05 / n, n * 10));
  }
  assert.equal(calculate({ ...base, initial: 1000, monthly: 0, rate: 5, compounding: '1' }).items[0].value, 1628.89);
});

test('Monthly compounding with deposits matches the ordinary-annuity formula', () => {
  const i = 0.07 / 12;
  const months = 120;
  const expected = 10000 * Math.pow(1 + i, months) + 200 * ((Math.pow(1 + i, months) - 1) / i);
  const r = calculate(base);
  near(r.items[0].value, expected);
  assert.equal(r.items[1].value, 34000);
  near(r.items[2].value, expected - 34000);
});

test('Zero rate gives balance equal to total contributions and zero interest', () => {
  const r = calculate({ ...base, rate: 0 });
  assert.equal(r.items[0].value, 34000);
  assert.equal(r.items[2].value, 0);
  assert.equal(r.items[3].value, 0);
});

test('APY: 5% compounded daily is about 5.13%; annual compounding equals the nominal rate', () => {
  assert.equal(calculate({ ...base, rate: 5, compounding: '365' }).items[3].value, 5.13);
  assert.equal(calculate({ ...base, rate: 5, compounding: '1' }).items[3].value, 5);
});

test('Table has one row per year and the last row matches the headline results', () => {
  const r = calculate({ ...base, years: 7 });
  assert.equal(r.table.rows.length, 7);
  const last = r.table.rows[6];
  assert.equal(last[0], 7);
  assert.equal(last[1].value, r.items[1].value);
  assert.equal(last[3].value, r.items[0].value);
  let sum = 0;
  for (const row of r.table.rows) sum += row[2].value;
  near(sum, r.items[2].value, 0.05);
});

test('Boundaries: 1 year, 60 years, -20% and 50% rates are accepted and finite', () => {
  for (const o of [{ years: 1 }, { years: 60 }, { rate: -20 }, { rate: 50 }, { rate: 50, years: 60, compounding: '365' }]) {
    const r = calculate({ ...base, ...o });
    assert.ok(!r.error, JSON.stringify(o));
    assert.ok(Number.isFinite(r.items[0].value));
  }
});

test('Currency: symbol is the prefix and yen has no decimals', () => {
  assert.equal(calculate(base).items[0].prefix, '$');
  assert.equal(calculate({ ...base, currency: 'GBP' }).items[0].prefix, '£');
  const jpy = calculate({ ...base, currency: 'JPY' });
  assert.equal(jpy.items[0].digits, 0);
  assert.equal(jpy.items[0].prefix, '¥');
  assert.ok(Number.isInteger(jpy.items[0].value));
});

test('Invalid inputs return an error instead of NaN or Infinity', () => {
  assert.ok(calculate({ ...base, initial: -1 }).error);
  assert.ok(calculate({ ...base, monthly: -5 }).error);
  assert.ok(calculate({ ...base, initial: 0, monthly: 0 }).error);
  assert.ok(calculate({ ...base, rate: 50.1 }).error);
  assert.ok(calculate({ ...base, rate: -20.1 }).error);
  assert.ok(calculate({ ...base, years: 0 }).error);
  assert.ok(calculate({ ...base, years: 61 }).error);
  assert.ok(calculate({ ...base, years: 2.5 }).error);
  assert.ok(calculate({ ...base, initial: NaN }).error);
  assert.ok(calculate({ ...base, compounding: '7' }).error);
  assert.ok(calculate({ ...base, currency: 'XXX' }).error);
  assert.ok(calculate({}).error);
});
