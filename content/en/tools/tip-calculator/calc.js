// Tip calculator: tip on the pre-tax amount or the full bill, split between people.
// All money math is done in integer cents.

export const inputs = [
  {
    id: 'currency',
    label: 'Currency',
    type: 'select',
    default: 'USD',
    options: [
      { value: 'USD', label: 'US dollar ($)' },
      { value: 'CAD', label: 'Canadian dollar (C$)' },
      { value: 'EUR', label: 'Euro (€)' },
      { value: 'GBP', label: 'British pound (£)' },
      { value: 'AUD', label: 'Australian dollar (A$)' },
    ],
  },
  { id: 'bill', label: 'Bill total (including tax)', type: 'number', default: 84.5, min: 0, step: 0.01 },
  { id: 'tax', label: 'Sales tax included in the bill', type: 'number', default: 6.5, min: 0, step: 0.01, help: 'Enter 0 if you do not know.' },
  {
    id: 'tipBase',
    label: 'Calculate the tip on',
    type: 'select',
    default: 'pretax',
    options: [
      { value: 'pretax', label: 'Tip on the amount before tax' },
      { value: 'total', label: 'Tip on the full bill' },
    ],
  },
  { id: 'tipPct', label: 'Tip', type: 'number', unit: '%', default: 18, min: 0, max: 100, step: 0.5 },
  { id: 'people', label: 'Number of people', type: 'number', default: 2, min: 1, max: 100, step: 1 },
  {
    id: 'rounding',
    label: 'Rounding',
    type: 'select',
    default: 'none',
    options: [
      { value: 'none', label: 'No rounding' },
      { value: 'up', label: "Round each person's share up to a whole dollar" },
    ],
  },
];

const SYMBOLS = { USD: '$', CAD: 'C$', EUR: '€', GBP: '£', AUD: 'A$' };
const toCents = (v) => Math.round(v * 100);
const fromCents = (c) => c / 100;
const fmt = (c, p) => p + (c / 100).toFixed(2);

export function calculate({ currency, bill, tax, tipBase, tipPct, people, rounding }) {
  if (![bill, tax, tipPct, people].every(Number.isFinite)) return { error: 'Please enter a number in each field.' };
  const prefix = SYMBOLS[currency];
  if (!prefix) return { error: 'Please choose a currency.' };
  if (tipBase !== 'pretax' && tipBase !== 'total') return { error: 'Please choose whether to tip on the pre-tax amount or the full bill.' };
  if (rounding !== 'none' && rounding !== 'up') return { error: 'Please choose a rounding option.' };
  if (bill <= 0) return { error: 'The bill total must be greater than zero.' };
  if (bill > 1e7) return { error: 'The bill total is too large. Please enter 10,000,000 or less.' };
  if (tax < 0) return { error: 'Sales tax cannot be negative.' };
  if (tax > bill) return { error: 'The sales tax cannot be more than the bill total.' };
  if (tipPct < 0 || tipPct > 100) return { error: 'The tip must be between 0% and 100%.' };
  if (!Number.isInteger(people) || people < 1 || people > 100) return { error: 'The number of people must be a whole number from 1 to 100.' };

  const billC = toCents(bill);
  const taxC = toCents(tax);
  const baseC = tipBase === 'pretax' ? billC - taxC : billC;
  const tipC0 = Math.round((baseC * tipPct) / 100);
  const totalC0 = billC + tipC0;

  const notes = [];
  let shareC; // highest per-person share, in cents
  let totalC;
  let lowShareC = null;
  let highCount = 0;

  if (rounding === 'up') {
    shareC = Math.ceil(totalC0 / people / 100) * 100;
    totalC = shareC * people;
    const extra = totalC - totalC0;
    if (extra > 0) {
      notes.push(`Rounding each share up to a whole dollar adds ${fmt(extra, prefix)}, which is counted as extra tip. The tip shown is the adjusted amount (${fmt(totalC - billC, prefix)}).`);
    } else {
      notes.push('The shares already come to whole dollars, so rounding changed nothing.');
    }
  } else {
    totalC = totalC0;
    const low = Math.floor(totalC / people);
    const rem = totalC - low * people;
    if (rem === 0) {
      shareC = low;
    } else {
      shareC = low + 1;
      lowShareC = low;
      highCount = rem;
      notes.push(
        `The total does not divide evenly into cents: ${highCount} ${highCount === 1 ? 'person pays' : 'people pay'} ${fmt(shareC, prefix)} and ${people - highCount === 1 ? 'the other person pays' : `the other ${people - highCount} people pay`} ${fmt(lowShareC, prefix)}. Together that is exactly ${fmt(totalC, prefix)}, so nobody is short. Per-person shown is the higher amount.`,
      );
    }
  }

  const tipC = totalC - billC;
  const effective = (tipC / billC) * 100;
  const tipPerPersonC = tipC / people;

  if (tax === 0 && tipBase === 'pretax') notes.push('With no tax entered, the pre-tax amount is the same as the full bill.');
  if (tipBase === 'pretax' && tax > 0) notes.push(`The tip is calculated on ${fmt(baseC, prefix)}, the bill minus ${fmt(taxC, prefix)} of tax.`);
  if (tipPct === 0 && rounding === 'none') notes.push('No tip is included in this total.');

  const money = (c) => ({ value: fromCents(c), digits: 2, prefix });
  const items = [];
  if (people > 1) {
    items.push({ label: 'Total per person', ...money(shareC), primary: true });
    items.push({ label: 'Tip amount', ...money(tipC) });
    items.push({ label: 'Total to pay', ...money(totalC) });
  } else {
    items.push({ label: 'Total to pay', ...money(totalC), primary: true });
    items.push({ label: 'Tip amount', ...money(tipC) });
  }
  items.push({ label: 'Tip per person', value: Math.round(tipPerPersonC) / 100, digits: 2, prefix });
  items.push({ label: 'Effective tip on the full bill', value: Math.round(effective * 100) / 100, digits: 2, unit: '%' });

  return { items, notes };
}
