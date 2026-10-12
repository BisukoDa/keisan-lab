// Compound interest calculator with optional monthly contributions.
// Assumptions: contributions are made at the END of each month. Interest compounds n times a year
// at rate r/n per period; to combine that with monthly deposits we use the equivalent monthly rate
// (1 + r/n)^(n/12) - 1, so one full year always grows by exactly (1 + r/n)^n.

const CURRENCIES = [
  { value: 'USD', label: 'US dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British pound (£)', symbol: '£' },
  { value: 'CAD', label: 'Canadian dollar (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'Australian dollar (A$)', symbol: 'A$' },
  { value: 'INR', label: 'Indian rupee (₹)', symbol: '₹' },
  { value: 'JPY', label: 'Japanese yen (¥)', symbol: '¥' },
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
  { id: 'initial', label: 'Initial deposit', type: 'number', default: 10000, min: 0, step: 100 },
  { id: 'monthly', label: 'Monthly contribution', type: 'number', default: 200, min: 0, step: 10, help: 'Added at the end of every month. Use 0 for none.' },
  { id: 'rate', label: 'Annual interest rate', type: 'number', unit: '%', default: 7, min: -20, max: 50, step: 0.1 },
  { id: 'years', label: 'Length of time', type: 'number', unit: 'years', default: 10, min: 1, max: 60, step: 1 },
  {
    id: 'compounding',
    label: 'Compounding frequency',
    type: 'select',
    default: '12',
    options: [
      { value: '1', label: 'Annually (1 time a year)' },
      { value: '2', label: 'Semiannually (2 times a year)' },
      { value: '4', label: 'Quarterly (4 times a year)' },
      { value: '12', label: 'Monthly (12 times a year)' },
      { value: '365', label: 'Daily (365 times a year)' },
    ],
  },
];

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

export function calculate({ currency = 'USD', initial, monthly, rate, years, compounding = '12' } = {}) {
  const cur = CURRENCIES.find((c) => c.value === currency);
  const n = Number(compounding);
  if (!cur) return { error: 'Please choose a currency.' };
  if (![1, 2, 4, 12, 365].includes(n)) return { error: 'Please choose how often interest compounds.' };
  if (![initial, monthly, rate, years].every(Number.isFinite)) return { error: 'Please enter a number in each field.' };
  if (initial < 0 || monthly < 0) return { error: 'The initial deposit and monthly contribution cannot be negative.' };
  if (initial > 1e10 || monthly > 1e8) return { error: 'Please enter an initial deposit up to 10,000,000,000 and a monthly contribution up to 100,000,000.' };
  if (initial === 0 && monthly === 0) return { error: 'Enter an initial deposit, a monthly contribution, or both.' };
  if (rate < -20 || rate > 50) return { error: 'The annual interest rate must be between -20% and 50%.' };
  if (!Number.isInteger(years) || years < 1 || years > 60) return { error: 'The length of time must be a whole number of years from 1 to 60.' };

  const growthPerPeriod = 1 + rate / 100 / n;
  const i = Math.pow(growthPerPeriod, n / 12) - 1; // equivalent monthly rate
  const apy = (Math.pow(growthPerPeriod, n) - 1) * 100;

  let balance = initial;
  let contributed = initial;
  const rows = [];
  const digits = currency === 'JPY' ? 0 : 2;
  const prefix = cur.symbol;
  const money = (v) => ({ value: digits === 0 ? Math.round(v) : round2(v), digits, prefix });
  for (let year = 1; year <= years; year++) {
    const startBalance = balance;
    for (let m = 0; m < 12; m++) balance = balance * (1 + i) + monthly;
    contributed += monthly * 12;
    const interestThisYear = balance - startBalance - monthly * 12;
    rows.push([year, money(contributed), money(interestThisYear), money(balance)]);
  }
  const interest = balance - contributed;

  return {
    items: [
      { label: `Future balance after ${years} ${years === 1 ? 'year' : 'years'}`, ...money(balance), primary: true },
      { label: 'Total contributions (initial deposit + monthly deposits)', ...money(contributed) },
      { label: 'Total interest earned', ...money(interest) },
      { label: 'Effective annual yield (APY)', value: round2(apy), digits: 2, unit: '%' },
    ],
    table: {
      caption: 'See the year-by-year growth',
      collapsible: true,
      headers: ['Year', 'Total contributions', 'Interest earned that year', 'End balance'],
      rows,
    },
    notes: [
      'Monthly contributions are assumed to be made at the end of each month. Interest compounds at the frequency you chose, using the equivalent monthly rate (1 + r/n)^(n/12) − 1.',
      'The rate is assumed to stay the same every year. Real returns vary and are not guaranteed, and the value can fall as well as rise.',
      'Taxes, fees and inflation are not included. Amounts are calculated without rounding and rounded only for display.',
    ],
  };
}
