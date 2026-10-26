import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, TSUBO_M2 } from './calc.js';

const get = (r, i) => r.items[i].value;

test('1坪は 400/121㎡（約3.3058㎡）', () => {
  assert.ok(Math.abs(TSUBO_M2 - 3.305785) < 1e-6);
  const r = calculate({ from: 'tsubo', value: 1, size: 'edoma' });
  assert.equal(get(r, 0), 3.31);
});

test('30坪は約99.17㎡、逆に100㎡は約30.25坪', () => {
  assert.equal(get(calculate({ from: 'tsubo', value: 30, size: 'edoma' }), 0), 99.17);
  assert.equal(get(calculate({ from: 'm2', value: 100, size: 'edoma' }), 1), 30.25);
});

test('畳：不動産基準 1.62㎡ で 6畳は 9.72㎡', () => {
  const r = calculate({ from: 'jo', value: 6, size: 'fudosan' });
  assert.equal(get(r, 0), 9.72);
  assert.equal(get(r, 2), 6);
});

test('畳の種類で面積が違う：江戸間 6畳は 9.29㎡、京間 6畳は 10.94㎡', () => {
  assert.equal(get(calculate({ from: 'jo', value: 6, size: 'edoma' }), 0), 9.29);
  assert.equal(get(calculate({ from: 'jo', value: 6, size: 'kyoma' }), 0), 10.94);
});

test('0 は 0、表は5行', () => {
  const r = calculate({ from: 'tsubo', value: 0, size: 'edoma' });
  assert.equal(get(r, 0), 0);
  assert.equal(r.table.rows.length, 5);
});

test('異常値：空欄・負数・不明な畳はエラー', () => {
  assert.ok(calculate({ from: 'tsubo', value: NaN, size: 'edoma' }).error);
  assert.ok(calculate({ from: 'tsubo', value: -1, size: 'edoma' }).error);
  assert.ok(calculate({ from: 'jo', value: 6, size: 'x' }).error);
});
