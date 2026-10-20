import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, requiredMonthly } from './calc.js';

test('利回り 0%：500万円を10年なら 5,000,000 ÷ 120 = 41,667円（切り上げ）', () => {
  const r = calculate({ goal: 5_000_000, initial: 0, rate: 0, years: 10 });
  assert.equal(r.items[0].value, 41667);
  assert.equal(r.items[1].value, 500004);
});

test('今ある貯金は目標から引かれる（利回り 0%）', () => {
  const r = calculate({ goal: 1_200_000, initial: 600_000, rate: 0, years: 5 });
  assert.equal(r.items[0].value, 10000);
});

test('年5%・20年・1,233万円の目標は、月3万円（積立ツールの検算値）に近い', () => {
  const m = requiredMonthly({ goal: 12_331_010, initial: 0, rate: 5, years: 20 });
  assert.ok(Math.abs(m - 30000) < 1);
});

test('逆算した月額で積み立てると資産額が目標以上になる（一括投資ありでも）', () => {
  for (const [goal, initial, rate, years] of [[10_000_000, 500_000, 3, 15], [3_000_000, 0, -2, 7], [8_000_000, 2_000_000, 4.5, 12]]) {
    const r = calculate({ goal, initial, rate, years });
    const balance = r.items.at(-1).value;
    assert.ok(balance >= goal - 1, `${goal} ${balance}`);
    assert.ok(balance - goal < 1000);
  }
});

test('今ある貯金だけで目標に届くなら毎月 0 円', () => {
  const r = calculate({ goal: 1_000_000, initial: 2_000_000, rate: 0, years: 3 });
  assert.equal(r.items[0].value, 0);
  assert.ok(!r.error);
});

test('不正な入力はエラーを返す', () => {
  assert.ok(calculate({ goal: NaN, initial: 0, rate: 0, years: 5 }).error);
  assert.ok(calculate({ goal: 0, initial: 0, rate: 0, years: 5 }).error);
  assert.ok(calculate({ goal: -1, initial: 0, rate: 0, years: 5 }).error);
  assert.ok(calculate({ goal: 1e6, initial: -1, rate: 0, years: 5 }).error);
  assert.ok(calculate({ goal: 1e6, initial: 0, rate: 0, years: 0 }).error);
  assert.ok(calculate({ goal: 1e6, initial: 0, rate: 0, years: 2.5 }).error);
  assert.ok(calculate({ goal: 1e6, initial: 0, rate: 31, years: 5 }).error);
  assert.ok(calculate({ goal: 1e6, initial: NaN, rate: 0, years: 5 }).error);
});
