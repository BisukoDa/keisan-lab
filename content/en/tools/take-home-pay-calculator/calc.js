// Take-home pay calculator: estimates federal income tax (2026 rules), Social Security and
// Medicare (FICA), and an optional flat state rate. Money is rounded to the nearest cent.

const STD = { single: 16100, married: 32200 };
const BRACKETS = {
  single: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
  married: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]],
};
const SS_BASE = 184500; // 2026 Social Security wage base
const SS_RATE = 0.062;
const MED_RATE = 0.0145;
const ADD_MED_RATE = 0.009;
const ADD_MED_FROM = { single: 200000, married: 250000 };

const PERIODS = {
  year: { n: 1, label: 'per year' },
  month: { n: 12, label: 'per month' },
  semimonthly: { n: 24, label: 'per paycheck (twice a month)' },
  biweekly: { n: 26, label: 'per paycheck (every 2 weeks)' },
  week: { n: 52, label: 'per week' },
};

export const inputs = [
  { id: 'gross', label: 'Gross pay per year (before taxes)', type: 'number', prefix: '$', default: 75000, min: 0, step: 500 },
  {
    id: 'status', label: 'Filing status', type: 'select', default: 'single',
    options: [
      { value: 'single', label: 'Single' },
      { value: 'married', label: 'Married filing jointly (only your pay counts)' },
    ],
  },
  { id: 'k401', label: '401(k) / traditional retirement contributions per year', type: 'number', prefix: '$', default: 0, min: 0, step: 100, help: 'Lowers income tax but not Social Security or Medicare tax.' },
  { id: 'health', label: 'Pre-tax health premiums and similar per year', type: 'number', prefix: '$', default: 0, min: 0, step: 100, help: 'Cafeteria-plan (Section 125) items lower income tax and FICA.' },
  { id: 'state', label: 'State income tax rate (flat estimate)', type: 'number', unit: '%', default: 0, min: 0, max: 20, step: 0.1, help: 'Use 0 for states with no income tax. Real state rules vary.' },
  {
    id: 'period', label: 'Show pay', type: 'select', default: 'biweekly',
    options: [
      { value: 'year', label: 'Per year' },
      { value: 'month', label: 'Per month' },
      { value: 'semimonthly', label: 'Twice a month (24 paychecks)' },
      { value: 'biweekly', label: 'Every 2 weeks (26 paychecks)' },
      { value: 'week', label: 'Per week' },
    ],
  },
];

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function federalTax(taxable, status) {
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of BRACKETS[status]) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, top) - prev) * rate;
    prev = top;
  }
  return r2(tax);
}

export function calculate({ gross, status, k401, health, state, period }) {
  if (!Number.isFinite(gross) || gross < 0) return { error: 'Please enter your yearly gross pay (0 or more).' };
  const k = Number.isFinite(k401) ? k401 : 0;
  const h = Number.isFinite(health) ? health : 0;
  const st = Number.isFinite(state) ? state : 0;
  if (k < 0 || h < 0 || st < 0) return { error: 'Contributions and the state rate cannot be negative.' };
  if (!STD[status]) return { error: 'Please choose a filing status.' };
  if (!PERIODS[period]) return { error: 'Please choose how to show your pay.' };
  if (k + h > gross) return { error: 'Contributions and premiums cannot be more than your gross pay.' };

  const taxable = Math.max(0, gross - k - h - STD[status]);
  const fed = federalTax(taxable, status);
  const ficaWages = gross - h;
  const ss = r2(Math.min(ficaWages, SS_BASE) * SS_RATE);
  const med = r2(ficaWages * MED_RATE);
  const addMed = r2(Math.max(0, ficaWages - ADD_MED_FROM[status]) * ADD_MED_RATE);
  const stateTax = r2(Math.max(0, gross - k - h) * st / 100);
  const totalTax = r2(fed + ss + med + addMed + stateTax);
  const net = r2(gross - k - h - totalTax);
  const p = PERIODS[period];
  const per = (v) => r2(v / p.n);

  const items = [
    { label: `Take-home pay ${p.label}`, value: per(net), prefix: '$', digits: 2, primary: true },
    ...(period === 'year' ? [] : [{ label: 'Take-home pay per year', value: net, prefix: '$', digits: 2 }]),
    { label: 'Total taxes per year', value: totalTax, prefix: '$', digits: 2 },
    { label: 'Federal income tax per year', value: fed, prefix: '$', digits: 2 },
    { label: 'Social Security + Medicare per year', value: r2(ss + med + addMed), prefix: '$', digits: 2 },
    { label: 'Average tax rate on gross pay', value: gross > 0 ? r2((totalTax / gross) * 100) : 0, unit: '%', digits: 2 },
  ];
  if (st > 0) items.splice(items.length - 1, 0, { label: 'State income tax per year', value: stateTax, prefix: '$', digits: 2 });

  const rows = [['Gross pay', gross], ['Pre-tax retirement', -k], ['Pre-tax health premiums', -h],
    ['Federal income tax', -fed], ['Social Security', -ss], ['Medicare', -(r2(med + addMed))]];
  if (st > 0) rows.push(['State income tax (estimate)', -stateTax]);
  rows.push(['Take-home pay', net]);
  const fmt = (v) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    items,
    table: {
      caption: `Where your pay goes (${p.label})`,
      headers: ['Item', 'Per year', p.label.replace(/^per /, 'Per ')],
      rows: rows.map(([l, v]) => [l, fmt(v), fmt(per(v))]),
    },
    notes: [
      `Uses 2026 federal rules: standard deduction ${fmt(STD[status])}, Social Security tax on pay up to $184,500, and Medicare tax with the extra 0.9% above ${fmt(ADD_MED_FROM[status])}.`,
      'Assumes one job, no other income, no tax credits and no extra deductions. Local taxes, state disability and other payroll items are not included.',
      'Every amount is rounded to the nearest cent. Your actual paycheck may differ; treat this as an estimate, not tax advice.',
    ],
  };
}
