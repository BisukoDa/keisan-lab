import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const get = (args) => calculate({ places: '2', ...args }).items;

test("fixed points: 32 °F = 0 °C = 273.15 K", () => {
  const items = get({ value: 32, from: "F" });
  assert.equal(items.find((i) => i.label.endsWith("Celsius")).value, 0);
  assert.equal(items.find((i) => i.label.endsWith("Kelvin")).value, 273.15);
});

test('Fahrenheit to Celsius and Kelvin', () => {
  const items = get({ value: 212, from: 'F' });
  assert.equal(items.find((i) => i.label.endsWith('Celsius')).value, 100);
  assert.equal(items.find((i) => i.label.endsWith('Kelvin')).value, 373.15);
});

test('Celsius to Fahrenheit: 37 °C = 98.6 °F; −40 is the same in both scales', () => {
  assert.equal(get({ value: 37, from: 'C' }).find((i) => i.label.endsWith('Fahrenheit')).value, 98.6);
  assert.equal(get({ value: -40, from: 'C' }).find((i) => i.label.endsWith('Fahrenheit')).value, -40);
  assert.equal(get({ value: -40, from: 'F' }).find((i) => i.label.endsWith('Celsius')).value, -40);
});

test('98.6 °F is 37 °C and rounding follows the chosen places', () => {
  assert.equal(get({ value: 98.6, from: 'F' }).find((i) => i.label.endsWith('Celsius')).value, 37);
  const r = calculate({ value: 100, from: 'F', places: '1' });
  assert.equal(r.items.find((i) => i.label.endsWith('Celsius')).value, 37.8); // 37.777…
  assert.equal(calculate({ value: 100, from: 'F', places: '0' }).items[0].value, 38);
});

test('Kelvin: 0 K is −273.15 °C and −459.67 °F; no negative zero', () => {
  const items = get({ value: 0, from: 'K' });
  assert.equal(items.find((i) => i.label.endsWith('Celsius')).value, -273.15);
  assert.equal(items.find((i) => i.label.endsWith('Fahrenheit')).value, -459.67);
  const z = get({ value: 32, from: 'F' }).find((i) => i.label.endsWith('Celsius')).value;
  assert.ok(Object.is(z, 0));
});

test('invalid input returns an error, not NaN', () => {
  assert.ok(calculate({ value: NaN, from: 'F', places: '1' }).error);
  assert.ok(calculate({ value: -500, from: 'F', places: '1' }).error);
  assert.ok(calculate({ value: -1, from: 'K', places: '1' }).error);
  assert.ok(calculate({ value: 1e12, from: 'C', places: '1' }).error);
});
