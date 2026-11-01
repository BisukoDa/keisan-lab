// Credit card payoff calculator: months and interest to clear a balance with a fixed payment or a minimum-payment rule.
// All arithmetic is in whole cents. Interest = balance x APR / 12, rounded to the cent each month.

export const inputs = [
  { id: 'balance', label: 'Current balance', type: 'number', prefix: '$', default: 5000, min: 1, step: 100 },
  { id: 'apr', label: 'Interest rate (APR)', type: 'number', unit: '%', default: 22, min: 0, max: 100, step: 0.01, help: 'The APR on your statement.' },
  {
    id: 'mode',
    label: 'How will you pay?',
    type: 'select',
    default: 'fixed',
    options: [
      { value: 'fixed', label: 'A fixed amount each month' },
      { value: 'minimum', label: 'Only the minimum payment' },
    ],
  },
  { id: 'payment', label: 'Monthly payment', type: 'number', prefix: '$', default: 200, min: 1, step: 10, showIf: { mode: 'fixed' } },
  { id: 'minPct', label: 'Minimum: percent of balance', type: 'number', unit: '%', default: 1, min: 0, max: 100, step: 0.1, showIf: { mode: 'minimum' }, help: 'Added to that month\'s interest. 1% is a common example, not a standard. Check your statement.' },
  { id: 'minFloor', label: 'Minimum: lowest payment', type: 'number', prefix: '$', default: 25, min: 1, step: 1, showIf: { mode: 'minimum' } },
];

const MAX_MONTHS = 1200;
const toCents = (d) => Math.round(d * 100);

// Returns { months: [{payment, interest, balance}], paidOff }.
export function schedule(balanceCents, apr, rule) {
  const i = apr / 100 / 12;
  let bal = balanceCents;
  const months = [];
  while (bal > 0 && months.length < MAX_MONTHS) {
    const interest = Math.round(bal * i);
    const due = bal + interest;
    let pay = rule(bal, interest);
    if (pay >= due) pay = due;
    if (pay <= interest && pay < due) return { months, paidOff: false, stalled: true };
    bal = due - pay;
    months.push({ payment: pay, interest, balance: bal });
  }
  return { months, paidOff: bal === 0 };
}

const fmtDuration = (n) => {
  const y = Math.floor(n / 12);
  const m = n % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'month' : 'months'}`);
  return parts.join(' ');
};

export function calculate({ balance, apr, mode, payment, minPct, minFloor }) {
  if (!Number.isFinite(balance) || !Number.isFinite(apr)) return { error: 'Please enter a balance and an interest rate.' };
  if (balance < 1 || balance > 1e8) return { error: 'Balance must be between $1 and $100,000,000.' };
  if (apr < 0 || apr > 100) return { error: 'Interest rate must be between 0% and 100%.' };
  const balC = toCents(balance);
  const money = (c) => ({ value: c / 100, digits: 2, prefix: '$' });
  let rule;
  if (mode === 'fixed') {
    if (!Number.isFinite(payment) || payment < 1) return { error: 'Please enter a monthly payment of at least $1.' };
    const payC = toCents(payment);
    rule = () => payC;
    const first = Math.round((balC * apr) / 100 / 12);
    if (payC <= first && payC < balC + first) {
      return { error: `A payment of $${payment.toFixed(2)} does not cover the first month's interest of $${(first / 100).toFixed(2)}, so the balance would never go down. Try a larger payment.` };
    }
  } else if (mode === 'minimum') {
    if (!Number.isFinite(minPct) || !Number.isFinite(minFloor) || minPct < 0 || minPct > 100 || minFloor < 1) {
      return { error: 'Please enter a minimum percent (0% to 100%) and a lowest payment of at least $1.' };
    }
    const floorC = toCents(minFloor);
    rule = (bal, interest) => Math.max(floorC, Math.round((bal * minPct) / 100) + interest);
  } else {
    return { error: 'Please choose how you will pay.' };
  }

  const { months, paidOff, stalled } = schedule(balC, apr, rule);
  if (stalled) return { error: 'These numbers never pay the balance off, because the payment does not cover the interest. Try a larger payment.' };
  if (!paidOff) return { error: 'This plan takes more than 100 years to pay off. Try a larger payment.' };

  const n = months.length;
  const totalInterest = months.reduce((s, m) => s + m.interest, 0);
  const totalPaid = balC + totalInterest;
  const items = [
    { label: 'Time to pay off', value: n, unit: n === 1 ? ' month' : ' months', primary: true },
    { label: 'In years and months', value: fmtDuration(n) },
    { label: 'Total interest', ...money(totalInterest) },
    { label: 'Total paid (balance + interest)', ...money(totalPaid) },
    { label: 'First payment', ...money(months[0].payment) },
    { label: 'Last payment', ...money(months[n - 1].payment) },
  ];

  const rows = [];
  for (let y = 1; y <= Math.ceil(n / 12); y++) {
    const s = months.slice((y - 1) * 12, y * 12);
    const paid = s.reduce((a, m) => a + m.payment, 0);
    const intr = s.reduce((a, m) => a + m.interest, 0);
    rows.push([`Year ${y}`, money(paid), money(intr), money(s.at(-1).balance)]);
  }
  const notes = [
    'Interest each month is the balance times the APR divided by 12, rounded to the cent. Real cards usually charge interest daily (the APR divided by 360 or 365), so your actual interest can be slightly higher.',
    'Assumes no new purchases, fees or rate changes, and that each payment is made on time. Promotional or deferred-interest offers are not modeled.',
  ];
  if (mode === 'minimum') {
    notes.push('The minimum payment here is the percent of balance you entered plus that month\'s interest, with the lowest payment as a floor. Card issuers use different rules, so check your statement.');
  }
  return {
    items,
    table: { caption: 'See the year-by-year schedule', collapsible: true, headers: ['Year', 'Paid', 'Interest', 'End balance'], rows },
    notes,
  };
}
