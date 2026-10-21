// Temperature converter: Fahrenheit, Celsius and Kelvin using the exact SI-based relations.
// C = (F − 32) × 5/9, K = C + 273.15. Results are rounded to the number of decimals chosen.

export const inputs = [
  { id: 'value', label: 'Temperature', type: 'number', default: 98.6, step: 0.1 },
  {
    id: 'from',
    label: 'Convert from',
    type: 'select',
    default: 'F',
    options: [
      { value: 'F', label: 'Fahrenheit (°F)' },
      { value: 'C', label: 'Celsius (°C)' },
      { value: 'K', label: 'Kelvin (K)' },
    ],
  },
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

export const toCelsius = (v, from) => (from === 'F' ? ((v - 32) * 5) / 9 : from === 'K' ? v - 273.15 : v);
export const fromCelsius = (c, to) => (to === 'F' ? (c * 9) / 5 + 32 : to === 'K' ? c + 273.15 : c);

const NAMES = { F: 'Fahrenheit', C: 'Celsius', K: 'Kelvin' };
const round = (v, p) => {
  const r = Math.round(Number((v * 10 ** p).toPrecision(14))) / 10 ** p;
  return r === 0 ? 0 : r; // avoid "-0"
};

export function calculate({ value, from, places }) {
  const p = Number(places);
  if (!Number.isFinite(value)) return { error: 'Please enter a temperature.' };
  if (!NAMES[from]) return { error: 'Please choose a unit to convert from.' };
  if (![0, 1, 2, 3].includes(p)) return { error: 'Please choose 0 to 3 decimal places.' };
  const c = toCelsius(value, from);
  if (c < -273.15 - 1e-9) return { error: 'That is below absolute zero (−273.15 °C, −459.67 °F, 0 K). Please enter a higher temperature.' };
  if (Math.abs(c) > 1e9) return { error: 'That temperature is too large. Please check the number.' };

  const unit = { F: ' °F', C: ' °C', K: ' K' };
  const targets = ['F', 'C', 'K'].filter((u) => u !== from);
  const items = targets.map((u, i) => ({
    label: `${NAMES[from]} to ${NAMES[u]}`,
    value: round(fromCelsius(c, u), p),
    digits: p,
    unit: unit[u],
    primary: i === 0,
  }));
  const table = {
    caption: 'Common temperatures',
    collapsible: true,
    headers: ['Reference point', '°F', '°C', 'K'],
    rows: [
      ['Absolute zero', -459.67, -273.15, 0],
      ['Water freezes', 32, 0, 273.15],
      ['Room temperature (about)', 68, 20, 293.15],
      ['Normal body temperature (about)', 98.6, 37, 310.15],
      ['Water boils (sea level)', 212, 100, 373.15],
    ],
  };
  return {
    items,
    table,
    notes: [
      'Fahrenheit and Celsius are related by the exact formula °C = (°F − 32) × 5/9. Kelvin is Celsius plus 273.15.',
      'Results are rounded to the decimal places you chose; the conversion itself is not rounded in between.',
    ],
  };
}
