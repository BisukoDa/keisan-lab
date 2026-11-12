// 退職金（退職手当等）の所得税・住民税の計算
// 退職所得控除額：勤続20年以下は 40万円×年数（80万円未満なら80万円）／20年超は 800万円＋70万円×(年数−20)。
// 勤続年数の1年未満の端数は1年に切り上げ。障害退職は +100万円。
// 課税退職所得金額は 1,000円未満切り捨て。所得税は速算表で計算し、復興特別所得税 2.1% を加えて1円未満切り捨て。
// 住民税は課税退職所得金額に6%・4%をかけ、それぞれ100円未満切り捨て。

export const inputs = [
  { id: 'payout', label: '退職手当等の収入金額（税引き前）', type: 'number', unit: '円', default: 8000000, min: 0, step: 100000, help: '退職金の額面。源泉徴収される前の金額です。' },
  { id: 'years', label: '勤続年数（年）', type: 'number', unit: '年', default: 11, min: 0, max: 80, step: 1, help: '入社から退職までの年数。' },
  { id: 'months', label: '勤続年数（月）', type: 'number', unit: 'か月', default: 0, min: 0, max: 11, step: 1, help: '1年未満の端数は1年に切り上げて計算します。' },
  {
    id: 'kind', label: '退職手当等の区分', type: 'select', default: 'general',
    options: [
      { value: 'general', label: '一般（ふつうの退職金）' },
      { value: 'short', label: '短期退職手当等（勤続5年以下の役員以外の人）' },
      { value: 'executive', label: '特定役員退職手当等（役員等勤続5年以下）' },
    ],
  },
  {
    id: 'disabled', label: '障害者になったことが直接の原因で退職した', type: 'select', default: 'no',
    options: [{ value: 'no', label: 'いいえ' }, { value: 'yes', label: 'はい（控除額に100万円加算）' }],
  },
  {
    id: 'filed', label: '「退職所得の受給に関する申告書」の提出', type: 'select', default: 'yes',
    options: [{ value: 'yes', label: '提出した' }, { value: 'no', label: '提出していない' }],
  },
];

const BRACKETS = [
  [1950000, 0.05, 0],
  [3300000, 0.10, 97500],
  [6950000, 0.20, 427500],
  [9000000, 0.23, 636000],
  [18000000, 0.33, 1536000],
  [40000000, 0.40, 2796000],
  [Infinity, 0.45, 4796000],
];

const floorTo = (x, unit) => Math.floor(Math.round(x * 1e6) / 1e6 / unit) * unit;

export function calculate({ payout, years, months, kind, disabled, filed }) {
  if (![payout, years, months].every(Number.isFinite)) return { error: '収入金額と勤続年数を数値で入力してください（月が無ければ 0）。' };
  if (payout < 0) return { error: '収入金額は 0 以上で入力してください。' };
  if (payout > 1e10) return { error: '収入金額は 100億円以下で入力してください。' };
  if (years < 0 || months < 0) return { error: '勤続年数は 0 以上で入力してください。' };
  if (months > 11) return { error: '月は 0〜11 で入力してください。' };
  if (years > 80) return { error: '勤続年数は 80 年以下で入力してください。' };
  if (!['general', 'short', 'executive'].includes(kind)) return { error: '退職手当等の区分を選んでください。' };
  const y = Math.floor(years) + (months > 0 || years % 1 > 0 ? 1 : 0);
  if (y < 1) return { error: '勤続年数は 1か月以上で入力してください。' };
  if (kind !== 'general' && y > 5) return { error: '短期退職手当等・特定役員退職手当等は、勤続5年以下の場合の区分です。5年を超える場合は「一般」を選んでください。' };

  let deduction = y <= 20 ? Math.max(800000, 400000 * y) : 8000000 + 700000 * (y - 20);
  if (disabled === 'yes') deduction += 1000000;
  const diff = Math.max(0, payout - deduction);
  if (kind === 'general' && y <= 5 && payout - deduction > 3000000) return { error: '勤続5年以下で、退職金から退職所得控除額を引いた額が300万円を超える場合は、「短期退職手当等」か「特定役員退職手当等」を選んでください（「一般」は2分の1課税の対象外になる場合があります）。' };
  let base;
  if (kind === 'general') base = diff / 2;
  else if (kind === 'executive') base = diff;
  else base = diff <= 3000000 ? diff / 2 : diff - 1500000;
  const taxable = floorTo(base, 1000);

  const items = [
    { label: '退職所得控除額', value: deduction, unit: '円' },
    { label: '課税退職所得金額', value: taxable, unit: '円' },
  ];
  const notes = [
    '勤続年数の1年未満の端数は1年に切り上げています。会社が勤続年数に算入する期間（休職・パート期間など）は個別に異なります。',
    '所得税の計算は令和8年4月1日現在の速算表にもとづきます。令和9年以後は防衛特別所得税が創設され復興特別所得税の税率が下がりますが、合計の税率は変わらないため、源泉徴収される税額の計算は同じです（国税庁 No.1420）。',
    '退職所得控除額に勤続期間の重複（前の会社の退職金を同じ年に受け取った場合など）がある場合の調整は、このツールでは考えません。',
  ];

  if (filed === 'no') {
    const withheld = Math.floor(Math.round(payout * 0.2042 * 1e4) / 1e4);
    items.unshift({ label: '源泉徴収される所得税・復興特別所得税（申告書なし）', value: withheld, unit: '円', primary: true });
    items.push({ label: '所得税等を引いた後の金額（住民税は別に引かれます）', value: payout - withheld, unit: '円' });
    notes.push('申告書を提出しないと、収入金額の20.42%が源泉徴収されます。あとで確定申告をすると、退職所得控除を使った正しい税額との差が戻ります。住民税の金額はここでは計算していません。');
    return { items, notes };
  }

  let tax = 0;
  if (taxable > 0) {
    const [, rate, ded] = BRACKETS.find(([lim]) => taxable < lim);
    tax = Math.floor(taxable * rate - ded);
  }
  const incomeTax = Math.floor(Math.round(tax * 1.021 * 1e4) / 1e4);
  const resident = floorTo(taxable * 0.06, 100) + floorTo(taxable * 0.04, 100);
  items.unshift({ label: '所得税・復興特別所得税＋住民税の合計', value: incomeTax + resident, unit: '円', primary: true });
  items.push(
    { label: '所得税・復興特別所得税（復興税2.1%を含む）', value: incomeTax, unit: '円' },
    { label: '住民税（市町村6%＋道府県4%）', value: resident, unit: '円' },
    { label: '手取りの目安', value: payout - incomeTax - resident, unit: '円' },
  );
  notes.push('住民税は課税退職所得金額に市町村民税6%・道府県民税4%をかけ、それぞれ100円未満を切り捨てて合計しています（総務省の説明にもとづく）。');
  return { items, notes };
}
