import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const zero = { overtime: 0, overtimeNight: 0, holiday: 0, holidayNight: 0, nightOnly: 0 };
const m = (o) => ({ basis: 'monthly', monthlySalary: 300000, monthlyHours: 160, ...zero, ...o });
const total = (r) => r.items[0].value;

test('月給30万円・160時間・時間外40時間（うち深夜5時間）→ 1,875円 × (35×1.25 + 5×1.5)', () => {
  const r = calculate(m({ overtime: 40, overtimeNight: 5 }));
  assert.equal(r.items[1].value, 1875);
  // 35時間×1.25 = 82,031.25 → 82,031、5時間×1.5 = 14,062.5 → 14,063
  assert.equal(total(r), 82031 + 14063);
});

test('時給1,500円・時間外80時間 → 60時間まで1.25倍、超えた20時間は1.5倍', () => {
  const r = calculate({ basis: 'hourly', hourlyWage: 1500, ...zero, overtime: 80 });
  assert.equal(total(r), 1500 * 1.25 * 60 + 1500 * 1.5 * 20);
});

test('法定休日8時間（うち深夜2時間）と深夜のみ10時間：1.35倍・1.6倍・0.25倍', () => {
  const r = calculate({ basis: 'hourly', hourlyWage: 1500, ...zero, holiday: 8, holidayNight: 2, nightOnly: 10 });
  assert.equal(total(r), 1500 * 1.35 * 6 + 1500 * 1.6 * 2 + 1500 * 0.25 * 10);
});

test('時間外が60時間を超え、すべて深夜 → 60時間まで1.5倍、超過分は1.75倍', () => {
  const r = calculate({ basis: 'hourly', hourlyWage: 2000, ...zero, overtime: 70, overtimeNight: 70 });
  assert.equal(total(r), 2000 * 1.5 * 60 + 2000 * 1.75 * 10);
});

test('基礎賃金の端数：250,000 ÷ 163.33 = 1,530.6… → 1,531円（50銭以上切り上げ）', () => {
  const r = calculate(m({ monthlySalary: 250000, monthlyHours: 163.33, overtime: 20 }));
  assert.equal(r.items[1].value, 1531);
  assert.equal(total(r), Math.round(1531 * 1.25 * 20));
});

test('残業0時間は合計0円で、表は「対象なし」', () => {
  const r = calculate(m({}));
  assert.equal(total(r), 0);
  assert.equal(r.table.rows[0][0], '割増の対象なし');
});

test('異常値はエラー（NaN・負数・深夜が合計超過・0割り）', () => {
  assert.ok(calculate(m({ overtime: NaN })).error);
  assert.ok(calculate(m({ overtime: -1 })).error);
  assert.ok(calculate(m({ overtime: 10, overtimeNight: 11 })).error);
  assert.ok(calculate(m({ holiday: 1, holidayNight: 2 })).error);
  assert.ok(calculate(m({ monthlyHours: 0 })).error);
  assert.ok(calculate(m({ monthlySalary: NaN })).error);
  assert.ok(calculate({ basis: 'hourly', hourlyWage: 0, ...zero }).error);
  assert.ok(calculate(m({ overtime: 800 })).error);
});
