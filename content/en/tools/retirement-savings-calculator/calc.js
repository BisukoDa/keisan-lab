// 401(k) retirement savings projection.
// Model (one step per year): balance = balance x (1 + return) + employee contribution + employer match.
// Contributions are assumed to be made at the END of each year; salary grows once a year.
// Employee contribution = salary x contribution %, capped at the 2026 IRS elective deferral limit
// ($24,500, plus $8,000 catch-up at age 50+, or $11,250 at ages 60-63). Limits are held at 2026 values.
// Employer match = matchRate x min(employee contribution, matchCap % of salary).
// Amounts are computed in cents-precision floats and rounded only for display.

export const LIMIT_BASE = 24500;
export const CATCH_UP_50 = 8000;
export const CATCH_UP_60_63 = 11250;

export function deferralLimit(age) {
  if (age >= 60 && age <= 63) return LIMIT_BASE + CATCH_UP_60_63;
  if (age >= 50) return LIMIT_BASE + CATCH_UP_50;
  return LIMIT_BASE;
}

export const inputs = [
  { id: 'age', label: 'Your current age', type: 'number', unit: ' years', default: 30, min: 18, max: 80, step: 1 },
  { id: 'retireAge', label: 'Age you plan to retire', type: 'number', unit: ' years', default: 65, min: 19, max: 90, step: 1 },
  { id: 'balance', label: 'Current 401(k) balance', type: 'number', prefix: '$', default: 20000, min: 0, step: 1000 },
  { id: 'salary', label: 'Current annual salary', type: 'number', prefix: '$', default: 70000, min: 1, step: 1000, help: 'Before taxes.' },
  { id: 'contribPct', label: 'Your contribution', type: 'number', unit: '% of salary', default: 8, min: 0, max: 100, step: 0.5 },
  { id: 'matchRate', label: 'Employer match rate', type: 'number', unit: '% of your contribution', default: 50, min: 0, max: 200, step: 5, help: 'For example, 50 means the employer adds 50 cents for each $1 you contribute. Use 0 for no match.' },
  { id: 'matchCap', label: 'Match applies up to', type: 'number', unit: '% of salary', default: 6, min: 0, max: 100, step: 0.5, help: 'The employer only matches your contributions up to this share of your pay.' },
  { id: 'raise', label: 'Expected yearly raise', type: 'number', unit: '%', default: 3, min: -10, max: 20, step: 0.1 },
  { id: 'rate', label: 'Expected annual return', type: 'number', unit: '%', default: 6, min: -10, max: 20, step: 0.1, help: 'A guess, not a promise.' },
  { id: 'inflation', label: 'Expected inflation', type: 'number', unit: '%', default: 2.5, min: 0, max: 15, step: 0.1, help: 'Used to show the result in today\'s dollars.' },
];

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

export function calculate({ age, retireAge, balance, salary, contribPct, matchRate, matchCap, raise, rate, inflation } = {}) {
  const all = [age, retireAge, balance, salary, contribPct, matchRate, matchCap, raise, rate, inflation];
  if (!all.every(Number.isFinite)) return { error: 'Please enter a number in each field.' };
  if (!Number.isInteger(age) || !Number.isInteger(retireAge)) return { error: 'Ages must be whole numbers.' };
  if (age < 18 || age > 80) return { error: 'Your current age must be between 18 and 80.' };
  if (retireAge <= age) return { error: 'Your retirement age must be greater than your current age.' };
  if (retireAge - age > 60) return { error: 'Please keep the time until retirement to 60 years or less.' };
  if (balance < 0 || balance > 1e9) return { error: 'The current balance must be between $0 and $1,000,000,000.' };
  if (salary <= 0 || salary > 1e8) return { error: 'The salary must be greater than $0 and at most $100,000,000.' };
  if (contribPct < 0 || contribPct > 100) return { error: 'Your contribution must be between 0% and 100% of salary.' };
  if (matchRate < 0 || matchRate > 200) return { error: 'The match rate must be between 0% and 200%.' };
  if (matchCap < 0 || matchCap > 100) return { error: 'The match limit must be between 0% and 100% of salary.' };
  if (raise < -10 || raise > 20) return { error: 'The yearly raise must be between -10% and 20%.' };
  if (rate < -10 || rate > 20) return { error: 'The annual return must be between -10% and 20%.' };
  if (inflation < 0 || inflation > 15) return { error: 'Inflation must be between 0% and 15%.' };

  const years = retireAge - age;
  let bal = balance;
  let sal = salary;
  let yours = 0;
  let employer = 0;
  let capped = false;
  const rows = [];
  for (let y = 1; y <= years; y++) {
    const a = age + y - 1;
    const wanted = sal * contribPct / 100;
    const limit = deferralLimit(a);
    const mine = Math.min(wanted, limit);
    if (wanted > limit) capped = true;
    const match = Math.min(mine, sal * matchCap / 100) * matchRate / 100;
    bal = bal * (1 + rate / 100) + mine + match;
    yours += mine;
    employer += match;
    rows.push([a, round2(sal), round2(mine), round2(match), round2(bal)]);
    sal *= 1 + raise / 100;
  }
  const growth = bal - balance - yours - employer;
  const real = bal / Math.pow(1 + inflation / 100, years);
  const m = (v) => ({ value: round2(v), digits: 2, prefix: '$' });

  const notes = [
    'Each year, the balance grows by your return, then your contribution and the employer match are added at the end of the year. Your salary rises once a year by the raise you entered.',
    `Your contribution is capped at the 2026 IRS limit of $24,500 (plus $8,000 from age 50, or $11,250 at ages 60 to 63). Those limits are held at 2026 values for every year, although the IRS adjusts them over time.`,
    'The employer match is your match rate times the smaller of your contribution and the match limit. Taxes, fees, vesting rules and the IRS compensation limit are not included. Returns are not guaranteed.',
  ];
  if (capped) notes.unshift('Your planned contribution is higher than the IRS limit in at least one year, so it was capped at the limit in those years.');

  return {
    items: [
      { label: `Estimated balance at age ${retireAge}`, ...m(bal), primary: true },
      { label: 'In today\'s dollars (after inflation)', ...m(real) },
      { label: 'Your total contributions', ...m(yours) },
      { label: 'Total employer match', ...m(employer) },
      { label: 'Investment growth', ...m(growth) },
    ],
    table: {
      caption: 'See the year-by-year projection',
      collapsible: true,
      headers: ['Age', 'Salary', 'Your contribution', 'Employer match', 'End balance'],
      rows: rows.map(([a, s, c, e, b]) => [a, { value: s, digits: 2, prefix: '$' }, { value: c, digits: 2, prefix: '$' }, { value: e, digits: 2, prefix: '$' }, { value: b, digits: 2, prefix: '$' }]),
    },
    notes,
  };
}
