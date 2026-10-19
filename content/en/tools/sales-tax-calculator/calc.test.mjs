import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const get = (r, label) => r.items.find((i) => i.label === label);

test('add tax: $49.99 at 8.5% is $4.25 tax (4.24915 rounds up), total $54.24', () => {
  const r = calculate({ mode: 'add', price: 49.99, rate: 8.5, qty: 1 });
  assert.equal(get(r, 'Sales tax').value, 4.25);
  assert.equal(get(r, 'Total with tax').value, 54.24);
  assert.equal(get(r, 'Total with tax').primary, true);
  assert.equal(get(r, 'Total with tax').prefix, '$');
});

test('add tax: $100 at 7% is $7 and $107; quantity multiplies the price first', () => {
  assert.equal(calculate({ mode: 'add', price: 100, rate: 7, qty: 1 }).items[0].value, 107);
  const r = calculate({ mode: 'add', price: 19.99, rate: 6.25, qty: 3 });
  // 59.97 * 0.0625 = 3.748125 -> 3.75
  assert.equal(get(r, 'Price before tax (all items)').value, 59.97);
  assert.equal(get(r, 'Sales tax').value, 3.75);
  assert.equal(get(r, 'Total with tax').value, 63.72);
});

test('half a cent rounds up: $0.10 at 5% is 0.5 cents -> $0.01; no float drift at 8.875%', () => {
  assert.equal(get(calculate({ mode: 'add', price: 0.1, rate: 5, qty: 1 }), 'Sales tax').value, 0.01);
  // 100.00 * 8.875% = 8.875 -> 8.88
  assert.equal(get(calculate({ mode: 'add', price: 100, rate: 8.875, qty: 1 }), 'Sales tax').value, 8.88);
});

test('zero rate adds no tax', () => {
  const r = calculate({ mode: 'add', price: 25, rate: 0, qty: 1 });
  assert.equal(get(r, 'Sales tax').value, 0);
  assert.equal(r.items[0].value, 25);
});

test('remove tax: $107 at 7% is $100 before tax; round trip with add', () => {
  const r = calculate({ mode: 'remove', total: 107, rate: 7 });
  assert.equal(r.items[0].value, 100);
  assert.equal(get(r, 'Sales tax included').value, 7);
  for (const price of [49.99, 12.34, 0.99, 1234.56]) {
    const total = calculate({ mode: 'add', price, rate: 8.25, qty: 1 }).items[0].value;
    assert.equal(calculate({ mode: 'remove', total, rate: 8.25 }).items[0].value, price);
  }
});

test('remove tax: total with no exact match gives a note', () => {
  // at 50% tax, prices of $0.01 and $0.02 give totals $0.02 and $0.03; $0.01 total has no exact match
  const r = calculate({ mode: 'remove', total: 0.01, rate: 50 });
  assert.equal(r.notes.length, 2);
});

test('find rate: $50.00 to $54.25 is 8.5%', () => {
  const r = calculate({ mode: 'rate', price: 50, total: 54.25 });
  assert.equal(r.items[0].value, 8.5);
  assert.equal(get(r, 'Sales tax paid').value, 4.25);
  assert.equal(calculate({ mode: 'rate', price: 80, total: 80 }).items[0].value, 0);
});

test('invalid input returns an error, never NaN', () => {
  assert.ok(calculate({ mode: 'add', price: NaN, rate: 8, qty: 1 }).error);
  assert.ok(calculate({ mode: 'add', price: 10, rate: NaN, qty: 1 }).error);
  assert.ok(calculate({ mode: 'add', price: -5, rate: 8, qty: 1 }).error);
  assert.ok(calculate({ mode: 'add', price: 10, rate: -1, qty: 1 }).error);
  assert.ok(calculate({ mode: 'add', price: 10, rate: 101, qty: 1 }).error);
  assert.ok(calculate({ mode: 'add', price: 10, rate: 8, qty: 1.5 }).error);
  assert.ok(calculate({ mode: 'remove', total: 0, rate: 8 }).error);
  assert.ok(calculate({ mode: 'rate', price: 0, total: 10 }).error);
  assert.ok(calculate({ mode: 'rate', price: 50, total: 40 }).error);
  assert.ok(calculate({ mode: 'bogus' }).error);
});
