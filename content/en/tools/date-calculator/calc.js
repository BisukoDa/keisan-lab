// Date calculator: days between two dates, or add / subtract years, months, weeks and days.
import { parseIso, toMs, fromMs, addDays, diffDays, weekdayIndex, isLeapYear, formatEn, countWeekdays, WEEKDAYS_EN, MONTHS_EN } from '../../../lib/dates.js';

export const inputs = [
  {
    id: 'mode',
    label: 'What do you want to calculate?',
    type: 'select',
    default: 'between',
    options: [
      { value: 'between', label: 'Days between two dates' },
      { value: 'add', label: 'Add or subtract time from a date' },
    ],
  },
  { id: 'start', label: 'Start date', type: 'date', default: 'today' },
  { id: 'end', label: 'End date', type: 'date', default: 'today+100', showIf: { mode: 'between' } },
  {
    id: 'includeEnd',
    label: 'Include the end date (count both days)',
    type: 'select',
    default: 'no',
    showIf: { mode: 'between' },
    options: [
      { value: 'no', label: 'No (count the days after the start date)' },
      { value: 'yes', label: 'Yes (count both the start and end dates)' },
    ],
  },
  { id: 'years', label: 'Years', type: 'number', default: 0, step: 1, help: 'Use a negative number to go back in time.', showIf: { mode: 'add' } },
  { id: 'months', label: 'Months', type: 'number', default: 0, step: 1, showIf: { mode: 'add' } },
  { id: 'weeks', label: 'Weeks', type: 'number', default: 0, step: 1, showIf: { mode: 'add' } },
  { id: 'days', label: 'Days', type: 'number', default: 30, step: 1, showIf: { mode: 'add' } },
];

const MIN = '1000-01-01';
const MAX = '9999-12-31';
const inRange = (iso) => iso >= MIN && iso <= MAX;
const daysInMonth = (y, m) => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const pad = (n, w) => String(n).padStart(w, '0');

// Add whole months, clamping to the last day of the target month. Returns null when out of range.
export function addMonths(iso, n) {
  const p = parseIso(iso);
  const idx = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12 + 12) % 12 + 1;
  if (y < 1000 || y > 9999) return null;
  const d = Math.min(p.d, daysInMonth(y, m));
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

// Whole years, months and days from `from` to `to` (from <= to).
export function breakdown(from, to) {
  const a = parseIso(from);
  const b = parseIso(to);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months--;
  let anchor = addMonths(from, months);
  // Clamping can push the anchor past `to` (e.g. Jan 31 to Feb 28); step back one month.
  if (anchor > to) {
    months--;
    anchor = addMonths(from, months);
  }
  return { years: Math.floor(months / 12), months: months % 12, days: diffDays(anchor, to) };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isInt = (v) => Number.isInteger(v);

export function calculate({ mode, start, end, includeEnd, years, months, weeks, days }) {
  if (!parseIso(start)) return { error: 'Please enter a valid start date.' };
  if (!inRange(start)) return { error: 'Dates must be between January 1, 1000 and December 31, 9999.' };

  if (mode === 'between') {
    if (!parseIso(end)) return { error: 'Please enter a valid end date.' };
    if (!inRange(end)) return { error: 'Dates must be between January 1, 1000 and December 31, 9999.' };
    const notes = [];
    let [from, to] = [start, end];
    if (to < from) {
      [from, to] = [to, from];
      notes.push('The end date was earlier than the start date, so the two dates were swapped.');
    }
    const include = includeEnd === 'yes';
    const total = diffDays(from, to) + (include ? 1 : 0);
    const first = include ? from : (total > 0 ? addDays(from, 1) : from);
    const weekdays = total > 0 ? countWeekdays(first, to) : 0;
    const b = breakdown(from, to);
    notes.push(
      include
        ? 'Both the start date and the end date are counted.'
        : 'The start date is not counted; counting begins the next day and runs through the end date.'
    );
    notes.push('Weekdays are Monday to Friday. Public holidays are not excluded.');
    notes.push('The years, months and days breakdown measures elapsed calendar time from the first date to the second.');
    return {
      items: [
        { label: `${formatEn(from)} to ${formatEn(to)}`, value: total, unit: total === 1 ? ' day' : ' days', primary: true },
        { label: 'In weeks', value: `${plural(Math.floor(total / 7), 'week')} and ${plural(total % 7, 'day')}` },
        { label: 'Years, months and days (approx.)', value: `${plural(b.years, 'year')}, ${plural(b.months, 'month')}, ${plural(b.days, 'day')}` },
        { label: 'Weekdays (Mon-Fri)', value: weekdays, unit: weekdays === 1 ? ' day' : ' days' },
        { label: 'Weekend days (Sat-Sun)', value: total - weekdays, unit: total - weekdays === 1 ? ' day' : ' days' },
      ],
      notes,
    };
  }

  if (mode === 'add') {
    const parts = { years, months, weeks, days };
    for (const [k, v] of Object.entries(parts)) {
      if (!isInt(v)) return { error: `Please enter a whole number of ${k}.` };
    }
    if (Math.abs(years) > 9000 || Math.abs(months) > 108000 || Math.abs(weeks) > 470000 || Math.abs(days) > 3300000) {
      return { error: 'That amount of time is outside the supported range (years 1000 to 9999).' };
    }
    const rangeError = { error: 'The result falls outside the supported range of January 1, 1000 to December 31, 9999.' };
    const afterYears = addMonths(start, years * 12);
    if (!afterYears) return rangeError;
    const afterMonths = addMonths(afterYears, months);
    if (!afterMonths) return rangeError;
    const clamped = parseIso(afterYears).d !== parseIso(start).d || parseIso(afterMonths).d !== parseIso(afterYears).d;
    const dayShift = weeks * 7 + days;
    const ms = toMs(afterMonths) + dayShift * 86_400_000;
    if (!Number.isFinite(ms) || ms < toMs(MIN) || ms > toMs(MAX)) return rangeError;
    const result = fromMs(ms);
    const moved = diffDays(start, result);
    const notes = [];
    if (clamped) {
      notes.push('The original day of the month does not exist in the target month, so the last day of that month was used.');
    }
    notes.push('Years are added first, then months, then weeks and days.');
    return {
      items: [
        { label: 'Resulting date', value: formatEn(result), primary: true },
        { label: 'Day of the week', value: WEEKDAYS_EN[weekdayIndex(result)] },
        { label: 'Total days moved', value: moved, unit: Math.abs(moved) === 1 ? ' day' : ' days' },
        { label: 'Month', value: `${MONTHS_EN[parseIso(result).m - 1]} ${parseIso(result).y}` },
      ],
      notes,
    };
  }
  return { error: 'Please choose what you want to calculate.' };
}
