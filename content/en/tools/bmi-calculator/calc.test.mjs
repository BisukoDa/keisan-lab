import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, categoryFor } from './calc.js';

const imp = (o = {}) => calculate({ units: 'imperial', feet: 5, inches: 9, pounds: 160, cm: NaN, kg: NaN, ...o });
const met = (o = {}) => calculate({ units: 'metric', feet: NaN, inches: NaN, pounds: NaN, cm: 175, kg: 72, ...o });

test('metric: 70 kg at 175 cm is BMI 22.9 (70 / 1.75^2 = 22.857)', () => {
  const r = met({ kg: 70 });
  assert.equal(r.items[0].value, 22.9);
  assert.equal(r.items[1].value, 'Healthy weight');
});

test('imperial: 160 lb at 5 ft 9 in matches the 703 formula (23.6)', () => {
  const r = imp();
  assert.equal(r.items[0].value, 23.6);
  assert.ok(Math.abs(703 * 160 / 69 ** 2 - 23.628) < 0.01);
});

test('category boundaries follow CDC cutoffs', () => {
  assert.equal(categoryFor(18.4), 'Underweight');
  assert.equal(categoryFor(18.5), 'Healthy weight');
  assert.equal(categoryFor(24.9), 'Healthy weight');
  assert.equal(categoryFor(25), 'Overweight');
  assert.equal(categoryFor(30), 'Obesity (Class 1)');
  assert.equal(categoryFor(35), 'Obesity (Class 2)');
  assert.equal(categoryFor(40), 'Obesity (Class 3, severe)');
});

test('healthy range for 175 cm is 56.7 to 76.3 kg', () => {
  const r = met();
  assert.equal(r.items[2].value, '56.7 to 76.3 kg');
});

test('overweight shows difference from top of range', () => {
  const r = met({ kg: 90 });
  assert.equal(r.items[0].value, 29.4);
  assert.equal(r.items[3].value, 76.3);
  assert.equal(r.items[4].value, 13.7);
});

test('underweight shows how far below the range', () => {
  const r = met({ kg: 50 });
  assert.equal(r.items[1].value, 'Underweight');
  assert.equal(r.items[4].value, 6.7);
});

test('invalid input returns an error, never NaN', () => {
  assert.ok(imp({ pounds: NaN }).error);
  assert.ok(imp({ feet: 0, inches: 0 }).error);
  assert.ok(imp({ feet: -1 }).error);
  assert.ok(met({ kg: 0 }).error);
  assert.ok(met({ kg: -5 }).error);
  assert.ok(met({ cm: 10 }).error);
  assert.ok(met({ cm: NaN }).error);
  assert.ok(calculate({ units: 'x' }).error);
});
