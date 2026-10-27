import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from './calc.js';

const base = { sh: 9, sm: 0, sap: 'am', eh: 5, em: 30, eap: 'pm', brk: 30, days: 1, rate: NaN };
const run = (o = {}) => calculate({ ...base, ...o });
const get = (r, label) => r.items.find((i) => i.label === label);

test('9:00 AM to 5:30 PM with a 30 minute break is 8 hours', () => {
  const r = run();
  assert.equal(r.items[0].value, '8 h 00 min');
  assert.equal(get(r, 'Per day in decimal hours').value, 8);
});

test('minutes convert to decimals: 8:15 AM to 4:50 PM, no break = 8 h 35 min = 8.58', () => {
  const r = run({ sh: 8, sm: 15, eh: 4, em: 50, brk: 0 });
  assert.equal(r.items[0].value, '8 h 35 min');
  assert.equal(get(r, 'Per day in decimal hours').value, 8.58);
});

test('overnight shift: 10:00 PM to 6:00 AM is 8 hours', () => {
  const r = run({ sh: 10, sap: 'pm', eh: 6, em: 0, eap: 'am', brk: 0 });
  assert.equal(r.items[0].value, '8 h 00 min');
  assert.ok(r.notes[0].includes('next day'));
});

test('noon and midnight: 12:00 AM to 12:00 PM is 12 hours; 12:00 PM to 1:00 PM is 1', () => {
  assert.equal(run({ sh: 12, sap: 'am', eh: 12, em: 0, eap: 'pm', brk: 0 }).items[0].value, '12 h 00 min');
  assert.equal(run({ sh: 12, sap: 'pm', eh: 1, em: 0, eap: 'pm', brk: 0 }).items[0].value, '1 h 00 min');
});

test('five days and pay: 8 h x 5 = 40 h; at $20 that is $800.00', () => {
  const r = run({ days: 5, rate: 20 });
  assert.equal(get(r, 'Total for 5 days').value, '40 h 00 min');
  assert.equal(get(r, 'Total in decimal hours').value, 40);
  assert.equal(get(r, 'Estimated gross pay').value, 800);
});

test('pay rounds to cents: 8 h 35 min at $17.25 = $148.06', () => {
  const r = run({ sh: 8, sm: 15, eh: 4, em: 50, brk: 0, rate: 17.25 });
  assert.equal(get(r, 'Estimated gross pay').value, 148.06);
});

test('invalid input returns an error, not NaN', () => {
  assert.ok(run({ sh: NaN }).error);
  assert.ok(run({ sh: 13 }).error);
  assert.ok(run({ sm: 60 }).error);
  assert.ok(run({ eh: 9, em: 0, eap: 'am' }).error); // same start and end
  assert.ok(run({ brk: 600 }).error);
  assert.ok(run({ brk: -5 }).error);
  assert.ok(run({ days: 0 }).error);
  assert.ok(run({ brk: 7.5 }).error);
  assert.ok(run({ rate: -1 }).error);
  assert.equal(run({ brk: NaN }).items[0].value, '8 h 30 min'); // empty break = 0
});
