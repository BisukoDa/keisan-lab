// Percentage calculator: X% of Y, X is what % of Y, X is P% of what, percentage change,
// percentage difference, percent off and percent increase.

export const inputs = [
  {
    id: 'mode',
    label: 'What do you want to calculate?',
    type: 'select',
    default: 'of',
    options: [
      { value: 'of', label: 'What is X% of Y?' },
      { value: 'ratio', label: 'X is what percent of Y?' },
      { value: 'whole', label: 'X is P% of what number?' },
      { value: 'change', label: 'Percentage change from A to B' },
      { value: 'difference', label: 'Percentage difference between A and B' },
      { value: 'off', label: 'Y decreased by X% (discounts)' },
      { value: 'increase', label: 'Y increased by X% (markups, tax)' },
    ],
  },
  { id: 'pct', label: 'Percent (X)', type: 'number', unit: '%', default: 15, showIf: { mode: ['of', 'off', 'increase'] } },
  { id: 'base', label: 'Number (Y)', type: 'number', default: 200, showIf: { mode: ['of', 'off', 'increase'] } },
  { id: 'part', label: 'Value (X)', type: 'number', default: 30, showIf: { mode: ['ratio', 'whole'] } },
  { id: 'whole', label: 'Total (Y)', type: 'number', default: 120, showIf: { mode: 'ratio' } },
  { id: 'share', label: 'Percent (P)', type: 'number', unit: '%', default: 25, showIf: { mode: 'whole' } },
  { id: 'from', label: 'Starting value (A)', type: 'number', default: 80, showIf: { mode: ['change', 'difference'] } },
  { id: 'to', label: 'Final value (B)', type: 'number', default: 100, showIf: { mode: ['change', 'difference'] } },
];

// Remove floating-point noise (0.1 + 0.2) before display.
const clean = (v) => Number(v.toPrecision(12));
const decimals = (x) => (x.toFixed(12).replace(/0+$/, '').split('.')[1] ?? '').length;
// Integers as-is, values of 0.01 or more to 2 decimals, smaller values to 3 significant figures.
export function num(v) {
  const c = clean(v);
  if (Number.isInteger(c)) return { value: c, digits: 0 };
  const r = Math.abs(c) >= 0.01 ? Math.round(c * 100) / 100 : Number(c.toPrecision(3));
  return { value: r, digits: Math.min(12, decimals(r)) };
}
const show = (v) => clean(v).toLocaleString('en-US', { maximumFractionDigits: 6 });

export function calculate({ mode, pct, base, part, whole, share, from, to }) {
  const need = (...vs) => vs.every(Number.isFinite);
  const missing = { error: 'Please enter a number in each field.' };

  if (mode === 'of') {
    if (!need(pct, base)) return missing;
    const v = (pct / 100) * base;
    const items = [{ label: `${show(pct)}% of ${show(base)}`, ...num(v), primary: true }];
    if (pct >= 0 && pct <= 100) items.push({ label: `Remaining ${show(100 - pct)}%`, ...num(base - v) });
    return { items };
  }
  if (mode === 'ratio') {
    if (!need(part, whole)) return missing;
    if (whole === 0) return { error: 'The total (Y) cannot be zero.' };
    const r = part / whole;
    return {
      items: [
        { label: `${show(part)} as a percent of ${show(whole)}`, ...num(r * 100), unit: '%', primary: true },
        { label: 'As a decimal', value: clean(r).toLocaleString('en-US', { maximumFractionDigits: 6 }) },
      ],
    };
  }
  if (mode === 'whole') {
    if (!need(part, share)) return missing;
    if (share === 0) return { error: 'The percent (P) cannot be zero.' };
    return { items: [{ label: `${show(part)} is ${show(share)}% of`, ...num(part / (share / 100)), primary: true }] };
  }
  if (mode === 'change') {
    if (!need(from, to)) return missing;
    if (from === 0) return { error: 'The starting value (A) cannot be zero for a percentage change.' };
    const rate = ((to - from) / Math.abs(from)) * 100;
    const diff = to - from;
    return {
      items: [
        { label: rate >= 0 ? 'Percentage increase' : 'Percentage decrease', ...num(Math.abs(rate)), unit: '%', primary: true },
        { label: 'Change (B − A)', value: (diff > 0 ? '+' : '') + show(diff) },
        { label: 'Ratio (B ÷ A)', value: clean(to / from).toLocaleString('en-US', { maximumFractionDigits: 4 }), unit: '×' },
      ],
      notes: from < 0 ? ['When the starting value is negative, the change is measured against its absolute value.'] : [],
    };
  }
  if (mode === 'difference') {
    if (!need(from, to)) return missing;
    if (from < 0 || to < 0) return { error: 'Percentage difference is defined for values of zero or more.' };
    const mean = (from + to) / 2;
    if (mean === 0) return { error: 'Both values cannot be zero.' };
    return {
      items: [
        { label: 'Percentage difference', ...num((Math.abs(from - to) / mean) * 100), unit: '%', primary: true },
        { label: 'Absolute difference', value: show(Math.abs(from - to)) },
        { label: 'Average of A and B', ...num(mean) },
      ],
      notes: ['Percentage difference compares two values with no "before" and "after", so it uses their average as the reference.'],
    };
  }
  if (mode === 'off' || mode === 'increase') {
    if (!need(pct, base)) return missing;
    const delta = (pct / 100) * base;
    if (mode === 'off') {
      if (pct < 0 || pct > 100) return { error: 'The discount must be between 0% and 100%.' };
      return {
        items: [
          { label: `${show(base)} minus ${show(pct)}%`, ...num(base - delta), primary: true },
          { label: 'Amount saved', ...num(delta) },
        ],
      };
    }
    return {
      items: [
        { label: `${show(base)} plus ${show(pct)}%`, ...num(base + delta), primary: true },
        { label: 'Amount added', ...num(delta) },
      ],
    };
  }
  return { error: 'Please choose what you want to calculate.' };
}
