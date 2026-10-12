// パーセント計算：○の○%、○は○の何%、増減率、○%引き、○%増し

export const inputs = [
  {
    id: 'mode',
    label: '計算する内容',
    type: 'select',
    default: 'of',
    options: [
      { value: 'of', label: 'A の B％ はいくつ？' },
      { value: 'ratio', label: 'A は B の何％？' },
      { value: 'change', label: 'A から B に変わると何％増減？' },
      { value: 'discount', label: 'A 円の B％引きはいくら？' },
      { value: 'increase', label: 'A の B％増しはいくつ？' },
    ],
  },
  { id: 'base', label: 'もとの数・金額（A）', type: 'number', default: 2000, showIf: { mode: ['of', 'discount', 'increase'] } },
  { id: 'pct', label: 'パーセント（B）', type: 'number', unit: '%', default: 15, showIf: { mode: ['of', 'discount', 'increase'] } },
  { id: 'part', label: '比べる数（A）', type: 'number', default: 30, showIf: { mode: 'ratio' } },
  { id: 'whole', label: 'もとにする数（B）', type: 'number', default: 120, showIf: { mode: 'ratio' } },
  { id: 'from', label: '変化前の数（A）', type: 'number', default: 100, showIf: { mode: 'change' } },
  { id: 'to', label: '変化後の数（B）', type: 'number', default: 120, showIf: { mode: 'change' } },
];

// 浮動小数点の誤差（0.1 + 0.2 など）を表示前に丸める
const clean = (v) => Number(v.toPrecision(12));
const decimals = (x) => (x.toFixed(12).replace(/0+$/, '').split('.')[1] ?? '').length;
// 表示用の値と桁数：整数はそのまま、0.01 以上は小数2桁まで、それより小さい値は有効数字3桁（0 に見えないように）
function num(v) {
  const c = clean(v);
  if (Number.isInteger(c)) return { value: c, digits: 0 };
  const r = Math.abs(c) >= 0.01 ? Math.round(c * 100) / 100 : Number(c.toPrecision(3));
  return { value: r, digits: Math.min(12, decimals(r)) };
}
const fmtPct = (v) => clean(v).toLocaleString('ja-JP', { maximumFractionDigits: 6 });
// 小数は必要な桁だけ表示する（0.25 → "0.25"、1/3 → "0.3333"）
const fmtDec = (v, max) => clean(v).toLocaleString('ja-JP', { maximumFractionDigits: max });

// 0.325 → 3割2分5厘（厘未満は四捨五入）
export function buai(ratio) {
  if (ratio < 0) return null;
  const rin = Math.round(ratio * 1000);
  const wari = Math.floor(rin / 100);
  const bu = Math.floor((rin % 100) / 10);
  const r = rin % 10;
  const s = (wari ? `${wari}割` : '') + (bu ? `${bu}分` : '') + (r ? `${r}厘` : '');
  return s || '0割';
}

export function calculate({ mode, base, pct, part, whole, from, to }) {
  const need = (...vs) => vs.every(Number.isFinite);
  const missing = { error: '数値を入力してください。' };

  if (mode === 'of') {
    if (!need(base, pct)) return missing;
    const v = (base * pct) / 100;
    const items = [{ label: `${fmtPct(base)} の ${fmtPct(pct)}%`, ...num(v), primary: true }];
    if (pct >= 0 && pct <= 100) items.push({ label: `残り（${fmtPct(100 - pct)}%）`, ...num(base - v) });
    return { items };
  }
  if (mode === 'ratio') {
    if (!need(part, whole)) return missing;
    if (whole === 0) return { error: 'もとにする数（B）に 0 は使えません。' };
    const ratio = part / whole;
    const items = [
      { label: `${fmtPct(part)} は ${fmtPct(whole)} の`, ...num(ratio * 100), unit: '%', primary: true },
      { label: '小数で表すと', value: fmtDec(ratio, 4) },
    ];
    const b = buai(ratio);
    if (b) items.push({ label: '歩合で表すと（厘未満は四捨五入）', value: b });
    return { items };
  }
  if (mode === 'change') {
    if (!need(from, to)) return missing;
    if (from === 0) return { error: '変化前の数（A）に 0 は使えません。' };
    const rate = ((to - from) / Math.abs(from)) * 100;
    const diff = to - from;
    return {
      items: [
        { label: rate >= 0 ? '増加率' : '減少率', ...num(Math.abs(rate)), unit: '%', primary: true },
        { label: '増減した数', value: (diff > 0 ? '+' : '') + fmtDec(diff, 6) },
        { label: '変化後 ÷ 変化前（倍率）', value: fmtDec(to / from, 4), unit: '倍' },
      ],
      notes: from < 0 ? ['変化前がマイナスの場合、増減率は変化前の絶対値を基準に計算しています。'] : [],
    };
  }
  if (mode === 'discount' || mode === 'increase') {
    if (!need(base, pct)) return missing;
    if (mode === 'discount' && (pct < 0 || pct > 100)) return { error: '割引率は 0〜100% の範囲で入力してください。' };
    const delta = (base * pct) / 100;
    if (mode === 'discount') {
      return {
        items: [
          { label: `${fmtPct(pct)}%引きの値段`, ...num(base - delta), unit: '円', primary: true },
          { label: '割引される金額', ...num(delta), unit: '円' },
        ],
        notes: ['実際の店頭価格は、1円未満の端数を切り捨て・四捨五入などで処理する場合があります。'],
      };
    }
    return { items: [
      { label: `${fmtPct(pct)}%増しの数`, ...num(base + delta), primary: true },
      { label: '増える数', ...num(delta) },
    ] };
  }
  return { error: '計算する内容を選んでください。' };
}
