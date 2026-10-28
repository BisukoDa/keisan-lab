// 残業代（割増賃金）計算
// 前提：1時間あたりの基礎賃金 = 月給 ÷ 月平均所定労働時間（1円未満は50銭未満切り捨て・50銭以上切り上げ）
// 割増賃金の支給額 = 基礎賃金 × 割増後の率 × 時間。区分ごとに1円未満を同じルールで丸めて合計する。
// 率：法定時間外 1.25／月60時間超 1.5／深夜（22〜5時）は +0.25／法定休日 1.35（深夜と重なると 1.6）。
// 時間外と深夜が重なる分のうち、深夜は月60時間までの部分に含まれるものとして計算する。

export const inputs = [
  {
    id: 'basis', label: '基礎となる賃金の入力方法', type: 'select', default: 'monthly',
    options: [
      { value: 'monthly', label: '月給から時給を求める' },
      { value: 'hourly', label: '時給を直接入れる' },
    ],
  },
  { id: 'monthlySalary', label: '割増の基礎になる月給', type: 'number', unit: '円', default: 300000, min: 1, step: 1000, showIf: { basis: 'monthly' }, help: '基本給＋職務手当など。通勤手当・家族手当・住宅手当などは含めません。' },
  { id: 'monthlyHours', label: '月平均の所定労働時間', type: 'number', unit: '時間', default: 160, min: 1, max: 744, step: 0.01, showIf: { basis: 'monthly' }, help: '会社の決まりで働く時間（残業を除く）の月平均。1日8時間・年間245日なら約163.33時間です。' },
  { id: 'hourlyWage', label: '1時間あたりの基礎賃金', type: 'number', unit: '円', default: 1875, min: 1, step: 1, showIf: { basis: 'hourly' }, help: '手当を除いた基本の時給です。' },
  { id: 'overtime', label: '法定時間外労働（1か月の合計）', type: 'number', unit: '時間', default: 40, min: 0, max: 744, step: 0.25, help: '1日8時間・週40時間を超えて働いた時間の合計。法定休日に働いた時間は含めません。' },
  { id: 'overtimeNight', label: 'うち、深夜（22時〜翌5時）にあたる時間', type: 'number', unit: '時間', default: 5, min: 0, max: 744, step: 0.25, help: '上の時間外労働のうち、深夜帯に働いた時間。' },
  { id: 'holiday', label: '法定休日の労働（1か月の合計）', type: 'number', unit: '時間', default: 0, min: 0, max: 744, step: 0.25, help: '週1日（または4週4日）与えるべき法定休日に働いた時間。' },
  { id: 'holidayNight', label: 'うち、深夜（22時〜翌5時）にあたる時間', type: 'number', unit: '時間', default: 0, min: 0, max: 744, step: 0.25 },
  { id: 'nightOnly', label: '時間外ではない深夜勤務', type: 'number', unit: '時間', default: 0, min: 0, max: 744, step: 0.25, help: '所定労働時間内や法定内の勤務で深夜にあたる時間。深夜の割増分だけが加算されます。' },
];

// 1円未満を 50銭未満切り捨て・50銭以上切り上げ
const yen = (x) => Math.floor(Math.round(x * 1e6) / 1e6 + 0.5);

export function calculate({ basis, monthlySalary, monthlyHours, hourlyWage, overtime, overtimeNight, holiday, holidayNight, nightOnly }) {
  if (!['monthly', 'hourly'].includes(basis)) return { error: '基礎賃金の入力方法を選んでください。' };
  const hours = { overtime, overtimeNight, holiday, holidayNight, nightOnly };
  for (const v of Object.values(hours)) {
    if (!Number.isFinite(v)) return { error: '時間はすべて数値で入力してください（ない場合は 0）。' };
    if (v < 0) return { error: '時間は 0 以上で入力してください。' };
    if (v > 744) return { error: '1か月の時間は 744 時間（31日分）以下で入力してください。' };
  }
  if (overtimeNight > overtime) return { error: '時間外労働のうちの深夜時間が、時間外労働の合計より多くなっています。' };
  if (holidayNight > holiday) return { error: '法定休日労働のうちの深夜時間が、法定休日労働の合計より多くなっています。' };

  let base;
  if (basis === 'monthly') {
    if (!Number.isFinite(monthlySalary) || !Number.isFinite(monthlyHours)) return { error: '月給と月平均の所定労働時間を数値で入力してください。' };
    if (monthlySalary <= 0) return { error: '月給は 0 より大きい値で入力してください。' };
    if (monthlySalary > 1e8) return { error: '月給は 1億円以下で入力してください。' };
    if (monthlyHours <= 0 || monthlyHours > 744) return { error: '月平均の所定労働時間は 0 より大きく 744 以下で入力してください。' };
    base = yen(monthlySalary / monthlyHours);
  } else {
    if (!Number.isFinite(hourlyWage)) return { error: '1時間あたりの基礎賃金を数値で入力してください。' };
    if (hourlyWage <= 0) return { error: '1時間あたりの基礎賃金は 0 より大きい値で入力してください。' };
    if (hourlyWage > 1e6) return { error: '1時間あたりの基礎賃金は 100万円以下で入力してください。' };
    base = yen(hourlyWage);
  }

  // 時間外を 60時間まで／60時間超に分け、深夜分は60時間までの部分から順に割り当てる
  const ot60 = Math.min(overtime, 60);
  const otOver = overtime - ot60;
  const nightIn60 = Math.min(overtimeNight, ot60);
  const nightOver = overtimeNight - nightIn60;
  const rows = [
    ['法定時間外（月60時間まで・深夜以外）', 1.25, ot60 - nightIn60],
    ['法定時間外（月60時間まで・深夜）', 1.5, nightIn60],
    ['法定時間外（月60時間超・深夜以外）', 1.5, otOver - nightOver],
    ['法定時間外（月60時間超・深夜）', 1.75, nightOver],
    ['法定休日（深夜以外）', 1.35, holiday - holidayNight],
    ['法定休日（深夜）', 1.6, holidayNight],
    ['深夜のみ（割増分）', 0.25, nightOnly],
  ].map(([label, rate, h]) => [label, rate, h, yen(base * rate * h)]);
  const total = rows.reduce((s, r) => s + r[3], 0);
  const used = rows.filter((r) => r[2] > 0);

  return {
    items: [
      { label: '残業代などの合計（月額）', value: total, unit: '円', primary: true },
      { label: '1時間あたりの基礎賃金', value: base, unit: '円' },
      { label: '割増の対象になった時間の合計', value: used.reduce((s, r) => s + r[2], 0), digits: 2, unit: '時間' },
    ],
    table: {
      caption: '区分ごとの内訳',
      headers: ['区分', '率', '時間', '金額（円）'],
      rows: used.length ? used.map((r) => [r[0], `${r[1]}倍`, r[2], r[3]]) : [['割増の対象なし', '-', 0, 0]],
    },
    notes: [
      '1時間あたりの基礎賃金と区分ごとの金額は、1円未満を50銭未満切り捨て・50銭以上切り上げで丸めて合計しています。',
      '率は労働基準法第37条と割増賃金令にもとづく最低ラインです。就業規則や契約でこれより高い率が決まっていることがあります。',
      '月給を基礎にする場合、通勤手当・家族手当・別居手当・子女教育手当・住宅手当・臨時の賃金・1か月を超える期間ごとの賃金は除いて入力します。',
      '時間外と深夜が重なる分は、月60時間までの部分に含まれるものとして計算しています。固定残業代（みなし残業）をすでに受け取っている場合は、その分を差し引いて考えてください。',
    ],
  };
}
