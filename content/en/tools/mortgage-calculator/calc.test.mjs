import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, schedule, monthlyPaymentCents } from './calc.js';

const base = { price: 400000, downPct: 20, rate: 6.5, term: '30', tax: 4000, insurance: 1500, hoa: 0, pmiRate: 0.5 };
const run = (o = {}) => calculate({ ...base, ...o });
const item = (r, label) => r.items.find((i) => i.label.startsWith(label));

test('monthly payment matches the closed-form formula ($100,000 at 6% for 30 years is $599.55)', () => {
  assert.equal(monthlyPaymentCents(10000000, 6, 360), 59955);
  const loan = 320000;
  const i = 0.065 / 12;
  const n = 360;
  const exact = (loan * i * (1 + i) ** n) / ((1 + i) ** n - 1);
  const r = run();
  assert.ok(Math.abs(item(r, 'Principal and interest').value - exact) <= 0.005);
  assert.equal(item(r, 'Principal and interest').value, 2022.62);
});

test('total monthly payment adds tax, insurance, HOA and PMI to principal and interest', () => {
  const r = run({ downPct: 10, hoa: 85 });
  const sum = item(r, 'Principal and interest').value + 4000 / 12 + 1500 / 12 + 85 + 150;
  assert.ok(Math.abs(r.items[0].value - sum) <= 0.01);
  assert.equal(r.items[0].prefix, '$');
  assert.equal(r.items[0].primary, true);
});

test('balance ends at exactly zero and principal paid equals the loan, for every term', () => {
  for (const years of [10, 15, 20, 30]) {
    for (const rate of [0, 0.01, 3.875, 6.5, 20]) {
      const loan = 32012345; // cents
      const { months } = schedule(loan, rate, years);
      assert.equal(months.length, years * 12);
      assert.equal(months.at(-1).balance, 0);
      assert.equal(months.reduce((s, m) => s + m.principal, 0), loan);
      assert.ok(months.every((m) => Number.isInteger(m.interest) && m.principal >= 0));
    }
  }
  const r = run({ term: '15' });
  const principal = r.table.rows.reduce((s, row) => s + Math.round(row[1].value * 100), 0);
  assert.equal(principal, 32000000);
  assert.equal(r.table.rows.at(-1)[3].value, 0);
  assert.equal(r.table.rows.length, 15);
});

test('total interest equals total payments minus the loan', () => {
  const r = run();
  const total = item(r, 'Total of all').value;
  assert.ok(Math.abs(total - item(r, 'Loan amount').value - item(r, 'Total interest').value) < 0.005);
});

test('PMI is zero when the down payment is 20% or more, or when the rate is 0', () => {
  assert.equal(item(run({ downPct: 20 }), 'PMI').value, 0);
  assert.equal(item(run({ downPct: 35 }), 'Months with PMI').value, 0);
  assert.equal(item(run({ downPct: 5, pmiRate: 0 }), 'Months with PMI').value, 0);
  assert.equal(item(run({ downPct: 19.99 }), 'Months with PMI').value > 0, true);
});

test('PMI stops once the scheduled balance reaches 78% of the original value', () => {
  const r = run({ downPct: 10 });
  const months = item(r, 'Months with PMI').value;
  const { months: m } = schedule(36000000, 6.5, 30);
  const limit = 0.78 * 40000000;
  // Balance at the start of the last PMI month is still above 78%; after that payment it is at or below.
  assert.ok((months === 1 ? 36000000 : m[months - 2].balance) > limit);
  assert.ok(m[months - 1].balance <= limit);
  assert.equal(item(r, 'PMI').value, 150); // 0.5% of $360,000 / 12
});

test('zero interest rate divides the loan evenly', () => {
  const r = run({ rate: 0, tax: 0, insurance: 0 });
  assert.equal(item(r, 'Principal and interest').value, 888.89);
  assert.equal(item(r, 'Total interest').value, 0);
  assert.equal(item(r, 'Total of all').value, 320000);
});

test('shorter terms cost less interest overall but more per month', () => {
  const a = run({ term: '30' });
  const b = run({ term: '15' });
  assert.ok(item(b, 'Principal and interest').value > item(a, 'Principal and interest').value);
  assert.ok(item(b, 'Total interest').value < item(a, 'Total interest').value);
});

test('invalid input returns a plain-English error and never NaN', () => {
  const bad = [
    { price: NaN }, { price: 0 }, { price: -5 }, { downPct: -1 }, { downPct: 101 }, { downPct: 100 },
    { rate: -0.1 }, { rate: 25 }, { rate: NaN }, { term: '25' }, { term: 'abc' }, { tax: -1 },
    { insurance: NaN }, { hoa: -10 }, { pmiRate: -1 }, { pmiRate: 9 }, { price: Infinity },
  ];
  for (const o of bad) {
    const r = run(o);
    assert.equal(typeof r.error, 'string', JSON.stringify(o));
    assert.equal(r.items, undefined);
  }
});

test('no result value is NaN or infinite across edge cases', () => {
  for (const o of [{}, { downPct: 0 }, { downPct: 99 }, { rate: 0 }, { rate: 20, term: '10' }, { price: 1, downPct: 0 }, { hoa: 0, tax: 0, insurance: 0 }]) {
    const r = run(o);
    if (r.error) continue;
    for (const it of r.items) assert.ok(typeof it.value !== 'number' || Number.isFinite(it.value), it.label);
    for (const row of r.table.rows) for (const c of row.slice(1)) assert.ok(Number.isFinite(c.value));
  }
});
