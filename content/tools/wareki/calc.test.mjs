import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, warekiOfYear } from './calc.js';

const toW = (date) => calculate({ mode: 'toWareki', date });
const toS = (era, year) => calculate({ mode: 'toSeireki', era, year });

test('西暦→和暦：2019-05-01 は令和元年5月1日、2019-04-30 は平成31年4月30日', () => {
  assert.equal(toW('2019-05-01').items[0].value, '令和元年5月1日');
  assert.equal(toW('2019-04-30').items[0].value, '平成31年4月30日');
});

test('改元日の境界：1989-01-07 は昭和64年、1989-01-08 は平成元年', () => {
  assert.equal(toW('1989-01-07').items[0].value, '昭和64年1月7日');
  assert.equal(toW('1989-01-08').items[0].value, '平成元年1月8日');
});

test('和暦→西暦：令和8年=2026、平成31年=2019、昭和64年=1989、昭和元年=1926、明治6年=1873', () => {
  assert.equal(toS('令和', 8).items[0].value, 2026);
  assert.equal(toS('平成', 31).items[0].value, 2019);
  assert.equal(toS('昭和', 64).items[0].value, 1989);
  assert.equal(toS('昭和', 1).items[0].value, 1926);
  assert.equal(toS('明治', 6).items[0].value, 1873);
});

test('改元のあった年は2つの元号を併記する', () => {
  assert.equal(warekiOfYear(2019), '令和元年 / 平成31年');
  assert.equal(warekiOfYear(1912), '大正元年 / 明治45年');
  assert.equal(warekiOfYear(2020), '令和2年');
  assert.equal(warekiOfYear(1872), null);
});

test('早見表の和暦は年末の日付の toWareki と矛盾しない', () => {
  const r = toS('令和', 8);
  for (const [y, w] of r.table.rows) {
    const year = Number.parseInt(y, 10);
    const endOfYear = calculate({ mode: 'toWareki', date: `${year}-12-31` }).items[0].value;
    assert.ok(w.startsWith(endOfYear.replace(/\d+月.*$/, '').replace('年', '年')), `${y}: ${w} / ${endOfYear}`);
  }
});

test('異常値：範囲外・小数・空欄・存在しない日付・1873年より前はエラー', () => {
  assert.ok(toS('平成', 32).error);
  assert.ok(toS('昭和', 65).error);
  assert.ok(toS('明治', 5).error);
  assert.ok(toS('令和', 0).error);
  assert.ok(toS('令和', 1.5).error);
  assert.ok(toS('令和', NaN).error);
  assert.ok(toW('2023-02-30').error);
  assert.ok(toW('1872-12-31').error);
  assert.ok(toW('').error);
  assert.equal(toW('1873-01-01').items[0].value, '明治6年1月1日');
});
