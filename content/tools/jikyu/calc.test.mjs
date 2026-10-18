import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { hoursPerDay: 8, daysPerWeek: 5, extraHolidays: 0 };
const val = (r, label) => r.items.find((i) => i.label === label).value;

test('時給1,200円・1日8時間・週5日・年52週は 年収 2,496,000円・月給 208,000円', () => {
  const r = calculate({ mode: 'hourly', hourlyAmount: 1200, ...base });
  // 1,200 × 8 × 260 = 2,496,000
  assert.equal(val(r, '年収'), 2496000);
  assert.equal(val(r, '月給（年収の12分の1）'), 208000);
  assert.equal(val(r, '日給（1日あたり）'), 9600);
  assert.equal(val(r, '年間の勤務日数'), 260);
});

test('月給250,000円 → 時給は 250,000 × 12 ÷ (8 × 260) = 1,442円（四捨五入）', () => {
  const r = calculate({ mode: 'monthly', monthlyAmount: 250000, ...base });
  assert.equal(val(r, '時給'), Math.round(3000000 / 2080));
  assert.equal(val(r, '時給'), 1442);
  assert.equal(val(r, '年収'), 3000000);
});

test('年収400万円・追加休日15日 → 年間勤務245日・月平均労働時間は約163.33時間・時給2,041円', () => {
  const r = calculate({ mode: 'yearly', yearlyAmount: 4000000, hoursPerDay: 8, daysPerWeek: 5, extraHolidays: 15 });
  assert.equal(val(r, '年間の勤務日数'), 245);
  assert.ok(Math.abs(val(r, '月平均の労働時間') - 1960 / 12) < 1e-9);
  assert.equal(val(r, '時給'), Math.round(4000000 / 1960));
  assert.equal(val(r, '時給'), 2041);
});

test('往復しても金額が一致する（時給→年収→時給）', () => {
  const a = calculate({ mode: 'hourly', hourlyAmount: 1500, hoursPerDay: 6.5, daysPerWeek: 4, extraHolidays: 10 });
  const b = calculate({ mode: 'yearly', yearlyAmount: val(a, '年収'), hoursPerDay: 6.5, daysPerWeek: 4, extraHolidays: 10 });
  assert.equal(val(b, '時給'), 1500);
});

test('境界値：週7日・24時間・追加休日で勤務日数がちょうど1日になる', () => {
  const r = calculate({ mode: 'hourly', hourlyAmount: 1000, hoursPerDay: 24, daysPerWeek: 7, extraHolidays: 363 });
  assert.equal(val(r, '年間の勤務日数'), 1);
  assert.equal(val(r, '年収'), 24000);
});

test('不正な入力はエラーを返し、NaN を表示しない', () => {
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: NaN, ...base }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 0, ...base }).error);
  assert.ok(calculate({ mode: 'monthly', monthlyAmount: -1, ...base }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 1000, ...base, hoursPerDay: 0 }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 1000, ...base, hoursPerDay: 25 }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 1000, ...base, daysPerWeek: 0 }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 1000, ...base, daysPerWeek: 8 }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 1000, ...base, extraHolidays: -1 }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 1000, ...base, extraHolidays: 260 }).error);
  assert.ok(calculate({ mode: 'hourly', hourlyAmount: 1000, ...base, extraHolidays: NaN }).error);
  assert.ok(calculate({ mode: 'yearly', yearlyAmount: 1e11, ...base }).error);
});
