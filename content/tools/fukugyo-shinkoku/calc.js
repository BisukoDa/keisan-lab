// 副業の確定申告が必要か判定（給与所得者の所得税・国税庁 No.1900 の判定）
// 20万円は「収入」ではなく「所得（収入 − 必要経費）」で判断する。金額は円単位の整数で扱う。
// 副業の所得は「収入 − 必要経費」。赤字は負の値のまま表示する（2か所以上の合計では 0 円として足す）。

export const THRESHOLD = 200000; // 20万円
export const SALARY_LIMIT = 20000000; // 給与収入 2,000万円
export const SMALL_SALARY = 1500000; // 2か所以上・例外の 150万円

export const inputs = [
  {
    id: 'jobs', label: '給与をもらっている勤務先', type: 'select', default: 'one',
    options: [
      { value: 'one', label: '1か所（本業だけ）' },
      { value: 'multi', label: '2か所以上（副業もアルバイト・パートなどの給与）' },
    ],
  },
  { id: 'salary', label: '1年間の給与収入の合計（額面）', type: 'number', unit: '円', default: 5000000, min: 0, step: 10000, help: '源泉徴収票の「支払金額」の合計です。' },
  { id: 'sideRevenue', label: '給与以外の副業の収入金額', type: 'number', unit: '円', default: 400000, min: 0, step: 10000, help: '業務委託・ネット販売・原稿料・不動産の賃貸などの1年間の売上（収入金額）です。' },
  { id: 'sideExpense', label: '副業の必要経費', type: 'number', unit: '円', default: 150000, min: 0, step: 10000, help: '副業の収入を得るために実際に使った費用です。' },
  { id: 'unadjusted', label: '年末調整を受けなかった給与の収入金額（額面）', type: 'number', unit: '円', default: 300000, min: 0, step: 10000, showIf: { jobs: 'multi' }, help: '年末調整をしなかった勤務先の源泉徴収票の「支払金額」です。給与所得控除は引きません。' },
  { id: 'deductions', label: '給与収入から引く所得控除の合計（社会保険料・配偶者控除など）', type: 'number', unit: '円', default: 800000, min: 0, step: 10000, showIf: { jobs: 'multi' }, help: '雑損控除・医療費控除・寄附金控除・基礎控除は含めない合計です。' },
  {
    id: 'withheld', label: '給与から所得税が全額、源泉徴収されている', type: 'select', default: 'yes',
    options: [
      { value: 'yes', label: 'はい（給与明細で所得税が引かれている）' },
      { value: 'no', label: 'いいえ・わからない' },
    ],
  },
];

const yen = (n) => Math.round(n).toLocaleString('ja-JP') + '円';

export function calculate({ jobs, salary, sideRevenue, sideExpense, unadjusted, deductions, withheld }) {
  if (!['one', 'multi'].includes(jobs)) return { error: '勤務先の数を選んでください。' };
  if (!['yes', 'no'].includes(withheld)) return { error: '給与の源泉徴収の有無を選んでください。' };
  const base = [salary, sideRevenue, sideExpense];
  if (!base.every(Number.isFinite)) return { error: '給与収入・副業の収入金額・必要経費に数値を入力してください。' };
  if (base.some((v) => v < 0)) return { error: '金額は 0 以上で入力してください。' };
  if (salary > 1e10 || sideRevenue > 1e10 || sideExpense > 1e10) return { error: '金額は 100 億円以下で入力してください。' };
  if (jobs === 'multi') {
    if (!Number.isFinite(unadjusted) || !Number.isFinite(deductions)) return { error: '年末調整を受けなかった給与の収入金額と所得控除の合計に数値を入力してください。' };
    if (unadjusted < 0 || deductions < 0) return { error: '金額は 0 以上で入力してください。' };
  }

  const sideIncome = sideRevenue - sideExpense; // 副業の所得
  const reasons = [];
  let verdict;

  if (salary > SALARY_LIMIT) {
    reasons.push('給与収入が 2,000万円を超えているため、確定申告が必要です。');
  }
  if (withheld === 'no') {
    reasons.push('給与から所得税が全額引かれていない場合は、この判定の前提に当てはまりません。給与の支払者や税務署に確認してください。');
  }
  if (jobs === 'one') {
    if (sideIncome > THRESHOLD) reasons.push(`副業の所得が ${yen(sideIncome)} で、20万円を超えています。`);
  } else {
    const total = unadjusted + Math.max(sideIncome, 0);
    const salaryAfter = salary - deductions;
    const exempt = salaryAfter <= SMALL_SALARY && sideIncome <= THRESHOLD;
    if (total > THRESHOLD && !exempt) {
      reasons.push(`年末調整を受けなかった給与の収入と副業の所得の合計が ${yen(total)} で、20万円を超えています。`);
    }
  }

  let status;
  if (reasons.length === 0) {
    status = '所得税の確定申告は不要（還付を受ける場合などを除く）';
    verdict = 'no';
  } else if (salary <= SALARY_LIMIT && withheld === 'no') {
    status = '要確認';
    verdict = 'check';
  } else {
    status = '所得税の確定申告が必要';
    verdict = 'yes';
  }

  const items = [
    { label: '判定', value: status, primary: true },
    { label: '副業の所得（収入 − 必要経費）', value: Math.round(sideIncome), unit: '円' },
  ];
  if (jobs === 'multi') {
    items.push({ label: '年末調整を受けなかった給与の収入 + 副業の所得', value: Math.round(unadjusted + Math.max(sideIncome, 0)), unit: '円' });
    items.push({ label: '給与収入 − 所得控除の合計', value: Math.round(salary - deductions), unit: '円' });
  }
  if (jobs === 'one') items.push({ label: '20万円との差（副業の所得 − 20万円）', value: Math.round(sideIncome - THRESHOLD), unit: '円' });
  else items.push({ label: '20万円との差（合算額 − 20万円）', value: Math.round(unadjusted + Math.max(sideIncome, 0) - THRESHOLD), unit: '円' });

  const notes = [
    ...reasons,
    '住民税の申告は所得税とは別の手続きです。所得税の確定申告が不要でも、市区町村への住民税の申告が必要な場合があります。お住まいの市区町村に確認してください。',
    '医療費控除・寄附金控除（ふるさと納税のワンストップ特例を使わない場合など）・住宅ローン控除の初年度などで税金の還付を受けたい場合は、副業の所得が20万円以下でも確定申告をします。',
    '副業の所得は「収入 − 必要経費」の簡易計算です。一時所得は2分の1にするなど、所得の種類によって計算が違います。不動産・株式などの所得、退職金、公的年金、2,000万円超の場合の細かい条件は含めていません。',
    'この判定は国税庁 No.1900 の考え方に基づく目安です。個別の税務判断は税務署や税理士に確認してください。',
  ];
  return { items, notes };
}
