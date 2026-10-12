import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { currency: 'USD', bill: 84.5, tax: 6.5, tipBase: 'pretax', tipPct: 18, people: 2, rounding: 'none' };
const run = (o = {}) => calculate({ ...base, ...o });
const get = (r, label) => r.items.find((i) => i.label === label);

test('tip on the pre-tax amount: 18% of 78.00 is 14.04', () => {
  const r = run();
  assert.equal(get(r, 'Tip amount').value, 14.04);
  assert.equal(get(r, 'Total to pay').value, 98.54);
  assert.equal(get(r, 'Total per person').value, 49.27);
  assert.equal(get(r, 'Total per person').primary, true);
  assert.equal(get(r, 'Total per person').prefix, '$');
  assert.equal(get(r, 'Effective tip on the full bill').value, 16.62);
});

test('tip on the full bill: 18% of 84.50 is 15.21 and the effective tip is 18%', () => {
  const r = run({ tipBase: 'total' });
  assert.equal(get(r, 'Tip amount').value, 15.21);
  assert.equal(get(r, 'Total to pay').value, 99.71);
  assert.equal(get(r, 'Effective tip on the full bill').value, 18);
});

test('uneven cents: 100 split three ways is 33.34 + 33.33 + 33.33, never short', () => {
  const r = run({ bill: 100, tax: 0, tipPct: 0, people: 3 });
  const share = get(r, 'Total per person').value;
  assert.equal(share, 33.34);
  assert.equal(get(r, 'Total to pay').value, 100);
  assert.ok(Math.round(share * 100) * 3 >= 10000);
  assert.ok(r.notes.some((n) => n.includes('$33.33')));
});

test('rounding up: shares become whole dollars and the extra goes to the tip', () => {
  const r = run({ rounding: 'up' });
  assert.equal(get(r, 'Total per person').value, 50);
  assert.equal(get(r, 'Total to pay').value, 100);
  assert.equal(get(r, 'Tip amount').value, 15.5);
  assert.equal(get(r, 'Effective tip on the full bill').value, 18.34);
  assert.ok(r.notes.some((n) => n.includes('extra tip')));
  const r3 = run({ bill: 100, tax: 0, tipPct: 0, people: 3, rounding: 'up' });
  assert.equal(get(r3, 'Total per person').value, 34);
  assert.equal(get(r3, 'Tip amount').value, 2);
});

test('0% tip leaves the tip at zero', () => {
  const r = run({ tipPct: 0 });
  assert.equal(get(r, 'Tip amount').value, 0);
  assert.equal(get(r, 'Total to pay').value, 84.5);
  assert.equal(get(r, 'Total per person').value, 42.25);
});

test('one person: total to pay is the primary result', () => {
  const r = run({ people: 1 });
  assert.equal(r.items[0].label, 'Total to pay');
  assert.equal(r.items[0].primary, true);
  assert.equal(r.items[0].value, 98.54);
  assert.equal(get(r, 'Tip per person').value, 14.04);
});

test('invalid inputs return plain-English errors, never NaN or exceptions', () => {
  for (const o of [
    { bill: NaN },
    { bill: 0 },
    { bill: -5 },
    { tax: 100 },
    { tax: -1 },
    { tipPct: -1 },
    { tipPct: 101 },
    { people: 0 },
    { people: 2.5 },
    { people: 101 },
    { currency: 'XYZ' },
    { tipBase: '' },
    { rounding: 'x' },
  ]) {
    const r = run(o);
    assert.equal(typeof r.error, 'string', JSON.stringify(o));
    assert.equal(r.items, undefined);
  }
});

test('other currencies change only the prefix', () => {
  assert.equal(get(run({ currency: 'GBP' }), 'Tip amount').prefix, '£');
  assert.equal(get(run({ currency: 'CAD' }), 'Tip amount').prefix, 'C$');
});
