import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, interestBefore, taxOf } from './calc.js';

const base = { principal: 1000000, rate: 1, months: 12, method: 'simple' };

test('100万円・年1%・1年の単利は利息10,000円、税2,031円（15.315%＝1,531円＋5%＝500円）、税引後7,969円', () => {
  const r = calculate(base);
  assert.equal(r.items[1].value, 10000);
  assert.equal(r.items[2].value, 2031);
  assert.equal(r.items[0].value, 7969);
  assert.equal(r.items[3].value, 1007969);
});

test('税引前の利息に対し、税引後はおよそ 79.685%（＝1−0.20315）になる', () => {
  const r = calculate({ ...base, principal: 100000000 });
  assert.equal(r.items[1].value, 1000000);
  assert.equal(r.items[0].value, 1000000 - 153150 - 50000);
});

test('半年複利：100万円・年2%・5年は 100万×1.01^10 − 100万 ＝ 104,622円（定義式で独立に検算）', () => {
  assert.equal(interestBefore(1000000, 2, 60, 'half'), Math.floor(1000000 * 1.01 ** 10 - 1000000));
  assert.equal(interestBefore(1000000, 2, 60, 'half'), 104622);
});

test('1年複利：100万円・年2%・5年は 100万×1.02^5 − 100万 ＝ 104,080円', () => {
  assert.equal(interestBefore(1000000, 2, 60, 'year'), 104080);
});

test('複利の周期で割り切れない期間（18か月・1年複利）は、1年分を複利にして残り6か月を月割りで加える', () => {
  assert.equal(interestBefore(1000000, 1, 18, 'year'), 15050 /* 1,000,000×1.01＝1,010,000 → ×(1＋0.01×6/12)＝1,015,050 */);
});

test('年利 0% なら利息も税金も 0 で、受取総額は元本と同じ', () => {
  const r = calculate({ ...base, rate: 0 });
  assert.equal(r.items[0].value, 0);
  assert.equal(r.items[3].value, 1000000);
});

test('利息が少額で税が 0 円になる境界（利息 6 円）', () => {
  assert.equal(taxOf(6), 0);
  assert.equal(taxOf(7), 1);
});

test('不正な入力はエラーを返す', () => {
  assert.ok(calculate({ ...base, principal: NaN }).error);
  assert.ok(calculate({ ...base, principal: 0 }).error);
  assert.ok(calculate({ ...base, principal: -1 }).error);
  assert.ok(calculate({ ...base, rate: -0.1 }).error);
  assert.ok(calculate({ ...base, rate: 21 }).error);
  assert.ok(calculate({ ...base, months: 0 }).error);
  assert.ok(calculate({ ...base, months: 1.5 }).error);
  assert.ok(calculate({ ...base, months: 601 }).error);
  assert.ok(calculate({ ...base, method: 'x' }).error);
});

test('浮動小数点の落とし穴：300万円・0.35%・12か月は 10,500円、1万円・0.03%は 3円、1万円・0.7%は 70円', () => {
  assert.equal(interestBefore(3000000, 0.35, 12, 'simple'), 10500);
  assert.equal(interestBefore(10000, 0.03, 12, 'simple'), 3);
  assert.equal(interestBefore(10000, 0.7, 12, 'simple'), 70);
  assert.equal(interestBefore(50000, 0.35, 12, 'simple'), 175);
});

test('低金利の少額例：100万円・0.002%・12か月は利息20円・税4円・手取り16円', () => {
  const r = calculate({ ...base, rate: 0.002 });
  assert.deepEqual([r.items[1].value, r.items[2].value, r.items[0].value], [20, 4, 16]);
});
