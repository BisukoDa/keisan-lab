// 繰上げ返済シミュレーション（元利均等返済の一部繰上げ。期間短縮型と返済額軽減型を比較）
// 月利 = 年利 ÷ 12。金額は円未満切り捨て（毎月の利息は「残高 × 月利」の円未満切り捨て）。

const floorYen = (v) => Math.floor(v + 1e-6);

export const inputs = [
  { id: 'amount', label: '当初の借入金額', type: 'number', unit: '円', default: 30000000, min: 10000, step: 10000 },
  { id: 'rate', label: '金利（年率）', type: 'number', unit: '%', default: 1, min: 0, max: 20, step: 0.01, help: '繰上げ後も同じ金利が続くと仮定します。' },
  { id: 'years', label: '当初の返済期間', type: 'number', unit: '年', default: 35, min: 1, max: 50, step: 1 },
  { id: 'elapsed', label: '繰上げ時点までに返済した回数', type: 'number', unit: '回', default: 120, min: 0, step: 1, help: '毎月返済なら「経過した月数」です。10年なら 120。' },
  { id: 'prepay', label: '繰上げ返済する額', type: 'number', unit: '円', default: 1000000, min: 1, step: 10000, help: '元金に充てる額です。手数料は含めません。' },
  { id: 'fee', label: '繰上げ返済の手数料', type: 'number', unit: '円', default: 0, min: 0, step: 100, help: '金融機関に払う手数料。なければ 0。' },
];

// 残高 balance から、毎月 payment ずつ返したときの（回数, 利息合計, 総支払額）。最終回に残りを精算する。
function simulate(balance, i, payment, lastMonth = Infinity) {
  let months = 0;
  let interest = 0;
  let paid = 0;
  while (balance > 0) {
    const it = floorYen(balance * i);
    let principal = payment - it;
    if (principal <= 0) return null; // 返済が進まない
    if (principal > balance || months + 1 === lastMonth) principal = balance;
    balance -= principal;
    months++;
    interest += it;
    paid += principal + it;
    if (months > 1200) return null;
  }
  return { months, interest, paid };
}

// 元利均等の毎月返済額（円未満切り捨て）
export function monthlyPayment(balance, i, n) {
  const exact = i === 0 ? balance / n : (balance * i * (1 + i) ** n) / ((1 + i) ** n - 1);
  return floorYen(exact);
}

// 当初の返済スケジュール（元利均等）。n 回目までの返済後の残高を返す。
export function balanceAfter({ amount, rate, years }, k) {
  const i = rate / 100 / 12;
  const n = years * 12;
  const pay = monthlyPayment(amount, i, n);
  let bal = amount;
  for (let m = 1; m <= k; m++) {
    const it = floorYen(bal * i);
    let principal = pay - it;
    if (m === n || principal > bal) principal = bal;
    bal -= principal;
  }
  return bal;
}

const ymText = (m) => (m >= 12 ? `${Math.floor(m / 12)}年${m % 12}か月` : `${m}か月`);

export function calculate({ amount, rate, years, elapsed, prepay, fee }) {
  if (![amount, rate, years, elapsed, prepay].every(Number.isFinite)) return { error: '手数料以外のすべての項目に数値を入力してください。' };
  if (!Number.isInteger(amount) || amount < 1 || amount > 1e11) return { error: '借入金額は 1 円以上の整数（1,000 億円まで）で入力してください。' };
  if (rate < 0 || rate > 20) return { error: '金利は 0〜20% の範囲で入力してください。' };
  if (!Number.isInteger(years) || years < 1 || years > 50) return { error: '返済期間は 1〜50 の整数（年）で入力してください。' };
  const n = years * 12;
  if (!Number.isInteger(elapsed) || elapsed < 0 || elapsed >= n) return { error: `返済した回数は 0 回以上、${n - 1} 回以下の整数で入力してください。` };
  if (!Number.isInteger(prepay) || prepay < 1) return { error: '繰上げ返済する額は 1 円以上の整数で入力してください。' };
  const feeYen = Number.isFinite(fee) ? fee : 0;
  if (!Number.isInteger(feeYen) || feeYen < 0) return { error: '手数料は 0 円以上の整数で入力してください。' };

  const i = rate / 100 / 12;
  const pay0 = monthlyPayment(amount, i, n);
  const bal = balanceAfter({ amount, rate, years }, elapsed);
  if (prepay >= bal) return { error: `繰上げ時点の残高は ${bal.toLocaleString('ja-JP')} 円です。それより少ない額を入力してください（残高以上なら全額返済になります）。` };

  const remain = n - elapsed;
  const base = simulate(bal, i, pay0, remain);
  const newBal = bal - prepay;
  const short = simulate(newBal, i, pay0, remain);
  const payRed = monthlyPayment(newBal, i, remain);
  const reduce = simulate(newBal, i, payRed, remain);
  if (!base || !short || !reduce) return { error: 'この条件では返済額を計算できませんでした。入力を見直してください。' };

  const saveShort = base.interest - short.interest - feeYen;
  const saveReduce = base.interest - reduce.interest - feeYen;

  const items = [
    { label: '繰上げ時点の残高', value: bal, unit: '円' },
    { label: '繰上げ後の残高', value: newBal, unit: '円' },
    { label: '【期間短縮型】利息の軽減額（手数料差引後）', value: saveShort, unit: '円', primary: true },
    { label: '【期間短縮型】残りの返済期間', value: short.months, unit: '回', digits: 0 },
    { label: '【期間短縮型】期間の短縮', value: remain - short.months, unit: 'か月' },
    { label: '【返済額軽減型】利息の軽減額（手数料差引後）', value: saveReduce, unit: '円', primary: true },
    { label: '【返済額軽減型】新しい毎月の返済額', value: payRed, unit: '円' },
    { label: '【返済額軽減型】毎月の軽減額', value: pay0 - payRed, unit: '円' },
    { label: '繰上げしない場合の毎月の返済額', value: pay0, unit: '円' },
    { label: '繰上げしない場合の残りの利息', value: base.interest, unit: '円' },
  ];

  return {
    items,
    table: {
      caption: '3つのケースの比較（繰上げ後の返済）',
      headers: ['ケース', '毎月の返済額', '残りの回数', '残りの利息', '残りの総支払額'],
      rows: [
        ['繰上げしない', pay0, base.months, base.interest, base.paid],
        [`期間短縮型（${ymText(short.months)}）`, pay0, short.months, short.interest, short.paid],
        ['返済額軽減型', payRed, reduce.months, reduce.interest, reduce.paid],
      ],
    },
    notes: [
      '当初の借入は元利均等返済・全期間固定金利で、毎月きちんと返済してきたと仮定した試算です。ボーナス返済は含めていません。',
      '毎月の返済額と利息は円未満切り捨て、最終回で残りを精算しています。端数処理や繰上げ日の扱い（日割り利息など）は金融機関によって異なるため、実際の金額とは差が出ることがあります。',
      '利息の軽減額は「繰上げしない場合の残りの利息 − 繰上げ後の残りの利息 − 手数料」です。繰上げに使った資金の運用機会や、住宅ローン控除への影響は考慮していません。',
    ],
  };
}
