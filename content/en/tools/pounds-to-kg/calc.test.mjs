import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const val = (r, label) => r.items.find((i) => i.label === label).value;

test('1 lb = 0.45359237 kg exactly (NIST)', () => {
  assert.equal(val(calculate({ mode: 'toKg', lb: 1, oz: 0, places: '3' }), 'Kilograms'), 0.454);
  assert.equal(val(calculate({ mode: 'toKg', lb: 1000, oz: 0, places: '3' }), 'Kilograms'), 453.592);
});

test('150 lb = 68.04 kg; 16 oz equals 1 lb', () => {
  assert.equal(val(calculate({ mode: 'toKg', lb: 150, oz: 0, places: '2' }), 'Kilograms'), 68.04);
  assert.equal(
    val(calculate({ mode: 'toKg', lb: 0, oz: 16, places: '3' }), 'Kilograms'),
    val(calculate({ mode: 'toKg', lb: 1, oz: 0, places: '3' }), 'Kilograms'),
  );
});

test('7 lb 8 oz = 7.5 lb = 3.402 kg', () => {
  const r = calculate({ mode: 'toKg', lb: 7, oz: 8, places: '3' });
  assert.equal(val(r, 'Kilograms'), 3.402);
  assert.equal(val(r, 'Total pounds'), 7.5);
});

test('kilograms to pounds: 1 kg = 2.205 lb; 68 kg = 149.9 lb', () => {
  assert.equal(val(calculate({ mode: 'toLb', kg: 1, places: '3' }), 'Pounds'), 2.205);
  assert.equal(val(calculate({ mode: 'toLb', kg: 68, places: '1' }), 'Pounds'), 149.9);
});

test('whole pounds plus ounces and stone split', () => {
  const r = calculate({ mode: 'toLb', kg: 68, places: '1' }); // 149.914 lb = 149 lb 14.6 oz
  assert.equal(val(r, 'Whole pounds'), 149);
  assert.equal(val(r, 'Plus ounces'), 14.6);
  assert.equal(val(r, 'Stone (whole)'), 10);
  assert.equal(val(r, 'Plus pounds (after stone)'), 9);
});

test('rounding up to 16 ounces carries into a pound', () => {
  const r = calculate({ mode: 'toLb', kg: 0.4535, places: '0' });
  assert.equal(val(r, 'Whole pounds'), 1);
  assert.equal(val(r, 'Plus ounces'), 0);
});

test('zero allowed; blank pounds counts as zero', () => {
  assert.equal(val(calculate({ mode: 'toKg', lb: 0, oz: 0, places: '1' }), 'Kilograms'), 0);
  assert.equal(val(calculate({ mode: 'toKg', lb: NaN, oz: 16, places: '3' }), 'Kilograms'), 0.454);
});

test('invalid input returns an error, not NaN', () => {
  assert.ok(calculate({ mode: 'toKg', lb: NaN, oz: NaN, places: '1' }).error);
  assert.ok(calculate({ mode: 'toKg', lb: -1, oz: 0, places: '1' }).error);
  assert.ok(calculate({ mode: 'toLb', kg: NaN, places: '1' }).error);
  assert.ok(calculate({ mode: 'toLb', kg: -5, places: '1' }).error);
  assert.ok(calculate({ mode: 'toLb', kg: 1e12, places: '1' }).error);
});
