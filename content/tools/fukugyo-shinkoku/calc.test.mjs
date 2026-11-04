import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const one = { jobs: 'one', salary: 5000000, sideRevenue: 400000, sideExpense: 150000, unadjusted: NaN, deductions: NaN, withheld: 'yes' };
const status = (r) => r.items.find((i) => i.label === '判定').value;

test('勤務先1か所：副業の所得 25万円（収入40万−経費15万）は申告が必要', () => {
  const r = calculate(one);
  assert.equal(r.items[1].value, 250000);
  assert.equal(status(r), '所得税の確定申告が必要');
});

test('勤務先1か所：所得がちょうど20万円なら不要（20万円を超える場合だけ必要）', () => {
  const r = calculate({ ...one, sideRevenue: 350000, sideExpense: 150000 });
  assert.equal(r.items[1].value, 200000);
  assert.match(status(r), /不要/);
  const r2 = calculate({ ...one, sideRevenue: 350001, sideExpense: 150000 });
  assert.match(status(r2), /必要$/);
});

test('収入が大きくても経費を引いた所得が20万円以下なら不要（判断は所得）', () => {
  const r = calculate({ ...one, sideRevenue: 1000000, sideExpense: 850000 });
  assert.match(status(r), /不要/);
});

test('給与収入が 2,000万円を超えると必要、ちょうど 2,000万円は副業なしなら不要', () => {
  assert.match(status(calculate({ ...one, salary: 20000001, sideRevenue: 0, sideExpense: 0 })), /必要$/);
  assert.match(status(calculate({ ...one, salary: 20000000, sideRevenue: 0, sideExpense: 0 })), /不要/);
});

test('2か所以上：年末調整を受けなかった給与の収入15万＋副業の所得10万=25万は必要', () => {
  const r = calculate({ ...one, jobs: 'multi', unadjusted: 150000, deductions: 800000, sideRevenue: 300000, sideExpense: 200000 });
  assert.match(status(r), /必要$/);
});

test('2か所以上の例外：給与−所得控除が150万円以下かつ副業の所得20万円以下なら不要', () => {
  const r = calculate({ ...one, jobs: 'multi', salary: 2000000, unadjusted: 400000, deductions: 600000, sideRevenue: 100000, sideExpense: 0 });
  assert.match(status(r), /不要/);
});

test('源泉徴収されていない・わからない場合は要確認', () => {
  assert.equal(status(calculate({ ...one, sideRevenue: 0, sideExpense: 0, withheld: 'no' })), '要確認');
});

test('異常値：空欄・負数・不正な選択はエラー', () => {
  assert.ok(calculate({ ...one, salary: NaN }).error);
  assert.ok(calculate({ ...one, sideRevenue: -1 }).error);
  assert.ok(calculate({ ...one, jobs: 'x' }).error);
  assert.ok(calculate({ ...one, jobs: 'multi' }).error);
});

test('経費が収入を上回る（赤字）なら所得は負で、不要と判定', () => {
  const r = calculate({ ...one, sideRevenue: 100000, sideExpense: 300000 });
  assert.equal(r.items[1].value, -200000);
  assert.match(status(r), /不要/);
});

test('2か所以上：従たる給与の収入25万円（給与所得控除前）は副業なしでも20万円超で必要（国税庁は収入金額で合算）', () => {
  const r = calculate({ ...one, jobs: 'multi', salary: 5250000, unadjusted: 250000, deductions: 800000, sideRevenue: 0, sideExpense: 0 });
  assert.match(status(r), /必要$/);
});
