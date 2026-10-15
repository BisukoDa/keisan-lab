// Salary to hourly: pay per hour from an annual, monthly, biweekly or weekly salary.
// Amounts are computed from the annual figure and rounded to the nearest cent only for display.

export const inputs = [
  { id: 'amount', label: 'Salary', type: 'number', prefix: '$', default: 75000, min: 0, step: 100 },
  {
    id: 'period',
    label: 'That salary is paid per',
    type: 'select',
    default: 'year',
    options: [
      { value: 'year', label: 'Year' },
      { value: 'month', label: 'Month' },
      { value: 'biweek', label: 'Two weeks (biweekly)' },
      { value: 'week', label: 'Week' },
    ],
  },
  { id: 'hoursPerWeek', label: 'Hours worked per week', type: 'number', default: 40, min: 0, max: 100, step: 0.5 },
  { id: 'unpaidWeeks', label: 'Unpaid weeks off per year', type: 'number', default: 0, min: 0, max: 51, step: 1, help: 'Enter 0 if your time off is paid.' },
];

const PERIODS_PER_YEAR = { year: 1, month: 12, biweek: 26, week: 52 };
const round2 = (x) => Math.round(x * 100) / 100;

export function calculate({ amount, period, hoursPerWeek, unpaidWeeks }) {
  if (![amount, hoursPerWeek, unpaidWeeks].every(Number.isFinite)) return { error: 'Please enter a number in each field.' };
  const perYear = PERIODS_PER_YEAR[period];
  if (!perYear) return { error: 'Please choose how often the salary is paid.' };
  if (amount <= 0) return { error: 'The salary must be greater than zero.' };
  if (amount > 1e8) return { error: 'The salary is too large. Please enter 100,000,000 or less.' };
  if (hoursPerWeek <= 0 || hoursPerWeek > 100) return { error: 'Hours per week must be more than 0 and no more than 100.' };
  if (!Number.isInteger(unpaidWeeks) || unpaidWeeks < 0 || unpaidWeeks > 51) return { error: 'Unpaid weeks off must be a whole number from 0 to 51.' };

  const weeksWorked = 52 - unpaidWeeks;
  // A weekly or biweekly amount is what you get for each week you work; monthly and yearly amounts are the yearly total.
  const annual = period === 'week' ? amount * weeksWorked : period === 'biweek' ? (amount * weeksWorked) / 2 : amount * perYear;
  const hoursPerYear = hoursPerWeek * weeksWorked;
  const hourly = annual / hoursPerYear;
  const usd = (v) => ({ value: round2(v), digits: 2, prefix: '$' });

  const notes = [
    'Each amount is calculated from the yearly salary and rounded to the nearest cent for display, so small differences of a cent can appear when you add the rounded numbers.',
    `Your yearly hours: ${hoursPerWeek} hours a week × ${weeksWorked} weeks = ${hoursPerYear.toLocaleString('en-US')} hours. This is gross pay before taxes and deductions.`,
    'Daily, weekly and biweekly pay are for the weeks you work, and daily pay assumes a 5-day work week. Monthly pay is the yearly salary divided by 12. A monthly or yearly salary is treated as the total you receive for the year, including any unpaid weeks.',
  ];
  if (hoursPerWeek > 40) notes.push('If you are paid overtime, the hourly figure above is your regular rate. Overtime is at least 1.5 times the regular rate for hours over 40 in a workweek.');

  const items = [
    { label: 'Hourly pay', ...usd(hourly), primary: true },
    { label: 'Daily pay (5-day week)', ...usd((hourly * hoursPerWeek) / 5) },
    { label: 'Weekly pay', ...usd(hourly * hoursPerWeek) },
    { label: 'Biweekly pay', ...usd(hourly * hoursPerWeek * 2) },
    { label: 'Monthly pay', ...usd(annual / 12) },
    { label: 'Yearly pay', ...usd(annual) },
    { label: 'Hourly pay using the federal 2,087-hour divisor', ...usd(annual / 2087) },
  ];
  return { items, notes };
}
