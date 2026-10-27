// Hours calculator: time between a start and end clock time, minus unpaid break,
// overnight shifts, decimal hours, optional multiple days and pay.

const AMPM = [
  { value: 'am', label: 'AM' },
  { value: 'pm', label: 'PM' },
];

export const inputs = [
  { id: 'sh', label: 'Start hour', type: 'number', default: 9, min: 1, max: 12, step: 1 },
  { id: 'sm', label: 'Start minute', type: 'number', default: 0, min: 0, max: 59, step: 1 },
  { id: 'sap', label: 'Start AM/PM', type: 'select', default: 'am', options: AMPM },
  { id: 'eh', label: 'End hour', type: 'number', default: 5, min: 1, max: 12, step: 1 },
  { id: 'em', label: 'End minute', type: 'number', default: 30, min: 0, max: 59, step: 1 },
  { id: 'eap', label: 'End AM/PM', type: 'select', default: 'pm', options: AMPM },
  { id: 'brk', label: 'Unpaid break', type: 'number', unit: ' min', default: 30, min: 0, step: 5, help: 'Total unpaid break time per day, in minutes.' },
  { id: 'days', label: 'Number of days', type: 'number', default: 5, min: 1, step: 1 },
  { id: 'rate', label: 'Hourly pay (optional)', type: 'number', prefix: '$', default: 20, min: 0, step: 0.01, help: 'Leave empty to skip the pay estimate.' },
];

const toMinutes = (h, m, ap) => (h % 12) * 60 + m + (ap === 'pm' ? 720 : 0);
const isInt = (v) => Number.isInteger(v);

export function calculate({ sh, sm, sap, eh, em, eap, brk, days, rate }) {
  if (![sh, sm, eh, em].every(Number.isFinite)) return { error: 'Please enter the start and end times.' };
  if (![sh, eh].every((h) => isInt(h) && h >= 1 && h <= 12)) return { error: 'Hours must be whole numbers from 1 to 12.' };
  if (![sm, em].every((m) => isInt(m) && m >= 0 && m <= 59)) return { error: 'Minutes must be whole numbers from 0 to 59.' };
  const brkMin = Number.isFinite(brk) ? brk : 0;
  if (!isInt(brkMin) || brkMin < 0) return { error: 'The break must be a whole number of minutes, 0 or more.' };
  if (Number.isFinite(rate) && rate < 0) return { error: 'Hourly pay cannot be negative.' };
  const nDays = Number.isFinite(days) ? days : 1;
  if (!isInt(nDays) || nDays < 1) return { error: 'The number of days must be a whole number of 1 or more.' };

  const start = toMinutes(sh, sm, sap);
  const end = toMinutes(eh, em, eap);
  if (start === end) return { error: 'The start and end times are the same. Change one of them.' };
  const overnight = end < start;
  const span = overnight ? end + 1440 - start : end - start;
  const worked = span - brkMin;
  if (worked <= 0) return { error: 'The break is as long as the whole shift. Shorten the break.' };

  const hm = (min) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
  const dec = (min) => Math.round((min / 60) * 100) / 100;
  const total = worked * nDays;

  const items = [
    { label: 'Hours worked per day', value: hm(worked), primary: true },
    { label: 'Per day in decimal hours', value: dec(worked), digits: 2, unit: worked === 60 ? ' hour' : ' hours' },
  ];
  if (nDays > 1) {
    items.push({ label: `Total for ${nDays} days`, value: hm(total) });
    items.push({ label: 'Total in decimal hours', value: dec(total), digits: 2, unit: ' hours' });
  }
  if (Number.isFinite(rate) && rate >= 0) {
    // Pay is figured in cents from whole minutes, rounded to the nearest cent.
    const cents = Math.round((total * Math.round(rate * 100)) / 60);
    items.push({ label: 'Estimated gross pay', value: cents / 100, digits: 2, prefix: '$' });
  }
  const notes = [
    'Pay is the total minutes worked times the hourly rate (rounded to the nearest cent first), rounded to the nearest cent. It is before taxes and does not include overtime.',
  ];
  if (overnight) notes.unshift('The end time is earlier than the start time, so the shift is counted as ending the next day.');
  return { items, notes };
}
