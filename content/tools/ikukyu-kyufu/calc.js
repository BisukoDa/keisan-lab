// 育児休業給付金の計算（令和8年8月1日〜令和9年7月31日の限度額）
// 厚生労働省・ハローワーク「育児休業等給付の内容と支給申請手続（2026年8月1日改訂版）」にもとづく。
// 休業開始時賃金日額 = 休業開始前6か月の賃金総額 ÷ 180（月収が毎月同じなら 月収 ÷ 30）。上限 16,540円・下限 3,203円。
// 支給額（30日分）= 賃金日額 × 30日 × 67%（開始から180日目まで）／50%（181日目以降）。
// 出生後休業支援給付金 = 賃金日額 × 28日（上限）× 13%。各金額は1円未満切り捨て（公表の上限・下限額と一致することを確認）。

const DAILY_MAX = 16540;
const DAILY_MIN = 3203;

export const inputs = [
  { id: 'monthly', label: '休業前の月収（平均）', type: 'number', unit: '円', default: 300000, min: 1, step: 10000, help: '休業開始前6か月の賃金の月平均（税金や保険料が引かれる前の額）。ボーナス（3か月を超える期間ごとの賃金）は含めません。' },
  { id: 'months', label: '育児休業をとる期間', type: 'number', unit: 'か月', default: 12, min: 1, max: 24, step: 1, help: '30日を1か月として数えます。原則は子が1歳になる前までです。' },
  {
    id: 'support', label: '出生後休業支援給付金（13%上乗せ）', type: 'select', default: 'yes',
    options: [
      { value: 'yes', label: '要件を満たす（最初の28日分を上乗せ）' },
      { value: 'no', label: '含めない' },
    ],
    help: '子の出生後の決まった期間内（父親は出生後8週間以内、母親は産後休業後8週間以内）に、夫婦ともに14日以上の育児休業をとるなど、一定の要件があります。',
  },
];

const floor = (x) => Math.floor(Math.round(x * 1e6) / 1e6);

export function calculate({ monthly, months, support }) {
  if (!Number.isFinite(monthly) || !Number.isFinite(months)) return { error: '月収と育児休業の期間を数値で入力してください。' };
  if (monthly <= 0) return { error: '月収は 0 より大きい値で入力してください。' };
  if (monthly > 1e7) return { error: '月収は 1,000万円以下で入力してください。' };
  if (!Number.isInteger(months) || months < 1 || months > 24) return { error: '育児休業の期間は 1〜24 か月の整数で入力してください。' };
  if (!['yes', 'no'].includes(support)) return { error: '出生後休業支援給付金の扱いを選んでください。' };

  const rawDaily = floor((monthly * 6) / 180);
  const daily = Math.min(DAILY_MAX, Math.max(DAILY_MIN, rawDaily));
  const capped = rawDaily > DAILY_MAX ? '上限' : rawDaily < DAILY_MIN ? '下限' : null;

  const rows = [];
  let total = 0;
  let firstMonth = 0;
  let laterMonth = 0;
  for (let i = 1; i <= months; i++) {
    const rate = i <= 6 ? 0.67 : 0.5;
    const base = floor(daily * 30 * rate);
    const extra = support === 'yes' && i === 1 ? floor(daily * 28 * 0.13) : 0;
    const sum = base + extra;
    total += sum;
    if (i === 1) firstMonth = sum;
    if (i === 7) laterMonth = sum;
    rows.push([`${i}か月目`, `${Math.round(rate * 100)}%`, base, extra, sum]);
  }

  const items = [
    { label: '1か月目の支給額', value: firstMonth, unit: '円', primary: true },
    { label: '休業全体の支給額の合計', value: total, unit: '円' },
    { label: '休業開始時賃金日額', value: daily, unit: '円' },
  ];
  if (months >= 7) items.splice(1, 0, { label: '7か月目以降の月額', value: laterMonth, unit: '円' });

  const notes = [
    '令和8年8月1日から令和9年7月31日までの限度額（賃金日額 上限16,540円・下限3,203円）で計算しています。限度額は毎年8月1日に改定されます。',
    '賃金日額は「月収 × 6 ÷ 180」として求め、1円未満は切り捨てています。実際は休業前6か月の賃金の総額で決まります。',
    '1か月は30日として計算し、各金額は1円未満を切り捨てています。実際は休業開始日から30日ごとの区切り（支給単位期間）で支給されます。',
    '休業中に会社から賃金が支払われると、支給額が減ったり支給されなかったりします。この計算では賃金が支払われない場合を想定しています。',
    '育児休業給付金の対象は、原則として子が1歳になる前までの育児休業です。保育所に入れないなどの場合に限り、1歳6か月または2歳まで延長できます。出産した人の産後休業（出産の翌日から8週間）は対象外です。',
    '最後の支給単位期間は休業終了日までの日数で計算されるため、休業の終了月は30日分より少なくなることがあります。',
    '育児休業給付金には、受給資格（雇用保険の加入期間など）の要件があります。この結果は受け取れる場合の目安です。',
  ];
  if (capped) notes.unshift(`月収から求めた賃金日額が${capped}を外れるため、${capped}額（${daily.toLocaleString('ja-JP')}円）で計算しています。`);
  if (support === 'yes') notes.push('出生後休業支援給付金は、最初の28日分（賃金日額 × 28日 × 13%）を1か月目に加えています。');

  return {
    items,
    table: { caption: '月ごとの支給額の内訳', collapsible: true, headers: ['期間', '給付率', '育児休業給付金（円）', '出生後休業支援給付金（円）', '合計（円）'], rows },
    notes,
  };
}
