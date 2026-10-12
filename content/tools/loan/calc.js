// ローン返済シミュレーション（元利均等返済・元金均等返済）
// 月利 = 年利 ÷ 12。ボーナス返済・手数料・保証料は含めない。

// 金額は円未満切り捨てで表示する（浮動小数点誤差で 1 円ずれないよう微小値を足す）
export const floorYen = (v) => Math.floor(v + 1e-6);

export const inputs = [
  { id: 'amount', label: '借入金額', type: 'number', unit: '円', default: 30000000, min: 10000, step: 10000 },
  { id: 'rate', label: '金利（年率）', type: 'number', unit: '%', default: 1, min: 0, max: 20, step: 0.01 },
  { id: 'years', label: '返済期間', type: 'number', unit: '年', default: 35, min: 1, max: 50, step: 1 },
  {
    id: 'method',
    label: '返済方法',
    type: 'select',
    default: 'annuity',
    options: [
      { value: 'annuity', label: '元利均等返済（毎月の返済額が一定）' },
      { value: 'principal', label: '元金均等返済（返済額が徐々に減る）' },
    ],
  },
];

// 毎月の返済スケジュール（金融機関で一般的な円単位の方式）
// - 元利均等：毎月の返済額は円未満切り捨て。元金均等：毎月の元金部分は円未満切り捨て
// - 利息は毎月「残高 × 月利」の円未満切り捨て
// - 最終回で残りの元金をすべて返済して精算する
// 住宅金融支援機構【フラット35】の掲載例（2,000万円・年1.5%・30年）と全行一致することをテストで確認している。
export function schedule({ amount, rate, years, method }) {
  const i = rate / 100 / 12;
  const n = years * 12;
  const exact = i === 0 ? amount / n : (amount * i * (1 + i) ** n) / ((1 + i) ** n - 1);
  const fixedPayment = floorYen(exact);
  const fixedPrincipal = floorYen(amount / n);
  let balance = amount;
  const months = [];
  for (let k = 1; k <= n; k++) {
    const interest = floorYen(balance * i);
    let principal = method === 'annuity' ? fixedPayment - interest : fixedPrincipal;
    if (k === n || principal > balance) principal = balance;
    balance -= principal;
    months.push({ payment: principal + interest, principal, interest, balance });
  }
  return months;
}

export function calculate({ amount, rate, years, method }) {
  if (![amount, rate, years].every(Number.isFinite)) return { error: 'すべての項目に数値を入力してください。' };
  if (!Number.isInteger(amount) || amount < 1 || amount > 1e11) return { error: '借入金額は 1 円以上の整数（1,000 億円まで）で入力してください。' };
  if (rate < 0 || rate > 20) return { error: '金利は 0〜20% の範囲で入力してください。' };
  if (!Number.isInteger(years) || years < 1 || years > 50) return { error: '返済期間は 1〜50 の整数（年）で入力してください。' };
  if (method !== 'annuity' && method !== 'principal') return { error: '返済方法を選んでください。' };

  const months = schedule({ amount, rate, years, method });
  const total = months.reduce((s, m) => s + m.payment, 0);
  const interest = months.reduce((s, m) => s + m.interest, 0);

  const items =
    method === 'annuity'
      ? [
          { label: '毎月の返済額', value: months[0].payment, unit: '円', primary: true },
          ...(months.at(-1).payment !== months[0].payment ? [{ label: '最終回の返済額（端数の精算）', value: months.at(-1).payment, unit: '円' }] : []),
        ]
      : [
          { label: '初回の返済額', value: months[0].payment, unit: '円', primary: true },
          { label: '最終回の返済額', value: months.at(-1).payment, unit: '円' },
        ];
  items.push(
    { label: '総返済額', value: total, unit: '円' },
    { label: 'うち利息の合計', value: interest, unit: '円' },
    { label: '返済回数', value: years * 12, unit: '回' },
  );

  const rows = [];
  for (let y = 1; y <= years; y++) {
    const slice = months.slice((y - 1) * 12, y * 12);
    rows.push([
      `${y}年目`,
      slice.reduce((s, m) => s + m.payment, 0),
      slice.reduce((s, m) => s + m.interest, 0),
      slice.at(-1).balance,
    ]);
  }

  return {
    items,
    table: { caption: '1年ごとの返済額と残高を見る', collapsible: true, headers: ['年数', '年間返済額', 'うち利息', '年末の残高'], rows },
    notes: [
      '金利が返済期間中ずっと変わらない（全期間固定）と仮定した試算です。変動金利の場合は見直しにより返済額が変わります。',
      '返済額（元金均等返済では元金部分）と毎月の利息は円未満を切り捨て、最終回で残りを精算しています。端数処理は金融機関によって異なるため、実際とわずかな差が出ることがあります。ボーナス返済、事務手数料、保証料、団体信用生命保険料などは含めていません。',
    ],
  };
}
