import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const val = (r, label) => r.items.find((x) => x.label.startsWith(label)).value;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('1000W を1時間使うと 1kWh で、単価31円なら31円', () => {
  const r = calculate({ watts: 1000, hours: 1, minutes: 0, days: 30, price: 31 });
  close(val(r, '1時間あたり'), 31);
  close(val(r, '1日あたり'), 31);
  close(val(r, '1か月の電気代'), 930);
  close(val(r, '1年あたり'), 11160);
  close(val(r, '1か月の使用電力量'), 30);
});

test('1200W のドライヤーを1日10分・30日使うと 186 円', () => {
  const r = calculate({ watts: 1200, hours: 0, minutes: 10, days: 30, price: 31 });
  close(val(r, '1か月の電気代'), 1.2 * (1 / 6) * 30 * 31); // 186円
  assert.equal(Math.round(val(r, '1か月の電気代')), 186);
});

test('小さな金額は小数1桁で表示する', () => {
  const r = calculate({ watts: 10, hours: 8, minutes: 0, days: 30, price: 31 });
  close(val(r, '1か月の電気代'), 74.4);
  assert.equal(r.items[0].digits, 1);
});

test('0W や 0時間なら電気代は 0 円', () => {
  const zero = calculate({ watts: 0, hours: 5, minutes: 0, days: 30, price: 31 });
  assert.equal(val(zero, '1か月の電気代'), 0);
  assert.equal(zero.items[0].digits, 0);
  assert.equal(val(calculate({ watts: 500, hours: 0, minutes: 0, days: 30, price: 31 }), '1か月の電気代'), 0);
});

test('不正な入力はエラーを返す', () => {
  const ok = { watts: 100, hours: 1, minutes: 0, days: 30, price: 31 };
  assert.ok(!calculate(ok).error);
  assert.ok(calculate({ ...ok, watts: -1 }).error);
  assert.ok(calculate({ ...ok, hours: 24, minutes: 1 }).error);
  assert.ok(calculate({ ...ok, minutes: 60 }).error);
  assert.ok(calculate({ ...ok, days: 32 }).error);
  assert.ok(calculate({ ...ok, watts: NaN }).error);
  assert.ok(calculate({ ...ok, price: -5 }).error);
});

test('時間と分を合算する（1時間30分 = 1.5時間）', () => {
  const r = calculate({ watts: 1000, hours: 1, minutes: 30, days: 1, price: 31 });
  close(val(r, '1日あたり'), 46.5);
});
