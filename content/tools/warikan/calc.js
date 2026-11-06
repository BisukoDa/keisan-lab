// 割り勘計算：人数・端数の切り上げ単位・多め／少なめに払う人の差額

export const inputs = [
  { id: 'total', label: '合計金額', type: 'number', unit: '円', default: 28000, min: 1, step: 100 },
  { id: 'people', label: '人数', type: 'number', unit: '人', default: 6, min: 1, step: 1 },
  {
    id: 'unit',
    label: '端数の切り上げ単位',
    type: 'select',
    default: '100',
    options: [
      { value: '1', label: '1円単位（切り上げなし）' },
      { value: '10', label: '10円単位' },
      { value: '100', label: '100円単位' },
      { value: '500', label: '500円単位' },
      { value: '1000', label: '1,000円単位' },
    ],
  },
  { id: 'heavy', label: '多めに払う人の数', type: 'number', unit: '人', default: 0, min: 0, step: 1, help: '上司・先輩など。0 なら全員同額です。' },
  { id: 'diff', label: '多めに払う人の上乗せ額', type: 'number', unit: '円', default: 1000, min: 0, step: 100, help: '少なめの人より何円多く払うか。' },
];


export function calculate({ total, people, unit, heavy, diff }) {
  const n = people;
  const u = Number(unit);
  const k = Number.isFinite(heavy) ? heavy : 0;
  const d = Number.isFinite(diff) ? diff : 0;
  if (!Number.isFinite(total) || !Number.isFinite(n)) return { error: '合計金額と人数を入力してください。' };
  if (!Number.isInteger(n) || n < 1) return { error: '人数は1以上の整数で入力してください。' };
  if (!Number.isInteger(total) || total < 1) return { error: '合計金額は1円以上の整数で入力してください。' };
  if (!Number.isInteger(k) || k < 0 || k > n) return { error: '多めに払う人の数は0以上、人数以下の整数で入力してください。' };
  if (!Number.isInteger(d) || d < 0) return { error: '上乗せ額は0円以上の整数で入力してください。' };
  if (![1, 10, 100, 500, 1000].includes(u)) return { error: '切り上げ単位を選んでください。' };
  const base = total - k * d; // 少なめの人たちで割る金額
  if (base <= 0) return { error: '上乗せ額が大きすぎます。全員の負担がマイナスになるため、上乗せ額か人数を見直してください。' };

  const light = Math.ceil(base / n / u) * u;
  const heavyPay = light + d;
  const collected = (n - k) * light + k * heavyPay;
  const surplus = collected - total;
  const items = [{ label: k > 0 ? '少なめの人の1人あたり' : '1人あたり', value: light, unit: '円', primary: true }];
  if (k > 0) items.push({ label: '多めの人の1人あたり', value: heavyPay, unit: '円' });
  items.push({ label: '集まる金額', value: collected, unit: '円' });
  items.push({ label: '余り（幹事の手元に残る額）', value: surplus, unit: '円' });
  items.push({ label: '割り切れた場合の1人あたり', value: Math.round((base / n) * 100) / 100, digits: 2, unit: '円' });

  const rows = [1, 10, 100, 500, 1000].map((x) => {
    const l = Math.ceil(base / n / x) * x;
    const c = (n - k) * l + k * (l + d);
    return [x === 1 ? '1円単位' : `${x.toLocaleString('ja-JP')}円単位`, l, c - total];
  });
  return {
    items,
    table: { caption: '切り上げ単位ごとの比較', collapsible: true, headers: ['単位', k > 0 ? '少なめの人（円）' : '1人あたり（円）', '余り（円）'], rows },
    notes: [
      '1人あたりの金額は、「（合計 − 上乗せ分）÷ 人数」を指定の単位で切り上げて求めています。',
      '切り上げるので、集まる金額は合計より多くなります（余りは幹事の手元に残る額です）。不足は出ません。',
      ...(k > 0 ? ['多めに払う人の上乗せ額を合計から引いてから、全員で等分し、多めの人には上乗せ額を足しています。'] : []),
    ],
  };
}
