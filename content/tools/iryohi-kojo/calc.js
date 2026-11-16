// 医療費控除の計算（国税庁 No.1120・No.1129）
// 控除額 ＝ min(200万円, max(0, 支払った医療費 − 保険金等の補てん額 − しきい値))
// しきい値 ＝ 総所得金額等が200万円以上なら10万円、200万円未満なら 総所得金額等 × 5%（1円未満切り捨て）
// 軽減額の目安 ＝ 控除額 × 所得税の税率（1円未満切り捨て）、住民税は 控除額 × 10%（1円未満切り捨て）

export const inputs = [
  { id: 'paid', label: '1年間に支払った医療費の合計', type: 'number', unit: '円', default: 300000, min: 0, step: 1000, help: '1月1日〜12月31日に実際に支払った、生計を一にする家族分の合計。' },
  { id: 'reimbursed', label: '保険金などで補てんされた金額', type: 'number', unit: '円', default: 50000, min: 0, step: 1000, help: '入院給付金・高額療養費・出産育児一時金など。ない場合は 0。' },
  { id: 'income', label: '総所得金額等', type: 'number', unit: '円', default: 5000000, min: 0, step: 10000, help: '多くの人は合計所得金額と同じです。会社員は、源泉徴収票の「給与所得控除後の金額」が目安です。収入（額面）ではありません。' },
  {
    id: 'rate', label: 'あなたの所得税の税率', type: 'select', default: '20',
    options: [
      { value: '5', label: '5%（課税所得 195万円以下）' },
      { value: '10', label: '10%（〜330万円以下）' },
      { value: '20', label: '20%（〜695万円以下）' },
      { value: '23', label: '23%（〜900万円以下）' },
      { value: '33', label: '33%（〜1,800万円以下）' },
      { value: '40', label: '40%（1,800万円超〜4,000万円未満）' },
      { value: '45', label: '45%（4,000万円以上）' },
    ],
    help: '課税所得金額（所得から各種控除を引いた金額）に対する税率です。',
  },
  { id: 'otc', label: '（比較用）特定一般用医薬品等の購入費', type: 'number', unit: '円', default: 0, min: 0, step: 1000, help: 'セルフメディケーション税制の対象薬の年間購入額（補てん分を除く）。比べたいときだけ入力します。' },
];

const floor = (x) => Math.floor(Math.round(x * 1e6) / 1e6);
const MAX = 2000000;

export function calculate({ paid, reimbursed, income, rate, otc }) {
  for (const v of [paid, reimbursed, income, otc]) {
    if (!Number.isFinite(v)) return { error: '金額はすべて数値で入力してください（ない場合は 0）。' };
    if (v < 0) return { error: '金額は 0 以上で入力してください。' };
    if (v > 1e10) return { error: '金額は 100億円以下で入力してください。' };
  }
  const r = Number(rate);
  if (![5, 10, 20, 23, 33, 40, 45].includes(r)) return { error: '所得税の税率を選んでください。' };

  const net = Math.max(0, floor(paid) - floor(reimbursed));
  const threshold = income < 2000000 ? floor(income * 0.05) : 100000;
  const deduction = Math.min(MAX, Math.max(0, net - threshold));
  const incomeTax = floor(deduction * r / 100);
  const residentTax = floor(deduction * 0.1);

  const items = [
    { label: '医療費控除の額', value: deduction, unit: '円', primary: true },
    { label: '所得税の軽減額の目安', value: incomeTax, unit: '円' },
    { label: '住民税の軽減額の目安（翌年度）', value: residentTax, unit: '円' },
    { label: '補てん後の医療費', value: net, unit: '円' },
    { label: '差し引くしきい値', value: threshold, unit: '円' },
  ];
  if (otc > 0) {
    const self = Math.min(88000, Math.max(0, otc - 12000));
    items.push({ label: 'セルフメディケーション税制の控除額', value: self, unit: '円' });
  }

  const notes = [
    '控除額は、医療費の合計から保険金等の補てん額としきい値を引いた金額です（上限200万円）。1円未満の端数が出る場合は切り捨てています。',
    '軽減額の目安は、控除額に税率をかけた概算です。復興特別所得税や、ほかの控除で課税所得が変わる影響は含みません。実際の還付額は申告書で確定します。',
    '保険金等で差し引く額は、その給付の目的となった医療費が上限です。補てんしきれない分を、ほかの医療費から差し引くことはありません。このツールは合計どうしで引くため、補てんが特定の医療費を上回る場合は、その超過分を入れないでください。',
    '医療費控除とセルフメディケーション税制は、どちらか一方を選んで適用します。両方は使えません。',
  ];
  if (otc > 0) notes.push('セルフメディケーション税制は、健康診査や予防接種など一定の取組を行った人が対象です。対象薬の購入費は、通常の医療費の「支払った医療費」にも入れて比べられます。');

  return {
    items,
    table: {
      caption: '計算の内訳',
      headers: ['項目', '金額（円）'],
      rows: [
        ['支払った医療費', paid],
        ['保険金等の補てん', -Math.min(reimbursed, paid)],
        ['しきい値', -threshold],
        ['控除額（上限200万円）', deduction],
      ],
    },
    notes,
  };
}
