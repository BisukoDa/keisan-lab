import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, simulate } from './calc.js';

// 等比数列の和による閉じた式（期末払い年金終価）で検算する
const fv = (m, rate, years) => {
  const i = rate / 100 / 12;
  const n = years * 12;
  return i === 0 ? m * n : m * ((1 + i) ** n - 1) / i;
};

test('月3万円・年5%・20年（月利＝年利÷12・月末入金）は期末払い年金終価の式と一致し約1,233万円', () => {
  const r = simulate({ monthly: 30000, initial: 0, rate: 5, years: 20 });
  assert.ok(Math.abs(r.balance - fv(30000, 5, 20)) < 1e-4);
  assert.equal(Math.round(r.balance / 10000), 1233);
  assert.equal(r.principal, 7_200_000);
});

test('一括投資のみは (1 + 年利/12)^(12×年数) 倍になる', () => {
  const r = simulate({ monthly: 0, initial: 1_000_000, rate: 5, years: 10 });
  assert.ok(Math.abs(r.balance - 1_000_000 * (1 + 0.05 / 12) ** 120) < 1e-4);
});

test('利回り 0% なら資産額は元本と一致する', () => {
  const r = calculate({ monthly: 10000, initial: 50000, rate: 0, years: 3 });
  assert.equal(r.items[0].value, 50000 + 10000 * 36);
  assert.equal(r.items[2].value, 0);
});

test('1年ごとの表は年数分の行があり、最終行が結果と一致する', () => {
  const r = calculate({ monthly: 30000, initial: 0, rate: 5, years: 20 });
  assert.equal(r.table.rows.length, 20);
  assert.equal(r.table.rows.at(-1)[2], r.items[0].value);
});

test('マイナス利回りでは元本を下回る', () => {
  const r = calculate({ monthly: 10000, initial: 0, rate: -3, years: 10 });
  assert.ok(r.items[0].value < r.items[1].value);
});

test('不正な入力はエラーを返す', () => {
  assert.ok(calculate({ monthly: NaN, initial: 0, rate: 5, years: 20 }).error);
  assert.ok(calculate({ monthly: 0, initial: 0, rate: 5, years: 20 }).error);
  assert.ok(calculate({ monthly: 10000, initial: 0, rate: 5, years: 0 }).error);
  assert.ok(calculate({ monthly: 10000, initial: 0, rate: 5, years: 2.5 }).error);
  assert.ok(calculate({ monthly: -1, initial: 0, rate: 5, years: 20 }).error);
  assert.ok(calculate({ monthly: 10000, initial: 0, rate: 31, years: 20 }).error);
  assert.ok(calculate({ monthly: 1e8 + 1, initial: 0, rate: 5, years: 20 }).error);
  assert.ok(calculate({ monthly: 0, initial: 1e10 + 1, rate: 5, years: 20 }).error);
});
