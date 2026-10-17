// Loan calculator: fixed-rate installment loan (auto, personal, student) with optional extra payment and origination fee.
// All arithmetic is done in whole cents so the balance ends at exactly $0.00.

export const inputs = [
  { id: 'amount', label: 'Loan amount', type: 'number', prefix: '$', default: 25000, min: 1, step: 500 },
  { id: 'rate', label: 'Interest rate (annual)', type: 'number', unit: '%', default: 8, min: 0, max: 40, step: 0.01, help: 'The plain interest rate, not the APR.' },
  { id: 'termValue', label: 'Loan term', type: 'number', default: 5, min: 1, step: 1 },
  {
    id: 'termUnit',
    label: 'Term in',
    type: 'select',
    default: 'years',
    options: [
      { value: 'years', label: 'Years' },
      { value: 'months', label: 'Months' },
    ],
  },
  { id: 'extra', label: 'Extra payment each month (optional)', type: 'number', prefix: '$', default: 0, min: 0, step: 25, help: 'Added to every regular payment and applied to principal.' },
  { id: 'feePct', label: 'Origination fee (optional)', type: 'number', unit: '%', default: 0, min: 0, max: 20, step: 0.25, help: 'Percent of the loan amount, taken out of the money you receive.' },
];

const toCents = (dollars) => Math.round(dollars * 100);
const dollars = (cents) => cents / 100;

export function monthlyPaymentCents(loanCents, rate, n) {
  const i = rate / 100 / 12;
  if (i === 0) return Math.round(loanCents / n);
  const f = (1 + i) ** n;
  return Math.round((loanCents * i * f) / (f - 1));
}

// Amortization with an optional extra payment. Balances come from the closed-form remaining-balance
// formula using the unrounded payment, and each month's amounts are rounded to cents once, so cent
// rounding never compounds. The displayed payment is that same payment rounded to the cent.
// The final payment settles whatever is left.
export function schedule(loanCents, rate, n, extraCents = 0) {
  const i = rate / 100 / 12;
  const exact = i === 0 ? loanCents / n : (loanCents * i * (1 + i) ** n) / ((1 + i) ** n - 1);
  const q = exact + extraCents;
  const balanceAfter = (k) => {
    if (i === 0) return loanCents - q * k;
    const f = (1 + i) ** k;
    return loanCents * f - (q * (f - 1)) / i;
  };
  let prevExact = loanCents;
  const months = [];
  for (let k = 1; k <= n && Math.round(prevExact) > 0; k++) {
    const nextExact = k === n ? 0 : Math.max(0, balanceAfter(k));
    const principal = Math.round(prevExact) - Math.round(nextExact);
    const interest = Math.round(prevExact * i);
    months.push({ payment: principal + interest, principal, interest, balance: Math.round(nextExact) });
    prevExact = nextExact;
  }
  return { payment: monthlyPaymentCents(loanCents, rate, n), months };
}

// APR: the monthly rate at which the payments (plain schedule, no extra) are worth the amount actually received.
export function aprPercent(receivedCents, paymentCents, n) {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const pv = mid === 0 ? paymentCents * n : (paymentCents * (1 - (1 + mid) ** -n)) / mid;
    if (pv > receivedCents) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

export function calculate({ amount, rate, termValue, termUnit, extra, feePct }) {
  if (![amount, rate, termValue, extra, feePct].every(Number.isFinite)) {
    return { error: 'Please enter a number in each field.' };
  }
  if (termUnit !== 'years' && termUnit !== 'months') return { error: 'Please choose years or months for the loan term.' };
  if (amount < 1 || amount > 1e9) return { error: 'Loan amount must be between $1 and $1,000,000,000.' };
  if (rate < 0 || rate > 40) return { error: 'Interest rate must be between 0% and 40%.' };
  if (!Number.isInteger(termValue) || termValue < 1) return { error: 'Loan term must be a whole number of at least 1.' };
  const n = termUnit === 'years' ? termValue * 12 : termValue;
  if (n > 480) return { error: 'Loan term cannot be longer than 40 years (480 months).' };
  if (extra < 0 || extra > amount) return { error: 'Extra payment must be between $0 and the loan amount.' };
  if (feePct < 0 || feePct > 20) return { error: 'Origination fee must be between 0% and 20%.' };

  const loanCents = toCents(amount);
  const extraCents = toCents(extra);
  const feeCents = Math.round((loanCents * feePct) / 100);
  const base = schedule(loanCents, rate, n);
  const plan = schedule(loanCents, rate, n, extraCents);
  const sum = (arr, key) => arr.reduce((s, m) => s + m[key], 0);
  const baseInterest = sum(base.months, 'interest');
  const planInterest = sum(plan.months, 'interest');
  const planTotal = loanCents + planInterest;

  const money = (cents) => ({ value: dollars(cents), digits: 2, prefix: '$' });
  const items = [
    { label: 'Monthly payment', ...money(base.payment), primary: true },
    { label: 'Total interest', ...money(planInterest) },
    { label: 'Total paid (principal + interest)', ...money(planTotal) },
    { label: 'Number of payments', value: plan.months.length, unit: plan.months.length === 1 ? ' payment' : ' payments' },
  ];
  if (extraCents > 0) {
    items.push({ label: 'Monthly payment with extra', ...money(base.payment + extraCents) });
    items.push({ label: 'Interest saved by paying extra', ...money(baseInterest - planInterest) });
    items.push({ label: 'Months saved', value: n - plan.months.length, unit: n - plan.months.length === 1 ? ' month' : ' months' });
  }
  if (feeCents > 0) {
    const received = loanCents - feeCents;
    items.push({ label: 'Origination fee', ...money(feeCents) });
    items.push({ label: 'Money you receive after the fee', ...money(received) });
    items.push({ label: 'Estimated APR (fee included)', value: aprPercent(received, base.payment, n), digits: 2, unit: '%' });
  }

  const rows = [];
  const years = Math.ceil(plan.months.length / 12);
  for (let y = 1; y <= years; y++) {
    const slice = plan.months.slice((y - 1) * 12, y * 12);
    rows.push([`Year ${y}`, money(sum(slice, 'principal')), money(sum(slice, 'interest')), money(slice.at(-1).balance)]);
  }

  const notes = [
    'Assumes a fixed rate and equal monthly payments. The payment is rounded to the cent, interest is rounded to the cent each month, and the final payment settles the remainder. A lender may round differently, so totals can differ by a few cents.',
  ];
  if (feeCents > 0) {
    notes.push('The APR shown is an estimate for a loan with equal monthly payments and the fee deducted from the proceeds. Your lender\'s disclosed APR is the official figure.');
  }
  notes.push('Taxes, late fees, optional insurance and other charges are not included.');
  return {
    items,
    table: { caption: 'See the year-by-year schedule', collapsible: true, headers: ['Year', 'Principal paid', 'Interest paid', 'End balance'], rows },
    notes,
  };
}
