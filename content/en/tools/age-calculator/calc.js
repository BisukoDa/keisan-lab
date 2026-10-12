// Age calculator: exact age in years, months and days, totals, birth weekday and next birthday.
import { parseIso, diffDays, weekdayIndex, isLeapYear, formatEn, WEEKDAYS_EN } from '../../../lib/dates.js';

export const inputs = [
  { id: 'birth', label: 'Date of birth', type: 'date', default: '1990-06-15' },
  { id: 'asOf', label: 'Age on this date', type: 'date', default: 'today', help: 'Leave as today, or pick any past or future date to see the age on that day.' },
];

const MIN_YEAR = 1000;
const MAX_YEAR = 9998;
const pad = (n) => String(n).padStart(2, '0');
const fmt = (n) => n.toLocaleString('en-US');
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
const daysInMonth = (y, m) => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

// Whole years, then whole months, then remaining days. When the day count goes negative,
// borrow the length of the month before the as-of month.
export function ymd(birth, asOf) {
  const b = parseIso(birth);
  const t = parseIso(asOf);
  let years = t.y - b.y;
  let months = t.m - b.m;
  let days = t.d - b.d;
  // Borrow the length of the previous month; in rare month-end cases (e.g. Jan 31 to Mar 1)
  // one borrow is not enough, so keep stepping back one more month.
  let my = t.y;
  let mm = t.m;
  while (days < 0) {
    mm--;
    if (mm === 0) {
      mm = 12;
      my--;
    }
    days += daysInMonth(my, mm);
    months--;
  }
  if (months < 0) {
    months += 12;
    years--;
  }
  return { years, months, days };
}

// The day the age goes up in a given year. For 29 February births in common years this is
// 1 March, the same day the years/months/days count ticks over, so the results never disagree.
export function birthdayIn(year, b) {
  if (b.m === 2 && b.d === 29 && !isLeapYear(year)) return `${year}-03-01`;
  return `${year}-${pad(b.m)}-${pad(b.d)}`;
}

export function calculate({ birth, asOf }) {
  const b = parseIso(birth);
  if (!b) return { error: 'Please enter a valid date of birth.' };
  const t = parseIso(asOf);
  if (!t) return { error: 'Please enter a valid date to calculate the age on.' };
  if (b.y < MIN_YEAR || b.y > MAX_YEAR || t.y < MIN_YEAR || t.y > MAX_YEAR) {
    return { error: `Dates must fall between the years ${MIN_YEAR} and ${MAX_YEAR}.` };
  }
  if (asOf < birth) return { error: 'The "age on" date must be on or after the date of birth.' };

  const { years, months, days } = ymd(birth, asOf);
  const totalDays = diffDays(birth, asOf);
  const totalMonths = years * 12 + months;
  const weeks = Math.floor(totalDays / 7);
  const restDays = totalDays % 7;

  let next = birthdayIn(t.y, b);
  if (next < asOf) next = birthdayIn(t.y + 1, b);
  const untilNext = diffDays(asOf, next);
  const turning = parseIso(next).y - b.y;
  const nextText = untilNext === 0
    ? `${formatEn(next)} (today, age ${turning})`
    : `${formatEn(next)} (in ${plural(untilNext, 'day')}, turning ${turning})`;

  const items = [
    { label: 'Exact age', value: `${plural(years, 'year')}, ${plural(months, 'month')}, ${plural(days, 'day')}`, primary: true },
    { label: 'Age in years', value: years, unit: years === 1 ? ' year' : ' years' },
    { label: 'Total months', value: totalMonths, unit: totalMonths === 1 ? ' month' : ' months' },
    { label: 'Total weeks and days', value: `${plural(weeks, 'week')} and ${plural(restDays, 'day')}` },
    { label: 'Total days', value: totalDays, unit: totalDays === 1 ? ' day' : ' days' },
    { label: 'Day of the week you were born', value: WEEKDAYS_EN[weekdayIndex(birth)] },
    { label: 'Next birthday', value: nextText },
  ];
  const notes = [
    'Years, months and days are counted in that order. If the day count would be negative, the length of the month before the "age on" date is borrowed. Other calculators, including our Date Calculator, may differ by a few days around month ends.',
  ];
  if (b.m === 2 && b.d === 29) {
    notes.push('Born on 29 February: in common years this calculator counts the birthday on March 1, the day the age goes up. Many people celebrate on February 28 instead, and legal rules for leap-day birthdays differ by country.');
  }
  return { items, notes };
}
