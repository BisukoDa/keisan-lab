import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, fullAge, eto } from './calc.js';

const val = (r, label) => r.items.find((x) => x.label === label).value;

test('満年齢は誕生日当日に1歳加算される', () => {
  assert.equal(fullAge('2000-10-12', '2026-10-11'), 25);
  assert.equal(fullAge('2000-10-12', '2026-10-12'), 26);
  assert.equal(fullAge('2000-01-01', '2026-10-12'), 26);
  assert.equal(fullAge('2000-01-01', '2000-01-01'), 0);
});

test('2月29日生まれは平年の2月28日はまだ加算されず、3月1日に加算される', () => {
  assert.equal(fullAge('2004-02-29', '2025-02-28'), 20);
  assert.equal(fullAge('2004-02-29', '2025-03-01'), 21);
  assert.equal(fullAge('2004-02-29', '2024-02-29'), 20);
  const r = calculate({ birth: '2004-02-29', base: '2025-01-10' });
  assert.match(val(r, '次の誕生日'), /^2025年3月1日/);
  const leap = calculate({ birth: '2004-02-29', base: '2028-01-10' });
  assert.match(val(leap, '次の誕生日'), /^2028年2月29日/);
});

test('数え年は 基準日の年 − 生まれ年 + 1', () => {
  const r = calculate({ birth: '2000-12-31', base: '2026-01-01' });
  assert.equal(val(r, '満年齢'), 25);
  assert.equal(val(r, '数え年'), 27);
});

test('干支：2020年は子・庚子、1990年は午・庚午、2026年は午・丙午', () => {
  assert.deepEqual(eto(2020), { animal: '子', yomi: 'ね', kanshi: '庚子' });
  assert.equal(eto(1990).kanshi, '庚午');
  assert.equal(eto(2026).kanshi, '丙午');
  assert.equal(eto(1966).kanshi, '丙午');
  assert.equal(eto(1984).kanshi, '甲子');
});

test('生まれ年の和暦は改元日で切り替わる', () => {
  assert.equal(val(calculate({ birth: '1989-01-07', base: '2026-10-12' }), '生まれ年（和暦）'), '昭和64年');
  assert.equal(val(calculate({ birth: '1989-01-08', base: '2026-10-12' }), '生まれ年（和暦）'), '平成元年');
  assert.equal(val(calculate({ birth: '2019-05-01', base: '2026-10-12' }), '生まれ年（和暦）'), '令和元年');
});

test('次の誕生日と生まれてからの日数', () => {
  const r = calculate({ birth: '2000-10-12', base: '2026-10-12' });
  assert.match(val(r, '次の誕生日'), /^2027年10月12日.*あと365日・27歳/);
  assert.equal(val(calculate({ birth: '2026-10-01', base: '2026-10-12' }), '生まれてからの日数'), 11);
});

test('不正な入力はエラーを返す', () => {
  assert.ok(calculate({ birth: '', base: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '2026-10-13', base: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '2001-02-29', base: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '1872-12-31', base: '2026-10-12' }).error);
  assert.ok(calculate({ birth: '2000-01-01', base: '9999-06-01' }).error);
  assert.ok(!calculate({ birth: '1873-01-01', base: '9998-12-31' }).error);
});
