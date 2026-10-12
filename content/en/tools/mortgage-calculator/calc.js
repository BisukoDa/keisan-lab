// Mortgage calculator: principal & interest, property tax, homeowners insurance, HOA dues and PMI.
// All loan arithmetic is done in whole cents so the balance ends at exactly $0.00.

export const inputs = [
  { id: 'price', label: 'Home price', type: 'number', prefix: '$', default: 400000, min: 1, step: 1000 },
  { id: 'downPct', label: 'Down payment', type: 'number', unit: '%', default: 20, min: 0, max: 100, step: 0.5, help: 'Percent of the home price paid up front.' },
  { id: 'rate', label: 'Interest rate (annual)', type: 'number', unit: '%', default: 6.5, min: 0, max: 20, step: 0.01 },
  {
    id: 'term',
    label: 'Loan term',
    type: 'select',
    default: '30',
    options: [
      { value: '30', label: '30 years' },
      { value: '20', label: '20 years' },
      { value: '15', label: '15 years' },
      { value: '10', label: '10 years' },
    ],
  },
  { id: 'tax', label: 'Property tax (per year)', type: 'number', prefix: '$', default: 4000, min: 0, step: 100 },
  { id: 'insurance', label: 'Homeowners insurance (per year)', type: 'number', prefix: '$', default: 1500, min: 0, step: 100 },
  { id: 'hoa', label: 'HOA dues (per month)', type: 'number', prefix: '$', default: 0, min: 0, step: 10 },
  { id: 'pmiRate', label: 'PMI rate (per year)', type: 'number', unit: '%', default: 0.5, min: 0, max: 5, step: 0.05, help: 'Percent of the original loan per year. Only used when the down payment is under 20%.' },
];

const toCents = (dollars) => Math.round(dollars * 100);
const dollars = (cents) => cents / 100;

// Monthly payment in cents for a loan of `loanCents`, annual rate `rate` (percent) over `n` months.
export function monthlyPaymentCents(loanCents, rate, n) {
  const i = rate / 100 / 12;
  if (i === 0) return Math.round(loanCents / n);
  const f = (1 + i) ** n;
  return Math.round((loanCents * i * f) / (f - 1));
}

// Scheduled amortization in cents. The final payment settles whatever is left.
export function schedule(loanCents, rate, years) {
  const n = years * 12;
  const i = rate / 100 / 12;
  const payment = monthlyPaymentCents(loanCents, rate, n);
  let balance = loanCents;
  const months = [];
  for (let k = 1; k <= n; k++) {
    const interest = Math.round(balance * i);
    let principal = k === n ? balance : payment - interest;
    if (principal > balance) principal = balance;
    balance -= principal;
    months.push({ payment: principal + interest, principal, interest, balance });
  }
  return { payment, months };
}

export function calculate({ price, downPct, rate, term, tax, insurance, hoa, pmiRate }) {
  const years = Number(term);
  if (![price, downPct, rate, tax, insurance, hoa, pmiRate].every(Number.isFinite) || !Number.isFinite(years)) {
    return { error: 'Please enter a number in each field.' };
  }
  if (price < 1 || price > 1e9) return { error: 'Home price must be between $1 and $1,000,000,000.' };
  if (downPct < 0 || downPct > 100) return { error: 'Down payment must be between 0% and 100%.' };
  if (rate < 0 || rate > 20) return { error: 'Interest rate must be between 0% and 20%.' };
  if (![10, 15, 20, 30].includes(years)) return { error: 'Please choose a loan term of 10, 15, 20 or 30 years.' };
  if (tax < 0 || insurance < 0 || hoa < 0) return { error: 'Property tax, insurance and HOA dues cannot be negative.' };
  if (tax > 1e8 || insurance > 1e8 || hoa > 1e8) return { error: 'Property tax, insurance and HOA dues are too large. Please check the amounts.' };
  if (pmiRate < 0 || pmiRate > 5) return { error: 'PMI rate must be between 0% and 5% per year.' };

  const priceCents = toCents(price);
  const downCents = Math.round((priceCents * downPct) / 100);
  const loanCents = priceCents - downCents;
  if (loanCents < 100) return { error: 'The down payment leaves no loan to calculate. Lower the down payment below 100%.' };

  const { payment, months } = schedule(loanCents, rate, years);
  const totalPI = months.reduce((s, m) => s + m.payment, 0);
  const totalInterest = months.reduce((s, m) => s + m.interest, 0);

  // PMI applies only below a 20% down payment. It is charged while the balance at the start of the
  // month is above 78% of the original home value (the automatic termination point).
  const pmiApplies = downPct < 20 && pmiRate > 0;
  const pmiMonthly = pmiApplies ? Math.round(((pmiRate / 100) * loanCents) / 12) : 0;
  let pmiMonths = 0;
  if (pmiApplies) {
    let start = loanCents;
    for (const m of months) {
      if (start * 100 > 78 * priceCents) pmiMonths++;
      else break;
      start = m.balance;
    }
  }

  const taxMonthly = Math.round(toCents(tax) / 12);
  const insMonthly = Math.round(toCents(insurance) / 12);
  const hoaMonthly = toCents(hoa);
  const total = payment + taxMonthly + insMonthly + hoaMonthly + pmiMonthly;

  const money = (cents) => ({ value: dollars(cents), digits: 2, prefix: '$' });
  const items = [
    { label: 'Total monthly payment (first month)', ...money(total), primary: true },
    { label: 'Principal and interest', ...money(payment) },
    { label: 'Property tax (per month)', ...money(taxMonthly) },
    { label: 'Homeowners insurance (per month)', ...money(insMonthly) },
    { label: 'HOA dues (per month)', ...money(hoaMonthly) },
    { label: 'PMI (per month, while it applies)', ...money(pmiMonthly) },
    { label: 'Loan amount', ...money(loanCents) },
    { label: 'Down payment', ...money(downCents) },
    { label: 'Total interest over the loan', ...money(totalInterest) },
    { label: 'Total of all principal and interest payments', ...money(totalPI) },
    { label: 'Months with PMI', value: pmiMonths, unit: ' months' },
  ];

  const rows = [];
  for (let y = 1; y <= years; y++) {
    const slice = months.slice((y - 1) * 12, y * 12);
    rows.push([
      `Year ${y}`,
      money(slice.reduce((s, m) => s + m.principal, 0)),
      money(slice.reduce((s, m) => s + m.interest, 0)),
      money(slice.at(-1).balance),
    ]);
  }

  const notes = [
    'Assumes a fixed rate for the whole term. The monthly principal and interest payment is rounded to the cent, interest is rounded to the cent each month, and the final payment settles the remainder.',
    'Property tax and insurance are shown as one twelfth of the yearly amount and are held constant; real bills change over time.',
  ];
  if (pmiApplies) {
    notes.push(`PMI is charged until the scheduled balance falls to 78% of the original home value (${pmiMonths} months here). Lenders may remove it earlier on request once the balance reaches 80%.`);
  } else if (downPct < 20) {
    notes.push('PMI is set to 0%, so none is included. Loans with less than 20% down usually carry mortgage insurance.');
  }
  return {
    items,
    table: { caption: 'See the year-by-year schedule', collapsible: true, headers: ['Year', 'Principal paid', 'Interest paid', 'End balance'], rows },
    notes,
  };
}
