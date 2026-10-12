import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';
import { toWareki, countWeekdays, addDays, formatJp, toMs } from '../../lib/dates.js';

const after = (start, days) => calculate({ mode: 'after', start, days });
const between = (start, end, countStart = 'no') => calculate({ mode: 'between', start, end, countStart });

test('○日後：2026年1月1日の100日後は4月11日（土）', () => {
  assert.equal(after('2026-01-01', 100).items[0].value, '2026年4月11日（土）');
});

test('うるう年：2024年2月28日の1日後は2月29日、2日後は3月1日', () => {
  assert.equal(after('2024-02-28', 1).items[0].value, '2024年2月29日（木）');
  assert.equal(after('2024-02-28', 2).items[0].value, '2024年3月1日（金）');
  assert.equal(after('2025-02-28', 1).items[0].value, '2025年3月1日（土）');
});

test('○日前：2026年3月1日の30日前は1月30日', () => {
  const r = after('2026-03-01', -30);
  assert.equal(r.items[0].value, '2026年1月30日（金）');
  assert.match(r.items[0].label, /30日前/);
});

test('開始日を1日目とする○日目は○日後の前日', () => {
  const r = after('2026-01-01', 100);
  assert.equal(r.items[2].value, '2026年4月10日（金）');
});

test('日数：2026年1月1日〜12月31日は364日、開始日を含めると365日', () => {
  assert.equal(between('2026-01-01', '2026-12-31').items[0].value, 364);
  assert.equal(between('2026-01-01', '2026-12-31', 'yes').items[0].value, 365);
  assert.equal(between('2024-01-01', '2024-12-31', 'yes').items[0].value, 366);
});

test('平日・土日：2026年10月12日（月）〜18日（日）を含めて数えると平日5日・土日2日', () => {
  const r = between('2026-10-12', '2026-10-18', 'yes');
  assert.equal(r.items[0].value, 7);
  assert.equal(r.items[2].value, 5);
  assert.equal(r.items[3].value, 2);
});

test('平日数を1日ずつ数えた結果と一致する', () => {
  for (const [from, len] of [['2026-10-15', 1], ['2026-10-17', 10], ['2025-12-27', 40], ['2026-01-04', 365]]) {
    const to = addDays(from, len - 1);
    let naive = 0;
    for (let k = 0; k < len; k++) {
      const dow = new Date(addDays(from, k) + 'T00:00:00Z').getUTCDay();
      if (dow !== 0 && dow !== 6) naive++;
    }
    assert.equal(countWeekdays(from, to), naive, `${from} から ${len} 日`);
  }
});

test('終了日が開始日より前なら入れ替えて計算する', () => {
  const r = between('2026-12-31', '2026-01-01');
  assert.equal(r.items[0].value, 364);
  assert.ok(r.notes[0].includes('入れ替え'));
});

test('和暦：改元日の前後を正しく変換する', () => {
  assert.equal(toWareki('2019-05-01').text, '令和元年5月1日');
  assert.equal(toWareki('2019-04-30').text, '平成31年4月30日');
  assert.equal(toWareki('1989-01-07').text, '昭和64年1月7日');
  assert.equal(toWareki('1989-01-08').text, '平成元年1月8日');
  assert.equal(toWareki('1926-12-25').text, '昭和元年12月25日');
  assert.equal(toWareki('1912-07-30').text, '大正元年7月30日');
  assert.equal(toWareki('1873-01-01').text, '明治6年1月1日');
  assert.equal(toWareki('1872-12-31'), null);
});

test('不正な入力はエラーを返す', () => {
  assert.ok(after('', 10).error);
  assert.ok(after('2026-02-30', 10).error);
  assert.ok(after('2026-01-01', 1.5).error);
  assert.ok(after('2026-01-01', NaN).error);
  assert.ok(between('2026-01-01', '').error);
  assert.ok(after('9999-12-31', 1).error);
});

test('共通ライブラリは不正な日付に明示的な例外を投げる', () => {
  assert.throws(() => formatJp('2026-02-30'), RangeError);
  assert.throws(() => toMs(''), RangeError);
});
