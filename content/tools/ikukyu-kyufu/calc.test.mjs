import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const run = (o) => calculate({ monthly: 300000, months: 12, support: 'no', ...o });

test('公的資料の例：賃金日額10,000円 → 30日×67%＝201,000円、28日×13%＝36,400円', () => {
  const r = run({ months: 1, support: 'yes' });
  assert.equal(r.items[2].value, 10000);
  assert.deepEqual(r.table.rows[0].slice(2), [201000, 36400, 237400]);
});

test('上限：月収80万円 → 賃金日額16,540円、67%で332,454円・50%で248,100円（公表の上限額と一致）', () => {
  const r = run({ monthly: 800000, months: 7 });
  assert.equal(r.items.find((i) => i.label === '休業開始時賃金日額').value, 16540);
  assert.equal(r.table.rows[0][4], 332454);
  assert.equal(r.table.rows[6][4], 248100);
  assert.ok(r.notes[0].includes('上限'));
});

test('下限：月収5万円 → 賃金日額3,203円、64,380円と11,658円（公表の下限額と一致）', () => {
  const r = run({ monthly: 50000, months: 1, support: 'yes' });
  assert.deepEqual(r.table.rows[0].slice(2), [64380, 11658, 76038]);
});

test('月収30万円・12か月：1〜6か月目は67%、7か月目以降は50%、合計2,142,400円（支援給付金あり）', () => {
  const r = run({ support: 'yes' });
  assert.equal(r.items[0].value, 237400);
  assert.equal(r.items[1].label, '7か月目以降の月額');
  assert.equal(r.items[1].value, 150000);
  assert.equal(r.items[2].value, 2142400);
});

test('6か月以内の休業では7か月目以降の項目を出さない。上限と下限の境目（日数÷180）も切り捨て', () => {
  const r = run({ months: 6 });
  assert.ok(!r.items.some((i) => i.label.includes('7か月目')));
  assert.equal(run({ monthly: 100001, months: 1 }).items[2].value, 3333);
});

test('異常値はエラー（NaN・0・負数・小数の月数・範囲外）', () => {
  assert.ok(calculate({ monthly: NaN, months: 12, support: 'no' }).error);
  assert.ok(run({ monthly: 0 }).error);
  assert.ok(run({ monthly: -1 }).error);
  assert.ok(run({ months: 0 }).error);
  assert.ok(run({ months: 25 }).error);
  assert.ok(run({ months: 1.5 }).error);
  assert.ok(run({ months: NaN }).error);
  assert.ok(run({ support: 'x' }).error);
});
