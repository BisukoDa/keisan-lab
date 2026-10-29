// Discount calculator: sale price from percent off, percent off from two prices, or the original price from a sale price.
// Money math is done in integer cents; percents are held in thousandths of a percent.
// The sale price is rounded to the nearest cent, with half a cent rounded up.

export const inputs = [
  {
    id: 'mode',
    label: 'What do you want to calculate?',
    type: 'select',
    default: 'sale',
    options: [
      { value: 'sale', label: 'Sale price (original price and percent off → price you pay)' },
      { value: 'percent', label: 'Percent off (original price and sale price → discount)' },
      { value: 'original', label: 'Original price (sale price and percent off → price before the sale)' },
    ],
  },
  { id: 'original', label: 'Original price', type: 'number', prefix: '$', default: 80, min: 0, step: 0.01, showIf: { mode: ['sale', 'percent'] } },
  { id: 'sale', label: 'Sale price', type: 'number', prefix: '$', default: 60, min: 0, step: 0.01, showIf: { mode: ['percent', 'original'] } },
  { id: 'off', label: 'Discount', type: 'number', unit: '%', default: 25, min: 0, max: 100, step: 0.001, showIf: { mode: ['sale', 'original'] } },
  { id: 'extra', label: 'Extra discount taken off the sale price (optional)', type: 'number', unit: '%', default: 0, min: 0, max: 100, step: 0.001, help: 'For "extra 10% off" coupons. It is taken off the already-reduced price, not added to the first discount.', showIf: { mode: 'sale' } },
];

const toCents = (v) => Math.round(v * 100);
const SCALE = 100000n; // percent in thousandths: 25% -> 25000 -> 25000/100000 = 0.25 of 100%
// Price in cents after taking off up to two percents (in thousandths of a percent), rounded half up.
const afterOff = (cents, r1, r2) => {
  const num = BigInt(cents) * (SCALE - BigInt(r1)) * (SCALE - BigInt(r2));
  const den = SCALE * SCALE;
  return Number((num * 2n + den) / (den * 2n));
};

export function calculate({ mode, original, sale, off, extra }) {
  const bad = (v) => !Number.isFinite(v);
  if (mode !== 'sale' && mode !== 'percent' && mode !== 'original') return { error: 'Please choose what you want to calculate.' };

  if (mode === 'percent') {
    if (bad(original) || bad(sale)) return { error: 'Please enter a number in each field.' };
    if (original <= 0) return { error: 'The original price must be greater than zero.' };
    if (sale < 0) return { error: 'The sale price cannot be negative.' };
    if (original > 1e7 || sale > 1e7) return { error: 'Please enter amounts of $10,000,000 or less.' };
    const o = toCents(original);
    const s = toCents(sale);
    if (o === 0) return { error: 'The original price must be at least $0.01.' };
    if (s > o) return { error: 'The sale price cannot be higher than the original price.' };
    const pct = ((o - s) / o) * 100;
    return {
      items: [
        { label: 'Percent off', value: Number(pct.toFixed(2)), digits: 2, unit: '%', primary: true },
        { label: 'You save', value: (o - s) / 100, prefix: '$', digits: 2 },
      ],
      notes: ['The percent is shown to two decimal places. Prices are in whole cents, so the true percent can differ by a tiny amount.'],
    };
  }

  if (bad(off)) return { error: 'Please enter the discount percent.' };
  if (off < 0 || off > 100) return { error: 'The discount must be between 0% and 100%.' };
  const r1 = Math.round(off * 1000);

  if (mode === 'sale') {
    const ex = Number.isFinite(extra) ? extra : 0;
    if (bad(original)) return { error: 'Please enter the original price.' };
    if (original <= 0) return { error: 'The original price must be greater than zero.' };
    if (original > 1e7) return { error: 'The price is too large. Please keep it at $10,000,000 or less.' };
    if (ex < 0 || ex > 100) return { error: 'The extra discount must be between 0% and 100%.' };
    const o = toCents(original);
    if (o === 0) return { error: 'The original price must be at least $0.01.' };
    const r2 = Math.round(ex * 1000);
    const s = afterOff(o, r1, r2);
    const items = [
      { label: 'Sale price', value: s / 100, prefix: '$', digits: 2, primary: true },
      { label: 'You save', value: (o - s) / 100, prefix: '$', digits: 2 },
    ];
    if (r2 > 0) {
      const combined = ((o - s) / o) * 100;
      items.push({ label: 'Combined discount', value: Number(combined.toFixed(2)), digits: 2, unit: '%' });
    }
    const notes = ['The sale price is rounded to the nearest cent, with half a cent rounded up. Sales tax is not included.'];
    if (r2 > 0) notes.push('The extra discount is taken off the price that is already reduced, so two discounts never add up to simply the sum of the two percents.');
    return { items, notes };
  }

  // original
  if (bad(sale)) return { error: 'Please enter the sale price.' };
  if (sale <= 0) return { error: 'The sale price must be greater than zero.' };
  if (sale > 1e7) return { error: 'The price is too large. Please keep it at $10,000,000 or less.' };
  if (r1 >= 100000) return { error: 'A 100% discount means the item was free, so the original price cannot be found. Enter a discount below 100%.' };
  const s = toCents(sale);
  if (s === 0) return { error: 'The sale price must be at least $0.01.' };
  const guess = Math.round((s * 100000) / (100000 - r1));
  let best = null;
  for (let p = Math.max(1, guess - 3); p <= guess + 3; p++) {
    const diff = Math.abs(afterOff(p, r1, 0) - s);
    if (best === null || diff < best.diff || (diff === best.diff && Math.abs(p - guess) < Math.abs(best.p - guess))) best = { p, diff };
  }
  const p = best.p;
  const notes = ['The original price is the whole-cent amount that, after the discount and rounding, gives your sale price.'];
  if (best.diff !== 0) notes.push('No whole-cent price gives exactly this sale price at this discount, so the figures shown are the closest match.');
  return {
    items: [
      { label: 'Original price', value: p / 100, prefix: '$', digits: 2, primary: true },
      { label: 'Amount taken off', value: (p - s) / 100, prefix: '$', digits: 2 },
    ],
    notes,
  };
}
