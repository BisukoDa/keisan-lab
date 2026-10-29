import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const get = (r, label) => r.items.find((i) => i.label === label);

test('sale price: $80 with 25% off is $60, saving $20', () => {
  const r = calculate({ mode: 'sale', original: 80, off: 25, extra: 0 });
  assert.equal(get(r, 'Sale price').value, 60);
  assert.equal(get(r, 'Sale price').primary, true);
  assert.equal(get(r, 'You save').value, 20);
  assert.equal(r.items.length, 2);
});

test('sale price rounds to the cent: $19.99 at 15% off is 16.9915 -> $16.99', () => {
  const r = calculate({ mode: 'sale', original: 19.99, off: 15, extra: 0 });
  assert.equal(get(r, 'Sale price').value, 16.99);
  assert.equal(get(r, 'You save').value, 3);
});

test('half a cent rounds up: $0.10 at 5% off is 9.5 cents -> $0.10; no float drift', () => {
  assert.equal(get(calculate({ mode: 'sale', original: 0.1, off: 5, extra: 0 }), 'Sale price').value, 0.1);
  // 100.00 * (1 - 0.08875) = 91.125 -> 91.13
  assert.equal(get(calculate({ mode: 'sale', original: 100, off: 8.875, extra: 0 }), 'Sale price').value, 91.13);
});

test('stacked discounts: 20% then extra 10% on $100 is $72, a 28% combined discount', () => {
  const r = calculate({ mode: 'sale', original: 100, off: 20, extra: 10 });
  assert.equal(get(r, 'Sale price').value, 72);
  assert.equal(get(r, 'Combined discount').value, 28);
  assert.equal(r.notes.length, 2);
});

test('blank extra is treated as no extra discount; 0% and 100% off work', () => {
  assert.equal(get(calculate({ mode: 'sale', original: 50, off: 10, extra: NaN }), 'Sale price').value, 45);
  assert.equal(get(calculate({ mode: 'sale', original: 50, off: 0, extra: 0 }), 'Sale price').value, 50);
  assert.equal(get(calculate({ mode: 'sale', original: 50, off: 100, extra: 0 }), 'Sale price').value, 0);
});

test('percent off: $80 to $60 is 25%; $59.99 to $44.99 is 25.00%', () => {
  const r = calculate({ mode: 'percent', original: 80, sale: 60 });
  assert.equal(r.items[0].value, 25);
  assert.equal(get(r, 'You save').value, 20);
  assert.equal(calculate({ mode: 'percent', original: 59.99, sale: 44.99 }).items[0].value, 25.0);
  assert.equal(calculate({ mode: 'percent', original: 40, sale: 40 }).items[0].value, 0);
  assert.equal(calculate({ mode: 'percent', original: 40, sale: 0 }).items[0].value, 100);
});

test('original price: $60 after 25% off was $80; round trip with sale mode', () => {
  const r = calculate({ mode: 'original', sale: 60, off: 25 });
  assert.equal(r.items[0].value, 80);
  assert.equal(get(r, 'Amount taken off').value, 20);
  for (const original of [49.99, 12.34, 0.99, 1234.56]) {
    const s = get(calculate({ mode: 'sale', original, off: 30, extra: 0 }), 'Sale price').value;
    const back = calculate({ mode: 'original', sale: s, off: 30 });
    const again = get(calculate({ mode: 'sale', original: back.items[0].value, off: 30, extra: 0 }), 'Sale price').value;
    assert.equal(again, s);
  }
});

test('invalid input returns an error, never NaN', () => {
  assert.ok(calculate({ mode: 'sale', original: NaN, off: 10, extra: 0 }).error);
  assert.ok(calculate({ mode: 'sale', original: 10, off: NaN, extra: 0 }).error);
  assert.ok(calculate({ mode: 'sale', original: -5, off: 10, extra: 0 }).error);
  assert.ok(calculate({ mode: 'sale', original: 10, off: 101, extra: 0 }).error);
  assert.ok(calculate({ mode: 'sale', original: 10, off: 10, extra: -1 }).error);
  assert.ok(calculate({ mode: 'percent', original: 0, sale: 5 }).error);
  assert.ok(calculate({ mode: 'percent', original: 50, sale: 60 }).error);
  assert.ok(calculate({ mode: 'percent', original: 50, sale: NaN }).error);
  assert.ok(calculate({ mode: 'original', sale: 50, off: 100 }).error);
  assert.ok(calculate({ mode: 'original', sale: 0, off: 10 }).error);
  assert.ok(calculate({ mode: 'bogus' }).error);
});
