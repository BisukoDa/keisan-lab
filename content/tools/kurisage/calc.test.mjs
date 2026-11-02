import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, balanceAfter, monthlyPayment } from './calc.js';

const val = (r, label) => r.items.find((x) => x.label === label).value;
const base = { amount: 30_000_000, rate: 3, years: 35, elapsed: 120, prepay: 1_000_000, fee: 0 };

// ドコモSMTBネット銀行「繰上返済」掲載例（3,000万円・35年・年3.0%・10年後に100万円）
// https://www.netbk.co.jp/contents/jal/lineup/home-loan/first/kuriage/
test('掲載例：毎月の返済額・期間短縮型の残り期間・総返済額・返済額軽減型の返済額が一致する', () => {
  const r = calculate(base);
  const paidSoFar = 115_455 * 120;
  assert.equal(val(r, '繰上げしない場合の毎月の返済額'), 115_455);
  assert.equal(val(r, '【返済額軽減型】新しい毎月の返済額'), 110_712);
  assert.equal(val(r, '【期間短縮型】残りの返済期間'), 283); // 23年7か月
  const [none, short, reduce] = r.table.rows;
  assert.equal(paidSoFar + none[4], 48_490_768);
  assert.equal(paidSoFar + 1_000_000 + short[4], 47_420_210);
  assert.equal(paidSoFar + 1_000_000 + reduce[4], 48_068_271);
});

test('フラット35掲載例（2,000万円・年1.5%・30年）の60回目・120回目の残高が一致する', () => {
  const p = { amount: 20_000_000, rate: 1.5, years: 30 };
  assert.equal(balanceAfter(p, 60), 17_258_727);
  assert.equal(balanceAfter(p, 120), 14_304_092);
});

test('利息の軽減額は「繰上げしない場合の利息 − 繰上げ後の利息 − 手数料」', () => {
  const r = calculate({ ...base, fee: 5000 });
  const [none, short, reduce] = r.table.rows;
  assert.equal(val(r, '【期間短縮型】利息の軽減額（手数料差引後）'), none[3] - short[3] - 5000);
  assert.equal(val(r, '【返済額軽減型】利息の軽減額（手数料差引後）'), none[3] - reduce[3] - 5000);
});

test('同じ繰上げなら期間短縮型のほうが利息の軽減額が大きい', () => {
  const r = calculate(base);
  assert.ok(val(r, '【期間短縮型】利息の軽減額（手数料差引後）') > val(r, '【返済額軽減型】利息の軽減額（手数料差引後）'));
});

test('返済額軽減型の返済期間は変わらず、残りの総支払額は元金＋利息に一致する', () => {
  const r = calculate(base);
  const [none, short, reduce] = r.table.rows;
  assert.equal(reduce[2], 35 * 12 - 120);
  assert.equal(none[2], 300);
  const bal = balanceAfter(base, 120);
  assert.equal(none[4], bal + none[3]);
  assert.equal(short[4], bal - 1_000_000 + short[3]);
  assert.equal(reduce[4], bal - 1_000_000 + reduce[3]);
});

test('金利0%：利息は常に0で、軽減額は0、短縮は繰上げ額÷月額', () => {
  const r = calculate({ amount: 1_200_000, rate: 0, years: 10, elapsed: 12, prepay: 100_000, fee: 0 });
  assert.equal(val(r, '繰上げしない場合の毎月の返済額'), 10_000);
  assert.equal(val(r, '【期間短縮型】期間の短縮'), 10);
  assert.equal(val(r, '【期間短縮型】利息の軽減額（手数料差引後）'), 0);
  assert.equal(val(r, '【返済額軽減型】新しい毎月の返済額'), Math.floor(980_000 / 108));
});

test('経過0回（借入直後）でも計算でき、月額は monthlyPayment と一致する', () => {
  const r = calculate({ ...base, elapsed: 0 });
  assert.equal(val(r, '繰上げ時点の残高'), 30_000_000);
  assert.equal(val(r, '繰上げしない場合の毎月の返済額'), monthlyPayment(30_000_000, 0.03 / 12, 420));
});

test('不正な入力はエラーを返し、NaN を表示しない', () => {
  assert.ok(!calculate(base).error);
  assert.ok(calculate({ ...base, prepay: NaN }).error);
  assert.ok(calculate({ ...base, prepay: 0 }).error);
  assert.ok(calculate({ ...base, prepay: -5 }).error);
  assert.ok(calculate({ ...base, prepay: 99_000_000 }).error); // 残高以上
  assert.ok(calculate({ ...base, elapsed: 420 }).error);
  assert.ok(calculate({ ...base, elapsed: -1 }).error);
  assert.ok(calculate({ ...base, elapsed: 1.5 }).error);
  assert.ok(calculate({ ...base, fee: -1 }).error);
  assert.ok(calculate({ ...base, rate: 25 }).error);
  assert.ok(calculate({ ...base, amount: NaN }).error);
  assert.ok(!calculate({ ...base, fee: NaN }).error); // 手数料の空欄は 0 扱い
});
