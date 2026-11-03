import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { income: 6000, housing: 1500, auto: 100, student: 0, cards: 0, other: 400, target: 36 };
const run = (o = {}) => calculate({ ...base, ...o });
const item = (r, label) => r.items.find((i) => i.label.startsWith(label));

test('CFPB example: $2,000 of debt on $6,000 income is 33%', () => {
  const r = run({ other: 400 });
  assert.equal(item(r, 'Total').value, 2000);
  assert.equal(Math.round(item(r, 'Debt-to-income').value), 33);
  assert.equal(item(r, 'Debt-to-income').value, 33.33);
});

test('room under target and amount over target', () => {
  assert.equal(item(run(), 'Room left').value, 160); // 2160 - 2000
  const over = run({ target: 30 });
  assert.equal(item(over, 'Amount over').value, 200); // 2000 - 1800
});

test('zero debt gives 0%', () => {
  const r = run({ housing: 0, auto: 0, other: 0 });
  assert.equal(item(r, 'Debt-to-income').value, 0);
});

test('ratio without housing excludes rent or mortgage', () => {
  assert.equal(item(run(), 'Ratio without').value, 8.33);
});

test('invalid inputs return errors, not NaN', () => {
  assert.ok(run({ income: 0 }).error);
  assert.ok(run({ income: NaN }).error);
  assert.ok(run({ cards: -5 }).error);
  assert.ok(run({ target: 0 }).error);
  assert.ok(run({ housing: NaN }).error);
});

test('debt above income gives a ratio over 100%', () => {
  assert.equal(item(run({ housing: 7000 }), 'Debt-to-income').value, 125);
});
