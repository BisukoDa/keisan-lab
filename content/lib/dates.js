// 日付ツール共通のヘルパー。すべて 'YYYY-MM-DD' 文字列と UTC で扱い、タイムゾーンの影響を受けないようにする。

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const DAY_MS = 86_400_000;

// 実在する日付なら { y, m, d } を、そうでなければ null を返す
export function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1000) return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

// 以下の関数は parseIso で検証済みの日付を受け取る前提。不正な値には明示的に例外を投げる。
function mustParse(iso) {
  const p = parseIso(iso);
  if (!p) throw new RangeError(`不正な日付: ${iso}`);
  return p;
}

export const toMs = (iso) => {
  const p = mustParse(iso);
  return Date.UTC(p.y, p.m - 1, p.d);
};
export const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso, n) => fromMs(toMs(iso) + n * DAY_MS);
export const diffDays = (from, to) => Math.round((toMs(to) - toMs(from)) / DAY_MS);
export const weekdayIndex = (iso) => new Date(toMs(iso)).getUTCDay();
export const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function formatJp(iso) {
  const p = mustParse(iso);
  return `${p.y}年${p.m}月${p.d}日（${WEEKDAYS[weekdayIndex(iso)]}）`;
}

// 改元日（グレゴリオ暦）。明治5年12月2日（旧暦）まで太陰太陽暦のため、1873-01-01 より前は変換しない
const ERAS = [
  { name: '令和', start: '2019-05-01', firstYear: 2019 },
  { name: '平成', start: '1989-01-08', firstYear: 1989 },
  { name: '昭和', start: '1926-12-25', firstYear: 1926 },
  { name: '大正', start: '1912-07-30', firstYear: 1912 },
  { name: '明治', start: '1868-01-25', firstYear: 1868 },
];
export const WAREKI_MIN = '1873-01-01';

export function toWareki(iso) {
  if (!parseIso(iso) || iso < WAREKI_MIN) return null;
  const era = ERAS.find((e) => iso >= e.start);
  const { y, m, d } = parseIso(iso);
  const year = y - era.firstYear + 1;
  const yearText = year === 1 ? '元年' : `${year}年`;
  return { era: era.name, year, yearText: `${era.name}${yearText}`, text: `${era.name}${yearText}${m}月${d}日` };
}

// 0 <= 日数 の範囲 [from, to]（両端含む）にある月〜金の日数
export function countWeekdays(from, to) {
  const total = diffDays(from, to) + 1;
  if (total <= 0) return 0;
  const full = Math.floor(total / 7);
  let count = full * 5;
  const startDow = weekdayIndex(from);
  for (let k = 0; k < total % 7; k++) {
    const dow = (startDow + full * 7 + k) % 7;
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
