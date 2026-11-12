import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { payout: 8000000, years: 11, months: 0, kind: 'general', disabled: 'no', filed: 'yes' };
const get = (r, label) => r.items.find((i) => i.label.startsWith(label)).value;

test('国税庁の例：支給額800万円・勤続11年 → 控除440万円、課税180万円、所得税91,890円', () => {
  const r = calculate(base);
  assert.equal(get(r, '退職所得控除額'), 4400000);
  assert.equal(get(r, '課税退職所得金額'), 1800000);
  assert.equal(get(r, '所得税・復興特別所得税（復興税'), 91890);
  assert.equal(get(r, '住民税'), 180000);
  assert.equal(r.items[0].value, 91890 + 180000);
});

test('国税庁の例：2,300万円・勤続30年 → 控除1,500万円、課税400万円、所得税380,322円', () => {
  const r = calculate({ ...base, payout: 23000000, years: 30 });
  assert.equal(get(r, '退職所得控除額'), 15000000);
  assert.equal(get(r, '課税退職所得金額'), 4000000);
  assert.equal(get(r, '所得税・復興特別所得税（復興税'), 380322);
});

test('申告書なし：800万円×20.42% = 1,633,600円', () => {
  const r = calculate({ ...base, filed: 'no' });
  assert.equal(r.items[0].value, 1633600);
});

test('勤続10年2か月は11年に切り上げ（控除440万円）', () => {
  assert.equal(get(calculate({ ...base, years: 10, months: 2 }), '退職所得控除額'), 4400000);
});

test('勤続1年は控除80万円の下限、障害退職は100万円加算', () => {
  assert.equal(get(calculate({ ...base, years: 1, payout: 1500000 }), '退職所得控除額'), 800000);
  assert.equal(get(calculate({ ...base, years: 1, payout: 1500000, disabled: 'yes' }), '退職所得控除額'), 1800000);
});

test('控除額以下の退職金は課税0・税0', () => {
  const r = calculate({ ...base, payout: 4000000 });
  assert.equal(get(r, '課税退職所得金額'), 0);
  assert.equal(r.items[0].value, 0);
});

test('短期退職手当等：差額が300万円超なら150万円を引く式、特定役員は2分の1なし', () => {
  const s = calculate({ ...base, years: 3, kind: 'short', payout: 8000000 });
  // 控除120万円、差額680万円 → 680-150=530万円
  assert.equal(get(s, '課税退職所得金額'), 5300000);
  const e = calculate({ ...base, years: 3, kind: 'executive', payout: 8000000 });
  assert.equal(get(e, '課税退職所得金額'), 6800000);
});

test('住民税は市町村6%・道府県4%をそれぞれ100円未満切り捨て：課税1,801,000円 → 180,000円', () => {
  const r = calculate({ ...base, payout: 8003000 });
  assert.equal(get(r, '課税退職所得金額'), 1801000);
  assert.equal(get(r, '住民税'), 180000);
});

test('勤続3年で一般・控除後300万円超はエラー、300万円以下なら計算できる', () => {
  assert.ok(calculate({ ...base, years: 3, payout: 10000000 }).error);
  assert.ok(!calculate({ ...base, years: 3, payout: 4000000 }).error);
});

test('異常値：NaN・負数・月12・短期で6年はエラー', () => {
  assert.ok(calculate({ ...base, payout: NaN }).error);
  assert.ok(calculate({ ...base, payout: -1 }).error);
  assert.ok(calculate({ ...base, months: 12 }).error);
  assert.ok(calculate({ ...base, years: 6, kind: 'short' }).error);
  assert.ok(calculate({ ...base, years: 0, months: 0 }).error);
});
