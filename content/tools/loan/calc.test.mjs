import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, schedule, floorYen } from './calc.js';

const sum = (ms, key) => ms.reduce((s, m) => s + m[key], 0);
const val = (r, label) => r.items.find((x) => x.label === label).value;

// 住宅金融支援機構【フラット35】「元利均等返済・元金均等返済」掲載の試算例（2,000万円・年1.5%・30年）
// https://www.flat35.com/loan/lineup/kinto/index.html
test('フラット35 掲載例（元利均等）と毎月の返済額・内訳・残高・総返済額が一致する', () => {
  const ms = schedule({ amount: 20_000_000, rate: 1.5, years: 30, method: 'annuity' });
  const expected = {
    12: [69024, 44634, 24390, 19468058],
    60: [69024, 47392, 21632, 17258727],
    120: [69024, 51081, 17943, 14304092],
    180: [69024, 55056, 13968, 11119489],
    240: [69024, 59342, 9682, 7687015],
    300: [69024, 63960, 5064, 3987379],
  };
  for (const [k, [pay, prin, int, bal]] of Object.entries(expected)) {
    const m = ms[k - 1];
    assert.deepEqual([m.payment, m.principal, m.interest, m.balance], [pay, prin, int, bal], `${k}回目`);
  }
  assert.equal(sum(ms, 'payment'), 24_848_426);
  assert.equal(sum(ms, 'interest'), 4_848_426);
});

test('フラット35 掲載例（元金均等）と毎月の返済額・内訳・残高・総返済額が一致する', () => {
  const ms = schedule({ amount: 20_000_000, rate: 1.5, years: 30, method: 'principal' });
  const expected = {
    12: [79791, 55555, 24236, 19333340],
    60: [76457, 55555, 20902, 16666700],
    120: [72291, 55555, 16736, 13333400],
    180: [68124, 55555, 12569, 10000100],
    240: [63957, 55555, 8402, 6666800],
    300: [59791, 55555, 4236, 3333500],
  };
  for (const [k, [pay, prin, int, bal]] of Object.entries(expected)) {
    const m = ms[k - 1];
    assert.deepEqual([m.payment, m.principal, m.interest, m.balance], [pay, prin, int, bal], `${k}回目`);
  }
  assert.equal(sum(ms, 'payment'), 24_512_368);
});

test('元利均等：3,000万円・年1%・35年の毎月返済額は公式 M = P·i(1+i)^n/((1+i)^n−1) の円未満切り捨て', () => {
  const i = 0.01 / 12, n = 420, P = 30_000_000;
  const exact = (P * i * (1 + i) ** n) / ((1 + i) ** n - 1); // 84,685.709…
  const r = calculate({ amount: P, rate: 1, years: 35, method: 'annuity' });
  assert.equal(r.items[0].value, Math.floor(exact));
  assert.equal(r.items[0].value, 84685);
});

test('総返済額・利息合計・年間返済額は表示している各回の返済額の合計と一致する', () => {
  for (const method of ['annuity', 'principal']) {
    const r = calculate({ amount: 30_000_000, rate: 1, years: 35, method });
    const ms = schedule({ amount: 30_000_000, rate: 1, years: 35, method });
    assert.equal(val(r, '総返済額'), sum(ms, 'payment'));
    assert.equal(val(r, 'うち利息の合計'), val(r, '総返済額') - 30_000_000);
    assert.equal(r.table.rows.reduce((s, row) => s + row[1], 0), val(r, '総返済額'));
    if (method === 'annuity') assert.equal(val(r, '総返済額'), 84685 * 419 + ms.at(-1).payment);
  }
});

test('金利 0% なら総返済額は借入額と同じで利息は 0', () => {
  for (const method of ['annuity', 'principal']) {
    const r = calculate({ amount: 1_200_000, rate: 0, years: 5, method });
    assert.equal(r.items[0].value, 20000);
    assert.equal(val(r, 'うち利息の合計'), 0);
    assert.equal(val(r, '総返済額'), 1_200_000);
  }
});

test('完済時の残高は 0、元金の返済合計は借入額に一致し、各回の金額はすべて 0 以上の整数', () => {
  for (const args of [
    { amount: 25_000_000, rate: 1.8, years: 30 },
    { amount: 1, rate: 20, years: 50 },
    { amount: 999_999, rate: 3.33, years: 7 },
  ]) {
    for (const method of ['annuity', 'principal']) {
      const ms = schedule({ ...args, method });
      assert.equal(ms.at(-1).balance, 0);
      assert.equal(sum(ms, 'principal'), args.amount);
      assert.ok(ms.every((m) => Number.isInteger(m.payment) && m.payment >= 0 && m.principal >= 0 && m.interest >= 0));
    }
  }
});

test('同じ条件なら元金均等の利息合計は元利均等より少ない', () => {
  const a = calculate({ amount: 30_000_000, rate: 1.5, years: 35, method: 'annuity' });
  const p = calculate({ amount: 30_000_000, rate: 1.5, years: 35, method: 'principal' });
  assert.ok(val(p, 'うち利息の合計') < val(a, 'うち利息の合計'));
});

test('不正な入力はエラーを返す', () => {
  const ok = { amount: 1e7, rate: 1, years: 35, method: 'annuity' };
  assert.ok(!calculate(ok).error);
  assert.ok(calculate({ ...ok, amount: 0 }).error);
  assert.ok(calculate({ ...ok, amount: 0.5 }).error);
  assert.ok(calculate({ ...ok, amount: NaN }).error);
  assert.ok(calculate({ ...ok, rate: -1 }).error);
  assert.ok(calculate({ ...ok, years: 0 }).error);
  assert.ok(calculate({ ...ok, years: 10.5 }).error);
  assert.ok(calculate({ ...ok, method: 'x' }).error);
});

test('浮動小数点誤差で 1 円少なく切り捨てない', () => {
  assert.equal(floorYen(19999.9999999999), 20000);
  assert.equal(floorYen(-1e-9), 0);
  assert.equal(floorYen(84685.71), 84685);
});
