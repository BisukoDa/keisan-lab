// 学年早見表：生年月日から学年・入学年・卒業年（現役）を求める（6・3・3・4制）
import { parseIso, toWareki } from '../../lib/dates.js';

export const inputs = [
  { id: 'birth', label: '生年月日', type: 'date', default: '2015-06-15', min: '1950-01-01' },
  { id: 'base', label: '基準日', type: 'date', default: 'today', help: '通常は今日のままで構いません。入学や卒業の年の4月1日などにすると、その時点の学年がわかります。' },
];

const pad = (n) => String(n).padStart(2, '0');

// 同じ学年になる子の「学年の年度」。4月2日〜翌年4月1日生まれが同じ年度（生まれ年度）になる。
export function birthFiscalYear(birth) {
  const b = parseIso(birth);
  return b.m > 4 || (b.m === 4 && b.d >= 2) ? b.y : b.y - 1;
}

// 小学校に入学する年（4月）。満6歳に達した日（誕生日の前日）の翌日以後の最初の学年の初めに入学する。
export function elementaryEntryYear(birth) {
  return birthFiscalYear(birth) + 7;
}

// 基準日の属する学年の年度（4月1日〜翌年3月31日）
export function schoolYearOf(base) {
  const t = parseIso(base);
  return t.m >= 4 ? t.y : t.y - 1;
}

// 学年の通し番号（小1=1 … 高3=12、大学4年=16）から表示名へ
export function gradeLabel(n) {
  if (n <= 0) return null;
  if (n <= 6) return `小学${n}年生`;
  if (n <= 9) return `中学${n - 6}年生`;
  if (n <= 12) return `高校${n - 9}年生`;
  if (n <= 16) return `大学${n - 12}年生`;
  return null;
}

const wa = (y, m) => {
  const w = toWareki(`${y}-${pad(m)}-01`);
  return `${y}年（${w ? w.yearText : '—'}）${m}月`;
};

export function calculate({ birth, base }) {
  const b = parseIso(birth);
  if (!b) return { error: '生年月日を正しく入力してください。' };
  if (!parseIso(base)) return { error: '基準日を正しく入力してください。' };
  if (birth < '1950-01-01') return { error: '生年月日は 1950年1月1日以降で入力してください（現在の学校制度に合わせた計算のためです）。' };
  if (base < birth) return { error: '基準日は生年月日より後の日付にしてください。' };
  if (base > '2200-12-31') return { error: '計算できる範囲を超えています。基準日は 2200年12月31日までで入力してください。' };

  const fy = birthFiscalYear(birth);
  const entry = elementaryEntryYear(birth);
  const sy = schoolYearOf(base);
  const n = sy - entry + 1;
  const early = b.m < 4 || (b.m === 4 && b.d === 1);

  let status;
  if (n <= 0) status = `就学前（小学校入学は${entry}年4月）`;
  else if (n > 16) status = `大学卒業後（現役の場合は${entry + 16}年3月に卒業）`;
  else status = gradeLabel(n);

  const items = [
    { label: '基準日時点の学年', value: status, primary: true },
    { label: '早生まれ・遅生まれ', value: early ? '早生まれ（1月1日〜4月1日生まれ）' : '遅生まれ（4月2日〜12月31日生まれ）' },
    { label: '同じ学年になる生年月日', value: `${fy}年4月2日 〜 ${fy + 1}年4月1日` },
    { label: '小学校入学', value: `${entry}年4月` },
    { label: '大学卒業（現役・4年制）', value: `${entry + 16}年3月` },
  ];

  const stages = [
    ['小学校（6年）', entry, entry + 6],
    ['中学校（3年）', entry + 6, entry + 9],
    ['高等学校（3年）', entry + 9, entry + 12],
    ['大学（4年制）', entry + 12, entry + 16],
  ];
  const table = {
    caption: '入学・卒業の年（現役で進んだ場合）',
    headers: ['学校', '入学', '卒業'],
    rows: stages.map(([name, s, e]) => [name, wa(s, 4), wa(e, 3)]),
  };

  const notes = [
    '小学校〜高校を留年・浪人・休学なしで進み、大学に4年で卒業する場合の目安です。',
    '学年は4月1日に始まり翌年3月31日に終わります。4月2日〜翌年4月1日生まれが同じ学年です。',
    '就学の時期は、学校教育法に基づく一般的な場合です。個別の事情による就学猶予・免除や、各学校の入学条件は、お住まいの教育委員会や学校に確認してください。',
  ];
  return { items, table, notes };
}
