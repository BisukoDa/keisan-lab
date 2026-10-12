import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const run = (o) => calculate({ direction: 'toIncl', amount: 10000, rate: '10', rounding: 'floor', ...o });
const vals = (r) => r.items.map((i) => i.value);

test('税抜10,000円・10%：税込11,000円、消費税1,000円（国税庁 総額表示の例）', () => {
  const r = run({});
  assert.deepEqual(vals(r), [11000, 1000, 10000]);
  assert.equal(r.items[0].primary, true);
});

test('税込から税抜：国税庁インボイスQ&A問57の例（60,000円・10%→5,454円、40,000円・8%→2,962円）', () => {
  const a = run({ direction: 'toExcl', amount: 60000 });
  assert.deepEqual(vals(a), [54546, 5454, 60000]);
  const b = run({ direction: 'toExcl', amount: 40000, rate: '8' });
  assert.deepEqual(vals(b), [37038, 2962, 40000]);
});

test('軽減税率8%：税抜1,980円→消費税158.4円→切捨て158円で税込2,138円', () => {
  assert.deepEqual(vals(run({ amount: 1980, rate: '8' })), [2138, 158, 1980]);
});

test('端数処理：税抜105円・10%（10.5円）は切捨て10、四捨五入11、切上げ11', () => {
  assert.equal(run({ amount: 105, rounding: 'floor' }).items[1].value, 10);
  assert.equal(run({ amount: 105, rounding: 'round' }).items[1].value, 11);
  assert.equal(run({ amount: 105, rounding: 'ceil' }).items[1].value, 11);
  assert.equal(run({ amount: 104, rounding: 'round' }).items[1].value, 10); // 10.4円
});

test('境界値：0円は全部0円、巨大な金額でも整数のまま', () => {
  assert.deepEqual(vals(run({ amount: 0 })), [0, 0, 0]);
  assert.deepEqual(vals(run({ amount: 0, direction: 'toExcl' })), [0, 0, 0]);
  assert.deepEqual(vals(run({ amount: 1e12 })), [1.1e12, 1e11, 1e12]);
});

test('税込から税抜に戻して税込に直すと、切捨てでは元に戻らない場合がある', () => {
  const excl = run({ direction: 'toExcl', amount: 999, rate: '8' }).items[0].value; // 999-74=925
  assert.equal(excl, 925);
  assert.equal(run({ amount: excl, rate: '8' }).items[0].value, 999); // 925+74
});

test('異常値（空欄・負数・小数・不正な選択）はエラーを返す', () => {
  assert.ok(calculate({ direction: 'toIncl', amount: NaN, rate: '10', rounding: 'floor' }).error);
  assert.ok(run({ amount: -1 }).error);
  assert.ok(run({ amount: 10.5 }).error);
  assert.ok(run({ amount: 2e12 }).error);
  assert.ok(run({ rate: '5' }).error);
  assert.ok(run({ rounding: 'x' }).error);
  assert.ok(run({ direction: 'x' }).error);
});
