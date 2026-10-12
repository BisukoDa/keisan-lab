// 積立・複利シミュレーション
// 前提：月利 = 年利 ÷ 12 の月複利、積立は毎月末に入金、一括投資は開始時点

export const inputs = [
  { id: 'monthly', label: '毎月の積立額', type: 'number', unit: '円', default: 30000, min: 0, max: 100000000, step: 1000 },
  { id: 'initial', label: '最初にまとめて投資する額', type: 'number', unit: '円', default: 0, min: 0, max: 10000000000, step: 10000, help: 'なければ 0 のままで構いません。' },
  { id: 'rate', label: '想定利回り（年率）', type: 'number', unit: '%', default: 5, min: -20, max: 30, step: 0.1 },
  { id: 'years', label: '積立期間', type: 'number', unit: '年', default: 20, min: 1, max: 60, step: 1 },
];

export function simulate({ monthly, initial, rate, years }) {
  const i = rate / 100 / 12;
  let balance = initial;
  let principal = initial;
  const yearly = [];
  for (let month = 1; month <= years * 12; month++) {
    balance = balance * (1 + i) + monthly;
    principal += monthly;
    if (month % 12 === 0) yearly.push({ year: month / 12, principal, balance });
  }
  return { balance, principal, gain: balance - principal, yearly };
}

export function calculate({ monthly, initial, rate, years }) {
  if (![monthly, initial, rate, years].every(Number.isFinite)) return { error: 'すべての項目に数値を入力してください。' };
  if (monthly < 0 || initial < 0) return { error: '積立額・投資額は 0 以上で入力してください。' };
  if (monthly > 1e8 || initial > 1e10) return { error: '毎月の積立額は 1 億円まで、最初に投資する額は 100 億円までで入力してください。' };
  if (monthly === 0 && initial === 0) return { error: '毎月の積立額か、最初に投資する額のどちらかを入力してください。' };
  if (rate < -20 || rate > 30) return { error: '想定利回りは -20〜30% の範囲で入力してください。' };
  if (!Number.isInteger(years) || years < 1 || years > 60) return { error: '積立期間は 1〜60 の整数（年）で入力してください。' };

  const r = simulate({ monthly, initial, rate, years });
  return {
    items: [
      { label: `${years}年後の資産額（概算）`, value: Math.round(r.balance), unit: '円', primary: true },
      { label: '元本（積み立てた金額の合計）', value: r.principal, unit: '円' },
      { label: '運用で増えた額', value: Math.round(r.gain), unit: '円' },
      { label: '元本に対する増加率', value: r.principal > 0 ? (r.gain / r.principal) * 100 : 0, digits: 1, unit: '%' },
    ],
    table: {
      caption: '1年ごとの推移を見る',
      collapsible: true,
      headers: ['経過年数', '元本', '資産額', '運用で増えた額'],
      rows: r.yearly.map((y) => [`${y.year}年`, Math.round(y.principal), Math.round(y.balance), Math.round(y.balance - y.principal)]),
    },
    notes: [
      '利回りが毎年一定と仮定した試算です。実際の運用成果は市場の値動きにより変動し、元本割れすることもあります。',
      '税金（課税口座では運用益に 20.315%）や信託報酬などの手数料は差し引いていません。',
    ],
  };
}
