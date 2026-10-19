// Sales tax calculator: add tax to a price, remove tax from a total, or find the tax rate.
// All money math is done in integer cents; the rate is held in thousandths of a percent.
// Tax is rounded to the nearest cent, with half a cent rounded up.

export const inputs = [
  {
    id: 'mode',
    label: 'What do you want to calculate?',
    type: 'select',
    default: 'add',
    options: [
      { value: 'add', label: 'Add tax to a price (price before tax → total)' },
      { value: 'remove', label: 'Remove tax from a total (total → price before tax)' },
      { value: 'rate', label: 'Find the tax rate (price before tax and total)' },
    ],
  },
  { id: 'price', label: 'Price before tax', type: 'number', prefix: '$', default: 49.99, min: 0, step: 0.01, showIf: { mode: ['add', 'rate'] } },
  { id: 'total', label: 'Total with tax', type: 'number', prefix: '$', default: 54.24, min: 0, step: 0.01, showIf: { mode: ['remove', 'rate'] } },
  { id: 'rate', label: 'Sales tax rate', type: 'number', unit: '%', default: 8.5, min: 0, max: 100, step: 0.001, help: 'State plus local rate. Check your own city or county rate.', showIf: { mode: ['add', 'remove'] } },
  { id: 'qty', label: 'Quantity', type: 'number', default: 1, min: 1, max: 10000, step: 1, help: 'Tax is figured on the whole purchase, not per item.', showIf: { mode: 'add' } },
];

const toCents = (v) => Math.round(v * 100);
const RATE_SCALE = 100000; // rate in thousandths of a percent: 8.5% -> 8500
// Tax on an amount of cents at a rate in thousandths of a percent, rounded half up.
const taxOn = (cents, r) => Math.floor((cents * r + RATE_SCALE / 2) / RATE_SCALE);

export function calculate({ mode, price, total, rate, qty }) {
  const bad = (v) => !Number.isFinite(v);
  if (mode !== 'add' && mode !== 'remove' && mode !== 'rate') return { error: 'Please choose what you want to calculate.' };

  if (mode === 'rate') {
    if (bad(price) || bad(total)) return { error: 'Please enter a number in each field.' };
    if (price <= 0) return { error: 'The price before tax must be greater than zero.' };
    if (total < 0 || total > 1e7 || price > 1e7) return { error: 'Please enter amounts of $10,000,000 or less.' };
    const p = toCents(price);
    const t = toCents(total);
    if (p === 0) return { error: 'The price before tax must be at least $0.01.' };
    if (t < p) return { error: 'The total cannot be less than the price before tax.' };
    const tax = t - p;
    const pct = (tax / p) * 100;
    return {
      items: [
        { label: 'Sales tax rate', value: Number(pct.toFixed(3)), digits: 3, unit: '%', primary: true },
        { label: 'Sales tax paid', value: tax / 100, prefix: '$', digits: 2 },
      ],
      notes: ['Tax is rounded to the cent on a receipt, so the true rate can differ slightly from the figure shown, especially on small prices.'],
    };
  }

  if (bad(rate)) return { error: 'Please enter the sales tax rate.' };
  if (rate < 0 || rate > 100) return { error: 'The tax rate must be between 0% and 100%.' };
  const r = Math.round(rate * 1000);

  if (mode === 'add') {
    if (bad(price) || bad(qty)) return { error: 'Please enter a number in each field.' };
    if (price <= 0) return { error: 'The price before tax must be greater than zero.' };
    if (!Number.isInteger(qty) || qty < 1 || qty > 10000) return { error: 'The quantity must be a whole number from 1 to 10,000.' };
    if (price * qty > 1e7) return { error: 'The purchase is too large. Please keep it at $10,000,000 or less.' };
    if (toCents(price) === 0) return { error: 'The price before tax must be at least $0.01.' };
    const sub = toCents(price) * qty;
    const tax = taxOn(sub, r);
    const items = [
      { label: 'Total with tax', value: (sub + tax) / 100, prefix: '$', digits: 2, primary: true },
      { label: 'Sales tax', value: tax / 100, prefix: '$', digits: 2 },
    ];
    if (qty > 1) items.splice(1, 0, { label: 'Price before tax (all items)', value: sub / 100, prefix: '$', digits: 2 });
    return { items, notes: ['Tax is rounded to the nearest cent, with half a cent rounded up. Some stores round each item separately, which can change the total by a few cents.'] };
  }

  // remove
  if (bad(total)) return { error: 'Please enter the total with tax.' };
  if (total <= 0) return { error: 'The total with tax must be greater than zero.' };
  if (total > 1e7) return { error: 'The total is too large. Please enter $10,000,000 or less.' };
  const t = toCents(total);
  if (t === 0) return { error: 'The total with tax must be at least $0.01.' };
  const guess = Math.round((t * RATE_SCALE) / (RATE_SCALE + r));
  let best = null;
  for (let p = Math.max(0, guess - 3); p <= guess + 3; p++) {
    const diff = Math.abs(p + taxOn(p, r) - t);
    if (best === null || diff < best.diff || (diff === best.diff && Math.abs(p - guess) < Math.abs(best.p - guess))) best = { p, diff };
  }
  const p = best.p;
  const tax = t - p;
  const notes = ['Tax is rounded to the nearest cent, so the price before tax is the amount that adds back up to your total.'];
  if (best.diff !== 0) notes.push('No whole-cent price adds up to exactly this total at this rate, so the figures shown are the closest match.');
  return {
    items: [
      { label: 'Price before tax', value: p / 100, prefix: '$', digits: 2, primary: true },
      { label: 'Sales tax included', value: tax / 100, prefix: '$', digits: 2 },
    ],
    notes,
  };
}
