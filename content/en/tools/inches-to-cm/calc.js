// Inches/feet to centimeters and back. 1 inch = 2.54 cm exactly (international yard and pound agreement, 1959; NIST SP 811).
// Results are rounded only at the end, to the decimal places chosen.

export const inputs = [
  {
    id: 'mode',
    label: 'Convert',
    type: 'select',
    default: 'toCm',
    options: [
      { value: 'toCm', label: 'Feet and inches to centimeters' },
      { value: 'toIn', label: 'Centimeters to feet and inches' },
    ],
  },
  { id: 'feet', label: 'Feet', type: 'number', default: 5, min: 0, step: 1, showIf: { mode: 'toCm' } },
  { id: 'inches', label: 'Inches', type: 'number', default: 9, min: 0, step: 0.1, showIf: { mode: 'toCm' } },
  { id: 'cm', label: 'Centimeters', type: 'number', default: 175, min: 0, step: 0.1, showIf: { mode: 'toIn' } },
  {
    id: 'places',
    label: 'Decimal places',
    type: 'select',
    default: '1',
    options: [
      { value: '0', label: '0' },
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' },
    ],
  },
];

const CM_PER_INCH = 2.54;
const round = (v, p) => Math.round(Number((v * 10 ** p).toPrecision(14))) / 10 ** p;

export function calculate({ mode, feet, inches, cm, places }) {
  const p = Number(places);
  if (![0, 1, 2, 3].includes(p)) return { error: 'Please choose 0 to 3 decimal places.' };
  const notes = [
    'One inch is defined as exactly 2.54 centimeters, and one foot is 12 inches (30.48 cm), so the conversion itself is exact.',
    'Results are rounded to the decimal places you chose, only at the very end.',
  ];
  if (mode === 'toCm') {
    const f = Number.isFinite(feet) ? feet : 0;
    const i = Number.isFinite(inches) ? inches : 0;
    if (!Number.isFinite(feet) && !Number.isFinite(inches)) return { error: 'Please enter feet, inches, or both.' };
    if (f < 0 || i < 0) return { error: 'Feet and inches cannot be negative.' };
    const totalIn = f * 12 + i;
    if (totalIn > 1e7) return { error: 'That length is too large. Please check the numbers.' };
    const c = totalIn * CM_PER_INCH;
    return {
      items: [
        { label: 'Centimeters', value: round(c, p), digits: p, unit: ' cm', primary: true },
        { label: 'Meters', value: round(c / 100, Math.max(p, 2)), digits: Math.max(p, 2), unit: ' m' },
        { label: 'Millimeters', value: round(c * 10, p), digits: p, unit: ' mm' },
        { label: 'Total inches', value: round(totalIn, p), digits: p, unit: round(totalIn, p) === 1 ? ' inch' : ' inches' },
      ],
      notes,
    };
  }
  if (!Number.isFinite(cm)) return { error: 'Please enter a length in centimeters.' };
  if (cm < 0) return { error: 'Length cannot be negative.' };
  if (cm > 2.54e7) return { error: 'That length is too large. Please check the number.' };
  const totalIn = cm / CM_PER_INCH;
  let ft = Math.floor(round(totalIn, p) / 12);
  let rem = Math.max(0, round(totalIn - ft * 12, p)) || 0;
  if (rem >= 12) { ft += 1; rem = round(rem - 12, p) || 0; }
  return {
    items: [
      { label: 'Feet', value: ft, digits: 0, unit: ft === 1 ? ' foot' : ' feet', primary: true },
      { label: 'Plus inches', value: rem, digits: p, unit: rem === 1 ? ' inch' : ' inches', primary: true },
      { label: 'Total inches', value: round(totalIn, p), digits: p, unit: round(totalIn, p) === 1 ? ' inch' : ' inches' },
    ],
    notes,
  };
}
