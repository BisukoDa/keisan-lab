import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { currency: 'USD', principal: 1000, rate: 5, years: 4, months: 0 };
const ex = { ...base, years: 5 };

test('$1,000 at 5% for 5 years: $50 a year, $250 total, yearly compounding adds $26.28', () => {
  const r = calculate(ex);
  assert.equal(r.items[0].value, 250);
  assert.equal(r.items[1].value, 1250);
  assert.equal(r.items[2].value, 50);
  assert.equal(r.items[3].value, 1276.28);
  assert.equal(r.items[4].value, 26.28);
});

test('Under one year the comparison equals simple interest and is never negative', () => {
  for (const [p, rt, m] of [[1000, 5, 1], [5000, 4, 6], [1000, 100, 6], [1000, 5, 11]]) {
    const r = calculate({ ...base, principal: p, rate: rt, years: 0, months: m });
    assert.equal(r.items[4].value, 0);
  }
});

test('Months are fractions of a year: $500 at 3% for 9 months is $11.25', () => {
  const r = calculate({ ...base, principal: 500, rate: 3, years: 0, months: 9 });
  assert.equal(r.items[0].value, 11.25);
  assert.equal(r.items[1].value, 511.25);
});

test('Zero rate gives zero interest and no compounding gap', () => {
  const r = calculate({ ...base, rate: 0 });
  assert.equal(r.items[0].value, 0);
  assert.equal(r.items[1].value, 1000);
  assert.equal(r.items[4].value, 0);
});

test('Table: one row per started year; last row matches the headline totals', () => {
  const r = calculate({ ...base, years: 2, months: 6 });
  assert.equal(r.table.rows.length, 3);
  const last = r.table.rows[2];
  assert.equal(last[1].value, r.items[0].value);
  assert.equal(last[2].value, r.items[1].value);
  assert.equal(last[3].value, r.items[3].value);
  assert.equal(r.table.rows[0][1].value, 50);
});

test('Boundaries: 1 month, 50 years, 100% are finite', () => {
  for (const o of [{ years: 0, months: 1 }, { years: 50 }, { rate: 100, years: 50 }]) {
    const r = calculate({ ...base, ...o });
    assert.ok(!r.error);
    assert.ok(Number.isFinite(r.items[3].value));
  }
});

test('Currency symbol is the prefix', () => {
  assert.equal(calculate({ ...base, currency: 'GBP' }).items[0].prefix, '£');
});

test('Invalid inputs return errors, not NaN', () => {
  for (const o of [{ principal: 0 }, { principal: 0.5 }, { principal: -1 }, { principal: NaN }, { rate: -1 }, { rate: 101 }, { years: 0, months: 0 }, { years: 1.5 }, { months: 12 }, { months: -1 }, { years: 51 }, { currency: 'XXX' }, { rate: NaN }]) {
    assert.ok(calculate({ ...base, ...o }).error, JSON.stringify(o));
  }
  assert.ok(calculate({}).error);
});
