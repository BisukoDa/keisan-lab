// 貯金目標の逆算（毎月いくら貯めればいい？）
// 前提：月利 = 年利 ÷ 12 の月複利、積立は毎月末に入金、手持ち資金は開始時点。毎月の額は円未満を切り上げ

export const inputs = [
  { id: 'goal', label: '目標金額', type: 'number', unit: '円', default: 5000000, min: 1, max: 10000000000, step: 100000 },
  { id: 'initial', label: '今ある貯金（スタート時点）', type: 'number', unit: '円', default: 0, min: 0, max: 10000000000, step: 10000, help: 'なければ 0 のままで構いません。' },
  { id: 'years', label: '貯める期間', type: 'number', unit: '年', default: 10, min: 1, max: 60, step: 1 },
  { id: 'rate', label: '想定利回り（年率）', type: 'number', unit: '%', default: 0, min: -20, max: 30, step: 0.1, help: '預金のまま貯めるなら実際の金利、増やさないなら 0 を入れます。' },
];

export function requiredMonthly({ goal, initial, rate, years }) {
  const n = years * 12;
  const i = rate / 100 / 12;
  if (i === 0) return (goal - initial) / n;
  const g = (1 + i) ** n;
  return ((goal - initial * g) * i) / (g - 1);
}

export function calculate({ goal, initial, rate, years }) {
  if (![goal, initial, rate, years].every(Number.isFinite)) return { error: 'すべての項目に数値を入力してください。' };
  if (goal <= 0) return { error: '目標金額は 1 円以上で入力してください。' };
  if (goal > 1e10 || initial > 1e10) return { error: '目標金額・今ある貯金は 100 億円までで入力してください。' };
  if (initial < 0) return { error: '今ある貯金は 0 以上で入力してください。' };
  if (rate < -20 || rate > 30) return { error: '想定利回りは -20〜30% の範囲で入力してください。' };
  if (!Number.isInteger(years) || years < 1 || years > 60) return { error: '貯める期間は 1〜60 の整数（年）で入力してください。' };

  const n = years * 12;
  const i = rate / 100 / 12;
  const raw = requiredMonthly({ goal, initial, rate, years });
  const monthly = Math.max(0, Math.ceil(raw - 1e-9));
  const balance = initial * (1 + i) ** n + (i === 0 ? monthly * n : (monthly * ((1 + i) ** n - 1)) / i);
  const principal = initial + monthly * n;

  if (monthly === 0) {
    return {
      items: [
        { label: '毎月の必要額', value: 0, unit: '円', primary: true },
        { label: `${years}年後の資産額（概算）`, value: Math.round(balance), unit: '円' },
      ],
      notes: ['今ある貯金だけで、想定利回りのもとでは期間内に目標金額に届く計算です。'],
    };
  }
  return {
    items: [
      { label: '毎月の必要額', value: monthly, unit: '円', primary: true },
      { label: '1年あたりの必要額', value: monthly * 12, unit: '円' },
      { label: '元本（今ある貯金＋積み立てる合計）', value: principal, unit: '円' },
      { label: '運用で増える額', value: Math.round(balance - principal), unit: '円' },
      { label: `${years}年後の資産額（概算）`, value: Math.round(balance), unit: '円' },
    ],
    notes: [
      '毎月末に積み立てる前提で、円未満を切り上げて計算しています。そのため資産額は目標金額をわずかに上回ることがあります。',
      '利回りが毎年一定と仮定した試算です。実際の運用では元本割れすることもあります。税金や手数料は差し引いていません。',
    ],
  };
}
