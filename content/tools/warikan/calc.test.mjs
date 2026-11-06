import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { total: 28000, people: 6, unit: '100', heavy: 0, diff: 0 };

test('28,000円を6人・100円単位：4,700円、余り200円', () => {
  const r = calculate(base);
  assert.equal(r.items[0].value, 4700);
  assert.equal(r.items.find((i) => i.label === '集まる金額').value, 28200);
  assert.equal(r.items.find((i) => i.label.startsWith('余り')).value, 200);
});

test('割り切れる場合は余りが0（30,000円÷6人）', () => {
  const r = calculate({ ...base, total: 30000, unit: '1000' });
  assert.equal(r.items[0].value, 5000);
  assert.equal(r.items.find((i) => i.label.startsWith('余り')).value, 0);
});

test('1円単位：10,000円÷3人は3,334円（切り上げ）', () => {
  assert.equal(calculate({ ...base, total: 10000, people: 3, unit: '1' }).items[0].value, 3334);
});

test('多めに払う人：6人中2人が1,000円多い → 少なめ4,400円・多め5,400円', () => {
  const r = calculate({ ...base, heavy: 2, diff: 1000 });
  assert.equal(r.items[0].value, 4400);
  assert.equal(r.items[1].value, 5400);
  assert.ok(r.items.find((i) => i.label === '集まる金額').value >= 28000);
});

test('どの単位でも不足は出ない（集まる金額 ≧ 合計）', () => {
  for (const unit of ['1', '10', '100', '500', '1000']) {
    for (const people of [1, 2, 3, 7, 11]) {
      const r = calculate({ total: 12345, people, unit, heavy: 0, diff: 0 });
      assert.ok(r.items.find((i) => i.label.startsWith('余り')).value >= 0);
    }
  }
});

test('1人だけの場合は合計がそのまま', () => {
  assert.equal(calculate({ ...base, people: 1, unit: '1' }).items[0].value, 28000);
});

test('異常値：空欄・0人・負数・小数・上乗せ過大はエラー', () => {
  assert.ok(calculate({ ...base, total: NaN }).error);
  assert.ok(calculate({ ...base, people: NaN }).error);
  assert.ok(calculate({ ...base, people: 0 }).error);
  assert.ok(calculate({ ...base, total: -100 }).error);
  assert.ok(calculate({ ...base, people: 2.5 }).error);
  assert.ok(calculate({ ...base, heavy: 7, diff: 100 }).error);
  assert.ok(calculate({ ...base, total: 1000, people: 2, heavy: 1, diff: 2000 }).error);
});
