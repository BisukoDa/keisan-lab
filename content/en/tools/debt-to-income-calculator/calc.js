// Debt-to-income (DTI) ratio calculator. All money math is done in whole cents.

export const inputs = [
  { id: 'income', label: 'Gross monthly income (before taxes)', type: 'number', prefix: '$', default: 6000, min: 0, step: 100, help: 'Pay before taxes and other deductions.' },
  { id: 'housing', label: 'Rent or mortgage payment (per month)', type: 'number', prefix: '$', default: 1500, min: 0, step: 50, help: 'If you own, include property taxes, insurance and any HOA dues.' },
  { id: 'auto', label: 'Auto loan payments (per month)', type: 'number', prefix: '$', default: 100, min: 0, step: 25 },
  { id: 'student', label: 'Student loan payments (per month)', type: 'number', prefix: '$', default: 0, min: 0, step: 25 },
  { id: 'cards', label: 'Credit card minimum payments (per month)', type: 'number', prefix: '$', default: 150, min: 0, step: 25 },
  { id: 'other', label: 'Other monthly debt payments', type: 'number', prefix: '$', default: 250, min: 0, step: 25, help: 'Personal loans, child support, and so on.' },
  { id: 'target', label: 'Your own target DTI', type: 'number', unit: '%', default: 36, min: 1, max: 100, step: 1, help: 'Lenders set their own limits. Enter the ratio you want to stay under.' },
];

const toCents = (d) => Math.round(d * 100);

export function calculate({ income, housing, auto, student, cards, other, target }) {
  if (![income, housing, auto, student, cards, other, target].every(Number.isFinite)) {
    return { error: 'Please enter a number in each field.' };
  }
  if (income <= 0) return { error: 'Gross monthly income must be greater than $0.' };
  if (income > 1e8) return { error: 'Income is too large. Please check the amount.' };
  if ([housing, auto, student, cards, other].some((v) => v < 0)) return { error: 'Debt payments cannot be negative.' };
  if ([housing, auto, student, cards, other].some((v) => v > 1e8)) return { error: 'A debt payment is too large. Please check the amounts.' };
  if (target < 1 || target > 100) return { error: 'Target DTI must be between 1% and 100%.' };

  const incomeC = toCents(income);
  if (incomeC <= 0) return { error: 'Gross monthly income must be at least $0.01.' };
  const debtC = toCents(housing) + toCents(auto) + toCents(student) + toCents(cards) + toCents(other);
  const dti = Math.round((debtC / incomeC) * 10000) / 100;
  const roomC = Math.round((incomeC * target) / 100) - debtC;
  const nonHousingC = debtC - toCents(housing);
  const nonHousing = Math.round((nonHousingC / incomeC) * 10000) / 100;

  const items = [
    { label: 'Debt-to-income ratio', value: dti, digits: 2, unit: '%', primary: true },
    { label: 'Total monthly debt payments', value: debtC / 100, prefix: '$', digits: 2 },
    { label: 'Ratio without rent or mortgage', value: nonHousing, digits: 2, unit: '%' },
  ];
  if (roomC >= 0) {
    items.push({ label: `Room left under your ${target}% target (per month)`, value: roomC / 100, prefix: '$', digits: 2 });
  } else {
    items.push({ label: `Amount over your ${target}% target (per month)`, value: -roomC / 100, prefix: '$', digits: 2 });
  }

  return {
    items,
    notes: [
      'DTI = total monthly debt payments ÷ gross monthly income. Amounts are rounded to the cent, and the ratio to two decimal places.',
      'Different loan products and lenders use different DTI limits. This is an estimate, not a loan approval or financial advice.',
    ],
  };
}
