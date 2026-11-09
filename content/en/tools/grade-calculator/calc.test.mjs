import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const fin = (current, weight, target) => calculate({ mode: 'final', current, weight, target });

test('final exam: 75% now, final worth 40%, target 80% needs 87.5%', () => {
  const r = fin(75, 40, 80);
  assert.equal(r.items[0].value, 87.5);
  assert.equal(r.items[1].value, 85); // 0.6*75 + 40
  assert.equal(r.items[2].value, 45);
});

test('final exam: 88% now, final worth 25%, target 90% needs 96%', () => {
  assert.equal(fin(88, 25, 90).items[0].value, 96);
});

test('final exam: unreachable and already-reached targets', () => {
  const hi = fin(60, 20, 95);
  assert.ok(hi.items[0].value > 100);
  assert.ok(hi.notes[0].includes('above 100%'));
  const done = fin(95, 20, 70);
  assert.equal(done.items[0].value, 0);
  assert.ok(done.notes[0].includes('already'));
});

test('final exam: weight 100% means the final must equal the target; rounding never understates', () => {
  assert.equal(fin(50, 100, 90).items[0].value, 90);
  // (86 - 82*0.7)/0.3 = 95.3333… -> 95.34 (rounded up)
  assert.equal(fin(82, 30, 86).items[0].value, 95.34);
});

test('final exam: invalid input returns an error', () => {
  assert.ok(fin(NaN, 30, 85).error);
  assert.ok(fin(80, 0, 85).error);
  assert.ok(fin(80, 101, 85).error);
  assert.ok(fin(-1, 30, 85).error);
});

test('weighted grade: 92/20, 85/20, 78/30 = 84 over the 70% graded', () => {
  const r = calculate({ mode: 'weighted', w1: 20, s1: 92, w2: 20, s2: 85, w3: 30, s3: 78, w4: NaN, s4: NaN, w5: NaN, s5: NaN });
  // (18.4 + 17 + 23.4) / 0.70 = 84
  assert.equal(r.items[0].value, 84);
  assert.equal(r.items[1].value, 'B');
  assert.equal(r.items[2].value, 70);
  assert.equal(r.table.rows.length, 3);
});

test('weighted grade: errors for half-filled rows, over 100% weights and empty form', () => {
  assert.ok(calculate({ mode: 'weighted', w1: 20, s1: NaN }).error);
  assert.ok(calculate({ mode: 'weighted', w1: 60, s1: 90, w2: 50, s2: 80 }).error);
  assert.ok(calculate({ mode: 'weighted' }).error);
  assert.ok(calculate({ mode: 'weighted', w1: 50, s1: -5 }).error);
});

test('weighted grade: full course at 100% weight equals the weighted mean', () => {
  const r = calculate({ mode: 'weighted', w1: 50, s1: 100, w2: 50, s2: 70 });
  assert.equal(r.items[0].value, 85);
});

test('extreme values return errors, never Infinity or NaN', () => {
  assert.ok(fin(1e308, 30, 1e308).error);
  assert.ok(fin(Infinity, 30, 80).error);
  assert.ok(calculate({ mode: 'weighted', w1: 10, s1: 1e308, w2: 10, s2: 1e308 }).error);
  assert.ok(calculate({ mode: 'weighted', w1: 200, s1: 90 }).error);
  assert.ok(calculate({ mode: 'weighted', w1: 0, s1: 90 }).error);
  const ok = calculate({ mode: 'weighted', w1: 50, s1: 90, w2: 50, s2: 80 });
  assert.ok(!JSON.stringify(ok).match(/Infinity|NaN/));
});

test('final exam: floating-point noise never adds 0.01 to the needed score', () => {
  // (62 - 60.7*0.75)/0.25 = 65.9 exactly
  assert.equal(fin(60.7, 25, 62).items[0].value, 65.9);
  // (63 - 90*0.7)/0.3 = 0 exactly -> already reached
  const zero = fin(90, 30, 63);
  assert.equal(zero.items[0].value, 0);
  assert.ok(zero.notes[0].includes('already'));
  // (94.5 - 60.7*0.5)/0.5 = 128.3 exactly -> out of reach
  const hi = fin(60.7, 50, 94.5);
  assert.equal(hi.items[0].value, 128.3);
  assert.ok(hi.notes[0].includes('above 100%'));
  // a needed score just above 100 is still flagged
  assert.ok(fin(70, 30, 79.01).notes[0].includes('above 100%'));
});

test('tiny or out-of-range weights and grades return errors, never Infinity', () => {
  assert.ok(fin(80, 5e-324, 85).error);
  assert.ok(fin(80, 1e-300, 85).error);
  assert.ok(fin(80, 0.009, 85).error);
  assert.ok(!fin(80, 0.01, 85).error);
  assert.ok(fin(201, 30, 85).error);
  assert.ok(fin(80, 30, 201).error);
  assert.ok(calculate({ mode: 'weighted', w1: 5e-324, s1: 90 }).error);
  assert.ok(calculate({ mode: 'weighted', w1: 0.001, s1: 90 }).error);
  assert.ok(calculate({ mode: 'weighted', w1: 50, s1: 201 }).error);
  const cases = [fin(0, 0.01, 200), fin(200, 0.01, 0), fin(82, 30, 85), fin(60, 20, 95),
    calculate({ mode: 'weighted', w1: 0.01, s1: 200 }), calculate({ mode: 'weighted', w1: 100, s1: 0 })];
  for (const r of cases) {
    assert.equal(r.error, undefined);
    assert.ok(!/Infinity|NaN|null/.test(JSON.stringify(r)));
  }
});
