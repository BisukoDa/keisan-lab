// Simple interest calculator: I = P x r x t, with t = years + months / 12.
// Compared with interest compounded once a year over the same time (fractional years use (1 + r)^t).

const CURRENCIES = [
  { value: 'USD', label: 'US dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British pound (£)', symbol: '£' },
  { value: 'CAD', label: 'Canadian dollar (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'Australian dollar (A$)', symbol: 'A$' },
];

export const inputs = [
  {
    id: 'currency',
    label: 'Currency symbol',
    type: 'select',
    default: 'USD',
    options: CURRENCIES.map(({ value, label }) => ({ value, label })),
    help: 'Only changes the symbol shown. No conversion is done.',
  },
  { id: 'principal', label: 'Principal (starting amount)', type: 'number', default: 5000, min: 1, step: 100, help: 'The amount saved, invested or borrowed.' },
  { id: 'rate', label: 'Annual interest rate', type: 'number', unit: '%', default: 4, min: 0, max: 100, step: 0.1 },
  { id: 'years', label: 'Time: years', type: 'number', unit: 'years', default: 3, min: 0, max: 50, step: 1 },
  { id: 'months', label: 'Time: extra months', type: 'number', unit: 'months', default: 6, min: 0, max: 11, step: 1, help: 'Use 0 to 11. For example, 3 years and 6 months is 3.5 years.' },
];

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

export function calculate({ currency = 'USD', principal, rate, years, months } = {}) {
  const cur = CURRENCIES.find((c) => c.value === currency);
  if (!cur) return { error: 'Please choose a currency.' };
  if (![principal, rate, years, months].every(Number.isFinite)) return { error: 'Please enter a number in each field.' };
  if (principal < 1) return { error: 'The principal must be at least 1.' };
  if (principal > 1e10) return { error: 'Please enter a principal up to 10,000,000,000.' };
  if (rate < 0 || rate > 100) return { error: 'The annual interest rate must be between 0% and 100%.' };
  if (!Number.isInteger(years) || years < 0 || years > 50) return { error: 'Years must be a whole number from 0 to 50.' };
  if (!Number.isInteger(months) || months < 0 || months > 11) return { error: 'Extra months must be a whole number from 0 to 11.' };
  if (years === 0 && months === 0) return { error: 'Enter a time of at least 1 month.' };

  const t = years + months / 12;
  const prefix = cur.symbol;
  const money = (v) => ({ value: round2(v), digits: 2, prefix });
  const interest = principal * (rate / 100) * t;
  const total = principal + interest;
  const compoundAt = (x) => principal * Math.pow(1 + rate / 100, Math.floor(x + 1e-9)) * (1 + (rate / 100) * (x - Math.floor(x + 1e-9)));
  const compoundTotal = compoundAt(t);
  const perYear = principal * (rate / 100);

  const rows = [];
  const whole = Math.ceil(t);
  for (let y = 1; y <= whole; y++) {
    const ty = Math.min(y, t);
    const iy = principal * (rate / 100) * ty;
    rows.push([y <= t ? `End of year ${y}` : `End of term (${years ? years + (years === 1 ? ' year' : ' years') : ''}${years && months ? ' ' : ''}${months ? months + (months === 1 ? ' month' : ' months') : ''})`, money(iy), money(principal + iy), money(compoundAt(ty))]);
  }

  return {
    items: [
      { label: 'Total interest', ...money(interest), primary: true },
      { label: 'Total amount (principal + interest)', ...money(total) },
      { label: 'Interest per full year', ...money(perYear) },
      { label: 'Same money with interest compounded yearly', ...money(compoundTotal) },
      { label: 'Extra earned by yearly compounding', ...money(compoundTotal - total) },
    ],
    table: {
      caption: 'See simple vs. yearly compound growth',
      collapsible: true,
      headers: ['When', 'Simple interest so far', 'Simple total', 'Yearly compound total'],
      rows,
    },
    notes: [
      'Simple interest is I = P × r × t. Time t is years plus months ÷ 12, so 6 months counts as 0.5 year.',
      'The comparison column assumes interest is added once a year, and the leftover part of a year earns simple interest on the balance at the start of that year. Real accounts and loans may use daily balances, other day-count rules or fees.',
      'Amounts are calculated without rounding and rounded to the cent only for display. Taxes and inflation are not included.',
    ],
  };
}
