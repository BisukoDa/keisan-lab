import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, buai } from './calc.js';

const first = (args) => calculate(args).items[0].value;

test('A の B%：2000 の 15% は 300、残りは 1700', () => {
  const r = calculate({ mode: 'of', base: 2000, pct: 15 });
  assert.equal(r.items[0].value, 300);
  assert.equal(r.items[1].value, 1700);
});

test('A は B の何%：30 は 120 の 25%、1 は 3 の 33.33…%', () => {
  assert.equal(first({ mode: 'ratio', part: 30, whole: 120 }), 25);
  const third = calculate({ mode: 'ratio', part: 1, whole: 3 });
  assert.equal(third.items[0].value, 33.33); // 表示用に小数2桁へ丸める
  assert.equal(third.items[0].digits, 2);
  assert.equal(third.items[1].value, '0.3333');
});

test('増減率：100→120 は 20% 増、120→90 は 25% 減', () => {
  const up = calculate({ mode: 'change', from: 100, to: 120 });
  assert.equal(up.items[0].label, '増加率');
  assert.equal(up.items[0].value, 20);
  const down = calculate({ mode: 'change', from: 120, to: 90 });
  assert.equal(down.items[0].label, '減少率');
  assert.equal(down.items[0].value, 25);
  assert.equal(down.items[1].value, '-30');
  assert.equal(up.items[1].value, '+20');
  assert.equal(up.items[2].value, '1.2');
});

test('○%引き・○%増し：1980円の30%引きは1386円、2000の8%増しは2160', () => {
  const d = calculate({ mode: 'discount', base: 1980, pct: 30 });
  assert.equal(d.items[0].value, 1386);
  assert.equal(d.items[1].value, 594);
  assert.equal(first({ mode: 'increase', base: 2000, pct: 8 }), 2160);
});

test('浮動小数点の誤差を表示に出さない（0.1 の 3% など）', () => {
  const tiny = calculate({ mode: 'of', base: 0.1, pct: 3 }).items[0];
  assert.equal(tiny.value, 0.003);
  assert.equal(tiny.digits, 3);
  const small = calculate({ mode: 'ratio', part: 1, whole: 100000 }).items[0];
  assert.equal(small.value, 0.001);
  assert.ok(small.digits >= 3);
  assert.equal(calculate({ mode: 'ratio', part: 1, whole: 8 }).items[0].digits, 1); // 12.5%
  assert.equal(first({ mode: 'increase', base: 110, pct: 10 }), 121);
  assert.equal(first({ mode: 'discount', base: 1000, pct: 33.3 }), 667);
});

test('歩合：0.325 は 3割2分5厘、0.3 は 3割、1.05 は 10割5分', () => {
  assert.equal(buai(0.325), '3割2分5厘');
  assert.equal(buai(0.3), '3割');
  assert.equal(buai(0.005), '5厘');
  assert.equal(buai(1.05), '10割5分');
  assert.equal(buai(0), '0割');
});

test('0 で割る入力や未入力はエラーを返す', () => {
  assert.ok(calculate({ mode: 'ratio', part: 5, whole: 0 }).error);
  assert.ok(calculate({ mode: 'change', from: 0, to: 5 }).error);
  assert.ok(calculate({ mode: 'of', base: NaN, pct: 5 }).error);
  assert.ok(calculate({ mode: 'nope' }).error);
  assert.ok(calculate({ mode: 'discount', base: 1000, pct: 120 }).error);
  assert.ok(calculate({ mode: 'discount', base: 1000, pct: -10 }).error);
  assert.equal(calculate({ mode: 'of', base: 2000, pct: 120 }).items.length, 1); // 100% を超えると「残り」は出さない
});
