import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const val = (r, label) => r.items.find((i) => i.label === label).value;

test('1 inch = 2.54 cm exactly (NIST)', () => {
  const r = calculate({ mode: 'toCm', feet: 0, inches: 1, places: '2' });
  assert.equal(val(r, 'Centimeters'), 2.54);
});

test('1 foot = 30.48 cm; 6 feet = 182.88 cm', () => {
  assert.equal(val(calculate({ mode: 'toCm', feet: 1, inches: 0, places: '2' }), 'Centimeters'), 30.48);
  assert.equal(val(calculate({ mode: 'toCm', feet: 6, inches: 0, places: '2' }), 'Centimeters'), 182.88);
});

test('5 ft 9 in = 175.26 cm; rounding follows places', () => {
  assert.equal(val(calculate({ mode: 'toCm', feet: 5, inches: 9, places: '2' }), 'Centimeters'), 175.26);
  assert.equal(val(calculate({ mode: 'toCm', feet: 5, inches: 9, places: '0' }), 'Centimeters'), 175);
});

test('centimeters to feet and inches', () => {
  const r = calculate({ mode: 'toIn', cm: 30.48, places: '1' });
  assert.equal(val(r, 'Feet'), 1);
  assert.equal(val(r, 'Plus inches'), 0);
  const r2 = calculate({ mode: 'toIn', cm: 175, places: '1' });
  assert.equal(val(r2, 'Feet'), 5);
  assert.equal(val(r2, "Plus inches"), 8.9); // 175 / 2.54 = 68.898 in = 5 ft 8.898 in
});

test('rounding up to 12 inches carries into a foot', () => {
  const r = calculate({ mode: 'toIn', cm: 30.4, places: '0' });
  assert.equal(val(r, 'Feet'), 1);
  assert.equal(val(r, 'Plus inches'), 0);
});

test('zero is allowed; blank feet counts as zero', () => {
  assert.equal(val(calculate({ mode: 'toCm', feet: 0, inches: 0, places: '1' }), 'Centimeters'), 0);
  assert.equal(val(calculate({ mode: 'toCm', feet: NaN, inches: 10, places: '1' }), 'Centimeters'), 25.4);
});

test('invalid input returns an error, not NaN', () => {
  assert.ok(calculate({ mode: 'toCm', feet: NaN, inches: NaN, places: '1' }).error);
  assert.ok(calculate({ mode: 'toCm', feet: -1, inches: 0, places: '1' }).error);
  assert.ok(calculate({ mode: 'toIn', cm: NaN, places: '1' }).error);
  assert.ok(calculate({ mode: 'toIn', cm: -5, places: '1' }).error);
  assert.ok(calculate({ mode: 'toIn', cm: 1e12, places: '1' }).error);
});
