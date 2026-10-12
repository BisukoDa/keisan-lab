// 消費税計算（税抜→税込、税込→税抜）
// 金額は整数の円。端数は消費税額に対して1回だけ処理する（整数演算で浮動小数点の誤差を避ける）。

export const inputs = [
  {
    id: 'direction',
    label: '計算の向き',
    type: 'select',
    default: 'toIncl',
    options: [
      { value: 'toIncl', label: '税抜価格から税込価格を求める' },
      { value: 'toExcl', label: '税込価格から税抜価格を求める' },
    ],
  },
  { id: 'amount', label: '金額', type: 'number', unit: '円', default: 10000, min: 0, step: 1 },
  {
    id: 'rate',
    label: '税率',
    type: 'select',
    default: '10',
    options: [
      { value: '10', label: '10%（標準税率）' },
      { value: '8', label: '8%（軽減税率）' },
    ],
  },
  {
    id: 'rounding',
    label: '消費税額の端数処理',
    type: 'select',
    default: 'floor',
    options: [
      { value: 'floor', label: '切り捨て' },
      { value: 'round', label: '四捨五入' },
      { value: 'ceil', label: '切り上げ' },
    ],
  },
];

// 分数 n/d（n, d は正の整数）を指定の方法で整数にする
function roundDiv(n, d, mode) {
  if (mode === 'floor') return Math.floor(n / d);
  if (mode === 'ceil') return Math.ceil(n / d);
  return Math.floor((2 * n + d) / (2 * d)); // 四捨五入（0.5 は切り上げ）
}

const MODE_NAME = { floor: '切り捨て', round: '四捨五入', ceil: '切り上げ' };

export function calculate({ direction, amount, rate, rounding }) {
  const r = Number(rate);
  if (!Number.isFinite(amount)) return { error: '金額を入力してください。' };
  if (!Number.isInteger(amount) || amount < 0 || amount > 1e12) return { error: '金額は 0 円以上 1 兆円以下の整数で入力してください。' };
  if (r !== 10 && r !== 8) return { error: '税率を選んでください。' };
  if (!(rounding in MODE_NAME)) return { error: '端数処理の方法を選んでください。' };
  if (direction !== 'toIncl' && direction !== 'toExcl') return { error: '計算の向きを選んでください。' };

  let tax, excl, incl;
  if (direction === 'toIncl') {
    excl = amount;
    tax = roundDiv(amount * r, 100, rounding);
    incl = excl + tax;
  } else {
    incl = amount;
    tax = roundDiv(amount * r, 100 + r, rounding);
    excl = incl - tax;
  }

  const toIncl = direction === 'toIncl';
  return {
    items: [
      toIncl
        ? { label: '税込価格', value: incl, unit: '円', primary: true }
        : { label: '税抜価格', value: excl, unit: '円', primary: true },
      { label: '消費税額', value: tax, unit: '円' },
      toIncl ? { label: '税抜価格', value: excl, unit: '円' } : { label: '税込価格', value: incl, unit: '円' },
    ],
    notes: [
      `消費税額（税率 ${r}%）の1円未満は${MODE_NAME[rounding]}で処理しています。`,
      toIncl
        ? '税込価格 ＝ 税抜価格 ＋ 消費税額 として求めています。'
        : '消費税額 ＝ 税込価格 × 税率 ÷（100% ＋ 税率）を端数処理し、税抜価格 ＝ 税込価格 − 消費税額 として求めています。',
      '実際のお店や請求書では、端数処理の方法が異なる場合があります。',
    ],
  };
}
