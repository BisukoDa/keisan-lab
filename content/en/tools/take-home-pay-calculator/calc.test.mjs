import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, federalTax } from './calc.js';

const get = (r, label) => r.items.find((i) => i.label === label);
const base = { gross: 75000, status: 'single', k401: 0, health: 0, state: 0, period: 'year' };

test('single $75,000: taxable $58,900 -> $7,670 federal tax (1,240 + 4,560 + 1,870)', () => {
  const r = calculate(base);
  assert.equal(get(r, 'Federal income tax per year').value, 7670);
  assert.equal(get(r, 'Social Security + Medicare per year').value, 5737.5);
  assert.equal(get(r, 'Take-home pay per year').value, 61592.5);
  assert.equal(get(r, 'Take-home pay per year').primary, true);
});

test('biweekly pay is the yearly figure divided by 26, rounded to the cent', () => {
  const r = calculate({ ...base, period: 'biweekly' });
  assert.equal(r.items[0].value, 2368.94);
  assert.equal(get(r, 'Take-home pay per year').value, 61592.5);
});

test('married filing jointly $250,000: federal $37,468, FICA $15,064', () => {
  const r = calculate({ ...base, gross: 250000, status: 'married' });
  assert.equal(get(r, 'Federal income tax per year').value, 37468);
  assert.equal(get(r, 'Social Security + Medicare per year').value, 15064);
});

test('Social Security stops at the $184,500 wage base; extra Medicare applies above $200,000', () => {
  const r = calculate({ ...base, gross: 300000 });
  // SS 11,439 + Medicare 4,350 + additional 900
  assert.equal(get(r, 'Social Security + Medicare per year').value, 16689);
});

test('401(k) lowers income tax but not FICA; health premiums lower both; state rate applies', () => {
  const r = calculate({ ...base, k401: 6000, health: 1200, state: 5 });
  assert.equal(get(r, 'Federal income tax per year').value, 6086);
  assert.equal(get(r, 'Social Security + Medicare per year').value, 5645.7);
  assert.equal(get(r, 'State income tax per year').value, 3390);
  assert.equal(get(r, 'Take-home pay per year').value, 52678.3);
});

test('income below the standard deduction owes no federal tax; zero pay works', () => {
  assert.equal(get(calculate({ ...base, gross: 10000 }), 'Federal income tax per year').value, 0);
  const z = calculate({ ...base, gross: 0 });
  assert.equal(get(z, 'Take-home pay per year').value, 0);
  assert.equal(get(z, 'Average tax rate on gross pay').value, 0);
});

test('bracket edge: single taxable income exactly $12,400 is all 10%', () => {
  assert.equal(federalTax(12400, 'single'), 1240);
  assert.equal(federalTax(12401, 'single'), 1240.12);
});

test('invalid input returns an error instead of NaN', () => {
  assert.ok(calculate({ ...base, gross: NaN }).error);
  assert.ok(calculate({ ...base, gross: -5 }).error);
  assert.ok(calculate({ ...base, k401: 80000 }).error);
  assert.ok(calculate({ ...base, k401: NaN }).items);
});
