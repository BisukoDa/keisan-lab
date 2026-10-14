// 和暦・西暦変換：西暦の日付→和暦、和暦の年→西暦、前後の年の早見表
import { parseIso, toWareki, WAREKI_MIN } from '../../lib/dates.js';

// 元号ごとの 1 年目の西暦と、使える年の上限（明治は新暦になった明治6年から）
const ERAS = [
  { value: '明治', first: 1868, minYear: 6, maxYear: 45 },
  { value: '大正', first: 1912, minYear: 1, maxYear: 15 },
  { value: '昭和', first: 1926, minYear: 1, maxYear: 64 },
  { value: '平成', first: 1989, minYear: 1, maxYear: 31 },
  { value: '令和', first: 2019, minYear: 1, maxYear: 200 },
];

export const inputs = [
  {
    id: 'mode',
    label: '変換の向き',
    type: 'select',
    default: 'toWareki',
    options: [
      { value: 'toWareki', label: '西暦 → 和暦' },
      { value: 'toSeireki', label: '和暦 → 西暦' },
    ],
  },
  { id: 'date', label: '西暦の日付', type: 'date', default: '2019-05-01', showIf: { mode: 'toWareki' }, help: '1873年1月1日以降の日付に対応しています。' },
  {
    id: 'era',
    label: '元号',
    type: 'select',
    default: '令和',
    showIf: { mode: 'toSeireki' },
    options: ERAS.map((e) => ({ value: e.value, label: e.value })).reverse(),
  },
  { id: 'year', label: '和暦の年', type: 'number', unit: '年', default: 8, min: 1, step: 1, help: '元年は「1」と入力します。', showIf: { mode: 'toSeireki' } },
];

const yearText = (n) => (n === 1 ? '元年' : `${n}年`);

// 西暦の年に当てはまる和暦（改元のあった年は「新元号 / 旧元号」の順に並べる）
export function warekiOfYear(y) {
  const out = [];
  for (let i = ERAS.length - 1; i >= 0; i--) {
    const e = ERAS[i];
    const n = y - e.first + 1;
    const next = ERAS[i + 1];
    const last = next ? next.first : Infinity; // 次の元号に変わる年も、その元号の最後の年として含む
    if (y >= e.first && y <= last && n >= (e.minYear > 1 ? e.minYear : 1)) out.push(`${e.value}${yearText(n)}`);
  }
  return out.length ? out.join(' / ') : null;
}

function yearTable(center) {
  const rows = [];
  for (let y = center - 4; y <= center + 5; y++) {
    const w = warekiOfYear(y);
    if (w) rows.push([`${y}年`, w]);
  }
  return rows.length
    ? { caption: '前後の年の早見表', collapsible: true, headers: ['西暦', '和暦'], rows }
    : null;
}

export function calculate({ mode, date, era, year }) {
  if (mode === 'toWareki') {
    const p = parseIso(date);
    if (!p) return { error: '実在する日付を入力してください。' };
    const w = toWareki(date);
    if (!w) return { error: '1873年（明治6年）1月1日より前の日付は、旧暦のため変換できません。' };
    const items = [
      { label: '和暦', value: w.text, primary: true },
      { label: '西暦', value: `${p.y}年${p.m}月${p.d}日` },
      { label: '年だけで表すと', value: warekiOfYear(p.y) },
    ];
    const r = { items, notes: ['改元のあった年は、日付によって元号が変わります。上の「和暦」は入力した日付時点のものです。'] };
    const t = yearTable(p.y);
    if (t) r.table = t;
    return r;
  }

  const e = ERAS.find((x) => x.value === era);
  if (!e) return { error: '元号を選んでください。' };
  if (!Number.isFinite(year) || !Number.isInteger(year)) return { error: '和暦の年は整数で入力してください（元年は 1）。' };
  if (year < e.minYear || year > e.maxYear) {
    const range = e.maxYear === 200 ? `${e.minYear}年以降` : `${e.minYear}〜${e.maxYear}年`;
    return { error: `${e.value}は${range}の範囲で入力してください。` };
  }
  const y = e.first + year - 1;
  const items = [
    { label: '西暦', value: y, unit: '年', primary: true },
    { label: '入力', value: `${e.value}${yearText(year)}` },
  ];
  const notes = [];
  if (year === 1 && e.value !== '明治') notes.push(`${e.value}元年は、${e.value}になった日から年末までの期間です。`);
  if (e.value === '昭和' && year === 1) notes.push('昭和元年は12月25日から12月31日までの7日間です。');
  if (e.value === '昭和' && year === 64) notes.push('昭和64年は1月1日から1月7日までの7日間です。1月8日からは平成元年です。');
  if (e.value === '平成' && year === 31) notes.push('平成31年は1月1日から4月30日までです。5月1日からは令和元年です。');
  if (e.value === '大正' && year === 15) notes.push('大正15年は12月24日までです。12月25日からは昭和元年です。');
  if (e.value === '明治' && year === 45) notes.push('明治45年は7月29日までです。7月30日からは大正元年です。');
  const t = yearTable(y);
  const r = { items };
  if (notes.length) r.notes = notes;
  if (t) r.table = t;
  return r;
}
