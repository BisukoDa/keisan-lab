// 預金の利息計算（税引後）
// 前提：期間は月単位。複利は「複利の周期」ごとに利息を元本に組み入れ、端数の期間は単利で日割りせず月割りで加算する。
// 利息は満期時にまとめて円未満切り捨て。税金は 所得税等 15.315% と 住民税 5% をそれぞれ円未満切り捨て。

export const inputs = [
  { id: 'principal', label: '預入金額', type: 'number', unit: '円', default: 1000000, min: 1, max: 100000000000, step: 10000, help: '定期預金などに預ける金額。1,000億円まで入力できます。' },
  { id: 'rate', label: '年利（税引前）', type: 'number', unit: '%', default: 0.5, min: 0, max: 20, step: 0.01, help: '金融機関が示す年利（税引前）を入れてください。' },
  { id: 'months', label: '預入期間', type: 'number', unit: 'か月', default: 12, min: 1, max: 600, step: 1, help: '1年なら 12、5年なら 60。' },
  {
    id: 'method', label: '利息の計算方法', type: 'select', default: 'simple',
    options: [
      { value: 'simple', label: '単利（満期にまとめて受け取る）' },
      { value: 'half', label: '半年複利' },
      { value: 'year', label: '1年複利' },
    ],
  },
];

const TAX_NATIONAL = 0.15315; // 所得税及び復興特別所得税
const TAX_LOCAL = 0.05; // 住民税（地方税）

// 浮動小数点誤差（10499.999999999998 など）で1円少なくならないよう、小数6桁に丸めてから切り捨てる
const floorYen = (x) => Math.floor(Number(x.toFixed(6)));

export function interestBefore(principal, rate, months, method) {
  const r = rate / 100;
  if (method === 'simple') return floorYen((principal * r * months) / 12);
  const k = method === 'half' ? 6 : 12; // 複利の周期（月）
  const n = Math.floor(months / k);
  const rest = months - n * k;
  let balance = principal;
  for (let i = 0; i < n; i++) balance += (balance * r * k) / 12;
  balance += (balance * r * rest) / 12;
  return floorYen(balance - principal);
}

export function taxOf(interest) {
  return floorYen(interest * TAX_NATIONAL) + floorYen(interest * TAX_LOCAL);
}

export function calculate({ principal, rate, months, method }) {
  if (![principal, rate, months].every(Number.isFinite)) return { error: 'すべての項目に数値を入力してください。' };
  if (principal < 1 || principal > 1e11) return { error: '預入金額は 1 円〜1,000 億円の範囲で入力してください。' };
  if (rate < 0 || rate > 20) return { error: '年利は 0〜20% の範囲で入力してください。' };
  if (!Number.isInteger(months) || months < 1 || months > 600) return { error: '預入期間は 1〜600 の整数（か月）で入力してください。' };
  if (!['simple', 'half', 'year'].includes(method)) return { error: '利息の計算方法を選んでください。' };

  const interest = interestBefore(principal, rate, months, method);
  const tax = taxOf(interest);
  const net = interest - tax;
  return {
    items: [
      { label: '税引後の受取利息', value: net, unit: '円', primary: true },
      { label: '税引前の利息', value: interest, unit: '円' },
      { label: '税金（合計）', value: tax, unit: '円' },
      { label: '満期の受取総額（税引後）', value: principal + net, unit: '円' },
      { label: '税引後の実質年利（単利換算）', value: ((net / principal) * 12 / months) * 100, digits: 4, unit: '%' },
    ],
    notes: [
      '利息は満期時にまとめて円未満切り捨て、税金は所得税等（15.315%）と住民税（5%）をそれぞれ円未満切り捨てで計算した概算です。',
      '実際の利息は日割り計算や金融機関ごとの端数処理により、数円〜数十円ずれることがあります。',
      '複利で期間が周期で割り切れない場合、端数の期間は残高に対する月割りの単利で加えています。',
    ],
  };
}
