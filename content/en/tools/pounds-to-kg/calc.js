// Pounds/ounces to kilograms and back. 1 lb = 0.45359237 kg exactly (international yard and pound agreement, 1959; NIST SP 811).
// Results are rounded only at the end, to the decimal places chosen.

export const inputs = [
  {
    id: 'mode',
    label: 'Convert',
    type: 'select',
    default: 'toKg',
    options: [
      { value: 'toKg', label: 'Pounds and ounces to kilograms' },
      { value: 'toLb', label: 'Kilograms to pounds and ounces' },
    ],
  },
  { id: 'lb', label: 'Pounds', type: 'number', default: 150, min: 0, step: 1, showIf: { mode: 'toKg' } },
  { id: 'oz', label: 'Ounces', type: 'number', default: 0, min: 0, step: 0.1, showIf: { mode: 'toKg' }, help: 'Optional. 16 ounces make 1 pound.' },
  { id: 'kg', label: 'Kilograms', type: 'number', default: 68, min: 0, step: 0.1, showIf: { mode: 'toLb' } },
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

const KG_PER_LB = 0.45359237;
const round = (v, p) => Math.round(Number((v * 10 ** p).toPrecision(14))) / 10 ** p;
const lbUnit = (v) => (v === 1 ? ' pound' : ' pounds');
const ozUnit = (v) => (v === 1 ? ' ounce' : ' ounces');

export function calculate({ mode, lb, oz, kg, places }) {
  const p = Number(places);
  if (![0, 1, 2, 3].includes(p)) return { error: 'Please choose 0 to 3 decimal places.' };
  const notes = [
    'One pound is defined as exactly 0.45359237 kilograms, and one pound is 16 ounces, so the conversion itself is exact.',
    'Results are rounded to the decimal places you chose, only at the very end.',
  ];
  if (mode === 'toKg') {
    const l = Number.isFinite(lb) ? lb : 0;
    const o = Number.isFinite(oz) ? oz : 0;
    if (!Number.isFinite(lb) && !Number.isFinite(oz)) return { error: 'Please enter pounds, ounces, or both.' };
    if (l < 0 || o < 0) return { error: 'Pounds and ounces cannot be negative.' };
    const totalLb = l + o / 16;
    if (totalLb > 1e9) return { error: 'That weight is too large. Please check the numbers.' };
    const k = totalLb * KG_PER_LB;
    return {
      items: [
        { label: 'Kilograms', value: round(k, p), digits: p, unit: ' kg', primary: true },
        { label: 'Grams', value: round(k * 1000, p), digits: p, unit: ' g' },
        { label: 'Total pounds', value: round(totalLb, p), digits: p, unit: round(totalLb, p) === 1 ? ' pound' : ' pounds' },
      ],
      notes,
    };
  }
  if (!Number.isFinite(kg)) return { error: 'Please enter a weight in kilograms.' };
  if (kg < 0) return { error: 'Weight cannot be negative.' };
  if (kg > 4e8) return { error: 'That weight is too large. Please check the number.' };
  const totalLb = kg / KG_PER_LB;
  const totalOz = totalLb * 16;
  // Split into whole pounds and leftover ounces; ounces use the chosen places.
  let whole = Math.floor(round(totalOz, p) / 16);
  let rem = Math.max(0, round(totalOz - whole * 16, p)) || 0;
  if (rem >= 16) { whole += 1; rem = round(rem - 16, p) || 0; }
  const st = Math.floor(whole / 14);
  const stLb = whole - st * 14;
  return {
    items: [
      { label: 'Pounds', value: round(totalLb, p), digits: p, unit: round(totalLb, p) === 1 ? ' pound' : ' pounds', primary: true },
      { label: 'Whole pounds', value: whole, digits: 0, unit: lbUnit(whole) },
      { label: 'Plus ounces', value: rem, digits: p, unit: ozUnit(rem) },
      { label: 'Total ounces', value: round(totalOz, p), digits: p, unit: round(totalOz, p) === 1 ? ' ounce' : ' ounces' },
      { label: 'Stone (whole)', value: st, digits: 0, unit: ' stone' },
      { label: 'Plus pounds (after stone)', value: stLb, digits: 0, unit: lbUnit(stLb) },
    ],
    notes: [...notes, 'Stone is a UK unit: 1 stone = 14 pounds. The stone line uses whole pounds.'],
  };
}
