// 年齢計算：満年齢・数え年・生まれ年の和暦と干支・次の誕生日
import { parseIso, diffDays, formatJp, toWareki, isLeapYear, WAREKI_MIN } from '../../lib/dates.js';

export const inputs = [
  { id: 'birth', label: '生年月日', type: 'date', default: '2000-01-01', min: '1873-01-01' },
  { id: 'base', label: '基準日', type: 'date', default: 'today', help: '通常は今日のままで構いません。過去や将来の時点の年齢も計算できます。' },
];

const ETO = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ETO_YOMI = ['ね', 'うし', 'とら', 'う', 'たつ', 'み', 'うま', 'ひつじ', 'さる', 'とり', 'いぬ', 'い'];
const JIKKAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const mod = (a, n) => ((a % n) + n) % n;

export function eto(year) {
  const k = mod(year - 4, 12);
  return { animal: ETO[k], yomi: ETO_YOMI[k], kanshi: JIKKAN[mod(year - 4, 10)] + ETO[k] };
}

// 満年齢。年齢は誕生日の前日の終わり（＝誕生日の0時）に加算されるため、月日の比較で求められる。
// 2月29日生まれは平年では3月1日0時（2月28日の終わり）に加算される。
export function fullAge(birth, base) {
  const b = parseIso(birth);
  const t = parseIso(base);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age;
}

// その年の「年齢が加算される日」（2月29日生まれは平年なら3月1日）
function birthdayIn(year, b) {
  if (b.m === 2 && b.d === 29 && !isLeapYear(year)) return `${year}-03-01`;
  return `${year}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;
}

export function calculate({ birth, base }) {
  const b = parseIso(birth);
  if (!b) return { error: '生年月日を正しく入力してください。' };
  if (!parseIso(base)) return { error: '基準日を正しく入力してください。' };
  if (birth < WAREKI_MIN) return { error: '生年月日は 1873年（明治6年）1月1日以降で入力してください。' };
  if (base > '9998-12-31') return { error: '計算できる範囲を超えています。基準日は 9998年12月31日までで入力してください。' };
  if (base < birth) return { error: '基準日は生年月日より後の日付にしてください。' };

  const age = fullAge(birth, base);
  const t = parseIso(base);
  let next = birthdayIn(t.y, b);
  if (next <= base) next = birthdayIn(t.y + 1, b);
  const e = eto(b.y);
  const w = toWareki(birth);

  const items = [
    { label: '満年齢', value: age, unit: '歳', primary: true },
    { label: '数え年', value: t.y - b.y + 1, unit: '歳' },
    { label: '生まれ年（和暦）', value: w ? w.yearText : '—' },
    { label: '生まれ年の干支', value: `${e.animal}（${e.yomi}）年・${e.kanshi}` },
    { label: '次の誕生日', value: `${formatJp(next)}（あと${diffDays(base, next)}日・${age + 1}歳）` },
    { label: '生まれてからの日数', value: diffDays(birth, base), unit: '日' },
  ];
  const notes = ['数え年は、生まれた年を1歳とし、元日（1月1日）ごとに1歳を加える数え方です。', '干支は西暦の年で判定しています。立春を年の区切りとする場合、1月〜2月上旬生まれは前年の干支になることがあります。'];
  if (b.m === 2 && b.d === 29) notes.push('2月29日生まれの方は、平年は2月28日が終わった時点（3月1日）で1歳加算されます。');
  return { items, notes };
}
