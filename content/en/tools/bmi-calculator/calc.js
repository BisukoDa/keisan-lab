// BMI calculator for adults (20+): pounds/feet/inches or kilograms/centimeters.
// BMI = kg / m^2. Imperial inputs are converted with exact factors (1 lb = 0.45359237 kg, 1 in = 0.0254 m).

export const inputs = [
  {
    id: 'units',
    label: 'Units',
    type: 'select',
    default: 'imperial',
    options: [
      { value: 'imperial', label: 'Pounds, feet and inches' },
      { value: 'metric', label: 'Kilograms and centimeters' },
    ],
  },
  { id: 'feet', label: 'Height (feet)', type: 'number', unit: ' ft', default: 5, min: 0, step: 1, showIf: { units: 'imperial' } },
  { id: 'inches', label: 'Height (inches)', type: 'number', unit: ' in', default: 9, min: 0, step: 0.5, showIf: { units: 'imperial' } },
  { id: 'pounds', label: 'Weight', type: 'number', unit: ' lb', default: 160, min: 1, step: 0.5, showIf: { units: 'imperial' } },
  { id: 'cm', label: 'Height', type: 'number', unit: ' cm', default: 175, min: 1, step: 0.5, showIf: { units: 'metric' } },
  { id: 'kg', label: 'Weight', type: 'number', unit: ' kg', default: 72, min: 1, step: 0.1, showIf: { units: 'metric' } },
];

const KG_PER_LB = 0.45359237;
const M_PER_IN = 0.0254;

export function categoryFor(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy weight';
  if (bmi < 30) return 'Overweight';
  if (bmi < 35) return 'Obesity (Class 1)';
  if (bmi < 40) return 'Obesity (Class 2)';
  return 'Obesity (Class 3, severe)';
}

export function calculate({ units, feet, inches, pounds, cm, kg }) {
  let heightM;
  let weightKg;
  const imperial = units === 'imperial';
  if (units !== 'imperial' && units !== 'metric') return { error: 'Please choose pounds or kilograms.' };
  if (imperial) {
    if (![feet, inches, pounds].every(Number.isFinite)) return { error: 'Please enter your height and weight.' };
    if (feet < 0 || inches < 0) return { error: 'Height cannot be negative.' };
    heightM = (feet * 12 + inches) * M_PER_IN;
    weightKg = pounds * KG_PER_LB;
  } else {
    if (![cm, kg].every(Number.isFinite)) return { error: 'Please enter your height and weight.' };
    heightM = cm / 100;
    weightKg = kg;
  }
  if (heightM <= 0) return { error: 'Height must be greater than zero.' };
  if (weightKg <= 0) return { error: 'Weight must be greater than zero.' };
  if (heightM < 0.5 || heightM > 2.8) return { error: 'Height looks out of range. Please check the number (about 20 to 110 inches, or 50 to 280 cm).' };
  if (weightKg > 700) return { error: 'Weight looks out of range. Please check the number.' };

  const bmi = Math.round((weightKg / heightM ** 2) * 10) / 10;
  const category = categoryFor(bmi);

  // Weight at BMI 18.5 and 24.9 for this height (the CDC "healthy weight" band is 18.5 to 24.9).
  const lowKg = 18.5 * heightM ** 2;
  const highKg = 24.9 * heightM ** 2;
  const unit = imperial ? ' lb' : ' kg';
  const conv = imperial ? 1 / KG_PER_LB : 1;
  const low = Math.round(lowKg * conv * 10) / 10;
  const high = Math.round(highKg * conv * 10) / 10;
  const current = imperial ? weightKg / KG_PER_LB : weightKg;

  const items = [
    { label: 'Your BMI', value: bmi, digits: 1, unit: ' kg/m2', primary: true },
    { label: 'Adult BMI category', value: category },
    { label: 'Weight range for BMI 18.5 to 24.9 at your height', value: `${low.toFixed(1)} to ${high.toFixed(1)}${unit}` },
  ];
  if (bmi >= 25) {
    items.push({ label: 'Weight at the top of that range', value: high, digits: 1, unit });
    items.push({ label: 'Difference from the top of that range', value: Math.round((current - high) * 10) / 10, digits: 1, unit });
  } else if (bmi < 18.5) {
    items.push({ label: 'Weight at the bottom of that range', value: low, digits: 1, unit });
    items.push({ label: 'Difference from the bottom of that range', value: Math.round((low - current) * 10) / 10, digits: 1, unit });
  }

  const table = {
    caption: 'Adult BMI categories (ages 20 and older)',
    collapsible: true,
    headers: ['BMI', 'Category'],
    rows: [['Below 18.5', 'Underweight'], ['18.5 to 24.9', 'Healthy weight'], ['25.0 to 29.9', 'Overweight'], ['30.0 to 34.9', 'Obesity (Class 1)'], ['35.0 to 39.9', 'Obesity (Class 2)'], ['40.0 or higher', 'Obesity (Class 3, severe)']],
  };
  const notes = [
    'For adults aged 20 and older. BMI is rounded to one decimal place before the category is chosen. For ages 2 to 19, use the CDC child and teen BMI calculator, which compares against growth percentiles.',
    'BMI is a screening number. It does not measure body fat directly, and it cannot tell muscle from fat. It is not a diagnosis. Talk to a health care provider about what your result means for you.',
  ];
  return { items, table, notes };
}
