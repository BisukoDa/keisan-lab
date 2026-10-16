import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, birthFiscalYear, elementaryEntryYear, schoolYearOf, gradeLabel } from './calc.js';

const val = (r, label) => r.items.find((x) => x.label === label).value;

test('4月1日生まれは前の年度の子と同じ学年、4月2日生まれは次の学年', () => {
  assert.equal(elementaryEntryYear('2000-04-01'), 2006);
  assert.equal(elementaryEntryYear('2000-04-02'), 2007);
  assert.equal(elementaryEntryYear('1999-04-02'), 2006);
  assert.equal(birthFiscalYear('2000-04-01'), 1999);
  assert.equal(birthFiscalYear('2000-04-02'), 2000);
});

test('早生まれ（1/1〜4/1）は暦年で次の年の4月に入学する', () => {
  assert.equal(elementaryEntryYear('2000-01-01'), 2006);
  assert.equal(elementaryEntryYear('2000-12-31'), 2007);
  assert.equal(elementaryEntryYear('2000-03-31'), 2006);
});

test('2000年4月2日生まれ：2007年入学・2023年大学卒業（現役）', () => {
  const r = calculate({ birth: '2000-04-02', base: '2026-10-17' });
  assert.equal(val(r, '小学校入学'), '2007年4月');
  assert.equal(val(r, '大学卒業（現役・4年制）'), '2023年3月');
  assert.equal(val(r, '基準日時点の学年'), '大学卒業後（現役の場合は2023年3月に卒業）');
  assert.equal(r.table.rows[3][2], '2023年（令和5年）3月');
});

test('基準日が4月1日か3月31日かで学年が変わる', () => {
  assert.equal(schoolYearOf('2026-03-31'), 2025);
  assert.equal(schoolYearOf('2026-04-01'), 2026);
  const a = calculate({ birth: '2019-06-01', base: '2026-03-31' });
  const b = calculate({ birth: '2019-06-01', base: '2026-04-01' });
  assert.equal(val(a, '基準日時点の学年'), '就学前（小学校入学は2026年4月）');
  assert.equal(val(b, '基準日時点の学年'), '小学1年生');
});

test('学年ラベルの境目', () => {
  assert.equal(gradeLabel(6), '小学6年生');
  assert.equal(gradeLabel(7), '中学1年生');
  assert.equal(gradeLabel(12), '高校3年生');
  assert.equal(gradeLabel(13), '大学1年生');
  assert.equal(gradeLabel(17), null);
  assert.equal(gradeLabel(0), null);
});

test('2月29日生まれ・同学年の範囲', () => {
  const r = calculate({ birth: '2012-02-29', base: '2026-10-17' });
  assert.equal(val(r, '同じ学年になる生年月日'), '2011年4月2日 〜 2012年4月1日');
  assert.equal(val(r, '早生まれ・遅生まれ'), '早生まれ（1月1日〜4月1日生まれ）');
  assert.equal(val(r, '基準日時点の学年'), '中学3年生');
});

test('不正な入力はエラーを返す', () => {
  assert.ok(calculate({ birth: '', base: '2026-10-17' }).error);
  assert.ok(calculate({ birth: '2020-01-01', base: '' }).error);
  assert.ok(calculate({ birth: '2026-10-18', base: '2026-10-17' }).error);
  assert.ok(calculate({ birth: '2001-02-29', base: '2026-10-17' }).error);
  assert.ok(calculate({ birth: '1949-12-31', base: '2026-10-17' }).error);
  assert.ok(calculate({ birth: '2000-01-01', base: '2201-01-01' }).error);
});
