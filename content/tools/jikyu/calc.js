// 時給・月給・年収換算（額面）
// 前提：年間勤務日数 = 週の勤務日数 × 52週 − 年間の追加休日、月平均労働時間 = 1日の労働時間 × 年間勤務日数 ÷ 12
// 月給 = 年収 ÷ 12。金額は計算の途中では丸めず、表示のときに1円未満を四捨五入する。

export const inputs = [
  {
    id: 'mode', label: '手元の金額は？', type: 'select', default: 'hourly',
    options: [
      { value: 'hourly', label: '時給から月給・年収を求める' },
      { value: 'monthly', label: '月給から時給・年収を求める' },
      { value: 'yearly', label: '年収から時給・月給を求める' },
    ],
  },
  { id: 'hourlyAmount', label: '時給', type: 'number', unit: '円', default: 1200, min: 1, step: 10, showIf: { mode: 'hourly' }, help: '基本の時給です。交通費や割増分は含めません。' },
  { id: 'monthlyAmount', label: '月給（額面）', type: 'number', unit: '円', default: 250000, min: 1, step: 1000, showIf: { mode: 'monthly' }, help: '手取りではなく、税金などを引く前の金額です。' },
  { id: 'yearlyAmount', label: '年収（額面）', type: 'number', unit: '円', default: 4000000, min: 1, step: 10000, showIf: { mode: 'yearly' }, help: '手取りではなく、税金などを引く前の金額です。' },
  { id: 'hoursPerDay', label: '1日の労働時間', type: 'number', unit: '時間', default: 8, min: 0.5, max: 24, step: 0.25, help: '休憩時間を除いた所定労働時間です。' },
  { id: 'daysPerWeek', label: '1週間の勤務日数', type: 'number', unit: '日', default: 5, min: 1, max: 7, step: 1 },
  { id: 'extraHolidays', label: '年間の追加休日', type: 'number', unit: '日', default: 0, min: 0, max: 200, step: 1, help: '祝日・年末年始・夏季休暇など、勤務日に当たる会社の休みの日数。0 なら年52週すべて働く計算です。' },
];

export function calculate({ mode, hourlyAmount, monthlyAmount, yearlyAmount, hoursPerDay, daysPerWeek, extraHolidays }) {
  if (![hoursPerDay, daysPerWeek, extraHolidays].every(Number.isFinite)) return { error: '労働時間・勤務日数・追加休日に数値を入力してください。' };
  if (hoursPerDay < 0.5 || hoursPerDay > 24) return { error: '1日の労働時間は 0.5〜24 時間の範囲で入力してください。' };
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7) return { error: '1週間の勤務日数は 1〜7 の整数（日）で入力してください。' };
  if (!Number.isInteger(extraHolidays) || extraHolidays < 0) return { error: '年間の追加休日は 0 以上の整数（日）で入力してください。' };
  const yearDays = daysPerWeek * 52 - extraHolidays;
  if (yearDays < 1) return { error: '追加休日が多すぎて、年間の勤務日数が 0 日以下になります。入力を見直してください。' };

  const yearHours = hoursPerDay * yearDays;
  const amount = mode === 'hourly' ? hourlyAmount : mode === 'monthly' ? monthlyAmount : yearlyAmount;
  if (!['hourly', 'monthly', 'yearly'].includes(mode)) return { error: '換算の向きを選んでください。' };
  if (!Number.isFinite(amount)) return { error: '金額を数値で入力してください。' };
  if (amount <= 0) return { error: '金額は 0 より大きい値で入力してください。' };
  if (amount > 1e10) return { error: '金額は 100 億円以下で入力してください。' };

  let hourly;
  if (mode === 'hourly') hourly = amount;
  else if (mode === 'monthly') hourly = (amount * 12) / yearHours;
  else hourly = amount / yearHours;
  const yearly = mode === 'yearly' ? amount : mode === 'monthly' ? amount * 12 : hourly * yearHours;
  const monthly = yearly / 12;
  const daily = hourly * hoursPerDay;

  const items = [
    { label: '時給', value: Math.round(hourly), unit: '円', primary: mode !== 'hourly' },
    { label: '月給（年収の12分の1）', value: Math.round(monthly), unit: '円', primary: mode === 'hourly' },
    { label: '年収', value: Math.round(yearly), unit: '円', primary: false },
    { label: '日給（1日あたり）', value: Math.round(daily), unit: '円' },
    { label: '年間の勤務日数', value: yearDays, unit: '日' },
    { label: '月平均の労働時間', value: yearHours / 12, digits: 2, unit: '時間' },
  ];
  return {
    items,
    notes: [
      '金額はすべて額面（税金・社会保険料などを引く前）です。手取りではありません。',
      '月給は年収の12分の1、月平均の労働時間は「1日の労働時間 × 年間の勤務日数 ÷ 12」で求めています。1円未満は四捨五入して表示しています。',
      '賞与・各種手当・残業代は含めていません。年収に賞与が含まれる場合、月給は賞与を12か月に均した金額になります。',
    ],
  };
}
