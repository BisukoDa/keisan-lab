import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const first = (args) => calculate(args).items[0];

test('X% of Y: 15% of 200 is 30, leaving 170', () => {
  const r = calculate({ mode: 'of', pct: 15, base: 200 });
  assert.equal(r.items[0].value, 30);
  assert.equal(r.items[1].value, 170);
  assert.equal(calculate({ mode: 'of', pct: 150, base: 200 }).items.length, 1); // no "remaining" above 100%
});

test('X is what percent of Y: 30 of 120 is 25%; 1 of 3 is 33.33%', () => {
  assert.equal(first({ mode: 'ratio', part: 30, whole: 120 }).value, 25);
  const third = first({ mode: 'ratio', part: 1, whole: 3 });
  assert.equal(third.value, 33.33);
  assert.equal(third.digits, 2);
});

test('X is P% of what: 30 is 25% of 120; 45 is 15% of 300', () => {
  assert.equal(first({ mode: 'whole', part: 30, share: 25 }).value, 120);
  assert.equal(first({ mode: 'whole', part: 45, share: 15 }).value, 300);
});

test('Percentage change follows the BLS method: (new − old) ÷ old × 100', () => {
  // BLS example style: an index moving from 80 to 100 is a 25% increase
  const up = calculate({ mode: 'change', from: 80, to: 100 });
  assert.equal(up.items[0].label, 'Percentage increase');
  assert.equal(up.items[0].value, 25);
  assert.equal(up.items[1].value, '+20');
  const down = calculate({ mode: 'change', from: 120, to: 90 });
  assert.equal(down.items[0].label, 'Percentage decrease');
  assert.equal(down.items[0].value, 25);
  assert.equal(down.items[2].value, '0.75');
});

test('Percentage difference uses the average: 80 vs 100 is 22.22%', () => {
  const r = calculate({ mode: 'difference', from: 80, to: 100 });
  assert.equal(r.items[0].value, 22.22);
  assert.equal(r.items[2].value, 90);
  // symmetric: swapping A and B gives the same answer
  assert.equal(calculate({ mode: 'difference', from: 100, to: 80 }).items[0].value, 22.22);
});

test('Discounts and increases: $80 with 25% off is $60; $50 plus 8% tax is $54', () => {
  const off = calculate({ mode: 'off', pct: 25, base: 80 });
  assert.equal(off.items[0].value, 60);
  assert.equal(off.items[1].value, 20);
  assert.equal(first({ mode: 'increase', pct: 8, base: 50 }).value, 54);
  assert.equal(first({ mode: 'increase', pct: 10, base: 110 }).value, 121); // no 120.99999 noise
});

test('Small results are not rounded to zero', () => {
  const tiny = first({ mode: 'of', pct: 3, base: 0.1 });
  assert.equal(tiny.value, 0.003);
  assert.equal(tiny.digits, 3);
});

test('Invalid inputs return an error instead of NaN or Infinity', () => {
  assert.ok(calculate({ mode: 'ratio', part: 5, whole: 0 }).error);
  assert.ok(calculate({ mode: 'whole', part: 5, share: 0 }).error);
  assert.ok(calculate({ mode: 'change', from: 0, to: 5 }).error);
  assert.ok(calculate({ mode: 'difference', from: 0, to: 0 }).error);
  assert.ok(calculate({ mode: 'difference', from: -5, to: 5 }).error);
  assert.ok(calculate({ mode: 'off', pct: 120, base: 100 }).error);
  assert.ok(calculate({ mode: 'of', pct: NaN, base: 100 }).error);
  assert.ok(calculate({ mode: 'nope' }).error);
});
