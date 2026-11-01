import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, schedule } from './calc.js';

const base = { balance: 5000, apr: 22, mode: 'fixed', payment: 200, minPct: 1, minFloor: 25 };
const run = (o = {}) => calculate({ ...base, ...o });
const item = (r, label) => r.items.find((i) => i.label.startsWith(label));

test('fixed payment matches the closed-form number of payments n = -ln(1 - B*i/P) / ln(1 + i)', () => {
  const i = 0.22 / 12;
  const exact = -Math.log(1 - (5000 * i) / 200) / Math.log(1 + i);
  const r = run();
  assert.equal(item(r, 'Time to pay off').value, Math.ceil(exact));
  // total paid is about n_exact * payment when the last payment is partial
  assert.ok(Math.abs(item(r, 'Total paid').value - exact * 200) < 200);
});

test('zero APR divides the balance evenly with no interest', () => {
  const r = run({ apr: 0, balance: 1200, payment: 100 });
  assert.equal(item(r, 'Time to pay off').value, 12);
  assert.equal(item(r, 'Total interest').value, 0);
  assert.equal(item(r, 'Last payment').value, 100);
});

test('total paid equals balance plus interest and the balance ends at zero', () => {
  const r = run();
  assert.ok(Math.abs(item(r, 'Total paid').value - 5000 - item(r, 'Total interest').value) < 0.005);
  assert.equal(r.table.rows.at(-1)[3].value, 0);
});

test('a larger payment finishes sooner and costs less interest', () => {
  const a = run({ payment: 200 });
  const b = run({ payment: 400 });
  assert.ok(item(b, 'Time to pay off').value < item(a, 'Time to pay off').value);
  assert.ok(item(b, 'Total interest').value < item(a, 'Total interest').value);
});

test('payment that does not cover the first month interest returns an error', () => {
  const r = run({ payment: 90 });
  assert.ok(r.error && /interest/.test(r.error));
});

test('payment equal to balance plus interest pays off in one month', () => {
  const r = run({ balance: 100, apr: 12, payment: 101 });
  assert.equal(item(r, 'Time to pay off').value, 1);
  assert.equal(item(r, 'Total interest').value, 1);
});

test('minimum-payment mode takes far longer than a fixed $200 payment', () => {
  const m = run({ mode: 'minimum' });
  assert.equal(item(m, 'First payment').value, 141.67);
  assert.ok(item(m, 'Time to pay off').value > 100);
  assert.ok(item(m, 'Total interest').value > item(run(), 'Total interest').value);
});

test('minimum payment never exceeds what is owed', () => {
  const s = schedule(2000, 20, (bal, interest) => Math.max(2500, Math.round(bal * 0.01) + interest));
  assert.equal(s.months.length, 1);
  assert.equal(s.months[0].balance, 0);
});

test('invalid input returns an error instead of NaN', () => {
  assert.ok(calculate({ ...base, balance: NaN }).error);
  assert.ok(calculate({ ...base, balance: 0 }).error);
  assert.ok(calculate({ ...base, apr: -1 }).error);
  assert.ok(calculate({ ...base, payment: NaN }).error);
  assert.ok(calculate({ ...base, mode: 'x' }).error);
  assert.ok(calculate({ ...base, mode: 'minimum', minPct: NaN }).error);
});
