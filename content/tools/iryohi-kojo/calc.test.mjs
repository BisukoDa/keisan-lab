import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { paid: 300000, reimbursed: 50000, income: 5000000, rate: '20', otc: 0 };
const ded = (o) => calculate({ ...base, ...o }).items[0].value;

test('国税庁の式：(30万−5万)−10万 = 15万円、所得税20%で3万円、住民税10%で1.5万円', () => {
  const r = calculate(base);
  assert.equal(r.items[0].value, 150000);
  assert.equal(r.items[1].value, 30000);
  assert.equal(r.items[2].value, 15000);
});

test('総所得金額等が200万円未満なら、10万円ではなく5%を引く', () => {
  assert.equal(ded({ income: 1500000 }), 250000 - 75000);
  assert.equal(ded({ income: 2000000 }), 150000); // 200万円ちょうどは10万円
  assert.equal(ded({ income: 0 }), 250000);
});

test('しきい値以下なら控除なし／補てんが医療費を上回っても0', () => {
  assert.equal(ded({ paid: 100000, reimbursed: 0 }), 0);
  assert.equal(ded({ paid: 100000, reimbursed: 500000 }), 0);
});

test('上限200万円', () => {
  assert.equal(ded({ paid: 5000000, reimbursed: 0 }), 2000000);
});

test('セルフメディケーション：12,000円超の部分、上限88,000円', () => {
  const v = (otc) => calculate({ ...base, otc }).items.at(-1).value;
  assert.equal(v(30000), 18000);
  assert.equal(v(10000), 0);
  assert.equal(v(500000), 88000);
});

test('異常値：NaN・負数・不正な税率はエラー', () => {
  assert.ok(calculate({ ...base, paid: NaN }).error);
  assert.ok(calculate({ ...base, income: -1 }).error);
  assert.ok(calculate({ ...base, rate: '15' }).error);
});
