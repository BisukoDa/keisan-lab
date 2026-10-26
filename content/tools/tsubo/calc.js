// 坪・平米・畳の換算：1坪 = 400/121 ㎡（1尺 = 10/33 m、1坪 = 6尺 × 6尺）

export const TSUBO_M2 = 400 / 121;

// 畳1枚の面積（㎡）。ふつうのサイズ（長さ×幅 cm）から求める
export const TATAMI = {
  kyoma: { label: '京間（191×95.5cm）', m2: 1.91 * 0.955 },
  chukyo: { label: '中京間（182×91cm）', m2: 1.82 * 0.91 },
  edoma: { label: '江戸間（176×88cm）', m2: 1.76 * 0.88 },
  danchi: { label: '団地間（170×85cm）', m2: 1.7 * 0.85 },
  fudosan: { label: '不動産広告の基準（1.62㎡）', m2: 1.62 },
};

export const inputs = [
  {
    id: 'from',
    label: '換算元の単位',
    type: 'select',
    default: 'tsubo',
    options: [
      { value: 'tsubo', label: '坪' },
      { value: 'm2', label: '平方メートル（㎡）' },
      { value: 'jo', label: '畳（帖）' },
    ],
  },
  { id: 'value', label: '広さ', type: 'number', default: 30, min: 0, step: 0.1 },
  {
    id: 'size',
    label: '畳1枚の大きさ',
    type: 'select',
    default: 'edoma',
    options: Object.entries(TATAMI).map(([value, t]) => ({ value, label: t.label })),
    help: '畳との換算に使います。地域によって大きさが違います。',
  },
];

// 表示用に小数2桁へ丸める（0.1 + 0.2 のような浮動小数点の誤差も消える）
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function calculate({ from, value, size }) {
  if (!Number.isFinite(value)) return { error: '広さを数値で入力してください。' };
  if (value < 0) return { error: '広さは 0 以上で入力してください。' };
  const t = TATAMI[size];
  if (!t) return { error: '畳1枚の大きさを選んでください。' };

  let m2;
  if (from === 'tsubo') m2 = value * TSUBO_M2;
  else if (from === 'm2') m2 = value;
  else if (from === 'jo') m2 = value * t.m2;
  else return { error: '換算元の単位を選んでください。' };

  const tsubo = m2 / TSUBO_M2;
  const jo = m2 / t.m2;
  const items = [
    { label: '平方メートル（㎡）', value: r2(m2), digits: 2, unit: '㎡', primary: from !== 'm2' },
    { label: '坪', value: r2(tsubo), digits: 2, unit: '坪', primary: from === 'm2' },
    { label: `畳・${t.label}`, value: r2(jo), digits: 2, unit: '畳' },
  ];

  const rows = Object.values(TATAMI).map((x) => [x.label, r2(x.m2), r2(m2 / x.m2)]);
  return {
    items,
    table: {
      caption: `同じ広さを、畳の大きさ別に畳数へ換算した場合（${r2(m2)}㎡）`,
      headers: ['畳の種類', '1枚の面積（㎡）', '畳数'],
      rows,
    },
    notes: [
      '1坪は 400/121㎡（約3.3058㎡）で計算し、結果は小数第3位を四捨五入して表示しています。',
      '畳1枚の面積は、表示した寸法（長さ×幅）をかけた値です。実際の畳は商品や地域で少しずつ違います。',
      '不動産広告では、畳数は「1枚あたり1.62㎡以上」を基準に表示するルールです。',
    ],
  };
}
