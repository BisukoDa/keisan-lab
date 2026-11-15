// Savings goal calculator: the monthly deposit needed to reach a goal.
// Assumptions: interest is credited monthly at rate / 12, and each deposit is made at the END of the month.
// Future value: FV = S(1+i)^n + PMT x ((1+i)^n - 1) / i, solved for PMT.

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
  { id: 'goal', label: 'Savings goal', type: 'number', default: 20000, min: 1, step: 500, help: 'The total you want to have at the end.' },
  { id: 'current', label: 'Already saved', type: 'number', default: 2000, min: 0, step: 100, help: 'Use 0 if you are starting from scratch.' },
  { id: 'rate', label: 'Annual interest rate (APR)', type: 'number', unit: '%', default: 4, min: 0, max: 30, step: 0.1, help: 'Use 0 if the money earns no interest. If your bank shows an APY, entering it here gives a close estimate, slightly on the low side.' },
  { id: 'years', label: 'Time: years', type: 'number', unit: 'years', default: 3, min: 0, max: 50, step: 1 },
  { id: 'months', label: 'Time: extra months', type: 'number', unit: 'months', default: 0, min: 0, max: 11, step: 1, help: 'Use 0 to 11.' },
];

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

export function calculate({ currency = 'USD', goal, current, rate, years, months } = {}) {
  const cur = CURRENCIES.find((c) => c.value === currency);
  if (!cur) return { error: 'Please choose a currency.' };
  if (![goal, current, rate, years, months].every(Number.isFinite)) return { error: 'Please enter a number in each field.' };
  if (goal < 1) return { error: 'The savings goal must be at least 1.' };
  if (goal > 1e10) return { error: 'Please enter a goal up to 10,000,000,000.' };
  if (current < 0) return { error: 'The amount already saved cannot be negative.' };
  if (current > 1e10) return { error: 'Please enter an amount already saved up to 10,000,000,000.' };
  if (rate < 0 || rate > 30) return { error: 'The annual interest rate must be between 0% and 30%.' };
  if (!Number.isInteger(years) || years < 0 || years > 50) return { error: 'Years must be a whole number from 0 to 50.' };
  if (!Number.isInteger(months) || months < 0 || months > 11) return { error: 'Extra months must be a whole number from 0 to 11.' };
  const n = years * 12 + months;
  if (n < 1) return { error: 'Enter a time of at least 1 month.' };

  const prefix = cur.symbol;
  const money = (v) => ({ value: round2(v), digits: 2, prefix });
  const i = rate / 100 / 12;
  // log1p / expm1 keep full precision even for extremely small rates.
  const growthAt = (m) => (i === 0 ? 1 : Math.exp(m * Math.log1p(i)));
  const annuityAt = (m) => (i === 0 ? m : Math.expm1(m * Math.log1p(i)) / i);
  const startGrown = current * growthAt(n);
  const annuity = annuityAt(n);
  const needed = goal - startGrown;
  const alreadyThere = needed <= 0;
  const pmt = alreadyThere ? 0 : needed / annuity;
  // Display the deposit rounded up to the cent so the goal is actually reached.
  const pmtShown = Math.ceil(pmt * 100 - 1e-9) / 100;
  const deposited = pmtShown * n;
  const endBalance = startGrown + pmtShown * annuity;
  const interest = endBalance - current - deposited;

  const rows = [];
  for (let m = 1; m <= n; m++) {
    if (m % 12 === 0 || m === n) {
      const bal = current * growthAt(m) + pmtShown * annuityAt(m);
      const paid = pmtShown * m;
      rows.push([m % 12 === 0 ? `End of year ${m / 12}` : `End of month ${m}`, money(paid), money(bal - current - paid), money(bal)]);
    }
  }

  const notes = [
    'Interest is credited once a month at the annual rate ÷ 12, and each deposit is made at the end of the month. Real accounts may use other rules, and the rate can change.',
    'The monthly deposit is rounded up to the next cent so that you reach the goal. Taxes, fees and inflation are not included.',
  ];
  if (alreadyThere) notes.unshift('Your current savings already grow to the goal on their own, so no monthly deposit is needed.');

  return {
    items: [
      { label: 'Monthly deposit needed', ...money(pmtShown), primary: true },
      { label: 'Total of your deposits', ...money(deposited) },
      { label: 'Interest earned', ...money(interest) },
      { label: 'Balance at the end', ...money(endBalance) },
      { label: 'Number of monthly deposits', value: n, unit: n === 1 ? ' deposit' : ' deposits' },
    ],
    table: {
      caption: 'See how the balance grows',
      collapsible: true,
      headers: ['When', 'Deposits so far', 'Interest so far', 'Balance'],
      rows,
    },
    notes,
  };
}
