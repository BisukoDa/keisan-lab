import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, schedule, monthlyPaymentCents, aprPercent } from './calc.js';

const base = { amount: 25000, rate: 8, termValue: 5, termUnit: 'years', extra: 0, feePct: 0 };
const run = (o = {}) => calculate({ ...base, ...o });
const item = (r, label) => r.items.find((i) => i.label.startsWith(label));

test('monthly payment matches the closed-form formula ($100,000 at 6% for 30 years is $599.55)', () => {
  assert.equal(monthlyPaymentCents(10000000, 6, 360), 59955);
  const i = 0.08 / 12;
  const exact = (25000 * i * (1 + i) ** 60) / ((1 + i) ** 60 - 1);
  assert.ok(Math.abs(item(run(), 'Monthly payment').value - exact) <= 0.005);
});

test('years and months give the same result for the same number of payments', () => {
  const a = run({ termValue: 5, termUnit: 'years' });
  const b = run({ termValue: 60, termUnit: 'months' });
  assert.deepEqual(a.items, b.items);
});

test('balance ends at exactly zero and principal paid equals the loan', () => {
  for (const n of [1, 6, 36, 60, 480]) {
    for (const rate of [0, 0.01, 5.5, 40]) {
      const loan = 1234567;
      const { months } = schedule(loan, rate, n);
      assert.equal(months.at(-1).balance, 0);
      assert.equal(months.reduce((s, m) => s + m.principal, 0), loan);
    }
  }
});

test('total interest equals total payments minus the loan', () => {
  const r = run();
  assert.ok(Math.abs(item(r, 'Total paid').value - 25000 - item(r, 'Total interest').value) < 0.005);
});

test('zero interest rate divides the loan evenly', () => {
  const r = run({ rate: 0, amount: 12000, termValue: 12, termUnit: 'months' });
  assert.equal(item(r, 'Monthly payment').value, 1000);
  assert.equal(item(r, 'Total interest').value, 0);
});

test('extra payments shorten the loan and save interest', () => {
  const plain = run();
  const extra = run({ extra: 200 });
  assert.ok(item(extra, 'Number of payments').value < 60);
  assert.ok(item(extra, 'Total interest').value < item(plain, 'Total interest').value);
  assert.equal(item(extra, 'Months saved').value, 60 - item(extra, 'Number of payments').value);
  assert.equal(extra.table.rows.at(-1)[3].value, 0);
  assert.equal(item(plain, 'Months saved'), undefined);
});

test('APR equals the rate with no fee and is higher with a fee', () => {
  const { payment } = schedule(2500000, 8, 60);
  assert.ok(Math.abs(aprPercent(2500000, payment, 60) - 8) < 0.01);
  const r = run({ feePct: 5 });
  assert.equal(item(r, 'Origination fee').value, 1250);
  assert.equal(item(r, 'Money you receive').value, 23750);
  assert.ok(item(r, 'Estimated APR').value > 8);
});

test('invalid input returns a plain-English error and never NaN', () => {
  const bad = [
    { amount: NaN }, { amount: 0 }, { amount: -5 }, { rate: -1 }, { rate: 41 }, { rate: NaN },
    { termValue: 0 }, { termValue: 2.5 }, { termValue: NaN }, { termValue: 41 }, { termValue: 481, termUnit: 'months' },
    { termUnit: 'weeks' }, { extra: -1 }, { extra: 25001 }, { extra: NaN }, { feePct: -1 }, { feePct: 21 }, { amount: Infinity },
  ];
  for (const o of bad) {
    const r = run(o);
    assert.equal(typeof r.error, 'string', JSON.stringify(o));
    assert.equal(r.items, undefined);
  }
});

test('no result value is NaN or infinite across edge cases', () => {
  for (const o of [{}, { amount: 1 }, { rate: 0 }, { rate: 40, termValue: 40 }, { termValue: 1, termUnit: 'months' }, { extra: 25000 }, { feePct: 20, extra: 50 }]) {
    const r = run(o);
    assert.equal(r.error, undefined, JSON.stringify(o));
    for (const it of r.items) assert.ok(Number.isFinite(it.value), it.label);
  }
});

test('high rates over long terms stay stable: no balloon, interest matches P x n - L', () => {
  for (const [rate, years] of [[40, 40], [25, 30], [20, 30], [15, 40], [10, 40]]) {
    const r = run({ rate, termValue: years });
    const pay = item(r, 'Monthly payment').value;
    const n = years * 12;
    const interest = item(r, 'Total interest').value;
    assert.ok(Math.abs(interest - (pay * n - 25000)) <= 0.005 * n, `${rate}/${years}`);
    const { months } = schedule(2500000, rate, n);
    assert.equal(months.length, n);
    assert.ok(Math.abs(months.at(-1).payment - months[0].payment) <= 100, `${rate}/${years}`);
    assert.equal(months.at(-1).balance, 0);
  }
});
